import { addTextOutput, firstTextPart, parseSlash, replaceArguments } from "./shared.mjs"

const DEFAULT_OPTIONS = {
  commandName: "autoresearch",
  agent: "build",
  programFile: "program.md",
  mutableFiles: ["train.py"],
  protectedFiles: ["prepare.py"],
  setupCommand: "uv sync && uv run prepare.py",
  experimentCommand: "uv run train.py",
  metricName: "val_bpb",
  metricDirection: "lower",
  timeBudget: "5 minutes per experiment",
  maxIterations: "until user budget/time limit or diminishing returns",
}

function normalizeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    mutableFiles: options.mutableFiles || DEFAULT_OPTIONS.mutableFiles,
    protectedFiles: options.protectedFiles || DEFAULT_OPTIONS.protectedFiles,
  }
}

function list(items) {
  return items.map((item) => `\`${item}\``).join(", ")
}

function autoresearchTemplate(options) {
  return `Run an opencode-native autoresearch loop inspired by karpathy/autoresearch.

Research objective:
$ARGUMENTS

Use this process:

1. Scope and setup
- Inspect the repo and identify the research target, experiment entrypoint, metric, baseline command, and files that are safe to modify.
- Prefer this configured mutable file set: ${list(options.mutableFiles)}.
- Treat this configured protected file set as read-only unless the objective explicitly requires otherwise: ${list(options.protectedFiles)}.
- If there is a \`${options.programFile}\`, treat it as the research org instructions. If not, infer a concise local research protocol from project docs.
- Use this setup command when setup is needed and feasible: \`${options.setupCommand}\`.

2. Baseline
- Run or identify the baseline experiment command. Default configured command: \`${options.experimentCommand}\`.
- Capture metric name, direction, runtime budget, logs path, and current best score.
- Default metric: \`${options.metricName}\`; direction: \`${options.metricDirection}\`; time budget: ${options.timeBudget}.
- If execution is too expensive or unavailable, document the blocker and continue with a dry-run experiment plan.

3. Experiment ledger
- Maintain an experiment ledger in the conversation with: hypothesis, files changed, command, metric, result, decision, and next idea.
- Keep diffs small and reversible.

4. Iteration loop
- Propose one hypothesis at a time.
- Edit only the allowed experiment files.
- Run the fixed-budget command or the nearest feasible verification.
- Compare against the current best using the declared metric.
- Keep improvements; revert or supersede failed changes with a clear reason. Never fabricate results.

5. Research judgement
- Favor ideas with plausible mechanism, low implementation complexity, and measurable effect.
- Avoid changing the metric, validation set, or time budget to make results look better.
- Stop according to this configured iteration limit: ${options.maxIterations}.

6. Final report
- Report best result, full experiment ledger, final diff summary, exact commands run, artifacts/logs, and recommended next experiments.

Autoresearch reference behavior to emulate: an autonomous researcher repeatedly edits experiment code, trains/evaluates for a fixed budget, compares a metric, keeps or discards changes, and leaves a transparent experiment log. Change defaults in \`opencode.json\` plugin options for \`programFile\`, \`mutableFiles\`, \`protectedFiles\`, \`setupCommand\`, \`experimentCommand\`, \`metricName\`, \`metricDirection\`, \`timeBudget\`, and \`maxIterations\`.`
}

export async function AutoresearchPlugin(_input, options) {
  const config = normalizeOptions(options)
  const template = autoresearchTemplate(config)
  const commandNames = [config.commandName]

  return {
    config(opencodeConfig) {
      opencodeConfig.command ||= {}
      opencodeConfig.command[config.commandName] = {
        description: "Run an autonomous research loop: baseline, hypothesize, edit, evaluate, keep/discard, and report.",
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

export default AutoresearchPlugin
