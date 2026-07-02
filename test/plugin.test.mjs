import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import AgenticCommandsPlugin, { BifrostPlugin, EitriPlugin, HuginPlugin, MuninPlugin, PolarisPlugin, SkuldPlugin, TyrPlugin, VidarPlugin } from "../src/index.mjs"
import { __bifrostInternals } from "../src/bifrost.mjs"

async function commandsFrom(plugin, options) {
  const hooks = await plugin({}, options)
  const config = {}
  await hooks.config(config)
  return { hooks, commands: config.command }
}

async function expands(plugin, slash, expected, options) {
  const { hooks } = await commandsFrom(plugin, options)
  const output = { parts: [{ type: "text", text: slash }] }
  await hooks["chat.message"]({}, output)
  assert.match(output.parts[0].text, expected)
  return output.parts[0].text
}

async function withSessionServer(sessions, fn) {
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/session")) {
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify(sessions))
      return
    }
    response.statusCode = 404
    response.end("not found")
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const address = server.address()
    await fn(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function writeFakeOpencode(binDir) {
  await mkdir(binDir, { recursive: true })
  const fakeOpencode = path.join(binDir, "opencode")
  await writeFile(fakeOpencode, `#!/usr/bin/env node
const { createServer } = require("node:http")
const port = Number(process.argv[process.argv.indexOf("--port") + 1])
const host = process.argv[process.argv.indexOf("--hostname") + 1] || "127.0.0.1"
createServer((request, response) => {
  if (request.url === "/session") {
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify([{ id: "ses_fake", directory: "/tmp/fake", time: { updated: 1 } }]))
    return
  }
  response.setHeader("content-type", "text/html")
  response.end("<html>fake opencode</html>")
}).listen(port, host)
`)
  await chmod(fakeOpencode, 0o755)
  return fakeOpencode
}

{
  const { commands } = await commandsFrom(AgenticCommandsPlugin, {
    tyr: { baroModel: "openai/gpt-5.3-codex-spark" },
  })
  assert.deepEqual(Object.keys(commands).sort(), ["bifrost", "eitri", "hugin", "munin", "polaris", "skuld", "tyr", "vidar"])
}

{
  const config = {
    model: "openai/gpt-5.5",
    agent: {
      reviewer: { model: "anthropic/claude-3-opus-20240229" },
      builder: { model: "anthropic/claude-3-5-sonnet-20241022" },
      current: { model: "openai/gpt-5.5" },
    },
  }
  const hooks = await AgenticCommandsPlugin({}, {})
  await hooks.config(config)
  assert.equal(config.agent.reviewer.model, "openai/gpt-5.5")
  assert.equal(config.agent.builder.model, "openai/gpt-5.5")
  assert.equal(config.agent.current.model, "openai/gpt-5.5")
}

{
  const config = {
    model: "openai/gpt-5.5",
    agent: {
      reviewer: { model: "anthropic/claude-3-opus-20240229" },
    },
  }
  const hooks = await AgenticCommandsPlugin({}, { modelFallback: { enabled: false } })
  await hooks.config(config)
  assert.equal(config.agent.reviewer.model, "anthropic/claude-3-opus-20240229")
}

{
  const hooks = await AgenticCommandsPlugin({}, {
    memory: {
      agentdb: { enabled: true, dbPath: "/tmp/agentdb.rvf" },
      agentWisdom: {
        enabled: true,
        name: "odi-agent-wisdom",
        command: ["node", "/tmp/agent-wisdom.mjs", "mcp"],
        root: "/tmp/odi-control-plane",
        dbPath: "/tmp/odi-memory.rvf",
      },
    },
  })
  const config = {}
  await hooks.config(config)
  assert.deepEqual(config.mcp.agentdb.command, ["npx", "-y", "agentdb@latest", "mcp", "start"])
  assert.equal(config.mcp.agentdb.env.AGENTDB_PATH, "/tmp/agentdb.rvf")
  assert.deepEqual(config.mcp["odi-agent-wisdom"].command, ["node", "/tmp/agent-wisdom.mjs", "mcp"])
  assert.equal(config.mcp["odi-agent-wisdom"].env.ODI_ROOT, "/tmp/odi-control-plane")
  assert.equal(config.mcp["odi-agent-wisdom"].env.ODI_AGENTDB_PATH, "/tmp/odi-memory.rvf")
}

{
  const hooks = await AgenticCommandsPlugin({}, {
    memory: {
      agentdb: { enabled: true, dbPath: "/tmp/new.rvf" },
    },
  })
  const config = { mcp: { agentdb: { type: "local", command: ["existing"], enabled: true } } }
  await hooks.config(config)
  assert.deepEqual(config.mcp.agentdb.command, ["existing"])
}

{
  const text = await expands(TyrPlugin, "/tyr add auth", /baro --llm opencode -m openai\/gpt-5\.3-codex-spark/)
  assert.match(text, /add auth/)
}

{
  const text = await expands(MuninPlugin, "/munin improve bpb", /uv run train\.py/)
  assert.match(text, /val_bpb/)
  assert.match(text, /improve bpb/)
  assert.match(text, /AgentDB MCP\/tools/)
  assert.match(text, /commands, skills, extensions, or prompts/)
  assert.match(text, /not a single-pass run/)
  assert.match(text, /metric\/outcome has plateaued/)
}

{
  const text = await expands(EitriPlugin, "/eitri create triage workflow", /COMPLETION_MODEL=openai\/gpt-5\.3-codex-spark/)
  assert.match(text, /create triage workflow/)
  assert.match(text, /not a single-pass run/)
  assert.match(text, /revise and re-test repeatedly/)
  assert.match(text, /latest evaluation cannot identify another useful improvement/)
}

{
  const text = await expands(VidarPlugin, "/vidar ship payments", /repeatedly execute goal-sized implementation loops/)
  assert.match(text, /\/tyr ship payments/)
  assert.match(text, /PR-review repair loops/)
  assert.match(text, /Maximum parallel subagents: 4/)
  assert.match(text, /critic confirms no remaining required work/)
  assert.match(text, /Only stop before completion when you hit a concrete blocker/)
  assert.match(text, /do not call the task complete and do not exit/)
  assert.match(text, /Phase 0: context research and anchor plan/)
  assert.match(text, /context research dossier/)
  assert.match(text, /anchor plan/)
  assert.match(text, /optional memory is not a blocker/)
  assert.match(text, /Do not install or start long-lived AgentDB services/)
}

{
  const text = await expands(HuginPlugin, "/hugin ship payments", /Create a Hugin anchor plan/)
  assert.match(text, /ship payments/)
  assert.match(text, /Story DAG/)
  assert.match(text, /Maximum parallel subagents to assume: 4/)
  assert.match(text, /extensive context research/)
  assert.match(text, /Context research dossier/)
  assert.match(text, /Assumption and question ledger/)
  assert.match(text, /AgentDB\/Agent Wisdom recall/)
  assert.match(text, /noisy failure narration/)
}

{
  const text = await expands(SkuldPlugin, "/skuld current diff", /Run a Skuld review/)
  assert.match(text, /current diff/)
  assert.match(text, /Review loop ledger/)
  assert.match(text, /Maximum parallel review subagents: 4/)
}

{
  const text = await expands(PolarisPlugin, "/polaris ship the full platform", /Run this task in Polaris mode/)
  assert.match(text, /ship the full platform/)
  assert.match(text, /\/hugin/)
  assert.match(text, /\/eitri/)
  assert.match(text, /\/munin/)
  assert.match(text, /\/vidar/)
  assert.match(text, /\/skuld/)
  assert.match(text, /Do not call the task complete until planning, implementation, measurable outcome checks, and final review all find no remaining required work/)
}

{
  const { hooks } = await commandsFrom(BifrostPlugin)
  const output = { parts: [{ type: "text", text: "/bifrost start port 4141" }] }
  assert.equal(hooks["chat.message"], undefined)
  assert.equal(output.parts[0].text, "/bifrost start port 4141")
  const envOutput = { env: {} }
  await hooks["shell.env"]({ sessionID: "ses_current" }, envOutput)
  assert.equal(envOutput.env.BIFROST_SESSION_ID, "ses_current")
}

{
  const hooks = await BifrostPlugin({ serverUrl: new URL("http://127.0.0.1:3333/") }, {})
  const envOutput = { env: {} }
  await hooks["shell.env"]({ sessionID: "ses_current" }, envOutput)
  assert.equal(envOutput.env.BIFROST_SESSION_ID, "ses_current")
  assert.equal(envOutput.env.BIFROST_ACTIVE_SERVER_URL, "http://127.0.0.1:3333")
}

{
  const hooks = await AgenticCommandsPlugin({ serverUrl: new URL("http://127.0.0.1:4444/") }, {})
  const envOutput = { env: {} }
  await hooks["shell.env"]({ sessionID: "ses_current" }, envOutput)
  assert.equal(envOutput.env.BIFROST_SESSION_ID, "ses_current")
  assert.equal(envOutput.env.BIFROST_ACTIVE_SERVER_URL, "http://127.0.0.1:4444")
}

{
  const { commands } = await commandsFrom(BifrostPlugin, {})
  assert.match(commands.bifrost.template, /^Return this Bifrost output exactly and do not add commentary:/)
  assert.match(commands.bifrost.template, /!`node /)
  assert.match(commands.bifrost.template, /-- start`$/)
  assert.doesNotMatch(commands.bifrost.template, /\$ARGUMENTS/)
  assert.doesNotMatch(commands.bifrost.template, /Request:/)
  assert.doesNotMatch(commands.bifrost.template, /If opencode-bifrost/)
}

{
  const hooks = await BifrostPlugin({ serverUrl: new URL("http://127.0.0.1:3333/") }, {})
  const config = {}
  await hooks.config(config)
  assert.match(config.command.bifrost.template, /--active-server-url 'http:\/\/127\.0\.0\.1:3333'/)
  assert.doesNotMatch(config.command.bifrost.template, /\$ARGUMENTS/)
}

{
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-test-"))
  try {
    const hooks = await BifrostPlugin({ directory: temp }, { stateDir: ".bifrost" })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "status" }, output)
    assert.match(output.parts[0].text, /Bifrost status: no managed portal state found/)
    assert.doesNotMatch(output.parts[0].text, /Start workflow:/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

{
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-fallback-test-"))
  const home = path.join(temp, "home")
  const project = path.join(temp, "project")
  const stateDir = path.join(home, ".bifrost")
  const originalHome = process.env.HOME
  try {
    await mkdir(project, { recursive: true })
    await mkdir(stateDir, { recursive: true })
    await writeFile(path.join(stateDir, "state.json"), `${JSON.stringify({
      localUrl: "http://127.0.0.1:4567",
      publicUrl: "https://example.trycloudflare.com",
      username: "opencode",
      password: "bifrost-test-password",
      passwordSource: "generated temporary password",
      webPid: 999999,
      tunnelPid: 999998,
      tunnelProvider: "cloudflared",
    })}\n`)
    process.env.HOME = home
    const hooks = await BifrostPlugin({ directory: project }, { stateDir: ".bifrost" })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "status" }, output)
    assert.match(output.parts[0].text, /Open: https:\/\/example\.trycloudflare\.com/)
    assert.match(output.parts[0].text, /Username: opencode/)
    assert.match(output.parts[0].text, /Password: bifrost-test-password/)
    assert.match(output.parts[0].text, /Copy login: url=https:\/\/example\.trycloudflare\.com username=opencode password=bifrost-test-password/)
    assert.match(output.parts[0].text, /Session links: unavailable/)
    assert.match(output.parts[0].text, /Live TUI control API:/)
    assert.match(output.parts[0].text, /Event stream status: unavailable/)
    assert.match(output.parts[0].text, /\/tui\/append-prompt/)
    assert.match(output.parts[0].text, /\/tui\/submit-prompt/)
    assert.match(output.parts[0].text, /\/event/)
    assert.match(output.parts[0].text, /Bifrost does not auto-forward Web prompts/)
  } finally {
    process.env.HOME = originalHome
    await rm(temp, { recursive: true, force: true })
  }
}

{
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      tunnels: [
        { public_url: "https://stale.ngrok-free.app", config: { addr: "http://127.0.0.1:65007" } },
        { public_url: "https://fresh.ngrok-free.app", config: { addr: "http://127.0.0.1:65008" } },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })
    assert.equal(await __bifrostInternals.ngrokApiUrl("http://127.0.0.1:65008"), "https://fresh.ngrok-free.app")
    assert.equal(await __bifrostInternals.ngrokApiUrl("http://127.0.0.1:65009"), "")
    assert.equal(await __bifrostInternals.ngrokApiUrl(""), "https://stale.ngrok-free.app")
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withSessionServer([
  { id: "ses_newer", title: "Newer session", directory: "/tmp/newer", time: { updated: 30 } },
  { id: "ses_current", title: "Current local session", directory: "/Users/test/project", time: { updated: 10 } },
], async (localUrl) => {
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-session-test-"))
  try {
    const stateDir = path.join(temp, ".bifrost")
    await mkdir(stateDir, { recursive: true })
    await writeFile(path.join(stateDir, "state.json"), `${JSON.stringify({
      localUrl,
      publicUrl: "https://example.trycloudflare.com",
      username: "opencode",
      password: "bifrost-test-password",
      passwordSource: "generated temporary password",
      webPid: process.pid,
      tunnelPid: process.pid,
      tunnelProvider: "cloudflared",
      directory: "/Users/test/project",
    })}\n`)
    const hooks = await BifrostPlugin({ directory: temp }, { stateDir: ".bifrost" })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", sessionID: "ses_current", arguments: "sync" }, output)
    assert.match(output.parts[0].text, /Web session history URL \(Current TUI session\): https:\/\/example\.trycloudflare\.com\/L1VzZXJzL3Rlc3QvcHJvamVjdA\/session\/ses_current/)
    assert.match(output.parts[0].text, /1\. \[current\] Current local session/)
    assert.doesNotMatch(output.parts[0].text, /Newer session/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

await withSessionServer([
  { id: "ses_current", title: "Current local session", directory: "/Users/test/project", time: { updated: 10 } },
], async (localUrl) => {
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-active-status-test-"))
  try {
    const stateDir = path.join(temp, ".bifrost")
    await mkdir(stateDir, { recursive: true })
    await writeFile(path.join(stateDir, "state.json"), `${JSON.stringify({
      localUrl,
      publicUrl: "https://active.example.trycloudflare.com",
      username: "opencode",
      password: "existing-active-password",
      passwordSource: "OPENCODE_SERVER_PASSWORD from active OpenCode server",
      webPid: null,
      tunnelPid: process.pid,
      tunnelProvider: "cloudflared",
      serverMode: "active",
      attachedToActiveServer: true,
      directory: "/Users/test/project",
    })}\n`)
    const hooks = await BifrostPlugin({ directory: temp }, { stateDir: ".bifrost" })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", sessionID: "ses_current", arguments: "status" }, output)
    assert.match(output.parts[0].text, /Server mode: active/)
    assert.match(output.parts[0].text, /Attached to active TUI server: yes/)
    assert.match(output.parts[0].text, /Web PID: none \(active server is not Bifrost-managed\)/)
    assert.match(output.parts[0].text, /Password source: OPENCODE_SERVER_PASSWORD from active OpenCode server/)
    assert.match(output.parts[0].text, /Web session history URL \(Current TUI session\): https:\/\/active\.example\.trycloudflare\.com\/L1VzZXJzL3Rlc3QvcHJvamVjdA\/session\/ses_current/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

{
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-active-fail-test-"))
  const port = await freePort()
  try {
    const hooks = await BifrostPlugin({ directory: temp, serverUrl: new URL("http://127.0.0.1:9") }, { stateDir: ".bifrost", serverMode: "active", preferredTunnel: "true", startupTimeoutMs: 500 })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: `start port ${port}` }, output)
    assert.match(output.parts[0].text, /Bifrost start failed: OpenCode server did not respond/)
    await new Promise((resolve) => setTimeout(resolve, 250))
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`))
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

{
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-auto-fallback-test-"))
  const originalPath = process.env.PATH
  try {
    await writeFakeOpencode(path.join(temp, "bin"))
    process.env.PATH = `${path.join(temp, "bin")}:${originalPath}`
    const hooks = await BifrostPlugin({ directory: temp, serverUrl: new URL("http://127.0.0.1:9") }, { stateDir: ".bifrost", serverMode: "auto", preferredTunnel: "true", startupTimeoutMs: 3000 })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "start" }, output)
    assert.match(output.parts[0].text, /Bifrost portal partially started|Bifrost portal started/)
    assert.match(output.parts[0].text, /Server mode: web/)
    assert.match(output.parts[0].text, /Attached to active TUI server: no/)
    const stopOutput = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "stop" }, stopOutput)
    assert.match(stopOutput.parts[0].text, /OpenCode Web PID .*: stopped/)
  } finally {
    process.env.PATH = originalPath
    await rm(temp, { recursive: true, force: true })
  }
}

await withSessionServer([
  { id: "ses_current", title: "Current local session", directory: "/Users/test/project", time: { updated: 10 } },
], async (localUrl) => {
  const temp = await mkdtemp(path.join(tmpdir(), "bifrost-state-mode-test-"))
  try {
    const hooks = await BifrostPlugin({ directory: temp, serverUrl: new URL(localUrl) }, { stateDir: ".bifrost", serverMode: "active", preferredTunnel: "true", startupTimeoutMs: 1000 })
    const output = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "start" }, output)
    assert.match(output.parts[0].text, /Bifrost portal partially started|Bifrost portal started/)
    const stateDir = path.join(temp, ".bifrost")
    const statePath = path.join(stateDir, "state.json")
    assert.equal((await stat(stateDir)).mode & 0o777, 0o700)
    assert.equal((await stat(statePath)).mode & 0o777, 0o600)
    const stopOutput = { parts: [] }
    await hooks["command.execute.before"]({ command: "bifrost", arguments: "stop" }, stopOutput)
    assert.match(stopOutput.parts[0].text, /Bifrost proxy PID .*: stopped/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

console.log("plugin tests passed")
