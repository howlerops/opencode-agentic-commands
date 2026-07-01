---
description: Orchestrate a task end to end with planning, agents, research, implementation, and review loops
argument-hint: "<task>"
---
Run this task in Thanos mode: use every agentic command in this package as a high-level end-to-end orchestrator, from context research through final review.

Task:
$ARGUMENTS

Mission:
- Own the task end to end. Do not stop at planning, a partial implementation, or a first review pass.
- Use the existing command suite as orchestration phases: `/ultraplan`, `/goal`, `/autoagent`, `/autoresearch`, `/ultrawork`, and `/ultrareview`.
- Completion standard: plan, implementation, research optimization, and review all agree there is no remaining required work.

Phase 0: intake, memory, and scope
- Restate the task, success criteria, constraints, and expected deliverables.
- Perform extensive context research across repo docs, config, entrypoints, tests, APIs, data models, migrations, runtime/deploy config, and recent git context when available.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the `agentdb` CLI are already available, recall relevant successful patterns, critiques, prior episodes, and skill lessons. If unavailable, skip quietly and continue from repo sources; optional memory is not a blocker.
- Build a context dossier and assumption ledger. Ask one concise question only if missing user input blocks a safe decision.

Phase 1: anchor plan
- Run `/ultraplan` semantics for the full task.
- Produce a self-contained anchor plan with source map, architecture decisions, story DAG, dependency order, parallel-safe lanes, verification matrix, review gates, and rollback/cleanup considerations.
- Keep this plan current through all later phases.

Phase 2: orchestration design
- Decide whether new or specialized agents, workflows, commands, skills, tools, or package artifacts are needed.
- If yes, run `/autoagent` semantics to design and create the minimal scoped artifacts.

Phase 3: measurable optimization
- If the task involves prompts, commands, skills, extensions, agents, experiments, model behavior, or quality improvements, run `/autoresearch` semantics before and after changes.
- Define outcome tests before editing: expansion invariants, package install/load checks, command registration checks, prompt regression assertions, benchmark/metric checks, and before/after smoke comparisons where feasible.

Phase 4: implementation
- Run `/ultrawork` semantics to execute the anchor plan with repeated `/goal` loops.
- Keep looping implementation, verification, critic review, and repair until no required work remains.
- Only stop early for a concrete blocker that cannot be resolved with available tools/context after reasonable attempts.

Phase 5: final review and repair
- Run `/ultrareview` semantics against the final diff, branch, or described deliverable.
- Repair every actionable finding, rerun relevant verification, then review again.
- Repeat until review is clean or a genuine unresolved blocker remains.

Final report:
- Original task and final status.
- Context dossier summary and key evidence.
- Anchor plan and plan updates.
- Work completed by phase.
- Files/artifacts changed.
- Outcome tests, verification commands, and results.
- Final `/ultrareview` verdict.
- AgentDB/Agent Wisdom memory used or stored, if any.
- Residual non-blocking risks.

Hard stop rule:
- Do not call the task complete until planning, implementation, measurable outcome checks, and final review all find no remaining required work.
- If anything remains, start the next targeted phase loop or report the exact unresolvable blocker.
