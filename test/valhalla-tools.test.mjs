import assert from "node:assert/strict"
import valhallaTools, { TODO_TOOL, PLAN_TOOL, summarizeTodos } from "../pi/extensions/valhalla-tools.js"

// Fake pi runtime that captures registerTool (mirrors pi-extension.test.mjs's registerCommand capture).
const tools = new Map()
valhallaTools({
  registerTool(def) {
    tools.set(def.name, def)
  },
})

// Both tools register.
assert.deepEqual([...tools.keys()].sort(), [PLAN_TOOL, TODO_TOOL].sort())

for (const [name, def] of tools) {
  assert.equal(typeof def.description, "string", `${name} description`)
  assert.equal(typeof def.execute, "function", `${name} execute`)
  assert.equal(typeof def.parameters, "object", `${name} parameters`)
}

// todowrite: args carry the list; execute echoes it in details (the RPC surfaces args → to-dos).
const todos = [
  { content: "write tests", status: "in_progress" },
  { content: "ship", status: "pending" },
  { content: "done thing", status: "completed" },
]
const todoRes = await tools.get(TODO_TOOL).execute("call1", { todos })
assert.deepEqual(todoRes.details.todos, todos)
assert.match(todoRes.content[0].text, /3 to-do\(s\), 1 done/)
assert.equal(summarizeTodos(todos), "Tracking 3 to-do(s), 1 done.")
assert.equal(summarizeTodos(undefined), "Tracking 0 to-do(s), 0 done.")

// present_plan: approved → proceed; rejected → terminate.
const approved = await tools.get(PLAN_TOOL).execute("call2", { plan: "do X then Y" }, undefined, undefined, {
  ui: { confirm: async () => true },
})
assert.equal(approved.details.approved, true)
assert.ok(!approved.terminate)

const rejected = await tools.get(PLAN_TOOL).execute("call3", { plan: "do X then Y" }, undefined, undefined, {
  ui: { confirm: async () => false },
})
assert.equal(rejected.details.approved, false)
assert.equal(rejected.terminate, true)

// Tolerates a missing ui (non-RPC contexts) without throwing.
const noUi = await tools.get(PLAN_TOOL).execute("call4", { plan: "x" }, undefined, undefined, {})
assert.equal(noUi.details.approved, true)

console.log("valhalla-tools: OK")
