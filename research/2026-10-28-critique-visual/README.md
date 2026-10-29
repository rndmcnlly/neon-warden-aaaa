# Visual art direction critique, October 28, 2026

## Framing question

What do shipped, high-polish shmups and rhythm-action games do with value,
color, bloom, silhouette, camera and feedback that _Neon Warden AAAA_ does not
yet do, and which ten changes buy the most "AAAA" per hour of work?

Disciplines in play: visual design (value and color theory, composition),
real-time rendering (three.js post-processing, instancing, shaders), 3D
modeling (Blender `bpy` hard-surface), and game feel (readability under load).

## Sources

Ours (downscaled copies in `ours/`):

- QA run `qa/reports/20261028-191037/` (newest at time of writing; `latest`
  still pointed at `20261028-190249`, which has no sheets): contact sheets for
  gameplay-fight, boss, flashback, tutorial; single frames pulled from
  `reel.webm` at 4 s, 14 s and 20 s.
- `research/2026-10-28-render-shots/` (sector, warden boss, pilot closeup).
- `research/2026-10-28-art-renders/` (warden, pilot_figure_helmet, pilot_ship).

Comparators: four official Steam store screenshots each for Rez Infinite,
Tetris Effect: Connected, Ikaruga, Sky Force Reloaded, Ex-Zodiac, CYGNI: All
Guns Blazing, Thumper, Returnal and Hi-Fi RUSH (`comparators/`, index sheet
`side/comparator-index.jpg`). Fetched by `scripts/fetch_comparators.py` via the
public `appdetails` API; files checked for a JPEG header and never executed.

Side-by-sides (ours left, comparator right) in `side/`, built by
`scripts/compose.py`, which also writes `side/stats.md` (luminance and
saturation measurements). Second opinion from an image model was attempted
and blocked by a read-permission gate, so nothing was spent.

## Measured value structure (`side/stats.md`)

| image                    | mean lum | % near-black | % hot (>0.85) | % midtones | mean sat |
| ------------------------ | -------- | ------------ | ------------- | ---------- | -------- |
| ours: sector (render)    | 0.144    | 52.7         | 1.31          | 21.7       | 0.36     |
| ours: gameplay frame     | 0.094    | 50.4         | 0.32          | 9.7        | 0.34     |
| ours: boss frame         | 0.090    | 41.6         | 0.46          | 5.6        | 0.58     |
| ours: post-boss drift    | 0.061    | 61.0         | 0.12          | 3.7        | 0.51     |
| ours: warden render      | 0.188    | 42.5         | 2.41          | 25.5       | 0.28     |
| Sky Force Reloaded       | 0.228    | 6.3          | 2.90          | 29.4       | 0.77     |
| Ikaruga                  | 0.309    | 0.8          | 2.21          | 57.5       | 0.12     |
| Rez Infinite             | 0.154    | 40.5         | 2.35          | 15.0       | 0.73     |
| CYGNI                    | 0.172    | 46.8         | 2.68          | 23.0       | 0.67     |
| Thumper                  | 0.163    | 48.4         | 3.74          | 18.5       | 0.66     |
| Returnal                 | 0.366    | 1.7          | 8.50          | 40.7       | 0.55     |

Reading: dark-void games (Rez, Thumper, CYGNI, Tetris Effect) are as black as
we are, so "too dark" is not the diagnosis. The difference is in the other two
columns: they spend 2.4–3.7% of pixels on hot highlights and 15–23% on
midtones; our live gameplay frames spend 0.1–0.5% hot and 4–10% midtone. Our
frames are black plus a thin layer of medium glow: no top of the value range
(nothing reads as the brightest, most important thing) and no middle (nothing
describes the space). Our one hot frame, the warden render, is hot in the
wrong place: bloom whites out the boss and saturation collapses to 0.28.

## What the comparators do that we do not

1. **Value hierarchy by role.** Sky Force (`side/01`) and Ikaruga (`side/02`)
   keep a strict ladder: enemy bullets are the hottest, most saturated small
   things on screen; the player ship is the brightest large thing; enemies are
   mid; the ground is low-mid and desaturated. In our sector shot every class
   (player shots, enemy orbs, wire enemies, gold chevrons) is the same
   near-white glow, and the player ship is the dimmest object in its own
   column.
2. **Bullet readability language.** Ikaruga's enemy shots are rings with a
   dark core-to-colored-rim shape; Sky Force's are warm orbs against a cool
   world; Returnal (`side/05`) puts saturated cyan danger over a low-saturation
   orange set. Our player shots and enemy orbs both render as white-cored
   blobs whose hue survives only in the halo, and the halo is what bloom
   blends together. Shape does not carry ownership (capsule vs orb is close
   at small size).
3. **Bloom discipline.** Comparators bloom a few emitters hard and leave the
   rest crisp. Ours blooms everything a little (UnrealBloom strength from
   tier, radius 0.35, threshold 1.05 in `src/render/post.ts:59`), so when 120
   bullets arrive (`side/07`, warden scene) the halos sum into a white fog over
   the boss.
4. **Color budget.** Tetris Effect (`side/07`) and Rez commit each scene to
   one or two hue families with one accent. We run five or six families at
   once (cyan rails, pink orbs, gold chevrons, violet and magenta nebula, red
   boss, mint drone) at equal weight, so none of them means anything.
5. **Depth cues.** Rez has a lit floor grid; Thumper (`side/06`) makes the
   track itself the composition with a vanishing point; Returnal uses
   atmospheric perspective. Our playfield floats in a starfield with thin rail
   lines and dark pillars; with the tilted camera the rails become diagonal
   slashes that fight the vertical bullet flow (gameplay sheet, post-boss
   drift frame).
6. **Camera.** Comparators frame the action and hold it. Our rig poses vary
   strongly between beats and the post-boss and boss-intro frames show a rolled
   or side-on playfield (`ours/frame-boss.jpg`: ship pointing right, boss
   off-frame top right). Roll noise in `cameraRig.ts:212–218` on top of that
   reads as drift rather than intent.
7. **Boss presence.** CYGNI (`side/04`) gives the boss a third of the frame,
   a shield silhouette, rim light and a clear weak point. Our Warden in
   gameplay is a small red pentagon at 5–8% of frame width, and in the boss
   reel's opening it is off-frame.
8. **Hit feedback and motion.** Comparator stills show hit sparks, debris,
   shockwave rings and screen-space streaks in almost every frame. Our frames
   show almost no impact events; kills read as disappearance.
9. **Silhouette and material.** Returnal and Hi-Fi RUSH heroes have
   designed silhouettes and rim light. Our pilot is primitive blocks under flat
   key light, and the ship is a thin outline that disappears at gameplay scale.

## Model critiques

### Pilot helmet (`ours/model-pilot_figure_helmet.jpg`, `shot-03`)

- The silhouette reads as toy robot or tokusatsu (round dome, glowing
  horizontal eye strip, mouth grille slots), not as a terse, faceless hired
  gun. Din Djarin reads through a tall, narrow, slightly forward-leaning head
  with a hard brow line and a dark, non-emissive visor. Our dome plus emissive
  slit plus "teeth" is friendly.
- Proportions: the helmet is nearly spherical and sits on a cylinder neck with
  visible gap, on a cuboid torso with a cuboid chest panel. No bevels, so
  every edge is a hard CG edge that takes no highlight.
- Materials: uniform grey plastic, no roughness variation, no wear, no
  secondary color. The single orange pauldron reads as a placeholder, not a
  design choice.
- Fixes: elongate the head (scale Z 1.15, narrow X 0.9), cut a forward-raked
  brow plane, make the visor a dark glossy recessed band (roughness 0.08,
  metalness 0.0, near-black with an environment reflection) rather than
  emissive, delete the mouth grille in favor of one asymmetric detail (a
  single vertical vent or rangefinder stalk on one side, our own invention),
  add bevel modifiers (`width 0.01–0.02`, 2 segments) to all hard edges, a
  cowl or collar ring to hide the neck gap, and a two-tone paint split with
  scratches baked into a roughness map. Keep one small emissive accent (a
  status light at the temple) as the "eye" the camera can find in the dark.

### The Warden (`ours/model-warden.jpg`, `shot-02`)

- From above (the gameplay view) it reads as a red heart-shaped coaster: flat
  slab, no height, and the most interesting detail (the gold eye ring) is
  small and center-mounted where bloom erases it.
- The silhouette is closed. A boss needs negative space and parts that move:
  arms, fins, segmented rings, a crown of emitters.
- The spikes along the rear edge are only visible from low angles, which the
  gameplay camera never uses.
- Material: one glossy red with gold trim; no emissive pattern to animate, so
  phase changes cannot be shown in the model itself.
- Fixes: give it a layered top-down silhouette (central eye in a rotating
  outer ring, two articulated side "gate" arms that open in phase 2, which
  also fits the lane-keeper fiction), extrude height so the top view has
  stacked tiers casting shadow on each other, name the moving parts as
  separate glTF nodes (`ring_outer`, `arm_L`, `arm_R`, `eye`), and add an
  emissive mask texture (lines and panel seams) whose intensity the game can
  drive per phase. For the "misunderstood" turn, a damaged-state variant with
  dimmed emissives and exposed soft interior (warm, not red) would carry the
  pathos without text.

## Prioritized top-10 change list

| #  | change                                        | impact | effort |
| -- | --------------------------------------------- | ------ | ------ |
| 1  | Role-based value ladder and bullet language   | high   | low    |
| 2  | Selective bloom (only emitters that matter)   | high   | medium |
| 3  | Lock and simplify the gameplay camera         | high   | low    |
| 4  | Per-scene color budget (two hues plus accent) | high   | low    |
| 5  | Floor plane and depth cues                    | high   | medium |
| 6  | Hit feedback kit                              | high   | medium |
| 7  | Warden remodel for top-down silhouette        | high   | medium |
| 8  | Player ship readability (filled body, rim)    | medium | low    |
| 9  | Pilot helmet remodel and materials            | medium | medium |
| 10 | Background busyness control near bullets      | medium | low    |

### Implementation notes

1. **Value ladder and bullet language.** In `palette.ts` add role tokens
   (`dangerCore`, `dangerRim`, `playerShot`, `enemyBody`, `world`) on top of
   the hue tokens, so roles, not hues, are the API. Enemy orbs: shader with a
   dark (or saturated, not white) center and a bright saturated rim, i.e. a
   ring, so they stay distinct after bloom: `alpha = smoothstep(.55,.7,r) *
   (1.-smoothstep(.85,1.,r))`, color `dangerRim * 3.0` HDR in the ring, core
   `dangerCore * 0.4`. Player shots: thin, elongated, cyan, HDR 1.5 (below
   enemy shots), additive, with 40–60% lower opacity so they never compete
   with danger. Enemies: mid value fills (see 8) rather than white wire.
2. **Selective bloom.** Put bloom-worthy meshes on a layer
   (`obj.layers.enable(BLOOM_LAYER)`) and use the standard two-composer
   selective bloom (render bloom layer with others darkened, composite with a
   mix shader), or simpler: raise threshold to about 1.6 and push only the
   intended emitters above it (enemy bullet rims, boss eye, player engine,
   pickups). Lower radius slightly (0.2–0.25) and cap strength under bullet
   density: `bloom.strength = base * clamp(1.2 - bullets/200, .5, 1.)`. This
   prevents the white fog seen in `side/07`.
3. **Camera.** Gameplay pose should be one fixed tilt (around 25–30 degrees
   from top-down, fov 35–40), no roll during live play (gate the
   `rotateZ(roll...)` at `cameraRig.ts:218` on a `cinematic` flag) and lanes
   vertical on screen. Spend the dramatic angles only in non-interactive
   beats (boss intro, flashback) and always ease back over 0.6–1.0 s. The
   post-boss drift pose should keep the player and boss inside the safe
   frame.
4. **Color budget.** Define a scene "look" object (it already exists as
   `look.bloomScale` in `post.ts`): `{world: hueA, accent: hueB, danger: fixed}`.
   Sector 1 cool (cyan/violet world, magenta danger), boss warm-red world with
   cyan danger (the Returnal inversion: danger is the complement of the set),
   flashback desaturated amber. Nebula, rails and pillars take the world hue
   at low saturation; danger stays constant across scenes so the player learns
   it once. Optionally a final LUT pass (`LUTPass` in three examples) per
   scene.
5. **Floor and depth.** A large plane under the playfield with a shader grid
   (`fract(uv*N)` lines, scroll by `uScroll`, fade by distance and by
   `FogExp2`) at value 0.15–0.25 gives the midtone band we lack (the Rez
   move). Add a soft additive ground-glow decal under the player and the boss
   (a radial gradient quad), plus height fog on pillars. Raise fog density
   modestly so far geometry desaturates toward the world hue instead of black.
6. **Hit feedback.** Kit, all instanced: (a) on enemy hit, 2-frame white flash
   of the enemy material via an `uHit` uniform; (b) on kill, a shockwave ring
   (expanding quad, ring shader, 0.25 s) plus 12–20 sparks in `particles.ts`
   with velocity inheritance; (c) 40–60 ms hitstop on large kills; (d)
   camera shake as a short decaying impulse, separate from roll noise; (e)
   on player damage, a chromatic-aberration and vignette pulse, routed
   through `flashGuard.ts` so the accessibility setting still applies.
7. **Warden remodel.** In Blender: model from the top orthographic view first,
   checking the silhouette with a flat black material and a white background
   (the "squint test"), then add height. Separate objects for moving parts,
   pivots at their hinge, export as named glTF nodes; animate in three.js
   rather than baking. Emissive seam mask as a separate texture or vertex
   color channel; drive `emissiveIntensity` by phase. Target about 40% of
   playfield width at its largest phase, with a translucent shield shell
   (fresnel shader) during the invulnerable phase as in CYGNI.
8. **Ship readability.** Fill the player ship with a dark body
   (`MeshStandardMaterial`, metalness 0.6, roughness 0.35) and keep the cyan
   outline as rim (fresnel term or an inverted-hull outline). Add an engine
   plume (additive cone, HDR 2.0) as the hottest point on the player, so the
   eye finds the ship first. Same treatment, in mid values, for enemy bodies.
9. **Pilot helmet.** See the model section. In `bpy`: `bevel` modifier on all
   hard surfaces, separate visor material, a baked AO plus edge-wear roughness
   map (Cycles bake, 1K is enough for a closeup), and a rim light in the
   closeup scene (back light at 3x key, cool) so the silhouette separates from
   the black.
10. **Background busyness.** Nebula and pillar emissive caps are
    pinkish and sit at bullet-like values (`side/03`, `side/05`). Cap
    background value at about 0.35 in the nebula shader, keep backdrop hue
    away from the danger hue, and darken the backdrop in a soft column around
    the player lane (screen-space vignette mask) when bullet count is high.

## Code observations

- Good: `palette.ts` is a single source of truth by role (Flyweight-like
  token table), and `post.ts` documents its pass order and why bloom runs
  before tone mapping. Both make the changes above one-file edits.
- Smell: the camera rig mixes cinematic noise and gameplay framing in one
  update, so a cosmetic setting (roll) leaks into readability. Split into a
  framing pose and an additive cinematic layer with an explicit enable flag.

## Status

- Done: comparator download, eight side-by-sides, value stats, model critiques.
- Not done: image-model second opinion (read permission denied, US $0 spent,
  nothing logged to `research/SPEND.md`).
- Next step: do items 1–4 as one pass (all low effort, mostly `palette.ts`,
  `post.ts`, `cameraRig.ts`, `bullets.ts`), then re-run the gameplay-fight and
  boss reels and compare `side/stats.md` numbers: target 2–4% hot pixels and
  15%+ midtones in live gameplay frames.
