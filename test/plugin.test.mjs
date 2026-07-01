import assert from "node:assert/strict"
import AgenticCommandsPlugin, { AutoagentPlugin, AutoresearchPlugin, GoalPlugin, UltraplanPlugin, UltrareviewPlugin, UltraworkPlugin } from "../src/index.mjs"

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
    goal: { baroModel: "openai/gpt-5.3-codex-spark" },
  })
  assert.deepEqual(Object.keys(commands).sort(), ["autoagent", "autoresearch", "goal", "ultraplan", "ultrareview", "ultrawork"])
}

{
  const text = await expands(GoalPlugin, "/goal add auth", /baro --llm opencode -m openai\/gpt-5\.3-codex-spark/)
  assert.match(text, /add auth/)
}

{
  const text = await expands(AutoresearchPlugin, "/autoresearch improve bpb", /uv run train\.py/)
  assert.match(text, /val_bpb/)
  assert.match(text, /improve bpb/)
  assert.match(text, /AgentDB MCP\/tools/)
  assert.match(text, /commands, skills, extensions, or prompts/)
}

{
  const text = await expands(AutoagentPlugin, "/autoagent create triage workflow", /COMPLETION_MODEL=openai\/gpt-5\.3-codex-spark/)
  assert.match(text, /create triage workflow/)
}

{
  const { hooks } = await commandsFrom(AutoagentPlugin)
  const output = { parts: [{ type: "text", text: "/autoagnet create typo alias" }] }
  await hooks["chat.message"]({}, output)
  assert.equal(output.parts[0].text, "/autoagnet create typo alias")
}

{
  const text = await expands(UltraworkPlugin, "/ultrawork ship payments", /repeatedly execute goal-sized implementation loops/)
  assert.match(text, /\/goal ship payments/)
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
  const text = await expands(UltraplanPlugin, "/ultraplan ship payments", /Create an ultraplan/)
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
  const text = await expands(UltrareviewPlugin, "/ultrareview current diff", /Run an ultrareview/)
  assert.match(text, /current diff/)
  assert.match(text, /Review loop ledger/)
  assert.match(text, /Maximum parallel review subagents: 4/)
}

console.log("plugin tests passed")
