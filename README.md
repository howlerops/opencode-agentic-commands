# opencode-agentic-commands

OpenCode plugin package and Pi package that adds agentic slash commands/prompts:

- `/goal` - baro-style end-to-end repo execution with architecture, story DAG, critic loop, and final verification.
- `/autoresearch` - karpathy/autoresearch-style experiment loop with baseline, metric tracking, keep/discard decisions, and an experiment ledger.
- `/autoagent` - AutoAgent-style natural-language agent/workflow creation using opencode-native artifacts.
- `/ultrawork` - repeated `/goal` implementation loops plus PR-review repair loops until a critic finds nothing left.

For Pi, the package currently exposes `/goal` as a prompt template.

## Install

### Local path

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/Users/jacob_1/opencode-agentic-commands", {}]
  ]
}
```

### GitHub

After pushing this repo to GitHub:

```json
{
  "plugin": [
    ["github:YOUR_USER/opencode-agentic-commands", {}]
  ]
}
```

### npm

After publishing to npm:

```json
{
  "plugin": [
    ["opencode-agentic-commands", {}]
  ]
}
```

Restart opencode after changing plugin config.

## Install For Pi

Pi loads this repo as a Pi package through the `pi.prompts` manifest in `package.json`.

### Local path

```bash
pi install /Users/jacob_1/opencode-agentic-commands
```

Then restart Pi or run `/reload`, and use:

```text
/goal Add JWT authentication with role-based access control
```

### GitHub

After pushing this repo to GitHub:

```bash
pi install git:github.com/YOUR_USER/opencode-agentic-commands
```

### npm

After publishing to npm:

```bash
pi install npm:opencode-agentic-commands
```

Pi prompt templates are static Markdown. To change the Pi `/goal` defaults, edit `pi/prompts/goal.md` or create a project-local `.pi/prompts/goal.md` that overrides it.

## Default Config

```json
{
  "plugin": [
    [
      "opencode-agentic-commands",
      {
        "goal": {
          "baroBackend": "opencode",
          "baroModel": "openai/gpt-5.3-codex-spark",
          "baroExtraArgs": ""
        },
        "autoresearch": {
          "programFile": "program.md",
          "mutableFiles": ["train.py"],
          "protectedFiles": ["prepare.py"],
          "setupCommand": "uv sync && uv run prepare.py",
          "experimentCommand": "uv run train.py",
          "metricName": "val_bpb",
          "metricDirection": "lower",
          "timeBudget": "5 minutes per experiment",
          "maxIterations": "until user budget/time limit or diminishing returns"
        },
        "autoagent": {
          "defaultMode": "opencode-native",
          "completionModel": "openai/gpt-5.3-codex-spark",
          "apiBaseUrl": "",
          "containerName": "deepresearch",
          "port": 12346,
          "gitClone": true,
          "testPullName": "autoagent_mirror",
          "allowToolCreation": true,
          "allowWorkflowCreation": true,
          "outputScope": "prefer project .opencode artifacts; use global artifacts only when explicitly requested"
        },
        "ultrawork": {
          "goalCommand": "/goal",
          "criticAgent": "code-reviewer",
          "maxGoalLoops": 20,
          "maxReviewLoops": 10,
          "preferSubagents": true,
          "maxParallelSubagents": 4,
          "completionStandard": "critic confirms no remaining required work, no unresolved risks, and no PR review findings"
        }
      }
    ]
  ]
}
```

## Individual Entrypoints

You can install only one command by using subpath exports:

```json
{
  "plugin": [
    ["opencode-agentic-commands/goal", { "baroModel": "openai/gpt-5.3-codex-spark" }],
    ["opencode-agentic-commands/autoresearch", { "experimentCommand": "uv run train.py" }],
    ["opencode-agentic-commands/autoagent", { "completionModel": "openai/gpt-5.3-codex-spark" }],
    ["opencode-agentic-commands/ultrawork", { "maxGoalLoops": 20 }]
  ]
}
```

## Notes

- Commands appear in the OpenCode TUI slash-command list after restart.
- No custom TUI screen is included; the TUI already exposes custom slash commands and descriptions.
- `/goal` defaults to using baro's OpenCode backend pointed at an OpenAI/Codex model: `baro --llm opencode -m openai/gpt-5.3-codex-spark "$ARGUMENTS"`.
- `/ultrawork` composes `/goal` loops with critic checks and a final PR-review loop. It prefers subagents for independent stories and review passes when safe, and should only claim completion when review finds no actionable findings.
- `/autoresearch` defaults mirror karpathy/autoresearch's `program.md`, `train.py`, `prepare.py`, `uv run train.py`, and `val_bpb` convention.
- `/autoagent` defaults to opencode-native artifacts and only references upstream AutoAgent CLI/container settings when explicitly requested.

## Test

```bash
npm test
```
