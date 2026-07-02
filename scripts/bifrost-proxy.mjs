#!/usr/bin/env node
import { createServer, request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"

const options = {
  listenHost: "127.0.0.1",
  listenPort: 0,
  upstream: "",
  username: process.env.BIFROST_PROXY_USERNAME || "opencode",
  password: process.env.BIFROST_PROXY_PASSWORD || "",
  upstreamUsername: process.env.BIFROST_UPSTREAM_USERNAME || "",
  upstreamPassword: process.env.BIFROST_UPSTREAM_PASSWORD || "",
}

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (arg === "--password" || arg === "--upstream-password") {
    console.error(`${arg} is not supported because secrets must not be passed in process arguments. Use BIFROST_PROXY_PASSWORD or BIFROST_UPSTREAM_PASSWORD.`)
    process.exit(1)
  }
  if (arg === "--listen-host") options.listenHost = process.argv[++i]
  else if (arg === "--listen-port") options.listenPort = Number(process.argv[++i])
  else if (arg === "--upstream") options.upstream = process.argv[++i]
  else if (arg === "--username") options.username = process.argv[++i]
  else if (arg === "--upstream-username") options.upstreamUsername = process.argv[++i]
}

if (!options.upstream || !options.listenPort || !options.password) {
  console.error("Usage: BIFROST_PROXY_PASSWORD=<password> bifrost-proxy --listen-host <host> --listen-port <port> --upstream <url> --username <user>")
  process.exit(1)
}

const upstream = new URL(options.upstream)
const expectedAuth = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`
const upstreamAuth = options.upstreamPassword ? `Basic ${Buffer.from(`${options.upstreamUsername || "opencode"}:${options.upstreamPassword}`).toString("base64")}` : ""
const hopByHopHeaders = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"])

function filteredHeaders(headers) {
  const result = {}
  for (const [key, value] of Object.entries(headers)) {
    if (hopByHopHeaders.has(key.toLowerCase())) continue
    result[key] = value
  }
  return result
}

function unauthorized(response) {
  response.writeHead(401, { "www-authenticate": 'Basic realm="Bifrost"' })
  response.end("Bifrost authentication required\n")
}

const server = createServer((clientRequest, clientResponse) => {
  if (clientRequest.headers.authorization !== expectedAuth) {
    clientRequest.resume()
    unauthorized(clientResponse)
    return
  }

  const headers = filteredHeaders(clientRequest.headers)
  headers.host = upstream.host
  if (upstreamAuth) headers.authorization = upstreamAuth
  else delete headers.authorization
  headers["x-forwarded-host"] = clientRequest.headers.host || ""
  headers["x-forwarded-proto"] = "https"

  const target = new URL(clientRequest.url || "/", upstream)
  const proxyRequest = (upstream.protocol === "https:" ? httpsRequest : httpRequest)(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || undefined,
      method: clientRequest.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (proxyResponse) => {
      clientResponse.writeHead(proxyResponse.statusCode || 502, filteredHeaders(proxyResponse.headers))
      proxyResponse.pipe(clientResponse)
    },
  )

  proxyRequest.on("error", (error) => {
    if (clientResponse.headersSent) clientResponse.destroy(error)
    else {
      clientResponse.writeHead(502, { "content-type": "text/plain" })
      clientResponse.end(`Bifrost proxy upstream error: ${error.message}\n`)
    }
  })

  clientRequest.pipe(proxyRequest)
})

server.on("upgrade", (request, socket) => {
  socket.end("HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n")
})

server.listen(options.listenPort, options.listenHost, () => {
  console.log(`Bifrost proxy listening on http://${options.listenHost}:${options.listenPort} -> ${upstream.href}`)
})
