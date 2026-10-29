# Shot feel: October 28, 2026

## Framing and decision

Make Pilot's shots feel faster and more material without changing movement,
aim, the player collision box, trigger timing, damage, or the selected
Captain/cand1 audio. Implemented a focused simulation/rendering pass.
Baseline source: `3f785ff`. Both capture arms use the current shared public
assets, including the user's selected audio, without running `vo:sync`.

## Speed and collision

All speeds increased exactly 50%. Writ retains its slower-than-tap, large,
piercing character. Simulation remains deterministic at 60 Hz.

| Shot | Before units/tick | After units/tick | Before/after units/sec | 640-unit transit before/after |
| --- | ---: | ---: | ---: | ---: |
| Tap (aimed) | 14 | 21 | 840 / 1260 | 0.762 / 0.508 s |
| Stream | 11 | 16.5 | 660 / 990 | 0.970 / 0.646 s |
| Writ | 12 | 18 | 720 / 1080 | 0.889 / 0.593 s |

The transit column is distance/speed, not a claim about an enemy's position.
Actual fixed-step measurements from the default muzzle (`y=542`) to crossing
the top (`y<=0`): tap **26 ticks / 0.433 s**, stream **33 / 0.550 s**,
Writ **31 / 0.517 s**. Corresponding old values from the old tuning are
39 / 0.650 s, 50 / 0.833 s, and 46 / 0.767 s.

Swept circle tests cover the complete tick segment against scout hulls,
weapon parts, Warden pods, and hull/core contact. Locked-Writ weakpoint
selection retains the existing alignment semantics after swept contact.
No collision substeps, variable timestep, or RNG draws were introduced.
Piercing Writs now resolve multiple crossed hulls within one tick rather
than skipping the second hull after advancing past it.

## Recoil and trails

- Tap immediately trucks camera and target up-lane by 0.035 world units,
  producing perceived down-lane recoil. Monotonic exponential settling has
  a 38 ms time constant. No roll, zoom, ship displacement, or sim input change.
- Writ uses the same non-oscillating envelope at 0.063–0.099 world units
  according to level, replacing its old generic trauma wobble. Stream adds
  no kick. Multiple queued shots take the maximum pulse, not a sum.
- Shake zero, the reduce-motion setting, and OS reduced motion suppress
  recoil. Regression checks compare both camera position and orientation.
- A dedicated 384-chip instanced pool adds one draw call while active.
  Matte cyan rectangular chips shrink and darken over 120–220 ms. Their
  forward drift is small; no additive transparency, white flash, bloom
  gain, or duplicate ribbon is introduced. Existing bullet capsules and
  ship engine trails remain separate.
- Interpolated shot positions fill intervening path samples, including
  several ticks per rendered frame. Emission is capped at 48 chips/frame
  (medium: 20; low/Chromebook: zero). Discontinuous/backward time or a jump
  over six ticks clears history instead of drawing a seek streak.
- Cosmetic randomness is renderer-only. Sim RNG is untouched. No sound
  assets, scheduling, or audio code changed: the immediate tap sound and
  existing role caps and global 24-SFX-voice bound remain in force.

## QA and review artifacts

Status: focused checks pass; repository-wide CI is **not green**.

- `focused-tests.log`: **58 passed, 0 failed**, including fixed-step speed
  measurements, narrow-chord part tunneling regression, tiny weakpoint/pod
  sweep checks, multi-hull Writ penetration, exact camera suppression,
  particle cap/low-tier/seek tests, deterministic replay, tutorial, audio,
  and fighting/pacifist/disarming autopilot endings across seeds/difficulties.
- `check.log`: `deno task check` passed. Owned production/test paths passed
  focused lint and formatting. `git diff --check` passed.
- `tests.log`: full suite **202 passed, 1 failed**. Unrelated existing failure:
  `tests/banks_test.ts:58`, “vo/script.yaml mirrors the voiced variants”.
  No VO or banks files were modified by this workstream.
- `ci.log`: CI stops at formatting, before lint/check/tests/build: six
  unrelated files (`public/branding/incubator-mark.svg`,
  `public/branding/studio-mark.svg`, `public/sfx/manifest.json`,
  `docs/WAVE3.md`, `docs/WAVE4.md`, `docs/INTEGRATION-QUEUE.md`).
- Static QA: `qa/reports/20261028-231816/index.html`: **32 pass, 6 warn,
  0 fail, 0 pending**. Warnings: translation width risk (126), 18 marginal
  ASR takes, two unused models, two near-budget models, two unknown animated
  nodes, one missing music brief. These are not introduced by shot changes.
- Isolated production builds succeeded for both arms. Four real-time,
  approximately 11-second clips cover tap, stream, charged Writ, and a
  shake-zero/low-graphics variant. Existing QA AV capture/mux/analysis is
  reused. All four: no page exceptions, audio captured, true peak passed,
  loudness passed, VO-not-dropped passed. See each `result.json` for values.

| Arm | High | Shake zero + low graphics |
| --- | --- | --- |
| Before | [clip](before-high/reel.mp4), [sheet](before-high/sheet.jpg) | [clip](before-shake-off-low/reel.mp4), [sheet](before-shake-off-low/sheet.jpg) |
| After | [clip](after-high/reel.mp4), [sheet](after-high/sheet.jpg) | [clip](after-shake-off-low/reel.mp4), [sheet](after-shake-off-low/sheet.jpg) |

The sheets were inspected for playfield readability; tiny chips and recoil
need the full-resolution moving clip, not a downscaled contact sheet. The
capture is real time (`speed=1`, no autopilot) rather than frame-lockstep:
browser scheduling and cosmetic randomness can differ between arms.
Reduced flashing is enabled in both arms, and low disables the new chips.
OS reduced motion and exact shake-zero behavior are covered by rig tests;
this is not a physical Chromebook/iOS hardware-performance certification.

## Reproduce / next step

Run `deno run -A research/2026-10-28-shot-feel/capture.ts` from the repo root.
It uses isolated temporary production builds and local report directories,
never the shared QA build or audio sync. Before sources are pinned to
`3f785ff`; both arms use current public assets. Paid calls: **none**.

Next: Adam's feel review of the two after clips. Keep movement/focus tuning
in its separate research workstream. The integrating session should link
this report from the production dashboard without claiming full CI passed.
