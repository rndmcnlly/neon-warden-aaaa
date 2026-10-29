# Trailer automation prep (October 29, 2026)

## Framing question

What would a 30 s teaser, a 90 s gameplay trailer and a 120 s QA/feature
compendium of _Neon Warden_ need to be, as data, so that compute can be
allocated later to render every cut in EN, ES and ZH from a frozen build
without hand editing? Scope of this pass: research, cut sheets, a judge
panel, the pipeline, a three-shot dry run and render estimates. No full cuts.

Disciplines in play: trailer editing and film grammar (hook, music sync,
dialogue in troughs), marketing distribution (Steam, autoplay feeds),
subtitling (timed-text norms across Latin and CJK scripts), audio
post-production (loudness, ducking), and QA practice (coverage and
chaptering rather than persuasion).

## 1. Research (web, fetched October 29, 2026)

Pages were fetched in a script and summarized off-context (token hygiene);
quotes below are from those summaries.

**Hook and opening.**

- Derek Lieu, "Editing an Engaging Trailer Opening" (2019):
  <https://www.derek-lieu.com/blog/2019/10/2/editing-an-engaging-trailer-opening>.
  The first six seconds are the critical window; named openings include the
  thumbstopper, the scene lift (start mid-scene, used for Firewatch and
  Spelunky 2), suspense, the rug pull and the enigma. Anti-pattern: "too many
  slow shots of the environment art". Test: does the opening present "a
  question which begs to be answered"?
- Lieu, "10 Common Indie Game Trailer Mistakes" (2020):
  <https://www.derek-lieu.com/blog/2020/9/14/10-common-indie-game-trailer-mistakes-and-how-to-fix-them>.
  No logo or "Studio presents" up front (logos go on the end slate); keep
  game SFX ("SO much is lost when there is no game audio") with game music
  off during capture; trailer music needs a beginning, middle and end, not a
  loop; no repeated shots; intercut text with gameplay rather than overlaying
  both; match the eye trace across cuts; avoid generic feature cards.
- Steamworks, "Trailers":
  <https://partner.steamgames.com/doc/store/trailer>. Players "may have less
  than 10 seconds"; the first listed trailer should be primarily gameplay from
  the player's perspective, with HUD; it should make sense without audio.
  Steam builds a microtrailer from "six 1-second clips" of the first trailer,
  so fragments must read alone. Specs: up to 1920x1080, 30 or 60 fps, H.264
  with AAC, 5000+ kbps, 44.1 or 48 kHz.
- Digiday (2016), "85 percent of Facebook video is watched without sound":
  <https://digiday.com/media/silent-world-facebook-video/>. Old and
  platform-specific; cited as the reason captions are burned in, not as a
  current statistic.

**Structure and length.**

- Lieu, "Ideal Game Trailer Length and Labeling" (2018):
  <https://www.derek-lieu.com/blog/2018/12/20/ideal-game-trailer-length-and-labeling>.
  "Make your game trailers 90 seconds or fewer"; 0–30 s is a "snack"; the
  label primes expectations (a "Teaser" may tease, a "Gameplay trailer" must
  show play; an "Overview" may run long).
- Lieu, "What Makes a Good Teaser Trailer" (2018):
  <https://www.derek-lieu.com/blog/2018/3/17/what-makes-a-good-teaser-trailer>.
  "Do more with less"; every shot must "pull its own weight"; one striking
  idea beats story.
- Lieu, "Simple Game Trailer Templates" (2020):
  <https://www.derek-lieu.com/blog/2020/3/1/simple-game-trailer-templates>
  and "Tell, Show, Repeat" (2023):
  <https://www.derek-lieu.com/blog/2023/4/9/tell-show-repeat-the-2nd-easiest-game-trailer-to-make>.
  Card tells, gameplay shows, repeat, end on a montage; order simplest to most
  complex; feature-only copy "could be used to describe tens of thousands of
  games".
- Lieu, "Gameplay Preview vs Trailer" (2019):
  <https://www.derek-lieu.com/blog/2019/5/15/gameplay-preview-vs-trailer>.
  Explanation videos (Tom Francis style) suit mechanics-heavy games; release
  both a tight trailer and an overview. This licenses the compendium as a
  different genre with different rules.

**Music and dialogue.**

- Lieu, "How Trailer Editors Edit Dialogue to Music" (2022):
  <https://www.derek-lieu.com/blog/2022/3/14/how-trailer-editors-edit-dialogue-to-music>.
  Music peaks get "a cool shot, a cut, synced to an action", never dialogue;
  dialogue goes in troughs; "no dead air" except deliberate stops.
- Lieu, "How Production Music Teaches Trailer Structure" (2018):
  <https://www.derek-lieu.com/blog/2018/4/17/how-production-music-teaches-trailer-structure>.
  Ramp, escalate, a "fakeout moment of silence", final hit to main title,
  lead out.
- Lieu, "Basic Guide to Trailer Sound Editing" (2020):
  <https://www.derek-lieu.com/blog/2020/11/24/basic-guide-to-trailer-sound-editing>.
  Priority: music, dialogue, trailer SFX, game audio; stop the music down to
  make space rather than ducking a peak.
- Lieu, "Trailer Music Video Style Editing" (2019):
  <https://www.derek-lieu.com/blog/2019/11/26/trailer-music-video-style-editing>.
  "Clarity is probably the most important thing"; style at the expense of
  clarity "becomes noise"; cutting on action and syncing shots to beats.

**Captions and subtitles.**

- Lieu, "Guide for Captions and Subtitles" (2019):
  <https://www.derek-lieu.com/blog/2019/10/27/guide-for-captions-and-subtitles>.
  Legibility over style; never more than two lines, 30–40 characters per
  line; start on the first frame of audio; at least two empty frames between
  captions; speaker labels help.
- Netflix English timed-text guide:
  <https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide>.
  42 characters per line, two lines maximum, up to 20 characters per second
  (adult). Netflix Simplified Chinese guide:
  <https://partnerhelp.netflixstudios.com/hc/en-us/articles/215986007-Simplified-Chinese-Timed-Text-Style-Guide>.
  16 characters per line, up to 9 characters per second. The Spanish guide
  URL tried returned a different language page; Spanish limits here follow the
  Latin-script norm (42 per line, 17 per second) as an assumption, not a
  citation.

**Capture tooling and specs.**

- Lieu, "The Best Debug Tools for Game Capture":
  <http://gametrailerdebugtools.com/>. HUD and music toggles, level skip,
  invincibility, whole-number slow motion, deterministic replays (Spelunky 2
  re-ran a level exactly).
- Lieu, Game Trailer Specs: <http://www.gametrailerspecs.com>. The one
  published loudness target found: Xbox masters at "-16 LKFS/LUFS, True Peak:
  -2dBTP", with an SRT captions file per submission. Steam publishes none.
- YouTube, "Video chapters":
  <https://support.google.com/youtube/answer/9884579?hl=en>. Chapters start
  at 00:00, at least three, each at least 10 s.

## 2. Concerns and anti-patterns (derived, used to prime the judges)

Teaser (30 s):

- T1 Gameplay in frame 0; genre readable by 3 s; no logos up front.
- T2 One idea that begs a question; do more with less, no filler vistas.
- T3 Music has shape: ramp, a fakeout silence, the title on a hit, a button.
- T4 Dialogue only in troughs; never over a peak.
- T5 Survives silent autoplay: burned captions, the joke readable muted.
- T6 Every language fits: the longest VO take sets the slot.

Trailer (90 s):

- R1 Hook in 6 s, name in 10 s, at least 60% gameplay from the player's view.
- R2 Tell-show cards are specific to this game, never generic features;
  text intercut, not stacked on busy gameplay.
- R3 Each verb's receipt (pod break, drift, PAY) is visible in its shot.
- R4 No repeated shots or places; sections end on something new.
- R5 Story in seconds: lore never holds for more than a few seconds.
- R6 Ending not spoiled; the pacifist run is teased, not shown resolving.
- R7 Fragments work as Steam microtrailer seconds.
- R8 Clear call to action and where to play.

Compendium (120 s):

- C1 Coverage: every listed verb and front-of-house screen appears once.
- C2 Clarity over pace: natural speed, labels, the receipt in frame.
- C3 Chapters at least 10 s, exported for YouTube and as WebVTT.
- C4 The game's own mix and subtitles: what ships is what is shown.
- C5 Honest gaps: shots that cannot be reached are marked, not faked.
- C6 Language coverage includes live cycling with [ and ].

Pipeline (all cuts):

- P1 Deterministic, cached takes from a frozen build; one recipe, one hash.
- P2 Clean capture: game music and VO off for trailers (post adds them),
  no dev overlays, HUD on.
- P3 Stated loudness targets and true-peak ceiling, verified per master.
- P4 VO and caption text drawn from the script data, never retyped.

## 3. Judge panel (text only, three isolated passes)

Each judge read this README's sections 1–2, the three first-draft sheets,
the key VO lines in English and a page of game facts, with no knowledge of
the other judges or of Adam's preferences. Three different models, so these
are independent passes rather than three runs of one model, but they are
still model critiques, not human players or editors.

| role | model (OpenCode Go) | priming |
| --- | --- | --- |
| publisher scout | gemini-4-argon, low | hook, differentiation, CTA, microtrailer, muted autoplay |
| trailer editor | kimi-k3.1-pro, low | music shape, dialogue in troughs, slot math, card copy |
| QA lead | glm-5.3, low | coverage, honest gaps, chapters, reproducibility |

Cost: US $0.00 metered (subscription; logged in `research/SPEND.md`). The
US $0.50 budget was not touched. All three kept the same core: the hype,
stopdown, shrill "STOP!" and AI aside (scout, editor), and the
event-anchored, beat-aligned shot model (QA lead).

### Adopted (sheets revised)

| advice | from | change |
| --- | --- | --- |
| Pause coverage is faked by `{ at: 20 }` | all three | new take `s1-pause` presses Escape; anchor on `nw-screen-pause` |
| Tutorial at 2x violates natural speed | all three | `speed=1`, 420 s timeout; a stall is reported as a gap, never sped up |
| `show-writ` anchored on charge may miss the receipt | editor | anchor on `partBreak` by `writ`, one unbroken 8-beat shot |
| `verb-pod` on `coreExposed` may miss the break | editor | anchor on boss `partBreak`, 6 s (settings 8 to 7 s) |
| `s2-fight` reused four times early; hook repeats show-writ | scout | hook-writ from s4, hook-graze from s5 |
| tap and stream as two shots of one take | QA lead | merged into one 8-beat `show-fire` |
| Places montage is vista filler | scout, editor | kept, but each place shot is anchored on a kill (place with action) |
| Teaser `sector-place` is a slow vista; teaser carries a fourth idea (`scan-kill`) | scout, QA lead | `scan-kill` cut; `place-kill` shows a kill in a staged sector |
| CTA placeholder must not ship | editor | the assembler refuses a public master with `{{PLAY_URL}}` unresolved |
| CTA should say no install | scout | "Play it in your browser. No install." (ES, ZH localized) |
| Long anchors need slack | QA lead | boss takes `maxSeconds` 240 (timeout 200 s) |
| 1080p UI from 720p capture is soft | scout | master takes capture at the master size (separate cache keys) |
| Loudness must be verified, transparently | QA lead | two-pass linear `loudnorm`, measured with `ebur128` into each report |

### Declined, with reasons

- **VO slot overflows (T6) in most shots** (all three). The judges extrapolated
  from my own wording ("ES takes up to 60% longer") instead of measuring. The
  planner reads `public/vo/cues.json` per language: `desc_001` is 5.12 / 5.92 /
  4.00 s (EN/ES/ZH), `boss_turn_002` at most 4.32 s, `brief_warden_003` 9.28 s
  in ES inside a 10.03 s window. All fit. The one real overflow (trailer90
  `warden-stop`, 14 beats = 5.85 s against ES 5.92 s plus offset) was
  corroborated by the planner and fixed (16 beats, silence 24). Lesson: give
  judges measured numbers, not ranges.
- **Shorter alternate script lines** (editor, QA lead). Measured takes fit, and
  new VO lines belong to the VO workstream (script-as-data, regeneration).
- **Cut the places montage entirely** (scout). AGENTS.md makes sector worlds as
  staged places a product goal (Jets'n'Guns reference); kept, with action.
- **Shorten `recorder` to 8 beats** (scout). `flash_rec_001` is 7.28 s in EN and
  sets up the pacifist tease ("Weapon status: cold"); the line needs 16 beats.
  Microtrailer risk accepted and noted.
- **"PLAY THE FREE DEMO NOW"** (scout). It is a vertical slice, not a demo, and
  "free" is a hosting and policy claim nobody has made yet.
- **Move teaser VO to shot starts** (scout). Narration over a gameplay montage is
  the template; without a music peak map we cannot yet prove collisions. Next
  step instead: detect cue peaks (onset strength) and warn on VO over a peak.
- **1920x1080 menus as a fix for pillarboxing** (scout). The 16:9 masters keep the
  portrait playfield as a central column with staged scenery at the sides; a
  9:16 social cut is the real answer and is deferred.

## 4. Pipeline (`trailer/`)

```
trailer/
  cuts/*.yaml   cut sheets: takes, shots, music edit, VO, localized cards
  plan.ts       pure: sheet to absolute timing per language; VO fit checks in
                every language; caption chunking; take recipes and hashes
  capture.ts    frozen build; takes recorded with the game's own mix (qa/av.ts)
                into trailer/.cache/takes/<take>-<lang|any>-<hash>/
  assemble.ts   FFmpeg: trims, conform, Chromium-rendered text layers, music
                edit, VO, ducking, two-pass loudness, SRT and chapters
  trailer.ts    the command
```

One command per cut: `deno task trailer teaser30 --lang en` (or `--lang all`).
`--draft` renders 640x360 with named placeholders for missing takes or
anchors; `--plan` prints timing and warnings only; `--shots a,b` captures only
those shots' takes; `--no-capture` assembles from the cache;
`deno task trailer estimate` prints the take inventory and capture bound.
Details and schema: `trailer/README.md`.

Design decisions:

- **Takes, not shots, are the expensive unit.** A take is a real-time capture
  recipe (query, settings, steps, viewport); shots are trims located by an
  anchor in the take's timeline (a sim event with a predicate, a VO line, a
  probe log entry, a screen change, or a time). The cache key hashes the
  recipe and the frozen build's content hash, so changing a sheet's timing
  never recaptures, and changing the build invalidates everything.
- **Language-neutral takes.** Trailer takes run with music and voice buses at
  0 and in-game subtitles off; VO, captions and cards are added in post per
  language from `public/vo/cues.json` and `src/i18n/ui.ts`. Only takes with
  readable UI text (`langSensitive`) are captured per language. The dry run
  verified it: music, voice and UI buses measured -70 LUFS, SFX present.
- **Music sync by construction.** Shots are measured in beats of the cue
  playing at their start (BPM and beat offset from `public/music/manifest.json`);
  `align` puts the anchor on a chosen beat inside the shot.
- **Loudness targets:** -16 LUFS integrated, -2 dBTP true peak (the one
  published game-trailer master spec found, Xbox via gametrailerspecs.com;
  YouTube and Steam normalize or accept it). Music is set 3 dB under the game
  bus and ducked by a sidechain compressor keyed on VO (threshold -30 dBFS,
  6:1, 20 ms attack, 350 ms release; the resulting reduction is configured,
  not yet measured). Two-pass linear `loudnorm`, verified with `ebur128`.
- **Captions** are burned (silent autoplay) and written as SRT. Chunks follow
  sentence boundaries within two lines (EN/ES 42, ZH 16 characters per
  line), timed from the forced-aligned word spans, with a speaker label and at
  least two empty frames between captions.
- **Compendium** uses the game's own mix and in-game subtitles (what ships is
  what is shown), seconds rather than beats, lower-third labels, chapter cards,
  and exports YouTube chapter text and WebVTT chapters.

## 5. Dry run (October 29, 2026, build `87abcda3a762ff21` from `fdfcee6`)

`deno task trailer teaser30 --lang en --draft --shots hook-writ,graze-curtain,warden-stop`
captured two takes (s2-fight 76 s, boss-descent 21 s) and assembled a
640x360 animatic with real shots for hook-writ, graze-curtain,
warden-arrives and warden-stop, cards for title and slate, and placeholders
for place-kill and doubt. ES and ZH animatics reused the same takes
(language-neutral) and only re-assembled.

| master | measured | assemble |
| --- | --- | --- |
| teaser30-en-draft | -16.0 LUFS, -2.0 dBTP | 3.7 s |
| teaser30-es-draft | -15.8 LUFS, -2.3 dBTP | 3.2 s |
| teaser30-zh-draft | -16.0 LUFS, -2.0 dBTP | 3.9 s |

Artifacts in `dryrun/`: `teaser30-en-draft.mp4` (1.5 MB animatic),
`teaser30-{en,zh}-sheet.jpg` (one frame per 2.45 s), the EN report and the EN
and ZH SRTs. Full outputs and work files stay in `trailer/out/` (gitignored).

What the dry run caught (fixed in the sheets):

1. `graze.count` is per event (always 1); graze anchors now use the running
   `meter`.
2. A take with no input reaches the Warden's never-fired branch: `desc_002`
   never plays, `desc_pac_001` does. The descent take now waits for
   `desc_ai_001`, common to both branches. Shots that need the fight branch
   must use the fight autopilot.
3. The first Writ break lands 1.8 s into sector 2, during the load-in; the
   teaser hook now uses the second (`nth: 1`).
4. In the s2 take, nearly all events fall in the first 9 s and the last 10 s
   (a scene holds play in between); anchors prefer early `nth` values.

Known issues not fixed in this pass:

- **Master capture quality is the gate.** Takes come from Playwright's
  recorder: 1280x720 at about 0.76 Mbit/s video. Fine for animatics, too soft
  for a public master of a fast shmup. Before allocating master compute, add a
  high-quality capture path (CDP screencast frames at 1920x1080, or a
  deterministic frame-stepping harness) and verify real-time frame pacing at
  1080p in headless Chromium.
- One-glyph widows in ZH captions (`机要多久？！` breaks after one character);
  add CJK line balancing to the caption renderer.
- The ducking depth is configured, not measured; add a music-bus measurement
  inside VO windows to the report.
- Speaker labels are uppercased in SRT only; burned captions keep case.
- The tutorial take is unproven at `speed=1` (the earlier stall was at 2x and 8x).

## 6. Estimates (wall time on this M3 Max, 16 cores)

Measured: capture runs at real time plus about 5 s per take (build once,
about 10 s); a 30 s draft assembles in about 4 s; a 1080p `slow`/CRF 16 encode
of 30 s took 3.75 s (from upscaled draft footage; real 1080p detail perhaps
2x slower). `deno task trailer estimate` gives upper bounds from each take's
`maxSeconds`; `until` takes usually finish early (the descent took 21 of 70 s).

| cut | takes (EN / new for ES / new for ZH) | capture, upper bound | capture, expected | assemble per language (master) |
| --- | --- | --- | --- | --- |
| teaser30 | 4 / 0 / 0 | 7.6 min | about 4 min | about 0.5 min |
| trailer90 | 9 (3 shared) / 0 / 0 | 11.8 min | about 8 min | about 1.5 min |
| compendium120 | 13 / 5 / 5 | 25.9 + 20 + 20 min | about 45 min (tutorial take dominates) | about 2 min |
| **all cuts, all languages** | | **85 min** | **about 60 min** | **about 12 min** |

Recommendation: capture serially (one browser; parallel headless captures on
one GPU risk frame pacing, per `neon-av-review-technique`), so about 75 minutes
of a mostly idle machine for all nine masters once the master capture path
exists. Disk is small (about 1 MB per 10 s of take at the current bitrate;
expect 10–20x with a proper master capture). No paid API is needed to
render; an optional blind judge pass over the three EN masters at the
existing Argon rate (about US $0.04 per minute) would be about US $0.15.

## Status and next step

Done: research, concerns, three revised cut sheets, judge panel with adopted
and declined advice, pipeline, three-shot dry run in three languages,
estimates. Not done: full captures and masters (by design), the high-quality
capture path, peak-aware VO checks, a 9:16 social cut.

Next step: build and verify the master capture path on one take (1080p frame
pacing and bitrate), then `deno task trailer teaser30 --lang all` as the first
real render, then a blind silent-viewing check of the teaser (does the joke
read muted?) before the 90 s cut.
