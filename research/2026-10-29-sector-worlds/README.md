# Sector worlds: first environmental pass

## Framing

Can the lane pass through an inhabited place without turning the surrounding space into more HUD? Disciplines: environmental storytelling, industrial visual design, localization, real-time rendering, and audiovisual QA. Adam's Jets'n'Guns reference is treated as authored industrial stage variety, not permission to copy assets or change the game's tone.

**Implemented code: `8909dc8`, legibility/reduced-motion correction `56b171d`.** [Review viewer](index.html), [provenance](provenance.json), [performance and AV checks](performance.json), [static QA](out/static-qa/index.html).

## What changed

| Sector | Place/activity | Authored record sample |
| --- | --- | --- |
| Outer Drift | Public route mast, cargo haulers with nacelles, bridge windows and cargo spines; slow civil traffic | “PUBLIC BEACON / Passage is not a purchase.” |
| Shatter Belt | Broken orbital/mining trusses, spliced braces, crossed-out asset plates; slow salvage machinery | “COMMONS REPAIR 08 / Different bolts. Same bridge.” |
| Gun Lanes | Inspection gantries, dock slabs, stowed accounting rollers and scan bars | “CUSTOMS SURVEY / Inspection capacity: 0. Billing: ready.” |
| Lancer Gate | Side-bay thresholds at actual pincer heights, freight rails, moving switchyard shuttles, stowed closure equipment | “COMMONS SWITCHYARD / Leave room for the next convoy.” |
| Last Approach | Guardian buttresses, maintained nursery beds, monumental distant arch and heart motif; dormant toll cabinets | “RING MAINTENANCE / Three centuries. No invoice.” |

Fifteen discoveries are authored separately in `src/world/lore.ts`, each in English, Latin American Spanish and Simplified Chinese. Examples: “Pasar no es comprar.”, “Distintos pernos. El mismo puente.”, “资产编号已划去 / 焊缝依然牢固。” The institutional accounting language contrasts with maintained communal infrastructure, not villain graffiti. Number removal is visual crossed-out plate geometry; the detailed meaning is in its archived record, not tiny numerals that require squinting.

`sectorBlocks` is pure scene data and three material batches interpret it. This is deliberately table-driven design, not five copied renderer loops. The old enormous opaque floor was a hidden occluder: narrowing it to the actual corridor exposes below-lane scenery without sacrificing the combat contrast shield. Generic repeating pylons are disabled when authored worlds are active.

All side surfaces use PBR `MeshStandardMaterial`: metal/repair roughness differs; recessed elongated status strips have restrained emission. Existing environment and key/rim illumination affect them. One pooled, shadowless warm point light receives real kills/part breaks, decays exponentially, and is omitted on low tier or reduced flashing. No new postprocess, downloaded textures, asset pipeline, VO, or sound.

## Integration surface and attention policy

- `Stage.worldArchive(language?)` returns `{id, sector, text}[]`; a codex/transcript consumer can read it without changing contracts or the live HUD. The archive discovers at actual observed sector-relative ticks and retains unread discoveries.
- `Stage.worldStats()` and the explicit `?qa=1` read-only `window.__nwWorld` expose active sector, instances, timings and label visibility. No mutation hook.
- At most one sparse environmental sign per sector. It waits until after the introductory six seconds, then needs 45 consecutive observed ticks without enemies, enemy bullets, hits, life loss or part breaks. Boss/warning/flashback/hangar framing never shows a sign. It has an eight-second maximum window; if combat returns it disappears rather than competing. Busy runs may never show it: the archive is the reliable reading surface.
- Large wrapped type, no text panel. Projection rejects labels that would intrude into the central lane or leave the viewport. Native portrait suppresses labels entirely and keeps the original gameplay framing, while the distant arch and side depths remain glimpsable.
- Motion is slow equipment rotation or freight travel plus a bounded, once-per-sector approach from observed progression. Reduced motion freezes both the authored diorama and the existing scrolling backdrop. No collisions, fake branch choices, changes to spawns, early-warning claims or new mechanical systems.
- Gun Lanes docks and Lancer Gate bay heights contextualize arrivals, not exact previews. Bay hardware does not flash to promise a spawn. The sim schedule is untouched.
- Toll hardware remains stowed/dormant: the stage does not receive the Director's `ending.tollgates` flag. Activating it at a guessed boss-death time would misrepresent the narrative. A future explicit cue adapter can deploy it.

## Evidence and measured limits

The two capture arms are separate `git archive f636bb0` checkouts with their own production builds and ephemeral loopback ports. Current overlays only the committed world/render paths. Both use the same frozen music picks, music manifest and VO variant index, preserving Captain and cand1. No `vo:sync` is run against incomplete archived raw inputs. Source and overlay hashes are in provenance. Movement `75b75c3` and shot-feel `5a23867` remain in ancestry. Focus/ring geometry and the scan implementation are unchanged.

Four actual-game AV reels: baseline/current sectors 1 and 4, roughly 18–19 seconds each, 1366×768. The first couple of seconds have less populated entry space; later portions contain larger enemy/bullet groups. These are no-fire-autopilot excerpts, **not a completed pacifist run**. `quiet.jpg`/`dense.jpg` are capture labels, not assertions that the whole corresponding interval is free of threats. The recording shim caps rAF to avoid uncapped autopilot acceleration. Actual capture progression is 51.6–52.0 sim ticks/wall-second, slower than nominal 60; this limits tempo comparison. Baseline/current are not frame-lockstep.

All four reels have an audio stream and nonsilent mix content, source-start logs, subtitle checks and zero page exceptions. Actual loudness is −18.7 to −17.8 LUFS, true peaks −5.2 to −4.9 dBTP. Sector 4's captured music stem is silent in both arms: do not claim that cand1 is audible there just because it is selected. Source logs and AV checks remain authoritative. The last started voice is allowed to finish before flush, bounded by ten seconds.

**Audio QA is not all green:** baseline/current sector 1 flags “Another Writ into empty space” with no audible VO; current sector 4 flags “Close is good…” similarly. These are text-only/unvoiced commentary windows reported by the existing checker, not evidence that every subtitle is voiced. No audio code or script is changed here. Baseline sector 4 passes VO coverage.

Twenty small actual-game stills cover all five sectors in ES/ZH, desktop and 390×844 portrait-low-reduced. Every recorded active sector matches the requested sector; zero page exceptions. Thirty separate **synthetic combat-free** sign fixtures test all five sectors × EN/ES/ZH × wide/narrow. They establish legibility placement and suppression, not natural live-combat reading opportunities. [Sign checks](out/sign-checks.json). The synthetic [unlit-spill](out/pbr-spill-0.png)/[lit-spill](out/pbr-spill-1.png) pair demonstrates PBR light response, not a captured gameplay explosion.

World budget: three instanced box batches, at most three moving props (one low), one optional sign, one pooled light (disabled low/reduced flashing). Maximum seven scene draw calls, five low; 97–140 blocks versus a hard cap of 230. Maximum approximately 1,718 triangles including movers/sign. Existing generic pylons are removed from these scenes. Whole-game calls still vary with enemies, effects and postprocessing: current sector 1 measured 133–251, sector 4 80–166, so **seven is not the total game draw-call count**.

Development Mac M3 Max, recorded headless Chromium: mean world-update CPU 0.0075 ms (sector 1), 0.0100 ms (sector 4), sampled max 0.100 ms (timer quantized). Whole renderer rolling CPU means 0.792/0.704 ms. Portrait-low still samples average 0.712 ms whole-render CPU (range 0.515–0.987). No GPU timer queries, Chromebook hardware tests, mobile device tests or low-end performance guarantee. No baseline renderer-CPU instrument existed, so no invented CPU speedup claim.

Focused world tests: **3 passed**, covering all five distinct geometry recipes, positive finite dimensions, play-plane exclusion, the instance cap, complete localizations and archive timing/idempotence/reset. Typecheck and focused lint pass. [Tests](out/focused-tests.txt), [typecheck](out/typecheck.txt), [lint](out/lint.txt).

Static QA: **28 pass, 8 warn, 2 fail, 0 pending**. The inherited failures are 450 raw-VO cue files absent from a git archive and 65 script lines absent from the raw cue index. Raw WAVs are intentionally untracked; this does not establish missing public Opus for these verified reels, nor justify declaring all production assets complete. Warnings include existing translation width risk and asset/model/music metadata. [Full summary](out/static-qa/summary.txt).

No paid judge call: $0 spent, no ledger entry. No hands-on feel, full route, ending reveal, actual school-device speed, screenshot-complete multilingual typography audit, or human comprehension claim. This is a coherent procedural first pass, not final bespoke environment art. The forms remain intentionally simple; an authored sign fixture does not prove players read it during a live run.

## Reproduction and next handoff

Build the isolated `baseline` and `current` snapshots with direct Vite into `out/build`; `capture.ts` uses the canonical `qa/capture.ts` browser launcher/server and `qa/av.ts` mix tap. The snapshots/build bundles are ignored, not committed. `harness.config.ts` and `world-harness.html` produce the isolated sign fixture. `summarize.ts` produces the saved timing/AV inventory. Do not run capture scripts after discarding their snapshots and assume they reconstruct those inputs automatically.

Next useful iteration: human play on desktop/phone, then decide whether to promote the archive adapter into the existing paused codex. Do not add a live floating reading panel. If a Director adapter is authorized later, connect the existing tollgates flag explicitly. No push or outward-facing deployment.
