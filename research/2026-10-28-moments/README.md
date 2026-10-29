# Moments gallery (October 28, 2026)

## Framing question

What does every cool thing that can happen in the slice actually look and
sound like in the shipped bundle, as short A/V references a human can audit
by ear and eye, and which moments cannot yet be reached by URL flags?

Open `index.html` (works from disk; clips never autoplay). The redesigned
viewer is a guided route, not thirty competing players:

- Six chapters, with 3–4 recommended clips each (19 recommendations total).
- One persistent video, manual Play, Previous/Next within each chapter,
  explicit ending-spoiler reveal, and a collapsed complete archive.
- Short names, durations, purpose, Watch for / Listen for, and evidence limits
  for every clip. Diagnostic metrics are collapsed, not viewing instructions.
- Narrow layouts use native chapter/clip selects; visible controls are at
  least 48 px. Keyboard arrows on Previous/Next navigate without stealing
  the video player's seeking keys.

Local production-desk URL:
<http://127.0.0.1:8123/artifacts/research/2026-10-28-moments/index.html>.
The page links the latest local game separately: captured evidence is not
current-build verification. No new videos, auditory evaluation, paid APIs,
or game changes were made for this redesign.

### Viewer-only validation (October 29, 2026 UTC)

`gallery-check.ts` runs foreground Playwright checks through the existing
production artifact server: one player, no autoplay, keyboard Previous/Next,
actual playback followed by a paused source switch, touch selection,
spoiler gating, and no horizontal overflow at 390×844, 800×600, 1366×768,
including the expanded archive. Results: `gallery-qa.json`; compact visual
references: `gallery-desktop.jpg`, `gallery-mobile.jpg`. These checks describe
the viewer only, not the captured game's features or intelligibility.

Rebuild viewer: `deno run -A --no-lock research/2026-10-28-moments/gallery.ts`.
Run focused tests: `deno run -A --no-lock research/2026-10-28-moments/gallery-check.ts`.
Edit `guide.ts` for editorial guidance and `gallery.template.html` for layout;
`gallery.ts` inlines both guide and capture data into the disk-openable page.

## Pipeline (three scripts, reusing qa/ as a library)

1. `capture.ts`: long captures of real runs, 1280x720, the game's own
   stereo mix via `qa/av.ts` (`installAv`, `flushAv`, `finishAv`), served
   by `qa/capture.ts` `serve`/`launch` from a private Vite build in
   `.build/` (built with `vite build --outDir`, skipping `vo:sync` so
   `public/vo` is untouched while T works). An init script wraps
   `__nwqa.log.push` and `__nwqa.events.push` so every probe entry gets a
   timestamp on the same clock as the video (the probe keeps none), and
   polls DOM signals (radio lines, banners, PAY, hangar stats, continue
   screen). Output: `captures/<id>/capture.mp4` and `timeline.json`
   (gitignored, 74 MB).
2. `cut.ts`: one picker per moment type (data, not code paths): best
   instance by a stated rule (isolated lock, densest graze window, fastest
   isolated near miss, biggest volley, largest rate climb), clip of 4–10 s
   with about 2 s pre-roll, H.264 + AAC, poster at the anchor, ebur128
   integrated LUFS, LRA, true peak, and L/R RMS balance. Writes
   `clips/` and `moments.json`.
3. `gallery.ts`: guided `index.html` with the data inlined; it does not modify
   `moments.json`, `clips/`, capture reports, or the original measurements.

Re-run: `deno run -A --no-lock research/2026-10-28-moments/capture.ts [id]`,
then `cut.ts`, then `gallery.ts`.

## What was captured

| capture | query | length |
| --- | --- | --- |
| tutorial-2x-stall | `?skipto=tutorial&autoplay=fight&speed=2` | 201 s (capped, stalled) |
| tutorial | same at `speed=8` | 201 s (capped, stalled) |
| fight-s1 | `?skipto=sector1&autoplay=fight&speed=1` | 81 s |
| fight-s3 | `?skipto=sector3&autoplay=fight&speed=2` | 219 s, through the boss |
| disarm-s2 | `?skipto=sector2&autoplay=pacifist&speed=2` (the disarmer) | 81 s |
| boss-fight | `?skipto=boss&autoplay=fight&speed=2` | 69 s, through the kill ending |
| boss-pacifist | `?skipto=boss&autoplay=pacifist&speed=2` | 62 s, through Lanes Kept |
| hangar | `?qa=1`, cold boot, menu path to the hangar | 38 s |
| continue | `?skipto=sector5` with no input | 17 s |

All gameplay captures use `seed=121&qa=1`; the hangar uses `?qa=1`.
30 clips cut, including separate disarm and spared-departure clips because
the drift spans a flashback and cannot fit into a single ten-second clip.

## Gaps (missing moments)

- **Tutorial wink** (`tut_wink_001`): the tutorial stalls at module 4 at 2x
  and 8x. `tut_tap_001` asks for a tap, and `src/app/tutorialDemo.ts`
  scripts only movement and focus when no enemy is up, so `tutTapped` is
  never set and `tut_idle_001` nudges forever. The QA `tutorial` reel
  (which waits for `tut_wink_001`) must be failing for the same reason.
  Owner: A (tutorialDemo) or N (module order). The `tutorial-stall` clip is
  the evidence.
- **Shield absorbs a hit**: no shield pickup or `bark_shield_*` in any
  capture; per-shot `hit` events (with `absorbedByShield`) are excluded
  from the probe, and neither autopilot was hit while shielded.
- **Ghost autopilot**: `ghostAutopilot` exists in `src/pilots/pacifist.ts`
  but no URL flag selects it (`autoplay` takes only `fight|pacifist`). The
  ghost *line* was still captured: `skipto=boss` enters the descent before
  the disarmer fires, so the never-fired branch plays.

## Observations a human should check by ear and eye

- **Loudness is hot and uneven.** Capture mixes: sectors about -9 to
  -11 LUFS integrated, boss -7.7 to -7.9, true peak up to +0.1 dBTP
  (boss-pacifist) and -0.1 to -0.5 on most runs (QA's -1 dBTP warn). Clips
  in the arena sit at -5.5 to -7.5 LUFS (ghost-line, warden-falls, descent)
  and `lanes-kept` peaks at +0.9 dBTP, likely clipping. The hangar is near
  silent (-31 LUFS, 3 s audible of 38): no menu or hangar music bed?
- **Stereo image is centred in the mix.** Every clip's L/R RMS balance
  is 0.499–0.521; QA's post-panner spatial stem does move (p5 -0.2 to p95
  0.29 in fight-s1), but it does not survive into the full mix at a level
  that shifts overall balance. Listen to `near-miss-doppler`,
  `radio-lore`, `enemy-volley` on headphones: is the movement audible?
  Doppler cannot be verified from stats here.
- **Codex toasts show raw ids**: posters show "Codex: codex.enemy.turret",
  "codex.recorder.0121" (missing UI strings or a fallback path).
- **Continue screen layering**: a stale subtitle ("Your first live
  lock!...") and a codex toast stay visible under GAME OVER.
- **Idle death is very fast**: in sector 5 with no input, three lives go
  at exactly 2 s intervals (ticks 276, 396, 516) and GAME OVER lands 9 s
  in. Check post-hit invulnerability and whether that suits young players
  on Chromebooks (AGENTS.md platforms note).
- **Disarm reads**: the fight autopilot kills every scout it disarms in
  sector 1 about 0.5 s later (`disarm-then-kill`); in sector 3 disarmed
  scouts leave in 0.3–0.8 s, too fast to read as a power-down; only the
  disarmer's case drifts off slowly (26.7 s). The "spared" beat may not be
  legible.
- **Graze density**: 39 grazes in 4 s in sector 4 under the disarmer:
  check the graze tick does not become a buzz.
- **Word events have an empty line id** (the subtitle box has no
  `data-line`), so QA's word-pulse alignment cannot key pulses to cues by
  id. The clip was anchored on `desc_001` by time instead.
- **QA selector mismatch**: intel tags render as `.nw-intel`; the QA
  `scan-lock` reel waits for `.nw-intel-tag`.
- The dev-flags JSON panel is on screen in every autoplay capture; fine
  for QA, but these clips are not showcase-clean.
- Sector-1 skip: the first powerup triggers the flashback at 16 s, so the
  sector-3 recorder scene and the sector-1 flashback play the same
  `flash_rec_*` lines depending on entry point; worth a narrative check.

## Validation and snapshot caveat

`validation.json` records 30 passing codec, size, duration, and poster checks;
`deno task check` in this directory passes for all three scripts. The gallery
was browser-checked and its category filter corrected. `cut-report.txt` lists
the selected anchors and measured loudness. Capture-level checks are retained
in each local `captures/*/timeline.json`. No paid inference or auditory review
was performed, and no shared QA report directory was written.

These findings describe the private bundle built at 21:08 local time on
October 28. Other agents continued working during capture, so current source
or assets may already fix some findings. The second tutorial attempt at 8x is
supplementary failure evidence, not a natural-speed audio reference; gallery
tutorial clips come from the 2x attempt.

## Next step (after reviewing the captured snapshot)

Fix the tutorial demo (fire taps and a hold when the tutorial asks, with no
enemy up), add an `autoplay=ghost` flag, then re-run `capture.ts tutorial`
and `cut.ts` to fill the wink and ghost-run gaps. Have A audit the arena
mix level and the limiter ceiling against the clip measurements here.
