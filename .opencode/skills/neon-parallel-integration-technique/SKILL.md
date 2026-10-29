---
name: neon-parallel-integration-technique
description: Use for Neon Warden parallel dispatch, cross-file integration, shared-index commits, and revision-qualified production reports.
metadata:
  opencode/autoinvoke: false
---

# Parallel work without imaginary integration

## When to use

Before dispatching work, changing a shared contract, committing in the shared
checkout, or calling a workstream done. Paths below are repository-root-relative.
Domestic project practice; Adam's background-dispatch preference is local.

## Shortest workflow

1. Read the relevant ownership row in `docs/WAVE3.md` or `docs/WAVE4.md`, the
   latest `AGENTS.md` decisions, and only the relevant headings in
   `docs/INTEGRATION-QUEUE.md`. Inspect `git status --short` and recent commits.
2. Pin producer/consumer contracts before implementation: exact event names,
   fields, units, identifiers, fallback semantics, and who wires the caller.
   Narrow file ownership is not interface agreement. Announce changes early in the
   queue; do not leave private compatibility types indefinitely.
3. Main dispatches child sessions in **background mode**, with bounded paths,
   acceptance checks and a final report with PROCESS FEEDBACK, so main stays
   responsive. Each child runs its finite renders/tests in the **foreground** with
   a sufficient timeout, then reports; never finish with your own finite job
   unfinished. Useful background dev servers are allowed, with lifecycle ownership.
4. Read targeted sections, not whole transcripts or large captured tables. Delegate
   a bounded capture/table reduction when that saves context; don't repeat the whole
   brief to endless micro-workers. Keep evidence links.
5. The integrator checks both sides and the caller together. Use the checks in
   `qa/README.md`: `deno task qa:static`, the relevant reels, `deno task ci`.
   Docs-only skills use the validation in `docs/SKILLS.md`, not game reels.
6. **Serialize commits:** one committer/quiet interval in the shared checkout, or
   an authorized isolated worktree; file ownership does not isolate the git index.
   First inspect `git diff --cached --name-status` and `git diff --cached`. If
   someone else staged anything, stop and coordinate; never unstage their work.
   Stage explicit owned paths/hunks, never `git add -A`. Reinspect staged content
   immediately before committing. Whole-file staging or `git commit --only <path>`
   includes others' unstaged edits in a shared file: use only your reviewed hunk
   there. No commit races, broad cleanup or push.
7. Report commit, exact checks, report path, failures/pending items and ownership.
   Separate your own passing checks from unrelated CI debt: never call the suite
   green when CI stopped. Send dated, revision-qualified status to the dashboard
   owner (`docs/dashboard.md`); edit `production/status.json` only if assigned.

## Pitfalls and evidence

- Queue, “Q QA: audio in every reel”: producer word fields `{word,start,end,char}`
  did not match consumer `WordTiming`. Disjoint files still broke the word-pulse
  feature. Contracts need example payloads.
- Same queue, “G Gameplay: contracts drafted”: the renderer harness required new
  state fields and narrative tests required `kill.clean`. Early announcements
  exposed cross-file obligations; sim landed as `a8d446c` and `31430d7`.
- Scope cut `c598544` left `main.ts` referencing `pilot_figure`; logo integration
  `3f785ff` removed it. A locally finished slice can still break full typechecking.
- Queue, “B: music, variants and mix”: lint/tests/build passed separately while
  CI failed formatting, then concurrent scope-cut references broke newer checks.
  `docs/dashboard.md` keeps historical PASS separate from current freshness.
- Sector worlds v2 (`d351d9d`): a write to shared `production/status.json`
  truncated the file before reading it, destroying other workers' uncommitted
  entries; main rebuilt it from memory. Shared status files are read, parsed,
  modified in memory, then written atomically (temp file plus rename), touching
  only your own entry. Never open a shared file for writing first. Long-lived
  servers (the dashboard) belong to main: do not kill processes you did not start.

## Success criteria

Consumers and caller verified together; no foreign staged content in the commit;
no orphan finite jobs; QA and dashboard claims carry revision, time, scope and
remaining failures. A dirty checkout is not an exact revision snapshot.

## Cultivation log

- 2026-10-29 extraction: the word-schema failure and scope-cut repair above were
  observed, not proof all parallelism works.
- Proposed safeguard, not yet proven: a serialized commit window plus staged-hunk
  inspection. Briefs prohibit broad staging, not commit races. Probe results and
  reuse belong in `docs/SKILLS.md`.
