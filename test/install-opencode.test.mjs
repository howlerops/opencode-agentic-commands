import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dirname, "..")
const temp = await mkdtemp(path.join(tmpdir(), "opencode-agentic-install-"))

try {
  await mkdir(path.join(temp, "node_modules", "opencode-agentic-commands"), { recursive: true })
  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(repoRoot, "scripts", "install-opencode.mjs")],
      { env: { ...process.env, OPENCODE_CONFIG_DIR: temp } },
      (error, stdout, stderr) => error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr }),
    )
  })

  const config = JSON.parse(await readFile(path.join(temp, "opencode.json"), "utf8"))
  assert.deepEqual(config.plugin, [["opencode-agentic-commands", {}]])

  for (const name of ["hugin", "tyr", "munin", "eitri", "vidar", "skuld", "polaris", "bifrost"]) {
    const command = await readFile(path.join(temp, "command", `${name}.md`), "utf8")
    assert.match(command, /^---\ndescription: /)
    assert.match(command, /\$ARGUMENTS|BIFROST_PLUGIN_ACTIVE_SERVER_URL|Run this task|Create a Hugin|Run this goal|Return this Bifrost/s)
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
