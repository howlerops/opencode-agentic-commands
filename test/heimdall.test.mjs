import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const repoRoot = new URL("..", import.meta.url).pathname
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

assert.equal(pkg.bin.heimdall, "./scripts/heimdall.mjs")
assert.equal(pkg.bin["opencode-heimdall"], "./scripts/heimdall.mjs")

async function writeFakeOpencode(binDir, logPath) {
  await mkdir(binDir, { recursive: true })
  const fake = path.join(binDir, "opencode")
  await writeFile(fake, `#!/usr/bin/env node
const { appendFileSync } = require("node:fs")
const { createServer } = require("node:http")
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + "\\n")
if (process.argv[2] === "web") {
  const port = Number(process.argv[process.argv.indexOf("--port") + 1])
  const host = process.argv[process.argv.indexOf("--hostname") + 1] || "127.0.0.1"
  createServer((request, response) => {
    if (request.url === "/session") {
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify([{ id: "ses_fake", directory: process.cwd(), title: "Fake", time: { updated: 1 } }]))
      return
    }
    response.end("ok")
  }).listen(port, host)
  return
}
process.exit(0)
`)
  await chmod(fake, 0o755)
  return fake
}

{
  const temp = await mkdtemp(path.join(tmpdir(), "heimdall-pass-through-"))
  try {
    const log = path.join(temp, "opencode.log")
    const bin = path.join(temp, "bin")
    await writeFakeOpencode(bin, log)
    execFileSync(process.execPath, [path.join(repoRoot, "scripts", "heimdall.mjs"), "models", "openai"], {
      cwd: temp,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    assert.deepEqual(JSON.parse((await readFile(log, "utf8")).trim()), ["models", "openai"])
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

{
  const temp = await mkdtemp(path.join(tmpdir(), "heimdall-attach-"))
  try {
    const log = path.join(temp, "opencode.log")
    const bin = path.join(temp, "bin")
    await writeFakeOpencode(bin, log)
    execFileSync(process.execPath, [path.join(repoRoot, "scripts", "heimdall.mjs"), "-s", "ses_fake"], {
      cwd: temp,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BIFROST_PREFERRED_TUNNEL: "true", BIFROST_STARTUP_TIMEOUT_MS: "3000" },
    })
    const calls = (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line))
    assert.equal(calls[0][0], "web")
    assert.equal(calls[1][0], "attach")
    assert.match(calls[1][1], /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.ok(calls[1].includes("--username"))
    assert.ok(calls[1].includes("--password"))
    assert.deepEqual(calls.slice(1)[0].slice(-2), ["-s", "ses_fake"])
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

console.log("heimdall tests passed")
