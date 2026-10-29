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

## Wave 3

### N Narrative: contract announcements (October 28, 2026)

- **Word timing (T fills, U reads).** `src/contracts/text.ts` gains
  `WordTiming { text, charStart, charEnd, startS, endS }`: one spoken word
  of a rendered take; `charStart`/`charEnd` are UTF-16 offsets into the
  subtitle text for that language (`[start, end)`), `startS`/`endS` are
  seconds from the start of the take (same unit as `duration`). Chinese
  words are ASR tokens (often one or two characters); offsets still index
  the subtitle string. T writes `words: WordTiming[]` beside `duration` in
  `vo/out/cues.json` at `lines[id].langs[lang].words`; A's manifest type
  passes it through; U pulses `text.slice(charStart, charEnd)`. A take
  with no `words` (old render) shows a plain subtitle.
- **`radio` cue** in `timeline.ts`: `{ type: "radio", line, channel }`,
  `channel: "scout" | "authority" | "recorder"`. Non-blocking. Shows the
  line as on-screen radio text (separate from subtitles); if the line is
  in the VO script it also plays, spatially when the Director knows a
  source position. Text-only radio ids are `radio.*` in
  `src/i18n/radio.ts`; `t()` resolves them like any id.
- **Radio bank** (`src/scenes/radio.ts`): `radioFor(source, situation,
  pick, run)` returns a `RadioLine { line, channel, voiced }` or null.
  `source`: `drone | dart | turret | lancer | authority`; `situation`:
  `patrol | locked | disarmed | retreat | lost`. Director (A): call it on
  `scanLock` (locked), `disarm` (disarmed; the enemy's `retreat` follows
  later), a nearby `kill` (lost, kill route only) and a patrol timer, and
  play voiced ones at the enemy's position with A's spatial panner.
- **New speakers** `scout` and `authority` in `vo/script.yaml` (casting
  `description`, `design`, `anchor` written; T: seeds and anchors). Their
  subtitle names fall back to `radio.callsign.*` (mine), so U need not
  add `ui.speaker.scout`.
- **Codex** (`src/scenes/codex.ts`, text in `src/i18n/codex.ts`):
  `CODEX_ENTRIES` with `{ id, title, body, unlock }`, `unlock` one of
  `{ scan: EnemyKind | "warden" | "recorder" }`, `{ flag }`, `"start"`.
  `codexUnlockedBy(event)` lists entries a `scanLock` unlocks. U renders
  the codex; package entries are `codex.weapon.<id>` /
  `codex.sensor.<id>` using G's `WeaponPackageId` / `SensorPackageId`.
- **Events N's scenes expect from G** (coded against these names behind a
  local `Wave3Event` union in `src/scenes/index.ts`, removed once
  `SimEvent` has them):
  `{ type: "scanLock", tick, id, kind: EnemyKind | "warden" | "recorder",
  state: string, first: boolean }` (`first`: first lock of the run);
  `{ type: "disarm", tick, id, kind, first }`;
  `{ type: "graze", tick, first }`;
  `{ type: "partBroken", tick, id, kind: EnemyKind | "warden", first }`;
  `{ type: "salvage", tick }` (the sector 3 recorder is collected or
  locked). Timelines: `firstLock`, `firstDisarm`, `firstGraze`,
  `recorder`, `wardenPod` (first Warden pod broken).
- **Flags the Director should set** (names in `src/scenes/flags.ts`):
  `run.disarmed` (on `disarm`), `run.neverFired` mirrors `!run.hasFired`
  (the Warden branches on `run.hasFired`, so nothing new needed there),
  `story.flashbackSeen` (set by the flashback itself). Tutorial progress:
  `tut.tapped`, `tut.streamed`, `tut.charged` (charge level 3),
  `tut.writFired`, `tut.locked`, `tut.partBroken`, `tut.grazed` (five
  grazes), `tut.rateDoubled` (rate reaches x2). Spawns the tutorial asks
  for (G or A): `tut.spawnTurret` (passive practice turret, one barrel
  part), `tut.grazeDrill` (slow practice rounds that pass near the ship).
- **Requests to Q:** coverage should also read `src/i18n/radio.ts`
  (`RADIO_TEXT`) and `src/i18n/codex.ts` (`CODEX_TEXT`); ids are dotted
  (`radio.drone.patrol.1`, `codex.writ.body`) so `scanIds` will not
  mistake them for VO ids.

### G Gameplay: contracts drafted (October 28, 2026)

Committed first so others can code against them: `src/contracts/sim.ts`,
`input.ts`, `pilot.ts`, new `loadout.ts` (exported from `index.ts`). The sim
itself lands in later commits.

Breaking changes others must absorb (typecheck fails until done):

- **V** `src/render/stage.ts:111` `PICKUP_MODEL` needs `recorder` (#0121's
  flight recorder; a new prop or reuse `pickup_shield` for now).
- **V** `src/render/harness.ts` builds a fake `SimState`. New required
  fields: `player.vel, trigger ("rest"|"tap"|"stream"), chargeLevel (0–3),
  charge (0–1), scan {active, halfAngle, range, targetId}`; each enemy
  `ai, aiTicks, parts[], weakPoint {offset, radius}, lock, locked,
  disarmed`; boss `ai, pods[], coreOpen, weakPoint, lock, locked`; top level
  `pay {credits, rate, chainTicks, chainMax}, graze {meter, count, radius},
  scoutsSpared, loadout` (use `DEFAULT_LOADOUT`); flags `neverFired,
  recorderRecovered`. Events: `playerFired` gains `shot, level, pos`; `kill`
  gains `clean`.
- **N** `tests/scenes_timelines_test.ts:133` kill literal needs `clean: false`.
- Everyone: `despawn.reason` gains `"spared"`; `PickupKind` gains
  `"recorder"` (its `pickup` event still carries `firstPowerup`, so the
  flashback wiring keeps working when the recorder is the first pickup).

Input semantics (no shape change): `InputFrame.fire` is the raw held state
of the one fire button. The sim derives tap (press edge: aimed round, or a
Writ if charged), hold (past 8 ticks: stream) and rest (charge plus scan).
**Input layer / U**: never synthesize taps; toggle auto-fire streams forever
and so never charges (offer "pulse" as the assisted variant).

New events (all carry `tick`):

| Event         | Fields                                                                                   | For                                                                           |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `playerFired` | `shots, shot: "aimed"\|"stream"\|"writ", level 0–3, pos`                                 | A: tap crack, stream loop, three Writ release tiers                           |
| `chargeLevel` | `level 0–3` (0 when spent)                                                               | A: pip ticks, full-charge hum; V/U: pip ring                                  |
| `enemyFired`  | `id, weapon: EnemyWeaponKind, pos, bullets`                                              | A: positional enemy weapons (off-key)                                         |
| `nearMiss`    | `bulletId, pos, relVel, distance, heavy` (closest approach within `NEAR_MISS_RADIUS` 48) | A: whoosh, doppler from `relVel`                                              |
| `graze`       | `bulletId, pos, count (1, heavy 2), meter 0–1`                                           | A: crackle; V: ring sparks; musical layer on pacifist runs                    |
| `partBreak`   | `id, target "enemy"\|"boss", part, partKind, pos, by: ShotKind`                          | A/V: crack, debris                                                            |
| `disarm`      | `id, kind, pos, cancelled` (bullets cancelled)                                           | A: power-down sigh; V: cancel shimmer; U: SCOUTS SPARED                       |
| `coreExposed` | `id`                                                                                     | A/V/N: the Warden's core opens                                                |
| `scanLock`    | `id, target, kind, pos`                                                                  | A: lock chirp; V: reticle                                                     |
| `intel`       | `id, codexId, ai, first`                                                                 | U: codex unlock toast when `first`                                            |
| `payChanged`  | `credits, rate, delta, reason: PayReason`                                                | U: PAY and rate; A: beat-quantized rate tick, rate-break chord on `rateBreak` |

Codex ids emitted by `intel`: `codex.enemy.drone|dart|turret|lancer`,
`codex.warden`, `codex.warden.core` (on `coreExposed` lock),
`codex.recorder.0121`. **U/N**: please add entries (text ids are yours).

State for **V/U**: `EnemyView.ai` / `BossView.ai` are the truthful FSM state
names (`EnemyAiState`, `WardenAiState`); show them only when `locked`. Part
and weak point `offset`s are relative to the owner center (+y down). Hangar:
`WEAPON_PACKAGES`, `SENSOR_PACKAGES` (with `inSlice` for honest walls) and
`Cosmetics` in `loadout.ts`; text ids `hangar.weapon.<id>.name|blurb`,
`hangar.sensor.<id>.name|blurb`. **A** (`main.ts`): pass the hangar's
`Loadout` as `SimOptions.loadout`; add `?autoplay=ghost` mapping to the new
`ghostAutopilot` (`PilotKind`); `pacifist` stays the disarmer.

### N Narrative: update after G's events landed (October 28, 2026)

- Supersedes N's "events N's scenes expect" bullet above: scenes now read
  G's `SimEvent` directly (no local union). `timelineForEvent`:
  `pickup` with `kind: "recorder"` starts `recorder` (it plays the
  flashback first if no powerup came before, then the coda; the flashback
  guards itself with `story.flashbackSeen`), `scanLock.first` starts
  `beat-first-lock`, `disarm.first` `beat-first-disarm`, `graze.first`
  `beat-first-graze`, `partBreak.first` with `target: "boss"`
  `beat-warden-pod`. `runFlagsAfter(disarm)` sets `run.disarmed`.
- Codex unlocks key off G's `intel.codexId` exactly: `codex.enemy.<kind>`,
  `codex.warden`, `codex.warden.core`, `codex.recorder.0121`
  (`codexUnlockedBy(event)` in `src/scenes/codex.ts`). Text ids are
  `codex.<entryId>.title` / `.body` (entry ids `drone`, `warden`,
  `wardencore`, `recorder`, ...), distinct from G's intel ids.
- A (Director): voiced radio lines and `rec_log_*` need no new cue support
  to be heard today (beats use `say`); the `radio` cue in `beats.ts`
  (Lane Control after a first lock or disarm) is silent until the
  Director handles `case "radio"`. `recorder.playing` tells U to show the
  recorder lines in the radio box with `radio.callsign.recorder`.

### U UI: APIs exposed and hookups requested (October 28, 2026)

Exposed by the front end (`createFrontEnd` return value, `src/ui/frontEnd.ts`):

- `hud.event(e)` now accepts every SimEvent including wave 3 ones (read by
  `type`); continuous instruments (PAY and rate, Writ cells, graze meter,
  scan lock, intel tags) are read from `SimState` in `hud.update(state)`
  (`src/ui/instruments.ts`, `readInstruments`), so no extra calls are needed.
- `hud.radio({ source, text, pan?, durationMs?, lang? })`: radio chatter
  text channel, separate from subtitles, with a stereo side marker.
- `progress` (`ProgressStore`, `src/ui/progress.ts`): loadout, codex unlocks
  and career pay, persisted under `neon-warden.progress`. First `intel`
  events unlock codex entries (with a toast); pay is banked on `gameOver`,
  `bossDefeated`, `bossSurvived`.
- `onStartGame(request)` now carries `request.loadout` (the hangar's).
- Subtitles: `createSubtitleLayer(root, settings, { wordsFor?, now? })`
  pulses the spoken word using `WordTiming` (N's contract); it also reads
  optional `startedAt` / `words` on `SubtitleView` if the Director adds them.
- Settings: `audio.mono` (contract, defaults, validation) with a row and
  description; A already reads it.

Requests:

- **A** (`main.ts`): pass hooks `screenPositionOf: (id) =>
  stage.screenPositionOf(Number(id))`, `applyLoadout: (_l, look) =>
  stage.applyLoadout(look)` (and `stage.setHelmet` from
  `look.helmet` if wanted), `showHangar: (shot) => stage.showHangar(shot)`;
  forward `request.loadout` to `SimOptions.loadout`; call
  `ui.hud.radio(...)` for N's radio cues with the panner's pan; pass
  `wordsFor` (from the VO manifest's `words`) and the Director clock as
  `now` to `createSubtitleLayer`. Optional: `onCodexUnlocked(id)` sting.
- **A** (`flags.ts`): add `hangar` to `UiEntry` so `?ui=hangar` works; the
  front end's entry table then needs one line (U will add it).
- **Q**: please add a **hangar reel** (en, es, zh): main menu, Hangar, cycle
  weapon (Standard, Magistrate, Courier, Notary) watching stat deltas,
  cycle sensor, paint and trim (live 3D preview), focus a walled slot
  (side panel copy), Q/E through Mastery, Codex and Campaign, focus a walled
  chapter; then New Game, "To the hangar", Launch contract. Keys: Enter,
  arrows, Q/E, Esc. Main menu order is now Continue, New Game, Hangar,
  Chapters, Settings, Extras, Credits, Quit (menu reels that count rows
  need a bump).

### Q QA: audio in every reel, judge, wave 3 reels (October 28, 2026)

- **A**: please add `"qa:judge": "deno run -A --no-lock qa/judge.ts"` to
  `deno.json` tasks (QA left deno.json alone; you touched it this wave).
  Also `enemies()` on the QA probe (details in `qa/REQUESTS.md`, "Wave 3").
- **T / U / N**: word timing shape mismatch: cues have
  `{ word, start, end, char }`, the WordTiming contract and U's view read
  `{ text, charStart, charEnd, startS, endS }`; no word pulses today.
- **U**: `data-line` on the subtitle box, `data-word` on `.nw-word`;
  hangar selectors QA expects are listed in `qa/REQUESTS.md`.
- New reels (pending until their code lands, then real): `hangar`,
  `scan-lock`, `disarm-boss`, `graze`, `spatial-audio`,
  `subtitle-word-pulse`, `vo-no-drop`. Every reel now also checks
  VO-no-drop (each subtitle window has audible VO) and true peak.

### G Gameplay: sim landed (October 28, 2026)

- Landed in `a8d446c` and `31430d7`: everything announced above, plus
  `tut.spawnTurret` and `tut.grazeDrill` honored by `setStoryFlag` (N's
  requests). N: rename `partBroken` to `partBreak` and treat `salvage` as
  the `pickup` event with `kind: "recorder"`; every `first` you asked for
  exists (`scanLock`, `disarm`, `graze`, `partBreak`, and `intel.first`).
- **A** (`flags.ts`, `main.ts`): add `autoplay=ghost` and construct
  `GhostAutopilot` from `src/pilots/pacifist.ts` for it. `autoplay=pacifist`
  is now the disarmer (Writs on turret barrels and the Warden's side fan
  pods, never a kill, never the core).
- **Q** (`qa/reels.ts`): `ending-pacifist` asserts zero shots, so it should
  use `autoplay=ghost` once A lands it; `disarm-boss` stays on `pacifist`.
  Its current failure is this naming, not the sim: the disarmer reaches
  `bossSurvived` with zero kills on every seed and difficulty tested.
- Design note for **N**: the disarmer breaks both fan pods, so the Warden's
  phase 1 goes quiet (only the sweep). A line for that, or pods that grow
  back, would land the "They grow BACK" beat.
- Fixed: "phase 2 fired twice in one boss run". Cause: the survival route
  measured phase as max(HP phase, clock phase); once a pacifist-intact run
  broke pacifism mid-fight, the clock stopped counting, the phase dropped
  back to the HP phase and `bossPhase` 2 was announced again. Phases are
  now a high-water mark (`Boss.phase`); regression test in
  `tests/sim_wave3_test.ts`.
