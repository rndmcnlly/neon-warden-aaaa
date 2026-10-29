# Integration playtest (October 28, 2026)

## Framing question

After integration pass 1 wired every workstream into `src/main.ts`, does
the built game (`deno task build && deno task preview`) play end to end by
keyboard alone, and do both autopilots reach their endings, with no console
errors and no translated panel overflowing?

## How it was run

- `playtest.py` (`uv run --script`, Playwright driving the headless Chromium
  shell already in `~/Library/Caches/ms-playwright`, no download). `ONLY=abcd`
  picks checks; each run writes `report-<checks>.json`.
- `probe.py URL KEY,KEY,waitMS,...` prints the screen stack and focused
  element after each key: the quickest way to learn a menu path.
- Preview at `http://localhost:4173/`, 1280 x 800 unless noted.

## Findings

| Check                                                                                                      | Result                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a. Gate, notice, logos, title, main menu, Settings > Subtitles size, Controls remap, New Game to tutorial | Pass. Subtitle scale 1 to 1.2 persisted; `moveUp` became `KeyJ, KeyW`. Tutorial starts and subtitles show the Lane Authority lines.                                                                                                  |
| a. `?skipto=flashback`, pause, quit to menu                                                                | Pass after a fix (below). World frozen at tick 1 while the recorder plays; pause stops the scene; quit lands on the title.                                                                                                          |
| a. `?skipto=ending-kill` (manual)                                                                          | Pass after a fix: ending, credits, back to the title in about 60 s.                                                                                                                                                                  |
| b. `?autoplay=fight&speed=16`                                                                              | Pass: `bossDefeated` at tick 14128 after 67 s wall time; flashback fired on the first drop in sector 1.                                                                                                                             |
| c. `?autoplay=pacifist&speed=16`                                                                           | Pass: `bossSurvived` at tick 11908 after 67 s, 0 kills; the sector-3 salvage cache triggered the flashback ("That recording was corrupted").                                                                                        |
| d. Extras in es and zh at 1280 x 800 and 800 x 600                                                         | Pass: every `.nw-panel` has `scrollWidth <= clientWidth` (476 / 476).                                                                                                                                                               |
| Console                                                                                                    | Zero errors and page errors across all runs.                                                                                                                                                                                         |

### Bugs found and fixed in this pass

1. Skip-to scenes were cut by the run's own first tick: the sim announces
   its starting sector (and the Warden's warning) on tick 1, those events
   start their scenes, and `Director.play` skips whatever ran before,
   including the `resumeSim` at the flashback's end. `main.ts` now starts a
   skip-to scene after the first tick (`openingScene`).
2. Nothing set `credits.rollDone`, so a human run would hang after the
   ending. `main.ts` releases it as the roll starts until a crawl exists.
3. Boot logos spun a full turn, so half the time the lettering read
   mirrored, and the studio mark was cropped at the top. Now a +/-0.45 rad
   sway and a wider `logoTurntable` framing (`01-logos.jpg`).
4. Readability (from the WS3 queue): enemy orbs are saturated pink and gold
   discs with a dark rim under normal blending (additive blending could not
   darken anything), player shots are saturated cyan, bloom threshold 1.05
   with strengths cut about 25%, and Blender emissive strengths are capped at
   load (core 1.6, others 3). The Warden reads as a silhouette again
   (`08-ending-fight.jpg`). Reduced flashing still scales bloom by 0.6.

### Open (owners named in `docs/INTEGRATION-QUEUE.md`)

- The quit dialog reported focus on Cancel after ArrowLeft, yet Enter quit.
  Either focus reporting or the dialog's key handling is off (WS2).
- No HUD, continue screen, ending banners, credits crawl, tutorial skip
  binding, barks or chatter yet; music and UI sfx have no picks, so only VO
  plays.
- Licenses data is in `src/data/thirdParty.ts`; the screen still lists the
  old three entries until the strings pass switches it over.
- Autoplay timelines run in real time while the sim runs 16x, so at high
  speed scenes overlap and cut each other (sector intros mostly). Fine for a
  demo; an attract mode might skip scenes instead.

## Screenshots

`01-logos`, `02-main-menu`, `03-settings-subtitles`, `04-new-game`
(tutorial), `05-flashback`, `07-extras-zh`, `08-ending-fight`,
`09-ending-pacifist`.

## AX note (agent experience)

Driving the game as an agent worked well because the front end exposes
stable `data-key` attributes and a single focus model: a probe that prints
"screen stack plus focused key" after each press made every menu path
learnable in one or two tries, with no pixel guessing. The dev overlay's
one status line (tick, phase, sector, outcome) was the single most useful
signal: polling it every 3 s told the autoplay runs apart without any
in-game HUD. Friction: the default-safe Cancel in confirm dialogs (good UX)
plus focus that did not visibly move made the quit path ambiguous, and
`localStorage` holds nothing until the first change, so seeding a language
meant writing a partial settings object and trusting the merge. A small
`?lang=` flag would make localization QA one URL per case.

## Next step

Hand the open items to their owners, then a second playtest that also
records short, single-topic videos per the QA rule in `AGENTS.md` (there is
no `qa/` folder yet, so no `qa/` checks could be run for this report).
