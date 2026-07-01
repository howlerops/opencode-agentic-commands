# opencode-agentic-commands

OpenCode plugin package and Pi package that adds agentic slash commands/prompts:

- `/goal` - baro-style end-to-end repo execution with architecture, story DAG, critic loop, and final verification.
- `/autoresearch` - karpathy/autoresearch-style experiment loop with baseline, metric tracking, keep/discard decisions, and an experiment ledger.
- `/autoagent` - AutoAgent-style natural-language agent/workflow creation using opencode-native artifacts.
- `/ultrawork` - repeated `/goal` implementation loops plus PR-review repair loops until a critic finds nothing left.
- `/ultraplan` - anchor planning with extensive context research, story DAGs, parallel lanes, risks, and review gates before implementation.
- `/ultrareview` - repeated PR-style review and repair loops until no actionable findings remain.
- `/thanos` - top-level E2E orchestrator that composes `/ultraplan`, `/goal`, `/autoagent`, `/autoresearch`, `/ultrawork`, and `/ultrareview`.

For Pi, the package exposes all seven commands as Pi extensions and prompt templates.

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

Pi loads this repo as a Pi package through the `pi.extensions` and `pi.prompts` manifests in `package.json`.

The Pi extension registers these slash commands directly:

- `/goal`
- `/autoresearch`
- `/autoagent`
- `/ultrawork`
- `/ultraplan`
- `/ultrareview`
- `/thanos`

The prompt templates in `pi/prompts/` provide static fallbacks for the same command names and make the workflows browsable/configurable as plain Markdown.

### Local path

```bash
pi install /Users/jacob_1/opencode-agentic-commands
```

Then restart Pi or run `/reload`, and use:

```text
/goal Add JWT authentication with role-based access control
/ultrawork Finish the checkout flow until review is clean
/ultrareview current diff
/thanos Ship the billing integration end to end
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

Pi extension commands are loaded from `pi/extensions/agentic-commands.js`. Prompt templates are static Markdown. To change prompt defaults, edit files in `pi/prompts/` or create project-local `.pi/prompts/<command>.md` files that override them.

### Optional AgentDB Memory

This package declares `agentdb` as an optional dependency so Pi/npm/git installs can make the CLI available without making memory a hard requirement.

Use AgentDB as an optional recall/store layer:

```bash
npx agentdb@latest mcp start
```

Commands that do context research (`/ultraplan`, `/ultrawork`, `/autoresearch`) should use AgentDB MCP/tools, Agent Wisdom, or the `agentdb` CLI when they are already available. If they are unavailable, the commands should skip them quietly and continue from repo sources. Optional memory must not become a blocker or create repeated "unavailable" narration.

Pi extension docs explicitly warn against starting long-lived resources in extension factory startup, so this package does not auto-start AgentDB. Start it through your agent harness MCP config, a project-local extension, or an explicit user command.

### Pi Package Manifest

```json
{
  "pi": {
    "extensions": ["./pi/extensions"],
    "prompts": ["./pi/prompts"]
  }
}
```

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
        },
        "ultraplan": {
          "maxParallelSubagents": 4,
          "outputArtifact": "conversation plan; create a repo file only when the user asks",
          "verificationStandard": "plan is reviewed for feasibility, dependency order, risks, and test coverage before implementation starts"
        },
        "ultrareview": {
          "reviewerAgent": "code-reviewer",
          "goalCommand": "/goal",
          "maxReviewLoops": 10,
          "preferSubagents": true,
          "maxParallelSubagents": 4,
          "completionStandard": "review finds no actionable bugs, regressions, missing required tests, or unresolved risks"
        },
        "thanos": {
          "planCommand": "/ultraplan",
          "goalCommand": "/goal",
          "agentCommand": "/autoagent",
          "researchCommand": "/autoresearch",
          "workCommand": "/ultrawork",
          "reviewCommand": "/ultrareview",
          "maxOrchestrationLoops": 20,
          "completionStandard": "plan, implementation, research optimization, and review all agree there is no remaining required work"
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
    ["opencode-agentic-commands/ultrawork", { "maxGoalLoops": 20 }],
    ["opencode-agentic-commands/ultraplan", { "maxParallelSubagents": 4 }],
    ["opencode-agentic-commands/ultrareview", { "maxReviewLoops": 10 }],
    ["opencode-agentic-commands/thanos", { "maxOrchestrationLoops": 20 }]
  ]
}
```

## Notes

- Commands appear in the OpenCode TUI slash-command list after restart.
- No custom TUI screen is included; the TUI already exposes custom slash commands and descriptions.
- `/goal` defaults to using baro's OpenCode backend pointed at an OpenAI/Codex model: `baro --llm opencode -m openai/gpt-5.3-codex-spark "$ARGUMENTS"`.
- `/ultrawork` composes `/goal` loops with critic checks and a final PR-review loop. It starts with a context research dossier and anchor plan, keeps that plan current through every loop, and should only stop before completion for a concrete blocker it cannot resolve.
- `/ultraplan` is intentionally non-mutating by default: it performs extensive context research, produces a self-contained anchor plan, reviews the plan, and recommends the first execution command.
- `/ultrareview` can be used standalone against a worktree diff, branch, PR, commit range, or described target. It loops review, targeted repair, and verification until clean.
- `/autoresearch` defaults mirror karpathy/autoresearch's `program.md`, `train.py`, `prepare.py`, `uv run train.py`, and `val_bpb` convention. For commands, skills, extensions, and prompts, it should define repeatable outcome tests before editing: expansion invariants, package load checks, command registration checks, prompt regression assertions, and before/after smoke comparisons where feasible.
- `/autoagent` defaults to opencode-native artifacts and only references upstream AutoAgent CLI/container settings when explicitly requested.
- `/thanos` is the highest-level orchestrator. Use it when the task should be carried from context research and planning through agent/workflow design, measurable optimization, implementation, final review, and repair.
- In Pi, `pi/extensions/agentic-commands.js` registers all seven commands and `pi/prompts/` ships matching prompt templates.

## Test

```bash
npm test
```
