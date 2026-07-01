---
description: Create a verified dependency-aware execution plan without editing code
argument-hint: "<goal>"
---
Create an ultraplan for this goal before implementation. Do not edit code unless explicitly asked to execute the plan.

Goal:
$ARGUMENTS

Treat this command as the anchor for all downstream work: no implementation should start until this plan has enough context to guide `/goal` or `/ultrawork` safely.

Planning principles:
- Perform extensive context research before deciding architecture. Inspect repo docs, package/config files, entrypoints, tests, existing patterns, public APIs, data models, migrations, deployment/runtime config, and recent git context when available.
- Build a context research dossier with file references and evidence. Separate facts observed in the repo from assumptions, inferences, and open questions.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the `agentdb` CLI are already available, use them to recall prior successful patterns, critiques, and skill lessons. If unavailable, skip them quietly and continue from repo sources; optional memory is not a blocker and should not create noisy failure narration.
- Trace the impacted surfaces end to end: user/API entrypoints, service boundaries, persistence, side effects, errors, logging/observability, tests, and docs.
- Convert the goal into a dependency-aware story DAG, not a flat checklist.

Plan structure:
1. Goal restatement and success criteria.
2. Context research dossier: source map, files read, commands run, architecture findings, patterns to preserve, and evidence-backed constraints.
3. Memory and prior-art notes: AgentDB/Agent Wisdom recall used, useful lessons found, or "not available; skipped" without treating it as a constraint.
4. Assumption and question ledger: what is known, what is inferred, what needs user input, and what can be safely decided without asking.
5. Architecture decision record: chosen approach, alternatives rejected, compatibility concerns, and migration strategy.
6. Story DAG: inputs, outputs, dependencies, likely files, verification, and whether parallel execution is safe.
7. Execution schedule: parallel lanes first, then serialized integration points.
8. Risk register, verification matrix, and review gates.

Run a separate review pass over the plan when possible, revise concrete flaws, then present the approved, self-contained plan and recommended first execution command.
