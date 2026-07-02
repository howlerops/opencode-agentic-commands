#!/usr/bin/env node
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const opencode = process.env.OPENCODE_BIN || "/Users/jacob_1/.opencode/bin/opencode"
const stateDirName = ".bifrost-e2e"
const host = "127.0.0.1"
const serverPort = Number(process.env.BIFROST_E2E_SERVER_PORT || 55341)
const upstreamUrl = `http://${host}:${serverPort}`
const tunnelCommand = process.env.BIFROST_E2E_TUNNEL || "true"
const workdir = await mkdtemp(path.join(tmpdir(), "bifrost-e2e-"))
const stateDir = path.join(workdir, stateDirName)
let serverPid = 0

function fail(message) {
  throw new Error(message)
}

function startProcess(command, args, env, logPath) {
  const child = spawn(command, args, {
    cwd: workdir,
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", "ignore", "ignore"],
  })
  child.unref()
  return child.pid
}

async function waitFor(url, options = {}, timeoutMs = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), ...options })
      if (response.status > 0 && response.status < 500) return response
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  fail(`Timed out waiting for ${url}`)
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) fail(`POST ${url} failed: ${response.status} ${await response.text()}`)
  return response.json()
}

function authHeader(state) {
  return { Authorization: `Basic ${Buffer.from(`${state.username}:${state.password}`).toString("base64")}` }
}

function killPid(pid) {
  if (!pid) return
  try {
    process.kill(Number(pid), "SIGTERM")
  } catch {
    // Best-effort cleanup.
  }
}

try {
  await mkdir(stateDir, { recursive: true })
  serverPid = startProcess(opencode, ["serve", "--hostname", host, "--port", String(serverPort)], {}, path.join(stateDir, "opencode-serve.log"))
  await waitFor(`${upstreamUrl}/`)

  const runner = path.join(root, "scripts/bifrost-runner.mjs")
  const runnerOutput = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, "--state-dir", stateDirName, "--host", host, "--preferred-tunnel", tunnelCommand, "--fallback-tunnel", tunnelCommand, "--server-mode", "auto", "--startup-timeout-ms", "10000", "--active-server-url", upstreamUrl, "--", "start"], {
      cwd: workdir,
      env: { ...process.env, BIFROST_SESSION_ID: "" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("exit", (code) => (code === 0 ? resolve(output) : reject(new Error(output))))
  })

  if (!/Server mode: active/.test(runnerOutput)) fail(`Bifrost did not start in active mode:\n${runnerOutput}`)
  if (!/Web PID: none/.test(runnerOutput)) fail(`Bifrost spawned Web mode unexpectedly:\n${runnerOutput}`)

  const state = JSON.parse(await readFile(path.join(stateDir, "state.json"), "utf8"))
  const headers = authHeader(state)
  const proxyUrl = state.localUrl
  await waitFor(`${proxyUrl}/`, { headers })

  const session = await postJson(`${upstreamUrl}/session`, { directory: workdir, title: "Bifrost E2E smoke" })
  const sessionID = session.id
  await postJson(`${proxyUrl}/session/${sessionID}/message`, { noReply: true, parts: [{ type: "text", text: "BIFROST_E2E_FROM_PROXY" }] }, headers)
  await postJson(`${upstreamUrl}/session/${sessionID}/message`, { noReply: true, parts: [{ type: "text", text: "BIFROST_E2E_FROM_UPSTREAM" }] })

  const upstreamMessages = await (await fetch(`${upstreamUrl}/session/${sessionID}/message`, { signal: AbortSignal.timeout(15000) })).json()
  const proxyMessages = await (await fetch(`${proxyUrl}/session/${sessionID}/message`, { headers, signal: AbortSignal.timeout(15000) })).json()
  const upstreamText = JSON.stringify(upstreamMessages)
  const proxyText = JSON.stringify(proxyMessages)
  if (!upstreamText.includes("BIFROST_E2E_FROM_PROXY") || !upstreamText.includes("BIFROST_E2E_FROM_UPSTREAM")) fail("Upstream did not see both E2E markers")
  if (!proxyText.includes("BIFROST_E2E_FROM_PROXY") || !proxyText.includes("BIFROST_E2E_FROM_UPSTREAM")) fail("Proxy did not see both E2E markers")

  const append = await fetch(`${proxyUrl}/tui/append-prompt`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ text: "BIFROST_E2E_TUI_CONTROL" }), signal: AbortSignal.timeout(15000) })
  if (!append.ok || (await append.text()) !== "true") fail("TUI append-prompt failed through proxy")
  const clear = await fetch(`${proxyUrl}/tui/clear-prompt`, { method: "POST", headers, signal: AbortSignal.timeout(15000) })
  if (!clear.ok || (await clear.text()) !== "true") fail("TUI clear-prompt failed through proxy")

  console.log(JSON.stringify({ ok: true, serverMode: state.serverMode, publicUrl: state.publicUrl || "", proxyUrl, sessionID, workdir }, null, 2))
} finally {
  try {
    await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(root, "scripts/bifrost-runner.mjs"), "--state-dir", stateDirName, "--server-mode", "active", "--active-server-url", upstreamUrl, "--", "stop"], { cwd: workdir, env: process.env, stdio: "ignore" })
      child.on("exit", resolve)
    })
  } catch {
    // Best-effort cleanup.
  }
  killPid(serverPid)
  await rm(workdir, { recursive: true, force: true })
}
