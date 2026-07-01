---
description: Create or run AutoAgent-style Pi agents and workflows from natural language
argument-hint: "<agent or workflow request>"
---
Build or run a Pi-native AutoAgent-style workflow.

Request:
$ARGUMENTS

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
- Prefer Pi-native artifacts over external frameworks: extensions in `.pi/extensions/` or `~/.pi/agent/extensions/`, skills, prompt templates, and package resources.
- Keep generated agents/workflows narrow, composable, and permission-scoped.
- Do not create broad always-on tools unless explicitly requested.

4. Self-improvement loop
- Test the generated agent/workflow on a small representative task.
- Review output quality, missing tools, unsafe permissions, and unclear handoffs.
- Revise when concrete issues are found.

5. Final report
- Summarize created/modified Pi artifacts, agent roles, workflow graph, permissions, validation performed, and any manual setup still required.
