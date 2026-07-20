// Valhalla Pi extension: a live to-do tool + an approve-the-plan gate.
//
// Pi ships only read/write/edit/bash by design, so it has NO native to-do list or plan mode.
// This extension adds both as tools. Because a tool call surfaces over Pi's RPC as
// `tool_execution_start { toolName, args }` and UI prompts surface as `extension_ui_request`,
// any RPC client (e.g. HowlerOps Iron Rain) gets:
//   - a live to-do list          (from the `todowrite` tool's args)
//   - an approve-the-plan gate    (from the `present_plan` tool's ctx.ui.confirm)
//
// The tool argument shapes below match what those clients parse:
//   todowrite -> { todos: [{ content, status }] }   status: pending | in_progress | completed
//   present_plan -> { plan: string }  -> ctx.ui.confirm(title, plan)
//
// `parameters` is a plain JSON Schema object (portable). If a given Pi build requires a TypeBox
// schema, wrap these with `Type.Object(...)` from "typebox" — the field shapes are identical.

export const TODO_TOOL = "todowrite"
export const PLAN_TOOL = "present_plan"

const todoParameters = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      description: "The full to-do list (replaces the previous one).",
      items: {
        type: "object",
        properties: {
          content: { type: "string", description: "What the step does." },
          status: { type: "string", enum: ["pending", "in_progress", "completed"] },
        },
        required: ["content", "status"],
      },
    },
  },
  required: ["todos"],
}

const planParameters = {
  type: "object",
  properties: {
    plan: { type: "string", description: "The proposed plan, in a few concise steps." },
  },
  required: ["plan"],
}

// summarize is exported for tests + reuse.
export function summarizeTodos(todos) {
  const list = Array.isArray(todos) ? todos : []
  const done = list.filter((t) => t && t.status === "completed").length
  return `Tracking ${list.length} to-do(s), ${done} done.`
}

export default function valhallaTools(pi) {
  pi.registerTool({
    name: TODO_TOOL,
    label: "Update to-dos",
    description:
      "Record or update the current task's to-do list. Call this whenever the plan changes so progress is visible; it replaces the previous list. Keep exactly one item in_progress at a time.",
    promptSnippet: "todowrite: keep a live, ordered to-do list of the current task's steps.",
    promptGuidelines: [
      "For any non-trivial task, break it into a short ordered to-do list and keep it updated as you work.",
      "Mark exactly one item in_progress at a time; mark items completed the moment they're done.",
    ],
    parameters: todoParameters,
    async execute(_toolCallId, params) {
      const todos = Array.isArray(params && params.todos) ? params.todos : []
      return {
        content: [{ type: "text", text: summarizeTodos(todos) }],
        details: { todos },
      }
    },
  })

  pi.registerTool({
    name: PLAN_TOOL,
    label: "Present plan",
    description:
      "Present a proposed plan and WAIT for the user to approve it before making any file changes. Use this at the start of a non-trivial task; do not edit files until the plan is approved.",
    promptSnippet: "present_plan: propose a plan and wait for approval before editing anything.",
    promptGuidelines: [
      "At the start of a non-trivial task, call present_plan with a concise plan and do not edit files until it returns approved.",
    ],
    parameters: planParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const plan = String((params && params.plan) || "")
      const ok = ctx && ctx.ui && typeof ctx.ui.confirm === "function"
        ? await ctx.ui.confirm("Approve plan?", plan)
        : true
      return {
        content: [{ type: "text", text: ok ? "Plan approved — proceeding." : "Plan rejected — stopping to revise." }],
        details: { approved: !!ok },
        terminate: !ok,
      }
    },
  })
}
