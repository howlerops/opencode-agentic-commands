import { GoalPlugin } from "./goal.mjs"
import { AutoresearchPlugin } from "./autoresearch.mjs"
import { AutoagentPlugin } from "./autoagent.mjs"
import { UltraworkPlugin } from "./ultrawork.mjs"
import { UltraplanPlugin } from "./ultraplan.mjs"
import { UltrareviewPlugin } from "./ultrareview.mjs"
import { ThanosPlugin } from "./thanos.mjs"

const DEFAULT_OPTIONS = {
  goal: {},
  autoresearch: {},
  autoagent: {},
  ultrawork: {},
  ultraplan: {},
  ultrareview: {},
  thanos: {},
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
    await GoalPlugin(input, config.goal),
    await AutoresearchPlugin(input, config.autoresearch),
    await AutoagentPlugin(input, config.autoagent),
    await UltraworkPlugin(input, config.ultrawork),
    await UltraplanPlugin(input, config.ultraplan),
    await UltrareviewPlugin(input, config.ultrareview),
    await ThanosPlugin(input, config.thanos),
  ]

  return {
    config(opencodeConfig) {
      for (const hooks of hooksList) hooks.config?.(opencodeConfig)
    },
    "chat.message": chainHooks(hooksList, "chat.message"),
    "command.execute.before": chainHooks(hooksList, "command.execute.before"),
  }
}

export { GoalPlugin } from "./goal.mjs"
export { AutoresearchPlugin } from "./autoresearch.mjs"
export { AutoagentPlugin } from "./autoagent.mjs"
export { UltraworkPlugin } from "./ultrawork.mjs"
export { UltraplanPlugin } from "./ultraplan.mjs"
export { UltrareviewPlugin } from "./ultrareview.mjs"
export { ThanosPlugin } from "./thanos.mjs"

export default AgenticCommandsPlugin
