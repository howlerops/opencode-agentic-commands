# Installation

This guide is written for LLM agents helping a user install HowlerOps Valhalla (`@howlerops/valhalla`) for OpenCode and Pi. Use the deterministic checks and commands below instead of guessing from the website summary.

If you are an LLM agent, fetch this file as raw text when possible:

```bash
curl -fsSL https://raw.githubusercontent.com/howlerops/valhalla/refs/heads/main/docs/guide/installation.md
```

## What This Package Installs

HowlerOps Valhalla ships one command suite for two runtimes:

| Runtime | Install path | Lands on disk |
| --- | --- | --- |
| OpenCode | Install the GitHub package into `~/.config/opencode`, then run its installer | `~/.config/opencode/opencode.json`, `~/.config/opencode/package.json`, `~/.config/opencode/command/*.md` |
| Pi | `pi install git:github.com/howlerops/valhalla` | Pi package extension and prompt templates |
| Both | Run both installers | Same command names in both runtimes |

The command suite is `/hugin`, `/tyr`, `/munin`, `/eitri`, `/vidar`, `/skuld`, `/polaris`, and `/bifrost`.

## For Humans

Recommended: paste this prompt into an LLM agent session:

```text
Install and configure HowlerOps Valhalla by following the instructions here:
https://raw.githubusercontent.com/howlerops/valhalla/refs/heads/main/docs/guide/installation.md
```

Direct OpenCode install from GitHub:

```bash
npm install --prefix "$HOME/.config/opencode" github:howlerops/valhalla
node "$HOME/.config/opencode/node_modules/@howlerops/valhalla/scripts/install-opencode.mjs"
```

Direct Pi install:

```bash
pi install git:github.com/howlerops/valhalla
```

Restart OpenCode after installing or changing plugin config so slash-command discovery reloads.

## For LLM Agents

Follow these steps in order. Ask one concise question only if the user did not specify the target runtime and you cannot safely infer it.

### Step 0: Choose Runtime

Ask which runtime to install for when unknown:

```text
Which runtime do you want to install HowlerOps Valhalla for? Pick one:
1. OpenCode
2. Pi
3. Both
```

No subscription, provider, model, or authentication questions are required for this package. It installs commands and prompt templates only; model/provider configuration remains owned by OpenCode or Pi.

### Step 1: Check Prerequisites

For OpenCode:

```bash
if command -v opencode >/dev/null 2>&1; then
  opencode --version
else
  echo "OpenCode is not installed. Install it first: https://opencode.ai/docs"
fi
```

For Pi:

```bash
if command -v pi >/dev/null 2>&1; then
  pi --version
else
  echo "Pi is not installed or not on PATH. Install Pi first, then rerun this package install."
fi
```

If a required runtime is missing, report that prerequisite. Do not install unrelated global tools unless the user explicitly asks.

### Step 2: Install OpenCode Commands

Use the GitHub package installer:

```bash
npm install --prefix "$HOME/.config/opencode" github:howlerops/valhalla
node "$HOME/.config/opencode/node_modules/@howlerops/valhalla/scripts/install-opencode.mjs"
```

From a local checkout, run:

```bash
node scripts/install-opencode.mjs
```

After npm publication is available in the user environment, this shorter form is also valid:

```bash
npx @howlerops/valhalla@latest
```

The installer is idempotent. It:

- ensures `~/.config/opencode/opencode.json` contains the `@howlerops/valhalla` plugin entry,
- ensures `~/.config/opencode/package.json` depends on this package,
- runs `npm install --prefix ~/.config/opencode` when the package is not installed there,
- writes native slash command markdown files under `~/.config/opencode/command/`.

### Step 3: Install Pi Package

Use the GitHub package reference:

```bash
pi install git:github.com/howlerops/valhalla
```

From a local checkout, run:

```bash
pi install /absolute/path/to/valhalla
```

After npm publication is available in the user environment, this form is also valid:

```bash
pi install npm:@howlerops/valhalla
```

### Step 4: Verify OpenCode

Check the plugin entry and command files:

```bash
node -e 'const fs=require("fs"), os=require("os"), path=require("path"); const root=path.join(os.homedir(),".config","opencode"); const cfg=JSON.parse(fs.readFileSync(path.join(root,"opencode.json"),"utf8")); const has=(cfg.plugin||[]).some((entry)=>entry==="@howlerops/valhalla" || (Array.isArray(entry) && entry[0]==="@howlerops/valhalla")); if(!has) throw new Error("missing @howlerops/valhalla plugin"); for (const name of ["hugin","tyr","munin","eitri","vidar","skuld","polaris","bifrost"]) fs.accessSync(path.join(root,"command",`${name}.md`)); console.log("OpenCode commands installed")'
```

Then restart OpenCode and confirm slash commands are available in the TUI:

```text
/hugin Plan a small refactor
/polaris Ship a tiny documentation improvement end to end
```

### Step 5: Verify Pi

Confirm Pi can see the installed package, then smoke one command in a Pi session:

```bash
pi list
```

```text
/polaris Ship a tiny documentation improvement end to end
```

If `pi list` is unavailable in the installed Pi version, use Pi's package-management UI or help output to confirm the package is installed.

### Step 6: Explain First Use

After verification, tell the user:

1. Use `/hugin` when they want a plan before edits.
2. Use `/tyr` for one goal implemented end to end.
3. Use `/munin` for measurable prompt, command, skill, agent, or research optimization.
4. Use `/eitri` to create scoped OpenCode/Pi-native agents, workflows, commands, skills, or tools.
5. Use `/vidar` when the agent must keep looping implementation and review repair until complete.
6. Use `/skuld` for PR-style review and repair loops.
7. Use `/polaris` for the full path from context research through final review.
8. Use `/bifrost` only for the secure remote OpenCode portal workflow.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| OpenCode slash commands do not appear | Restart OpenCode. If still missing, rerun the GitHub package install and installer commands above to materialize native command files. |
| `npm install --prefix ~/.config/opencode` fails | Check npm/network output, then rerun the installer. The installer is idempotent. |
| Local checkout install writes `file:` dependency | Expected for `node scripts/install-opencode.mjs`; use `npx @howlerops/valhalla@latest` for package installs. |
| Pi command is missing | Re-run `pi install git:github.com/howlerops/valhalla` and restart the Pi session if required. |
| `/bifrost start` does not attach to the active TUI | Default `auto` mode falls back to a managed Web portal when active-server context is missing or stale, and reports the fallback reason. Configure Bifrost with `serverMode: "active"` when missing/stale active context should fail instead. |

## Uninstall

OpenCode removal is manual:

1. Remove the `@howlerops/valhalla` entry from `~/.config/opencode/opencode.json`.
2. Remove generated command files from `~/.config/opencode/command/` if desired.
3. Remove the dependency from `~/.config/opencode/package.json` and run `npm install --prefix ~/.config/opencode`.

For Pi, use the package removal command supported by the installed Pi version.
