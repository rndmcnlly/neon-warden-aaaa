---
name: neon-parallel-integration-technique
description: Use for Neon Warden parallel dispatch, cross-file integration, shared-index commits, and revision-qualified production reports.
metadata:
  opencode/autoinvoke: false
---

# Parallel work without imaginary integration

## When to use

Before dispatching work, changing a shared contract, committing in the shared
checkout, or calling a workstream done. All paths below are repository-root-relative.
This is domestic project practice; Adam's background-dispatch preference is local.

## Shortest workflow

1. Read the relevant ownership row in `docs/WAVE3.md` or `docs/WAVE4.md`,
   latest `AGENTS.md` decisions, and only the relevant headings in
   `docs/INTEGRATION-QUEUE.md`. Inspect `git status --short` and recent commits.
2. Pin producer/consumer contracts before implementation: exact event names,
   fields, units, identifiers, fallback semantics, and who wires the caller.
   Narrow file ownership is not interface agreement. Announce changes early in
   the integration queue; do not leave private compatibility types indefinitely.
3. Main dispatches child sessions in **background mode**, with bounded paths,
   acceptance checks and a final report including PROCESS FEEDBACK. Main stays
   responsive. Each child runs its finite renders/tests in the **foreground**
   with sufficient timeout, then reports. Never finish with your own finite job
   unfinished. Useful background dev servers are allowed, with lifecycle ownership.
4. Read targeted sections, not whole transcripts or large captured tables.
   Delegate a bounded capture/table reduction when it actually saves context;
   avoid repeating the whole brief to endless micro-workers. Keep evidence links.
5. Integrator checks both sides and the caller together. Use existing checks in
   `qa/README.md`: `deno task qa:static`, relevant reels, and `deno task ci`.
   Docs-only skills use the validation in `docs/SKILLS.md`, not irrelevant game reels.
6. **Serialize commits:** coordinate one committer/quiet interval in a shared
   checkout, or use an authorized isolated worktree. File ownership does not
   isolate the git index. First inspect `git diff --cached --name-status` and
   `git diff --cached`. If anything is staged by someone else, stop and coordinate;
   never unstage their work. Stage explicit owned paths/hunks, never `git add -A`.
   Reinspect staged content immediately before committing. Whole-file staging or
   `git commit --only <path>` includes others' unstaged edits in a shared file:
   use only your reviewed hunk there. No commit races, broad cleanup or push.
7. Report commit, exact checks, report path, failures/pending items and ownership.
   Separate own passing checks from unrelated CI debt: never call the suite green
   when CI stopped. Send dated/revision-qualified status to the dashboard owner
   (`docs/dashboard.md`); edit `production/status.json` only if assigned.

## Pitfalls and evidence

- `docs/INTEGRATION-QUEUE.md`, “Q QA: audio in every reel”: producer word fields
  `{word,start,end,char}` did not match consumer `WordTiming`. Disjoint files
  still produced a broken word-pulse feature. Contracts need example payloads.
- Same queue, “G Gameplay: contracts drafted”: renderer harness required new
  state fields and narrative tests required `kill.clean`. Early announcements
  exposed cross-file obligations; sim landed as `a8d446c` and `31430d7`.
- Scope cut `c598544` left `main.ts` referencing `pilot_figure`; logo integration
  `3f785ff` removed it. A locally finished slice can still break full typechecking.
- Queue, “B: music, variants and mix”: lint/tests/build passed separately while
  CI failed formatting, then concurrent scope-cut references broke newer checks.
  `docs/dashboard.md` explicitly separates historical PASS from current freshness.
- Sector worlds v2 (`d351d9d`): a write to the shared `production/status.json`
  truncated the file before reading it, destroying other workers' uncommitted
  entries; the main session rebuilt it from memory. Shared status files are
  read, parsed, modified in memory, then written atomically (temp file plus
  rename), touching only your own entry. Never open a shared file for writing
  first. Long-lived servers (the dashboard) belong to the main session: do not
  kill processes you did not start.

## Success criteria

Contract consumers and caller verified together; no foreign staged content in the
commit; no orphan finite jobs; final QA and dashboard claims carry revision/time,
scope and remaining failures. A dirty checkout is not an exact revision snapshot.

## Cultivation log

- 2026-10-29 extraction: observed word-schema failure and scope-cut integration
  repair above. These are tested project outcomes, not proof all parallelism works.
- Proposed safeguard: serialized commit window plus staged-hunk inspection.
  Historical briefs prohibit broad staging but do not prove race-free commits.
  Probe results and further reuse belong in `docs/SKILLS.md`.
