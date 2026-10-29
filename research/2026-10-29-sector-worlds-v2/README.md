# Sector worlds v2: specific places, not instanced blocks

## Framing

Adam's verdict on [pass one](../2026-10-29-sector-worlds/README.md): the out-of-lane world helped, but read as coarse abstract filler. Question: can each sector read as a **specific, named, functioning place** within a glance, while the combat lane stays clean? Disciplines: environmental storytelling (Jets'n'Guns-style inhabited industrial set pieces, not its assets or tone), procedural 3D modeling, real-time rendering budgets, localization, and blinded audiovisual review.

Code: **`113ca27`** (set pieces, runtime, tests), **`8774627`** (Last Approach fix after the blind judge). Viewer: [index.html](index.html), one clip at a time. Numbers: [performance.json](performance.json), [provenance.json](provenance.json), [judge answers](out/judge/).

## 1. Diagnosis of pass one

Annotated frozen stills (pass one at `c5fa3bf`): [Outer Drift](diagnosis-s1.jpg), [Gun Lanes](diagnosis-s3.jpg), [Lancer Gate](diagnosis-s4.jpg), [Last Approach](diagnosis-s5.jpg).

- **Silhouette:** every shape was a scaled cube. Seen from a near-top-down camera, a cube is a rectangle; nothing had a recognizable outline (a crane, a ship, a lighthouse).
- **Scale cues:** no windows, railings, ladders or lamps at human scale, so a block could be 2 m or 2 km. Size was unreadable, so function was too.
- **Function:** recipes described intent in code comments ("toll gantry", "nursery") that never reached the screen. No signage a glance could read.
- **Motion:** at most three slow mover bars; the blind judge described pass one as "completely static" in four of five sectors.
- **Lighting and value:** three flat materials gave every top face the same pale value, so blocks read as UI panels beside the lane, not as lit places.
- **Repetition and symmetry:** the same recipe 4–10 times per side, mirrored: decoration, not a place.

## 2. What each sector now depicts

| Sector | Set pieces (Blender kit) | Activity | Signage (EN example) |
| --- | --- | --- | --- |
| Outer Drift | Public beacon buoy (lantern tower, docking arms, keeper's hut); civilian haulers queued in two-way traffic; free waystation ring ahead | Lamp shutters turn, a warm beam sweeps; haulers bunch at the berth | "PUBLIC BEACON 7 / QUEUE HERE · NO FEE", deck "FREE PASSAGE" |
| Shatter Belt | Snapped Warren truss bridge (asset number struck out); Commons repair scaffold with mismatched patch plates, crew pod, workers; tumbling rock | Welding spark bursts, boom swings a plate | Brush-painted "COMMONS REPAIR CREW 08 / BRIDGE OPEN SOON (ISH)" |
| Gun Lanes | Lane Authority toll gantry over a side freight lane; freight pods; billing towers (lit office windows) | Pod stops, scanner curtain sweeps it, barrier arms lift, ticker scrolls | Ticker "TOLL DUE 0.00 · BILLED 4,812.00 · INSPECTION CAPACITY 0", "LANE AUTHORITY / BILLING DEPARTMENT" |
| Lancer Gate | Saltline transfer yard: yellow gantry crane, tinted container stacks, side bays, Saltline haulers | Crane picks, travels, sets down a Saltline container | "SALTLINE HAULERS / TRANSFER YARD", container "SALTLINE", "BAY 4 · KEEP CLEAR" |
| Last Approach | Masonry piers with flying buttresses and an inlaid lit heart; greenhouse bed of scout-ring pods; heart gate ahead | Tender arm rides the bed, pods breathe slowly | "QUIET PLEASE / SCOUTS GROWING", gate "OPEN TO ALL WHO COME UNARMED" |

Thirteen sign ids, each in EN, ES and ZH using the bible's glossary (`src/world/signage.ts`). Styles are physical: lit LED, stencil with bridges, weathered paint, brush on plywood, carved. The pass-one lull-gated discovery sign and archive are unchanged.

## 3. Construction

- **Blender as code, one process:** `art/blender/world/build_world.py` builds 16 set pieces plus 5 decimated `_lod` files (one Blender launch, about 1.5 s without previews). `kit.py` is the pedagogical core: windows, railings, ladders, bar lights (never round, bullet-like dots), hazard stripes, panels and 1.8 m workers, all vertex-colored and **merged into two meshes per node** (`_body`, `_lit_emit`). A set piece is 2 draw calls plus 2 per moving pivot. Sign empties carry panel size in meters; the renderer paints localized text on them. Preview sheets: [renders/](renders/).
- **Instanced rigs** (`src/world/kit.ts`): each glTF becomes a mesh-free skeleton plus parts; every copy gets its own skeleton, so barrier arms or cranes animate per copy while each part stays one `InstancedMesh`. This is the Flyweight pattern with per-instance extrinsic state.
- **Route** (`src/world/route.ts`): scenery is authored in route coordinates. Inside |rel| ≤ 8.5 units the mapping is exactly rigid (the ribbon research's planar combat patch); a quintic ramp to 24 units bends, sinks and converges pieces ahead. Combat code is untouched. A test asserts nothing above the lane floor intrudes into |x| ≤ 6.8.
- **Layers:** near dark silhouettes (desktop flair), mid hero set pieces beside the lane for the whole sector, far landmarks and instanced skyline fills (LODs).
- **Choreography** (`src/world/activity.ts`): pure functions of time, tested for continuity and bounds. Reduced motion freezes scroll and samples one composed instant (`REST_T`); reduced flashing turns sparks into a steady glow and drops the spill light.
- **Value separation:** world bodies in sector-tinted mid values with a small self-lit floor, lights through unshaded materials at 0.62–0.68, far layer darker; combat colors untouched.

## 4. Budgets (static estimate = measured runtime)

| Sector | High: draws / tris / sign textures | Low (school Chromebook): draws / tris / textures | Low keeps |
| --- | --- | --- | --- |
| Outer Drift | 21 / 12.8k / 0.52 MB | 11 / 5.9k / 0.52 MB | beacon, hauler queue, waystation LOD |
| Shatter Belt | 16 / 7.4k / 0.09 MB | 9 / 3.3k / 0.09 MB | truss, repair rig, rock LOD |
| Gun Lanes | 22 / 12.1k / 0.74 MB | 15 / 4.2k / 0.74 MB | gantry, pods, tower LOD |
| Lancer Gate | 27 / 19.5k / 0.31 MB | 9 / 7.4k / 0.13 MB | crane, container stacks |
| Last Approach | 15 / 22.0k / 0.44 MB | 10 / 7.5k / 0.44 MB | pier, nursery, heart gate LOD |

Caps enforced by `tests/world_sectors_test.ts`: high ≤ 48 draws, 90k tris, 4 MB; low ≤ 16 draws, 20k tris, 1.5 MB. All `public/models/world` glTFs total 2.1 MB on disk (offline pack includes them automatically). Measured world update CPU on the development Mac: 0–0.1 ms per frame (timer quantized). Runtime draw counts in captures matched the estimates (21, 16, 22, 27, 15). These are world-only numbers, not whole-game totals, and **no Chromebook or phone hardware was measured**.

## 5. Evidence

Frozen arms: `before` = `c5fa3bf` (pass one), `after` = `113ca27`, `after2` = `8774627` (sector 5 only), each a `git archive` with the same three selection overlays (hashes in [provenance.json](provenance.json)), direct Vite build, no `vo:sync`. Real gameplay, speed=1, no-fire autopilot seed 121, subtitles off, desktop 1366×768 and native portrait 390×844, 14 s each. All 22 clips: zero page exceptions; audio captured, true peak, bus loudness, integrated loudness and VO-drop checks all pass. Progress ran 50.7–51.4 sim ticks per wall second (rAF capped for the recorder), except sector 3 at 13.1 in **both** arms: the recorder pickup's flashback slows the sim. These are no-fire autopilot excerpts, not a pacifist run.

Value: mean luma of the side bands rose slightly (0.05–0.08 before, 0.06–0.10 after) while the lane stayed 0.24–0.41: the world sits under combat, but the band average is still below the visual critique's 0.15–0.25 floor target because open space between set pieces stays black. Objects themselves sit in mid values.

### Blind specificity test (Gemini Argon, OpenRouter, ZDR)

Eleven picture-only clips, neutral ids, one call each, same prompt asking only what kind of place, what is happening, who works or lives there, readable scenery text, timestamped evidence, confidence. Endpoint list saved; ZDR and denied data collection required with no fallback; every call returned Google. Cost **US $0.114942** of the $1.00 budget, logged in `research/SPEND.md`.

| Sector | Before (pass one) | After | Intent recovered? |
| --- | --- | --- | --- |
| Outer Drift | "abstract space with floating monolithic blocks", static, 0.05 | "outer space dock or orbital station", cargo ships moving, dockworkers and crews, 0.9 | Partly: dock and civilian cargo traffic yes; the beacon as a public lighthouse not named |
| Shatter Belt | "abstract debris field of geometric blocks", static, 0.1 | "asteroid field near an orbital truss", tumbling rock, construction implied, 0.85 | Partly: broken bridge setting yes; repair crew, sparks, Commons sign missed |
| Gun Lanes | "abstract blocky structures", static, 0.1 | "orbital tollbooth and administrative office complex", scrolling ticker, customs inspectors and billing clerks, 0.9 | Yes, including the joke: read "LANE AUTHORITY BILLING DEPARTMENT" and "INSPECTION CAPACITY 0" |
| Lancer Gate | "symmetrical blocky megastructure", static, 0.2 | "cargo shipping terminal and dockyard", gantry crane, containers, barges, logistics workers, 0.85 | Yes for function; Saltline identity not read |
| Last Approach (`113ca27`) | "abstract urban canyon", 0.25 | "caped penguin-like figures" and "spectator bleachers", 0.3 | **No**: figurative misread |
| Last Approach (`8774627`) | | "orbital cargo yard", cranes over rows of circular containers, 0.85 | Functioning place yes; the guardian's home, nursery and heart motif **not recovered** |

**Rejected judge claims** (checked against source; none exist): "HOLD WORK: 1", "SHIP DOCK: IDLE" (Q4); "$3,453.00", "LANE AUTHORITY TOLLBOOTH" (K7; the real ticker says BILLED 4,812.00); "G.S.S.T. CLASS Bulk Freighter" and a "LANE CONTROL ... battlefront" message (P2); the 00:13 "camera rotates and zooms" in sector 3 is the flashback cut, not scenery. Single-model passes are independent calls, not consensus or human evidence. The HUD shows sector names (for example "Gun Lanes") to the judge; that names a sector but not its function.

## Status, limits and next step

Done: specific set pieces with motion and localized physical signage in all five sectors; four of five read as a specific functioning place in a blind test, three with their intended activity. Not done or not established:

- **Last Approach** still reads as industry, not as the Warden's home. Proposed next test, not an implementation ticket: a version where the nursery pods use the drone enemy's own magenta-free silhouette at larger scale and the piers lose their crane-like flying rails, judged again with the same prompt.
- **Portrait:** the lane fills the width, so only far landmarks above the lane top are glimpsable (the waystation ring is the clearest). Desktop and landscape Chromebooks get the full scenery.
- No Chromebook, phone or GPU timer measurements; no human viewers; signs are legible in stills but nobody has been asked to read them mid-combat.
- Pass one's `research/2026-10-29-sector-worlds/summarize.ts` imports the removed `sectorBlocks`; it documents its snapshot and is not part of `deno task check`.

QA: world tests **8 passed**; full suite **230 passed, 1 failed** (`tests/banks_test.ts` "vo/script.yaml mirrors the voiced variants": stale emitted VO bank in another workstream's dirty files, unrelated to these paths) [tests](out/tests.txt); typecheck and lint pass [typecheck](out/typecheck.txt), [lint](out/lint.txt); static QA **WARN**, no failures, inherited coverage/asset warnings: `qa/reports/20261029-014729/index.html` ([log](out/static-qa.txt)).

Reproduce: `deno run -A --no-lock research/2026-10-29-sector-worlds-v2/capture.ts prepare` (then `capture`, `stills`), `judge.ts` (cached per clip id), `budgets.ts`, `uv run --script summarize.py`, `uv run --script annotate.py`. Rebuild art with `Blender -b --factory-startup -P art/blender/world/build_world.py`. Iteration server: `vite.config.ts` (port 5189, no watch) plus `peek.ts`.
