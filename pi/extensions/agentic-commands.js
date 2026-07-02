const COMMANDS = {
  tyr: {
    description: "Run a repo goal end-to-end with a baro-style plan, story DAG, critic loop, and final verification.",
    render: (args) => `Run this goal end-to-end using a baro-inspired workflow in Pi.

Goal:
${args}

Use this process:

1. Preconditions
- Confirm the current directory is a git repository before making changes.
- Inspect the repo first: read key docs, package/config files, tests, and existing architecture.
- If the goal is ambiguous enough to risk wrong implementation, ask one concise clarifying question; otherwise proceed.

2. Architecture pass
- Produce a short decision document before edits.
- Pin the files, APIs, schemas, commands, migration strategy, and test strategy that downstream work must follow.
- Avoid broad rewrites unless the goal requires them.

3. Story DAG
- Split the goal into small dependent stories.
- Mark independent stories and execute them in the safest available order.
- Pi does not ship built-in sub-agents or plan mode; if parallelism is needed, propose tmux/Pi subprocesses or an extension-backed workflow before attempting it.
- Track progress in a visible repo-local artifact such as TODO.md when the task is substantial.

4. Build loop
- Implement each story in isolated, reviewable increments.
- After each story, run the narrowest useful verification.
- If a story gets stuck, replan that story rather than continuing blindly.

5. Critic loop
- Review the changed code for correctness, regressions, security issues, race conditions, edge cases, and missing tests.
- Repair any concrete findings.

6. Baro delegation defaults
- If baro is installed and the user asks to delegate the goal to baro, default to: baro --llm opencode -m openai/gpt-5.3-codex-spark "${args}".
- If the user wants Pi itself to run the work, stay in this Pi session and follow this workflow directly.

7. Finalizer
- Run the broadest feasible verification for this repo.
- Summarize completed stories, files changed, verification commands, remaining risks, and PR-readiness.`,
  },
  munin: {
    description: "Run an autonomous research loop: baseline, hypothesize, edit, evaluate, keep/discard, and report.",
    render: (args) => `Run a Pi-native autoresearch loop inspired by karpathy/autoresearch.

Research objective:
${args}

Use this process:

1. Scope and setup
- Inspect the repo and identify the research target, experiment entrypoint, metric, baseline command, and files that are safe to modify.
- Prefer mutable files: train.py.
- Treat protected files as read-only unless the objective explicitly requires otherwise: prepare.py.
- If program.md exists, treat it as the research org instructions. If not, infer a concise local research protocol from project docs.
- Use setup command when needed and feasible: uv sync && uv run prepare.py.
- Optional memory: if AgentDB MCP/tools or the agentdb CLI are already available, retrieve relevant prior episodes, skill patterns, or critiques before choosing experiments. If unavailable, continue silently from repo sources; optional memory is never a blocker.

2. Baseline
- Run or identify the baseline experiment command: uv run train.py.
- Capture metric name, direction, runtime budget, logs path, and current best score.
- Default metric: val_bpb; direction: lower; time budget: 5 minutes per experiment.
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

5. Research judgement
- For skill/extension work, prefer changes that improve repeatable outcome evidence over changes that only make prompts longer.
- If AgentDB is available and an experiment yields a durable lesson, store the successful pattern, failure critique, or evaluation result for future recall. Do not install or start long-lived AgentDB services from inside the research loop unless the user explicitly asks.

6. Final report
- Report best result, full experiment ledger, final diff summary, exact commands run, artifacts/logs, and recommended next experiments.`,
  },
  eitri: {
    description: "Create or run AutoAgent-style Pi agents/workflows from natural language.",
    render: (args) => `Build or run a Pi-native AutoAgent-style workflow.

Request:
${args}

Use this process:

1. Interpret the request
- Determine whether the user wants deep research, a single custom agent, a multi-agent workflow, tools, or an end-to-end task solved by generated agents.
- Ask one concise clarification only if the requested agent/workflow cannot be safely specified.
- Default mode: Pi-native.

2. Agent/workflow profiling
- Derive agent profiles from natural language: role, objective, inputs, outputs, tools needed, permissions, stopping criteria, and verification.
- For workflows, define handoffs, dependencies, shared artifacts, and failure recovery.
- Tool creation and workflow creation are allowed when they stay Pi-native and scoped.

3. Pi implementation
- Prefer Pi-native artifacts over external frameworks: extensions in .pi/extensions/ or ~/.pi/agent/extensions/, skills, prompt templates, and package resources.
- Keep generated agents/workflows narrow, composable, and permission-scoped.
- Do not create broad always-on tools unless explicitly requested.

4. External AutoAgent compatibility
- If the user explicitly asks to run upstream AutoAgent instead of Pi-native generation, use OpenAI/Codex-compatible defaults where available and document required setup.
- Do not require upstream AutoAgent, Docker, or API-key setup for Pi-native workflows.

5. Self-improvement loop
- Test the generated agent/workflow on a small representative task.
- Review output quality, missing tools, unsafe permissions, and unclear handoffs.
- Revise when concrete issues are found.

6. Final report
- Summarize created/modified Pi artifacts, agent roles, workflow graph, permissions, validation performed, and any manual setup still required.`,
  },
  vidar: {
    description: "Run repeated goal implementation and PR-review repair loops until only an unresolvable blocker remains or review is clean.",
    render: (args) => `Run this task in Vidar mode in Pi: repeatedly execute goal-sized implementation loops until the work is fully realized, then run PR-review repair loops until there are no review findings left.

Original goal:
${args}

Operating principle:
- Treat this command as the execution anchor for the whole task. Start by establishing enough context to make and update a durable plan, then keep that plan current through every loop.
- Do not stop after one pass.
- Treat each pass as incomplete until a critic review explicitly confirms the full task is done.
- Do not exit early because work is large, tests fail, review findings remain, context is uncomfortable, or another loop is needed.
- Only stop before completion when you hit a concrete blocker you cannot resolve with available tools, repo context, user-provided information, and reasonable implementation choices.
- When you hit a possible blocker, first try to resolve it: inspect more files, run narrower checks, simplify the approach, repair the failure, or ask one concise clarifying question if missing user input is the only blocker.

Phase 0: context research and anchor plan
- Before editing, perform extensive context research across the repo: docs, package/config files, entrypoints, tests, existing patterns, public APIs, data models, migrations, deployment/runtime config, and recent git context when available.
- Produce a context research dossier with file references, commands run, key architecture findings, impacted surfaces, constraints, and patterns to preserve.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, recall relevant past episodes, successful patterns, critiques, and skill lessons. If unavailable, skip them quietly and continue from repo sources; optional memory is not a blocker and should not create noisy failure narration.
- Maintain an assumption and question ledger. Ask only if missing user input blocks a safe decision; otherwise make the smallest reasonable decision and record it.
- Produce or update the anchor plan: success criteria, story DAG, dependency order, parallel-safe lanes, verification matrix, review gates, and rollback/cleanup considerations.
- Keep the anchor plan current after every implementation, critic, and PR-review loop. Do not let the work drift away from the researched plan.
- If AgentDB is available and the work produces a durable lesson, store the successful pattern, failure critique, or review finding after verification. Do not install or start long-lived AgentDB services from inside the work loop unless the user explicitly asks.

Phase 1: implementation loop
- Use /tyr semantics for each implementation loop: inspect, architect, split into stories, implement, verify, critic-repair, and summarize. Use the Phase 0 context dossier and anchor plan as the controlling source of truth.
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
- When blocked, report the exact blocker, attempts made, evidence that it cannot be resolved in this session, and the smallest user action needed to unblock it.`,
  },
  hugin: {
    description: "Create a verified dependency-aware execution plan without editing code.",
    render: (args) => `Create a Hugin anchor plan for this goal before implementation. Do not edit code unless explicitly asked to execute the plan.

Goal:
${args}

Treat this command as the anchor for all downstream work: no implementation should start until this plan has enough context to guide /tyr or /vidar safely.

Planning principles:
- Perform extensive context research before deciding architecture. Inspect repo docs, package/config files, entrypoints, tests, existing patterns, public APIs, data models, migrations, deployment/runtime config, and recent git context when available.
- Build a context research dossier with file references and evidence. Separate facts observed in the repo from assumptions, inferences, and open questions.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, use them to recall prior successful patterns, critiques, and skill lessons. If unavailable, skip them quietly and continue from repo sources; optional memory is not a blocker and should not create noisy failure narration.
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

Run a separate review pass over the plan when possible, revise concrete flaws, then present the approved, self-contained plan and recommended first execution command.`,
  },
  skuld: {
    description: "Review and repair a diff repeatedly until no actionable PR-review findings remain.",
    render: (args) => `Run a Skuld review for this work: review the diff or described change like a pull request, repair actionable findings, and repeat until review is clean.

Review target:
${args}

Focus on correctness bugs, regressions, missing tests, security, data loss, race conditions, compatibility breaks, performance hazards, and concrete maintainability risks. Present findings with severity, file/line where possible, failure mode, minimal fix, and verification needed. If actionable findings exist, repair them with a targeted implementation loop, re-run verification, and review again until clean.

GitHub PR review mode:
- Fetch PR metadata first with gh so you know the base branch, head branch, head SHA, changed files, and CI status.
- Before creating a temporary worktree, check whether the current directory is already the target repository on the PR head branch or head SHA. If yes, use the current checkout for read-only review.
- Only clone or create a temporary worktree when the current directory is not the target repository, is on the wrong branch/SHA, has conflicting local changes, or the PR cannot be inspected safely in place.
- Clean up temporary clones/worktrees and payload files before the final response unless the user asks to keep them.
- Post comments only after confirming the finding against source, not from a diff hunch alone.
- For multiple findings, prefer one grouped GitHub review with inline comments via gh api pulls/{number}/reviews.
- If a review subagent fails because its configured model is unavailable, retry with an available/current active model when possible; otherwise continue manually instead of stopping.`,
  },
  bifrost: {
    description: "Start, inspect, sync-diagnose, or stop a secure OpenCode Web remote portal with a tunnel.",
    render: (args) => `Run Bifrost now. Do not print this instruction back to the user.

Request:
${args}

Execute the package runner when available:

\`opencode-bifrost --state-dir .opencode/bifrost --host 127.0.0.1 --preferred-tunnel cloudflared --fallback-tunnel ngrok -- ${args}\`

If opencode-bifrost is not on PATH in this local checkout, locate the installed opencode-agentic-commands package first, then run its scripts/bifrost-runner.mjs with the same arguments.

Return only the runner output. The OpenCode Web username is opencode unless OPENCODE_SERVER_USERNAME was set by the runner environment. For start, status, and sync, keep the URL, username, password, Copy login, session links, and live TUI control API lines easy to see.`,
  },
  polaris: {
    description: "Orchestrate a task end to end with planning, agents, research, implementation, and review loops.",
    render: (args) => `Run this task in Polaris mode: use every agentic command in this package as a high-level end-to-end orchestrator, from context research through final review.

Task:
${args}

Mission:
- Own the task end to end. Do not stop at planning, a partial implementation, or a first review pass.
- Use the existing command suite as orchestration phases: /hugin, /tyr, /eitri, /munin, /vidar, and /skuld.
- Completion standard: plan, implementation, research optimization, and review all agree there is no remaining required work.

Phase 0: intake, memory, and scope
- Restate the task, success criteria, constraints, and expected deliverables.
- Perform extensive context research across repo docs, config, entrypoints, tests, APIs, data models, migrations, runtime/deploy config, and recent git context when available.
- Optional memory: if AgentDB MCP/tools, Agent Wisdom, or the agentdb CLI are already available, recall relevant successful patterns, critiques, prior episodes, and skill lessons. If unavailable, skip quietly and continue from repo sources; optional memory is not a blocker.
- Build a context dossier and assumption ledger. Ask one concise question only if missing user input blocks a safe decision.

Phase 1: anchor plan
- Run /hugin semantics for the full task.
- Produce a self-contained anchor plan with source map, architecture decisions, story DAG, dependency order, parallel-safe lanes, verification matrix, review gates, and rollback/cleanup considerations.
- Keep this plan current through all later phases.

Phase 2: orchestration design
- Decide whether new or specialized agents, workflows, commands, skills, tools, or package artifacts are needed.
- If yes, run /eitri semantics to design and create the minimal scoped artifacts.

Phase 3: measurable optimization
- If the task involves prompts, commands, skills, extensions, agents, experiments, model behavior, or quality improvements, run /munin semantics before and after changes.
- Define outcome tests before editing: expansion invariants, package install/load checks, command registration checks, prompt regression assertions, benchmark/metric checks, and before/after smoke comparisons where feasible.

Phase 4: implementation
- Run /vidar semantics to execute the anchor plan with repeated /tyr loops.
- Keep looping implementation, verification, critic review, and repair until no required work remains.
- Only stop early for a concrete blocker that cannot be resolved with available tools/context after reasonable attempts.

Phase 5: final review and repair
- Run /skuld semantics against the final diff, branch, or described deliverable.
- If this is a GitHub PR review, use /skuld GitHub PR mode: inspect the current checkout first, avoid temp worktrees unless needed, post grouped inline comments for confirmed findings, and clean up temporary clones/worktrees before reporting.
- If review subagents fail because their configured model is unavailable, retry with an available/current active model when possible; otherwise continue manually instead of stopping.
- Repair every actionable finding, rerun relevant verification, then review again.
- Repeat until review is clean or a genuine unresolved blocker remains.

Final report:
- Original task and final status.
- Context dossier summary and key evidence.
- Anchor plan and plan updates.
- Work completed by phase.
- Files/artifacts changed.
- Outcome tests, verification commands, and results.
- Final /skuld verdict.
- Inline PR comments posted, skipped, or failed, if PR review mode was used.
- Temporary worktree or clone cleanup status, if one was created.
- AgentDB/Agent Wisdom memory used or stored, if any.
- Residual non-blocking risks.

Hard stop rule:
- Do not call the task complete until planning, implementation, measurable outcome checks, and final review all find no remaining required work.
- If anything remains, start the next targeted phase loop or report the exact unresolvable blocker.`,
  },
}

function normalizeArgs(args) {
  return String(args || "").trim()
}

export default function agenticCommands(pi) {
  for (const [name, command] of Object.entries(COMMANDS)) {
    pi.registerCommand(name, {
      description: command.description,
      handler: async (args, ctx) => {
        await ctx.sendUserMessage(command.render(normalizeArgs(args)))
      },
    })
  }
}

export { COMMANDS }
