import { TyrPlugin } from "./tyr.mjs"
import { MuninPlugin } from "./munin.mjs"
import { EitriPlugin } from "./eitri.mjs"
import { VidarPlugin } from "./vidar.mjs"
import { HuginPlugin } from "./hugin.mjs"
import { SkuldPlugin } from "./skuld.mjs"
import { PolarisPlugin } from "./polaris.mjs"

const DEFAULT_OPTIONS = {
  tyr: {},
  munin: {},
  eitri: {},
  vidar: {},
  hugin: {},
  skuld: {},
  polaris: {},
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
    await TyrPlugin(input, config.tyr),
    await MuninPlugin(input, config.munin),
    await EitriPlugin(input, config.eitri),
    await VidarPlugin(input, config.vidar),
    await HuginPlugin(input, config.hugin),
    await SkuldPlugin(input, config.skuld),
    await PolarisPlugin(input, config.polaris),
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

export { TyrPlugin } from "./tyr.mjs"
export { MuninPlugin } from "./munin.mjs"
export { EitriPlugin } from "./eitri.mjs"
export { VidarPlugin } from "./vidar.mjs"
export { HuginPlugin } from "./hugin.mjs"
export { SkuldPlugin } from "./skuld.mjs"
export { PolarisPlugin } from "./polaris.mjs"

export default AgenticCommandsPlugin
