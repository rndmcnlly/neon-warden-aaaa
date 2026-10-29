# Mobile, touch and school-device implementation (October 29, 2026)

Framing question: does the slice now meet AGENTS.md "Platforms" (desktop and
mobile browsers, every menu with a visible Back, the full fire verb by touch,
portrait-first, iOS audio, school Chromebooks) without censoring anything?
Design sources: `research/2026-10-28-mobile-touch/`,
`research/2026-10-28-chromebook-kids/`, `research/2026-10-28-control-feel/`.
Disciplines: interaction design, web platform engineering, real-time
rendering budgets, deterministic simulation, accessibility.

## What landed (commits `d3348f5`, `af7ba3f`, and the QA follow-up)

1. **One Back, many doors.** A visible Back chip (48 px, bottom-left, inside
   safe areas) on every screen whose Back means something (`Screen.noBack`
   hides it on the gate, title, first-run notice, continue screen, and the
   screens with their own Skip). Esc and pad B, right-click (real mouse
   button 2 only; Android long-press also fires `contextmenu`), and system
   Back through `src/ui/historyBack.ts`: one guard history entry while Back
   means something, unwound at the title so Back leaves the site (never
   trap). In a run, system Back opens Pause. Trackpad two-finger history
   swipe (`src/input/trackpadSwipe.ts`) pauses; `overscroll-behavior: none`
   stops the navigation; ctrl-wheel pinch is refused in play.
2. **Touch play** (`src/input/touchPilot.ts`, `src/ui/touchDeck.ts`):
   relative drag paid out in the sim's own speed units with a gain curve;
   Thumbs (default), One finger (tap is a 3-tick pulse, long-press latches
   the stream, tap stops it; never two touches), Arcade (the flying finger
   is the trigger). Auto-fire on touch is "pulse auto". Focus is a toggle
   chip. A second flying finger is ignored, not mixed.
3. **Writ aim assist** is a sim option (`SimOptions.aimAssist`,
   `WRIT_ASSIST_SLACK` 10 vs 4), fixed per run, setting touch/on/off. The
   nearest component still wins, so assist widens reach and never moves the
   disarm/kill line.
4. **Portrait-first layout** (`src/ui/touchLayout.ts`, pure): deck below
   the stage, stage narrowed and centered when Safari's toolbars leave too
   little height (iPhone 15 at 393 by 659), side decks in landscape, overlay
   fallback; HUD, toasts and subtitles follow the stage box; `dvh`,
   `viewport-fit=cover`, touch-action, user-select and callout guards.
5. **iOS audio**: resume on `touchend`, `click`, `keydown` and tab return
   (WebKit's activation events; `pointerdown` alone is not enough).
6. **School tier and auto-detect** (`src/render/quality.ts`,
   `src/render/autoTier.ts`): a pixel budget (800k) instead of a DPR cap
   (DPR 1 is a smear on a 393 px phone), no composer unless a hit or flash
   needs the finish pass, fewer stars and particles, bullets untouched.
   Hints (software GL, phone, 4 GB or 4 cores, CrOS) then a 2 s frame-time
   probe during the logos; a manual pick ends auto-tiering; "Detect
   graphics again" in Settings. Skipped under `?qa=1` unless `?autotier`,
   so other agents' captures keep their preset.

## Evidence

- Unit: `tests/ui_history_back_test.ts`, `tests/input_touch_test.ts`,
  `tests/ui_touch_layout_test.ts`, `tests/sim_aim_assist_test.ts`. `deno
  task ci`: 295 tests pass, build passes (after `af7ba3f`).
- Browser: `tests/mobile_touch_browser.ts` (Playwright 1.64; its WebKit is
  the locally installed one). iPhone 15 and Pixel 7, each in WebKit and
  Chromium, plus a Chromebook hybrid profile. Full run
  `qa/reports/mobile-touch-2026-10-29T17-38-02.018Z/result.json`: 126 of
  127 checks; the one failure (Pixel 7 Chromium, Writ topic: the test
  pilot died and the run ended under the aim loop) was a harness bug, fixed
  and re-run green in `qa/reports/mobile-touch-2026-10-29T17-47-19.807Z/`.
  Reels: one video per device and topic under each report's `video/`
  (menus by Back chip and history, tutorial lessons by touch, a Writ release
  and a disarm by touch, Pause by system Back). Reports are gitignored.
- Ogg Opus: Playwright WebKit (Safari 27.2 build, macOS media stack)
  reports `canPlayType` "probably" and decodes VO, SFX and music with
  `decodeAudioData`. So **no AAC/M4A fallback was built**.

## Declined or deferred, and why

- `CloseWatcher`: fires on Esc too (double Back), activation-limited.
- Dynamic resolution governor and 30 fps cap: need real-device numbers;
  risk of oscillation, and a cap that feels worse than an honest 45 fps.
- Auto-focus from slow finger speed: would toggle focus (and its future
  entry/exit sounds) constantly; slow drags already get a lower gain.
- Lock reticle with part ticks: render and HUD work beyond this scope.
- Classroom mode wording and "takedown": explicitly rejected by Adam
  (AGENTS.md, no censorship).
- Haptics setting, wake lock, Add to Home Screen hint, silent-switch
  setting (the switch is respected by default).
- Tutorial copy still names keys (Space, arrows) on touch; the VO and
  prompts need touch variants.

## Not verified on real devices (checklist)

1. iPhone: Ogg Opus in iOS Safari (Playwright WebKit runs the macOS media
   stack), audio after the silent switch and after a phone call, left-edge
   swipe-back in menus and during a run, Add to Home Screen launch, safe
   areas on a notched phone in landscape.
2. Android (Adam's Pixel 10 Pro): gesture Back on every screen, Chrome's
   history intervention (a Back right after a Back, before any touch).
3. Real multi-touch on Thumbs (tests use synthetic single pointers per
   finger), drag gain and sensitivity feel, FIRE size for small hands.
4. A managed school Chromebook: tier chosen, frame times, trackpad swipe
   cadence (`SWIPE` thresholds are starting numbers), touchscreen plus
   trackpad switching mid-run, fullscreen and WebGL policies.
5. Thermal drift over a 10-minute run on a phone.

## Next step

Adam tries Thumbs and One finger on the Pixel 10 Pro and an iPhone; one
young player on a school Chromebook decides the default scheme (research
risk 1).
