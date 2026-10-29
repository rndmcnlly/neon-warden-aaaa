# Bolt identity: October 29, 2026

## Framing

Adam's playtest note: individual bolts should look different for continuous
(stream/hold) and discrete (tap) fire, and Writs should be extra obvious with
even more knock. Scope: render and camera only. Sim timing, damage, speeds
and collision are unchanged (no `src/sim` or `src/contracts` edits).

Code: `ab5e4a6` (looks, knock, wave, impact, tests) and `8522158` (larger tap
slug after the first capture showed it read smaller than the old capsule).
Baseline for "before": `62dc815`.

## How rounds get their look

`BulletView` only says `kind: "shot"`. Instead of widening the contract, the
renderer tags each new round id from the same step's `playerFired` event (one
volley per tick), in `ShotTagger` (`src/render/shotLooks.ts`). Untagged rounds
(a late join or a seek) fall back to `classifyShot`, which reads tuning
speeds and radii. A test drives the real sim through a Writ, a tap and a hold
and checks every new round's tag against the event.

## What changed

| Shot | Bolt | Muzzle | Knock (world units; 1 unit = 40 sim px) |
| --- | --- | --- | --- |
| Tap | Short faceted slug, sharp head, pale cyan, 95% opacity, under the bloom threshold | Crisp four-point star, 70 ms | Camera 0.035, 38 ms settle (unchanged) |
| Stream | Thin, long tapered needles, 38% opacity, two lengths alternating, no flicker | Faint soft shimmer, 90 ms | None |
| Writ 1 / 2 / 3 | Lance (pale core in a cyan sheath) at 1 / 1.35 / 1.8x, shedding widening rings | Cream bloom held 35 ms, then falling; double ring (cream snap, cyan shove); cream sparks | Camera 0.15 / 0.20 / 0.25, 60 ms settle (was 0.063 / 0.081 / 0.099); drawn ship 0.05 / 0.09 / 0.13 down-lane with 0.12 / 0.18 / 0.25 rad nose-up, 90 ms settle |

Writ extras: a screen-space pressure wave (refraction only, no added light)
from the nose; a cream screen flash of 0.13 / 0.18 / 0.23 through FlashGuard;
hits a Writ delivers get a cyan ring, a cream snap ring and pale sparks, plus
a small trauma (0.06 per level).

The drawn ship's knock never moves the hitbox: the focus marker now follows
the sim position (`ctx.player`), not the drawn ship.

**Hitstop:** not done. `src/render/hitstop.ts` is policy only and is not
wired into the main loop (`src/main.ts` never calls it), so a release hitstop
would mean dropping sim ticks: out of render-only scope. Proposed next test:
wire `Hitstop` in `main.ts` behind a flag and A/B a 2-tick hold on Writ 3.

## Value roles and accessibility

- Player bolts stay cyan-family and additive. Tap and stream sit under the
  bloom threshold (1.5); the Writ lance's core plus sheath sums to about 1.6,
  so it glows slightly; enemy rims stay at gain 3.6 and remain the most
  saturated small things in every frame of the contact sheet. The cream
  release bloom is the one sanctioned exception.
- Shake 0 or reduced motion (setting or OS): no camera knock, no ship knock,
  no pressure wave (tests assert exact zero). Reduced flashing: Writ bloom
  gain capped, no hold, slower fade; FlashGuard caps the screen flash at 0.12
  and one onset a second.
- Low tier: same shapes (five instanced meshes, one draw call each while
  active); no bloom, so no pressure wave; trail chips stay off.

## Evidence

Viewer, one clip at a time with evidence revealed after watching:
[`viewer.html`](viewer.html). Still contact sheet: [`contact-sheet.jpg`](contact-sheet.jpg)
(top row before, bottom row after: tap, stream, Writ 1, 2, 3; right column
shake 0/reduced motion/reduced flashing above, low tier below).

Capture: `capture.ts`, isolated temporary builds of both arms (render files
from git, never the working tree or `qa/.build`), 1280x720, real time,
`?skipto=sector1&seed=121&qa=1`, game audio tapped and muxed (`qa/av.ts`).
`clips/summary.json` lists every clip. All 12 clips: zero page exceptions,
an AAC audio stream, true peak and bus loudness pass. "VO not dropped" fails
in 5 clips across both arms (before writ 1 and 2; after tap, writ 2 and low):
these short clips end during a radio line. after-tap also warns on integrated
loudness. Neither is caused by render changes.

A pink ring at the ship early in both tap clips predates this change.

## Checks

- `focused-tests.log`: 25 passed, 0 failed (`bolt_identity_test.ts`,
  `shot_feel_test.ts`, `render_logic_test.ts`, `render_hitstop_test.ts`).
- `check.log`: `deno task check` exit 0. Owned files pass `deno lint` and
  `deno fmt`; `git diff --check` clean.
- Reels: `qa/reports/20261029-022537/index.html`: gameplay-fight **pass**
  (15 assertions); scan-lock **fail** ("beam locks a target after a dwell").
  The same reel against the baseline build fails identically
  (`qa/reports/20261029-022803/index.html`, log `scan-lock-baseline.log`), so
  it is pre-existing and not caused by this work. Static: 58 pass, 6 warn.
- Full CI not run; not claimed green.

## Limits and next step

Video cannot establish hand feel, Chromebook frame rate or portrait layout.
Next: Adam plays tap, hold and Writ 1–3 hands-on; if the Writ still feels
light, try the hitstop wiring above rather than more camera travel.
