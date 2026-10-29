# Vertical slice checklist: front end and systems for Neon Warden AAAA

Research note, October 28, 2026. Written for the Neon Warden AAAA build team
(agents and Adam), and meant to read later as a reference for students building
their own slices.

## Framing question

What does "vertical slice" mean in industry practice, and what front-end and
systems features does a small 3D web shmup need for its slice to be credible?
Which of those can be stubbed honestly, with an audience-facing "not included in
this vertical slice" message, without weakening that claim?

Disciplines in play: game production (milestones, scope), UX and accessibility
practice, web platform constraints (autoplay, fullscreen, gamepad), and a little
law and ethics (consent, accessibility regulation, honesty toward an audience
that a demo is, in part, trying to persuade).

## Status: what was actually read

The session's web search tool returned HTTP 404 throughout, DuckDuckGo started
serving a captcha after two queries, Brave returned 429, and
[GDC Vault](https://www.gdcvault.com/) was down for maintenance. Sources were
reached by direct fetch and the Wikipedia search API. In practice:

**Read in full or in the relevant section (fetched October 28, 2026):**

- Ask a Game Dev, [Game Dev Glossary: Prototype, Vertical Slice, First Playable, MVP, Demo](https://www.tumblr.com/askagamedev/746300998961741824/game-dev-glossary-prototype-vertical-slice)
- Xsolla, [Funding 101: The Impact Of The Vertical Slice](https://www.xsolla.com/blog/funding-101-the-impact-of-the-vertical-slice) (2021, updated 2024)
- KITATUS, [Game Development Production Pipeline](https://kitatusandfriends.co.uk/general/productionpipeline/) (2022)
- salivity.github.io, [Publisher Milestones in Game Development](https://salivity.github.io/game-development/article/publisher-milestones-in-game-development) (unattributed; reads as generated content, treat as low confidence)
- Wikipedia, [Vertical slice](https://en.wikipedia.org/wiki/Vertical_slice), plus the vertical-slice passages of [Dead Space (2008)](https://en.wikipedia.org/wiki/Dead_Space_(2008_video_game)), [Sandfall Interactive](https://en.wikipedia.org/wiki/Sandfall_Interactive), [Serious Sam: The First Encounter](https://en.wikipedia.org/wiki/Serious_Sam:_The_First_Encounter), [XCOM: Enemy Unknown](https://en.wikipedia.org/wiki/XCOM:_Enemy_Unknown), [Outer Wilds](https://en.wikipedia.org/wiki/Outer_Wilds), [Bonnie Ross](https://en.wikipedia.org/wiki/Bonnie_Ross) (Halo 4), [Sonic Boom: Rise of Lyric](https://en.wikipedia.org/wiki/Sonic_Boom:_Rise_of_Lyric), and [Plants vs. Zombies](https://en.wikipedia.org/wiki/Plants_vs._Zombies) (cancelled "Project Hot Tub")
- Jason Schreier, [How BioWare's Anthem Went Wrong](https://kotaku.com/how-biowares-anthem-went-wrong-1833731964), Kotaku, 2019 (E3 demo passages)
- [Game Accessibility Guidelines: full list](https://gameaccessibilityguidelines.com/full-list/), [Why and how](https://gameaccessibilityguidelines.com/why-and-how/), and the subtitle pages [clear and easy to read](https://gameaccessibilityguidelines.com/if-any-subtitles-captions-are-used-present-them-in-a-clear-easy-to-read-way/), [customisable](https://gameaccessibilityguidelines.com/allow-subtitle-caption-presentation-to-be-customised/), [on before any sound](https://gameaccessibilityguidelines.com/ensure-subtitles-captions-are-or-can-be-turned-on-before-any-sound-is-played/)
- Xbox Accessibility Guidelines (XAG v3.2): [overview](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines), [101 text display](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101), [103 additional channels for cues](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103), [104 subtitles and captions](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/104), [105 audio](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105), [107 input](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107), [108 difficulty](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/108), [112 UI navigation](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112), [114 UI context](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/114), [115 error prevention](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/115), [116 time limits](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/116), [117 visual distractions and motion](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117), [118 photosensitivity](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118), [120 communication](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/120)
- CVAA: [Wikipedia](https://en.wikipedia.org/wiki/Twenty-First_Century_Communications_and_Video_Accessibility_Act_of_2010) and AbleGamers, [What is the CVAA](https://ablegamers.org/cvaa/) (the [FCC guide](https://www.fcc.gov/consumers/guides/21st-century-communications-and-video-accessibility-act-cvaa) and the [GamesIndustry.biz waiver story](https://www.gamesindustry.biz/new-games-must-comply-to-accessibility-guidelines-after-fcc-waivers-expire) both returned 403)
- MDN, [Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [GDPR Article 7, conditions for consent](https://gdpr-info.eu/art-7-gdpr/)

**Cited but not read this session (verify before quoting):** Heather Maxwell
Chandler, *The Game Production Toolbox* (CRC Press, 2019), p. 68, cited by the
Wikipedia article as the source for its definition; any GDC Vault talk (Vault
offline); Celeste's Assist Mode and the Halo 2 E3 2003 demo, mentioned below
only from general knowledge.

Nothing has been implemented. This is a planning document.

## Findings 1: what "vertical slice" means

### The metaphor

The term comes from layered software architecture: a slice cuts *down* through
every layer (data, logic, UI) for a narrow feature, as opposed to a horizontal
pass that finishes one layer everywhere ([Wikipedia](https://en.wikipedia.org/wiki/Vertical_slice),
citing Chandler). In games the layers are disciplines: design, code, art,
animation, audio, UI, QA. Xsolla's version is a piece of cake: a good slice has
every layer, not "a lopsided piece with missing layers or too much frosting"
([Xsolla](https://www.xsolla.com/blog/funding-101-the-impact-of-the-vertical-slice)).

### Neighboring milestones, and where sources disagree

| Term | Working definition | Quality bar | Sources |
| --- | --- | --- | --- |
| Prototype | Tests one system or question ("is this fun?"), often greybox, often thrown away | Whatever answers the question | [Ask a Game Dev](https://www.tumblr.com/askagamedev/746300998961741824/game-dev-glossary-prototype-vertical-slice), [KITATUS](https://kitatusandfriends.co.uk/general/productionpipeline/) |
| First playable | The game is technically playable and resembles its intent, maybe not end to end; in some studios marks the end of preproduction | Placeholder content expected | [Ask a Game Dev](https://www.tumblr.com/askagamedev/746300998961741824/game-dev-glossary-prototype-vertical-slice) ("basically the same as a vertical slice" for some people), [KITATUS](https://kitatusandfriends.co.uk/general/productionpipeline/) |
| Vertical slice | A short, representative chunk with all planned systems working together, used to decide whether to fund or continue | **Disputed**: "final quality" (Xsolla, salivity) versus "won't be polished at this point" but has the "vibe" (KITATUS) | [Xsolla](https://www.xsolla.com/blog/funding-101-the-impact-of-the-vertical-slice), [KITATUS](https://kitatusandfriends.co.uk/general/productionpipeline/), [salivity](https://salivity.github.io/game-development/article/publisher-milestones-in-game-development) (claims "10–15 minute" segment) |
| Demo | A stripped build for exhibition (executives, trade shows, public); pre-release demos can be partly staged | Looks final; may not be built properly underneath | [Ask a Game Dev](https://www.tumblr.com/askagamedev/746300998961741824/game-dev-glossary-prototype-vertical-slice), [Kotaku on Anthem](https://kotaku.com/how-biowares-anthem-went-wrong-1833731964) |
| Alpha | Playable start to finish, features in, content missing (historically "feature complete") | Placeholders allowed | [KITATUS](https://kitatusandfriends.co.uk/general/productionpipeline/), [salivity](https://salivity.github.io/game-development/article/publisher-milestones-in-game-development) |
| Beta | Nearly content complete, external QA, polish begins | No placeholders | same |

The quality dispute resolves if you treat the slice as a *claim about the
finished game*: whatever bar the slice sets, the audience will assume the rest
of the game meets. A low-polish slice claims less. Our slice claims a lot (high
polish, nearly complete front end), so it has to deliver it.

### Case studies (from Wikipedia unless noted)

- **Dead Space (2008).** EA approved the game after a vertical slice "equivalent
  to one level," after roughly 18 months of pre-greenlight work; the team then
  built eleven more levels in ten months, using what the slice taught them.
  This is the canonical function: the slice is where the *pipeline* gets
  proven, so the rest is repetition.
  ([source](https://en.wikipedia.org/wiki/Dead_Space_(2008_video_game)))
- **Clair Obscur: Expedition 33 (Sandfall Interactive).** A team of around a
  dozen built a slice, pitched it at GDC in March 2022, and secured production
  funding from Kepler Interactive; the slice "marked the completion of the
  pre-production phase." ([source](https://en.wikipedia.org/wiki/Sandfall_Interactive))
- **Serious Sam: The First Encounter.** Rejected by publishers, Croteam took one
  level, Karnak, polished it "to make it feel complete," and released it as a
  public demo in 2000; the demo's popularity led to a publishing deal, and the
  "vertical slice model" shaped Croteam's later consumer testing.
  ([source](https://en.wikipedia.org/wiki/Serious_Sam:_The_First_Encounter))
- **Outer Wilds.** Mobius built a slice of one planet, Giant's Deep, for its
  publisher Annapurna before staffing up art for the rest; useful for students
  because the game began as a student thesis project.
  ([source](https://en.wikipedia.org/wiki/Outer_Wilds))
- **XCOM: Enemy Unknown.** A 2009 internal slice met "a mediocre response" and
  had no cover system; the slice did its job by falsifying a direction.
  ([source](https://en.wikipedia.org/wiki/XCOM:_Enemy_Unknown))
- **Halo 4.** 343 built a slice "very similar to a Bungie-style Halo game" and
  used it to choose a *different* direction.
  ([source](https://en.wikipedia.org/wiki/Bonnie_Ross))
- **Sonic Synergy / Sonic Boom** and **PopCap's "Project Hot Tub."** Slices shown
  to executives that did not save their projects; a slice informs a decision,
  it does not guarantee one, and the decision is usually made by people with
  money, not the team.
  ([Sonic](https://en.wikipedia.org/wiki/Sonic_Boom:_Rise_of_Lyric), [PvZ](https://en.wikipedia.org/wiki/Plants_vs._Zombies))
- **Anthem (E3 2017).** A developer told Kotaku the demo "was not actually built
  properly – a lot of it was fake, like most E3 demos," and the team was still
  asking "do we have the tech for that?" afterward
  ([Kotaku](https://kotaku.com/how-biowares-anthem-went-wrong-1833731964)). This
  is the line between a slice and a staged demo, and the reason our stubs
  announce themselves.

### Power relations, briefly

The slice is a funding instrument: publishers release money against milestones
([salivity](https://salivity.github.io/game-development/article/publisher-milestones-in-game-development),
[Xsolla](https://www.xsolla.com/blog/funding-101-the-impact-of-the-vertical-slice)),
so the people building it have every incentive to overclaim. Faked demos shift
risk onto workers (who must later build what was promised, often under crunch)
and onto players (who buy on the promise). Honest stubbing is a small
counter-practice: it says what exists and what does not. For students, the
"publisher" is a grader or a playtest audience, and the same incentive exists.

### An inversion in our project

Xsolla lists settings and controller tutorials as *nice-to-haves* for a slice;
most slices skimp on the front end and spend everything on one gameplay
segment. Our [AGENTS.md framing](../../AGENTS.md) inverts that: the nearly
complete front end is part of the claim. That is legitimate (the front end is a
layer, and accessibility retrofits are expensive: GAG notes that costs rise the
later guidelines are considered, [Why and how](https://gameaccessibilityguidelines.com/why-and-how/)),
but it means the gameplay segment must stay small enough to also reach final
quality.

## Findings 2–3: the checklist

Labels:

- **Must**: missing it makes the slice less credible, unsafe, or excludes
  players for no good reason.
- **Nice**: real polish, worth doing if time allows.
- **Stub**: a good candidate for an honest "not included in this vertical slice"
  tile, with suggested copy. Stubs should be visible, focusable, and readable by
  every input method, and should say what *would* be there.

Abbreviations: GAG = [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/),
XAG = [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines).

### Boot flow

| Item | Label | Why, and sources | Notes for this build / stub copy |
| --- | --- | --- | --- |
| Click or press-any-key gate before any audio | Must | Browsers block Web Audio and audible media until the user interacts ([MDN Autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)); on the web the "press any key" screen is functional, not just tradition | Put it *before* the logos so the logo stings actually play. Offer a subtitles/language choice on this screen (next row). |
| Subtitles on, or choosable, before first sound | Must | [GAG: on before any sound is played](https://gameaccessibilityguidelines.com/ensure-subtitles-captions-are-or-can-be-turned-on-before-any-sound-is-played/); XAG 104 cites Gears 5, subtitles on by default at first launch | Default subtitles on; first-run screen shows language and subtitle toggle. |
| Studio and publisher logos (adamsmith.systems, CM121) | Must | Required beat in AGENTS.md; also how real slices signal who stands behind them | Skippable after first view, and skippable on first view with a held or repeated press. Respect reduced-motion. |
| Photosensitivity notice | Must (paired with real mitigation) | XAG 118: about 1 in 4,000 people are susceptible; "eliminating game content that can potentially cause photosensitive seizures is preferred over splash-screen warnings"; flashes over ~3 per second covering ~20% of screen fail; saturated red flashes fail at lower thresholds | A neon shmup is high-risk. Design under the thresholds by default, then show a short notice that points to the reduce-flashing option. A warning alone is not a mitigation. |
| Build label / watermark ("Vertical slice build, not final") | Must | Distinguishes slice from demo (Anthem case above); standard practice for preview builds | Small, persistent, honest. Version and date in pause and credits too. |
| Loading / asset preload progress | Must | Web builds download assets on first visit; a frozen black canvas reads as a crash | Real progress from the loader, not a fake bar. |
| First-run accessibility setup | Nice | XAG 104 cites Gears 5 showing the accessibility menu after the intro; GAG basic: "provide details of accessibility features in-game" | Three or four key choices (subtitles, flashing, shake, assist) with "change any time in Settings". |

### Main menu and game entry

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Title / main menu, navigable by keyboard, gamepad, and mouse alike | Must | GAG basic: all UI reachable with the gameplay input method; XAG 107: single, non-simultaneous presses, activation on release; XAG 112: consistent focus order | One focus model for all three inputs. Visible focus ring. |
| New Game with difficulty choice | Must | XAG 108: multiple difficulty options; GAG basic: "wide choice of difficulty levels"; GAG basic: start without deep menu nesting | Difficulty changeable later (GAG intermediate). |
| Continue | Nice | GAG intermediate: autosave | `localStorage` checkpoint at beats (tutorial done, flashback, boss). Grey it out with an explanation when there is no save, rather than hiding it. |
| Chapter select (slice beats only) | Nice | Lets playtesters and graders jump to the boss; GAG intermediate: "bypass gameplay elements that aren't part of the core mechanic" | Unlocked entries: Tutorial, Sector 1, The Warden, Ending. |
| Locked chapters beyond the slice | Stub | Shows the shape of the full game honestly | "Chapters 2–9 exist in a design document and nowhere else. This vertical slice is Chapter 1." |
| Online Multiplayer / Co-op | Stub | Also sidesteps CVAA obligations, which attach to chat (see caveats) | "Online Multiplayer: not included in this vertical slice. No servers were provisioned, so none can go down. The Warden will have to disappoint you one pilot at a time." |
| Leaderboards (online) | Stub | Requires a backend and moderation | "Global leaderboards: not included in this vertical slice. Your best score is saved on this device, where it is safe from everyone but you." (Local best score: Nice.) |
| Store / DLC / Season Pass | Stub | Monetization is out of scope and out of spirit | "Store: not included in this vertical slice. There is nothing to buy. We checked twice." |
| Account sign-in / cloud saves | Stub | No identity backend | "Sign-in: not included in this vertical slice. You are anonymous, which in 2027 is a premium feature." |
| News / patch notes feed | Stub | Live-ops surface | "News: not included in this vertical slice. The only update is this build." |
| Quit | Stub | A browser tab cannot quit itself | "Quit: this is a browser tab. You were always free to leave." Close the tab is not available to scripts; say so. |

### Settings: display and graphics

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Graphics presets (Low / Medium / High / Ultra) | Must | Web hardware range is huge (integrated GPUs, phones); one bad frame rate sinks a polish claim | Auto-detect a default, show it. |
| Render resolution scale | Must | Cheapest big performance lever in three.js (`setPixelRatio`) | Slider, e.g. 50–100%, shows effective resolution. |
| Individual toggles: bloom, shadows, antialiasing, particle density, post effects | Nice | Lets presets be inspected and tuned | Changing one sets preset to "Custom". |
| Fullscreen toggle | Must | Fullscreen API needs a user gesture; players expect it | Handle exit via Esc gracefully (pause, do not lose state). GAG intermediate supports windowed play too. |
| Frame rate cap / V-sync | Stub-ish note | `requestAnimationFrame` follows the display; true V-sync control is not available on the web | "V-Sync: handled by your browser, which did not ask our opinion." Offer a 30/60/uncapped cap only if implemented. |
| Brightness / gamma calibration | Nice | GAG intermediate: option to adjust contrast | Simple slider with a reference image. |
| Field of view / camera distance | Nice | GAG basic and intermediate: sensible default FOV, and allow adjusting in 3D; XAG 117 | Fixed-camera shmup: offer a camera tilt or distance option if the 3D camera moves. |
| UI scale | Nice | GAG intermediate: allow interfaces to be resized; XAG 101 text minimums | Pairs with subtitle size. |
| Performance overlay (FPS) | Nice | Useful for playtests and reviewers | Off by default. |

### Settings: audio

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Separate buses: Master, Music, SFX, Voice, UI | Must | GAG basic: separate volume controls for effects, speech, and music; XAG 105: separate controls per output type | Web Audio `GainNode` per bus. Voice audible over music by default. |
| Mute when tab hidden / auto-pause on blur | Must (web) | Players switch tabs; background audio is the most common web-game annoyance | `visibilitychange` pauses game and ducks audio. |
| Mono / stereo toggle | Nice | GAG intermediate | One `ChannelMergerNode`. |
| Captions for significant sounds (e.g. "[Warden laughs]", "[warning klaxon, left]") | Nice | XAG 104 captions with direction indicators; GAG intermediate: captions for significant background sounds | Separate toggle from dialogue subtitles (XAG 104 recommends independent toggles). |
| Gamepad haptics toggle / intensity | Nice | GAG basic: toggle or slider for haptics | `vibrationActuator` support varies by browser. |

### Settings: language, subtitles, and text

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Text language (EN / ES / ZH) | Must | The script-as-data file already carries three languages (AGENTS.md) | Font fallback for ZH must be tested; avoid tofu. |
| Voice language, separate from text language | Nice (high value, cheap here) | Common in shipped games; lets players hear one language and read another | Already supported by the VO pipeline design. Show only languages actually rendered. |
| Additional languages | Stub | Shows localization intent honestly | "More languages: not included in this vertical slice. Translators are people, and we have not hired any yet." |
| Subtitles on/off, on by default | Must | [GAG basic: subtitles for all important speech](https://gameaccessibilityguidelines.com/provide-subtitles-for-all-important-speech/); XAG 104 | Include over-acted boss lines and flashback VO. |
| Subtitle size, scalable to at least 200% of a readable default | Must | XAG 104: scalable to minimum 200%; GAG: no smaller than 46px at 1080p by default or via options | Scale with viewport height, not fixed pixels. |
| Subtitle background, opacity 0–100% | Must | XAG 104: player-adjustable background opacity 0–100% and configurable background color; GAG: letterboxing, ideally a sliding scale | Default semi-opaque. |
| Speaker names | Must | XAG 104: identify the speaker when speakers change; GAG intermediate: visual indication of who is speaking | Name on change of speaker; "(on comms)" style tags help (XAG 104's Gears 5 example). |
| Speaker colors | Nice | XAG 104: color may distinguish speakers but only alongside text | Never color alone. |
| Line length and count: ~40 characters, at most 2 lines | Must | XAG 104 and GAG both specify this | Author line breaks in the script data, not auto-wrap (XAG 104). |
| Mixed case, sans-serif option | Must | XAG 104; GAG clear and easy to read | Even if the HUD font is all-caps neon, subtitles are not. |
| Live subtitle preview in settings | Nice | XAG 104: preview, ideally in game context (Forza Horizon 4 example) | Render a sample Warden line behind the menu. |
| Text speed / advance text at own pace | Must for the tutorial | GAG basic: progress through text prompts at own pace; XAG 116: adequate time for UI | The "annoyingly tedious tutorial" can be tedious in content, not by trapping slow readers. |

### Settings: controls

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Keyboard remapping (including pause key) | Must | GAG basic: allow remapping; XAG 107: remap all controls, including Esc on PC | Remap actions, not keys (XAG 107). Conflict detection, reset to default. |
| Gamepad remapping | Nice | XAG 107 | The browser Gamepad API's "standard" mapping makes this tractable. |
| Prompts reflect current bindings | Must | XAG 107: remapped labels must be correct across hints, tips, tutorials | The tutorial text is generated from bindings. |
| Prompt glyph swapping (keyboard / Xbox / PlayStation / generic) | Nice | Players expect their own controller's glyphs; switches on last-used device | Gamepad `id` strings are inconsistent across browsers; fall back to generic glyphs and offer a manual override. |
| Mouse support in menus | Must | GAG intermediate: support more than one input device | Hover moves focus; click activates on release (XAG 107). |
| Stick sensitivity / dead zone | Nice | GAG basic: adjust sensitivity; XAG 107: at least ±50% | For ship movement on analog sticks. |
| Controls reference reachable during play | Must | GAG intermediate: reminder of controls during gameplay | In the pause menu. |

### Settings: accessibility

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Auto-fire toggle (hold vs toggle) | Must | XAG 107: "toggles and auto holds", avoid long holds; GAG intermediate: alternatives to holding buttons | Shmups traditionally require holding fire for minutes. This one matters most. |
| Hold vs toggle for other held actions (focus/slow mode, charge) | Must | Same | One "Hold / Toggle" control per held action. |
| Screen shake intensity, 0–100% | Must | XAG 117: avoid camera shake or allow turning it off (Halo Infinite sliders) | Also expose motion blur and speed lines if used. |
| Reduce flashing | Must | XAG 118 thresholds; GAG basic: avoid flickering images | Clamp explosion and hit flashes, desaturate red flashes. Default should already pass; this goes further. |
| Information never by color alone | Must | GAG basic; XAG 103 (color vision deficiency) | Shape-code enemy bullets and pickups, not just hue. |
| Colorblind presets (protanopia / deuteranopia / tritanopia palettes) | Nice | XAG 103 | Palette swaps for gameplay-critical colors beat full-screen filters. Only after shape-coding. |
| Game speed slider | Must (cheap, high impact) | GAG basic and intermediate: adjust game speed; XAG 107 suggests it explicitly | Scale the simulation clock, e.g. 50–100%. |
| Assists: invincibility, extra lives, larger player hitbox forgiveness, aim assist | Nice (at least one is Must, see game speed) | XAG 108; GAG intermediate: assist modes, difficulty changeable during play | Phrase neutrally. Celeste's Assist Mode (not re-read this session) is the usual exemplar of non-judgmental copy. |
| Reduce background motion | Nice | GAG intermediate: turn off background movement; XAG 117 (HyperDot example) | Freeze menu backgrounds and parallax. Also honor `prefers-reduced-motion` as the default. |
| High-contrast HUD option | Nice | GAG basic: high contrast between text/UI and background | Solid HUD backing plates. |
| Skip cutscene / skip tutorial | Must | GAG intermediate: bypass elements outside the core mechanic | The tedious tutorial is a joke only if it is skippable. |
| Screen reader / menu narration | Stub | XAG 106; GAG advanced. Real work on a canvas game (needs a parallel DOM or `speechSynthesis`) | "Menu narration: not included in this vertical slice. We know it matters (XAG 106) and have not built it yet; this tile exists so the gap is visible." |
| All settings saved and remembered | Must | GAG basic | `localStorage`, versioned schema, "Reset to defaults" with confirmation (XAG 115). |

### In-game systems

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Pause menu: resume, restart checkpoint, settings, controls, quit to title | Must | Universal expectation; GAG intermediate: reminders of controls and objectives | Opening settings from pause must not reset gameplay state. |
| Auto-pause on focus loss and gamepad disconnect | Must (web) | Tab switches and controller drops are common | "Controller disconnected" overlay. |
| Confirm before destructive actions (restart, quit to title, reset settings) | Must | XAG 115 | Default focus on the safe choice. |
| Save / checkpoint indicator | Nice | Standard convention; reassures players when saving happens | Small icon at checkpoints. No "do not turn off your console" language: this is a tab. |
| Loading screens with tips | Nice | GAG intermediate: contextual help and tips | Tips that teach real mechanics; a few self-aware ones are fine. |
| Objective reminder | Nice | GAG intermediate | Pause menu line, e.g. "Survive the Warden." |
| Achievements (local) | Nice | Players like them; real platform integration (e.g. [Steamworks stats and achievements](https://partner.steamgames.com/doc/features/achievements)) is out of scope | Local achievements with the pacifist-run hint fit the ending. |
| Platform achievement sync | Stub | No platform | "Achievements are tracked on this device only. No platform is watching, which is either freeing or lonely." |
| Photo mode | Stub | Polish feature, big surface area | "Photo Mode: not included in this vertical slice. Please admire the neon manually." |

### End matter, legal, and consent

| Item | Label | Why, and sources | Notes / stub copy |
| --- | --- | --- | --- |
| Credits (human and agent contributions, tools, TTS voices) | Must | Attribution is part of honesty, and a teaching point for agent-assisted work | Distinguish human direction from agent and model output plainly. Skippable, scroll speed adjustable (XAG 117). |
| Third-party licenses (three.js MIT, fonts, any audio) | Must | License terms require notices | A "Licenses" screen inside Credits. |
| EULA / Terms | Stub | A free web build does not need a click-through; fake legalese wastes player time | "End User License Agreement: not included in this vertical slice. You may play this. That is the whole agreement." |
| Privacy and telemetry consent | Must as disclosure; Stub as feature | If any analytics are ever added, consent must be clearly distinguishable, in plain language, and "as easy to withdraw as to give" ([GDPR Art. 7](https://gdpr-info.eu/art-7-gdpr/)) | Recommend collecting nothing, and saying so: "Telemetry: this build collects no data. There is nothing to opt into. This screen exists so you do not have to wonder." |
| Accessibility feature list | Nice | GAG basic: details of accessibility features in game and on the website | One page in Settings > Accessibility and in the eventual project README. |
| Feedback / bug report link | Nice | GAG basic: solicit accessibility feedback | A mailto or form link, opened in a new tab. |

### How to build stubs (pattern, not just copy)

1. Same visual weight as real tiles, a clear "Not in this slice" badge, reachable
   by every input, never a dead click: activating it opens a short panel with
   the copy and a Back button.
2. Say what the feature *would* be in one line, then why it is absent.
3. Humor about the studio and the build, never about players or the people who
   would need the feature. For accessibility stubs, drop the joke and name the
   guideline: those gaps cost real players.
4. Keep stubs in one data file (id, title, one-liner, reason) so the list of
   cut features is auditable in one place. This doubles as the slice's honest
   scope document.

## Findings 4: teachable takeaways for student slices

- **A slice is a claim.** Whatever polish you show, viewers will assume the
  rest of the game reaches. Pick a claim you can afford, then meet it
  everywhere in the slice, including menus. Dead Space proved one level, then
  built eleven more quickly because the pipeline was proven, not just the art.
- **Cut width, not depth.** Fewer levels, enemies, and modes; every remaining
  thing at final quality across all disciplines (code, art, audio, UI,
  accessibility). If you cannot finish a layer, the slice is too wide.
- **A slice can fail usefully.** XCOM's and Halo 4's slices changed direction.
  Build it early enough that you can still listen to it.
- **Stub honestly; never fake.** The Anthem E3 demo shows the cost of a slice
  that looks built but is not. A labeled stub costs ten minutes and shows you
  understand your scope; a faked feature borrows against future work.
- **Accessibility is cheapest early.** Separate audio buses, remappable
  actions, subtitle data with speaker names, auto-fire, game speed, and shake
  sliders are a few hours each if designed in, and painful to retrofit
  ([GAG, Why and how](https://gameaccessibilityguidelines.com/why-and-how/)).
  "Do something" beats "do nothing".
- **Know your platform's constraints.** On the web, the press-any-key screen
  exists because of autoplay rules, Quit cannot close a tab, and V-sync belongs
  to the browser. Polishing within real constraints reads as competence.
- **Keep a scope ledger.** The stub data file is a written list of what you
  decided not to build. Grading, playtest debriefs, and postmortems all get
  easier with it.

## Caveats

- **CVAA is narrower than its reputation.** Per [AbleGamers](https://ablegamers.org/cvaa/)
  and [Wikipedia](https://en.wikipedia.org/wiki/Twenty-First_Century_Communications_and_Video_Accessibility_Act_of_2010),
  the CVAA's game obligations (since waivers lapsed after December 31, 2018)
  cover *advanced communications services*: in-game voice and text chat, not
  subtitles or general accessibility. It does not require the subtitle items
  above; GAG and XAG are the right citations for those. It would become
  relevant only if the stubbed multiplayer gained chat (then see XAG 120).
  Not legal advice; the FCC primary source was not reachable this session.
- **XAGs are not compliance checklists.** Microsoft states they "aren't
  intended to act as a checklist to validate any type of compliance or legal
  requirements" ([overview](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines)).
  The Must labels here are this project's judgment, not a standard.
- **Industry definitions vary by studio**, as every production source above
  admits. The salivity article's "10–15 minute" figure is unattributed.
- **Photosensitivity thresholds in XAG 118 are approximate**; real assurance
  needs testing, e.g. the [Harding FPA](https://www.hardingfpa.com/) tool XAG
  118 links (not evaluated here).
- **No GDC talks or production books were read** this session; the Chandler
  citation is secondhand.

## Preferred next step

1. Turn the Must rows into a single `slice-checklist` data file in the game
   repo (id, area, label, status, source URL) so build agents can tick items
   and the in-game stub panel reads from the same source.
2. Build the boot flow first (press-to-start gate, subtitles-before-sound,
   skippable logos, flashing mitigation), since it touches the audio bus,
   subtitle renderer, settings persistence, and input focus model: the same
   foundations every later screen needs.
3. Once the front end exists, run an AX/UX pass: a fresh agent (and later a
   student) navigates every screen with keyboard only, gamepad only, and mouse
   only, and reports dead ends and confusing stubs.
4. When GDC Vault is back, look for production talks on vertical slices and
   on stubbing (and re-check the FCC CVAA guide) to replace secondhand
   citations.
