import { spawn, execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { closeSync, openSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { addTextOutput } from "./shared.mjs"

const BIFROST_RUNNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/bifrost-runner.mjs")

const DEFAULT_OPTIONS = {
  commandName: "bifrost",
  agent: "build",
  preferredTunnel: "cloudflared",
  fallbackTunnel: "ngrok",
  stateDir: ".opencode/bifrost",
  defaultHost: "127.0.0.1",
  startupTimeoutMs: 30000,
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function bifrostTemplate(options) {
  return `Return this Bifrost output exactly and do not add commentary:
!\`node ${shellQuote(BIFROST_RUNNER)} --state-dir ${shellQuote(options.stateDir)} --host ${shellQuote(options.defaultHost)} --preferred-tunnel ${shellQuote(options.preferredTunnel)} --fallback-tunnel ${shellQuote(options.fallbackTunnel)} -- $ARGUMENTS\``
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function trimSlash(value) {
  return String(value || "").replace(/\/$/, "")
}

function routeDirectory(session) {
  const directory = session.location?.directory || session.directory || session.path || ""
  if (!directory) return ""
  return directory.startsWith("/") ? directory : `/${directory}`
}

function workspaceDirectory(pluginInput = {}) {
  return pluginInput.directory || pluginInput.project?.root || pluginInput.project?.directory || process.cwd()
}

function resolveStateDir(pluginInput, config) {
  return path.resolve(workspaceDirectory(pluginInput), config.stateDir)
}

function candidateStateDirs(pluginInput, config) {
  const dirs = [resolveStateDir(pluginInput, config)]
  if (!path.isAbsolute(config.stateDir) && process.env.HOME) dirs.push(path.resolve(process.env.HOME, config.stateDir))
  return [...new Set(dirs)]
}

function parseRequest(args = "") {
  const tokens = String(args).trim().split(/\s+/).filter(Boolean)
  const first = tokens[0]?.toLowerCase()
  const mode = ["start", "status", "stop"].includes(first) ? first : "start"
  const portMatch = String(args).match(/(?:--port\s+|port\s+|:)(\d{2,5})\b/)
  return {
    mode,
    port: portMatch ? Number(portMatch[1]) : 0,
    newServer: /\bnew\b|--new/.test(String(args)),
  }
}

async function commandPath(command) {
  return new Promise((resolve) => {
    execFile("sh", ["-lc", `command -v ${shellQuote(command)}`], (error, stdout) => {
      resolve(error ? "" : stdout.trim().split("\n")[0])
    })
  })
}

function pidAlive(pid) {
  if (!pid) return false
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

async function readState(stateDir) {
  try {
    return JSON.parse(await readFile(path.join(stateDir, "state.json"), "utf8"))
  } catch {
    return null
  }
}

async function findState(pluginInput, config) {
  for (const stateDir of candidateStateDirs(pluginInput, config)) {
    const state = await readState(stateDir)
    if (state) return { stateDir, state }
  }
  return { stateDir: resolveStateDir(pluginInput, config), state: null }
}

async function writeState(stateDir, state) {
  await mkdir(stateDir, { recursive: true })
  await writeFile(path.join(stateDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`)
}

async function choosePort(requested) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(requested || 0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : requested
      server.close(() => resolve(port))
    })
  })
}

function startProcess(command, args, env, logPath) {
  const log = openSync(logPath, "a")
  const child = spawn(command, args, {
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
  })
  child.unref()
  closeSync(log)
  return child.pid
}

async function openUrl(url) {
  if (!url) return false
  const opener = process.platform === "darwin" ? await commandPath("open") : await commandPath("xdg-open")
  if (!opener) return false
  const child = spawn(opener, [url], { detached: true, stdio: "ignore" })
  child.unref()
  return true
}

async function waitForLocalServer(url, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.status > 0) return response.status
    } catch {
      await sleep(500)
    }
  }
  return 0
}

async function waitForTunnelUrl(logPath, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const log = await readFile(logPath, "utf8")
      const matches = [...log.matchAll(/https:\/\/[-a-zA-Z0-9.]+\.(?:trycloudflare\.com|ngrok-free\.app|ngrok\.app|ngrok\.io)/g)]
      if (matches.length) return matches.at(-1)[0]
    } catch {
      // Log file may not exist yet.
    }
    await sleep(500)
  }
  return ""
}

function authHeader(state) {
  const username = state.username || "opencode"
  if (!state.password) return {}
  return { Authorization: `Basic ${Buffer.from(`${username}:${state.password}`).toString("base64")}` }
}

function sessionPath(session) {
  const directory = routeDirectory(session)
  return directory ? Buffer.from(directory).toString("base64url") : ""
}

function sessionUrl(baseUrl, session) {
  const dir = sessionPath(session)
  if (!baseUrl || !dir || !session.id) return ""
  return `${trimSlash(baseUrl)}/${dir}/session/${encodeURIComponent(session.id)}`
}

async function sessionLinks(state, preferredSessionID = "", limit = 3) {
  if (!state?.localUrl) return []
  try {
    const response = await fetch(`${trimSlash(state.localUrl)}/session`, { headers: authHeader(state) })
    if (!response.ok) return []
    const sessions = await response.json()
    if (!Array.isArray(sessions)) return []
    return sessions
      .filter((session) => session.id && sessionPath(session))
      .sort((a, b) => {
        if (preferredSessionID && a.id === preferredSessionID) return -1
        if (preferredSessionID && b.id === preferredSessionID) return 1
        return Number(b.time?.updated || 0) - Number(a.time?.updated || 0)
      })
      .slice(0, Math.max(limit, preferredSessionID ? 1 : 0))
      .map((session) => ({
        id: session.id,
        title: session.title || session.slug || session.id,
        directory: session.directory || session.path || "unknown",
        url: sessionUrl(state.publicUrl || state.localUrl, session),
        preferred: Boolean(preferredSessionID && session.id === preferredSessionID),
      }))
      .filter((session) => session.url)
  } catch {
    return []
  }
}

function formatSessionLinks(links) {
  if (!links.length) return "Session links: unavailable"
  const current = links[0]
  const label = current.preferred ? "Current TUI session" : "Most recent session"
  const recent = links.map((session, index) => `${index + 1}. ${session.preferred ? "[current] " : ""}${session.title} (${session.directory})\n   ${session.url}`).join("\n")
  return `${label} URL: ${current.url}
Current session title: ${current.title}

Recent session URLs:
${recent}`
}

async function statusText(stateDir, state, preferredSessionID = "", sessionLinkList) {
  if (!state) return `Bifrost status: no managed portal state found.\nState directory: ${stateDir}`
  const webAlive = pidAlive(state.webPid)
  const tunnelAlive = pidAlive(state.tunnelPid)
  const username = state.username || "opencode"
  const links = sessionLinkList || (webAlive ? await sessionLinks(state, preferredSessionID) : [])
  return `Bifrost status: ${webAlive && tunnelAlive ? "running" : "partial or stale"}

Open: ${state.publicUrl || state.localUrl || "unknown"}
Username: ${username}
Password: ${state.password || "unknown"}

Copy login: url=${state.publicUrl || state.localUrl || "unknown"} username=${username} password=${state.password || "unknown"}

${formatSessionLinks(links)}

Local URL: ${state.localUrl || "unknown"}
Public URL: ${state.publicUrl || "unknown"}
Username: ${username}
Password: ${state.password || "unknown"}
Password source: ${state.passwordSource || "unknown"}
Attach: ${state.localUrl ? `opencode attach ${state.localUrl}` : "unknown"}
Web PID: ${state.webPid || "unknown"} (${webAlive ? "running" : "not running"})
Tunnel PID: ${state.tunnelPid || "unknown"} (${tunnelAlive ? "running" : "not running"})
Tunnel provider: ${state.tunnelProvider || "unknown"}
State: ${path.join(stateDir, "state.json")}
Web log: ${state.webLog || "unknown"}
Tunnel log: ${state.tunnelLog || "unknown"}

Stop: /bifrost stop`
}

async function stopBifrost(stateDir) {
  const state = await readState(stateDir)
  if (!state) return `Bifrost stop: no managed portal state found.\nState directory: ${stateDir}`
  const stopped = []
  for (const [label, pid] of [["tunnel", state.tunnelPid], ["OpenCode Web", state.webPid]]) {
    if (!pid) continue
    if (!pidAlive(pid)) {
      stopped.push(`${label} PID ${pid}: already stopped`)
      continue
    }
    process.kill(Number(pid), "SIGTERM")
    stopped.push(`${label} PID ${pid}: stopped`)
  }
  await rm(path.join(stateDir, "state.json"), { force: true })
  return `Bifrost stop complete.\n${stopped.join("\n") || "No PIDs were recorded."}\nState removed: ${path.join(stateDir, "state.json")}`
}

async function startBifrost(pluginInput, config, request) {
  const stateDir = resolveStateDir(pluginInput, config)
  const existing = await readState(stateDir)
  if (existing && !request.newServer && pidAlive(existing.webPid) && pidAlive(existing.tunnelPid)) {
    const links = await sessionLinks(existing, request.sessionID)
    const opened = await openUrl(links[0]?.url)
    return `${await statusText(stateDir, existing, request.sessionID, links)}\nOpened session URL: ${opened ? links[0].url : "not opened"}`
  }

  await mkdir(stateDir, { recursive: true })
  const opencode = await commandPath("opencode")
  if (!opencode) return "Bifrost start failed: `opencode` was not found on PATH."

  const preferred = await commandPath(config.preferredTunnel)
  const fallback = preferred ? "" : await commandPath(config.fallbackTunnel)
  const tunnelCommand = preferred || fallback
  const tunnelProvider = preferred ? config.preferredTunnel : config.fallbackTunnel
  if (!tunnelCommand) return `Bifrost start failed: neither ${config.preferredTunnel} nor ${config.fallbackTunnel} was found on PATH.`

  const port = await choosePort(request.port)
  const password = process.env.OPENCODE_SERVER_PASSWORD || `bifrost-${randomBytes(18).toString("base64url")}`
  const username = process.env.OPENCODE_SERVER_USERNAME || "opencode"
  const passwordSource = process.env.OPENCODE_SERVER_PASSWORD ? "OPENCODE_SERVER_PASSWORD" : "generated temporary password"
  const localUrl = `http://${config.defaultHost}:${port}`
  const webLog = path.join(stateDir, "opencode-web.log")
  const tunnelLog = path.join(stateDir, `${tunnelProvider}.log`)
  const webPid = startProcess(opencode, ["web", "--hostname", config.defaultHost, "--port", String(port)], { OPENCODE_SERVER_PASSWORD: password, OPENCODE_SERVER_USERNAME: username }, webLog)
  const localStatus = await waitForLocalServer(localUrl, config.startupTimeoutMs)
  if (!localStatus) return `Bifrost start failed: OpenCode Web did not respond at ${localUrl}.\nWeb log: ${webLog}`

  const tunnelArgs = tunnelProvider === "ngrok" ? ["http", localUrl] : ["tunnel", "--url", localUrl]
  const tunnelPid = startProcess(tunnelCommand, tunnelArgs, {}, tunnelLog)
  const publicUrl = await waitForTunnelUrl(tunnelLog, config.startupTimeoutMs)
  const state = { localUrl, publicUrl, username, password, passwordSource, port, webPid, tunnelPid, tunnelProvider, stateDir, webLog, tunnelLog, startedAt: new Date().toISOString() }
  await writeState(stateDir, state)

  if (!publicUrl) {
    return `Bifrost portal partially started: OpenCode Web is running, but no public tunnel URL was detected yet.

${await statusText(stateDir, state, request.sessionID)}

Check tunnel log: ${tunnelLog}`
  }

  const links = await sessionLinks(state, request.sessionID)
  const opened = await openUrl(links[0]?.url)

  return `Bifrost portal started.

Local URL: ${localUrl}
Public URL: ${publicUrl}
Username: ${username}
Password: ${password}
Password source: ${passwordSource}
Copy login: url=${publicUrl} username=${username} password=${password}

${formatSessionLinks(links)}

Opened session URL: ${opened ? links[0].url : "not opened"}

Attach: opencode attach ${localUrl}
Status: /bifrost status
Stop: /bifrost stop
Web PID: ${webPid}
Tunnel PID: ${tunnelPid}
Tunnel provider: ${tunnelProvider}
State: ${path.join(stateDir, "state.json")}
Web log: ${webLog}
Tunnel log: ${tunnelLog}`
}

async function runBifrost(pluginInput, config, args, sessionID = "") {
  const request = parseRequest(args)
  request.sessionID = sessionID
  const { stateDir, state } = await findState(pluginInput, config)
  if (request.mode === "status") return statusText(stateDir, state, request.sessionID)
  if (request.mode === "stop") return stopBifrost(stateDir)
  return startBifrost(pluginInput, config, request)
}

export async function BifrostPlugin(pluginInput, options) {
  const config = normalizeOptions(options)
  const template = bifrostTemplate(config)

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Start, inspect, or stop a secure OpenCode Web remote portal with a tunnel.",
        agent: config.agent,
        template,
      }
    },
    "command.execute.before": async (input, output) => {
      if (input.command !== config.commandName) return
      addTextOutput(output, await runBifrost(pluginInput, config, input.arguments || "", input.sessionID || ""))
    },
    "shell.env": async (input, output) => {
      if (!input.sessionID) return
      output.env.BIFROST_SESSION_ID = input.sessionID
    },
  }
}

export default BifrostPlugin
