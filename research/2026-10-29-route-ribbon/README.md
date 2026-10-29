# Route ribbon: a moving 2D combat plane in an authored 3D route

## Question and recommendation

Can Pilot follow a sweeping industrial route and rising gate approach without changing the deterministic 2D game? **Yes as a presentation construction, not as spline physics. Start with a rigid, camera-following near patch and curved distant scenery. Do not enable fully curved combat yet.**

This is a bounded prototype, not a live stage rewrite. No live sim, pilot, stage, backdrop, world, camera rig or main-loop files were edited. No paid API calls. The architectural seam in `src/render/coords.ts` is good: one pure conversion vocabulary. The integration hazard is that several consumers bypass a complete transform by adding world-space offsets after converting only a center. A curved adapter cannot safely replace just `simToWorldX/Z`.

Prototype: `/src/presentation/routeRibbon/index.html` on the isolated server. Start from the repo root:

```sh
deno run -A npm:vite@8.3.1 --config research/2026-10-29-route-ribbon/vite.config.ts
```

Open <http://127.0.0.1:5188/src/presentation/routeRibbon/index.html>. The no-watch config prevents other workers' asset changes from interrupting captures. Restart it after changing prototype sources: its transform cache intentionally does not invalidate. This is not included in the production build or offline manifest.

Evidence viewer: [index.html](index.html). Numerical report: [qa.json](qa.json). Route diagram: [mapping.svg](mapping.svg), with explicitly exaggerated transverse/elevation axes. Source and four reused GLB hashes are in the report. Evidence captured 2026-10-29 at 07:40 UTC against base `56b171d`, plus the owned dirty prototype. Concurrent foreign changes mean this is not an exact whole-repo revision snapshot.

## Construction and pinned prototype vocabulary

- Sim contract: 480×640 pixels, top-left origin, +y down; 60 Hz ticks. Collision remains CPU 2D. Replay, controls, diagonal normalization, reversals and autopilots do not acquire a route dimension.
- World scale: 40 sim pixels/world unit. Absolute progress `p` is a presentation distance in world units, not ship velocity. `lateral=(x−240)/40`, `along=(320−y)/40`, `s=p+along`.
- Three quintic transverse spline segments have endpoints `(0,0,0) → (6,0,−80) → (8,10,−160) → (8,10,−240)`. Equal forward lengths and zero transverse first/second derivatives at boundaries give C2 authored joins. They form an industrial sweep, rising gate, then straight boss arena. The polyline approximation is C0 with very small tangent error, not an exact analytic spline.
- `buildRoute()` precomputes a 961-frame chord arc-length LUT, nominal 0.25-unit spacing. Lookup is binary, with interpolated tangent/right and re-orthonormalization. Refining to 640 samples/segment changes length by less than 0.0001 units. Straight tangent tails extend beyond route ends, rather than clamping scenery to a collapsed endpoint.
- Minimal-rotation parallel transport avoids Frenet-frame flips at inflections and vertical tangents. Near-antiparallel cusps are rejected, not arbitrarily rolled through. Initial up uses a protected alternate axis near vertical. Frame basis `[right,up,−forward]` is right-handed. No authored combat bank. A future distant-world bank must not leak into the combat camera.
- Full ribbon: `world=C(s)+lateral*right(s)+height*up(s)`. `curve=1` enables this experimental mapping.
- Conservative mode: `curve=0` uses `C(p)+along*forward(p)+lateral*right(p)+height*up(p)` for `|along|≤8.5`. The entire combat patch, including a margin outside y=0/640, is exactly planar. A quintic transition reaches the full route at `|along|=24`. Near geometry is a rigid frame, not a different bullet-only warp.
- `Mapping {route,progress,curve}`, `SimPoint {x,y}`, and readonly `V3` tuples are private prototype types, **not new shared contracts**. `height` is presentation height along the local surface normal, never collision depth.

All fixture ships, bullets, aim/Writ line, scan-cone boundary, pickup, focus brackets, six-pixel-radius hitbox and world-anchor leader use the same `simToWorld`. Models are rigidly placed/oriented, not CPU-skinned per vertex. The harness reuses `pilot_ship`, `drone`, `lancer`, and `pickup_shield` glTFs, with explicit loaded counts and fallback primitives. Its tick 420 is a synthetic frozen fixture, not a recorded live snapshot. The Writ/scan graphics are fake event receipts, not simulated attacks. Both views use identical sim-space fixture positions. Route progress alone moves during the 12-second survey: it is intentionally accelerated and not a proposed gameplay speed.

## Bounds, including the failures

Diagnostic projection uses an orthographic camera with screen-up along transported forward and screen-right along transported right. It removes route-induced surprise roll and keeps the combat map readable. These numbers are singular values of the local projected Jacobian, measured by central differences of 0.1 sim pixels, **not a guarantee of fairness under a perspective camera**.

| Sampled combat mode | Min/max projected scale | Worst anisotropy | Result |
| --- | --- | --- | --- |
| Conservative planar, orthographic | 1.0000 / 1.0000 | 1.0000 | Exact near-patch preservation |
| Fully curved, orthographic | 0.9677 / 1.0323 | 1.0334 | Small deformation, not promoted |
| Planar, analytic 27° perspective at distance 32 | 0.7138 / 1.1861 | 1.2684 | Fails a ±10% scale criterion even before curvature |
| Curved, same perspective | 0.6643 / 1.2149 | 1.3556 | Clearly outside conservative bounds |

The report's dense ortho grid covers x=0–480/y=0–640 in 40-pixel increments, progress 30 through length−30 in 1-unit steps. Tests additionally cover near-end progress and joins. Perspective uses a coarser grid across the whole progress range. These are sampled bounds, not formal global optimization. The analytic perspective uses fixed distance 32, while the visual harness fits distance to aspect: neither replaces live camera/viewport measurements.

Maximum sampled curvature is 0.009052/world unit. The usual tubular-ribbon local curvature margin `1−|lateral|κ` at lateral 9 is 0.9185. Positive sampled combat Jacobian determinants reject local folds for this asset. Global route z is monotone and authored bends are small, but there is **no general self-intersection certifier for arbitrary future routes** and no occlusion certification for arbitrary 3D models.

Wider scenery, lateral ±9 and along ±30, has scale **0.8725–1.1322** in the conservative morph. This is outside combat bounds: never put collidable threats, aim-critical text or apparent barriers there. Flattening introduces progress-relative scenery deformation or “breathing.” A large undeformed rigid factory mesh cannot simply be center-anchored and assumed to fit the ribbon. Subdivide authored floor strips at bake time, or keep structures off the near patch with authored clearances. No per-bullet mesh skinning.

Initial broad diagnostics found a 0.5 endpoint derivative caused by clamping `s` at route endpoints. Straight tangent extensions fixed it; the regression test covers both ends. The first recording run was interrupted by live Vite reloads from concurrent edits. The no-watch server fixes capture stability. OpenChamber's embedded browser could not create WebGL here; the harness now states that failure explicitly. Canonical QA Metal-Chromium captures loaded all 4 models in both views and produced no page/console errors.

**Perceptual limit:** the default comparison intentionally looks almost identical near the ship. A camera rigidly following a locally rigid patch cancels most apparent route motion. This is the safety property, not proof that the larger world feels authored or exciting. Distant landmarks, silhouettes, lighting and gate anticipation must convey the journey. Use the diagram and optional curved-combat control to inspect the geometry, rather than exaggerating near-combat bends for the sake of a clip.

The white disk is radius 6 **sim pixels**, not six CSS/device pixels in every viewport. The harness focus brackets are schematic, not a replacement for the newly implemented live focus geometry. Tiny-hitbox contrast, DPR calibration, live ring/model occlusion and touch readability still require native-device testing.

## Inverse, pointer and camera ownership

`worldToSim()` is a local nearest-surface diagnostic. It analytically solves lateral distance for each trial y, coarse-searches y=0–640, then refines the best interval; it returns residual distance for rejection. Tested roundtrip error is below 0.001 sim pixels for the authored surface. This is deliberately more expensive than forward mapping and must not run for every bullet. It is not a screen inverse, global nearest-route solver, or proof of unique picking.

For conservative near-plane input, unproject the CSS pointer through the **same camera matrices and viewport/scissor** used to draw that frame. Intersect its ray with the plane through `C(p)` normal `up(p)`, reject parallel/behind-camera rays, then recover x/y by dot products against right/forward. Convert CSS pixels to canvas/device coordinates exactly once. Letterboxing, portrait layout, safe areas, scissor rectangles and camera shake must use the same presentation frame. A screen-space HUD remains screen-space; world-anchored labels must project transformed world anchors.

For fully curved mode, intersect the ray with a bounded ribbon surface/triangulated patch and reject multiple roots or missing hits. Nearest projection of a point onto the ribbon is not that ray intersection. This is **unimplemented**, so no live pointer controls should use curved mode. Aim vectors, reticle positions and scan geometry remain authored in sim space, then mapped together. Do not convert a center and independently add a flat world-space weak-point offset.

## Concrete integration plan, by owner (future work, not authorized here)

1. **Integrator / contracts owner:** agree one `PresentationFrame` per rendered frame: absolute progress, route ID/LUT, conservative mode, camera matrices and interpolation fraction. Hold it on sim freeze/pause and recorder scenes; never infer it from `performance.now()` independently in each renderer. An authored `progressAtTick(tick, sectorOffset)` schedule can replay deterministically while staying outside sim state. Specify sector offsets and seek semantics so crossing sectors does not reset route distance or frames. The prototype has no tick→progress schedule.
2. **C renderer owner:** replace split x/z assumptions atomically across ships, bullets, pickups, target rings, weak-point offsets, focus geometry, trails, scan cone vertices, Writ paths, particles and HUD world anchors. Map endpoints in sim space; tessellate long paths when crossing curvature. Ground collision cues use height=0 consistently; model lift is presentation-only. Pool scratch vectors / matrices and use precomputed per-frame/per-row lookup where needed. The prototype allocates small tuples for clarity and is not an allocation/performance benchmark.
3. **C camera + input owner:** qualify the actual perspective camera and pointer inverse together, including shake, recoil, portrait fitting and transition shots. Keep stabilized screen-up, no surprise roll. If perspective fails projected hitbox tolerances, retain the near plane and adopt orthographic/less-tilted projection or a certified screen-space collision cue layer. Do not announce “the 3D hitbox matches” from these ortho tests.
4. **Sector-world owner:** author scenery in absolute `(routeS,lateral,height)` coordinates. Convert `routeS` to the frame's relative sim y before the shared mapping. Do not independently scroll a flat backdrop or independently bend decorations. Bake subdivided floor strips; keep rigid gates/factory silhouettes outside the combat silhouette envelope. Add near-patch occlusion masks and authored approach clearances. A shared mapper is necessary but does not automatically keep a tall gate from hiding an enemy.
5. **P gameplay / timeline owner:** leave movement, collision, fire verbs and replay untouched. Provide presentation-only dense-pattern/boss cues if needed. Default remains planar throughout. Any future change from curved→flat must happen at a clear transition with no active threats, not make bullets slide during a dense pattern. Boss arena is already straight; do not change sim speed to follow the spline.
6. **Memory-scene owner:** freeze the presentation frame with the frozen state, use separate cinematic shots deliberately, and restore the identical combat frame on return. This prototype does not touch the concurrent memory work.
7. **Accessibility / QA owner:** reduced-motion mode is static + fully flattened in the harness, including scenery. Qualify a live alternative with no camera travel/roll, readable focus brackets, no lost hitbox contrast, honest viewport measurements, keyboard/touch aim tests, and real low-tier Chromebook frame pacing. The Mac capture does not establish any of these. Begin with the planar path, not an automatically animated curvature slider.

Proposed promotion limits: no signed Jacobian inversion; additional curve-induced local scale change ≤5%, anisotropy ≤1.05 **relative to the qualified flat live camera** throughout the combat patch; retain the existing hitbox and focus cue silhouette/contrast at every target DPR. These are engineering gates to test, not a psychophysical fairness threshold. If exceeded, reauthor curvature/width or keep the patch rigid. No runtime curvature clamp or production fallback is wired here.

## QA and artifacts

- `deno test tests/route_ribbon_test.ts`: **7 pass**, [tests.txt](tests.txt). Orthogonality/handedness; vertical/inflection no-flip and cusp rejection; seams and arc refinement; inverse roundtrips; scale/determinant bounds; real sim diagonal/reversal hash invariance; endpoint tangent tails.
- `deno check src/presentation/routeRibbon/harness.ts`: pass.
- Full `deno task check`: pass, [typecheck.txt](typecheck.txt).
- Separately running `deno task test`: **225 pass, 1 unrelated failure** in `tests/banks_test.ts:58`, “vo/script.yaml mirrors the voiced variants”; [full-tests.txt](full-tests.txt). The route tests pass inside that run too. The bank/script mismatch is outside ownership and remains unresolved.
- `deno lint src/presentation/routeRibbon tests/route_ribbon_test.ts`: pass.
- Owned-path `deno fmt --check`: pass after formatting. Research is repo-excluded; scripts formatted separately.
- `deno task qa:list`: canonical reels reviewed. Game-only reels do not enter this isolated page, so the capture script reuses `qa/capture.ts:launch()` and supplies bounded harness navigation instead.
- `deno task qa:static`: **32 pass, 6 warn, 0 fail**, [report](../../qa/reports/20261029-003155/index.html). Existing translation width/ASR, model registry/budget/animated-node and music-brief warnings remain, not fixed by this task.
- `deno task ci`: **stopped at formatting**, 18 unrelated files, including `AGENTS.md`, `docs/`, `public/branding`, `public/sfx`, concurrent `src/presentation/memoryScene.ts`, and generated `out/build/`. Lint/check/tests/build stages of full CI did not run. No unrelated formatting edits made. This is not a green suite claim.
- Five final reels are 13–15 seconds each, native desktop 1280×900 or portrait 390×844. `ffprobe` verifies **zero audio streams**, deliberately silent math/model evidence. No claim of speech, sound or live gameplay comprehension. Both portrait arms show one full native-width view, not a desktop crop. The static alternative remains at s=40 in before/after telemetry.

## Process feedback

The strict no-live-renderer ownership boundary prevented a half-integrated spline feature while world and memory owners were active. A no-watch Vite config was needed because shared-checkout asset writes invalidate otherwise isolated pages. The wider Jacobian test caught an endpoint defect that a pretty mid-route screenshot would miss. Keep source/model hashes with future captures, and have the integrator post this dated, scope-qualified result to the production dashboard rather than treating these silent fixtures as current game QA.
