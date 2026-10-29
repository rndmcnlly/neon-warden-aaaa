# Local production desk

From the repository root:

```sh
uv run --script production/server.py
```

Open <http://127.0.0.1:8123>. Python 3.11+ alone also works:
`python3 production/server.py`. Optional `--port` is useful for testing. The
server always binds IPv4 loopback, never a LAN interface. Stop with Ctrl-C.

## Editing status

`production/status.json` is the hand-edited source. The top-level `tasks`,
`blockers`, and `decisions` arrays hold entries like:

```json
{
  "title": "Short task title",
  "owner": "Agent or person",
  "status": "unverified",
  "detail": "What is known, including scope and limitations.",
  "revision": "optional commit hash",
  "updated": "2026-10-28"
}
```

Statuses are descriptive, not process probes: `active`, `done`, `blocked`,
`unverified`, `pending`, `note`. Use `active` only with an actual assignment,
and `unverified` when a process might have ended. Dates and revisions remain
attached to each result. Malformed JSON appears as a visible error, not a pass.
The browser refreshes JSON every 10 seconds, preserving video DOM nodes and
playback. No page reload or local-storage dependency.

## Evidence and freshness

`/api/status` enriches the hand-edited data with eight recent git commits,
dirty-file count, bounded spend-ledger text and shallow known QA JSON formats.
It scans the latest 24 report directories and returns up to 35 summaries,
including partially finished runs with coverage/assets data but no index yet.
It does not run tests, inspect processes, or parse large logs. Reports lacking
revision metadata are marked stale / provenance missing. A dirty checkout
also prevents a current-build claim. File modification time is used when a
report has no `created` field; this is artifact time, not proof of execution.
Result status and freshness are separate: a historical PASS can be stale.

The game and audition links point to independent localhost servers on 4321,
8121 and 8122; they may be unavailable. Gallery and QA videos are served here.
Missing artifacts return an honest 404. No game source or QA tooling changes
are needed to run the dashboard.

## Security boundary

Only GET/HEAD are supported. Artifact routes have a positive root/type
allowlist (`production`, `research`, `qa/reports`, `public`), reject hidden,
credential-like and traversal components, symlinks and browser profiles, and
provide no directory listings. Git invocations have fixed arguments, no
shell, a four-second timeout and no optional lock. Host validation blocks
DNS rebinding; there is no CORS permission. Videos stream with byte-range
support. This is a trusted local artifact viewer, not an Internet-facing
service or a sandbox for hostile HTML: do not deploy it publicly.

## Dashboard QA

Run `uv run --script production/test_server.py`. It owns an ephemeral
loopback test server and shuts it down before exiting. Reports live at
`production/reports/server-tests.json` and
`production/reports/browser-snapshot.md` (the latter records manual browser
inspection). No game tests are claimed by this dashboard-only check.
