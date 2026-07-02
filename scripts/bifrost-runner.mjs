#!/usr/bin/env node
import BifrostPlugin from "../src/bifrost.mjs"

const options = {}
const args = []
let sessionID = process.env.BIFROST_SESSION_ID || ""
let activeServerUrl = ""

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
  const hooks = await BifrostPlugin({ directory: process.cwd(), serverUrl: activeServerUrl }, options)
  const output = { parts: [] }
  await hooks["command.execute.before"]({ command: "bifrost", sessionID, arguments: args.join(" ") }, output)
  console.log(output.parts[0]?.text || "Bifrost finished without output.")
} catch (error) {
  console.error(`Bifrost failed: ${error?.message || error}`)
  process.exitCode = 1
}
