import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "skuld",
  agent: "build",
  reviewerAgent: "code-reviewer",
  goalCommand: "/tyr",
  maxReviewLoops: 10,
  preferSubagents: true,
  maxParallelSubagents: 4,
  completionStandard: "review finds no actionable bugs, regressions, missing required tests, or unresolved risks",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function skuldTemplate(options) {
  return `Run a Skuld review for this work: review the diff or described change like a pull request, repair actionable findings, and repeat until review is clean.

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
4. If a subagent fails because its configured model is unavailable, immediately retry with an available/current active model if the tool supports model selection. If retry is not available, continue the review manually in the current session instead of stopping.
5. Maximum parallel review subagents: ${options.maxParallelSubagents}.
6. For large changes, split review by domain or file area, then merge and deduplicate findings.

GitHub PR review mode:
- Use this mode when the target is a GitHub PR URL, PR number, or branch with a clear GitHub repository.
- Fetch PR metadata first with gh so you know the base branch, head branch, head SHA, changed files, and CI status.
- Before creating a temporary worktree, check whether the current directory is already the target repository on the PR head branch or head SHA. If yes, use the current checkout after confirming the worktree is clean enough for read-only review.
- Only clone or create a temporary worktree when the current directory is not the target repository, is on the wrong branch/SHA, has conflicting local changes, or the PR cannot be inspected safely in place.
- If you create a temporary clone/worktree or payload file, clean it up before the final response unless the user asks to keep it.
- Review against the PR base using a three-dot diff. Prefer concrete changed-line anchors that GitHub can attach to the PR diff.
- Post comments only after confirming the finding against source, not from a diff hunch alone.
- For multiple findings, prefer one grouped GitHub review with inline comments via gh api pulls/{number}/reviews rather than separate loose comments.
- Newly added files may report null line fields through the API after posting even when the comment is correctly anchored by diff position; verify the review comment count and paths after submission.
- If GitHub posting fails, report the exact API/tool error and provide the comments with path and line so the user can post them manually.

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
   ${options.goalCommand} <fix the Skuld review findings>
3. Re-run relevant verification.
4. Run Skuld review again.
5. Repeat until no actionable findings remain or until ${options.maxReviewLoops} review loops have completed.
6. If the loop limit is reached, stop and report remaining blockers instead of claiming completion.

Final response:
- Review target.
- Review loop ledger.
- Findings fixed.
- Inline PR comments posted, skipped, or failed, with links when available.
- Temporary worktree or clone cleanup status, if one was created.
- Verification commands and results.
- Final reviewer verdict.
- Residual non-blocking risks, if any.`
}

export async function SkuldPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = skuldTemplate(config)
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

export default SkuldPlugin
