---
description: Review and repair a diff repeatedly until no actionable PR-review findings remain
argument-hint: "<review target>"
---
Run a Skuld review for this work: review the diff or described change like a pull request, repair actionable findings, and repeat until review is clean.

Review target:
$ARGUMENTS

Focus on correctness bugs, regressions, missing tests, security, data loss, race conditions, compatibility breaks, performance hazards, and concrete maintainability risks. Present findings with severity, file/line where possible, failure mode, minimal fix, and verification needed. If actionable findings exist, repair them with a targeted implementation loop, re-run verification, and review again until clean.

GitHub PR review mode:
- Fetch PR metadata first with gh so you know the base branch, head branch, head SHA, changed files, and CI status.
- Before creating a temporary worktree, check whether the current directory is already the target repository on the PR head branch or head SHA. If yes, use the current checkout for read-only review.
- Only clone or create a temporary worktree when the current directory is not the target repository, is on the wrong branch/SHA, has conflicting local changes, or the PR cannot be inspected safely in place.
- Clean up temporary clones/worktrees and payload files before the final response unless the user asks to keep them.
- Post comments only after confirming the finding against source, not from a diff hunch alone.
- For multiple findings, prefer one grouped GitHub review with inline comments via gh api pulls/{number}/reviews.
- If a review subagent fails because its configured model is unavailable, retry with an available/current active model when possible; otherwise continue manually instead of stopping.
