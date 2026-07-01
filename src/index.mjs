import { TyrPlugin } from "./tyr.mjs"
import { MuninPlugin } from "./munin.mjs"
import { EitriPlugin } from "./eitri.mjs"
import { VidarPlugin } from "./vidar.mjs"
import { HuginPlugin } from "./hugin.mjs"
import { SkuldPlugin } from "./skuld.mjs"
import { PolarisPlugin } from "./polaris.mjs"
import { BifrostPlugin } from "./bifrost.mjs"

const DEFAULT_OPTIONS = {
  tyr: {},
  munin: {},
  eitri: {},
  vidar: {},
  hugin: {},
  skuld: {},
  polaris: {},
  bifrost: {},
  memory: {},
  modelFallback: {},
}

const DEFAULT_MODEL_FALLBACK_OPTIONS = {
  enabled: true,
  model: "",
  prefixes: ["anthropic/claude-3", "anthropic/claude-2", "anthropic/claude-instant"],
  models: [],
}

const DEFAULT_MEMORY_OPTIONS = {
  agentdb: {
    enabled: false,
    name: "agentdb",
    command: ["npx", "-y", "agentdb@latest", "mcp", "start"],
    dbPath: "",
    overwrite: false,
  },
  agentWisdom: {
    enabled: false,
    name: "agent-wisdom",
    command: [],
    root: "",
    dbPath: "",
    overwrite: false,
  },
}

function normalizeMemoryOptions(options = {}) {
  return {
    agentdb: { ...DEFAULT_MEMORY_OPTIONS.agentdb, ...(options.agentdb || {}) },
    agentWisdom: { ...DEFAULT_MEMORY_OPTIONS.agentWisdom, ...(options.agentWisdom || {}) },
  }
}

function normalizeModelFallbackOptions(options = {}) {
  return {
    ...DEFAULT_MODEL_FALLBACK_OPTIONS,
    ...options,
    prefixes: options.prefixes || DEFAULT_MODEL_FALLBACK_OPTIONS.prefixes,
    models: options.models || DEFAULT_MODEL_FALLBACK_OPTIONS.models,
  }
}

function shouldFallbackModel(model, options) {
  if (typeof model !== "string") return false
  if (options.models.includes(model)) return true
  return options.prefixes.some((prefix) => model.startsWith(prefix))
}

export function applyModelFallbackConfig(opencodeConfig, options = {}) {
  const fallback = normalizeModelFallbackOptions(options)
  if (!fallback.enabled || !opencodeConfig.agent) return

  const replacement = fallback.model || opencodeConfig.model
  if (!replacement) return

  for (const agent of Object.values(opencodeConfig.agent)) {
    if (!agent || typeof agent !== "object") continue
    if (shouldFallbackModel(agent.model, fallback)) agent.model = replacement
  }
}

function setMcp(config, name, value, overwrite) {
  config.mcp ||= {}
  if (!overwrite && config.mcp[name]) return
  config.mcp[name] = value
}

export function applyMemoryConfig(opencodeConfig, options = {}) {
  const memory = normalizeMemoryOptions(options)

  if (memory.agentdb.enabled) {
    const env = {}
    if (memory.agentdb.dbPath) env.AGENTDB_PATH = memory.agentdb.dbPath
    setMcp(
      opencodeConfig,
      memory.agentdb.name,
      {
        type: "local",
        command: memory.agentdb.command,
        ...(Object.keys(env).length ? { env } : {}),
        enabled: true,
      },
      memory.agentdb.overwrite,
    )
  }

  if (memory.agentWisdom.enabled) {
    const env = {}
    if (memory.agentWisdom.root) env.ODI_ROOT = memory.agentWisdom.root
    if (memory.agentWisdom.dbPath) env.ODI_AGENTDB_PATH = memory.agentWisdom.dbPath
    setMcp(
      opencodeConfig,
      memory.agentWisdom.name,
      {
        type: "local",
        command: memory.agentWisdom.command,
        ...(Object.keys(env).length ? { env } : {}),
        enabled: true,
      },
      memory.agentWisdom.overwrite,
    )
  }
}

function chainHooks(hooksList, hookName) {
  return async (input, output) => {
    for (const hooks of hooksList) {
      const hook = hooks[hookName]
      if (hook) await hook(input, output)
    }
  }
}

export async function AgenticCommandsPlugin(input, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const hooksList = [
    await TyrPlugin(input, config.tyr),
    await MuninPlugin(input, config.munin),
    await EitriPlugin(input, config.eitri),
    await VidarPlugin(input, config.vidar),
    await HuginPlugin(input, config.hugin),
    await SkuldPlugin(input, config.skuld),
    await PolarisPlugin(input, config.polaris),
    await BifrostPlugin(input, config.bifrost),
  ]

  return {
    config(opencodeConfig) {
      applyModelFallbackConfig(opencodeConfig, config.modelFallback)
      applyMemoryConfig(opencodeConfig, config.memory)
      for (const hooks of hooksList) hooks.config?.(opencodeConfig)
    },
    "chat.message": chainHooks(hooksList, "chat.message"),
    "command.execute.before": chainHooks(hooksList, "command.execute.before"),
  }
}

export { TyrPlugin } from "./tyr.mjs"
export { MuninPlugin } from "./munin.mjs"
export { EitriPlugin } from "./eitri.mjs"
export { VidarPlugin } from "./vidar.mjs"
export { HuginPlugin } from "./hugin.mjs"
export { SkuldPlugin } from "./skuld.mjs"
export { PolarisPlugin } from "./polaris.mjs"
export { BifrostPlugin } from "./bifrost.mjs"

export default AgenticCommandsPlugin
