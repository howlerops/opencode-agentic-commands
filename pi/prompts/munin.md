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
- Optional memory: if AgentDB MCP/tools or the `agentdb` CLI are already available, retrieve relevant prior episodes, skill patterns, or critiques before choosing experiments. If unavailable, continue silently from repo sources; optional memory is never a blocker.

2. Baseline
- Run or identify the baseline experiment command: `uv run train.py`.
- Capture metric name, direction, runtime budget, logs path, and current best score.
- Default metric: `val_bpb`; direction: `lower`; time budget: 5 minutes per experiment.
- If execution is too expensive or unavailable, document the blocker and continue with a dry-run experiment plan.

3. Experiment ledger
- Maintain an experiment ledger in the conversation with hypothesis, files changed, command, metric, result, decision, and next idea.
- Keep diffs small and reversible.
- If the objective is improving commands, skills, extensions, or prompts, define outcome tests before editing: expansion invariants, package install/load checks, command registration checks, prompt regression assertions, and at least one before/after smoke comparison where feasible.

4. Iteration loop
- Propose one hypothesis at a time.
- Edit only allowed experiment files.
- Run the fixed-budget command or the nearest feasible verification.
- Compare against the current best using the declared metric.
- Keep improvements; revert or supersede failed changes with a clear reason. Never fabricate results.
- This is not a single-pass run: continue the loop while there is any plausible untested hypothesis, failing/weak outcome test, or measurable path to improve the objective within the user's budget.
- Stop only when the metric/outcome has plateaued, the next experiments are lower-value than the cost, every feasible outcome test is passing, or a concrete blocker/user budget limit prevents further evaluation.

5. Research judgement
- For skill/extension work, prefer changes that improve repeatable outcome evidence over changes that only make prompts longer.
- If AgentDB is available and an experiment yields a durable lesson, store the successful pattern, failure critique, or evaluation result for future recall. Do not install or start long-lived AgentDB services from inside the research loop unless the user explicitly asks.

6. Final report
- Report best result, full experiment ledger, final diff summary, exact commands run, artifacts/logs, and recommended next experiments.
