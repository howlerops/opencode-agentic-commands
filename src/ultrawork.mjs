import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "ultrawork",
  agent: "build",
  goalCommand: "/goal",
  criticAgent: "code-reviewer",
  maxGoalLoops: 20,
  maxReviewLoops: 10,
  preferSubagents: true,
  maxParallelSubagents: 4,
  completionStandard: "critic confirms no remaining required work, no unresolved risks, and no PR review findings",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function ultraworkTemplate(options) {
  return `Run this task in ultrawork mode: repeatedly execute goal-sized implementation loops until the work is fully realized, then run PR-review repair loops until there are no review findings left.

Original goal:
$ARGUMENTS

Operating principle:
- Treat this command as the execution anchor for the whole task. Start by establishing enough context to make and update a durable plan, then keep that plan current through every loop.
- Do not stop after one pass.
- Treat each pass as incomplete until a critic review explicitly confirms the full task is done.
- Do not exit early because work is large, tests fail, review findings remain, context is uncomfortable, or another loop is needed.
- Only stop before completion when you hit a concrete blocker you cannot resolve with available tools, repo context, user-provided information, and reasonable implementation choices.
- When you hit a possible blocker, first try to resolve it: inspect more files, run narrower checks, simplify the approach, repair the failure, or ask one concise clarifying question if missing user input is the only blocker.
- Use ${options.goalCommand} semantics for each implementation loop: inspect, architect, split into stories, implement, verify, critic-repair, and summarize.
- Completion standard: ${options.completionStandard}.

Phase 0: context research and anchor plan
1. Before editing, perform extensive context research across the repo: docs, package/config files, entrypoints, tests, existing patterns, public APIs, data models, migrations, deployment/runtime config, and recent git context when available.
2. Produce a context research dossier with file references, commands run, key architecture findings, impacted surfaces, constraints, and patterns to preserve.
3. Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, recall relevant past episodes, successful patterns, critiques, and skill lessons. If unavailable, skip them quietly and continue from repo sources; optional memory is not a blocker and should not create noisy failure narration.
4. Maintain an assumption and question ledger. Ask only if missing user input blocks a safe decision; otherwise make the smallest reasonable decision and record it.
5. Produce or update the anchor plan: success criteria, story DAG, dependency order, parallel-safe lanes, verification matrix, review gates, and rollback/cleanup considerations.
6. Keep the anchor plan current after every implementation, critic, and PR-review loop. Do not let the work drift away from the researched plan.
7. If AgentDB is available and the work produces a durable lesson, store the successful pattern, failure critique, or review finding after verification. Do not install or start long-lived AgentDB services from inside the work loop unless the user explicitly asks.

Parallelism and subagents:
- Prefer subagents when available: ${options.preferSubagents ? "yes" : "no"}.
- Maximum parallel subagents: ${options.maxParallelSubagents}.
- Use subagents to reduce wall-clock time when stories are independent, review can run separately, or focused investigation can happen without touching the same files.
- Do not parallelize work that modifies overlapping files, schema contracts, migrations, generated artifacts, or any shared state unless the dependency boundary is explicit and safe.
- If subagents are unavailable in the current opencode runtime, continue serially and note that parallel execution was skipped.

Loop limits:
- Maximum implementation goal loops: ${options.maxGoalLoops}.
- Maximum PR review repair loops: ${options.maxReviewLoops}.
- Loop limits are safety rails, not normal stopping points. If a loop limit is reached before completion, continue only if the environment explicitly permits raising the limit; otherwise report the exact unresolved blocker and do not claim completion.

Phase 1: initial goal execution
1. Start with this implementation loop prompt:
   ${options.goalCommand} $ARGUMENTS
2. Execute the goal loop end-to-end, including verification, using the Phase 0 context dossier and anchor plan as the controlling source of truth.
3. During the story DAG step, dispatch independent stories to subagents where safe. Each subagent must report:
   - Story goal
   - Files read/changed
   - Verification run
   - Remaining risks
   - Handoff notes for dependent stories
4. Produce a loop ledger entry with:
   - Loop number
   - Context or plan updates
   - Goal attempted
   - Work completed
   - Files changed
   - Verification run
   - Remaining work
   - Risks and open questions

Phase 2: critic-driven implementation loops
1. Invoke a critic pass after every implementation loop. Prefer the configured critic agent if available: ${options.criticAgent}.
2. Run the critic as a separate subagent when possible so it has an independent review context.
3. The critic must answer these questions:
   - Is the original goal fully satisfied?
   - What concrete work remains?
   - What tests or verification are missing?
   - What risks could cause a behavioral regression?
   - Are there files/commits that still need cleanup?
4. If the critic finds any required work, create a new goal loop that targets only the remaining work:
    ${options.goalCommand} <remaining required work from critic>
5. Repeat implementation + critic loops until the critic says all required work is complete and all required verification has passed.
6. Do not treat vague optimism as completion. The critic must explicitly say there is no remaining required work.
7. If the critic identifies work that seems difficult or broad, split it smaller and continue rather than exiting.

Phase 3: final PR review
1. Review the changed commits/files/branch as if preparing a pull request.
2. Focus on bugs, regressions, missing tests, security issues, race conditions, data loss, API compatibility, maintainability, and documentation gaps.
3. Prefer a dedicated review agent if available: ${options.criticAgent}.
4. Run PR review in a separate subagent when possible, after the implementation loop believes the work is complete.
5. For large diffs, split review subagents by domain or file area, then merge findings into one deduplicated review list.
6. Findings must be concrete and actionable. Include file/line references where possible.

Phase 4: PR-review repair loops
1. If PR review finds anything actionable, run another targeted goal loop:
   ${options.goalCommand} <fix the PR review findings>
2. Re-run relevant verification.
3. Run PR review again.
4. Repeat until the PR review finds no actionable issues.
5. If a review finding cannot be fixed, prove why it is unresolvable with the current tools/context before stopping.

Phase 5: completion report
Only when both the implementation critic and the PR review find nothing left, produce the final report:
- Original goal
- Implementation loop ledger
- PR review loop ledger
- Final files changed
- Verification commands and results
- Final reviewer verdict
- Any residual non-blocking risks

Hard stop rule:
- If there is any concrete remaining implementation work, missing required verification, or actionable PR review finding, do not call the task complete and do not exit. Start another targeted ${options.goalCommand} loop.
- The only acceptable early exit is an unresolved blocker that you cannot fix after reasonable investigation and repair attempts.
- When blocked, report the exact blocker, the attempts made, the evidence that it cannot be resolved in this session, and the smallest user action needed to unblock it.`
}

export async function UltraworkPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = ultraworkTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Run repeated /goal implementation and PR-review repair loops until a critic finds nothing left.",
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

export default UltraworkPlugin
