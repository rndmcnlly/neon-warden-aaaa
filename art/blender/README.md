# art/blender: Blender as code

Every 3D asset in `public/models/` is built by a Python script in this folder,
run headless in Blender 5.2.1 LTS. No `.blend` file is a source of truth: edit
the script, rerun it, and the `.glb`, its stats and its preview are rebuilt.

## Rebuild

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender

$B -b --factory-startup -P art/blender/build_all.py        # everything (about 8 s)
$B -b --factory-startup -P art/blender/build_all.py -- drone warden   # a subset
$B -b --factory-startup -P art/blender/drone.py            # one asset, no manifest update
$B -b --factory-startup -P art/blender/build_all.py -- --no-render    # skip previews
```

Each run writes:

- `public/models/<asset>.glb`: what the renderer loads.
- `art/blender/stats/<asset>.json`: triangles (after modifiers), bytes, node
  names, emissive materials, triangles per node.
- `public/models/manifest.json` (from `build_all.py`): the stats of all assets
  in one file the renderer can read.
- `research/2026-10-28-art-renders/<asset>.png`: a four-view EEVEE sheet
  (three orbit angles plus the gameplay top-down view, or a straight-on view
  for the logos and figure). `pilot_figure_helmet.png` is a helmet close-up.

`build_all.py` runs every asset inside one Blender process (one Dock icon on
macOS, not eleven). It executes each asset script with `runpy` as
`__main__`, exactly as if launched alone; each script begins with
`c.reset()`, which calls `read_factory_settings(use_empty=True)` and clears
the material cache, so no scene state leaks between assets. A script that
raises is reported as FAILED and the rest still build. The manifest is
rewritten from all `stats/*.json` on every run, subset or not.

## Files

| File | Role |
| --- | --- |
| `common.py` | Palette, materials, mesh generators (prism, torus, strip, ...), modifiers, export, stats, preview renderer. Read this first. |
| `<asset>.py` | One script per asset; its docstring states the design intent and node names. |
| `pickups.py`, `logos.py` | Shared builders for the two pickups and the two logos; the per-asset scripts are three-line wrappers. |
| `build_all.py` | Rebuilds everything (or a subset) in one process and writes the manifest. |
| `fonts/Orbitron.ttf` | The original game's title face (SIL OFL 1.1, `fonts/OFL.txt`), used for logo text. |

The modeling idiom is deliberately small: most parts are a 2D outline in the
playfield plane extruded by `prism()` (with an optional tapered top), plus a
bevel modifier. That keeps each silhouette identical to the original sprite
from the top-down camera, and keeps the scripts readable for students.

## Conventions the renderer must know

- **Scale:** 1 unit = 10 original pixels. The 480 x 640 playfield is 48 x 64
  units; the ship is about 4.8 units wide, the Warden 20 x 14. Collision radii
  convert the same way (player hitbox 6 px = 0.6 units). Exception:
  `pilot_figure` is in meters, 1.8 tall, feet at the origin.
- **Axes (glTF, Y-up):** gameplay models lie flat in the XZ plane, height on
  +Y. Up the screen is **-Z**. The player ship's nose points -Z. Enemies face
  +Z (toward the player): the dart's tip, the Warden's crest tip and the
  lancer's spike all point +Z. The lancer's long axis is X and it is
  symmetric, so pincer pairs need no mirroring. A top-down camera looking
  down -Y with its up vector set to -Z reproduces the original framing.
- **Logos and figure** stand upright (+Y up) facing **+Z**, centered on the
  origin (the figure at its feet). Logos are about 11 units wide.
- **Origins** are each asset's gameplay center (the original sprite center).
- **Emissive parts** are separate meshes whose material name ends in `_emit`.
  Emission strength ships via `KHR_materials_emissive_strength` (6 by
  default, 8–12 for cores), so values exceed 1 and bloom picks them up.
  Clone the material before flashing one instance.
- **Renderer hook names:** `src/render/stage.ts` finds parts by exact,
  unprefixed name, so these six nodes carry those names: `engine` (ship
  exhaust disk, pulsed by scale), `thruster` (dart exhaust disk, flared at
  commit), `crown` (turret pivot, spun with `rotation.y`), `halo`, `core`,
  `armor` (Warden). Everything else is prefixed by asset.
- **Pivots:** parts that move on their own are empties with the mesh as a
  child: `crown`, `ship_thrust_ring`, `halo`, `warden_ring_outer`,
  `warden_ring_inner`, `warden_blast_door`, `pilot_helmet`. `halo` and its two
  ring pivots ship with a -90 deg X rotation so their local Z points up: the
  renderer spins `halo` with `rotation.z` (it overwrites only `.z`, so the
  baked `.x` survives). Spin `crown` with `rotation.y` (no baked rotation).
- **Extensions used:** clearcoat, emissive strength, and transmission (ship
  canopy only). three.js `GLTFLoader` supports all three. No textures, no UVs.
- **Node names** use only `[a-z0-9_]`, so three.js keeps them verbatim:
  `gltf.scene.getObjectByName("warden_core")`.

## Assets, triangles and named nodes

Triangles are counted after modifiers (what ships). Total: about 25,300.

| Asset | Tris | Notes and named nodes |
| --- | ---: | --- |
| `pilot_ship.glb` | 2,354 | Kite delta, canards, canopy (glass), gimbal ring. `ship_core_gem` (hitbox marker), `engine` (exhaust disk), `ship_nozzle`, `ship_thrust_ring`, `ship_trim`. Customization: `socket_weapon` > `weapon_<id>`, `socket_sensor` > `sensor_<id>` (every package id in `src/contracts/loadout.ts`), `ship_decals` > `decal_<id>`; materials `ship_paint`, `ship_trim_emit`, `ship_engine_emit` are recolored by `src/render/loadout.ts`. Bank by rolling the root about Z. |
| `drone.glb` | 1,880 | Scout pod with an eye inside an elliptical ring (28 x 16 px). `drone_eye` (hit flash), `drone_ring_trim`, `drone_ring`, `drone_body`. |
| `dart.glb` | 320 | Unarmed swept blade. `thruster` (exhaust disk, flare at tick 50 when it commits), `dart_nozzle`, `dart_trim`. |
| `turret.glb` | 1,184 | Hex drum, legs, six-barrel crown. `crown` (pivot: spin), `turret_core` (white, hit flash), `turret_legs`, `turret_trim`. |
| `lancer.glb` | 362 | Flat diamond with gold heraldry. `lancer_spike` (flash before each volley), `lancer_crest`, `lancer_trim`. |
| `warden.glb` | 9,580 | Wave-3 remodel (see the script docstring): layered heart, `pod_0`..`pod_3` at the sim's pod offsets, `core` at the origin, `warden_seams` > `warden_seam_1/2/3` (one tier lit per phase), `warden_shield` shell, plus `halo` and `armor`. Old notes follow. |
| (old) `warden.glb` | 5,140 | Crest bulwark, crimson crown, gold halo rings, caged sun. `core` (separate node: pulse and hit flash), `halo` pivot holding `warden_ring_outer` / `warden_ring_inner` pivots with `*_lights` children (each with its own emissive material, so rings can go dark one at a time), `armor` group holding `warden_plate_ul/ur/ll/lr` (phase breakaway), `warden_blast_door` with `_l` / `_r` halves (slide apart along X), `warden_cage`, `warden_crown`, `warden_muzzle`, `warden_emitters`. |
| `pickup_spread.glb` | 260 | Data crystal in a flight-recorder sleeve inside a diamond cage. `spread_cage`, `spread_crystal`, `spread_recorder`, `spread_dots` (the original's three dots). |
| `pickup_shield.glb` | 1,012 | Same cage in cyan, ring core. `shield_cage`, `shield_ring`, `shield_core`. |
| `pilot_figure_issued.glb`, `pilot_figure_worn.glb` | 3,864 / 3,352 | Wave-3 helmet in two variants from one builder (`pilot_figure.py`): tall narrow head, raked brow, dark glossy visor band, no grille, cheek vent, temple light; issued (Authority white, LA-0121) and worn (repainted, scuffed). The notes below are the retired `pilot_figure.glb`. |
| (retired) `pilot_figure.glb` | 2,932 | Helmeted contractor, static pose, no rig. Original helmet: smooth shell, midline ridge, comm pods, a crest-shaped faceplate with a downward-chevron opaque visor (no T-visor, no face). `pilot_helmet` (pivot at the neck), `pilot_visor`, `pilot_visor_line` (emissive), `pilot_cape`, `pilot_chest_light`, `pilot_bracer_light`. |
| `logo_adamsmith_systems.glb` | 5,744 | Hex emblem with a chevron monogram, Orbitron wordmark. `ass_emblem`, `ass_emblem_glow`, `ass_glyph`, `ass_wordmark`, `ass_underline`. |
| `logo_cm121.glb` | 5,060 | Chamfered plate, CM121 wordmark, gold "f26 COHORT" hex badge. `cm_plate`, `cm_plate_rim`, `cm_wordmark`, `cm_tagline`, `cm_cohort_badge`, `cm_cohort_text`, `cm_cohort_label`. |

## Notes and known limits

- The entity bible suggested parody poly counts (40k ship, 150–300k Warden).
  These assets stay at web-friendly counts instead; the polish is in
  silhouette, material and emissive design. Raising counts is a matter of
  bevel segments and torus resolution in the scripts.
- The visor, faceplate, ship nose and Warden crest share one shape on
  purpose (a downward crest or chevron): a quiet visual rhyme between the
  contractor and the thing he is paid to kill.
- No animations ship in the glTF; motion is the renderer's job, driven by
  the pivots above. A rig for `pilot_figure` would be a next step if
  cutscenes need gestures.
- Preview sheets are EEVEE stills without bloom, so emissive parts look
  flatter than in-game.
- Logo text is player-facing but a brand mark, so it is not localized.
- After a rebuild, run `deno fmt public/models/manifest.json`: Python's JSON
  layout is not `deno fmt`'s, and CI checks formatting.
