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
- Treat this command as the anchor for all downstream work: no implementation should start until this plan has enough context to guide /goal or /ultrawork safely.
- Perform extensive context research before deciding architecture. Inspect repo docs, package/config files, entrypoints, tests, existing patterns, public APIs, data models, migrations, deployment/runtime config, and recent git context when available.
- Build a context research dossier with file references and evidence. Separate facts observed in the repo from assumptions, inferences, and open questions.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, use them to recall prior successful patterns, critiques, and skill lessons. If unavailable, skip them quietly and continue from repo sources; optional memory is not a blocker and should not create noisy failure narration.
- Trace the impacted surfaces end to end: user/API entrypoints, service boundaries, persistence, side effects, errors, logging/observability, tests, and docs.
- Convert the goal into a dependency-aware story DAG, not a flat checklist.
- Identify stories that can safely run in parallel and stories that must be serialized.
- Maximum parallel subagents to assume: ${options.maxParallelSubagents}.
- Do not parallelize work that touches overlapping files, shared schemas, migrations, generated files, API contracts, or shared state unless the dependency boundary is explicit.

Plan structure:
1. Goal restatement and success criteria.
2. Context research dossier: source map, files read, commands run, architecture findings, patterns to preserve, and evidence-backed constraints.
3. Memory and prior-art notes: AgentDB/Agent Wisdom recall used, useful lessons found, or "not available; skipped" without treating it as a constraint.
4. Assumption and question ledger: what is known, what is inferred, what needs user input, and what can be safely decided without asking.
5. Current-state findings with file references where available.
6. Architecture decision record: chosen approach, alternatives rejected, compatibility concerns, and migration strategy.
7. Story DAG: each story must include inputs, outputs, dependencies, files likely touched, verification, and whether subagent execution is safe.
8. Execution schedule: parallel lanes first, then serialized integration points.
9. Risk register: behavioral, security, data, performance, and operational risks with mitigations.
10. Verification matrix: narrow checks per story and broad final checks.
11. Review gates: when critic/reviewer passes should run and what they must approve.

Independent verification:
- Run a separate review pass over the plan when possible, preferably through a subagent with no implementation context.
- Verification standard: ${options.verificationStandard}.
- If the review finds a concrete flaw, revise the plan before presenting it.

Final response:
- Present the approved plan only after the verification pass.
- Include unresolved questions only if they block correct implementation.
- Make the plan self-contained enough that a fresh worker can execute it without repeating discovery.
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
