---
description: Start, inspect, or stop a secure OpenCode Web remote portal with a tunnel
argument-hint: "<start|status|stop> [port|provider|notes]"
---
Open a Bifrost remote portal for this OpenCode workspace, or manage an existing portal.

Request:
$ARGUMENTS

Scope:
- Treat `/bifrost` as an independent remote-access add-on. Do not invoke `/polaris`, `/hugin`, `/tyr`, `/munin`, `/eitri`, `/vidar`, or `/skuld` unless separately asked.
- Manage only OpenCode Web and tunnel processes started for the current workspace unless the user explicitly selects another detected session.
- Prefer safe, reversible shell operations. Do not expose a server without a password.

Supported modes:
- `start`: default when no mode is provided.
- `status`: report detected OpenCode Web processes, tunnel processes, ports, URLs, passwords if known, and log/state files.
- `stop`: stop only the selected Bifrost-managed tunnel and OpenCode Web process after identifying them clearly.

Start workflow:
1. Parse the request for mode, preferred port, preferred tunnel provider, and whether to reuse an existing server.
2. Inspect for existing OpenCode Web servers before starting a new one. Check `.opencode/bifrost`, listening localhost ports, and process command lines where available.
3. If exactly one compatible OpenCode Web server is detected, reuse it unless the user asked for a new server.
4. If multiple compatible servers are detected, present choices with port, cwd, PID, command, and state/log paths when detectable. Ask the user to choose instead of guessing.
5. If no server is available, choose a non-blocking local port. Prefer the requested port if free; otherwise choose an available high port.
6. Ensure there is a password. Reuse `OPENCODE_SERVER_PASSWORD` when set; otherwise generate a strong temporary password and pass it only to the started OpenCode Web process environment.
7. Start OpenCode Web bound to `127.0.0.1`, with logs and PID/state under `.opencode/bifrost`.
8. Wait until the local health check or root URL responds. If startup fails, show useful logs and stop.
9. Start `cloudflared tunnel --url http://127.0.0.1:<port>`.
10. If `cloudflared` is missing, install it only with user-safe package tooling available on the machine, such as `brew` on macOS, and report the command. If install is not possible or fails, fall back to `ngrok`.
11. For ngrok fallback, use `ngrok http http://127.0.0.1:<port>`. If ngrok needs auth/setup, report the blocker and leave the local OpenCode Web server running only if it was already running before `/bifrost` or the user wants local access.
12. Extract the public URL from tunnel output or local tunnel API. Wait briefly and retry before declaring failure.

Terminal output requirements:
- Always print the active local URL, public tunnel URL, password source, and password value when the command successfully starts or reuses a portal and the password is known.
- Print `opencode attach http://127.0.0.1:<port>`.
- Print `/bifrost status` and `/bifrost stop`.
- Print PID files and log files.
- If more than one chat/session is available from OpenCode Web or the server API, list them and ask which one to open or attach to.

Security rules:
- Never bind OpenCode Web to `0.0.0.0` for a public tunnel unless the user explicitly asks and understands the risk.
- Never use an empty password for a tunnel-exposed server.
- Do not commit state files, passwords, tunnel URLs, or logs.
- If you cannot verify the server is password-protected, stop before exposing it publicly.

Final response:
- For start/reuse: provide portal status, local URL, public URL, password, attach command, logs, and stop command.
- For status: provide current state and any stale-state cleanup recommendation.
- For stop: provide what was stopped, what was already absent, and any remaining manual cleanup.
