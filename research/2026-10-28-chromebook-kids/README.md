# Chromebooks and young players (October 28, 2026)

## Framing question

AGENTS.md (Platforms) commits us to "good Chromebook coverage: elementary-school
kids will play it on low-end managed school Chromebooks", with a smooth low tier,
no data collection, readable text and a school-network-friendly build. What does
that commit us to, concretely, in hardware budgets, managed-device behavior,
input, content and law, and how do we test it without a lab of Chromebooks?

Scope: Chromebooks and ages 6–11. Phone and tablet touch schemes belong to the
parallel `research/2026-10-28-mobile-touch/` study; this note only adds
Chromebook-specific input issues (trackpad, hybrids, tablet mode, stylus).

Disciplines navigated: graphics performance engineering, IT administration
(Chrome Enterprise policy), child-development and reading-level design,
privacy law (COPPA, FERPA, state student-privacy law), content-rating practice
(ESRB, PEGI), and classroom pedagogy.

## Summary of recommendations

1. Add a fifth graphics preset, **School**, below Low, chosen automatically on
   first run by a cheap probe during the logo sequence, with dynamic resolution
   afterward. Target a stable 30 fps render (sim stays at its fixed 60 Hz tick)
   at about 1024x576 internal resolution on a Celeron N4500.
2. Treat every Chrome admin policy we can hit (WebGL off, audio off, fullscreen
   off, storage wiped) as a designed state with an honest, teacher-readable
   message, never a blank canvas.
3. Same-origin everything (already nearly true: system fonts, no CDN), per-language
   lazy loading, an initial-to-title budget of 5 MB and to-gameplay of 15 MB,
   and a service worker for second loads.
4. Prevent the trackpad back-swipe from leaving the game (`overscroll-behavior-x`
   plus a history guard that opens Pause), auto-pause on blur, and swap prompts
   by last-used input rather than by device guess.
5. Content judgment: the slice as written is roughly **ESRB E10+ (Fantasy
   Violence) / PEGI 7**. That is fine for ages 10–11 and borderline for 6–9.
   A **Classroom mode** is warranted, scoped to wording and sensory intensity,
   with the story (including the morally gray ending) intact. Recommend
   "takedown", not "disable", as the replacement for "kill" (see section 4).
6. Keep collecting nothing, and say so in a one-page privacy statement and a
   teacher notes page. Do not turn on host-side analytics.

## 1. Hardware reality

### Fleet

Schools still run the pandemic-era wave (Celeron N4020, N4500, MediaTek MT8183)
next to current purchases (Intel N100, MediaTek Kompanio 520). Google's
[Auto Update policy](https://support.google.com/chrome/a/answer/6220366?hl=en)
now promises "10 years of updates" from platform release, so 2020–2021 devices
stay supported (and in carts) into the 2030s. Typical panel: 11.6 inch,
1366x768, 4 GB RAM (for example the
[Galaxy Chromebook Go listing](https://www.amazon.com/clp/B0FZJJS8NP);
[Wirecutter](https://www.nytimes.com/wirecutter/reviews/best-chromebook/) notes
budget models on N4500 and N100 with 4 GB). A
[k12sysadmin thread](https://www.reddit.com/r/k12sysadmin/comments/1rititg/chromebooks_with_mediatek_chips_yay_or_nay/)
shows districts actively choosing the Kompanio 520 for 2026–2027.

| Part | CPU | GPU | Notes | Source |
| --- | --- | --- | --- | --- |
| Celeron N4020 (2019) | 2C/2T, PassMark 1,531, ST 1,122 | UHD 600 (Gemini Lake) | Oldest common; weakest | [PassMark compare](https://www.cpubenchmark.net/compare/4227vs5672vs3683/Intel-Celeron-N4500-vs-MediaTek-Kompanio-520-528-%28MT8186-MT8186T%29-vs-Intel-Celeron-N4020) |
| Celeron N4500 (2021) | 2C/2T, 1.1–2.8 GHz, 6 W, PassMark 1,759 | UHD Jasper Lake, 16 EU, 350–750 MHz; Time Spy graphics 470 | Notebookcheck: "painfully slow in all but the most basic activities" | [Notebookcheck](https://www.notebookcheck.net/Intel-Celeron-N4500-Processor-Benchmarks-and-Specs.514524.0.html), [LaptopMedia](https://laptopmedia.com/video-card/intel-uhd-graphics-jasper-lake-16-eu/) |
| Kompanio 520 (MT8186, 2023) | 8C (2 big), 4 W, PassMark 3,693, ST 1,385 | Mali-G52 class (vendor spec, not fetched) | ARM; longer battery, often convertible with touch | PassMark compare above |
| Intel N100 (2023) | 4C/4T E-cores, up to 3.4 GHz, 6 W | UHD 24 EU, 450–750 MHz | **Single-channel memory only**, which starves the iGPU; "suited for fanless cooling" | [Notebookcheck](https://www.notebookcheck.net/Intel-Processor-N100-CPU-Benchmarks-and-Specs.678956.0.html) |

Reading the table: single-thread speed is similar across the fleet (about
1,100–1,400), and JavaScript is mostly single-threaded, so our main-thread cost
(sim tick, three.js scene traversal, UI) sets a floor that is about the same on
every school device. The GPUs differ more, but all are integrated, share slow
memory, and run fill-rate-bound: full-screen post passes (bloom, chromatic
aberration, grain, afterimage) are the expensive thing, not triangles.

### Frame budget and thermals

- Panels are 60 Hz, so 16.7 ms per frame at 60 fps or 33.3 ms at 30 fps. The
  sim already runs fixed 60 Hz ticks independent of rendering
  (`src/contracts/time.ts`), so a 30 fps render costs two sim ticks per frame
  without changing game feel or determinism. Verify `src/app/clock.ts` caps
  ticks per frame so a slow frame cannot spiral.
- All parts are 4–6 W fanless. Expect boost clocks for the first minutes and
  lower sustained clocks once the chassis warms, worse on a charger in a warm
  classroom. I found no reliable published sustained-load numbers; this must be
  measured (10-minute soak in the real-device checklist).
- Budget for other load: a content-filter extension, a classroom-management
  extension, and a Google Docs tab are normal background on a managed device.

### What school-popular browser games do

- [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)
  state the industry bar directly: games "must run smoothly on a 4GB RAM
  Chromebook", initial download at most 50 MB (20 MB for the mobile homepage),
  relative paths only, and time to gameplay at most 20 seconds.
- [Poki requirements](https://developers.poki.com/guide/requirements-quality):
  "Poki blocks all external requests by default. Bundle fonts, assets, and
  libraries"; "players tend to move to another game if loading takes more than
  10 seconds"; "Incognito mode restricts localStorage, so wrap localStorage
  operations in a try/catch".
- Coolmath Games, Blooket and Prodigy are 2D (DOM, Canvas2D, or Pixi-style
  WebGL sprites); I found no published render budgets for them. The relevant
  lesson is that kids' expectations of "a game that works on my school
  computer" are set by 2D sprite games at 60 fps that load in seconds. A 3D
  game that stutters reads as broken, not as ambitious.

### Proposed School tier

Starting values, to be tuned on a real N4500. Lives in `src/render/quality.ts`
next to the existing tiers so a student can diff it against Low.

| Knob | Low (today) | School (proposed) | Why |
| --- | --- | --- | --- |
| maxPixelRatio | 1 | 1 | Already right |
| render scale | player slider | 0.75 default, dynamic 0.5–0.85 | Fill rate is the bottleneck |
| post-processing | bloom off | **bypass EffectComposer entirely**; render straight to canvas | Each full-screen pass is a render target plus a read; a composer with zero effects still copies |
| fake glow | none | additive sprite halos on bullets and engines | Keeps the neon read without bloom |
| starCount | 600 | 250 | |
| maxParticles | 512 | 192 | |
| antialias | false | false | |
| shadows | false | false | |
| frame cap | none | 30 fps (rAF skip), player can lift it | Stable 30 beats jittery 40–60 |
| textures | as authored | cap 1024 px, no anisotropy | Memory and bandwidth on 4 GB shared |
| draw calls | unknown | target under 150; instance bullets and stars | Main-thread cost is the shared floor |

Bullets stay legible above everything else: the tier never removes gameplay
information, only atmosphere.

### Auto-detection and fallback

Run once on first launch, and again when the renderer string changes:

1. **Context creation.** Request WebGL2 with `failIfMajorPerformanceCaveat:
   true`. If that fails, retry without it: success means software rendering
   (SwiftShader), so force School at render scale 0.5 and show a short note. If
   both fail, show the No-3D screen (section 2). The flag is documented on
   [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info)
   as the way to refuse "dramatically slow" contexts.
2. **Renderer string** via `WEBGL_debug_renderer_info` (Baseline since 2017;
   may be disabled under fingerprinting resistance, so treat absence as
   "unknown", never as "fast"). Regexes: `/SwiftShader|llvmpipe|Software/` means
   software; `/Mali-G5|PowerVR|UHD Graphics (600|605)|JSL|Jasper|Gemini|Adreno 6[0-1]/`
   means School candidate.
3. **Hints.** `navigator.deviceMemory <= 4` (values are coarse powers of two,
   [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory)),
   `hardwareConcurrency <= 4`, and `CrOS` in the user agent. Hints only nudge;
   an N100 reports the same 4 GB as an N4020.
4. **Frame-time probe.** The logo sequence is a required beat and a natural
   benchmark scene: render it at the candidate tier for about 2 seconds after
   the press-to-start gate and take the p90 frame time. If p90 exceeds 20 ms at
   Low, choose School.
5. **Dynamic resolution** during play (School and Low only): over a 3-second
   window, p90 above 36 ms steps render scale down 0.1 (floor 0.5); p90 below
   24 ms for 10 seconds steps up (ceiling 0.85). Hysteresis prevents
   oscillation; this also absorbs thermal throttling.
6. **Respect the player.** Announce the choice once ("Graphics set to School
   for this device. Change any time in Settings."). A manual preset change
   disables auto-tiering; the Settings screen offers "Detect again".

Avoid `detect-gpu` and similar libraries unless their benchmark data is
self-hosted: by default such libraries fetch tables from a public CDN, which
breaks the no-third-party-requests rule and fails on filtered networks.

## 2. Managed-device constraints

Policies confirmed in Chromium's own policy definitions
(`components/policy/resources/templates/policy_definitions/Miscellaneous/`):

| Policy | Effect | Our designed response |
| --- | --- | --- |
| `Disable3DAPIs` true, or `HardwareAccelerationModeEnabled` false | "prevents webpages from accessing the WebGL API" | No-3D screen: plain-language explanation for the student ("This computer has 3D turned off"), a teacher line naming the two policies, and the credits and teacher notes still reachable. No 2D fallback game: out of slice, say so honestly. |
| `AudioOutputAllowed` false (ChromeOS) | "allows no audio output while users are signed in", including accessibility audio | Game fully playable silent: subtitles on by default (already), captions for significant sounds, visual cue for every audio-only cue (radio chatter already has on-screen text). |
| `FullscreenAllowed` false | users "can't enter Fullscreen mode" | Catch the `requestFullscreen` rejection, disable the toggle with "Fullscreen is turned off on this computer", and make the layout good in a windowed tab at about 1366x650. |
| `AllowDinosaurEasterEgg` (unset means off on enrolled ChromeOS) | Even the offline dino game is off by default on school devices | Cultural signal: admins expect to curate games. Make ours easy to approve (teacher notes, privacy page). |

I found no gamepad policy in the Chromium definitions; gamepads are rare in
classrooms and need no special handling beyond what Settings already does.

**Content filters.** School filters (GoGuardian, Securly, Lightspeed, Fortinet)
commonly block a "Games" category
([example](https://support.n4l.co.nz/s/question/0D50o000084tz4rCAA/how-can-we-block-access-to-browser-based-games)),
and new domains may be uncategorized or blocked until reviewed. Responses:
one origin for everything; relative paths (as CrazyGames requires); no
WebSockets, no third-party fonts, scripts or CDNs; a teacher notes page giving
the exact domain to allowlist. Hosting choice (an `adamsmith.systems`
subdomain versus a `*.pages.dev` address) changes how filters categorize us:
Adam's call, outward-facing.

**Network.** Thirty devices loading at the bell share one uplink: 30 x 15 MB is
450 MB in the first minute. Today's build: about 1.1 MB JS (uncompressed), 1.4
MB models, 0.4 MB SFX, a 1.4 MB `cues.json` holding all three languages, and
about 6 MB of Opus VO per language (20 MB total in `public/vo/`). Proposals:

- Budgets: at most 5 MB to the title screen, at most 15 MB to first gameplay,
  for one language. Fetch only the chosen voice language; split `cues.json`
  per language; stream later scenes' VO and music during earlier scenes.
- Service worker: cache-first for content-hashed assets, precache the current
  language after first gameplay, versioned cache names. The second class
  session then loads from disk and survives flaky Wi-Fi. Ephemeral sessions
  wipe Cache Storage too, so the first-load budget still matters.
- A loading screen with real progress and a "still loading on a busy network"
  message after 10 seconds.

**Shared devices and storage.** Carts rotate devices between students, and
some districts use ephemeral or managed-guest sessions that wipe local data at
sign-out (I did not fetch the ephemeral-mode policy page; treat as likely).
`src/settings/store.ts` and `src/settings/saveGame.ts` already fall back when
`localStorage` is missing, but `setItem` can also throw (quota, blocked
storage), so wrap writes. Add a **resume code**: a short word code (for
example "NEON-ORBIT-42") encoding chapter beat, difficulty and route flags,
shown at each checkpoint, typed in on any device. No server, no identifier,
nothing collected; it doubles as a teacher tool ("everyone enter BOSS-READY").

**Headphone-less classrooms.** Thirty laptop speakers at default volume is a
teacher's nightmare. On the first-run gate add a one-tap "Classroom: start
quiet" choice (master 30%, music 50%), keep subtitles on by default, and make
every audio cue visible.

## 3. Input on Chromebooks

- **Hybrids.** One device may offer keyboard, trackpad, touchscreen and stylus
  at once. Use Pointer Events throughout and swap on-screen prompts by
  **last-used input**, never by device detection. The touch scheme itself
  comes from the mobile-touch study.
- **Tablet mode.** Convertibles (Kompanio 520 models especially) fold, disable
  the keyboard, and rotate to portrait, which suits a vertical shmup. Handle
  `resize` and orientation changes mid-play without losing the pause state.
  In clamshell landscape at 1366x768, the portrait playfield is pillarboxed:
  use the side bands for HUD (PAY, SCOUTS SPARED, scan intel) rather than
  shrinking the playfield.
- **Trackpad back-swipe.** A two-finger horizontal swipe navigates history in
  Chrome, losing the run. The [Chrome team's guidance](https://developer.chrome.com/blog/overscroll-behavior):
  "using overscroll-behavior: contain on the html element prevents overscroll
  navigation actions". Apply `overscroll-behavior: none` on `html` and `body`,
  plus a history guard: push a state on entering gameplay and treat `popstate`
  as "open Pause". Also block `ctrlKey` wheel events (trackpad pinch-zoom) with
  a non-passive listener while in gameplay.
- **Unblockable gestures.** ChromeOS overview and desk-switch gestures and the
  launcher key cannot be prevented; auto-pause on `blur` and
  `visibilitychange`, and autosave at beats so a teacher closing tabs remotely
  costs little.
- **Trackpad as a fire button is hard for small hands.** Holding a click while
  moving is a two-handed skill on a trackpad. Defaults on clamshell: keyboard
  movement and Space to fire; offer auto-fire and hold-to-toggle (both already
  in `accessibility`) on the first-run assist screen.
- **Keyboards.** Chromebook top rows are media keys (no F1–F12), there is no
  Caps Lock or Delete, and the Search key is Meta. Never bind F-keys; avoid
  requiring more than three simultaneous keys (cheap keyboards ghost).
- **Stylus.** Treat `pointerType === "pen"` like touch, and ignore touch
  pointers while a pen is down (palm rejection).

## 4. Young players

### Reading and text

Ages 6–7 are emergent readers; most 8–9-year-olds read simple sentences but
slowly; 10–11 read comfortably. Our script is witty corporate satire at
roughly middle-school reading level, which is fine to hear and hard to read.

- UI labels: short, concrete, with icons ("Play", "Settings", "Back"), at
  roughly second- to third-grade vocabulary. The satirical copy can live in
  secondary lines.
- Body text at least 20 CSS px at 1366x768 in School/Classroom; subtitles
  default to 125% of the current default (XAG 104 asks for up to 200%).
- **Read-aloud menus**: pre-render menu labels and stub messages through our
  own VO pipeline (consistent voice, offline, no speech service), played on
  focus when "Read menus aloud" is on. Default on in Classroom mode.
- **"Let me read"**: cinematics and tutorial cards wait for a tap or key before
  advancing (XAG 116 time limits). Default on in Classroom mode.

### Difficulty, assists, sessions

- First-run question "Have you played games like this before?" mapping to
  presets: Story difficulty plus auto-fire plus game speed 0.85, or Normal.
- After three failures at the same checkpoint, offer (never force) "Skip to the
  next part": honest, and keeps a 7-year-old in the story.
- Class periods are 30–50 minutes; learning-center rotations are 15–20. Save at
  every beat (tutorial done, each sector, flashback, boss phase), show the
  resume code, and keep the full slice playable in under 25 minutes on Story.
- The overlong tutorial is a joke for adults and a real hazard for kids: make
  it skippable after the first section in Classroom mode. The wink survives.

### COPPA, FERPA, and "collect nothing"

Not legal advice; this is what the primary sources say.

- **COPPA** (FTC Rule amended April 22, 2025; effective June 23, 2025; full
  compliance by April 22, 2026). The
  [FTC FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
  defines collection to include passive tracking through a persistent
  identifier, and personal information to include "a customer number held in
  a cookie, an IP address ... or a unique device identifier". Identifiers
  collected solely for "support for the internal operations" (serving the site,
  security, debugging) do not by themselves trigger parental consent.
- What "collect nothing" therefore requires of us:
  - No analytics, no error reporting service, no ads, no third-party scripts,
    fonts, iframes, embeds or CDNs (each sends the child's IP to a third party).
    Today the client makes no third-party requests: fonts are `system-ui`,
    and the one Google Fonts URL in `src/data/thirdParty.ts` is a license link,
    not a fetch. Keep it that way with a QA hard fail.
  - `localStorage` is fine: it never leaves the device, so it is not collection.
  - Host access logs (Cloudflare) are internal operations. Do **not** enable
    Cloudflare Web Analytics or similar host features, which inject a beacon.
  - No accounts, no free-text input that is transmitted, no external links
    without a "you are leaving" gate (credits links included).
- **FERPA** governs schools and their education records. We never receive
  education records, no accounts, no rosters, so FERPA obligations do not
  attach to us; a teacher using the game shares nothing.
- **District vetting.** Many districts require a privacy statement or a data
  privacy agreement before approving a tool (state laws like California's
  SOPIPA target K-12 operators who collect student data). A one-page plain
  statement ("This game collects nothing. It makes no requests to anyone but
  its own server. Progress is saved only on this computer.") makes approval
  fast. The existing Credits telemetry stub (checklist row "Privacy and
  telemetry consent") should say the same in-game.

### Content suitability

What is in the slice (from `vo/script.yaml`, `src/i18n/`):

- Ship-versus-ship sci-fi combat, no blood, no visible humans harmed; the
  protagonist is a faceless helmet.
- An over-acted, funny antagonist ("I have fought toasters with more courage
  than you!") who is revealed as misunderstood.
- Implied offscreen fate of the predecessor #0121 ("recall initiated ... Don't
  you take him!") and "Your replacement is already in onboarding."
- A corporate Lane Authority, tollgates, subscription satire.
- "Kill" mostly as a pay and route term (`tut_disarm_001`: "paid at forty
  percent of a kill"; `tut_rate_001`: "Kills, broken parts, disarms ...";
  `kill` route ids are code-only), "destroy the hologram" in the tutorial.
- A morally gray kill-route ending and a fully built pacifist route.

Rating fit, against the
[ESRB guide](https://www.esrb.org/ratings-guide/) ("E10+: ... more cartoon,
fantasy or mild violence"; Fantasy Violence: "situations easily
distinguishable from real life") and
[PEGI](https://en.wikipedia.org/wiki/Pan_European_Game_Information) (PEGI 7:
"violence depicted in implied, non-detailed or non-realistic way";
PEGI 3: "very mild and depicted in a comical context or a childlike setting"):

**Judgment: ESRB E10+ (Fantasy Violence), PEGI 7.** Not E/PEGI 3, because
shooting is continuous and central, the boss is destroyed on one route, a
character's fate is implied, and the themes (labor, enclosure, complicity) are
heavy. Not T/PEGI 12: nothing graphic, no strong language. A formal rating
would come from IARC if the game ever ships on a storefront; this is an
estimate.

### Classroom mode (recommended)

A single toggle, separate from the graphics tier (a Chromebook is not a child;
an adult on a Chromebook gets the normal game). Enabled by a first-run choice,
Settings, or a teacher link (`?classroom=1`).

| Area | Change | Tradeoff |
| --- | --- | --- |
| Lexicon | "kill" becomes **"takedown"** in UI and the few VO lines that say it; "destroy" becomes "pop" for the hologram | "Disable" collides with "disarm" for young readers, the two outcomes the pacifist mechanic must keep distinct. Each changed line needs EN, ES, ZH variants and a TTS re-render (the script-as-data pipeline makes this cheap: a `classroom` text variant per line, perhaps 4–8 lines). |
| Defeat VFX | destroyed scouts power down and an escape pod visibly jets away | Clarifies "no one died" for kids. It also weakens the case for pacifism unless we lean on the real stake: the ending is about enclosure (tollgates), not body counts, so the Enclosure spine survives. Worth a narrative read by N. |
| Sensory | shake 0, reduced flashing on, damage vignette blue rather than red, shorter hitstop, Warden PA peaks 3 dB lower | Less "AAAA" punch; all already exist as settings except the vignette color and PA trim, so this is mostly defaults. |
| Reading | read-aloud menus, "Let me read", larger subtitles, skippable tutorial | Some extra VO renders for menu labels. |
| Story | unchanged, including the gray ending and #0121 | Kids handle moral ambiguity well when it is honest; the ending is a strong discussion prompt. |

Risks: two text variants per changed line doubles translation QA for those
lines; older kids may find it patronizing (so it is a choice, not forced);
students reading the source see a real pattern (content variants as data), which
is a teaching win.

**Teacher notes** (`docs/TEACHERS.md` plus an in-game "For teachers" screen in
Extras): age guidance (E10+ estimate, Classroom mode for younger), time needed,
controls, the privacy statement, the domain to allowlist, the policies that
break it (3D, audio, fullscreen), resume codes, and three discussion prompts
(Who benefits when the lanes open? Was the Warden wrong? What does it mean to
be paid to do something?).

## 5. QA plan

### Automated (Playwright, owned by Q)

`qa/capture.ts` currently launches with `--use-angle=metal` and
`--ignore-gpu-blocklist`, which is the opposite of a school device. Add a
`school` profile:

- CPU: CDP `Emulation.setCPUThrottlingRate` at 6 (rough N4500 single-thread
  ratio against an M3 Max; calibrate once against a real device).
- GPU worst case: launch with `--use-angle=swiftshader` (software GL), which
  must land on School at scale 0.5 and still be playable.
- No 3D: `--disable-3d-apis` (or `--disable-gpu`): assert the No-3D screen.
- Network: CDP `Network.emulateNetworkConditions` at about 1.5 Mbps down,
  300 ms latency (a 50 Mbps uplink shared by 30 devices); assert bytes to
  title and to gameplay against the 5 MB and 15 MB budgets; then a second load
  with `offline: true` after the service worker installs.
- Viewport 1366x657, deviceScaleFactor 1 (windowed tab); also 768x1366 for
  tablet mode, with a resize mid-run.
- Storage: an init script that makes `localStorage` throw; assert the game
  still boots and shows resume codes.
- Privacy hard fail: any request to a non-same-origin host.
- Input: `page.mouse.wheel(-400, 0)` and `page.goBack()` during gameplay; assert
  the URL is unchanged and Pause is open.
- Classroom lexicon: with Classroom on, scan visible DOM text and active
  subtitle cues in all three languages for the banned word list (kill, killed,
  kills, destroy and the ES and ZH equivalents).
- Photosensitivity: on captured reels, flag frames where more than 25% of the
  screen changes luminance by more than 10% more than three times per second
  (the WCAG 2.3.1 general flash threshold).
- Report tier chosen, p50/p90 frame times from `qaProbe`, and bytes, as a
  short single-topic reel ("school-boot", "school-boss").

Limits: CPU throttling does not throttle the GPU, and SwiftShader on an M3 Max
is not an Intel iGPU. Automation catches regressions; it cannot certify smooth.

### Real-device checklist

Devices: one N4020 or N4500 11.6 inch 4 GB clamshell, one Kompanio 520
convertible with touch and stylus, one N100. Used units are cheap; ask Adam
whether to buy or borrow from a district contact.

1. Record `chrome://gpu` renderer string; confirm auto-detection picks School.
2. Cold load on a shared school or throttled network; time to title and to
   gameplay.
3. 10-minute soak in the boss fight, on charger and on battery, with a Docs tab
   and an extension-heavy profile; record frame times at minute 1 and 10.
4. Clamshell: keyboard-only full run; trackpad-only menus; two-finger swipe
   during gameplay and menus.
5. Tablet mode: fold, rotate, play the touch scheme; stylus in menus and play.
6. Managed profile (a Google Workspace for Education test OU if available):
   toggle `Disable3DAPIs`, `AudioOutputAllowed`, `FullscreenAllowed`; sign out
   and back in to check storage loss and resume codes.
7. Classroom mode end-to-end, both routes.
8. Kid usability: one or two children ages 7–10 with parent consent, observed
   only, notes not recordings. Where do they get stuck reading? Can they find
   Back?

## Implementation plan by owner

Ownership per `docs/WAVE3.md`. Cross-agent items go in
`docs/INTEGRATION-QUEUE.md` (this study writes only here; entries below are
proposed text for that queue).

| Owner | Work |
| --- | --- |
| Adam | Decide: hosting domain (filter categorization); Classroom mode yes/no and the "takedown" word; buy or borrow three devices; whether to test with children. |
| U (UI, `settings.ts`) | Add `school` to `DisplayPreset`; add a `classroom` settings group (enabled, readAloud, letMeRead); first-run gate options (Classroom quiet start, "played games before?"); No-3D, fullscreen-blocked and software-GL messages; resume-code entry and display; Extras > For teachers; pillarbox HUD layout at 1366x768; wrap storage writes. |
| V (render) | School tier in `quality.ts`, composer bypass, sprite halos, 30 fps cap, dynamic resolution, context creation with performance-caveat fallback, escape-pod defeat VFX, blue damage vignette. |
| A (audio, wiring) | Detection orchestration during logos in `main.ts`; per-language VO and cue loading; split `cues.json`; service worker and precache; quiet start defaults; Warden PA trim in Classroom; read-aloud playback of menu VO. |
| G (gameplay) | Verify tick cap per frame; "skip to next part" after three failures as a sim-level checkpoint; resume-code encode and decode of save state (pure function, tested). |
| N (narrative) | `classroom` text variants for lines using kill or destroy (EN, ES, ZH); review escape-pod VFX against the pacifist argument; `docs/TEACHERS.md` with discussion prompts; menu read-aloud script lines. |
| T (VO tech) | Render classroom variants and menu read-aloud lines in existing voices. |
| Q (QA) | School Playwright profile and assertions above; third-party-request hard fail in every run; lexicon scan; flash detector; real-device checklist template in `qa/`. |

Suggested order: Q's third-party and byte-budget checks first (cheap, protects
the privacy claim now), then V's School tier and A's detection, then U's
managed-state screens, then Classroom mode once Adam decides.

## Status

Desk research only: no code changed, no devices tested. Hardware figures are
fetched benchmarks; thermal behavior, Kompanio GPU details and ephemeral-mode
storage behavior are unverified. Next step: Adam's four decisions, then Q's
cheap checks.

## Check yourself

Why can't auto-detection rely on `navigator.deviceMemory` alone?
(a) Chrome does not expose it on ChromeOS. (b) It is coarse and capped, so an
N100 and an N4020 both report 4. (c) It reports GPU memory, not RAM.
(Answer: b.)
