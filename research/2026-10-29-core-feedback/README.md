# Core feedback: the ladder, disarm, Writ, pods, life lost (night plan step 4a)

## Framing question

Step 2 verified five perceptual failures: disarms read as kills, Warden pod
breaks do not read, Writ hit and miss sound alike and tiers blur, Writs into
a deflecting Warden sit 1.5 dB above the mix, and a life lost on a kill tick
goes unnoticed (`research/2026-10-29-argon-core-ideation/`). Step 3 adopted
items 1–7 (`docs/NIGHT-PLAN.md`). Can render, audio and a tick-domain
hitstop fix them without touching sim outcomes or replay determinism?

Disciplines in play: game feel (hit confirmation, hitstop), sound design and
mixing (voice management, ducking), real-time rendering (kinematic debris,
shader patches), and deterministic simulation (replays as a contract).

## What changed, rung by rung

The ladder is data in `src/render/feedbackLadder.ts`: graze < hull hit <
armor deflect < weak-point hit < part break < disarm < kill < pod break <
life lost. A test checks that each rung differs from its neighbors in at
least two of sound, shape and motion.

| Rung | Sound | Shape and motion |
| --- | --- | --- |
| Hull hit (stream) | `hit_enemy` at -17 dB, merged per tick into one voice (+2 dB per doubling, at most +6) | 2 small sparks at the impact point; hull flash 0.35, at most every 100 ms |
| Deflect | `hit_deflect` plus a synthesized `ricochet_tink` (2.4 to 1.3 kHz ping), both merged per tick | two slate streaks reflected about the armor normal; no flash, no punch |
| Weak-point hit | tap: synthesized `tap_impact` crack; Writ: `writ_impact_1/2/3` (tier 1 crack, tier 2 adds a ring a fifth up, tier 3 adds a 110 to 45 Hz sub drop and shimmer), ducking music 3/5/8 dB | only the struck part flashes (part materials isolated); reduced flashing swaps it for an outline ring; seams glow amber |
| Part break | `part_break` clank | the real model node, or a hull chunk, is flung along the shot, spun by `cross(hitOffset, shotDir)`, darkens and settles under the bullet plane |
| Disarm | `disarm_unlatch` then `power_down` (new samples), no boom | the weapon part detaches (drone eye, turret crown or a chunk); the hull's lights drain, it sags 0.35 units, noses down, wobbles and coughs dark smoke as it leaves |
| Kill | unchanged explosions; now placed where the enemy was last drawn | unchanged |
| Pod break | `pod_break` (new sample, 0 dB, ducks music 8 dB) | heavy pod debris plus two plating chunks, gold blast and ring, 5-tick hitstop |
| Life lost | `life_lost` plus `life_alarm` (new sample); clears every unprotected voice below priority 6; music ducks 14 dB with a 700 Hz low-pass | 7-tick hitstop, a rectangular red frame closing in from the edges (`uEdge` in the finish shader), same-tick kill feedback deferred 0.35 s (sound and picture) |

Also: damage states (scorch darkening plus a procedural crack network that
opens with damage and glows amber for about 0.4 s after a hit, a shader
patch in `src/render/vfx.ts`; the Warden's pods scorch by their own hp), a
Writ miss fizzle (`writ_miss`, new sample) on the new `writMissed` event,
and protected threat cues (enemy fire, near miss, player hit, life lost,
alarm, Warden roar are never stolen for room).

Found on the way: `stage.ts` pooled a killed enemy's slot before handling its
`kill` event, so `whereIs` fell back to the player's position. Kills now use
the last drawn position (`lastSeen`). Not separately verified in footage.

## Sim contract additions (additive, deterministic)

`hit` gained `pos` (the round's center, or the ship for rams and enemy fire),
`shotVel`, `by`, `level` and `part`; `partBreak` gained `hitPos` and
`shotVel`; new event `writMissed` (a Writ leaving the screen untouched). No
state, RNG draw or outcome changed: `sim_runs_test` replays pass unchanged.
The QA probe keeps `hit` and `playerFired` in a separate bounded `impacts`
buffer (`8ea86c1`) so evidence can find them.

## Hitstop design

`src/app/tickLoop.ts` spends the ticks the frame loop grants. A frozen tick
calls neither `pilot.next` nor `sim.step`: no input is read (held keys and
queued taps wait for the next real tick) and wall time never leaks into the
sim. Frozen ticks are dropped, not owed. While frozen the renderer holds
`alpha = 1`; debris, particles and the edge frame keep animating on wall
time, which is what makes the separation visible during the freeze.

Durations (`LADDER[...].hitstopTicks`): disarm 2, big or clean kill 3, pod
break 5, life lost 7. Crowd rule: at most 10 frozen ticks per 60 loop ticks;
a lost life ignores the budget. Off when autoplay runs faster than real time
(`speed >= 2`), so QA reels keep their pacing; on for human play and 1x
autoplay. Reduced motion keeps the freeze (no motion is added by it).

Determinism evidence (`tests/core_feedback_test.ts`, `focused-tests.log`,
27 passed): the fight autopilot on the Warden, and the fight and pacifist
autopilots from sector 1 to their endings, run through `runTicks` in 3-tick
frames with hitstop on and off produce identical event logs (JSON) and
identical final state hashes, with frozen ticks greater than zero.

## Sounds and spend

Crisp and tonal roles are synthesized (`src/audio/synth.ts`: `crack`,
`writImpact(tier)`, `tink`, plus stand-ins for every sampled role). Five
sampled roles got 4–5 deliberately different briefs each, not seed-only
variation (`sfx/gameplay.yaml`; `sfx/render.py` now accepts a `briefs` list
and records each candidate's brief): `disarm_unlatch`, `power_down`,
`pod_break`, `life_alarm`, `writ_miss`. 23 ElevenLabs SFX v2 renders on fal,
23.3 s billed, **US $0.0466** of the US $1.50 budget (`research/SPEND.md`).
Picks are `--provisional` (cleanest take) in `sfx/picks-gameplay.json`;
all candidates remain in `sfx/candidates/gameplay/` for Adam's audition
(`sfx/audition.html?set=gameplay`).

## Evidence

Viewer: [`index.html`](index.html), one clip at a time; the evidence unlocks
after the clip ends. 20 clips, before `3b8f258` and after `010d6ba`, from
isolated `git archive` builds served on free ports, normal speed, 1280x720
captured (854x480 clips), real game audio through `qa/av.ts`, voice muted and
subtitles off. Every recording: zero page errors, audio captured, true peak
pass. Windows were chosen from sim events (`pick_clips.py`), never by eye.

Audio probe: the 50 ms RMS peak from 50 ms before to 600 ms after the anchor
event, minus the clip's median (dB).

| Topic | Before anchor | Before | After anchor | After |
| --- | --- | ---: | --- | ---: |
| disarm | writ clip, disarm | 8.2 | writ clip, disarm | 9.1 |
| pod-break | boss pacifist, partBreak | 1.0 | boss pacifist, partBreak | 6.1 |
| writ1-hit | writ clip, hit | 8.2 | writ1 clip, hit | 9.3 |
| writ3-hit | writ clip, hit | 3.1 | writ clip, hit | 9.1 |
| writ1-miss | writ clip, release | 3.6 | writ clip, release | 9.3 |
| writ3-miss | writ clip, release | 2.9 | writ clip, release | 4.7 |
| deflect / writ-deflect | boss fight, blocked hit | 8.1 | boss fight, blocked hit | 6.8 |
| dense | boss fight, densest second | 2.4 | boss fight, densest second | 2.2 |
| life-kill | ram clip, lifeLost | 0.5 | ram clip, lifeLost | 9.5 |

Read with care: the two arms are separate real-time runs, so the moments
differ (scripted input and hitstop shift timing). Miss rows are anchored on
the release, so they measure the release, not the fizzle; the fizzle starts
when `writMissed` fires (listed in each clip's truth). Deflect and
writ-deflect are the same moment (the descent, when everything is blocked).
The probe is the full mix, not per bus.

`after-debris-frames.jpg`: after-arm frames 0.1–0.9 s after a disarm (top)
and a pod break (bottom). Debris is visible as small dark tumbling bodies;
at the gameplay camera's distance it is subtle.

Debris bug found by this capture and fixed in `010d6ba`: parts sank to
y = -0.9, below the opaque lane floor, and vanished in about 0.15 s.

## Checks

- `ci.log`: `deno task ci` stops at `deno fmt --check` on 11 files outside
  this work (docs, AGENTS.md, branding SVGs, manifests, status). Not green.
- `ci-steps.log`, remaining steps run separately: `deno task check` pass,
  `deno task test` 246 passed, `deno task build` pass; `deno task lint` fails
  on one pre-existing error in `src/scenes/banks/emit_yaml.ts`.
- Reels, final revision `010d6ba`: `qa/reports/20261029-040728/index.html`
  (`reels-final.log`): gameplay-fight pass, disarm-boss pass, scan-lock fail
  ("beam locks a target after a dwell"), identical to the pre-existing
  failure in `qa/reports/20261029-022803` on the bolt-identity baseline. An
  earlier run (`qa/reports/20261029-033938`, `reels.log`) failed
  gameplay-fight on "VO not dropped: 10 of 12"; the same reel passed on the
  final run, and that reel runs at 4x where hitstop is off: treat as flaky.

## Limits

- No blind observer saw these clips yet; the probe shows loudness, not
  comprehension. Step 5 should re-ask disarm versus kill explicitly.
- Footage cannot establish hand feel of the freezes; Adam should play a
  boss fight and lose a life on purpose.
- Debris may be too small to read on a phone or a Chromebook screen;
  low tier keeps 8 bodies.
- Kill feedback deferral is wall-time (0.35 s), not tied to the freeze end.
- The sampled picks are the cleanest takes by measurement, not by ear.

## Next step

Step 5: a blind pass on these before/after clips (disarm versus kill, pod
break, Writ hit versus miss, life lost on a kill tick), then Adam auditions
the five sampled roles in context and plays with hitstop.
