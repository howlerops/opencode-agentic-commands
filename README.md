# opencode-agentic-commands

Agentic slash commands for OpenCode and Pi. The package adds a compact command suite for planning, execution, research, agent creation, persistent work loops, review, remote access, and full end-to-end orchestration.

The command names use a spelling-aware Norse/navigation theme so they are short, distinct, and less likely to collide with common dev tooling.

## Command Map

| Command | Role | Use When |
| --- | --- | --- |
| `/hugin` | Plan | You need deep context research, a dependency-aware plan, risks, verification, and review gates before editing. |
| `/tyr` | Execute | You want one goal implemented end to end with architecture, story breakdown, verification, critic repair, and summary. |
| `/munin` | Research | You need an experiment loop with baseline, hypothesis, metric, keep/discard decisions, and a ledger. |
| `/eitri` | Create | You want opencode-native agents, workflows, commands, skills, or tools derived from natural language. |
| `/vidar` | Persist | You want repeated `/tyr` implementation loops plus review repair loops until the work is complete. |
| `/skuld` | Review | You want PR-style review, targeted repair, re-verification, and repeated review until clean. |
| `/polaris` | Orchestrate | You want the whole flow: plan, create agents if needed, research, implement, review, and repair. |
| `/bifrost` | Remote | You want to start, inspect, or stop a secure remote portal to the active OpenCode server with a tunnel. |

`/bifrost` is intentionally separate from `/polaris` and the implementation/review loops. It manages remote access only; the other commands do not depend on it.

## Bifrost Remote Portal

`/bifrost` starts or manages an OpenCode remote portal plus a public tunnel through an action-first OpenCode command. In Pi, it provides the same operational workflow as a prompt template.

- `/bifrost` or `/bifrost start` requires the active OpenCode server behind the current TUI, places a Bifrost-managed authenticated local proxy in front of it, exposes that proxy through Cloudflare Quick Tunnel by default, and opens the current-session deep link when available.
- If the active server is unavailable, `/bifrost start` fails loudly instead of starting a separate non-syncing Web server. Use `/bifrost start web` only when you explicitly want a separate browser portal without TUI/Web live sync.
- `/bifrost status` reports known local server, tunnel, URL, username, password, current TUI session URL when available, direct recent-session URLs, live TUI control commands, PID, state, and log information.
- `/bifrost sync` is a status-focused diagnostic view for Web/TUI synchronization. It verifies the event stream when possible and explains that Web session URLs open browser history while the official live-control path for the active local TUI is the `/tui/*` API.
- `/bifrost stop` stops only the selected Bifrost-managed tunnel and any Bifrost-managed OpenCode Web process. It does not stop an active TUI server that Bifrost only attached to.

The workflow prefers `cloudflared tunnel --url http://127.0.0.1:<port>` and falls back to `ngrok http http://127.0.0.1:<port>` when Cloudflare is unavailable. Active-server mode does not require restarting OpenCode with `OPENCODE_SERVER_PASSWORD`: Bifrost generates a temporary portal password at the proxy layer when needed, forwards to the active server, and keeps Web and TUI attached to one OpenCode server. Explicit Web mode (`/bifrost start web`) generates a temporary password when needed, binds OpenCode Web to `127.0.0.1` by default, and prints the public URL, username, password, recent session URLs, TUI control API commands, attach command, logs, and stop command in the terminal output. The default username is `opencode` unless `OPENCODE_SERVER_USERNAME` is set.

OpenCode Web session URLs are browser-history views. Remote prompts submitted through Web are written to the OpenCode session and are observable on `/event`, but SSE events do not include the originating client. Bifrost therefore does not auto-relay Web prompts into `/tui/submit-prompt`, because doing so would duplicate messages. For live remote control of the local TUI, use the printed `/tui/append-prompt`, `/tui/submit-prompt`, `/tui/clear-prompt`, and `/event` commands.

## GitHub PR Review Mode

`/skuld` has an explicit GitHub PR review path. When the target is a PR URL, PR number, or branch with a clear GitHub repository, it should:

- Fetch PR metadata first with `gh` so it knows the base branch, head branch, head SHA, changed files, and CI status.
- Use the current checkout when it is already the target repo on the PR head branch or SHA.
- Create a temporary clone or worktree only when the current directory is not the target repo, is on the wrong branch/SHA, has conflicting local changes, or cannot inspect the PR safely in place.
- Confirm every finding against source before posting; do not post from a diff hunch alone.
- Prefer one grouped GitHub review with inline comments via `gh api pulls/{number}/reviews`.
- Clean up temporary clones, worktrees, and payload files before reporting unless asked to keep them.

If a review subagent fails because its configured model is unavailable, `/skuld` should retry with an available/current active model when tooling supports that. If it cannot retry, it should continue the review manually in the current session rather than stopping.

## Model Fallback

Imported agent packs often pin deprecated provider-specific models such as old `anthropic/claude-3-*` IDs. By default, the bundled plugin rewrites those legacy agent model pins to the current active OpenCode `model` during config load so subagents do not fail before doing work.

Override the replacement model or disable the behavior:

```json
{
  "plugin": [
    [
      "opencode-agentic-commands",
      {
        "modelFallback": {
          "enabled": true,
          "model": "openai/gpt-5.5",
          "prefixes": ["anthropic/claude-3", "anthropic/claude-2", "anthropic/claude-instant"],
          "models": []
        }
      }
    ]
  ]
}
```

Leave `model` empty to use the active OpenCode `model` value.

## Quick Start

Recommended agent-assisted install, matching the omo.dev-style path:

```text
Install and configure opencode-agentic-commands by following the instructions here:
https://raw.githubusercontent.com/howlerops/opencode-agentic-commands/refs/heads/main/docs/guide/installation.md
```

The raw guide gives an LLM agent the runtime choice, prerequisite checks, deterministic install commands, verification steps, first-use tutorial, troubleshooting, and uninstall notes.

Recommended OpenCode install from GitHub:

```bash
npm install --prefix "$HOME/.config/opencode" github:howlerops/opencode-agentic-commands
node "$HOME/.config/opencode/node_modules/opencode-agentic-commands/scripts/install-opencode.mjs"
```

Installer from a local checkout:

```bash
node scripts/install-opencode.mjs
```

Or, after npm publication is available and the package is installed into an npm prefix:

```bash
opencode-agentic-commands
```

The installer:

- updates `~/.config/opencode/opencode.json` with the plugin entry,
- ensures `~/.config/opencode/package.json` depends on this package,
- writes native slash command files to `~/.config/opencode/command/*.md` so OpenCode command discovery shows `/hugin`, `/tyr`, `/munin`, `/eitri`, `/vidar`, `/skuld`, `/polaris`, and `/bifrost` reliably.

Restart OpenCode after running the installer.

Full installation guide: [`docs/guide/installation.md`](docs/guide/installation.md).

## Manual Plugin Config

Install from a local checkout in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/Users/jacob_1/opencode-agentic-commands", {}]
  ]
}
```

Restart OpenCode, then run:

```text
/hugin Plan the checkout redesign
/tyr Add JWT authentication with role-based access control
/munin Improve command prompt quality with before and after smoke checks
/eitri Create a focused migration-review agent
/vidar Finish the billing integration until review is clean
/skuld current diff
/polaris Ship the onboarding workflow end to end
/bifrost start
```

## Install From GitHub

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["github:howlerops/opencode-agentic-commands", {}]
  ]
}
```

OpenCode loads plugin and command config at startup, so quit and restart after changing settings. If slash commands do not appear from plugin config alone, run the installer above to materialize native command files.

## Install From npm

After publishing to npm:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["opencode-agentic-commands", {}]
  ]
}
```

## Pi Support

The package includes a Pi extension and matching prompt templates.

Install locally:

```bash
pi install /Users/jacob_1/opencode-agentic-commands
```

Install from GitHub:

```bash
pi install git:github.com/howlerops/opencode-agentic-commands
```

Install from npm after publishing:

```bash
pi install npm:opencode-agentic-commands
```

Pi loads commands from `pi/extensions/agentic-commands.js` and prompt templates from `pi/prompts/`.

The GitHub Pages site is shared by OpenCode and Pi on purpose. Both runtimes install from the same package and expose the same command set, so one landing page avoids divergent docs. Add a distinct Pi-specific web view only if Pi later needs marketplace-only assets, screenshots, or install metadata that would make the shared page unclear.

## Pages And Hooks

GitHub Pages deploys from `docs/` on every push to `main` and can also be run manually from Actions.

Install the local advisory hook to remind you to update `README.md` and `docs/index.html` before pushing package-facing changes:

```bash
npm run install:hooks
```

The hook warns when `src/`, `pi/`, or package metadata changed without a docs or README change. It does not block the push.

## Default Config

All options are optional. This block shows the defaults and the new command keys.

```json
{
  "plugin": [
    [
      "opencode-agentic-commands",
      {
        "hugin": {
          "maxParallelSubagents": 4,
          "outputArtifact": "conversation plan; create a repo file only when the user asks",
          "verificationStandard": "plan is reviewed for feasibility, dependency order, risks, and test coverage before implementation starts"
        },
        "tyr": {
          "baroBackend": "opencode",
          "baroModel": "openai/gpt-5.3-codex-spark",
          "baroExtraArgs": ""
        },
        "munin": {
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
        "eitri": {
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
        "vidar": {
          "goalCommand": "/tyr",
          "criticAgent": "code-reviewer",
          "maxGoalLoops": 20,
          "maxReviewLoops": 10,
          "preferSubagents": true,
          "maxParallelSubagents": 4,
          "completionStandard": "critic confirms no remaining required work, no unresolved risks, and no PR review findings"
        },
        "skuld": {
          "reviewerAgent": "code-reviewer",
          "goalCommand": "/tyr",
          "maxReviewLoops": 10,
          "preferSubagents": true,
          "maxParallelSubagents": 4,
          "completionStandard": "review finds no actionable bugs, regressions, missing required tests, or unresolved risks"
        },
        "polaris": {
          "planCommand": "/hugin",
          "goalCommand": "/tyr",
          "agentCommand": "/eitri",
          "researchCommand": "/munin",
          "workCommand": "/vidar",
          "reviewCommand": "/skuld",
          "maxOrchestrationLoops": 20,
          "completionStandard": "plan, implementation, research optimization, and review all agree there is no remaining required work"
        },
        "bifrost": {
          "preferredTunnel": "cloudflared",
          "fallbackTunnel": "ngrok",
          "serverMode": "auto",
          "stateDir": ".opencode/bifrost",
          "defaultHost": "127.0.0.1"
        },
        "modelFallback": {
          "enabled": true,
          "model": "",
          "prefixes": ["anthropic/claude-3", "anthropic/claude-2", "anthropic/claude-instant"],
          "models": []
        }
      }
    ]
  ]
}
```

## Individual Entrypoints

Use subpath exports when you only want one command.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["opencode-agentic-commands/hugin", { "maxParallelSubagents": 4 }],
    ["opencode-agentic-commands/tyr", { "baroModel": "openai/gpt-5.3-codex-spark" }],
    ["opencode-agentic-commands/munin", { "experimentCommand": "uv run train.py" }],
    ["opencode-agentic-commands/eitri", { "completionModel": "openai/gpt-5.3-codex-spark" }],
    ["opencode-agentic-commands/vidar", { "maxGoalLoops": 20 }],
    ["opencode-agentic-commands/skuld", { "maxReviewLoops": 10 }],
    ["opencode-agentic-commands/polaris", { "maxOrchestrationLoops": 20 }],
    ["opencode-agentic-commands/bifrost", { "stateDir": ".opencode/bifrost" }]
  ]
}
```

## Optional Memory

Memory is explicit opt-in config. This package does not install, start, or require AgentDB or Agent Wisdom by default.

```json
{
  "plugin": [
    [
      "opencode-agentic-commands",
      {
        "memory": {
          "agentdb": {
            "enabled": true,
            "dbPath": "/absolute/path/to/agentdb.rvf"
          },
          "agentWisdom": {
            "enabled": true,
            "name": "odi-agent-wisdom",
            "command": ["node", "/absolute/path/to/agent-wisdom.mjs", "mcp"],
            "root": "/absolute/path/to/repo-root",
            "dbPath": "/absolute/path/to/wisdom.rvf"
          }
        }
      }
    ]
  ]
}
```

When `memory.agentdb.enabled` is true, the plugin adds an OpenCode MCP entry using `npx -y agentdb@latest mcp start`. Existing `mcp.agentdb` entries are preserved unless `memory.agentdb.overwrite` is true.

Commands that do context research, especially `/hugin`, `/vidar`, `/munin`, and `/polaris`, should use AgentDB MCP/tools, Agent Wisdom, or the `agentdb` CLI when they are already available. If they are unavailable, commands skip them quietly and continue from repo sources.

Pi package startup never auto-starts long-lived memory resources. Start those through your harness MCP config, a project-local extension, or an explicit user command when needed.

## Design Notes

| Name | Source | Why It Fits |
| --- | --- | --- |
| Hugin | Norse thought raven | Plans from broad context and turns facts into structure. |
| Tyr | Norse god associated with decisive action | Executes one goal with discipline. |
| Munin | Norse memory raven | Researches, compares, records, and learns. |
| Eitri | Norse smith | Crafts agents, workflows, and tools. |
| Vidar | Norse figure associated with resolve | Keeps working until the task is actually complete. |
| Skuld | Norse Norn tied to what is owed or must become | Reviews consequences, risks, and remaining obligations. |
| Polaris | North Star | Guides the whole journey end to end. |
| Bifrost | Norse bridge between worlds | Opens a controlled remote path to the active OpenCode server; explicit Web mode is separate and non-syncing. |

## Test

```bash
npm test
```

Additional release checks used for this package:

```bash
node --check pi/extensions/agentic-commands.js
npm pack --dry-run
```
