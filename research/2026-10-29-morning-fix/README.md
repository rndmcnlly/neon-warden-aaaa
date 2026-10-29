# Morning fix: floor clutter, disarm state, Writ on armor, shot shapes

## Framing question

Night verification (`research/2026-10-29-night-verification/`) found the
blind judge preferred the BEFORE build in 7 of 10 pairs, naming the new lane
floor's dashes and dots as clutter in 9 of 10; disarms went unreported more
often; Writs on the armored Warden rose only 2.5 dB over the mix; tap rounds
and the scan cone were read as charged shots. Can render and audio changes
(no sim, timing or determinism changes) fix the top three by measurement?

Disciplines in play: visual hierarchy (value and local contrast below
combat), procedural sound design and mixing (spatial attenuation, ducking),
shape language (silhouette per tier), and QA honesty (what a clip can and
cannot show).

## What changed

| Item | Where | What |
| --- | --- | --- |
| 1 Floor | `src/render/shaders/floor.glsl.ts` | Cut the thin bright packet dashes (both directions) and the small square signal lamps. Kept: plates, seams, grain, recessed conduits, the reflection. Added: a long, soft swell drifting slowly down each conduit (several world units per period) and large, dim go or caution pools at some major crossings, breathing over about 25 s. Grid lines lowered (minor 0.22 to 0.12, major 0.8 to 0.35 of the line hue). |
| 2 Disarm | `src/render/stage.ts`, `vfx.ts` | For about 1.8 s after a disarm: three slate power-down pulses (0.45, 0.95, 1.55 s, shrinking), and the stub where the part tore off spits short cream sparks (fewer under reduced motion or flashing). Hull color drains further (to 40%, was 55%). Existing: emissives drain to grey, sag, sputter smoke, the flung part tumbles 1.4 s, the sim's retreat. Slot reuse now clears `disarmedAt` too (a latent stale-state smell). |
| 3 Writ on armor | `src/audio/synth.ts` (`writBlocked`), `gameplaySounds.ts`, `gameplayAudio.ts` | A blocked Writ plays `writ_blocked_N`: inharmonic triangle partials of a thick plate (1, 2.76, 5.4 times a root that drops per tier), low-passed at 2.4 kHz, a dark noise thud, and a deflect hiss sweeping 7 to 1.8 kHz. Tier gains +3, +5, +7 dB, music duck -4, -6, -8 dB. **Not spatial**: the Warden sits far up-lane, where distance placement cut the sound about 10 dB and low-passed the hiss away (the first attempt measured no change for this reason). Stream deflects keep the merged tink cluster; a blocked Writ no longer plays the damaging crack. Tests: `tests/core_feedback_test.ts`. |
| 4 Shot shapes | `src/render/bullets.ts`, `vfx.ts` | Writ 1: narrow lance (70% width). Writ 2: lance plus two flat swept fins. Writ 3: full lance over a wide flat wedge, and only tier 3 sheds rings. Tap slug about 20% smaller. Scan cone: the sharp, blooming leading arc is now broad and dim (0.12 of before, below bloom), edges half as bright; nothing in the cone is a line. |

## Evidence

Builds: BEFORE is a `git archive` of `78eebec`; AFTER is that archive with
this change's seven source files overlaid. Both built with `vite build`
(committed `public/vo`, no `vo:sync`), served by `qa/capture.ts` on free
ports, captured by `capture.ts` (adapted from the movement-lane capture):
1280x720 Playwright Chromium, normal speed, `seed=121&qa=1`, voice muted and
subtitles off, real audio tap. Every recording: zero page errors, audio
captured, true peak pass, integrated loudness warn (below -20 LUFS, as in
every night-verification clip). Numbers: `measure.py` into `metrics.json`.

Clips (`clips/`, 854x480 with audio, normal speed): `floor-{before,after}`
(sector 1, 2-8 s), `disarm-{before,after}` (sector 2 pacifist, the disarm at
about 1.0 s into the clip), `writ-armor-{before,after}` (Warden intro, Writ
3s into the deflecting hull at about 0.7, 2.7 and 4.7 s). Stills:
`floor-frame-before-after.png` (lane, 6 s), `disarm-frames.png` (+0.1, 0.5,
1.0, 1.5 s after the disarm; before top, after bottom).

**1 Floor**, medians over 11 frames (1 fps, 2-12 s), lane rectangle only,
the movement-lane key (combat: value at least 0.6 and saturation at least
0.35). "Marks" are blobs of 4-200 px at least 0.10 above their 15 px local
median and more than 15 px from any combat pixel: the size of a bullet or
pickup.

| Arm | Floor value (p95) | Combat value | Combat / floor | Local contrast p99 | Small bright marks per frame |
| --- | ---: | ---: | ---: | ---: | ---: |
| before | 0.28 (0.39) | 0.64 | 2.3x | 0.090 | 38 |
| after | 0.18 (0.33) | 0.65 | 3.6x | 0.082 | 18 |

Floor value falls a third, combat over floor rises from 2.3x to 3.6x, small
marks halve. The remaining 18 are mostly not floor: the scan cone's edges,
thruster puffs and dim enemy trim count under this key (visible in the
still). The still shows the dashes and orange, green dots gone.

**3 Writ on armor**, 16 Writ 3s blocked by the Warden in the 40 s `armor`
capture (matched by seed and script; hit times agree within 35 ms):

| Measure | Before | After |
| --- | ---: | ---: |
| 50 ms peak 0-600 ms after the hit, minus median of the 0.9 s before (night verification's measure) | 3.3 dB (1.9-23.7) | **6.5 dB** (4.5-30.9) |
| Same 450 ms window, after minus before, by band (60-250 Hz, 250-1k, 1-4k, 4-12k) | | +4.4, +3.7, +0.1, +3.9 dB |

Night verification's target was at least 6 dB (BEFORE's sector Writ 3 hit);
the median now meets it. It is largest while the Warden is far (first
four hits +15 to +27 dB broadband over the second before the release) and
smaller once the Warden's intro VO ducks sfx (about -4 dB) from 8.75 s.
The 1-4 kHz band does not rise: the clang is deliberately dull, so its
distinctness from a damaging hit's crack is timbral, not only loudness.
True peak stayed at -8.1 dBTP; no new loudness warnings.

**2 Disarm** and **4 shapes**: not measured. The only sector disarm in the
seeded captures happens at the top edge under the sector banner (y = 80)
and leaves the screen at once in both arms (the same limit movement-lane
reported); a tutorial pacifist capture had no disarm in 45 s. In
`disarm-frames.png` the after hull is visibly darker at +0.5 s, the rest is
off-screen. A mid-screen disarm capture (a reel that disarms a scout in the
middle of the lane) is needed before claiming item 2 reads.

## Checks

- `deno task ci` on the working tree: exit 0 (fmt, lint, check, 257 tests,
  build; `ci.log` in this folder, gitignored, local only).
- `deno task qa:reel gameplay-fight disarm-boss`:
  `qa/reports/20261029-054748/index.html`, both reels pass (15 and 14
  assertions), 61 pass, 6 warn (pre-existing coverage and asset warnings),
  0 fail.

## Limits and next step

- No blind observer has seen these clips; numbers and stills only. Next:
  rerun night verification's Pass B on picture-only floor pairs and Pass A
  on `writ` and `tap` windows (targets there: strength right at least 50%,
  charged claims in Writ-free clips near zero).
- Disarm legibility needs a capture with a mid-screen disarm and a human
  look at normal speed; nothing here shows it works.
- Mac viewport only; nothing about Chromebook cost (the fin and wedge meshes
  add two instanced draw calls; the floor shader got cheaper: two packet
  loops and the lamp mask removed).
