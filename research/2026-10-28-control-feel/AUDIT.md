# Current implementation audit

Read October 28, 2026 against shared checkout HEAD `3f785ff8460c0bdf8691194d2dacdcb592ba1cde`. Other workstreams have uncommitted changes. Citations describe files as read, not a frozen release or a live audiovisual inspection. Paths below are repository-relative.

## Movement and input

| Question | Actual behavior and source |
| --- | --- |
| Coordinate/timing units | Original 480 × 640 playfield, velocity expressed per tick: `src/contracts/sim.ts:7–17`. 60 Hz: `src/contracts/time.ts:8–11`; human-play accumulator and game-speed multiplier: `src/main.ts:704–707`. px/s here means original playfield px per **simulation second**, not CSS pixels or slowed accessibility wall time. |
| Normal/focus | `PLAYER.speed=4.2`, `focusSpeed=2.0` px/tick, hence 252/120 px/s: `src/sim/tuning.ts:15–22`. Focus is 47.6% of cardinal cruise. |
| Held duration | No movement timer or acceleration exists. `flyPlayer` clamps each input axis then adds `axis*speed` directly every tick: `src/sim/sim.ts:800–812`. A ten-tick hold goes ten times as far as a one-tick hold away from walls. It does not progressively accelerate. |
| Stop/turn | Zero input stops on the next tick. A new direction changes velocity immediately, including reversal; no momentum or steering penalty. `p.vx/vy` are **measured displacement**, not persistent momentum (`sim.ts:806–811`). Horizontal bank is `dx*0.18`, independent of focus or held duration (`sim.ts:812`, `tuning.ts:36`). |
| Diagonals | Per-axis clamps are not vector normalization (`sim.ts:803–809`). `(1,1)` travels 5.94 px/tick normal or 2.83 focused: **356.38/169.71 px/s**, √2 faster than cardinal. Walls clamp X/Y separately to 18–462 and 60–616 (`tuning.ts:23–27`). At a wall measured velocity becomes zero on the blocked axis. |
| Keyboard/D-pad | Held directions form ±1 components, opposing directions cancel: `src/input/inputLayer.ts:343–346,359–365`. Keyboard repeat only repeats menu intents. Held state is recorded once and read each tick (`198–224`): OS repeat rate/delay cannot create hold acceleration. |
| Analogue | Stick uses radial 0.18 dead zone with magnitude rescaling and maximum radius 1: `inputLayer.ts:112–115,363`, `src/input/heldActions.ts:56–65`. Partial magnitude yields proportional speed now. A full diagonal stick generally has unit vector length, unlike keyboard diagonal. Keyboard/D-pad plus stick is summed and clamped per axis, so simultaneous devices can also exceed unit length (`inputLayer.ts:361–365`). |
| Mouse/touch | Gameplay frame is constructed only from keys/buttons/stick. Pointer listeners track device/activity, not ship motion (`inputLayer.ts:231–234,359–380`). Searches for pointer/touch gameplay adapters found none in `src/`. Menus support pointer use, but that is not touch gameplay parity. This is a present implementation gap, despite AGENTS.md's mobile requirement. |
| Hold/toggle effort | `src/input/heldActions.ts:30–53` implements fire/focus hold or toggle. Auto-fire inverts fire input, but not focus. Focus toggle reduces sustained motor effort. Do not make acceleration dependent on repeated presses or tight simultaneous-key timing. |

## Focus, visibility and sound

- Focus changes **movement speed only** in `flyPlayer`; `hurtPlayer` checks outcome and grace, not focus (`sim.ts:907–925`). Collision always uses `PLAYER.radius=6` (`sim.ts:588–596,989–992`). Focus grants no invulnerability and does not shrink collision.
- `snapshot().player` carries position, radius, bank, measured velocity, trigger/charge and scan, **not focus** (`sim.ts:588–605`). A stopped focused ship and a stopped unfocused ship therefore cannot be distinguished reliably from that snapshot. Inferring focus from speed would also fail for analogue magnitudes and walls.
- Render ship pose uses interpolated bank; engine/plume pulse continuously, independent of focus (`src/render/stage.ts:721–742`). Scan/Writ rendering uses their own fields (`752–755`). The stage creates `models.create("pilot_ship")` (`254`), so the fallback gem is not proof of the shipped GLB's hitbox visibility.
- Fallback ship has an always-present `hitboxGem` of radius 3 (`src/render/placeholders.ts:156–160`), not a focus-conditioned 6 px collision marker. No focus-conditioned gem/graze ring branch was found in the stage. Tutorial text explicitly promises “Hold focus to see the ring around your gem” (`src/i18n/script.gen.ts:29`): source-level teaching/presentation mismatch.
- `src/audio/gameplayAudio.ts:109–207` handles fire, charge, scan lock, graze and other gameplay events, not focus transitions. Frame processing toggles `scan_sweep` from `state.player.scan.active` (`210–245`). `ui_focus` in `src/audio/gameplaySounds.ts:273` is a **menu focus** tick, not gameplay slow-mode feedback. No entry, sustain or exit cue for gameplay focus was found.
- Grazing works in either mode; it checks distance, grace and outcome, not focus (`sim.ts:1326–1344`). `snapshot().graze.radius` exists (`656–659`) and could inform a future honest focus graze outline. An outline should distinguish collision from graze, not conflate them.

Conclusion: speed change can be felt/seen during movement, and static model details may be visible, but there is no explicit source-wired focus A/V announcement. The other intelligibility workstream owns capture/listening evidence.

## Scan, Writ and loadouts

- `flyPlayer` passes only `input.fire` to the trigger (`sim.ts:814`). `sweepScan` uses `!fireHeld && outcome===null` (`1400–1413`), while snapshot beam state follows trigger `rest` (`600–605`). Focus does not activate a scan, widen/narrow it, change lock rate, or affect charge timing directly. Slower motion can **indirectly** keep a target in the cone longer.
- Fire released: `rest`, idle counter increments, Writ charges. Next press spends charge and fires Writ, rather than release firing it (`src/sim/trigger.ts:64–85`). Holding beyond threshold streams (`86–90`). Do not accidentally copy Crimzon Clover's release-to-fire semantics into this game's rest-to-charge verb.
- All loadouts share movement/hitbox. `src/contracts/loadout.ts:33–55` defines only weapon and sensor numerical knobs. Standard weapon: stream interval 7 ticks; aimed cooldown 14; Writ thresholds **40/80/120 ticks** (0.667/1.333/2 s). Magistrate: 9 interval, 50/100/150 charge; Courier: 5 interval, same charge timing; Notary: 8 interval, aimed cooldown 9 (`70–123`). Cosmetics are ignored by simulation (`176–177`).
- Sensors (`126–159`): standard half-angle .35 rad, range 380 px, dwell 45 ticks (.75 s); Surveyor .62/340/70 (1.167 s); Auditor .2/420/22 (.367 s); Archivist .3/600/55 (.917 s). Injunction/Witness are honest out-of-slice fallbacks. No package changes focus speed or movement response.

## Architectural observations

The input-frame → deterministic sim → snapshot/events → presentation split is a strong **ports-and-adapters / functional-core boundary**. It supports testing without three.js or DOM. The missing focus state is a contract omission, not a reason to poll keyboard state inside audio or rendering.

The planner contains a **duplicated source of truth**: its private `SHIP` table repeats 4.2/2.0 speeds and bounds (`src/pilots/planner.ts:22–30`). Its candidate trajectories assume instantaneous movement followed by instantaneous stops (`108–123`). A new controller, or just diagonal normalization, invalidates those predictions. Share the pure response law and its state rather than adding another set of constants. Near-miss audio also uses player measured velocity (`sim.ts:1356`), which must remain truthful if momentum is introduced. Movement stats currently read **intent**, not actual velocity (`sim.ts:568–569`), so a coasting ship would be logged as stationary unless policy is clarified.
