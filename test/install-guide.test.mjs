import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const guide = await readFile(new URL("../docs/guide/installation.md", import.meta.url), "utf8")
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")
const docs = await readFile(new URL("../docs/index.html", import.meta.url), "utf8")
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

const rawUrl = "https://raw.githubusercontent.com/howlerops/opencode-agentic-commands/refs/heads/main/docs/guide/installation.md"

assert.match(guide, /^# Installation/)
assert.match(guide, /For LLM Agents/)
assert.match(guide, /npm install --prefix "\$HOME\/.config\/opencode" github:howlerops\/opencode-agentic-commands/)
assert.match(guide, /npx opencode-agentic-commands@latest/)
assert.match(guide, /pi install git:github.com\/howlerops\/opencode-agentic-commands/)
assert.match(guide, /OpenCode commands installed/)
assert.match(guide, /\/hugin/)
assert.match(guide, /\/polaris/)
assert.match(guide, /Restart OpenCode/)

assert.match(readme, /Recommended agent-assisted install/)
assert.match(readme, new RegExp(rawUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
assert.match(docs, /Agent Install/)
assert.match(docs, new RegExp(rawUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
assert.match(docs, /npm install --prefix "\$HOME\/.config\/opencode" github:howlerops\/opencode-agentic-commands/)

assert.ok(pkg.files.includes("docs/guide"), "package files should include the raw installation guide")

console.log("install guide tests passed")
