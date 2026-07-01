import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "watcher",
  agent: "build",
  reviewerAgent: "code-reviewer",
  goalCommand: "/jarvis",
  maxReviewLoops: 10,
  preferSubagents: true,
  maxParallelSubagents: 4,
  completionStandard: "review finds no actionable bugs, regressions, missing required tests, or unresolved risks",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function ultrareviewTemplate(options) {
  return `Run an ultrareview for this work: review the diff or described change like a pull request, repair actionable findings, and repeat until review is clean.

Review target:
$ARGUMENTS

Operating principle:
- Findings are the primary output until the work is clean.
- Do not stop at the first review pass if actionable issues are found.
- Completion standard: ${options.completionStandard}.

Review setup:
1. Confirm the repo status and identify the review target: current worktree diff, branch, PR, commit range, or user-described files.
2. Read the relevant implementation, tests, docs, schemas, migrations, and public API surfaces before judging.
3. Prefer a dedicated review subagent when available: ${options.reviewerAgent}.
4. Prefer subagents when available: ${options.preferSubagents ? "yes" : "no"}.
5. Maximum parallel review subagents: ${options.maxParallelSubagents}.
6. For large changes, split review by domain or file area, then merge and deduplicate findings.

Review focus:
- Correctness bugs and behavioral regressions.
- Missing required tests or verification gaps.
- Security, auth, data exposure, injection, and permission issues.
- Race conditions, concurrency bugs, async error handling, and resource leaks.
- Data loss, migration safety, backward compatibility, and API contract breaks.
- Performance hazards and scalability bottlenecks.
- Maintainability issues that create concrete future risk.
- Documentation gaps only when they affect safe use or release readiness.

Findings format:
- Severity: critical, high, medium, or low.
- File/line reference where possible.
- Concrete failure mode.
- Minimal required fix.
- Verification needed after the fix.

Repair loop:
1. If there are no actionable findings, run or recommend the broadest feasible verification and produce the final verdict.
2. If findings exist, run a targeted repair loop using:
   ${options.goalCommand} <fix the ultrareview findings>
3. Re-run relevant verification.
4. Run ultrareview again.
5. Repeat until no actionable findings remain or until ${options.maxReviewLoops} review loops have completed.
6. If the loop limit is reached, stop and report remaining blockers instead of claiming completion.

Final response:
- Review target.
- Review loop ledger.
- Findings fixed.
- Verification commands and results.
- Final reviewer verdict.
- Residual non-blocking risks, if any.`
}

export async function UltrareviewPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = ultrareviewTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Review and repair a diff repeatedly until no actionable PR-review findings remain.",
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

export default UltrareviewPlugin
