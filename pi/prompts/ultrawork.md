---
description: Run repeated goal and PR-review repair loops until clean or genuinely blocked
argument-hint: "<goal>"
---
Run this task in ultrawork mode in Pi: repeatedly execute goal-sized implementation loops until the work is fully realized, then run PR-review repair loops until there are no review findings left.

Original goal:
$ARGUMENTS

Operating principle:
- Do not stop after one pass.
- Treat each pass as incomplete until a critic review explicitly confirms the full task is done.
- Do not exit early because work is large, tests fail, review findings remain, context is uncomfortable, or another loop is needed.
- Only stop before completion when you hit a concrete blocker you cannot resolve with available tools, repo context, user-provided information, and reasonable implementation choices.
- When you hit a possible blocker, first try to resolve it: inspect more files, run narrower checks, simplify the approach, repair the failure, or ask one concise clarifying question if missing user input is the only blocker.

Phase 1: implementation loop
- Use `/goal` semantics for each implementation loop: inspect, architect, split into stories, implement, verify, critic-repair, and summarize.
- If work remains, start another targeted loop instead of exiting.

Phase 2: critic-driven loops
- Run a critic pass after every implementation loop.
- The critic must answer whether the original goal is fully satisfied, what work remains, what verification is missing, and what risks remain.
- If the critic finds required work, split it smaller and continue.

Phase 3: PR review and repair loops
- Review the changed files as if preparing a pull request.
- If PR review finds anything actionable, run a targeted repair loop, re-run verification, and review again.
- Repeat until review finds no actionable issues.

Hard stop rule:
- If there is any concrete remaining implementation work, missing required verification, or actionable PR review finding, do not call the task complete and do not exit. Start another targeted loop.
- The only acceptable early exit is an unresolved blocker that you cannot fix after reasonable investigation and repair attempts.
- When blocked, report the exact blocker, attempts made, evidence that it cannot be resolved in this session, and the smallest user action needed to unblock it.
