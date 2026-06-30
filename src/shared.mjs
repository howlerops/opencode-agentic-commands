export function replaceArguments(template, args) {
  return template.replaceAll("$ARGUMENTS", String(args || "").trim())
}

export function firstTextPart(parts, commandNames) {
  return parts.find((part) => {
    if (part.type !== "text") return false
    const text = part.text.trimStart()
    return commandNames.some((name) => text.startsWith(`/${name}`))
  })
}

export function parseSlash(text, commandNames) {
  const names = commandNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  return text.trimStart().match(new RegExp(`^/(?:${names})(?:\\s+|$)([\\s\\S]*)$`))
}

export function addTextOutput(output, text) {
  output.parts = [{ type: "text", text }]
}
