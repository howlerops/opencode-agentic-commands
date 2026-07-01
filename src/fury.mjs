import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "fury",
  agent: "build",
  defaultMode: "opencode-native",
  completionModel: "openai/gpt-5.3-codex-spark",
  apiBaseUrl: "",
  containerName: "deepresearch",
  port: 12346,
  gitClone: true,
  testPullName: "autoagent_mirror",
  allowToolCreation: true,
  allowWorkflowCreation: true,
  outputScope: "prefer project .opencode artifacts; use global artifacts only when explicitly requested",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function autoagentTemplate(options) {
  return `Build or run an opencode-native AutoAgent-style workflow.

Request:
$ARGUMENTS

Use this process:

1. Interpret the request
- Determine whether the user wants deep research, a single custom agent, a multi-agent workflow, tools, or an end-to-end task solved by generated agents.
- Ask one concise clarification only if the requested agent/workflow cannot be safely specified.
- Default mode: ${options.defaultMode}.

2. Agent/workflow profiling
- Derive agent profiles from natural language: role, objective, inputs, outputs, tools needed, permissions, stopping criteria, and verification.
- For workflows, define handoffs, dependencies, shared artifacts, and failure recovery.
- Tool creation allowed by config: ${options.allowToolCreation ? "yes" : "no"}.
- Workflow creation allowed by config: ${options.allowWorkflowCreation ? "yes" : "no"}.

3. Opencode implementation
- Prefer opencode-native artifacts over external frameworks: agents in \`.opencode/agent/\` or \`~/.config/opencode/agent/\`, commands in \`.opencode/command/\` or config-injected commands, and plugins only when hooks/tools are needed.
- Keep generated agents narrow, composable, and permission-scoped.
- Do not create broad always-on agents or tools unless explicitly requested.
- Artifact scope: ${options.outputScope}.

4. External AutoAgent compatibility
- If the user explicitly asks to run upstream AutoAgent instead of opencode-native generation, use these configured defaults: \`COMPLETION_MODEL=${options.completionModel}\`${options.apiBaseUrl ? `, \`API_BASE_URL=${options.apiBaseUrl}\`` : ""}, container \`${options.containerName}\`, port \`${options.port}\`, \`git_clone=${options.gitClone}\`, and \`test_pull_name=${options.testPullName}\`.
- Do not require upstream AutoAgent, Docker, or API-key setup for opencode-native workflows.

5. Self-improvement loop
- Test the generated agent/workflow on a small representative task.
- Review output quality, missing tools, unsafe permissions, and unclear handoffs.
- Revise once or twice when concrete issues are found.

6. Execution mode
- If the request is to solve a task, run the workflow now using opencode subagents/tasks where appropriate.
- If the request is to create reusable agents, write the files and explain how to invoke them.

7. Final report
- Summarize created/modified opencode artifacts, agent roles, workflow graph, permissions, validation performed, and any manual setup still required.

AutoAgent reference behavior to emulate: natural-language agent and workflow creation, self-managing orchestration, iterative profile/tool/workflow refinement, and zero-code user interaction, implemented with opencode primitives. Change defaults in \`opencode.json\` plugin options for \`defaultMode\`, \`completionModel\`, \`apiBaseUrl\`, \`containerName\`, \`port\`, \`gitClone\`, \`testPullName\`, \`allowToolCreation\`, \`allowWorkflowCreation\`, and \`outputScope\`.`
}

export async function AutoagentPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = autoagentTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Create or run AutoAgent-style opencode agents/workflows from natural language.",
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

export default AutoagentPlugin
