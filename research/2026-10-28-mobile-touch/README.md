# Mobile and touch: Back affordances, touch shmup controls, mobile web technicals

Date: October 28, 2026. Scope: research and proposal only (no code edits;
agent C owns `src/ui/` right now). Disciplines in play: interaction design
(touch ergonomics, game feel), accessibility (WCAG 2.2, motor access),
web platform engineering (browser API support), real-time rendering
(performance budgets), and a little ethics of design for children (school
Chromebooks, data collection).

## Framing question

Adam's requirement (AGENTS.md, Platforms): the slice must be fully playable in
desktop AND mobile browsers, and now also on low-end managed school
Chromebooks played by elementary-school kids. Every menu needs a visible Back
for mouse and touch. Touch gameplay must express the whole fire verb from
`docs/WAVE3.md`: tap (aimed round), hold (stream), rest (Writ charge plus the
scanning beam), Writ release on a locked weak point or part. How do we do that
without making multi-touch mandatory, and what does the browser let us do?

## What the codebase does today (read October 28)

- `src/contracts/input.ts`: one `InputFrame { move, fire, focus, pause,
  confirm, back }`. Fire is a raw held state; the sim derives tap (press edge),
  stream (held past `TRIGGER.tapThreshold` = 8 ticks) and rest (released).
  A press edge after enough rest spends the charge as a Writ. The contract
  already anticipates an assisted "pulse" mode. Good design: the touch layer
  only has to produce one boolean and one vector, and the sim never learns
  who is flying (a clean **Ports and Adapters** boundary).
- Aim is positional: `src/sim/scan.ts` picks the scan target from the ship's
  position and sensor cone; `WRIT_ALIGN_SLACK = 4` playfield units decides
  whether a locked Writ hits a weapon part (disarm) or the weak point (kill)
  (`src/sim/tuning.ts:181–200`, "the choice is in the aim"). On a 390 CSS px
  wide phone the 480-unit playfield gives about 0.8 px per unit, so the slack
  is about 3 CSS px. Fingertip jitter is several times that. This is the
  single hardest touch problem in the design.
- `src/input/inputLayer.ts`: `Device = "keyboard" | "mouse" | "gamepad"`.
  Pointer events only mark the mouse as last-used and feed the press-any-key
  gate. There is no touch device and no pointer gameplay.
- `src/ui/router.ts`: a screen stack with `push`, `pop`, `reset`,
  per-screen `onBack`. Back arrives only as a `MenuIntent` from Esc,
  Backspace or pad button 1 (`frontEnd.ts:298`).
- `src/ui/widgets.ts:56`: `promptBar()` renders console-style prompts with
  `aria-hidden="true"`. They are labels, not controls. `prompts.ts` already
  swaps glyphs by device and pad family (a nice **Strategy by device**).
- `src/render/quality.ts`: tiers low to ultra; low is already DPR 1, no bloom,
  no AA, 600 stars, 512 particles. A good base for a mobile and Chromebook
  tier, but nothing picks it automatically and nothing adapts at runtime.
- `index.html`: `width=device-width, initial-scale=1.0` only (no
  `viewport-fit=cover`, so safe-area insets are always zero today).

## 1. Back affordances

### Findings

- **Console convention**: a prompt bar at the bottom ("B Back", "A Select")
  whose glyphs follow the last-used device. PC ports of console games
  (Destiny 2, Elden Ring, most Unreal front ends) make those prompts
  clickable, so the prompt bar doubles as a button bar for mouse users. We
  already have the bar; it just is not interactive.
- **Mouse**: right-click as Back is common in PC game menus (and harmless,
  since we suppress the context menu anyway). The mouse side buttons are
  `MouseEvent.button` 3 (back) and 4 (forward); browsers treat button 3 as
  history back. Handling it through history (below) is more robust than
  trying to cancel it per browser.
- **Android system back** (gesture or button) and the **browser back button**
  navigate session history. Pages intercept them with `history.pushState`
  plus `popstate`, or with **`CloseWatcher`** (Chrome and Chrome Android 126+,
  Firefox 149+, Safari only in preview; MDN BCD 8.1.7, October 22, 2026).
  `CloseWatcher` exists precisely because "on a device with a keyboard it
  might be the Esc key, but Android might use the back button"
  (MDN, CloseWatcher). Chrome also has a history-manipulation intervention:
  entries pushed without user activation can be skipped by the back button,
  so pushState-trapping is unreliable (WICG close-watcher explainer,
  github.com/WICG/close-watcher).
- **iOS Safari** has no hardware back; its left-edge swipe navigates history
  and cannot be disabled by `touch-action` or `preventDefault`. With history
  entries per screen it simply becomes another Back. In gameplay a drag that
  starts at the very left edge can trigger it, which is one more reason to
  keep the drag zone off the edge (deck layout, section 2).
- **Touch target size**: WCAG 2.2 SC 2.5.8 sets 24 by 24 CSS px minimum;
  Apple HIG asks for 44 pt and Material for 48 dp. Children have less precise
  pointing, so we use 48 px.

### Recommendation: one Back, many doors

Make Back a single routed command with several input "doors", all landing on
the existing `router.top().onBack ?? router.pop()` path:

1. **Visible Back chip** on every screen with router depth above 1 (and on
   the pause menu). Fixed position: bottom-left, inside
   `env(safe-area-inset-*)`, at least 48 by 48 px hit area, label
   "‹ BACK" plus the device glyph (`Esc`, `B`, `○`, nothing extra for touch
   and mouse). It is the first item of an **interactive prompt bar**: turn
   `promptBar()` entries into real `<button>`s (remove `aria-hidden`, give
   them accessible names), so "A Select" and "B Back" are clickable too.
   Same spot, same look, every screen: poka-yoke for kids and for agents.
2. **Right-click** anywhere on a menu screen = Back (suppress
   `contextmenu`). Not during gameplay.
3. **History bridge** (one module, owned by UI): keep exactly one guard
   history entry while the router depth is above 1 or a run is in progress.
   On `popstate`, dispatch Back (in gameplay: Pause), then re-arm the guard if
   still needed. Re-arm on the next user gesture, not inside `popstate`,
   because of Chrome's intervention. Where `CloseWatcher` exists, use it
   instead of the guard entry (it also gets Esc, so the input layer must
   keep its Esc handling from double-firing: test this). This one bridge
   covers Android back, the browser back button, mouse button 3, Alt+Left,
   and iOS swipe-back.
4. **Gameplay**: a pause button (top-right, 48 px, inside the safe area) on
   touch and mouse; system Back during a run opens Pause, never leaves the
   page. `visibilitychange` to hidden also pauses.
5. Never trap: on the title screen (depth 1, no run) the bridge disarms, so
   system Back leaves the site as users expect.

No edge-swipe gesture of our own: it conflicts with iOS swipe-back and
Android back gestures, and it is invisible (fails the "obvious" bar).

## 2. Touch shmup controls

### Survey (what the genre does on phones)

| Game                          | Move                                         | Fire                                                                                                | Notes                                                                                                |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| DoDonPachi Resurrection (iOS) | relative slide                               | automatic; a toggle switches shot and laser                                                         | "Your ship shoots automatically, so all you have to do is steer" (Adrian Hon, Substack; IGN review). |
| Danmaku Unlimited 2 and 3     | relative swipe ("swipe controls")            | automatic; extra held button for a secondary mode                                                   | Players note finger-speed-dependent movement (Steam discussion 450950).                              |
| Sky Force Reloaded            | relative drag, ship above finger             | automatic                                                                                           | Specials on buttons (recollection, unverified this session).                                         |
| Galaxy Attack: Alien Shooter  | relative drag                                | always automatic                                                                                    | Pure steering, casual.                                                                               |
| Phoenix II                    | relative drag                                | automatic; lift the finger to slow time and pick a power, i.e. **lifting is a verb**                | Closest precedent for our rest (recollection, unverified).                                           |
| Ikaruga-likes                 | relative drag                                | automatic; polarity on a tap button                                                                 | A second verb lives on one button.                                                                   |
| Virtual-stick ports           | fixed or floating stick                      | buttons                                                                                             | Widely disliked for bullet hell: no 1:1 positioning.                                                 |

Patterns: relative drag is the genre standard (the ship moves by the
finger's delta, so the finger stays below the ship and never covers it;
the PlayMaker forum thread "Relative touch control for shmup" describes the
same delta technique). Fire is almost always automatic, because a second
finger is costly in portrait. Our design is unusual: fire is the core verb
and resting is meaningful, so pure autofire would delete the game.

Research notes: occlusion and the offset between perceived and sensed touch
point are well documented (Vogel and Baudisch, "Shift", CHI 2007; Holz and
Baudisch, "The Generalized Perceived Input Point Model", CHI 2010). Relative
drag sidesteps both for movement. On-screen gamepads lose to physical ones
mainly through missing tactile feedback (Baldauf et al., "Investigating
On-Screen Gamepad Designs for Smartphone-Controlled Video Games", ACM TOMM
2015), so buttons should be big, fixed, and forgiving.

Accessibility constraint: WCAG 2.2 SC 2.5.7 (Dragging Movements) wants a
single-pointer, non-dragging way to operate, unless dragging is essential.
Steering a shmup is arguably essential, but the fire verb is not, and no
scheme may require two simultaneous touches (SC 2.5.1 Pointer Gestures).

### The key layout insight: a control deck below the playfield

The playfield is 480 by 640 (3:4). A portrait phone is about 9:19.5. On an
iPhone 15 (393 by 852 CSS px, safe areas about 59 top and 34 bottom), the
playfield fit to width is 393 by 524, leaving about 235 px below it: a
thumb-zone **control deck**. Fingers on the deck never occlude the
playfield, the edge-swipe zone is avoided, and the deck can show
charge, scan lock, and pay readouts at thumb distance. In landscape the
deck splits into left and right side decks (playfield fit to height), which
is a natural two-thumb grip. Fallback when the deck would be under 160 px
(small phones with browser chrome showing): **overlay mode**, controls
translucent over the bottom of the playfield, ship drawn 64 px above the
finger's start point.

```
 PORTRAIT (deck mode)                    LANDSCAPE (side decks)
+---------------------------+          +--------+-----------+--------+
| [II]  PAY x2.4   SCOUTS 3 |  <- HUD  |        |           |  [II]  |
|---------------------------|  safe    |  DRAG  |  PLAY-    |        |
|                           |          |  PAD   |  FIELD    |  WRIT  |
|        PLAYFIELD          |          |        |  3:4 fit  |  ooo   |
|         480 x 640         |          | (left  |  to       |        |
|          ( ^ )            |          | thumb) |  height   | [FIRE] |
|           ship            |          |        |           | right  |
|---------------------------|          |        |           | thumb  |
| WRIT ooo   LOCK: DRONE    |  deck    +--------+-----------+--------+
|                           |  readout
|   drag anywhere    +----+ |
|   here (or on     | FIRE| |  <- 96 px, right thumb (mirror option)
|   the playfield)   +----+ |
| [< BACK]                  |  <- menus only; Pause is [II] in-game
+---------------------------+
   home indicator safe area
```

### Mapping our verb: three touch schemes

All three produce the same `InputFrame`. Movement in every scheme: one
finger, relative drag, starting anywhere except the FIRE button and the
pause button. The ship moves by finger delta times a gain (see precision
below), clamped to the playfield. Lifting the move finger stops the ship
(no drift).

**A. Thumbs (default on phones and tablets).**
Move finger drags; FIRE is a momentary button held by the other thumb.
`fire = fireButtonDown`. So: tap FIRE = aimed round; hold FIRE = stream;
let go = rest (Writ charges, scan beam sweeps, ship still steerable); tap
FIRE after charging = Writ. This is a 1:1 port of the keyboard verb, keeps
"dodge while scanning" (the heart of rest), and supports a pacifist,
`neverFired` run. It needs two simultaneous touches only to fire while
moving, which is why B exists.

```
 FIRE finger:  ___|‾|____________|‾‾‾‾‾‾‾‾‾‾|_____________|‾|___
 sim reads:       tap  (rest: charge+scan)  stream   (rest...)  Writ
 MOVE finger:  ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾  (steers throughout)
```

**B. One finger (accessibility; no simultaneous touches ever).**
Drag moves. FIRE becomes a latching control, honoring the existing
`accessibility.holdToggle` setting:
- tap FIRE while resting with no charge: start the stream (latched);
- tap FIRE while streaming: stop (rest begins);
- tap FIRE while resting with charge: a short pulse (held 3 ticks, under
  the 8-tick tap threshold) that the sim reads as a press edge, so the Writ
  fires, then rest resumes;
- long-press FIRE (400 ms) while resting: a single aimed round instead.
The pulse is the contract's sanctioned assisted mode ("an assisted pulse
mode should release now and then"): a held state of a few ticks, not a
synthesized tap event. Every action is one pointer, one tap.

**C. Arcade (optional, kid-friendly, "touch is trigger").**
`fire = moveFingerDown`. Touch and drag = stream; a quick touch = aimed
round; lift = rest (ship stops, Writ charges, beam sweeps); touch down
again = Writ. One finger, maximally simple, and lifting becomes a verb as in
Phoenix II. Cost: you cannot move while resting, and `neverFired` runs are
impossible. Offer it in the tutorial as "Simple controls", not as the
default.

Auto-fire (existing `accessibility.autoFire`) on touch should be "pulse
auto": stream while the move finger is moving, rest while it is still or
lifted. This preserves charge and scan for players who cannot press at all.

### Precision, focus and disarm aiming

The 4-unit Writ alignment is too tight for fingers. Layered fixes, cheapest
first:
1. **Gain curve instead of a focus button**: slow finger motion maps at
   gain 0.6, fast at 1.4 (a pointer-acceleration curve, like desktop mouse
   precision). Slow, careful drags are focus. Report `focus = true` while
   the finger speed is below a threshold so the sim's focus speed also
   applies. Sensitivity slider in Controls.
2. **Lock reticle with part ticks** in the HUD: when a target is locked,
   draw the weak point and each weapon part's x as ticks above the ship, and
   light the one the ship is aligned with. The player sees the choice
   (disarm or kill) before releasing. Render plus HUD work.
3. **Aim assist setting** (accessibility, default on for touch): a
   `SimOptions` field widening `WRIT_ALIGN_SLACK` (for example to 10) and
   snapping a locked Writ to the nearest component within it. Sim-side and
   deterministic, so replays stay valid; it must be part of the recorded
   options, not a render trick.
4. Scan needs nothing extra: it is positional and happens while resting,
   which every scheme supports.

### Mouse and trackpad (Chromebooks, desktops)

Optional pointer gameplay: Pointer Lock plus relative motion, left button
as FIRE. On school Chromebooks most kids will use the keyboard; a trackpad
is a poor shmup controller (click-and-drag strains). Recommend keyboard
prompts by default on Chromebooks and leave mouse play as a stretch goal.

## 3. Mobile web technicals

Support data below is from MDN browser-compat-data 8.1.7 (October 22, 2026)
and caniuse `fullscreen.json` unless noted.

| Topic                        | Recommendation                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewport                     | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`. Size the app shell with `100dvh` (Safari iOS 15.4+, Chrome 108+), never `100vh`.                                                                                                                    |
| Safe areas                   | `env(safe-area-inset-top/right/bottom/left)` (iOS 11+, Chrome 69+); requires `viewport-fit=cover`. HUD, deck, Back chip and pause button live inside them.                                                                                                                                                                          |
| Scroll, zoom, long-press      | On the game root: `touch-action: none` (kills pan and pinch-zoom), `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none` on `html, body`. Suppress `contextmenu`. Menus keep `touch-action: manipulation` so lists can scroll. |
| Input                        | Pointer Events only (`pointerdown/move/up/cancel`), `setPointerCapture` on the move finger, track by `pointerId`, treat `pointercancel` as release. Add `"touch"` to `Device`; initial guess from `matchMedia("(pointer: coarse)")`, then last-used wins (Chromebook hybrids flip freely).                                       |
| Fullscreen                   | `requestFullscreen` works on Android Chrome and desktop. On iPhone it does not exist for non-video elements; on iPad it shows a non-dismissable overlay and swipe-down exits, "unsuitable for some use cases like games" (BCD note; caniuse note 5, still true through iOS 27.2). Offer a Fullscreen toggle only where supported. |
| PWA                          | A web app manifest with `"display": "fullscreen"` (falls back to `standalone` on iOS) plus `apple-mobile-web-app-capable` gives iPhone players a chrome-free game after Add to Home Screen. A small one-time hint on iOS Safari. No service worker needed for the slice.                                                         |
| Orientation                  | `screen.orientation.lock()` works only on Chrome Android (and in fullscreen); iOS Safari: not supported (BCD). Do not lock: portrait deck and landscape side decks both work.                                                                                                                                                       |
| Audio unlock                 | Resume the `AudioContext` inside the press-any-key gate's `pointerup`/`click` (`boot.ts` gate already exists: make it the unlock). Re-resume on `visibilitychange` and when `ctx.state` is `"interrupted"` (iOS calls, Siri).                                                                                                       |
| Silent switch                | Safari 16.4+ has `navigator.audioSession.type`. Default `"auto"` treats Web Audio as ambient and the ring/silent switch mutes it. Setting `"playback"` ignores the switch. Respect the switch by default (polite, and right for kids in class); add a setting "Play sound in silent mode".                                     |
| VO codec risk                | Our VO is Ogg Opus (`public/vo/*.ogg`). Safari 18.4 added Ogg Opus and Vorbis per WebKit's release notes as reported (r/apple summary mentions macOS; iOS unconfirmed). Verify on a real iPhone; fallback is CAF/Opus or AAC copies built by the existing pipeline.                                                              |
| Vibration                    | `navigator.vibrate` on Chrome Android only, requires a user gesture; nothing on iOS. Short pulses for Writ release, lock, and hit; setting "Haptics" (default on where supported, hidden elsewhere).                                                                                                                              |
| Wake lock                    | `navigator.wakeLock.request("screen")` (Chrome 84+, iOS 18.4+) during a run so the screen does not dim mid-boss; release on pause.                                                                                                                                                                                                  |
| WebGL2                       | Universal in current browsers (iOS 15+, Chrome Android 58+). Still detect failure: blocklisted GPUs, and Chrome Enterprise policy `Disable3DAPIs` on managed devices. Show a plain, friendly "graphics are turned off on this device" screen rather than a black canvas.                                                       |
| Battery and thermals         | No thermal API on the web. `getBattery` is Chrome only; Compute Pressure is desktop Chrome 125+ only. iOS Low Power Mode caps `requestAnimationFrame` at 30 fps; our fixed-tick sim with `interp.ts` already tolerates that. Infer heat from frame-time drift (governor below).                                              |

### Performance tiers and the governor

- Auto-pick on first boot: `low` when coarse pointer and small screen, or
  `navigator.deviceMemory <= 4` (Chrome), or `hardwareConcurrency <= 4`;
  otherwise `medium`. Never default to high on mobile. ChromeOS on 4 GB
  Celeron or MediaTek boards gets low.
- Add a `mobile` column or adjust `low` in `src/render/quality.ts`: DPR cap 1
  (phones are 3x: rendering at 3x is 9 times the fill cost), bloom off,
  chromatic aberration and grain off, stars 400, particles 384, no AA (use
  FXAA only if a cheap pass is needed), bullet instancing unchanged.
- **Dynamic resolution governor**: every 2 s, if p90 frame time > 20 ms,
  lower `renderScale` by 0.1 (floor 0.6); if it stays high at the floor,
  drop a tier and toast it once. If p90 < 12 ms for 10 s, step back up. This
  also handles thermal throttling, which shows up as slow frame-time drift
  after a few minutes.
- Pause rendering when hidden; cap the render loop to 30 fps in a
  "Battery saver" setting (the sim still ticks at 60).

### Chromebooks and young players (new requirement)

- Low tier must hold 60 fps at 1366 by 768, DPR 1, on Intel Celeron N4500
  class or MediaTek MT8183 class GPUs. Treat that as the QA floor device.
- Hybrid input: touchscreen, trackpad and keyboard on one machine; device
  prompts follow last-used per event, never per session.
- No data collection: no analytics, no third-party fonts or CDNs, settings
  in `localStorage` only. This is a COPPA-style posture, and it also makes
  the game school-network friendly (content filters often block CDNs and
  font hosts). Ship everything same-origin, keep the first load small, and
  lazy-load VO by language.
- Readability: minimum body text 16 CSS px at scale 1, subtitles default
  larger on touch, the existing subtitle scale setting reachable from the
  first-run flow. Plain-language Back label, 48 px targets.
- Fullscreen may be blocked by managed policy; feature-detect and hide.

### QA

- Playwright projects: `devices["iPhone 15"]` (WebKit), `devices["Pixel 7"]`
  (Chromium), a 1366 by 768 Chromebook profile with `hasTouch: true`, all
  with `isMobile` and `hasTouch` where relevant. Playwright's
  `touchscreen.tap` covers single touches; multi-touch (scheme A) needs CDP
  `Input.dispatchTouchEvent` in Chromium or synthetic `PointerEvent`s with
  distinct `pointerId`s via `page.evaluate`.
- New focused reels (per the QA policy: short, single-topic): `touch-menus`
  (every screen reached and left via the Back chip only, then via
  `history.back()`), `touch-verb` (tap, hold, rest-charge-scan, Writ in each
  scheme), `touch-layout` (portrait deck, overlay fallback at 375 by 553,
  landscape side decks, safe-area insets simulated with a CSS override).
- Assertions: no element outside the safe area; every screen at depth above
  1 has a visible Back with a hit area of at least 48 px; `popstate` never
  leaves the app while depth is above 1; frame-time p90 on the low tier
  with CPU throttling 4x.
- Real-device checklist (Playwright cannot emulate these): iPhone silent
  switch on and off; audio after a phone call; Ogg Opus VO decodes; swipe-
  back from the left edge during menus and gameplay; Add to Home Screen
  launch; Android gesture back on every screen; 10-minute run for thermal
  drift; a managed school Chromebook on a school network.

## 4. Recommendations in brief

1. One Back command, five doors: Back chip (in an interactive prompt bar),
   right-click, history bridge (CloseWatcher where present, guard entry
   elsewhere) covering Android back, mouse button 3 and iOS swipe-back,
   Esc and pad B as today, and Pause on system Back during a run.
2. Touch deck below the 3:4 playfield in portrait, side decks in landscape,
   overlay fallback on short screens.
3. Three touch schemes over one `InputFrame`: Thumbs (default), One finger
   (accessible latch with pulse), Arcade (simple). Pulse auto-fire.
4. Precision through a gain curve, a lock reticle with part ticks, and a
   sim-side, recorded aim-assist slack.
5. Auto low tier on phones and Chromebooks plus a dynamic resolution
   governor; no data collection, same-origin assets.

### Mobile settings defaults (when first device is touch)

| Setting                         | Default            | Notes                                                    |
| ------------------------------- | ------------------ | -------------------------------------------------------- |
| `display.preset`                | low (phones, Chromebooks), medium (tablets) | governor may step up                     |
| `display.renderScale`           | 1, governed 0.6–1  |                                                          |
| `controls.touchScheme` (new)    | `thumbs`           | `thumbs`, `oneFinger`, `arcade`                          |
| `controls.touchSensitivity` (new) | 1.0              | range 0.5–2                                              |
| `controls.fireSide` (new)       | right              | mirror for left-handed players                          |
| `accessibility.holdToggle`      | hold               | `toggle` implies the latch behavior of scheme B         |
| `accessibility.autoFire`        | off                | when on, touch uses pulse auto                          |
| `accessibility.aimAssist` (new) | on for touch, off otherwise | widens Writ slack (sim option, recorded)       |
| `audio.respectSilentSwitch` (new) | on               | iOS only                                                 |
| `haptics` (new)                 | on                 | Android only; hidden where unsupported                   |
| `subtitles.scale`               | 1.15 on phones     |                                                          |
| `batterySaver` (new)            | off                | 30 fps render cap                                        |

New settings need contract changes (`Settings` in `src/contracts/`), so they
go through whoever owns contracts.

## 5. Implementation plan by owner

**Input (`src/input/`)**
- Add `"touch"` to `Device`; a `touchPilot` adapter: pointer tracking by id,
  relative-drag move with gain curve, FIRE button state, the three schemes,
  pulse logic for scheme B and pulse auto. Output stays `InputFrame`.
- Report `focus` from slow finger speed.
- `contextmenu` suppression and right-click as a `back` intent in menus.

**UI (`src/ui/`, after agent C lands)**
- Interactive prompt bar with a fixed Back chip (bottom-left, safe-area
  aware, 48 px), glyph by device.
- History bridge module (`src/ui/historyBack.ts`): CloseWatcher or guard
  entry, synced to `Router` depth and run state.
- Touch deck DOM (FIRE button, Writ pips, lock readout), pause button,
  deck, side-deck and overlay layouts; first-run "choose your controls"
  card in the tutorial; Controls settings for the new options; iOS Add to
  Home Screen hint.
- `index.html` viewport meta, manifest, app shell on `dvh` and safe areas.

**Sim (`src/sim/`)**
- `aimAssist` in `SimOptions`: wider `WRIT_ALIGN_SLACK` and snap, recorded
  with replays.

**Render (`src/render/`)**
- Mobile-friendly low tier, auto-pick, dynamic resolution governor, battery
  saver cap, WebGL failure screen.
- Playfield fit and letterbox for the deck layouts; lock reticle with part
  ticks; ship offset in overlay mode.

**Audio (`src/audio/`)**
- Unlock on the gate gesture; resume on interruption; `audioSession.type`
  wired to the silent-switch setting; verify Ogg Opus on iOS, add a fallback
  encode if needed; haptics alongside Writ, lock and hit cues.

**QA (`qa/`)**
- Device projects, the three touch reels, layout and Back assertions,
  low-tier frame-time budget, and the real-device checklist as a markdown
  form in `qa/`.

## Risks

1. Scheme A needs two simultaneous touches to fire while moving; if
   playtests show kids cannot manage it, make Arcade the phone default.
2. Writ alignment on touch may still feel unfair even with assist; the
   reticle is the honest fix, assist is the forgiving one.
3. iOS: no fullscreen on iPhone, browser chrome eats height, swipe-back at
   the left edge, possible Ogg Opus gaps. PWA install mitigates the first
   two only for players who install.
4. History bridge bugs can strand users or eat their back button. Keep it
   small, disarm at depth 1, and test with real Android gestures.
5. Managed Chromebooks may disable WebGL or fullscreen by policy; school
   filters may block anything not same-origin.
6. Low-end GPUs and phone thermals: without the governor, frame rate will
   sag mid-boss, exactly where the slice must shine.

## Status and next step

Status: research done from the codebase plus web sources (MDN BCD 8.1.7,
caniuse, W3C Understanding 2.5.7, WICG close-watcher, genre reviews). Not
tried on devices. Unverified claims are marked (Sky Force and Phoenix II
details from recollection; iOS Ogg Opus support).

Next step: after agent C finishes `src/ui/`, prototype the Thumbs scheme
and the Back chip plus history bridge behind a dev flag, record the
`touch-verb` and `touch-menus` reels, and have Adam try it on his Pixel 10
Pro and an iPhone. A one-page playtest with one young player on a school
Chromebook would test the scheme default question (risk 1).

## Sources

- MDN browser-compat-data 8.1.7 (unpkg `@mdn/browser-compat-data`), entries
  for ScreenOrientation.lock, Navigator.audioSession, CloseWatcher,
  Navigator.vibrate, dvh units, WakeLock, getBattery, PressureObserver,
  safe-area env(), WebGL2, Element.requestFullscreen.
- caniuse, Fullscreen API (`features-json/fullscreen.json`), note 5.
- MDN, CloseWatcher: https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher
- WICG close-watcher explainer: https://github.com/WICG/close-watcher
- W3C, Understanding SC 2.5.7 Dragging Movements:
  https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- MDN, AudioSession.type; GitHub AndiMb/scoreview issue 23 (silent switch
  behavior of `auto`).
- WebKit bug 206854 (Fullscreen API on iPhone).
- Adrian Hon, "DoDonPachi Resurrection HD+" (Substack); IGN, DoDonPachi
  Resurrection review (2010); minireview.io and Steam discussion 450950 on
  Danmaku Unlimited touch controls; PlayMaker forum, "Relative touch control
  for shmup".
- Vogel and Baudisch, CHI 2007; Holz and Baudisch, CHI 2010; Baldauf et al.,
  ACM TOMM 2015.
