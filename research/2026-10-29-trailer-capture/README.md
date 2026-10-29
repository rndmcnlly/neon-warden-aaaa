# Master capture for trailers (October 29, 2026)

## Framing question

The trailer prep pass (`research/2026-10-29-trailer-prep/README.md`, section
5) left one gate before master compute: takes came from Playwright's recorder
at 1280x720, 25 fps, about 0.76 Mbit/s. What capture path gives 1920x1080 at
60 fps with no dropped or doubled frames, visually lossless intermediates,
High graphics and the game's audio in sync, and what does it cost in wall
time?

Disciplines in play: browser rendering internals (compositor frames, rAF,
Web Audio clocks), video engineering (frame pacing, chroma subsampling,
intermediates), audio post (sync tolerance) and measurement design (one
metric applied the same way to every path).

## Approaches

| id | path | how |
| --- | --- | --- |
| A | Playwright `recordVideo`, real time | the existing draft path at master size, audio by `qa/av.ts` (MediaRecorder tap placed by wall-clock epoch) |
| B | CDP `Page.startScreencast`, real time | JPEG q100 every compositor frame, conformed to CFR 60 from frame timestamps, `qa/av.ts` audio |
| C | **deterministic stepping, PNG** (`trailer/master.ts`) | virtual clock, one 60 Hz frame per step, `Page.captureScreenshot` PNG, slaved audio clock, AudioWorklet tap |
| D | as C, JPEG q100 grabs | faster grab, 4:2:0 chroma |
| E | as C, grabbed at 2560x1440 | `deviceScaleFactor` 4/3 (same CSS layout), Lanczos to 1080p |

How C works (details in the header of `trailer/master.ts`):

1. An init script replaces `performance.now`, `Date.now`,
   `requestAnimationFrame` and the timers with a clock that moves only when
   the driver steps it; CSS and Web Animations are paused and advanced by
   hand. In autoplay the sim runs one tick per rAF (`src/main.ts`), so one
   step is exactly one tick whatever the grab costs.
2. Every `AudioContext` is really suspended between steps; each step resumes
   it until `currentTime` reaches the virtual time, then suspends. The game
   still sees `state === "running"`; its own pause suspends the audio clock
   while virtual time continues, recorded as run segments.
3. An AudioWorklet copies the master mix with its sample frame numbers, so
   the WAV is placed by sample count, not by wall-clock chunk times.
4. CDP screenshots of the composited page (WebGL canvas, DOM HUD and captions
   together) go straight into FFmpeg: x264 4:4:4 CRF 14 plus FLAC.

## Method

`compare.ts` (this folder) runs each path on the same window: sector 2, fight
autopilot, seed 121, 2 s lead-in then 10 s measured, viewport 1920x1080, one
browser at a time on the M3 Max. A sync marker is injected in every path:
every 2 s of page time, a white 40x40 square in the top-left corner for
100 ms and a 9.5 kHz beep started in the same frame. A/V offset is the beep's
onset in the audio track minus the first video frame showing the square.
Duplicates are frames whose mean luma difference from the previous one is
under 0.02 (the marker corner excluded). Sharpness is FFmpeg `blurdetect`
(lower is sharper). Raw numbers: `compare.json`. Files stay in
`trailer/.cache/compare/` (gitignored, about 1 GB).

## Findings

| | A recordVideo | B screencast | **C stepped PNG** | D stepped JPEG | E stepped 1440p |
| --- | --- | --- | --- | --- | --- |
| output | 1920x1080 @ 25 | 1920x1080 @ 60 | 1920x1080 @ 60 | 1920x1080 @ 60 | 1920x1080 @ 60 |
| distinct frames / s | 24.8 | 59.8 | **59.9 (all)** | 59.9 | 59.9 |
| game tick rate | **115 Hz (about 1.9x speed)** | 120 Hz (2x) | **60 Hz exact** | 60 Hz | 60 Hz |
| video bitrate | 1.6 Mbit/s (raw VP8 1.2) | 99 Mbit/s | 80 Mbit/s | 100 Mbit/s | 36 Mbit/s |
| blurdetect | 4.79 | 3.91 | **3.86** | 3.89 | 4.04 |
| A/V offset (6 markers) | +155 to +221 ms (audio late) | -74 to -22 ms (audio early) | **+2 to +7 ms** | +2 to +7 ms | +2 to +7 ms |
| wall for 13 s | 16 s | 16 s | 130 s (10x) | 94 s (7.2x) | 183 s (14x) |

1. **The real-time paths run the game at the wrong speed.** Headless
   Chromium on this Mac fires rAF at about 120 Hz, and autoplay advances one
   tick per rAF, so A and B play combat at roughly 2x. The existing draft
   takes show it: in the cached draft `s2-fight` take, events arrive at 116
   ticks per second during play and the second Writ break lands at 6.85 s,
   against 12.67 s in the master take. VO-paced scenes (the flashback) take
   the same 7.8 s per line in both, so drafts compress action but not
   dialogue. This is a new finding about every real-time take, and it may
   matter for QA reels that use `autoplay` (not checked here).
2. **A is soft and late.** 25 fps and blurdetect 4.79 confirm the gate; the
   `qa/av.ts` epoch placement leaves audio 155–221 ms late. ITU-R BT.1359
   puts detectability at about 45 ms of audio lead and 125 ms of lag
   (acceptability about 90 / 185 ms), so this is visible on hits.
3. **B has every frame but not the game's pacing.** The compositor delivered
   79 frames per second (120 Hz rAF, some coalesced), so it can be conformed
   to 60, but the game still ran at 2x and audio landed 22–74 ms early with
   jitter (past the 45 ms lead threshold on some hits).
4. **C is exact.** Every frame distinct, the tick rate exactly 60 Hz by
   construction, audio 2–7 ms late (the measured per-step overshoot of the
   suspend: mean 2.6 ms, max 5–11 ms), the sharpest blurdetect score. The
   cost is wall time.
5. **D** halves grab time (41 ms against 86 ms per frame) at the price of
   4:2:0 JPEG before the encoder: a reasonable fast mode, not the default.
6. **E** is not simply "better": the film-grain pass draws per pixel, so
   downscaling 1440p averages the grain away (bitrate 36 Mbit/s against 80)
   and blurdetect reads the extra antialiasing as softer edges. It changes the
   look the art direction chose, at twice the wall time of D. Declined as
   default; kept as `scale` in `GrabOptions`.

Winner: **C**. Integrated as `deno task trailer <cut> --master`.

## Integration

- `trailer/master.ts`: the virtual clock, slaved audio, worklet tap, grabber
  and WAV placement.
- `trailer/capture.ts`: `captureMaster` for takes whose recipe has
  `capture: "master"`; `runSteps` now takes a clock, so `wait`, `press`,
  `until`, `waitFor`, `advanceTo`, `navigate` and `settingsTabs` step frames
  instead of sleeping. `goto` is refused in master takes (a new document
  restarts the clock); no current trailer take uses it. Draft takes keep the
  wall clock, the recorder and the same recipe hashes (the cached draft takes
  were reused unchanged; re-assembling the draft dry run from cache gave the
  same shots).
- `trailer/trailer.ts`: `--master` marks every take `capture: "master"`
  (its own cache key), forces `display.preset: "high"`, `renderScale: 1`,
  and assembles at 60 fps. With `--shots` it writes a `-partial` master
  (placeholders allowed, never public). The real-time non-draft path is left
  in place but documented as off pace.
- Takes now hold `take.mp4` (x264 4:4:4 CRF 14, FLAC) and `timeline.json`
  with a `capture` block: frames, step and grab ms, audio overshoot.
- No `qa/` file was changed; `compare.ts` imports `qa/capture.ts` and
  `qa/av.ts` as libraries.

## Master dry run (October 29, 2026, frozen build `87abcda3a762ff21` from `fdfcee6`)

`deno task trailer teaser30 --lang en --master --shots hook-writ,graze-curtain,warden-stop`

| take | game time | wall | factor | step + grab per frame | audio overshoot mean / max | file |
| --- | --- | --- | --- | --- | --- | --- |
| s2-fight | 75.0 s | 516 s | 6.9x | 23.5 + 90.4 ms | 2.5 / 10.7 ms | 812 MB, 90 Mbit/s |
| boss-descent | 19.8 s | 127 s | 6.4x | 22.9 + 82.1 ms | 2.8 / 5.3 ms | 175 MB, 74 Mbit/s |

Total 11 min 35 s including a 50 s master assemble (`slow`, CRF 16).
`teaser30-en-partial.mp4`: 1920x1080 at 60 fps, 22 Mbit/s, -16.0 LUFS,
-2.0 dBTP, blurdetect 3.94 (the draft animatic: 5.46). All four take-backed
shots resolved (hook-writ, graze-curtain, warden-arrives, warden-stop);
place-kill and doubt are placeholders as in the draft. In a 10 s window of
each take (2–12 s), 599 of 599 frame-to-frame differences were nonzero; both
takes logged zero page errors. Report and a 1-frame-per-2.45 s
contact sheet: `teaser30-en-partial.report.json`,
`teaser30-en-partial-sheet.jpg`. The MP4 stays in `trailer/out/` (80 MB).

Consequence of finding 1 for the sheets: at true pace, `s2-fight`'s 75 s now
ends inside the flashback (the draft take reached sector 3 and the recorder
scene at 70 s). Shots anchored after the flashback in any cut need longer
`wait`s or later `skipto` starts. Teaser shots were unaffected; the 90 s and
compendium sheets were not re-checked here.

## Estimates (updated)

`deno task trailer estimate` bounds new capture at 85.3 min of game time for
all cuts and languages; at the measured 6.9x that is **at most 9.8 h** of
wall time in one browser (expected, using the prep pass's 60 min, about
7 h), plus about 1–2 min of master assemble per cut and language. Disk:
roughly 0.7–0.9 GB per minute of take, so about 60–75 GB for every take
(the cache is gitignored; prune after masters). Teaser30 alone: upper bound
7.6 min of game time, so at most 52 min wall, expected about 30 min. The
upper bounds may rise once sheets are re-timed for true pace (finding 1).

Unverified speedups: stepping is immune to frame pacing, so takes could run
in parallel browsers (one used about 3 of 16 cores); `--master` with JPEG
grabs (D) would cut about 40%. Neither is wired or measured yet.

## Limits

- Overshoot depends on how fast Chromium's fake audio sink suspends; 11 ms
  was the worst single step measured. Music and VO are added in post for
  trailers, so this bounds SFX sync only.
- Video elements and `requestVideoFrameCallback` are not virtualized; no
  trailer take shows video. Network loads run on the wall clock while the
  page is frozen (assets arrive "early" in game time); the page is stepped
  only after `networkidle`.
- Bus stems (`qa/av.ts` per-bus loudness) are not recorded in master takes;
  the take reports mix loudness only. The draft dry run is the evidence that
  music and voice buses are silent in trailer takes.
- Measured on one Mac. Not evidence about Chromebooks or mobile.

## Status and next step

Done: five-way bake-off, master path behind `--master`, master dry run for
the three teaser shots in EN, updated estimates. Not done: full masters (by
design), re-timing sheets for true pace, parallel capture.

Next: re-time `trailer90` and `compendium120` take recipes against master
timelines (`--master --plan` plus one capture each), try two browsers in
parallel and measure, then `deno task trailer teaser30 --lang all --master`.
