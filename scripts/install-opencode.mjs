#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AgenticCommandsPlugin } from "../src/index.mjs"

const PACKAGE_NAME = "@howlerops/valhalla"
const OLD_PACKAGE_NAME = "opencode-agentic-commands"
const PACKAGE_ALIASES = [PACKAGE_NAME, OLD_PACKAGE_NAME]
const CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR || path.join(homedir(), ".config", "opencode")
const CONFIG_PATH = process.env.OPENCODE_CONFIG_PATH || path.join(CONFIG_DIR, "opencode.json")
const COMMAND_DIR = process.env.OPENCODE_COMMAND_DIR || path.join(CONFIG_DIR, "command")
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PACKAGE_JSON = readJson(path.join(PACKAGE_ROOT, "package.json"), { version: "" })

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
  if (PACKAGE_ALIASES.includes(entry)) return true
  if (Array.isArray(entry) && PACKAGE_ALIASES.includes(entry[0])) return true
  return false
}

function normalizePluginEntry(entry) {
  if (entry === OLD_PACKAGE_NAME) return PACKAGE_NAME
  if (Array.isArray(entry) && entry[0] === OLD_PACKAGE_NAME) return [PACKAGE_NAME, ...entry.slice(1)]
  return entry
}

function hasOptions(entry) {
  return Array.isArray(entry) && entry.length > 1 && Object.keys(entry[1] || {}).length > 0
}

function dedupePluginEntries(entries) {
  const deduped = []
  let packageIndex = -1
  for (const entry of entries.map(normalizePluginEntry)) {
    if (!hasPluginEntry(entry)) {
      deduped.push(entry)
      continue
    }
    if (packageIndex === -1) {
      packageIndex = deduped.push(entry) - 1
      continue
    }
    if (hasOptions(entry) && !hasOptions(deduped[packageIndex])) deduped[packageIndex] = entry
  }
  return deduped
}

function ensurePluginConfig() {
  const config = readJson(CONFIG_PATH, { $schema: "https://opencode.ai/config.json" })
  config.$schema ||= "https://opencode.ai/config.json"
  config.plugin = Array.isArray(config.plugin) ? config.plugin : []
  config.plugin = dedupePluginEntries(config.plugin)
  if (!config.plugin.some(hasPluginEntry)) config.plugin.push([PACKAGE_NAME, {}])
  writeJson(CONFIG_PATH, config)
}

function packageDependencySpec() {
  const installedUnderNodeModules = path.basename(PACKAGE_ROOT) === "valhalla" && path.basename(path.dirname(PACKAGE_ROOT)) === "@howlerops" && path.basename(path.dirname(path.dirname(PACKAGE_ROOT))) === "node_modules"
  if (installedUnderNodeModules && PACKAGE_JSON.version) return PACKAGE_JSON.version
  return `file:${PACKAGE_ROOT}`
}

function ensurePackageDependency() {
  const packagePath = path.join(CONFIG_DIR, "package.json")
  const pkg = readJson(packagePath, { dependencies: {} })
  pkg.dependencies ||= {}
  const hadOldDependency = OLD_PACKAGE_NAME in pkg.dependencies
  delete pkg.dependencies[OLD_PACKAGE_NAME]
  if (!pkg.dependencies[PACKAGE_NAME]) {
    pkg.dependencies[PACKAGE_NAME] = packageDependencySpec()
    writeJson(packagePath, pkg)
  } else if (hadOldDependency) {
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
