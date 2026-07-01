---
description: Start, inspect, or stop a secure OpenCode Web remote portal with a tunnel
argument-hint: "<start|status|stop> [port|provider|notes]"
---
Run Bifrost now. Do not print this instruction back to the user.

Request:
$ARGUMENTS

Execute the package runner when available:

`opencode-bifrost --state-dir .opencode/bifrost --host 127.0.0.1 --preferred-tunnel cloudflared --fallback-tunnel ngrok -- $ARGUMENTS`

If `opencode-bifrost` is not on PATH in this local checkout, locate the installed `opencode-agentic-commands` package first, then run its `scripts/bifrost-runner.mjs` with the same arguments.

Return only the runner output.
