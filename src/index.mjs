import { GoalPlugin } from "./jarvis.mjs"
import { AutoresearchPlugin } from "./banner.mjs"
import { AutoagentPlugin } from "./fury.mjs"
import { UltraworkPlugin } from "./stark.mjs"
import { UltraplanPlugin } from "./strange.mjs"
import { UltrareviewPlugin } from "./watcher.mjs"
import { ThanosPlugin } from "./thanos.mjs"

const DEFAULT_OPTIONS = {
  jarvis: {},
  banner: {},
  fury: {},
  stark: {},
  strange: {},
  watcher: {},
  thanos: {},
  memory: {},
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
    await GoalPlugin(input, config.jarvis),
    await AutoresearchPlugin(input, config.banner),
    await AutoagentPlugin(input, config.fury),
    await UltraworkPlugin(input, config.stark),
    await UltraplanPlugin(input, config.strange),
    await UltrareviewPlugin(input, config.watcher),
    await ThanosPlugin(input, config.thanos),
  ]

  return {
    config(opencodeConfig) {
      applyMemoryConfig(opencodeConfig, config.memory)
      for (const hooks of hooksList) hooks.config?.(opencodeConfig)
    },
    "chat.message": chainHooks(hooksList, "chat.message"),
    "command.execute.before": chainHooks(hooksList, "command.execute.before"),
  }
}

export { GoalPlugin } from "./jarvis.mjs"
export { AutoresearchPlugin } from "./banner.mjs"
export { AutoagentPlugin } from "./fury.mjs"
export { UltraworkPlugin } from "./stark.mjs"
export { UltraplanPlugin } from "./strange.mjs"
export { UltrareviewPlugin } from "./watcher.mjs"
export { ThanosPlugin } from "./thanos.mjs"

export default AgenticCommandsPlugin
