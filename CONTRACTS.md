# CONTRACTS.md: shared interfaces and ownership

The types in `src/contracts/` are the only thing every workstream shares.
Code against them; do not reach into another workstream's folder. Changing a
contract is a cross-team change: note it in your final report so the
integration pass can reconcile it, rather than editing silently.

## Contract map

| File          | Defines                                                                                                       | Why it exists                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `time.ts`     | `Tick`, `TICK_RATE` (60), `TICK_MS`, `secondsToTicks`                                                         | Fixed timestep: gameplay never sees wall-clock time.                         |
| `input.ts`    | `Vec2`, `InputFrame`, `IDLE_INPUT`                                                                            | One intent shape for every input source and for menus.                       |
| `sim.ts`      | `SimState` and its views, `SimEvent` union, `Sim`, `SimOptions`, `SimStart`, `PLAYFIELD` (480 x 640, +y down) | Renderer, UI, audio and Director read state and events; only the sim writes. |
| `pilot.ts`    | `Pilot { kind, next(state) }`, `PilotKind`                                                                    | Keyboard and both autopilots are interchangeable.                            |
| `text.ts`     | `Lang`, `LineId` (branded), `lineId()`, `Speaker`, `ScriptLine`                                               | All player-facing text is keyed by line id plus language.                    |
| `timeline.ts` | `Cue` union, `Timeline`, `MusicCueId`, `SfxRoleId`, `CameraShotId`                                            | Scenes are data the Director plays.                                          |
| `settings.ts` | `Settings`, `Action`, `Binding`, `SettingsStore`                                                              | One typed, persisted source for every option.                                |
| `flags.ts`    | `SkipTo`, `AutoPlay`, `UrlFlags`, `parseUrlFlags`                                                             | `?skipto=`, `?autoplay=fight\|pacifist&speed=N`, `?seed=N`.                  |

Import from `src/contracts/index.ts`.

## Ownership

| Folder                                       | Workstream                                                    | Stub left by Workstream 0                                    |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/contracts/`                             | integration pass only                                         | the contracts above                                          |
| `src/main.ts`                                | integration pass                                              | fixed-step loop, flag wiring                                 |
| `src/sim/`                                   | 1 Sim port                                                    | `sim.ts` (stub), `rng.ts`, `hash.ts`                         |
| `src/pilots/`                                | 1 Sim port (autopilots); keyboard pilot wraps 2's input layer | stub `fighting.ts`, `pacifist.ts`                            |
| `src/ui/`, `src/settings/`, `src/input/`     | 2 Front end                                                   | `devOverlay.ts`, `settings/store.ts`, `settings/defaults.ts` |
| `src/render/`, `src/render/shaders/`         | 3 Renderer                                                    | `stage.ts` (spinning placeholder)                            |
| `art/blender/` to `public/models/`           | 4 Art                                                         | empty                                                        |
| `vo/script.yaml`, `src/scenes/*.timeline.ts` | 5 Narrative                                                   | empty                                                        |
| `src/director/`, `src/audio/`, `src/i18n/`   | 6 Audio (Director playback, buses, text lookup)               | empty                                                        |
| `sfx/` to `public/sfx/`                      | 7 UI sound design                                             | empty                                                        |
| `tests/`                                     | each workstream adds its own `*_test.ts`                      | `sim_smoke_test.ts`                                          |

## Rules

1. **The sim is pure.** `src/sim/` imports only `src/contracts/` and itself:
   no three.js, no DOM, no `Math.random`, no `Date` or `performance`. It must
   run under `deno test`. Determinism is tested by snapshot hash.
2. **The renderer reads, never writes.** It consumes `SimState` and
   `SimEvent`s each frame. Cosmetic randomness is fine outside the sim.
3. **Who decides ticks.** The loop in `main.ts` decides how many ticks run per
   frame (accumulator for human play, fixed `speed` for auto-play, zero while
   a `freezeSim` cue holds). The sim has no clock.
4. **Text is `LineId`.** No player-facing string literal in code, menus
   included; resolve through `src/i18n/` with the current `textLang` (or
   `voiceLang` for audio). Spoken lines live in `vo/script.yaml`; unspoken UI
   strings share the id space. The dev overlay label is the one temporary
   exception.
5. **Settings only via the store.** Read with `get()` or `subscribe()`;
   write with `update()`. Never touch `localStorage` directly. Bump
   `SETTINGS_VERSION` only for incompatible shape changes; new keys merge
   from defaults automatically.
6. **Events over diffing.** React to `SimEvent`s (for example
   `pickup.firstPowerup` starts the flashback) rather than comparing
   snapshots.

## Commands

`deno task dev` (Vite on port 3000), `deno task test` (headless), `deno task ci`
(fmt check, lint, typecheck, test, build). All must stay green.
