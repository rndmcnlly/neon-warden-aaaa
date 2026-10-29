# Visual pass, wave 3 (October 28, 2026)

## Framing question

Can the top items of `research/2026-10-28-critique-visual/` (value ladder,
bullet language, selective bloom, locked camera, color budget, floor) move
our live frames into the comparators' value structure (2–4% hot pixels,
15%+ midtones) while adding the wave-3 scan, charge, part and disarm VFX?

Disciplines: value and color theory, real-time rendering (three.js post,
instancing, GLSL), `bpy` hard-surface modeling, game feel.

## Method

`measure.py` samples one frame every 2 s from a QA reel (skipping
near-black frames) and reports the critique's metrics: % hot (luma > 0.85)
and % midtone (0.2–0.6), medians per reel. `shoot.ts` takes stills from
`render-harness.html` against a dev server for fast iteration.

## Results (median per reel; max in parentheses)

| reel           | before hot | before mid | after hot   | after mid    |
| -------------- | ---------- | ---------- | ----------- | ------------ |
| gameplay-fight | 0.40%      | 6.7%       | 0.53 (1.02) | 33.0% (47.9) |
| boss           | 0.34%      | 9.6%       | 0.76 (2.66) | 25.8% (46.7) |
| boot-cinematic | 1.52%      | 12.8%      | 0.46 (0.78) | 8.3% (35.4)  |

Before: `qa/reports/20261028-193218`. After: `qa/reports/20261028-203721`.
Harness stills: boss 2.4% hot / 31% mid, hangar 4.0% / 25%.

- Midtones: target met and then some, almost entirely from the lane floor
  (a world-hue grid plane at mid value). Comparable to Ikaruga's structure.
- Highlights: improved in gameplay and boss, still under target. The hot
  band needs near-white pixels; we now spend them on enemy-ring inner edges,
  the engine plume, the self-lit ship paint and the boss core. Dense boss
  moments reach 2.7%. Boot dropped because the logo emissives now sit under
  the bloom threshold (the critique asked for selective bloom).
- Bug found on the way: the shield fresnel shader could produce NaN
  (`pow` of a negative base, reversed `smoothstep` edges); one NaN pixel
  blackened the whole frame through bloom whenever the Warden's shield or
  the player's shield showed.

## Options for the remaining gap (not done)

1. Let a short list of logo emissives bloom (boot only): cheap, restores
   the boot reel's highlights.
2. White-hot kill flashes and Writ release streaks (more hot pixels exactly
   when something matters): medium, belongs with the hitstop request to A.
3. Raise exposure per scene through `SceneLook`: cheap, but risks pushing
   the floor out of the midtone band.

## Status

Done: items 1–4 and 6 (except hitstop, requested from A), 7–9 and 10 (density
column on the floor, nebula cap); new VFX; Warden, helmet variants, ship
sockets. Next: option 1 above, a derelict recorder model, hangar polish.
