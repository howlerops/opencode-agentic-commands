import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import AgenticCommandsPlugin, { BifrostPlugin, EitriPlugin, HuginPlugin, MuninPlugin, PolarisPlugin, SkuldPlugin, TyrPlugin, VidarPlugin } from "../src/index.mjs"

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
}

{
  const text = await expands(EitriPlugin, "/eitri create triage workflow", /COMPLETION_MODEL=openai\/gpt-5\.3-codex-spark/)
  assert.match(text, /create triage workflow/)
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
  const text = await expands(BifrostPlugin, "/bifrost start port 4141", /Run Bifrost now/)
  assert.match(text, /start port 4141/)
  assert.match(text, /opencode-bifrost --state-dir '.opencode\/bifrost'/)
  assert.match(text, /scripts\/bifrost-runner\.mjs/)
  assert.match(text, /--preferred-tunnel 'cloudflared'/)
  assert.match(text, /--fallback-tunnel 'ngrok'/)
  assert.doesNotMatch(text, /Start workflow:/)
  assert.doesNotMatch(text, /Security:/)
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

console.log("plugin tests passed")
