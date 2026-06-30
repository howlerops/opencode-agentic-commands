import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "goal",
  agent: "build",
  baroBackend: "opencode",
  baroModel: "openai/gpt-5.3-codex-spark",
  baroExtraArgs: "",
}

function normalizeOptions(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options }
}

function baroCommand(options) {
  const args = ["baro", "--llm", options.baroBackend]
  if (options.baroBackend === "opencode" && options.baroModel) args.push("-m", options.baroModel)
  if (options.baroExtraArgs) args.push(options.baroExtraArgs)
  args.push('"$ARGUMENTS"')
  return args.join(" ")
}

function goalTemplate(options) {
  const command = baroCommand(options)
  return `Run this goal end-to-end using a baro-inspired workflow.

Goal:
$ARGUMENTS

Use this process:

1. Preconditions
- Confirm the current directory is a git repository before making changes.
- Inspect the repo first: read key docs, package/config files, tests, and existing architecture.
- If the goal is ambiguous enough to risk wrong implementation, ask one concise clarifying question; otherwise proceed.

2. Architecture pass
- Produce a short decision document in the conversation before edits.
- Pin the files, APIs, schemas, commands, migration strategy, and test strategy that downstream work must follow.
- Avoid broad rewrites unless the goal requires them.

3. Story DAG
- Split the goal into small dependent stories.
- Mark independent stories and execute them in the safest parallel order available through opencode task/subagent tooling.
- Keep a visible todo list and update it as work proceeds.

4. Build loop
- Implement each story in isolated, reviewable increments.
- After each story, run the narrowest useful verification.
- If a story gets stuck, replan that story rather than continuing blindly.

5. Critic loop
- Review the changed code for correctness, regressions, security issues, race conditions, edge cases, and missing tests.
- Repair any concrete findings.

6. Baro delegation defaults
- If baro is installed and the user asks to delegate the goal to baro, default to this configured command: \`${command}\`.
- This setup uses baro's OpenCode backend so baro executes through opencode while the \`-m\` value selects the configured Codex/OpenAI model.
- Change the default by editing this plugin's options in \`opencode.json\`: \`baroBackend\`, \`baroModel\`, or \`baroExtraArgs\`.
- Use \`baroExtraArgs\` for phase routing or endpoints, such as \`--story-llm opencode\`, \`--tier-map ...\`, \`--openai-base-url ...\`, \`--parallel ...\`, \`--dry-run\`, or \`--no-memory\`.

7. Finalizer
- Run the broadest feasible verification for this repo.
- Summarize completed stories, files changed, verification commands, remaining risks, and PR-readiness.

Baro reference behavior to emulate: one goal becomes an architected plan, a dependency-aware story DAG, parallel execution where safe, critic/self-repair, final verification, and a PR-ready summary. Default baro delegation should use \`${command}\`; otherwise implement directly inside opencode.`
}

export async function GoalPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = goalTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Run a repo goal end-to-end with a baro-style plan, story DAG, critic loop, and final verification.",
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

export default GoalPlugin
