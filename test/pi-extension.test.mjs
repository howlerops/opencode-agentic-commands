import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import agenticCommands, { COMMANDS } from "../pi/extensions/agentic-commands.js"

const registered = new Map()

agenticCommands({
  registerCommand(name, options) {
    registered.set(name, options)
  },
})

assert.deepEqual([...registered.keys()].sort(), [
  "bifrost",
  "eitri",
  "hugin",
  "munin",
  "polaris",
  "skuld",
  "tyr",
  "vidar",
])

for (const [name, command] of registered) {
  assert.equal(typeof command.description, "string")
  assert.equal(typeof command.handler, "function")

  const sent = []
  await command.handler(`${name} smoke`, {
    sendUserMessage: async (message) => sent.push(message),
  })

  assert.equal(sent.length, 1)
  assert.match(sent[0], new RegExp(`${name} smoke|Research objective|Request|Original goal|Review target|Goal`))
}

assert.match(COMMANDS.vidar.render("ship it"), /Only stop before completion when you hit a concrete blocker/)
assert.match(COMMANDS.vidar.render("ship it"), /Phase 0: context research and anchor plan/)
assert.match(COMMANDS.vidar.render("ship it"), /context research dossier/)
assert.match(COMMANDS.vidar.render("ship it"), /optional memory is not a blocker/)
assert.match(COMMANDS.hugin.render("ship it"), /extensive context research/)
assert.match(COMMANDS.hugin.render("ship it"), /Assumption and question ledger/)
assert.match(COMMANDS.hugin.render("ship it"), /AgentDB\/Agent Wisdom recall/)
assert.match(COMMANDS.munin.render("skills"), /commands, skills, extensions, or prompts/)
assert.match(COMMANDS.munin.render("skills"), /Do not install or start long-lived AgentDB services/)
assert.match(COMMANDS.polaris.render("ship it"), /\/hugin, \/tyr, \/eitri, \/munin, \/vidar, and \/skuld/)
assert.match(COMMANDS.polaris.render("ship it"), /Do not call the task complete until planning, implementation, measurable outcome checks, and final review/)
assert.match(COMMANDS.skuld.render("current diff"), /Review target:\ncurrent diff/)
assert.match(COMMANDS.bifrost.render("status"), /cloudflared tunnel --url http:\/\/127\.0\.0\.1:<port>/)
assert.match(COMMANDS.bifrost.render("status"), /\/bifrost stop/)

for (const name of registered.keys()) {
  const prompt = await readFile(new URL(`../pi/prompts/${name}.md`, import.meta.url), "utf8")
  assert.match(prompt, /^---\n/)
  assert.match(prompt, /description:/)
  assert.match(prompt, /argument-hint:/)
  assert.match(prompt, /\$ARGUMENTS/)
}

console.log("pi extension tests passed")
