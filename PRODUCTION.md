# PRODUCTION.md: Neon Warden vertical slice

Draft production plan, October 28, 2026. Status: proposed, awaiting Adam's
approval. Read with `AGENTS.md` (decisions) and the research notes:
[teardown](../CMPM%20121-f26/research/2026-10-28-aaa-minesweeper-teardown/README.md),
[original reference](research/2026-10-28-original-reference/README.md),
[VO pipeline](research/2026-10-28-vo-pipeline/README.md),
[slice checklist](research/2026-10-28-vertical-slice-checklist/README.md),
[narrative tropes](research/2026-10-28-narrative-tropes/README.md).

## Slice contents

| Beat                  | Built                                                                                                                                                   | Stubbed                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Boot                  | press-any-key gate, photosensitivity notice, adamsmith.systems and CM121 f26 logos (skippable), "vertical slice build" label, real loading bar          | EULA                                                                                                                 |
| Front end             | title, main menu, new game with difficulty, chapter select (slice chapter only), pause, full settings, credits, third-party licenses, no-data statement | online multiplayer, store, leaderboards, sign-in and cloud saves, photo mode, menu narration (guideline-citing copy) |
| Tutorial              | Lane Authority onboarding AI, properly built, knowingly overlong, one wink; builds up the Warden's terror; skip at most three clicks away               |                                                                                                                      |
| Sectors 1–5           | 3D adaptation of the original's waves                                                                                                                   |                                                                                                                      |
| Flashback             | first powerup: Pilot #0121's flight recorder; world frozen; reveal of serial #0122                                                                      |                                                                                                                      |
| Boss                  | Warden descent speech (invulnerable), three phases, the deflation then the turn                                                                         |                                                                                                                      |
| Endings               | kill ending (tollgates, "replacement is already in onboarding"); pacifist ending "Lanes Kept"                                                           | further chapters                                                                                                     |
| Attract and auto-play | fighting autopilot and no-fire pacifist autopilot, both runnable at high speed                                                                          |                                                                                                                      |

## Architecture (all TypeScript except shaders)

Toolchain: Deno + Vite, matching the course starter, plus three.js.

1. **Deterministic sim, separate from rendering.** A fixed-tick `sim/`
   (entities, waves, boss phases, scoring, win conditions) with no three.js or
   DOM imports. The renderer reads sim state; it never owns it. Payoffs:
   headless tests, high-speed auto-play (many ticks per frame), replays, and
   the attract mode as #0121's recorded runs.
2. **Pilots as an interface.** `KeyboardPilot`, `FightingAutopilot`,
   `PacifistAutopilot` all produce the same input frame. Carried over from the
   original's best idea.
3. **Director and timelines as data.** Each scripted scene is a data file of
   cues (VO line ids, camera moves, music changes, waits). A Director runs
   timelines and schedules ambient chatter, ducking (not cutting) speech.
4. **Line ids everywhere.** `vo/script.yaml` is the single source of text:
   audio, subtitles and on-screen captions all key off line id plus
   language. Voice language and text language are separate settings.
5. **One settings store.** Typed, persisted to `localStorage`, read by menus,
   audio buses (master, music, SFX, voice, UI), renderer (preset, render
   scale), subtitles (size up to 200%, background opacity, speaker names,
   2-line cap) and accessibility (auto-fire, hold or toggle, shake slider,
   reduced flashing, game speed, color-independent cues).
6. **Front end as DOM over the canvas.** HTML and CSS menus with one input
   layer for keyboard, gamepad and mouse, remappable, with prompts that
   follow the active device. Keeps menus legible to students and to
   assistive tech.
7. **Skip-to flags.** `?skipto=tutorial|sector3|flashback|boss|ending-kill|ending-pacifist`
   and `?autoplay=fight|pacifist&speed=N` from day one.
8. **Blender as code.** `art/blender/*.py` scripts run headless and export
   glTF into `public/models/`; no hand-edited `.blend` files are the source of
   truth.

## Workstreams (one subagent each, file-scoped)

0. **Skeleton** (first, alone): repo layout, Deno/Vite/TS config, shared
   types (`InputFrame`, `SimState`, `Cue`, `Settings`, `LineId`), stub
   modules, CI typecheck. Everything else depends on these interfaces.
1. **Sim port**: `src/sim/` from `reference/e4-starter/`, both autopilots,
   pacifist win condition, headless test that runs both autopilots to their
   endings.
2. **Front end**: `src/ui/`, `src/settings/`, `src/input/`; every built and
   stubbed screen in the table.
3. **Renderer**: `src/render/`; placeholder primitives first, then swap to glTF;
   post-processing and speculative-2027 look; custom shaders in `src/render/shaders/`.
4. **Art**: `art/blender/`; Pilot's own helmet silhouette, ship, drone, dart,
   turret, lancer, Warden, logos.
5. **Narrative**: full `vo/script.yaml` in EN/ES/ZH plus `src/scenes/*.timeline`
   data; Warden voice description rewritten to match its anchor.
6. **Audio**: `src/audio/` buses and Director playback; music cue generation
   spike with a local model.
7. **UI sound design** (started October 28): `sfx/` audition workflow. A
   manifest of UI sound roles (focus, confirm, back, toggle, slider tick,
   error, locked stub, and so on) with written briefs; a local model renders
   several candidates per role; an audition page lets Adam pick; picks are
   recorded in a file and promoted into `public/sfx/`. Documented in
   `sfx/README.md` so anyone can regenerate or re-pick later.

Order: 0, then 1–6 in parallel, then an integration pass and an agent
playtest (AX report) per beat.

## Open

- Does Pilot speak once? (Proposed: one line in the pacifist ending.)
- Hosting on an `adamsmith.systems` subdomain via Cloudflare (ask before any
  DNS or deploy).
- Shared home for the TTS models now living in `~/Code/bbb-artifact-tour/`.
