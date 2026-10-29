# Opt-in movement and precision prototype

Implemented October 28, 2026. **Classic remains default. Human preference is unmeasured.**

## Try it

- `?skipto=sector1&movement=classic&seed=121`
- `?skipto=sector1&movement=hybrid&seed=121`
- Autopilot comparison: add `&autoplay=fight` or `&autoplay=pacifist`.

Hybrid starts at126 px/s, adds8.4 px/s on subsequent driven ticks, reaches252 on tick16, retains direction authority through corners/reversals, and brakes to zero over at most three neutral ticks (4.2 px extra travel from cruise). Six neutral ticks retain the scalar envelope, not drift. Focus immediately selects120 px/s and hard-stops on neutral; exiting focus restarts at126. All numbers are original playfield pixels per simulation second. Accessibility game speed stretches wall time along with the world.

**Separate bug fix in both profiles:** keyboard diagonals no longer travel √2 faster. Magnitudes below one remain proportional. There are currently no loadout movement statistics to flatten: movement reads shared `PLAYER` tuning; weapon and sensor effects remain untouched.

`src/sim/movement.ts` is the shared pure step for both the ship and every autopilot candidate. Version1 response snapshots include profile, envelope, neutral counter, actual coast velocity, brake and resolved focus. Measured displacement remains `player.vel`. Fixed input replay must retain this version/profile, seed and loadout; this project has no historical replay-file loader to migrate. Do not claim old diagonal-boost input recordings are position-compatible.

Focus entry/exit events occur only on resolved state changes. Two short synthesized, unquantized SFX gestures are immediate, distinct and non-looping; suspended audio drops obsolete focus gestures. The steady collision outline and dark core are composited after bloom so hull/Writ glow cannot erase them. Sparse outer brackets use the actual graze radius, not a protection boundary. Thrusters narrow, ship banking settles, and scan remains the separate forward wedge governed by fire rest. Focus changes neither collision radius nor damage rules. Reduced motion/flashing use static engine geometry and suppress the decorative engine sparks. Existing shot speeds, swept hits, recoil and bounded shot chips are retained.

Pause/blur clear keyboard holds, pending edges and fire/focus toggle latches. Held gamepad controls must return to neutral before rearming. Auto-fire policy is not disabled by reset. Cruise/coast reset on pause, freeze, sector handoff and life loss. Tutorial fresh-action gating is unchanged.

## Comparison artifacts

Open [comparison.html](comparison.html). Four short real-time A/V clips use the same real simulation, input layer, models, renderer and audio engine without Director/VO/UI overlays. Each shows hold → corner → release → focus at rest → focused movement/fire → focus exit. They are human-comparison fixtures, not frame-identical keyboard replays: browser input scheduling varies by a tick or two. Numerical tests, not video timings, establish trajectory equality.

- `isolated-classic-high/reel.mp4`, `isolated-hybrid-high/reel.mp4`
- `isolated-classic-reduced-low/reel.mp4`, `isolated-hybrid-reduced-low/reel.mp4`: low tier, shake0, reduced motion and flashing.
- Each folder includes `focus-rest.png`, `focus-fire.png`, contact sheet and `result.json`. Audio captured, no page errors, peak/bus checks pass. Full-mix loudness warns because these intentionally sparse fixtures contain no score or VO. No loudness normalization was applied to make the comparison appear more exciting.
- `lifecycle-browser.json`: full production entry point, both profiles, actual pause/blur, frozen sim ticks and cleared focus after resume.

Initial integration captures in the untracked `classic-*`/`hybrid-*` folders are exploratory and predate the final post-bloom marker. Their unrelated VO-window failures are not concealed by the final isolated fixture; use the separate intelligibility workstream for narrative mix diagnosis.

## Checks and limits

- `focused-tests.log`:50 pass,0 fail, including ramp, release deadline/distance, normalized diagonals, analogue scaling, corners/reversals, gap memory, wall coast, precision, input resets, event/audio contracts, deterministic inputs, tutorial gates and retained shot-feel checks.
- `pilot-runs.json`:12 full routes (classic/hybrid × fight/disarming/no-fire × seeds1/121), all intended endings, no continues. Serialized input-frame replays reproduce all12 terminal hashes. Pacifist disarming may fire; only the ghost route must remain `neverFired`.
- `full-tests.log`:210 pass,1 existing failure: `vo/script.yaml mirrors the voiced variants`, stale generated VO bank mirror. Not changed here.
- `typecheck.log` and `lint.log`: pass. The isolated and production Vite bundles build through `capture.ts`, without mutating `public/vo` via sync.
- `static-qa.json`: existing coverage/assets,32 pass,6 warn,0 fail.
- `ci.log`: full CI attempted, stops at six unrelated formatting files (branding SVGs, SFX manifest and existing integration/WAVE docs). No blanket formatting of other workstreams.

No mobile gameplay adapter is invented here. The input profile applies to keyboard/gamepad; any future direct touch-drag release policy needs its own explicit replay contract. Two seeds are regression evidence, not a population survival estimate or proof of best feel. No paid generation or external deployment.

Production dashboard was already dirty with other sessions' changes and had no movement task, so it was not overwritten or included in this commit.

**Adam's comparison:** after brief practice, A) exact classic stop, B) cruise/coast worth learning, or C) hybrid only because focus is a hard precision escape? Judge overshoot, reversal trust, hand effort and enjoyment separately.
