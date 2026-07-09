#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { runBifrost } from "../src/bifrost.mjs"

const FORWARD_COMMANDS = new Set([
  "completion",
  "acp",
  "mcp",
  "run",
  "debug",
  "providers",
  "auth",
  "agent",
  "upgrade",
  "uninstall",
  "serve",
  "web",
  "models",
  "stats",
  "export",
  "import",
  "github",
  "pr",
  "session",
  "plugin",
  "plug",
  "db",
  "attach",
])

const args = process.argv.slice(2)
const opencode = process.env.HEIMDALL_OPENCODE_BIN || process.env.OPENCODE_BIN || "opencode"
const stateDir = process.env.BIFROST_STATE_DIR || ".opencode/bifrost"

function help() {
  return `heimdall [opencode tui args]

Starts/reuses a Bifrost-managed OpenCode Web backend, then attaches a terminal TUI to it.
All explicit OpenCode subcommands are forwarded unchanged to opencode.

Examples:
  heimdall
  heimdall -s ses_abc123
  heimdall /path/to/project
  heimdall run "explain this repo"`
}

function readState() {
  return JSON.parse(readFileSync(path.join(process.cwd(), stateDir, "state.json"), "utf8"))
}

function splitTuiArgs(input) {
  const attachArgs = []
  let projectDir = ""
  for (let i = 0; i < input.length; i += 1) {
    const arg = input[i]
    if (["-s", "--session", "-c", "--continue", "--fork"].includes(arg)) {
      attachArgs.push(arg)
      if (["-s", "--session"].includes(arg) && input[i + 1]) attachArgs.push(input[++i])
      continue
    }
    if (arg === "--dir" && input[i + 1]) {
      attachArgs.push(arg, input[++i])
      continue
    }
    if (!arg.startsWith("-") && !projectDir) {
      projectDir = arg
      continue
    }
    attachArgs.push(arg)
  }
  if (projectDir) attachArgs.push("--dir", projectDir)
  return attachArgs
}

function execOpencode(opencodeArgs) {
  execFileSync(opencode, opencodeArgs, { stdio: "inherit", env: process.env })
}

if (args.includes("--heimdall-help")) {
  console.log(help())
  process.exit(0)
}

if (args[0] && FORWARD_COMMANDS.has(args[0])) {
  execOpencode(args)
  process.exit(0)
}

const attachArgs = splitTuiArgs(args)
await runBifrost(
  { directory: process.cwd() },
  {
    stateDir,
    serverMode: "web",
    preferredTunnel: process.env.BIFROST_PREFERRED_TUNNEL || "cloudflared",
    fallbackTunnel: process.env.BIFROST_FALLBACK_TUNNEL || "ngrok",
    defaultHost: process.env.BIFROST_HOST || "127.0.0.1",
    startupTimeoutMs: Number(process.env.BIFROST_STARTUP_TIMEOUT_MS || 30000),
  },
  "start web",
  "",
)

const state = readState()
const finalArgs = ["attach", state.localUrl]
if (state.username) finalArgs.push("--username", state.username)
if (state.password) finalArgs.push("--password", state.password)
finalArgs.push(...attachArgs)
execOpencode(finalArgs)
