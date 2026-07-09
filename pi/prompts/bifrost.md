---
description: Start, inspect, sync-diagnose, or stop a secure OpenCode remote portal with a tunnel
argument-hint: "<start|status|sync|stop> [port|provider|notes]"
---
Run Bifrost now. Do not print this instruction back to the user.

Request:
$ARGUMENTS

Execute the package runner when available. Pass the request words as separate process arguments after `--`; do not interpolate the raw request into a shell command string.

Runner base command: `opencode-bifrost --state-dir .opencode/bifrost --host 127.0.0.1 --preferred-tunnel cloudflared --fallback-tunnel ngrok --server-mode auto --`

If `opencode-bifrost` is not on PATH in this local checkout, locate the installed `@howlerops/valhalla` package first, then run its `scripts/bifrost-runner.mjs` with the same arguments.

Return only the runner output. Bifrost prefers the active OpenCode server for two-way no-gap sync and protects it with a Bifrost-managed local auth proxy. In default `auto` mode, if the active server URL is missing or stale, Bifrost falls back to managed Web mode, reports the fallback reason, and prints the `opencode attach` command for terminal attachment. Use plugin `serverMode: active` when stale or missing active-server context should fail instead. The username is `opencode` unless `OPENCODE_SERVER_USERNAME` was set by the runner environment. For `start`, `status`, and `sync`, keep the URL, username, password, `Copy login`, server mode, session links, and live TUI control API lines easy to see.
