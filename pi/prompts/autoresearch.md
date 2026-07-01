---
description: Run an autonomous research loop with baseline, hypothesis, evaluation, keep/discard decisions, and report
argument-hint: "<research objective>"
---
Run a Pi-native autoresearch loop inspired by karpathy/autoresearch.

Research objective:
$ARGUMENTS

Use this process:

1. Scope and setup
- Inspect the repo and identify the research target, experiment entrypoint, metric, baseline command, and files that are safe to modify.
- Prefer mutable files: `train.py`.
- Treat protected files as read-only unless the objective explicitly requires otherwise: `prepare.py`.
- If `program.md` exists, treat it as the research org instructions. If not, infer a concise local research protocol from project docs.
- Use setup command when needed and feasible: `uv sync && uv run prepare.py`.

2. Baseline
- Run or identify the baseline experiment command: `uv run train.py`.
- Capture metric name, direction, runtime budget, logs path, and current best score.
- Default metric: `val_bpb`; direction: `lower`; time budget: 5 minutes per experiment.
- If execution is too expensive or unavailable, document the blocker and continue with a dry-run experiment plan.

3. Experiment ledger
- Maintain an experiment ledger in the conversation with hypothesis, files changed, command, metric, result, decision, and next idea.
- Keep diffs small and reversible.

4. Iteration loop
- Propose one hypothesis at a time.
- Edit only allowed experiment files.
- Run the fixed-budget command or the nearest feasible verification.
- Compare against the current best using the declared metric.
- Keep improvements; revert or supersede failed changes with a clear reason. Never fabricate results.

5. Final report
- Report best result, full experiment ledger, final diff summary, exact commands run, artifacts/logs, and recommended next experiments.
