# Trailer masters: render, QA and blind review (October 29, 2026)

## Framing question

The prep pass (`research/2026-10-29-trailer-prep/`) and the capture bake-off
(`research/2026-10-29-trailer-capture/`) left three cut sheets and a stepped
1080p60 master path, but the sheets were timed on real-time drafts that ran
autoplay at about 2x (fixed in `ff3a7dc`). What does it take to re-time every
shot for true speed, render nine masters (three cuts x EN, ES, ZH), and prove
each one is technically correct and reads well cold?

Disciplines in play: game-trailer editing (hook, repetition, pacing), video
engineering (frame-exact assembly, constant frame rate), audio post (loudness,
true peak), measurement design (picture-to-source alignment as a sync test),
and evaluation practice (blind model review, adopt or decline with reasons).

Frozen build: `f9b72a422589c40f`, a `git archive` snapshot of `73f6cf7` (new
`TRAILER_BUILD_REV`), so the concurrent fullscreen work in `src/platform` and
`src/ui` could not change takes mid-render. Pipeline commit: `c15e6f9`.

## Masters

All 1920x1080, H.264 yuv420p, 60 fps constant (every packet 1/60 s apart),
AAC 48 kHz stereo. Targets: -16 LUFS integrated, -2 dBTP ceiling. Files stay
out of git (gitignored, 130–460 MB each); reports, SRTs and chapters are
copied to `masters/`, per-master QA JSON to `qa/`.

| master | duration | frames | size | LUFS / dBTP | dup frames in take shots | captions | QA |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `trailer/out/teaser30/en/teaser30-en.mp4` | 30.10 s | 1806 | 138 MB | -15.9 / -3.0 | 0/1499 | 6 en, burned + SRT | PASS |
| `trailer/out/teaser30/es/teaser30-es.mp4` | 30.10 s | 1806 | 134 MB | -15.8 / -3.0 | 0/1499 | 6 es, burned + SRT | PASS |
| `trailer/out/teaser30/zh/teaser30-zh.mp4` | 30.10 s | 1806 | 137 MB | -15.8 / -2.9 | 0/1499 | 5 zh, burned + SRT | PASS |
| `trailer/out/trailer90/en/trailer90-en.mp4` | 90.57 s | 5434 | 423 MB | -16.0 / -3.0 | 0/4403 | 10 en, burned + SRT | PASS |
| `trailer/out/trailer90/es/trailer90-es.mp4` | 90.57 s | 5434 | 420 MB | -16.0 / -2.9 | 0/4403 | 11 es, burned + SRT | PASS |
| `trailer/out/trailer90/zh/trailer90-zh.mp4` | 90.57 s | 5434 | 424 MB | -16.0 / -2.8 | 0/4403 | 9 zh, burned + SRT | PASS |
| `trailer/out/compendium120/en/compendium120-en.mp4` | 120.00 s | 7200 | 458 MB | -16.0 / -2.2 | 14/6282 (static menus) | in-game, en | PASS |
| `trailer/out/compendium120/es/compendium120-es.mp4` | stale | | | | | | not re-rendered (see below) |
| `trailer/out/compendium120/zh/compendium120-zh.mp4` | stale | | | | | | not re-rendered (see below) |

Second pass (October 29, evening, frozen build `cc8fbef`): slates carry the
play URL (all cuts) and the source repository (trailer90, compendium);
`boss-fight` ends after the Warden's turn, now a parley the autopilot listens
to (trailer90 `boss-turn` shows the real line); the compendium shows the
tutorial wink and ends on a 3 s slate. Picture sync: 0 frames on every
take shot (6 + 21 + 18 per language) except `warden-rings` at 1 frame in
each trailer90 (the known in-point snap). Raw picsync tables:
`qa/picsync-*.txt`.

QA method (`qa.py`, `picsync.py`):

- Format and pacing: ffprobe streams; every video packet delta is 1/60 s.
  Each conformed segment has exactly the frame count of its frame-quantized
  shot (checked for all 61 EN segments).
- Dropped and duplicated frames: mean luma difference of consecutive frames
  inside take-backed shots. Zero in teaser and trailer; the compendium's 14
  are the boot and title screens holding still (identical in the takes).
- Picture–sound sync: for each take-backed shot, the master's frames are
  matched against the source take around the in-point. The shot's audio is cut
  sample-exact from the same in-point, so any frame offset is picture–sound
  lag. Result: 0 frames in 132 of 135 shot checks across the nine masters;
  `warden-rings` in each trailer master at 1 frame (the ±½-frame in-point snap,
  under 17 ms). The
  capture itself holds sound within 2–7 ms of picture (bake-off). An audio
  cross-correlation spot check against the take (shots with correlation at
  least 0.25) gave -0.7 to 7 ms.
- Loudness: ebur128 on the final file.
- Captions: SRT cue count and script (CJK for ZH, Spanish diacritics for ES).
  Burned caption layers counted. For the compendium, each language-sensitive
  take's subtitle log was checked to be in the master's language.

## What changed to get here

1. **True-speed event map** (`discover.ts`, `discover/*.txt`): long draft
   takes of every scenario, converted to sim ticks / 60 (parallel drafts
   starved the sim to 31–56 ticks/s, so wall times were useless). Key fact:
   **the first pickup of any run freezes the sim for the flashback, about
   55 s**. That is why the old 75 s takes ended inside it.
2. **`roll` step** (pipeline): takes that need play after the flashback
   pre-roll through it (stepped without grabbing, about 4x cheaper) and start
   when the sim resumes; `nth` anchors count from the roll. Every take now
   ends on an `until` probe for the last event its shots need, not a fixed
   wait. Takes shared between teaser and trailer have identical recipes, so
   they were captured once.
3. **Sheets** (`trailer/cuts/*.yaml`): every anchor re-checked; changes are
   commented in place. Notable: `show-fire`, `place-s1`, `verb-tap`,
   `verb-stream` use post-flashback kills; `show-writ` and `verb-writ` use the
   second Writ break; `recorder` anchors on `flash_rec_001`; `warden-shadow`
   comes from the pacifist take at frame 0 (the descent take has under 24
   beats before `desc_001`); `pacifist-dodge` uses `desc_pac_001` ("Your gun
   is cold") for picture and VO; compendium `flashback` anchors on
   `scene:recorder`, `boot-logos` on the photosensitivity notice.
4. **Draft dry run of every recipe** (EN, `logs/draft*.log`) before master
   compute. It caught the missing pacifist disarm after the flashback and a
   clamped `place-s3`.
5. **Assembly defects found by QA, fixed in `c15e6f9`:**
   - beat-length segments rounded up a frame each, so picture drifted up to
     8 frames (133 ms) behind music, VO and captions by the end of trailer90;
   - card stills were a frame short;
   - in-points between frames doubled a shot's first frame;
   - linear `loudnorm` silently fell back to dynamic mode on trailer90
     (-0.8 dBTP); the fix is the same gain plus an oversampled limiter.

## Findings for other workstreams (game, not trailer)

- **The Warden's turn is skipped on a fast kill.** In phase 3 the timeline
  plays `boss_p3_001`, 5 s, `boss_p3_002`, 6 s, then `boss_turn_001/002`
  (`src/scenes/bossPhase3.timeline.ts`). The fight autopilot kills the Warden
  about 16 s into phase 3, before the turn starts, so the third move of the
  Warden arc never plays. A skilled human will hit the same thing. The
  trailers put the turn line in post (VO from `public/vo/cues.json`) over
  phase-3 footage, which is honest about the line but not about when a fast
  player hears it.
- **The tutorial autopilot stalls at the rest gate.** `tutCharged` needs 30
  ticks of rest at full charge after a release
  (`src/scenes/tutorialGates.ts`); the autopilot fires the Writ at once.
  `tut_wink_001` is therefore unreachable by autoplay. The compendium shows
  the contract preamble instead, labeled "knowingly overlong", and records
  the wink as an honest gap.
- **The pacifist autopilot disarms exactly once per run**: the sector 3
  turret, 0.8 s before the recorder pickup freezes the world (none in 90 s of
  sectors 1, 2, 4, 5). Both disarm shots end just after that break.
- **Compendium language limit (pre-existing design):** the four
  language-neutral verb takes (s1, s2, s3-disarm, s4) carry English ambient
  barks in the ES and ZH masters too. Making them `langSensitive` costs about
  4 more takes per language.

## Blind review (Gemini 4 Argon, OpenRouter, ZDR, no fallbacks)

`judge.ts`, outputs in `judge/`. One call per clip, neutral ids (clip-A =
teaser EN, clip-B = trailer EN), no game facts. The schema makes the model
reconstruct what it saw and heard before it scores the concerns from the
prep README section 2. Spend: US $0.0333 + $0.0637 = **US $0.097** (budget
US $1), logged in `research/SPEND.md`. These are two single passes from one
model, not a panel and not human viewers.

Speech canary: every line the judge says it heard matches VO that was
actually placed (`brief_warden_002/004`, `desc_001`, `boss_turn_002`;
trailer adds `flash_rec_001`, `brief_warden_003`, `desc_ai_001`,
`desc_pac_001`). Product, platform ("browser, no install") and the
question raised ("are we the bad guys?") were reconstructed correctly from
both clips.

| clip | hook | clarity | pacing | lowest concerns |
| --- | --- | --- | --- | --- |
| teaser | 5 | 5 | 4 | muted autoplay 4, pacing 4 |
| trailer | 4 | 4 | 3 | repeated places 3, lore holds 3, microtrailer fragments 3, pacing 3 |

Adopted (cheap, re-assembly only, all nine masters reflect them):

| advice | change |
| --- | --- |
| Teaser 0:22–0:27: the Warden barely fires under the doubt line | `doubt` anchors 1 s into phase 3 (grazes in the window: 0 before, 4 after) |
| Trailer 0:00–0:05: sector 4 twice in the hook; lead with the densest shot | hook reordered: curtain (s5), Writ (s4), then `hook-boss`, the Warden's curtain with the graze meter at 0.8+ |

Declined, with reasons:

- **Cut the 7 s recorder shot (trailer 0:37).** The prep panel already kept
  it: `flash_rec_001` ("Weapon status: cold") sets up the pacifist tease that
  now pays off in `desc_pac_001`. Cutting it means re-editing the 96-beat
  music bed. That's not cheap, and not clearly better.
- **Shorten the 27 s narrative block.** Same music-edit cost. The block is
  the Warden in three moves (hype, deflate, aside), which is the trailer's spine.
- **Punch in on the disarm.** That needs a zoom/crop shot feature in the
  assembler: a small new feature, not a re-time. Next step.
- **Hide the "SCOUT CHANNEL" radio pop-up in captures.** It is in-game HUD
  (P2 keeps the HUD on), and there is no setting to hide it.
- **Add a visual gag to the Warden for muted autoplay.** New content.
- **Avoid places repeating between the verb section and the places
  montage.** That's structural to Tell-Show-Repeat plus places; partly kept.

## Second pass: the ES tutorial stall (October 29, evening)

The ES compendium master hung for 7+ minutes in the `tutorial-es` pre-roll
(main session diagnosis at 16:28: ffmpeg idle, Chrome near idle; idle ffmpeg
is normal in pre-roll, but nothing showed sim progress). Cause, reproduced
headlessly with real line lengths: in ES and ZH the long `tut_parts_001`
explanation let the autopilot break the practice turret's barrel before the
parts gate opened (gates want a fresh action), and the disarmed turret flew
off and was never re-issued, so the gate waited forever. A human who breaks
it early hits the same wall. EN passed by timing luck. Fix: the sim
re-issues the practice turret on any loss while the drill wants it, and the
timeline clears `tut.spawnTurret` as soon as the gate passes;
`tests/autopilot_story_test.ts` walks the tutorial in all three languages
(ES and ZH fail without the fix).

Watchdog (`trailer/capture.ts`): in stepped capture an `until` fails the take
loudly, with tick, freeze, flags and last log entries, when no story entry
(line, scene, flag; `sim:` events excluded) arrives for `stallMs` of game
time (default 120 s), when any probe or step takes 120 s of wall time, or
when its timeout passes (MISSING); the half-made take is deleted, not
cached. Pre-roll progress is now logged. Verified on a probe that never
fires: failed after 43 s wall with diagnostics.

Adam (evening): English-only video is acceptable, to save energy. The ES and
ZH compendium masters were therefore not re-rendered; the files on disk are
the first pass (no slate, English barks in the verb shots). To make them:
`TRAILER_BUILD_REV=<rev> TRAILER_PLAY_URL=neon-warden-aaaa.adamsmith.systems
deno task trailer compendium120 --master --lang es` (and `zh`), about 55 min
each. The ES/ZH teaser and trailer masters are current and passed.

## Not done, and why

- **No re-judge after the two adopted fixes** (each was verified by QA and
  an event-density proxy, not by a second model pass).
- Take cache: about 7.6 GB in `trailer/.cache/takes/`. It can be pruned to the
  keys named in `masters/*.report.json`.

## Wall time (M3 Max)

Masters: EN capture and assembly 38 min, EN re-renders and re-assemblies
after the QA and judge fixes 44 min, ES and ZH 32 min, so **about 1 h 55
min** of master compute (stepped takes:
741 s of footage, 7072 s of capture wall summed over 3 parallel browsers).
Discovery and draft validation added about 20 min. Total about 2 h 15 min,
well under the 6 h threshold, so all languages ran in one pass.

## Files

- `discover.ts`, `discover/`: event map at true speed (ticks).
- `qa.py`, `picsync.py`, `qa/`: master QA and picture alignment.
- `judge.ts`, `judge/`: blind review.
- `masters/`: report, SRT and chapters for each master.
- `logs/`: draft, master and assembly logs.
- `status.py`: atomic update of this workstream's dashboard entry.
