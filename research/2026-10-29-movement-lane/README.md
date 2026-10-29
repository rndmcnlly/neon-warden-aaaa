# Movement, lane floor, debris and VO sync (night plan step 4b)

## Framing question

MOVE was the one core verb with no sound and almost no picture of its own,
the lane floor was "a nearly flat blue slab" (Argon, step 2), flung debris
from 4a was "subtle at the gameplay camera's distance", and the Captain
recast opens every take with about 0.64 s of silence, so subtitles led the
voice by most of a second (`research/2026-10-29-vo-audit/`). Can render,
audio and metadata changes fix these without touching sim outcomes, and
without regressing 4a's feedback ladder?

Disciplines in play: game feel (thrust, banking), procedural sound design
(Web Audio synthesis, mixing), real-time rendering (instancing, shader
budgets), visual hierarchy (value and chroma below combat), speech timing
(onset measurement, subtitle sync), and QA practice (stale reels).

## What changed

| Item | Where | What |
| --- | --- | --- |
| Engine bed | `src/audio/engineBed.ts`, `gameplayAudio.ts`, `sfxPlayer.ts` | Two detuned saws through a low-pass (speed opens it and lifts pitch up to 3 semitones) plus band-passed noise driven by acceleration. Rise about 30 ms, fall about 150 ms. Focus: -5 dB, darker, a narrow band (Q 4) and a narrower pan. Pans a little by screen x; mono centers it. Sfx bus, so the faders and mono apply. One persistent voice; a dead man's switch fades it 0.25 s after its last update, so a frozen sim (flashback, scene) cannot drone. Off when the run ends or resets. |
| Reverse and stop transients | `synth.ts` (`moveReverse`, `moveStop`), `gameplaySounds.ts` | Noise chuffs under 60 ms (-20 and -22 dB), panned toward the nozzle that fires, cap 1, at least 140 ms apart. Detected from the movement that happened (`player.vel` against 4 ticks ago), so classic and hybrid behave alike (tested for both). |
| Thruster puffs | `src/render/thrusters.ts`, `stage.ts` | Pale slivers from the hull edge opposite the acceleration, 0.14–0.2 s, additive at 0.75 of a desaturated cyan-white, render order 2 (bullets are 10). One instanced mesh, pool 40 and 48 per second; low tier 10 and 16, one per burst. Focus: half as many, narrower. Reduced motion: half as many, shorter. |
| Banking | `thrusters.ts` (`bank`), `stage.ts` | Lean from the ship's lateral velocity (not the stick), up to 0.3 rad, settling in about 90 ms; focus 45%, reduced motion 50%. Render-only, no camera roll. |
| Lane floor | `shaders/floor.glsl.ts`, `backdrop.ts` | Plates with seams and grain; recessed conduits along and across the lane with thin packet streaks running both ways; a slow data pulse down each conduit; small go and caution signal lamps at major crossings cycling out of step; the ship's engine reflected down-lane. A background budget: everything is greyed toward luma (`saturation 0.38`), scaled (`gain 0.6`) and soft-kneed under a linear cap (`maxLinear 0.1`); lamps are added after it, dim. Activity runs on its own clock, which reduced motion freezes (the backdrop already gets dt 0). The low tier skips the activity (`uDetail`). |
| Debris | `src/render/debris.ts` | Bodies larger (chunks at least 0.3, torn-off model parts 1.8x), a steel-grey fresnel rim light (`onBeforeCompile`, one shared program), and a short grey smoke streak along each body's flight; flung faster and living longer. Still matte, angular, grey, sinking under the bullet plane. |
| VO start offset | `scripts/vo_onset.ts`, `scripts/sync_vo.ts`, `src/audio/manifests.ts`, `engine.ts` | `vo:sync` measures each take's speech onset (first 30 ms over -42 dBFS RMS, 10 ms windows) and stores `onsetS` in the stamps, in every take of `public/vo/cues.json`, and in the variants index. Files are untouched. `voStartS = onsetS - 0.12` (kept breath) is where playback starts (`source.start(0, startS)`, radio too); `durationMs` and word timings shift by the same amount, so subtitles and the word pulse run on the playback clock. |
| Tutorial barks | `src/director/tutorialProgress.ts`, `main.ts` | Wrong-input corrections only for human input (`humanInput` port: the keyboard pilot); the demo autopilot can no longer trigger the lockout line. Tests: the same input stream corrects a person and not the autopilot, and the 16 s lockout cooldown allows 2 lines in 30 s of corrections every 2 s. |
| CI | `emit_yaml.ts` and a repo-wide `deno fmt` | Lint `no-regex-spaces` fixed; formatting applied. |
| scan-lock reel | `qa/reels.ts` | Two stale causes, not a game bug: the first powerup (seed 121, tick 312) plays the flashback, which freezes the sim for longer than the 15 s lock deadline (the fight autopilot's first lock is tick 564, measured headless); and the intel selector `.nw-intel-tag` never existed under that name (it is `.nw-intel`). The reel now waits for the sim to run past the flashback and uses the real selector. |
| Spatial stem | `qa/av.ts`, `engineBed.ts` | The bed's panner is marked `nwSelf` and kept out of QA's post-panner stem, which measures world sounds moving around the ship. |

## Evidence

Viewer: [`index.html`](index.html), one clip at a time; the evidence unlocks
after a clip has played. 12 clips (6 topics, before and after), 854x480,
normal speed, real game audio through `qa/av.ts`. Before is `5035bfd` (4a's
final evidence commit), after is `5b1acd0`, each from a `git archive` build
served on a free port. `62c162a` changes only which node QA taps, not
the sound. Every recording: zero page errors, audio captured, true peak
pass. Capture: `capture.ts`; numbers: `analyze.py` into `metrics.json`
(floor key: `measure_floor.py`); clips: `cut_clips.py`; viewer: `viewer.py`.

**Lane floor**, medians over 12 frames (1 fps, 2–14 s, 1280x720, lane
rectangle only; "combat" is pixels with value at least 0.6 and saturation at
least 0.35, so dim enemies, debris and the scan cone count as floor, which
makes the floor numbers higher, not lower):

| Sector | Arm | Floor value (p95) | Floor HSV sat. | Floor chroma (p95) | Combat value | Combat chroma |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | before | 0.49 (0.54) | 0.77 | 0.38 (0.40) | 0.65 | 0.37 |
| 1 | after | 0.28 (0.38) | 0.42 | 0.11 (0.18) | 0.64 | 0.26 |
| 3 | before | 0.49 (0.52) | 0.77 | 0.38 (0.39) | 0.67 | 0.40 |
| 3 | after | 0.28 (0.36) | 0.42 | 0.11 (0.17) | 0.65 | 0.28 |

Before, the floor was as colorful as combat (chroma 0.38 against 0.37).
After, it sits at less than half of combat's chroma and well under its
value, while carrying far more activity. HSV saturation is reported because
the brief names it, but it overstates dark navy; chroma (max minus min of
RGB) is the fairer measure. Argon's target was value at most 0.32 and
saturation at most 0.40: value passes (median 0.28), saturation sits at
0.42, just over. All sectors share one floor look (only the dioramas around
the lane differ), so the two sectors measure the same budget against
different waves; the boss arena's look is warmer and also greyed now
(visible in `debris-frames.jpg`).

**Movement sound**, music muted (`move-sfx`), 50 ms RMS in dBFS:

| Arm | Direction-change peak | Clip median | Focus cruise |
| --- | ---: | ---: | ---: |
| before | -47.3 | -51.8 | -51.8 |
| after | -37.9 | -43.9 | -48.4 |

Direction changes rise 9.4 dB (the transients); the clip's floor rises 7.9
dB (the bed); focus cruise sits 4.5 dB under the clip median, as designed.
Enemy sound effects fall in the same windows (story difficulty, live
enemies), so cruise-versus-rest medians are noisy; they are in
`metrics.json` but not claimed.

**VO sync** (tutorial, voice and subtitles on): the time from a subtitle
appearing to the take's first audible speech, per line, from the measured
onsets and the logged buffer starts: before 0.71–0.85 s (median 0.75), after
0.12 s for every line (the kept breath). Onsets agree with forced alignment
where both exist (Captain `tut_move_000` onset 0.78 s, first word 0.80 s;
`desc_ai_002` 1.05 and 1.04 s). Captain English median onset 0.70 s, original
voice 0.27 s, 912 takes measured (669 base, 243 variant).

**Debris**: `debris-frames.jpg`, Warden pod break, before (top) and after
(bottom), four frames from 0.06 to 1.2 s after the event. Before, the pod's
debris is not visible at this size; after, grey rim-lit bodies and a smoke
streak tumble up and left off the pod. The first sector disarm in the
`debris` capture happens at the top edge (y = 80) under the sector banner
and leaves the screen at once in both arms, so it cannot judge readability;
the pod break replaced it.

## Checks

- `deno task ci` on the working tree at `62c162a`: exit 0 (`deno fmt
  --check`, `deno lint`, `deno task check`, `deno task test` 256 passed,
  `deno task build`; `ci.log`). Formatting of `AGENTS.md`,
  `docs/SKILLS.md` and `docs/INTEGRATION-QUEUE.md` is applied in the working
  tree but not committed: those files carry other uncommitted edits (the
  main session's); CI from a clean checkout of HEAD would still flag them
  until they are committed.
- Full `deno task qa` at `62c162a`, foreground:
  `qa/reports/20261029-050318/index.html`, 321 checks pass, 6 warn, 6 fail;
  reels 13 pass, 5 fail. Not green. Every failing reel fails the same way
  at the before revision `5035bfd`: `tutorial` (wink deadline),
  `ending-pacifist` (outcome predicate) and `graze` (`.nw-hud-graze`) fail
  in reports since `20261028-222855`; `boot-cinematic` (logo frame 13 KB
  under a 14 KB blank threshold) and `spatial-audio` ("only 18 audible
  windows") were rerun on a `5035bfd` archive tonight and fail identically.
  Before the `nwSelf` exclusion, the engine bed did change `spatial-audio`'s
  reason (balance pinned near centre); with it, the reel matches baseline.
  `scan-lock` now passes (`20261029-043520`, and in the full run).

## Limits

- No blind observer has seen these clips; they are numbers and stills. Step
  5 should ask whether movement direction and focus are heard and seen.
- Footage cannot establish hand feel: Adam should fly classic and hybrid
  (`?movement=hybrid`) and listen to the bed on headphones and laptop
  speakers. The bed's level was set by measurement, not by ear.
- The puffs are subtle next to the ship's bloom halo; at 854x480 they read
  as faint slivers. Phone and Chromebook visibility untested.
- The torn-off Warden pod is round; grey and rim-lit, not pink or glowing,
  but a judge should be asked whether it resembles a bullet.
- The low tier's cheaper floor and puffs were not captured.
- The VO lead numbers are derived from onsets and buffer starts, not
  measured in the captured audio.

## Next step

Step 5: a blind pass on these clips (movement direction and focus by sound
and picture, floor versus combat, debris versus bullets, subtitle sync),
then Adam flies both controllers with sound on.
