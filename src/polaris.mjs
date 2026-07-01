import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "polaris",
  agent: "build",
  planCommand: "/hugin",
  goalCommand: "/tyr",
  workCommand: "/vidar",
  reviewCommand: "/skuld",
  researchCommand: "/munin",
  agentCommand: "/eitri",
  maxOrchestrationLoops: 20,
  completionStandard: "plan, implementation, research optimization, and review all agree there is no remaining required work",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function polarisTemplate(options) {
  return `Run this task in Polaris mode: use every agentic command in this package as a high-level end-to-end orchestrator, from context research through final review.

Task:
$ARGUMENTS

Mission:
- Own the task end to end. Do not stop at planning, a partial implementation, or a first review pass.
- Use the existing command suite as orchestration phases: ${options.planCommand}, ${options.goalCommand}, ${options.agentCommand}, ${options.researchCommand}, ${options.workCommand}, and ${options.reviewCommand}.
- Completion standard: ${options.completionStandard}.

Phase 0: intake, memory, and scope
1. Restate the task, success criteria, constraints, and expected deliverables.
2. Perform extensive context research across repo docs, config, entrypoints, tests, APIs, data models, migrations, runtime/deploy config, and recent git context when available.
3. Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, recall relevant successful patterns, critiques, prior episodes, and skill lessons. If unavailable, skip quietly and continue from repo sources; optional memory is not a blocker.
4. Build a context dossier and assumption ledger. Ask one concise question only if missing user input blocks a safe decision.

Phase 1: anchor plan
1. Run ${options.planCommand} semantics for the full task.
2. Produce a self-contained anchor plan with source map, architecture decisions, story DAG, dependency order, parallel-safe lanes, verification matrix, review gates, and rollback/cleanup considerations.
3. Keep this plan current through all later phases.

Phase 2: orchestration design
1. Decide whether new or specialized agents, workflows, commands, skills, tools, or package artifacts are needed.
2. If yes, run ${options.agentCommand} semantics to design and create the minimal scoped artifacts.
3. Do not create broad always-on agents or tools unless the task explicitly requires them.

Phase 3: measurable optimization
1. If the task involves prompts, commands, skills, extensions, agents, experiments, model behavior, or quality improvements, run ${options.researchCommand} semantics before and after changes.
2. Define outcome tests before editing: expansion invariants, package install/load checks, command registration checks, prompt regression assertions, benchmark/metric checks, and before/after smoke comparisons where feasible.
3. Use results to decide what to keep, revise, or discard. Never fabricate metrics.

Phase 4: implementation
1. Run ${options.workCommand} semantics to execute the anchor plan with repeated ${options.goalCommand} loops.
2. Keep looping implementation, verification, critic review, and repair until no required work remains.
3. Do not exit early because work is broad, tests fail, review finds issues, or another loop is needed. Only stop early for a concrete blocker that cannot be resolved with available tools/context after reasonable attempts.

Phase 5: final review and repair
1. Run ${options.reviewCommand} semantics against the final diff, branch, or described deliverable.
2. If the task is a GitHub PR review, follow ${options.reviewCommand}'s GitHub PR mode: inspect the existing checkout first, avoid a temp clone/worktree unless the current repo is not already on the PR head branch/SHA, post grouped inline review comments for confirmed findings, and clean up any temp clone/worktree before reporting.
3. If review subagents fail because their configured model is unavailable, retry with an available/current active model when possible; otherwise continue the review manually in the current session rather than stopping.
4. Repair every actionable finding, rerun relevant verification, then review again.
5. Repeat until review is clean or a genuine unresolved blocker remains.

Loop control:
- Maximum orchestration loops: ${options.maxOrchestrationLoops}.
- Treat loop limits as safety rails, not normal stopping points.
- If a limit is reached, report the unresolved blocker and evidence instead of claiming completion.

Final report:
- Original task and final status.
- Context dossier summary and key evidence.
- Anchor plan and plan updates.
- Work completed by phase.
- Files/artifacts changed.
- Outcome tests, verification commands, and results.
- Final ${options.reviewCommand} verdict.
- Inline PR comments posted, skipped, or failed, if PR review mode was used.
- Temporary worktree or clone cleanup status, if one was created.
- AgentDB/Agent Wisdom memory used or stored, if any.
- Residual non-blocking risks.

Hard stop rule:
- Do not call the task complete until planning, implementation, measurable outcome checks, and final review all find no remaining required work.
- If anything remains, start the next targeted phase loop or report the exact unresolvable blocker.`
}

export async function PolarisPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = polarisTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Orchestrate a task end to end with planning, agents, research, implementation, and review loops.",
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

export default PolarisPlugin
