import { spawn, execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { closeSync, openSync } from "node:fs"
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { addTextOutput } from "./shared.mjs"

const BIFROST_PROXY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/bifrost-proxy.mjs")

const DEFAULT_OPTIONS = {
  commandName: "bifrost",
  agent: "build",
  preferredTunnel: "cloudflared",
  fallbackTunnel: "ngrok",
  serverMode: "auto",
  stateDir: ".opencode/bifrost",
  defaultHost: "127.0.0.1",
  startupTimeoutMs: 30000,
}

function normalizeOptions(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  config.serverMode = ["auto", "active", "web"].includes(config.serverMode) ? config.serverMode : DEFAULT_OPTIONS.serverMode
  return config
}

function bifrostTemplate(options) {
  return `Bifrost is handled by the ${options.commandName} command hook. Return the hook output exactly and do not run shell commands.`
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

function toUrlString(value) {
  if (!value) return ""
  try {
    return trimSlash(value.href || String(value))
  } catch {
    return ""
  }
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
  const mode = ["start", "status", "stop", "sync"].includes(first) ? first : "start"
  const portMatch = String(args).match(/(?:--port\s+|port\s+|:)(\d{2,5})\b/)
  return {
    mode,
    port: portMatch ? Number(portMatch[1]) : 0,
    newServer: /\bnew\b|--new/.test(String(args)),
  }
}

function activeServerUrl(pluginInput = {}) {
  return toUrlString(pluginInput.serverUrl || process.env.BIFROST_ACTIVE_SERVER_URL)
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

function localServerManagedByBifrost(state) {
  return state?.serverMode !== "active" && !state?.attachedToActiveServer
}

async function localServerAlive(state) {
  if (!state) return false
  if (state.proxyPid && !pidAlive(state.proxyPid)) return false
  if (localServerManagedByBifrost(state)) return pidAlive(state.webPid)
  return Boolean(await waitForLocalServer(state.localUrl, 1500, authHeader(state)))
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
  await mkdir(stateDir, { recursive: true, mode: 0o700 })
  await chmod(stateDir, 0o700).catch(() => {})
  const statePath = path.join(stateDir, "state.json")
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  await chmod(statePath, 0o600).catch(() => {})
}

function stopStartedPid(pid) {
  if (!pid || !pidAlive(pid)) return
  try {
    process.kill(Number(pid), "SIGTERM")
  } catch {
    // Best-effort cleanup during failed startup.
  }
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

async function waitForLocalServer(url, timeoutMs, headers = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { headers })
      if (response.status > 0 && response.status < 500) return response.status
    } catch {
      await sleep(500)
    }
  }
  return 0
}

async function ngrokApiUrl(localUrl) {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels")
    if (!response.ok) return ""
    const body = await response.json()
    const tunnels = Array.isArray(body.tunnels) ? body.tunnels : []
    const tunnel = tunnels.find((entry) => entry.public_url && (!localUrl || entry.config?.addr === localUrl)) || tunnels.find((entry) => entry.public_url)
    return tunnel?.public_url || ""
  } catch {
    return ""
  }
}

async function waitForTunnelUrl(logPath, timeoutMs, tunnelProvider = "", localUrl = "") {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const log = await readFile(logPath, "utf8")
      const matches = [...log.matchAll(/https:\/\/[-a-zA-Z0-9.]+\.(?:trycloudflare\.com|ngrok-free\.app|ngrok\.app|ngrok\.io)/g)]
      if (matches.length) return matches.at(-1)[0]
    } catch {
      // Log file may not exist yet.
    }
    if (tunnelProvider === "ngrok") {
      const apiUrl = await ngrokApiUrl(localUrl)
      if (apiUrl) return apiUrl
    }
    await sleep(500)
  }
  return ""
}

async function eventStreamAvailable(state) {
  const baseUrl = trimSlash(state?.localUrl || "")
  if (!baseUrl) return false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`${baseUrl}/event`, { headers: authHeader(state), signal: controller.signal })
    if (!response.ok || !response.body) return false
    const reader = response.body.getReader()
    const { value } = await reader.read()
    await reader.cancel().catch(() => {})
    return Boolean(value?.length)
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
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
  return `Web session history URL (${label}): ${current.url}
Current session title: ${current.title}

Recent session URLs:
${recent}`
}

function formatTuiControl(state, sync = {}) {
  const baseUrl = trimSlash(state.publicUrl || state.localUrl || "")
  if (!baseUrl) return "Live TUI control API: unavailable"
  const username = state.username || "opencode"
  const auth = `-u ${shellQuote(`${username}:${state.password || ""}`)}`
  const text = "<prompt text>"
  const eventStatus = sync.eventStreamAvailable ? "available" : "unavailable"
  return `Live TUI control API:
Event stream status: ${eventStatus}
Append prompt: curl ${auth} -X POST ${shellQuote(`${baseUrl}/tui/append-prompt`)} -H 'content-type: application/json' --data ${shellQuote(JSON.stringify({ text }))}
Submit prompt: curl ${auth} -X POST ${shellQuote(`${baseUrl}/tui/submit-prompt`)}
Clear prompt: curl ${auth} -X POST ${shellQuote(`${baseUrl}/tui/clear-prompt`)}
Events stream: curl ${auth} -N ${shellQuote(`${baseUrl}/event`)}

Sync note: Web session URLs open session history in the browser and Web prompts are written directly to the OpenCode session. SSE events expose message text and session IDs, but not client origin, so Bifrost does not auto-forward Web prompts into /tui/submit-prompt because that would duplicate messages. The official live-control path for the active local TUI is the /tui API above.`
}

async function statusText(stateDir, state, preferredSessionID = "", sessionLinkList) {
  if (!state) return `Bifrost status: no managed portal state found.\nState directory: ${stateDir}`
  const webAlive = await localServerAlive(state)
  const tunnelAlive = pidAlive(state.tunnelPid)
  const username = state.username || "opencode"
  const links = sessionLinkList || (webAlive ? await sessionLinks(state, preferredSessionID) : [])
  const sync = { eventStreamAvailable: webAlive ? await eventStreamAvailable(state) : false }
  return `Bifrost status: ${webAlive && tunnelAlive ? "running" : "partial or stale"}

Open: ${state.publicUrl || state.localUrl || "unknown"}
Username: ${username}
Password: ${state.password || "unknown"}

Copy login: url=${state.publicUrl || state.localUrl || "unknown"} username=${username} password=${state.password || "unknown"}

${formatSessionLinks(links)}

${formatTuiControl(state, sync)}

Local URL: ${state.localUrl || "unknown"}
Public URL: ${state.publicUrl || "unknown"}
Server mode: ${state.serverMode || "web"}
Attached to active TUI server: ${state.attachedToActiveServer ? "yes" : "no"}
Username: ${username}
Password: ${state.password || "unknown"}
Password source: ${state.passwordSource || "unknown"}
Attach: ${state.upstreamUrl ? `opencode attach ${state.upstreamUrl}` : state.localUrl ? `opencode attach ${state.localUrl}` : "unknown"}
Web PID: ${state.webPid || "none"} (${localServerManagedByBifrost(state) ? (webAlive ? "running" : "not running") : "active server is not Bifrost-managed"})
Proxy PID: ${state.proxyPid || "none"} (${state.proxyPid ? (pidAlive(state.proxyPid) ? "running" : "not running") : "not used"})
Tunnel PID: ${state.tunnelPid || "unknown"} (${tunnelAlive ? "running" : "not running"})
Tunnel provider: ${state.tunnelProvider || "unknown"}
State: ${path.join(stateDir, "state.json")}
Web log: ${state.webLog || "unknown"}
Proxy log: ${state.proxyLog || "unknown"}
Tunnel log: ${state.tunnelLog || "unknown"}

Stop: /bifrost stop`
}

async function stopBifrost(stateDir) {
  const state = await readState(stateDir)
  if (!state) return `Bifrost stop: no managed portal state found.\nState directory: ${stateDir}`
  const stopped = []
  for (const [label, pid] of [["tunnel", state.tunnelPid], ["Bifrost proxy", state.proxyPid], ["OpenCode Web", state.webPid]]) {
    if (!pid) continue
    if (label === "OpenCode Web" && !localServerManagedByBifrost(state)) continue
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
  if (existing && !request.newServer && await localServerAlive(existing) && pidAlive(existing.tunnelPid)) {
    const links = await sessionLinks(existing, request.sessionID)
    const opened = await openUrl(links[0]?.url)
    return `${await statusText(stateDir, existing, request.sessionID, links)}\nOpened session URL: ${opened ? links[0].url : "not opened"}`
  }

  await mkdir(stateDir, { recursive: true })
  const preferred = await commandPath(config.preferredTunnel)
  const fallback = preferred ? "" : await commandPath(config.fallbackTunnel)
  const tunnelCommand = preferred || fallback
  const tunnelProvider = preferred ? config.preferredTunnel : config.fallbackTunnel
  if (!tunnelCommand) return `Bifrost start failed: neither ${config.preferredTunnel} nor ${config.fallbackTunnel} was found on PATH.`

  const username = process.env.OPENCODE_SERVER_USERNAME || "opencode"
  let password = process.env.OPENCODE_SERVER_PASSWORD || ""
  let passwordSource = process.env.OPENCODE_SERVER_PASSWORD ? "OPENCODE_SERVER_PASSWORD" : "generated temporary password"
  let localUrl = ""
  let port = 0
  let webLog = ""
  let webPid = null
  let proxyLog = ""
  let proxyPid = null
  let serverMode = "web"
  let attachedToActiveServer = false
  let upstreamUrl = ""
  const activeUrl = activeServerUrl(pluginInput)

  async function useActiveProxy() {
    const node = process.execPath
    port = await choosePort(request.port)
    password ||= `bifrost-${randomBytes(18).toString("base64url")}`
    upstreamUrl = activeUrl
    localUrl = `http://${config.defaultHost}:${port}`
    proxyLog = path.join(stateDir, "bifrost-proxy.log")
    proxyPid = startProcess(node, [
      BIFROST_PROXY,
      "--listen-host", config.defaultHost,
      "--listen-port", String(port),
      "--upstream", upstreamUrl,
    ], {
      BIFROST_PROXY_USERNAME: username,
      BIFROST_PROXY_PASSWORD: password,
      BIFROST_UPSTREAM_USERNAME: process.env.OPENCODE_SERVER_USERNAME || "opencode",
      BIFROST_UPSTREAM_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || "",
    }, proxyLog)
    serverMode = "active"
    attachedToActiveServer = true
    passwordSource = process.env.OPENCODE_SERVER_PASSWORD ? "OPENCODE_SERVER_PASSWORD" : "generated temporary password"
  }

  async function useManagedWeb() {
    const opencode = await commandPath("opencode")
    if (!opencode) return "Bifrost start failed: `opencode` was not found on PATH."
    port = await choosePort(request.port)
    password ||= `bifrost-${randomBytes(18).toString("base64url")}`
    localUrl = `http://${config.defaultHost}:${port}`
    webLog = path.join(stateDir, "opencode-web.log")
    webPid = startProcess(opencode, ["web", "--hostname", config.defaultHost, "--port", String(port)], { OPENCODE_SERVER_PASSWORD: password, OPENCODE_SERVER_USERNAME: username }, webLog)
    proxyLog = ""
    proxyPid = null
    serverMode = "web"
    attachedToActiveServer = false
    upstreamUrl = ""
    return ""
  }

  if (config.serverMode !== "web" && activeUrl) {
    await useActiveProxy()
  } else if (config.serverMode === "active") {
    if (!activeUrl) return "Bifrost start failed: active server mode was requested, but OpenCode did not provide an active server URL."
  } else {
    const error = await useManagedWeb()
    if (error) return error
  }

  const tunnelLog = path.join(stateDir, `${tunnelProvider}.log`)
  let localStatus = await waitForLocalServer(localUrl, config.startupTimeoutMs, serverMode === "active" ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` } : {})
  if (!localStatus) {
    stopStartedPid(proxyPid)
    stopStartedPid(webPid)
    if (serverMode === "active" && config.serverMode === "auto") {
      await sleep(250)
      const error = await useManagedWeb()
      if (error) return error
      localStatus = await waitForLocalServer(localUrl, config.startupTimeoutMs)
      if (!localStatus) {
        stopStartedPid(webPid)
        return `Bifrost start failed: OpenCode server did not respond at ${localUrl}.${webLog ? `\nWeb log: ${webLog}` : ""}`
      }
    } else {
      return `Bifrost start failed: OpenCode server did not respond at ${localUrl}.${webLog ? `\nWeb log: ${webLog}` : ""}${proxyLog ? `\nProxy log: ${proxyLog}` : ""}`
    }
  }

  const tunnelArgs = tunnelProvider === "ngrok" ? ["http", localUrl] : ["tunnel", "--url", localUrl]
  const tunnelPid = startProcess(tunnelCommand, tunnelArgs, {}, tunnelLog)
  const publicUrl = await waitForTunnelUrl(tunnelLog, config.startupTimeoutMs, tunnelProvider, localUrl)
  const state = { localUrl, publicUrl, username, password, passwordSource, port, webPid, proxyPid, tunnelPid, tunnelProvider, serverMode, attachedToActiveServer, upstreamUrl, stateDir, webLog, proxyLog, tunnelLog, startedAt: new Date().toISOString() }
  await writeState(stateDir, state)

  if (!publicUrl) {
    return `Bifrost portal partially started: OpenCode server is running, but no public tunnel URL was detected yet.

${await statusText(stateDir, state, request.sessionID)}

Check tunnel log: ${tunnelLog}`
  }

  const links = await sessionLinks(state, request.sessionID)
  const opened = await openUrl(links[0]?.url)

  return `Bifrost portal started.

Local URL: ${localUrl}
Public URL: ${publicUrl}
Server mode: ${serverMode}
Attached to active TUI server: ${attachedToActiveServer ? "yes" : "no"}
Active upstream URL: ${upstreamUrl || "none"}
Username: ${username}
Password: ${password}
Password source: ${passwordSource}
Copy login: url=${publicUrl} username=${username} password=${password}

${formatSessionLinks(links)}

Opened session URL: ${opened ? links[0].url : "not opened"}

Attach: opencode attach ${upstreamUrl || localUrl}
Status: /bifrost status
Stop: /bifrost stop
Web PID: ${webPid || "none"}
Proxy PID: ${proxyPid || "none"}
Tunnel PID: ${tunnelPid}
Tunnel provider: ${tunnelProvider}
State: ${path.join(stateDir, "state.json")}
Web log: ${webLog || "none"}
Proxy log: ${proxyLog || "none"}
Tunnel log: ${tunnelLog}`
}

async function runBifrost(pluginInput, config, args, sessionID = "") {
  const request = parseRequest(args)
  request.sessionID = sessionID
  const { stateDir, state } = await findState(pluginInput, config)
  if (request.mode === "status" || request.mode === "sync") return statusText(stateDir, state, request.sessionID)
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
        description: "Start, inspect, or stop a secure remote portal to the active OpenCode server with a tunnel.",
        agent: config.agent,
        template,
      }
    },
    "command.execute.before": async (input, output) => {
      if (input.command !== config.commandName) return
      addTextOutput(output, await runBifrost(pluginInput, config, input.arguments || "", input.sessionID || ""))
    },
    "shell.env": async (input, output) => {
      if (input.sessionID) output.env.BIFROST_SESSION_ID = input.sessionID
      const serverUrl = activeServerUrl(pluginInput)
      if (serverUrl) output.env.BIFROST_ACTIVE_SERVER_URL = serverUrl
    },
  }
}

export default BifrostPlugin
