---
name: neon-asset-audition-technique
description: Use for Neon Warden SFX, music or VO candidate design, in-context blind audition, variant routing, and asset promotion.
metadata:
  opencode/autoinvoke: false
---

# Audition directions, then promote the actual choice

## When to use

Before you generate another batch, choose a voice/music/SFX take, or ship generated
assets. Paths below are repository-root-relative. Domestic selection practice;
tools own codecs, command flags, cache keys and gain policy.

## Shortest workflow

1. Read only the applicable canonical pipeline: `sfx/README.md`, `music/README.md`,
   or `research/2026-10-28-vo-pipeline/README.md` and the current VO scripts. Edit
   the authoring manifest/script or bank, not a generated mirror. Identify the owner
   of shared text/seed/generated-file fields first.
2. Design deliberately different prompts/directions before seed variants. Record
   each direction with its candidates; spend seeds only on a promising one. For
   SFX see the first-audition lesson in `sfx/README.md`. This prescribes the next
   batch, not a claim that the renderer already implements multi-brief generation.
3. Render through existing CLI/cache/budget controls. Run finite jobs in the child
   foreground and wait before reporting. Background-only main dispatch is not
   permission to orphan child renders. Log paid calls in `research/SPEND.md`,
   including ones already in a renderer ledger.
4. Audition isolated defects, then **in game with music, VO and effects** at
   representative density. Use the existing `qa:ab` and audition interfaces in
   `qa/README.md`; retain alternatives. Statistics suggest provisional picks, not
   human taste or proof of musical phrasing at loop seams.
5. Verify blind labels against the report's disclosure/capture mapping **before
   promotion**. A/B letters are local to one report, never permanent identities.
   Record the selected identity/hash in picks and the default registry as
   applicable. Adam's latest choices in `AGENTS.md` supersede old README/default
   narratives.
6. Distinguish **stored base** from **audible default**: inspect
   `public/vo/variants/index.json`, actual resolver behavior, fallback counts and
   word timings. A missing original variant can speak with base audio; resolve
   subtitle timing from the same take. No separate variant folder is needed when
   that variant is the base. Preserve original alternatives.
7. Promote using the canonical scripts, regenerate affected outputs and verify the
   authoring source→generated mirror→public manifest/assets chain. Never rewrite a
   live script's renderer seed/hash fields just to silence stale-mirror tests.
   Include cache invalidation when normalization metadata changes independently of
   synthesis hashes; coordinate variant-directory ownership during sync.
8. Run `deno task qa:static` and relevant audible reels; follow
   `neon-av-review-technique` for trusted judging. Measure the **runtime mix and
   post-fader buses**, not just normalized source WAVs. Cite failures honestly.

## Pitfalls and evidence

- Observed failure: `sfx/README.md`, “Lesson from the first audition”: seed-only
  candidates were nearly indistinguishable. Contrasting briefs are the proposed
  correction, still needing a documented second audition.
- Observed win: `docs/INTEGRATION-QUEUE.md`, “B: music, variants and mix”,
  `e8e61f6`: source WAVs were already correct; unretired layers, +11.6 dB Warden
  PA gain and compressor makeup made fights about −8 LUFS. Runtime fixes yielded
  −17.2 LUFS/−4.3 dBTP in `qa/reports/20261028-224118/index.html`.
- Same queue, “T: Captain alternative complete”: 243 takes routed to original
  while 150 new takes fell back to Captain; storage location was not the default.
  Audio/timing APIs were actually exercised. That historical default is superseded
  by Adam's Captain/cand1 choices in current `AGENTS.md`, not by a judge preference.
- Queue, onboarding gates: the exact YAML mirror test was stale after renderer
  seed/hash changes. Same queue, B sync guard: treating `variants/` like a language
  directory could delete its index. Generated files are not independent sources.

## Success criteria and cultivation log

- Success: contrasting directions documented; in-context choice and label mapping
  recorded; no unfinished render; ledger reconciled; source and generated outputs
  agree; audible routing, timings and final mix checked. Human approval stays
  distinct from provisional objective or model preference.
- 2026-10-29 extraction: retained the seed-only failure, tested base/fallback
  resolution and runtime-mix repair above. Blind mapping is a promotion safeguard,
  not evidence every historical human pick was checked correctly.
