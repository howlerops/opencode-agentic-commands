import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { createServer } from "node:http"
import path from "node:path"

function listen(server, host = "127.0.0.1") {
  return new Promise((resolve) => {
    server.listen(0, host, () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

async function waitFor(url, headers = {}) {
  const started = Date.now()
  while (Date.now() - started < 5000) {
    try {
      const response = await fetch(url, { headers })
      if (response.status > 0) return response
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

const upstreamRequests = []
const upstream = createServer((request, response) => {
  upstreamRequests.push({ url: request.url, authorization: request.headers.authorization || "" })
  if (request.url === "/session") {
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify([{ id: "ses_proxy", directory: "/tmp/proxy", time: { updated: 1 } }]))
    return
  }
  if (request.url === "/tui/append-prompt" && request.method === "POST") {
    response.setHeader("content-type", "application/json")
    response.end("true")
    return
  }
  response.setHeader("content-type", "text/html")
  response.end("<html>Bifrost upstream</html>")
})

const upstreamPort = await listen(upstream)
const proxyListenProbe = createServer()
const proxyPort = await listen(proxyListenProbe)
await close(proxyListenProbe)

const proxy = spawn(process.execPath, [
  path.resolve("scripts/bifrost-proxy.mjs"),
  "--listen-host", "127.0.0.1",
  "--listen-port", String(proxyPort),
  "--upstream", `http://127.0.0.1:${upstreamPort}`,
], {
  env: {
    ...process.env,
    BIFROST_PROXY_USERNAME: "opencode",
    BIFROST_PROXY_PASSWORD: "proxy-password",
    BIFROST_UPSTREAM_USERNAME: "opencode",
    BIFROST_UPSTREAM_PASSWORD: "upstream-password",
  },
  stdio: "ignore",
})

function processCommand(pid) {
  return new Promise((resolve) => {
    execFile("ps", ["-p", String(pid), "-o", "command="], (error, stdout) => resolve(error ? "" : stdout))
  })
}

function runProxyWithArgs(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.resolve("scripts/bifrost-proxy.mjs"), ...args], { stdio: "ignore" })
    child.on("exit", (code) => resolve(code))
  })
}

try {
  const unauthorized = await waitFor(`http://127.0.0.1:${proxyPort}/session`)
  assert.equal(unauthorized.status, 401)

  const auth = { Authorization: `Basic ${Buffer.from("opencode:proxy-password").toString("base64")}` }
  const command = await processCommand(proxy.pid)
  assert.doesNotMatch(command, /proxy-password/)
  assert.doesNotMatch(command, /upstream-password/)

  const root = await fetch(`http://127.0.0.1:${proxyPort}/`, { headers: auth })
  assert.equal(root.status, 200)
  assert.equal(await root.text(), "<html>Bifrost upstream</html>")

  const sessions = await fetch(`http://127.0.0.1:${proxyPort}/session`, { headers: auth })
  assert.equal(sessions.status, 200)
  assert.deepEqual(await sessions.json(), [{ id: "ses_proxy", directory: "/tmp/proxy", time: { updated: 1 } }])

  const append = await fetch(`http://127.0.0.1:${proxyPort}/tui/append-prompt`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ text: "hello" }) })
  assert.equal(append.status, 200)
  assert.equal(await append.text(), "true")

  assert.ok(upstreamRequests.some((request) => request.url === "/session" && request.authorization === `Basic ${Buffer.from("opencode:upstream-password").toString("base64")}`))
  assert.equal(await runProxyWithArgs(["--listen-host", "127.0.0.1", "--listen-port", "1", "--upstream", "http://127.0.0.1:1", "--password", "argv-secret"]), 1)
  assert.equal(await runProxyWithArgs(["--listen-host", "127.0.0.1", "--listen-port", "1", "--upstream", "http://127.0.0.1:1", "--upstream-password", "argv-secret"]), 1)
} finally {
  proxy.kill("SIGTERM")
  await close(upstream)
}

console.log("bifrost proxy tests passed")
