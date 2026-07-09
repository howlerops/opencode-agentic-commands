#!/usr/bin/env node
import { runBifrost } from "../src/bifrost.mjs"

const options = {}
const args = []
let sessionID = process.env.BIFROST_SESSION_ID || ""
let activeServerUrl = process.env.BIFROST_PLUGIN_ACTIVE_SERVER_URL || process.env.BIFROST_ACTIVE_SERVER_URL || ""

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (arg === "--") {
    args.push(...process.argv.slice(i + 1))
    break
  }
  if (arg === "--state-dir") options.stateDir = process.argv[++i]
  else if (arg === "--host") options.defaultHost = process.argv[++i]
  else if (arg === "--preferred-tunnel") options.preferredTunnel = process.argv[++i]
  else if (arg === "--fallback-tunnel") options.fallbackTunnel = process.argv[++i]
  else if (arg === "--server-mode") options.serverMode = process.argv[++i]
  else if (arg === "--startup-timeout-ms") options.startupTimeoutMs = Number(process.argv[++i])
  else if (arg === "--session-id") sessionID = process.argv[++i]
  else if (arg === "--active-server-url") activeServerUrl = process.argv[++i]
  else args.push(arg)
}

try {
  console.log(await runBifrost({ directory: process.cwd(), serverUrl: activeServerUrl }, options, args.join(" "), sessionID))
} catch (error) {
  console.error(`Bifrost failed: ${error?.message || error}`)
  process.exitCode = 1
}
