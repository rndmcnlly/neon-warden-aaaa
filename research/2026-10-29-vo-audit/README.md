# VO audit: every voiced line in EN, ES and ZH (October 29, 2026)

## Framing question

Is every line the game can speak rendered, tagged, synced to `public/vo/`
and actually heard in context, in all three languages, with the Captain
tutorial voice as default and the original-voice variant left intact?

Frozen revision for all claims below: commit `8fcd5ab` (captured from an
isolated worktree, so concurrent edits in the shared checkout do not leak
in). Baseline for comparison: parent `e4d6938`, same method.

## Method

`inventory.ts` (this folder, read-only, never reads audio content) collects
every id referenced by timelines, chatter, barks, radio, bank variants,
literal ids in `src/`, and `vo/pending/*.yaml`, then checks each against
`vo/script.yaml`, the `vo/out/` sidecars and `cues.json`, and the shipped
`public/vo/` Opus, cues and stamps. Per take: speaker and scene tags, text
match, ASR >= 0.85, word timings present and monotonic within duration,
alignment flag, loudness metadata, true peak <= -1 dBTP, duration sanity,
and hash agreement between `vo/out`, `public/vo/cues.json` and the stamp.

```sh
deno run -A research/2026-10-29-vo-audit/inventory.ts [--json out.json]
```

## Inventory (after fixes, `8fcd5ab`)

| lang | script lines | current takes | shipped Opus | synced hash | text match | ASR < 0.85 | no words | align fallback |
|---|---|---|---|---|---|---|---|---|
| en | 223 | 223 | 223 | 223 | 223 | 0 | 0 | 0 |
| es | 223 | 223 | 223 | 223 | 223 | 0 | 0 | 0 |
| zh | 223 | 223 | 223 | 223 | 223 | 0 | 0 | 1 |

| speaker | voiced lines | shipped in all 3 langs | original-voice takes |
|---|---|---|---|
| tutorial_ai | 139 | 139 | 81 (58 never recorded) |
| warden | 48 | 48 | - |
| scout | 18 | 18 | - |
| narrator | 12 | 12 | - |
| authority | 5 | 5 | - |
| pilot | 1 | 1 | - |

ASR (all 669 takes): EN mean/min 0.989/0.857, ES 0.990/0.865,
ZH 0.981/0.857. Loudness -18.9 to -18.0 LUFS, max -1.05 dBTP, every take
has `loudness` metadata. Sync took the metadata-aware linear-gain path
(stamp recipe `opus48k-v2-linear-normalized`), so no second loudnorm.

Text-only by design: 136 referenced ids with no audio, all dotted ids that
tooling never treats as VO: 34 `radio.*` and 102 `bank.*` variants across
26 banks. In reels they log as text-only subtitles and are excluded from
the VO-no-drop check.

## Before the audit

- 15 voiced bank lines never rendered: `var_warden1_001`–`004`,
  `var_warden2_001`–`003`, `var_warden3_001`–`003`, `var_wardenpac_001`–`003`,
  `stat_warden_001`, `stat_scout_001` (45 takes absent from `public/vo`).
- 8 onboarding corrections sat in `vo/pending/onboarding-lockout.yaml` as
  text-only `bank.tutorialOtherLeft.*` / `bank.tutorialLockout.*`.
- `tut_hangar_001` still promised helmet livery (scope cut).
- `tests/banks_test.ts` mirror test failed: `--retry-low` had written a
  `seed:` override into the generated bank block, and `emit_yaml.ts`
  regeneration would have deleted it (silently re-rendering an approved take).
- 3 takes on the plain-subtitle alignment fallback (`zh/tut_hello_001`,
  `zh/var_graze_003`, `es/var_pause_002`): last word starts exactly at the
  file end.

## Fixed

- Onboarding corrections promoted to voiced variants in
  `src/scenes/banks/onboarding.ts` (`var_otherleft_001`–`004`,
  `var_lockout_001`–`004`, tutorial_ai, with acting directions), mirrored by
  `emit_yaml.ts`; the pending file is deleted.
- `emit_yaml.ts` now preserves renderer-owned `seed:` lines per id.
  Banks and timeline tests pass; full suite 236 passed, 0 failed.
- `tut_hangar_001` now says "the paint, trim and decals on your ship"
  (ES "las calcomanías de tu nave", ZH "飞船的涂装、饰边和贴花"), matching
  the hangar's actual paint/trim/decal options.
- Rendered 24 lines x 3 languages with the locked anchors (tutorial_ai =
  Captain, per-language ES/ZH anchors). One reseed rescued
  `zh/var_wardenpac_002` (0.091 to 1.0). `zh/var_warden1_004` stayed at
  0.833 across three seeds because of homophones (承重/沉重, 它们/他们), so the
  Chinese pun now reads "那是承重结构！情感上的承重结构！" (1.0).
- Per-language seed overrides fixed two of three alignment fallbacks.
- `public/vo/variants/index.json` default is `a_captain` (Adam's latest
  pick in AGENTS.md); the original-voice registry is otherwise untouched.

Static QA in the shared checkout: `qa/reports/20261029-024544/index.html`
(32 pass, 6 warn, 0 fail).

## Integration (reels at `8fcd5ab`)

Report: `qa/reports/20261029-vo-audit-8fcd5ab/index.html` (copied from the
isolated worktree; its coverage stage fails only because a clean worktree
has no raw WAVs, by design). Baselines:
`qa/reports/20261029-vo-audit-base-e4d6938-tutorial/` and
`qa/reports/20261029-vo-audit-base-e4d6938-fight/`.

| reel | result | VO windows heard | note |
|---|---|---|---|
| boss | pass | 9/9 | new warden bank takes play |
| ending-kill | pass | 8/8 | |
| vo-no-drop | pass | 9/9 | |
| gameplay-fight | fail | 31/31 | sector-3 deadline; also fails at baseline |
| ending-pacifist | fail | 5/6 | outcome predicate fails at baseline too; `desc_ai_002` late |
| tutorial | fail | 11/16 | wink and handoff deadlines fail at baseline too |

Every voiced subtitle in these reels had a matching voice source start
(`av.voStarted`), including all 20 `var_lockout_*` interjections. No line
was dropped. The VO-window misses have one measured cause.

**Captain lead-in silence.** Captain takes open with a median 0.64 s of
silence before the first word (original voice: 0.24 s; 0.8 s on
`tut_move_000`, `tut_fire_002`, `tut_target_002`, `tut_rule_001`; 1.04 s on
`desc_ai_002`). Lines cut short at autoplay speed therefore show their
subtitle with almost no audible voice. Baseline used the original voice and
passed 14/14. At normal speed the voice arrives, but the subtitle leads it
by most of a second. This is a real presentation lag, not a reel artifact.

Pre-existing, also at baseline: the tutorial autopilot fires during the rest
drill, so the lockout correction repeats about every 2 s of capture time and
the tutorial stalls before the wink. Now that the correction is voiced this
is audible repetition, not just text.

## Remaining gaps

1. Captain lead-in: proposed fix is a lead-in trim (to about 0.15 s) in
   `vo/render.py` after synthesis, shifting `words`, then a sync recipe bump.
   Touches all 669 takes, so it wants Adam's approval and a fresh tutorial
   listen first.
2. Original-voice variant: 58 tutorial_ai lines (all `var_*`/`stat_*` bank
   commentary) have no original take and fall back to Captain; not faked.
   The original `tut_hangar_001` take still says "helmet livery"; it is
   frozen history and only plays with `?v.voice.tutorial_ai=original`.
3. `zh/var_graze_003`: alignment puts the last character at the file end
   on three seeds; plays with a plain subtitle (designed fallback).
4. Tutorial autopilot vs lockout loop (gameplay/autopilot owner), and the
   reel deadlines (B), unchanged by this work.
5. `tut_focus_001` still says "Good. Still focusing" before the action
   (noted by the onboarding agent); a split needs a writing decision.
6. `production/status.json` decision "Tutorial voice: keep original as
   default" is stale against AGENTS.md; dashboard owner should update it.
