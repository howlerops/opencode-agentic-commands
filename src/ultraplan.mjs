import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "ultraplan",
  agent: "plan",
  maxParallelSubagents: 4,
  outputArtifact: "conversation plan; create a repo file only when the user asks",
  verificationStandard: "plan is reviewed for feasibility, dependency order, risks, and test coverage before implementation starts",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function ultraplanTemplate(options) {
  return `Create an ultraplan for this goal before implementation. Do not edit code unless the user explicitly asks you to execute the plan.

Goal:
$ARGUMENTS

Output artifact:
- ${options.outputArtifact}.

Planning principles:
- Inspect the repo and available documentation before deciding architecture.
- Convert the goal into a dependency-aware story DAG, not a flat checklist.
- Identify stories that can safely run in parallel and stories that must be serialized.
- Maximum parallel subagents to assume: ${options.maxParallelSubagents}.
- Do not parallelize work that touches overlapping files, shared schemas, migrations, generated files, API contracts, or shared state unless the dependency boundary is explicit.

Plan structure:
1. Goal restatement and success criteria.
2. Current-state findings with file references where available.
3. Architecture decision record: chosen approach, alternatives rejected, compatibility concerns, and migration strategy.
4. Story DAG: each story must include inputs, outputs, dependencies, files likely touched, verification, and whether subagent execution is safe.
5. Execution schedule: parallel lanes first, then serialized integration points.
6. Risk register: behavioral, security, data, performance, and operational risks with mitigations.
7. Verification matrix: narrow checks per story and broad final checks.
8. Review gates: when critic/reviewer passes should run and what they must approve.

Independent verification:
- Run a separate review pass over the plan when possible, preferably through a subagent with no implementation context.
- Verification standard: ${options.verificationStandard}.
- If the review finds a concrete flaw, revise the plan before presenting it.

Final response:
- Present the approved plan only after the verification pass.
- Include unresolved questions only if they block correct implementation.
- End with the recommended first execution command, usually /goal or /ultrawork with the highest-priority story or full goal.`
}

export async function UltraplanPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = ultraplanTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Create a verified dependency-aware execution plan without editing code.",
        agent: config.agent,
        template,
      }
    },
    "chat.message": async (_input, output) => {
      const part = firstTextPart(output.parts, commandNames)
      if (!part) return
      const match = parseSlash(part.text, commandNames)
      if (!match) return
      part.text = replaceArguments(template, match[1] || "")
    },
    "command.execute.before": async (input, output) => {
      if (input.command !== config.commandName) return
      addTextOutput(output, replaceArguments(template, input.arguments || ""))
    },
  }
}

export default UltraplanPlugin
