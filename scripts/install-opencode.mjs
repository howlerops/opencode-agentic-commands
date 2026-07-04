#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AgenticCommandsPlugin } from "../src/index.mjs"

const PACKAGE_NAME = "opencode-agentic-commands"
const CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR || path.join(homedir(), ".config", "opencode")
const CONFIG_PATH = process.env.OPENCODE_CONFIG_PATH || path.join(CONFIG_DIR, "opencode.json")
const COMMAND_DIR = process.env.OPENCODE_COMMAND_DIR || path.join(CONFIG_DIR, "command")
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") return fallback
    throw error
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function hasPluginEntry(entry) {
  if (entry === PACKAGE_NAME) return true
  if (Array.isArray(entry) && entry[0] === PACKAGE_NAME) return true
  return false
}

function ensurePluginConfig() {
  const config = readJson(CONFIG_PATH, { $schema: "https://opencode.ai/config.json" })
  config.$schema ||= "https://opencode.ai/config.json"
  config.plugin = Array.isArray(config.plugin) ? config.plugin : []
  if (!config.plugin.some(hasPluginEntry)) config.plugin.push([PACKAGE_NAME, {}])
  writeJson(CONFIG_PATH, config)
}

function ensurePackageDependency() {
  const packagePath = path.join(CONFIG_DIR, "package.json")
  const pkg = readJson(packagePath, { dependencies: {} })
  pkg.dependencies ||= {}
  if (!pkg.dependencies[PACKAGE_NAME]) {
    pkg.dependencies[PACKAGE_NAME] = `file:${PACKAGE_ROOT}`
    writeJson(packagePath, pkg)
  }

  if (!existsSync(path.join(CONFIG_DIR, "node_modules", PACKAGE_NAME))) {
    execFileSync("npm", ["install", "--prefix", CONFIG_DIR], { stdio: "inherit" })
  }
}

function commandMarkdown(command) {
  const frontmatter = [
    "---",
    `description: ${JSON.stringify(command.description || "Agentic command")}`,
    command.agent ? `agent: ${command.agent}` : "",
    command.model ? `model: ${command.model}` : "",
    "---",
  ].filter(Boolean).join("\n")
  return `${frontmatter}\n\n${command.template}\n`
}

async function writeNativeCommands() {
  const hooks = await AgenticCommandsPlugin({}, {})
  const config = { command: {} }
  await hooks.config(config)
  mkdirSync(COMMAND_DIR, { recursive: true })
  for (const [name, command] of Object.entries(config.command)) {
    writeFileSync(path.join(COMMAND_DIR, `${name}.md`), commandMarkdown(command))
  }
  return Object.keys(config.command).sort()
}

ensurePluginConfig()
ensurePackageDependency()
const commands = await writeNativeCommands()

console.log(`Installed ${commands.length} OpenCode agentic commands:`)
for (const name of commands) console.log(`- /${name}`)
console.log(`Config: ${CONFIG_PATH}`)
console.log(`Commands: ${COMMAND_DIR}`)
console.log("Restart OpenCode for slash-command discovery to reload.")
