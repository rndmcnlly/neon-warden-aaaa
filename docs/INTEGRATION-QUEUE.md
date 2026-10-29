# Integration queue

Requests from parallel workstreams, applied in one integration pass (owner of
contracts, `main.ts`, `deno.json`, `.gitignore`: the orchestrating session).

## Integration pass 1 (October 28, 2026): applied

All contract requests below are in `src/contracts/` and their workarounds
are gone (`SimExtras`, the local `waitFlag`/`SceneTimeline`, `RigShotId`'s
private `logoTurntable`, front end mounted from `devOverlay.ts`).
`deno.json` and `.gitignore` requests applied; `vo/out` reaches the build
via `deno task vo:sync`. Playtest and open items:
`research/2026-10-28-integration-playtest/README.md`.

QA (`qa/REQUESTS.md`) items 1–6 applied: `qa*` tasks and excludes,
`qa/reports/` and `qa/.build/` ignored, the `?qa=1` probe
(`src/app/qaProbe.ts`; scene ids are the real timeline ids such as
`ending-kill`, not camelCase), every skip-to target wired, Director
subtitles in play, and a stopgap `public/music/manifest.json` with no cues.
Item 7 (3 px focus-nudge overflow) belongs to the front end.

Still open, handed to owners:

- Strings: Extras > Third-Party Licenses should iterate
  `src/data/thirdParty.ts` (three.js, Orbitron, Vite, Deno, Stable Audio 3,
  Qwen3-TTS, Qwen3-ASR; Phaser deliberately absent) and absorb its English
  `THIRD_PARTY_NOTES_EN` into `src/i18n/` with ES and ZH. Also add a Settings
  row for the new `accessibility.reduceMotion` (contract and store done; no
  UI row, since it needs a string id).
- Front end: no continue screen after `gameOver` (runs use `autoContinue`
  for now), no in-game HUD (lives, score, `hud.serialRevealed`), no banner or
  credits crawl for `banner.*`, `ending.*`, `credits.roll` (until one
  exists, `main.ts` sets `credits.rollDone` the moment the roll starts), and
  no tutorial skip binding for `tutorialSkip`.
- Director: no public bark API, so `barkFor` events and chatter banks are
  not wired yet.
- Music and sfx: no picks yet, so the build is silent apart from VO.

## WS7 UI sound design (done)

- Commit `sfx/` (except `sfx/candidates/`, already ignored) after Adam's picks.
- Credits line: "Sound effects generated with Stable Audio 3 (Stability AI)."

## QA tooling (done; requests in `qa/REQUESTS.md`)

- `deno.json` tasks `qa`, `qa:static`, `qa:reel`, `qa:topic`, `qa:list`;
  exclude and gitignore `qa/reports/`, `qa/.build/`.
- `?qa=1` probe exposing `window.__nwqa` (scene, sim, log): unblocks six
  pending reels (tutorial, gameplay-fight, flashback, boss, both endings).
- Wire skipto `flashback`, `boss`, `ending-kill`, `ending-pacifist` in `main.ts`.
- `music/promote.py` always writes `public/music/manifest.json` (404 today).
- `src/ui/frontend.css:824-826`: focus `translateX(3px)` on the button causes
  3 px overflow; nudge inner content instead.
- Licenses screen: add Orbitron (OFL) and Stable Audio 3.

## Strings merge (done)

- `src/i18n/ui.ts` is canonical: 273 `ui.*` ids in EN/ES/ZH; `src/ui/strings.ts` deleted.
- Open: `tests/director_timeline_test.ts` "branch on flag" fails (unexpected
  `flag spared true` event), likely from integration's contract/flag changes.
- Overflow risks for QA reels: `.nw-badge` nowrap with long ES row labels
  (Sign-in and cloud saves row); ES sector banners and "GUARDIÁN DERRIBADO"
  at 1.6–2.1x English width.

## WS5 Narrative (done)

- Contracts: add `waitFlag` cue (defined locally in `src/scenes/cues.ts`).
- Sim: honor `boss.parley` (Warden invulnerable and not firing while it
  talks) and `tut.spawnTarget`.
- `deno.json`: test task needs `--allow-read`; `deno.lock` changed
  (`@std/yaml` for `script.gen.ts` generation).
- `render.py`: per-line seed overrides; lock a speaker's `design` so it can be
  edited without recasting (today a new unhashed `description` field holds the
  true Warden voice description). Pilot's "Keep the money." fails ASR in ES
  (0.6) and ZH (0.0): reseed. `flash_rain_001` retired: orphan files in
  `vo/out/*/`.
- Strings: WS2 has 187 `ui.*` ids in `src/ui/strings.ts`, WS5 has 206 in
  `src/i18n/`, only 47 overlap. Merge, translate, and make UI call `t()`.
- Undecided with Adam: sector-3 salvage cache framing (lean: #0121's derelict
  recorder); helmet pass 2 direction; Warden heart-shaped crest as a story
  beat.

## WS1 Sim port (done)

- Contracts: add `freeze`, `resume`, `continueRun`, `beginSector` to `Sim`;
  `scriptedSpawns`, `autoContinue` to `SimOptions` (today `createSim` returns
  `NeonWardenSim` with them).
- Contracts: `SimEvent` gains `despawn` (escorts wiped or retreating),
  boss `spawn`, and `hit` for shots blocked during the Warden's descent.
- Narrative handoff: `RESTORED_CUT_CONTENT` in `src/sim/tuning.ts`; pacifist
  runs get a sector-3 salvage cache so the flashback still triggers (design
  addition, tell WS5 timelines).

## WS2 Front end (done)

- `main.ts`: mount `createFrontEnd` (today mounted from `devOverlay.ts` as a
  workaround); pause sim stepping while `isSimRunning()` is false; keyboard
  pilot reads `frontEnd.input.readFrame()`.
- Contracts: add `ui` to the URL flags (`?ui=menu|title|settings|credits|pause`).
- Optional contract: `reduceMotion` setting (today follows OS preference only).
- WS5 handoff: about 190 English `ui.*` ids in `src/ui/strings.ts` to absorb.
- Settings store now clamps on save and load and is a per-storage singleton.
- Gap: keyboard and gamepad untested (browser tool cannot send keys). Test in
  integration with headless Playwright keyboard events (earlier reference
  subagent used Playwright successfully).

## WS3 Renderer (done)

- `main.ts`: `createStage({ settings })`; after each sim step
  `stage.observe(sim.snapshot(), events)`; per frame
  `stage.render(dt, accumulator / TICK_MS)` (alpha 1 during auto-play).
- Contracts: add `"logoTurntable"` to `CameraShotId`.
- Director wiring: camera port calls `playShot`, `showProp`, `setFlashback`,
  `setWarp`.
- Art convention to confirm against WS4: +Y up, nose toward -Z, origin at
  hitbox; animated node names `crown`, `halo`, `core`, `armor`, `thruster`,
  `engine`.
- New root file `render-harness.html` (`?scene=sector|boss|pilot|logo&speed=N&hold=N`).
- Measure GPU frame time in a foreground browser (panel throttles background tabs).
- Polish (from `02-warden-boss.jpg`): bloom blows out; enemy bullets, heavy
  shots and player shots all read as the same white-cream blobs, and the
  Warden's core whites out its silhouette. Shmup readability first: raise bloom
  threshold or lower strength, keep bullet cores saturated pink and gold with a
  dark rim, keep player shots cyan and visually distinct.
- Future subagents: capture screenshots at lower resolution (2880 px shots
  inflated context).

## WS4 Art (done, first pass)

- Done: Dock flicker fixed. `Blender -b --factory-startup -P art/blender/build_all.py`
  builds everything in one process (about 8 s); manifest byte-identical.
- Conventions match WS3 (+Y up, nose -Z, `_emit` materials, node names).
- Orbitron font (OFL) in `art/blender/fonts/`: add to third-party licenses.
- Art pass 2, Pilot helmet (`pilot_figure_helmet.png`): the vent grille under
  the chevron visor reads as a mouth, so the helmet becomes a cartoon robot
  face, which fights "faceless". Remove the grille, go matte and weathered
  (scuffs, a single repaint), heavier and more stoic; shoulder props read as
  orange blobs.
- Warden (`warden.png`): the crest reads as a heart from the top-down view.
  Happy accident for the "misunderstood guardian" turn; keep it and tell WS5.

## WS6 Audio and Director (done)

- Contracts: add `MusicCueId` values `menu`, `endingKill`, `endingPacifist`
  (both endings currently share `ending`).
- `deno.json`: exclude `music` (like `sfx`).
- `.gitignore`: add `music/candidates/` (121 MB WAV).
- VO: copy or build-step `vo/out` into `public/vo` so `vo/cues.json` and
  `vo/<lang>/<id>.wav` resolve.
- `main.ts`: `AudioEngine.create`, then pass `engine.clock`, `engine`,
  `engine.musicPort`, `engine.sfxPort` to the Director.
- Known CI break outside WS6: type error at `src/input/inputLayer.ts:391`
  (WS2, mid-edit at the time) and unformatted files in other folders.
- Music: 16 candidates (8 cues x 2) in `music/candidates/`, unauditioned.
