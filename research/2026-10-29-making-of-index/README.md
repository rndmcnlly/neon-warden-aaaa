# Making-of index: where the evidence lives (October 29, 2026)

## Framing question

A later "making of" page (perhaps GitHub Pages) should teach UC Santa Cruz
Computer Science: Computer Game Design students what a high-polish vertical
slice can be, using this repository as the worked example. Which claims can we
make, where is the strongest evidence for each, what small media already exists,
and what is missing or risky? This is an index, not student prose and not a page.

Disciplines in play: game production (milestones, scope, stakeholder
communication), software architecture (pipelines, determinism, contracts), QA
and evaluation methodology (blind judging, ablations), pedagogy (curriculum
sequencing), and research ethics and political economy (who a slice persuades,
honest stubbing, model attribution, spend disclosure).

Snapshot: `main` at `dcbb6c4` plus a dirty checkout (live language cycling in
progress: `src/input/langCycle.ts`, `research/2026-10-29-night-verification/`
untracked). Everything below is dated; nothing here re-ran tests.

## Curriculum context (fetched October 29, 2026)

The [2026–27 catalog](https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computational-media/computer-science-computer-game-design-bs)
names a two-course development sequence, CMPM 120 Game Development Experience
then CMPM 121 Game Development Patterns, and a two-quarter comprehensive track,
CMPM 170 Rapid Prototyping then CMPM 171 Game Design Studio (7 units). Related
electives a page could point to: CMPM 119 Accessible Game Design and
Evaluation, CMPM 122 Business of Games, CMPM 151 Algorithmic Music, CMPM 163
Real-Time Rendering, CMPM 172 Game Production Studio. Program learning outcomes
explicitly include "design and build a technical system that achieves an
artistic goal for audience experience" and "collaboratively plan, organize, and
execute complex, team-oriented projects", which map onto themes 2, 5 and 7.

Positioning: the E4 starter (`reference/e4-starter/`, about 2,260 lines of TS,
one Phaser scene family) is the CMPM 121 / CMPM 170 scale artifact; this repo is
what a CMPM 171 slice could be. The bridge claim: the starter's best idea
("pilots" as an interchangeable input interface, see
`research/2026-10-28-original-reference/README.md`, "Pilots are not
characters") survives intact as `src/contracts/pilot.ts` and powers the
autopilots that make QA possible. That is a CMPM 121 pattern paying off.

## Scale at a glance (cheap counts at `dcbb6c4`, tracked files only)

| Area                                                                                    |                Lines | Notes                                                        |
| --------------------------------------------------------------------------------------- | -------------------: | ------------------------------------------------------------ |
| Runtime `src/` (TS, CSS, shader `.glsl.ts`)                                             |               41,153 | largest: `render` 7,960; `ui` 5,654; `audio` 3,863; `scenes` 3,830; `i18n` 3,781 (mostly translated strings); `sim` 3,634 |
| Tests `tests/` (51 files, 265 `Deno.test` calls)                                        |                6,871 |                                                              |
| QA tooling `qa/` (TS)                                                                   |                6,030 | reports themselves are gitignored                            |
| Asset pipelines: `art/blender` 2,546, `vo` 1,320, `sfx` 509, `music` 427, `scripts` 445 |                5,247 | Python (bpy, uv scripts) and Deno                            |
| Research-folder capture/judge tools (tracked)                                           |                8,127 | one-off harnesses per study                                  |
| Production dashboard `production/`                                                      |                  320 |                                                              |
| Repo-local skills `.opencode/skills/`                                                   |                  300 | Markdown                                                     |
| Data: `vo/script.yaml`                                                                  |                2,992 | trilingual script-as-data                                    |

Non-runtime code is roughly 26,600 lines against 41,150 runtime: about 39% of
the code exists to make, check or judge the game, not to be the game. Caveat:
counts are raw lines (comments included), `src/i18n/ui.ts` is mostly string
data, and research harnesses are disposable. Good diagram: a stacked bar.

History: 131 commits from `25edee9` (October 28, 18:17) to `dcbb6c4` (October
29, 08:15), about 14 hours of wall time with many parallel agents. This number
is striking and must be framed carefully (see Risks).

---

## 1. Strategic intent: a slice is a persuasion artifact

**Claim.** A vertical slice is consumer-feeling but not for consumers: it
communicates with publishers, funders and (for students) graders and playtest
audiences. Its include/exclude decisions are the real design document, and
honest stubbing is an ethical counter-practice to overclaiming.

**Strongest evidence.**

- `research/2026-10-28-vertical-slice-checklist/README.md`: "Power relations,
  briefly" (the slice as a funding instrument; faked demos shift risk onto
  workers and players; honest stubbing as counter-practice) and "An inversion
  in our project" (Xsolla calls settings nice-to-haves; we make the front end
  part of the claim). Cites Xsolla, salivity, GAG.
- `PRODUCTION.md`, "Slice contents" table: Built vs Stubbed per beat (EULA,
  multiplayer, store, leaderboards, cloud saves, photo mode stubbed).
- `AGENTS.md`: Framing revised October 28 after Adam played the Minesweeper
  parody (parody to authentic slice); scope cut "Pilot stays off-screen";
  "No content censorship for children" decision; platforms decision.
- Teardown that triggered the reframe: the AAA Minesweeper teardown note
  (outside this repo, in a private course workspace).
- Scope cut commit `c598544` (October 28, 22:57) "Remove on-screen Pilot and
  helmet customization from active slice"; follow-up repair `3f785ff`;
  superseded-requirement note at the end of `docs/WAVE3.md`.
- Honest walls: `src/i18n/ui.ts:319` "Not included in this vertical slice";
  chapter-flavored wall copy at `src/i18n/ui.ts:2101`, `2164`, `2274`, `2286`
  (hangar packages "designed for chapter three's escort contracts", "tribunal
  chapters"); `ui.stub.*` keys in `src/ui/screens/menus.ts` (EULA,
  leaderboards, multiplayer, photo mode, sign-in), `src/ui/screens/hangar.ts`,
  `src/ui/screens/dialogs.ts`.
- Hangar implying an 80-hour game: `docs/WAVE3.md` Design ("window onto an
  80-hour game ... truncated honestly"), commit `099eb30` (packages with real
  stat deltas, mastery, codex, campaign map, honest walls).
- Judge vs honesty: `research/2026-10-28-argon-creative-review/README.md`,
  "Three things not worth building": Argon suggested hiding the unavailable
  grid; the team recorded "reject hiding scope to imply completeness".
- Dated decisions: `production/status.json` `decisions` array (Pilot
  off-screen, no censorship, Captain voice, credits wording), and
  `docs/dashboard.md` explaining that statuses carry dates and revisions.

**Media.** Exists: hangar reel (`qa/reports/20261028-225200/index.html`,
gitignored), moments gallery (`research/2026-10-28-moments/index.html`). To
make: a Built / Stubbed / Cut table rendered as a diagram; a screenshot pair of
a stub dialog and a hangar wall; a timeline strip of scope decisions.

**Gaps and caveats.** No real publisher or funder ever saw this build; the
"stakeholder" is Adam and future students. The "pitch" materials a real slice
carries (one-pager, trailer, budget-to-full-production) do not exist; the
trailer task is only queued (`production/status.json`, "Trailer automation
prep"). Helmet and Pilot GLBs remain in `art/blender/pilot_figure*.py` as
history, which is good teaching material on sunk cost but needs explaining.

## 2. Asset pipelines are code that lives outside the runtime

**Claim.** Every asset class is regenerated from text by a script, so any
line, sound, model or translation can be rewritten at any time. The runtime
only consumes manifests.

| Pipeline     | Inputs                                                                                                     | Tools                                                                                                                                                                                                      | Outputs                                                                                                | Runtime consumer                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 3D models    | `art/blender/*.py`, `art/blender/world/*.py` (sector set pieces), `art/blender/common.py`, `kit.py`         | Blender 5.2.1 headless (`build_all.py`, about 8 s)                                                                                                                                                         | `public/models/*.glb`, `public/models/manifest.json`, `art/blender/stats/*.json`, preview sheets in `research/2026-10-28-art-renders/` | `src/render/`, `src/world/` (`kit.ts`, `sectors.ts`)                                                            |
| VO           | `vo/script.yaml` (speaker, EN/ES/ZH text, direction, seeds); locked anchors `vo/voices/`                   | `vo/render.py` (local Qwen3-TTS via audiocpp on Metal, clone vs design modes, -18 LUFS / -1 dBTP at render), ASR round-trip check and forced alignment for word timings; `vo/casting/cast_candidates.py`, `cast_lang_anchors.py` | `vo/out/<lang>/<id>.wav` (gitignored), `.vtt`, `cues.json`, `vo/out/REPORT.md`                         | `scripts/sync_vo.ts` (Opus 48 kHz, `public/vo/`, `cues.json`, `stamps.json`), then `src/audio/`, `src/director/subtitles.ts`, `src/ui/wordPulse.ts` |
| VO onset     | measured onsets                                                                                            | `scripts/vo_onset.ts` (commit `717da1d`, non-destructive start offset)                                                                                                                                     | per-take offsets                                                                                       | playback, subtitles and word pulses                                                                             |
| Text / i18n  | `vo/script.yaml` plus `src/i18n/ui.ts`, `banks.ts`, `codex.ts`, `radio.ts`                                 | `src/i18n/gen_script.ts` (`--check` for staleness)                                                                                                                                                         | `src/i18n/script.gen.ts` with literal `LineId` types                                                   | everything via `src/i18n/index.ts`; a missing line id fails `deno check`                                        |
| UI SFX       | `sfx/manifest.yaml` (family brief, 16 roles)                                                               | `sfx/render.py` (local model), `sfx/audition.html`, `sfx/picks.json`, `sfx/promote.py`                                                                                                                     | `public/sfx/<role>.ogg`, `public/sfx/manifest.json`                                                    | `src/ui/sound.ts`, `src/audio/`                                                                                 |
| Gameplay SFX | `sfx/gameplay.yaml` (27 roles x 3)                                                                         | ElevenLabs SFX v2 via fal (commit `dec411e`, US $0.16), `sfx/picks-gameplay.json`                                                                                                                          | `public/sfx/gameplay.json` and takes                                                                   | `src/audio/` two-layer system (feel plus beat-quantized musical, `27bedfb`)                                     |
| Synth SFX    | code                                                                                                       | Web Audio synthesis (`d0e33aa`, `929fee8` engine bed)                                                                                                                                                      | none (runtime)                                                                                         | `src/audio/`                                                                                                    |
| Music        | `music/cues.yaml`                                                                                          | `music/render.py` (local model), `music/stats.py` (loudness spread, seam similarity, tempo), `music/audition.html`, `music/picks.json`, `music/promote.py` (-16 LUFS)                                       | `public/music/<cue>/cand1 or cand2.ogg`, `public/music/manifest.json`, `music/objective-stats.json`        | `src/audio/`; beat grid and key measured at promote (`39ed473`) feed the musical SFX layer                      |
| Logos        | `art/blender/logo_*.py` (historic 3D), `public/branding/*.svg`                                             | flat CSS/SVG layer `src/presentation/flatLogos.ts`                                                                                                                                                         | screen-locked logos                                                                                    | `src/scenes/boot.timeline.ts` via the Director (`3f785ff`)                                                      |
| A/B variants | candidate takes                                                                                            | `scripts/extract_voice_variant.ts`, `src/audio/variants.ts`, `?v.<axis>=`                                                                                                                                  | `public/vo/variants/index.json`                                                                        | runtime variant switch; `deno task qa:ab`                                                                       |
| PWA          | build output                                                                                               | `src/platform/` (`worker.ts`, `bootstrap.ts`, `build.ts`), `public/manifest.webmanifest`                                                                                                                   | service worker, per-language offline packs                                                             | browser; docs `docs/PWA.md`; size audit `research/2026-10-29-download-size/`                                    |

**Strongest evidence.** `art/blender/README.md` ("No `.blend` file is a source
of truth"); `vo/render.py` docstring (anchor locking, per-language anchors,
render-time loudness); `src/i18n/gen_script.ts` docstring (why generate rather
than parse YAML at runtime); `sfx/README.md` ASCII pipeline diagram;
`music/README.md`; `research/2026-10-28-vo-pipeline/README.md` (options
considered, what was tried, wave-3 word timing, Captain alternative);
`research/2026-10-29-vo-audit/README.md` (223 voiced lines x 3 languages =
669 takes at `8fcd5ab`, 0 under ASR 0.85, one ZH alignment fallback).
Lessons: `d6e7d36` "vary briefs, not seeds" (audition), `vo/casting/README.md`.

**Media.** Exists: `sfx/audition.html`, `music/audition.html`,
`vo/casting/tutorial_ai/audition.html` (untracked), four-view model sheets in
`research/2026-10-28-art-renders/*.png`, sector set-piece stills in
`research/2026-10-29-sector-worlds-v2/`. To make: one pipeline diagram per
asset class in the same visual grammar (`sfx/README.md` already has one);
"edit one line, regenerate, hear it in game" screen recording; trilingual line
card (EN/ES/ZH text, waveform, word pulses).

**Gaps.** VO models live outside the repo (`PRODUCTION.md` Open:
`~/Code/bbb-artifact-tour/`), so the pipeline is not reproducible by students
without setup notes. Raw WAVs are gitignored by design. Music provenance (which
local model, its license) should be quoted from `research/2026-10-28-music/`
before publishing. Gameplay SFX are a paid API; UI SFX and VO are local.

## 3. Front-of-house coverage every player passes through

**Claim.** The parts every player touches (boot, menus, settings,
accessibility, subtitles, language, platform) are built to near-shipping
quality, inverting the usual slice priority.

**Strongest evidence.**

- Boot: `src/scenes/boot.timeline.ts`, `src/presentation/flatLogos.ts`,
  `research/2026-10-28-flat-logos/` (decision against 3D logos), `3f785ff`,
  `0e87486`; logo QA `qa/reports/logo-integration-2026-10-29T06-02-33.288Z/`
  (69 browser checks, per `production/status.json`).
- Screens: `src/ui/screens/boot.ts`, `menus.ts`, `settings.ts`, `pause.ts`,
  `hangar.ts`, `dialogs.ts`, `run.ts`; `src/ui/creditsRoll.ts`; router and
  pure dispatch rule `src/ui/dispatch.ts` (`8237902`); focus model
  `src/ui/focus.ts`; device-following prompts `src/ui/prompts.ts`.
- Settings contract: `src/contracts/settings.ts`, `src/settings/store.ts`;
  `PRODUCTION.md` Architecture item 5 lists every option.
- Subtitles and word pulse: `5029b39`, `src/ui/wordPulse.ts`,
  `src/director/subtitles.ts`.
- Accessibility in practice: reduced motion/flash respected in logos and
  scenery (`56b171d`), outline pulse instead of flash (`docs/NIGHT-PLAN.md`
  step 3), color-independent ladder rule.
- Critiques that shaped it: `research/2026-10-28-critique-ui/` (typography,
  focus, motion, CJK, prompts; top 10) and fixes `8635799`, `145a1b0`, `9e907ac`.
- Tutorial: `src/scenes/tutorial.timeline.ts`, `tutorialGates.ts`,
  `tutorialSkip.timeline.ts`, `src/director/tutorialProgress.ts`, `85ee111`
  (fresh lesson-local actions, wrong-input barks), `da1e1f0` (trick-shot bug
  from Adam's playtest).
- Platform: `e995599` (fullscreen and offline packs), `ad32043` (offline tools
  moved into Settings), `docs/PWA.md` (installation is not offline readiness),
  `research/2026-10-29-download-size/` (22–24 MiB per language),
  `research/2026-10-28-chromebook-kids/`, `research/2026-10-28-mobile-touch/`.
- Language: `src/input/langCycle.ts` (in progress, uncommitted).

**Media.** Exists: `research/2026-10-28-frontend-shots/*.jpg`,
`research/2026-10-28-critique-ui/` screenshots, `research/2026-10-28-moments/`
gallery desktop and mobile. To make: one silent menu traversal video with
captions; a settings "every row" contact sheet in EN/ES/ZH side by side; a
player-journey flow diagram (gate, photosensitivity, logos, title, menu,
tutorial or skip, sectors, boss, ending, credits).

**Gaps (important, keep honest).** `production/status.json` blockers:
"Mobile, touch, visible Back and school tier: Not built" (as of October 28),
and "Hangar redesign: researched, not implemented" (Casual Creators spec). The
platform panel labels are English only (`docs/PWA.md`). ES/ZH offline packs
untested. The page must say mobile and Chromebook are researched, not shipped,
unless that changes.

## 4. Core gameplay: radically short, still representative

**Claim.** Five sectors, a flashback inside play, one boss sandwiched between
scripted interstitials, and two endings carry the whole verb set; scenes are
data played by a Director, triggered by sim events.

**Strongest evidence.**

- Sequencing rule: `src/scenes/index.ts:77` `timelineForEvent` maps sim
  events to scenes (`sectorStarted` to `sectorN`, first powerup to
  `flashback`, sector-3 recorder to `recorder`, `bossWarning` to
  `wardenDescent`, `bossPhase` 2/3, `bossDefeated` to `endingKill`,
  `bossSurvived` to `endingPacifist`, first lock/disarm/graze/pod to beat
  stingers in `beats.ts`). This one function is the best single diagram source.
- Timelines as data: `src/scenes/*.timeline.ts`, `src/contracts/timeline.ts`
  (`Cue` union), `src/director/director.ts`; commentary and radio
  `src/director/commentary.ts`, `radioDesk.ts`, banks `src/scenes/banks/`
  (`796498d`: 25 banks, 169 variants).
- Verbs: `docs/WAVE3.md` Design (tap, hold, rest-to-charge Writ, scan, graze,
  parts and disarm, pay multiplier); sim in `src/sim/trigger.ts`, `scan.ts`,
  `pay.ts`, `boss.ts`, `enemies.ts`; commits `a9f0e02` (contracts), `a8d446c`
  (sim), `31430d7` (tests); design source
  `research/2026-10-28-gameplay-microsystems/` (systems A–D recommended, E–F
  optional, G–H declined).
- Sectors as places: `src/world/`, `art/blender/world/`, `8909dc8`, `113ca27`,
  `8774627`; `research/2026-10-29-sector-worlds-v2/` (four of five read as
  specific places in a blind test).
- Boss and endings: `research/2026-10-29-warden-defeat/` (`c6340d7`,
  `4601072`, `dcbb6c4`); narrative spine
  `research/2026-10-28-narrative-tropes/` (Spine A "Enclosure" chosen over
  "Succession" and "Attract Mode").
- Feel passes: `research/2026-10-28-shot-feel/` (`5a23867`),
  `research/2026-10-29-bolt-identity/` (`ab5e4a6`, `8522158`),
  `research/2026-10-29-core-feedback/` (feedback ladder, `5318e70`..`010d6ba`),
  `research/2026-10-29-movement-lane/`, `research/2026-10-29-morning-fix/`.
- Prototypes not integrated: `research/2026-10-29-memory-and-briefings/`
  (staged flashback, enemy briefings, `c5fa3bf`), `research/2026-10-29-route-ribbon/`
  (`6d56a79`), hybrid movement (`75b75c3`, opt-in `?movement=hybrid`).

**Media.** Exists: before/after viewers in `warden-defeat/index.html`,
`bolt-identity/viewer.html`, `core-feedback/index.html`,
`movement-lane/index.html`; moments gallery (30 clips, stale against newer
code). To make: a "beat sheet" diagram generated from `timelineForEvent` and
the timeline files (slice runtime in minutes per beat); a verb card per verb
(input, sim event, sound, visual, pay effect); the feedback ladder as a
graphic (graze < hull hit < ... < life lost, from `docs/NIGHT-PLAN.md`).

**Gaps.** Enemy briefings and staged flashback are prototypes, not in the
main build. A measured slice runtime (minutes per beat for a human and for the
autopilots) is not recorded anywhere I found; compute it before claiming
"radically shortened". Night verification found disarm and Writ-tier
recognition did not improve (see 5).

## 5. QA at many levels

**Claim.** A deterministic, pure sim plus interchangeable pilots makes QA
cheap at every scale: unit tests, seeded replays, autopilots at high speed,
URL skip-to, a read-only probe, reels with real captured audio, static
coverage, contextual A/B, blind AI judges checked against event logs, and
human playtests that redirect the work. Reels act like film dailies.

**Strongest evidence.**

- Architecture: `PRODUCTION.md` Architecture items 1, 2, 7; `CONTRACTS.md`
  Rules 1–3 (sim has no clock, no `Math.random`, snapshot-hash determinism).
- Unit tests: `tests/` (51 files, 265 tests), autopilot runs across seeds and
  difficulties `31430d7`, hitstop determinism `61db508`, route ribbon tests.
- URL flags: `src/contracts/flags.ts` (`?skipto=`, `?autoplay=fight|pacifist&speed=N`,
  `?seed=`, `?ui=`, `?qa=1` probe, `?dev=1`, `?v.<axis>=`); pilots
  `src/pilots/fighting.ts`, `pacifist.ts`, `planner.ts`.
- Probe: `src/app/qaProbe.ts`, `qa/probe.ts`, impacts buffer `8ea86c1`.
- QA CLI: `qa/README.md` (statuses, reels, audio in reels, paired A/B, judge,
  "Citing reports" rule), `qa/qa.ts`, `qa/reels.ts`, `qa/av.ts` (post-fader
  stems, `efde7f4`), `qa/coverage.ts` (translation coverage), `qa/assets.ts`,
  `qa/budgets.ts`, `qa/ab.ts`, `qa/judge.ts` with listen-first canary
  `qa/lib/canary.ts` (`c1a3ff8`).
- Finding that reels were silent and VO dropped on skip paths:
  `research/2026-10-28-omni-judges/README.md` Findings 0 and 1.
- Blind judges and rejected claims: `research/2026-10-28-intelligibility/`
  ("detection is not understanding"; a confident timer diagnosis rejected
  against ground truth), `research/2026-10-29-argon-core-ideation/` (Rejected
  or downgraded claims), `research/2026-10-29-night-verification/` (judge
  preferred BEFORE in 7 of 10 pairs; rejected-claims table; untracked as of
  this snapshot), `research/2026-10-29-sector-worlds-v2/` (invented signage
  rejected), `research/2026-10-29-warden-defeat/` (noisy span counts 18 vs 46
  on near-identical clips).
- Human playtests: `docs/WAVE4.md` "Adam's playtest notes" (keep the voice,
  trick-shot bug, anti-repetition, anticipation); `docs/NIGHT-PLAN.md`
  (MOVE/SHOOT/DAMAGE redirect); `research/2026-10-28-integration-playtest/`
  (agent playtest with AX note).
- Contextual A/B: `qa/ab-*.log`, `qa/reports/ab-20261028-*` (gitignored),
  decision records in `AGENTS.md` and `production/status.json`.
- Dashboard as dailies desk: `docs/dashboard.md`, `production/server.py`
  (videos served, stale vs current separated, read-only).

**Media.** Exists: `research/2026-10-28-moments/index.html` (guided viewing),
`research/2026-10-29-night-verification/index.html` (blind reveal),
`research/2026-10-28-intelligibility/index.html`, dashboard screenshots
(`production/reports/browser-snapshot.md`). To make: a QA pyramid diagram
(unit, deterministic sim, autopilot, reel, judge, human); a 20-second split
screen of `?autoplay=fight&speed=16` and `?autoplay=pacifist`; one "judge said
X, event log says Y" card.

**Gaps.** `qa/reports/` is gitignored, so most cited reels will not exist on a
public site unless exported. The night verification shows the method finding
that the team's own fixes did not work: that is the best honest lesson, but it
is uncommitted at this snapshot. The "dailies for external stakeholders" claim
is an analogy; no external stakeholder watched them.

## 6. Iteration with outside sources (dated timeline)

**Claim.** Each major change was anchored in web-sourced craft knowledge or a
blind observation, then adopted selectively, with declined ideas recorded.

| When (2026)       | Folder                                                    | Outside anchor                                       | What it changed                                                                                       | Declined or rejected                                                                           |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Oct 28 (pre-code) | Minesweeper teardown (private course workspace, outside repo) | Adam's play of the parody                            | parody reframed as authentic slice (`AGENTS.md` Framing)                                              | parody tone                                                                                    |
| Oct 28            | `original-reference`                                      | live E4 starter, source read in full                 | entity bible, waves, pilots-as-interface carried over                                                 |                                                                                                |
| Oct 28            | `vertical-slice-checklist`                                | Xsolla, publisher-milestone articles, GAG, case studies | `PRODUCTION.md` Built/Stubbed table, front-end inversion                                           | overclaiming via hidden scope                                                                  |
| Oct 28            | `narrative-tropes`                                        | TV Tropes                                            | Enclosure spine, Warden three moves, pacifist run                                                     | Succession and Attract Mode spines                                                             |
| Oct 28            | `vo-pipeline`                                             | local TTS options                                    | `vo/render.py`, anchors, timings                                                                      | options listed in "Options considered"                                                         |
| Oct 28            | `critique-visual`, `visual-pass`                          | shipped shmups and rhythm games                      | value ladder, ring bullets, selective bloom (`9037aa6`)                                               | remaining gap options "not done"                                                               |
| Oct 28            | `critique-audio`                                          | Hi-Fi RUSH GDC talk and others                       | two-layer audio, mix targets, ElevenLabs SFX plan                                                      |                                                                                                |
| Oct 28            | `critique-ui`                                             | polished front ends                                  | type scale, CJK pass, settings descriptions (`8635799`)                                               |                                                                                                |
| Oct 28            | `gameplay-microsystems`                                   | genre conventions                                    | Writ, part disarm, graze, Contract Rate (wave 3)                                                      | G fire-first provocation, H overdrive                                                          |
| Oct 28            | `omni-judges`                                             | OpenRouter and fal catalogs                          | audio in every reel, `qa/judge.ts`                                                                    |                                                                                                |
| Oct 28            | `casual-creators-hangar`                                  | Kate Compton, Casual Creators                        | hangar redesign spec                                                                                  | not implemented (blocker)                                                                      |
| Oct 28            | `level-design`                                            | comparators, telegraph grammar                       | per-sector anticipation proposals                                                                     | partly adopted via sector worlds                                                               |
| Oct 28            | `mobile-touch`, `chromebook-kids`                         | WCAG 2.2, Google admin docs, COPPA/FERPA             | requirements; Classroom mode recommended                                                              | Classroom mode later overruled by Adam's no-censorship decision                                |
| Oct 28            | `control-feel`, `shot-feel`, `flat-logos`                 | game feel, motor control                             | hybrid movement prototype, faster swept shots, flat logos                                             | 3D turntable logos                                                                             |
| Oct 28–29         | `intelligibility`, `argon-creative-review`                | blind Gemini 4 Argon                                 | one speech channel, pod-break causality, protect voice contrast                                       | Argon's "hide the unavailable grid"; recorder-repetition claim                                 |
| Oct 29 night      | `av-core-loop`, `argon-core-ideation`                     | high-end shmup A/V craft; blind Argon                | feedback ladder, disarm not a kill, Writ payoff, hitstop (`docs/NIGHT-PLAN.md` step 3)                 | rejected judge claims listed                                                                   |
| Oct 29 night      | `core-feedback`, `movement-lane`, `night-verification`, `morning-fix` | blind before/after                         | floor clutter cut after the judge preferred BEFORE 7/10                                               | claims of improvement withheld                                                                 |
| Oct 29            | `twwds-raid`                                              | _The Writer Will Do Something_ (reviews)             | ten narrative ideas; "Picks and warnings"                                                             | check which picks landed                                                                       |
| Oct 29            | `sector-worlds`, `sector-worlds-v2`                       | Jets'n'Guns reference (Adam), blind place test       | Blender set pieces with signage                                                                       | Last Approach misread, then fixed `8774627`                                                    |
| Oct 29            | `warden-defeat`                                           | Game Developer boss structure, Itay Keren GDC 2018   | staged kill and pacifist finale                                                                       | static voice stretches remain                                                                  |

**Media.** To make: a horizontal timeline (research note, commit, before/after
clip) for 6–8 of these rows. The before/after viewers already exist for the
October 29 rows.

**Gaps.** Several folders do not state outcome in a single place; the
"adopted" column above is partly reconstructed from commit messages. The TWWDS
raid's picks need checking against `vo/script.yaml`. Some October 28 notes
are predecessors to code and never received a "status after build" line.

## 7. Process and tooling

**Claim.** The slice was made by one human directing many coupled agents with
file-scoped ownership, pinned contracts, an integration queue, a live
dashboard, repo-local skills distilled from real failures, a spend ledger and
explicit multi-model credits. The failures are as instructive as the wins.

**Strongest evidence.**

- Ownership tables: `CONTRACTS.md` (workstreams 0–7), `docs/WAVE3.md` (agents
  G, V, A, U, N, T, Q), `docs/WAVE4.md` (P, W, B, C, L, T).
- Contracts first: `25edee9` skeleton, `9eb3393` integration pass,
  `src/contracts/`.
- Integration queue: `docs/INTEGRATION-QUEUE.md` (826 lines, append-only).
- Dashboard: `production/status.json`, `production/server.py`,
  `docs/dashboard.md` (freshness vs status), `67dc753`.
- Skills: `.opencode/skills/neon-warden-index` and three specialists,
  `docs/SKILLS.md` (capability hypotheses, validation, promotion gate,
  compression pass), `f636bb0`, `3a9324c`, `62dc815`.
- Failure stories (in the integration skill): word-timing schema mismatch
  across disjoint files; scope cut breaking `main.ts`; `status.json`
  truncated by a concurrent write and rebuilt from memory (`0f48b48`).
- Spend: `research/SPEND.md` (US $20 fal, US $20 OpenRouter; every call
  logged; ZDR required for judges).
- Credits: `src/ui/creditsRoll.ts:40–45` (Claude Opus 5.5, GPT-6.1 Sol,
  Gemini 4 Argon as judge), `5dbe0bb`, `f8921db`, `8ad8598` (GLM-5.3-Flash,
  DeepSeek V4.1 Flash), `src/i18n/ui.ts:2616` "Adam Smith, and his coupled
  agents"; model handoff note in `AGENTS.md`.
- Token lessons: `AGENTS.md` "Subagent token hygiene" (about 1M tokens per
  research subagent from re-reading), background-dispatch and no-orphan-jobs
  rules; night plan "run steps SERIALLY ... to pace inference use".

**Media.** To make: an org chart of workstreams by wave; a commit-density
chart over the 14 hours colored by owner prefix (Render, Audio, UI, QA,
Dashboard); a "three integration failures" comic-strip or sequence diagram.
Dashboard screenshot exists only as `production/reports/browser-snapshot.md`.

**Gaps.** No per-agent token or wall-time accounting exists in the repo; the
1M-token figure is anecdotal. Human hours are not recorded.

---

## Risks for a public page

- **Private course material:** the Minesweeper teardown and other files live in
  a private course workspace outside this repository. Quote, do not link. `reference/e4-starter/` is a course
  starter: confirm it is already public (it is on GitHub Pages per
  `original-reference`).
- **Budget data:** `research/SPEND.md` is small sums but reveals vendor
  accounts and policies; publish totals and the practice, not raw ledgers.
- **Model credits accuracy:** model names and roles must match commit history
  (several models, a mid-project handoff). Do not imply one model did all work
  or that judges are humans. Model names are fictional-future and may read as
  marketing; date them.
- **The 14-hour figure:** true by commit timestamps but invites the wrong lesson
  (that slices are cheap). Pair it with the human playtest loops, the failures
  and the open blockers.
- **Large media:** pack is about 568 MiB; tracked MP4/WebM about 186 MiB;
  research folders hold untracked snapshots with `node_modules` (300–650 MiB
  each, gitignored). A Pages site needs a curated, re-encoded media subset.
  Most QA reports are gitignored and would need export.
- **Stale evidence:** many viewers are pinned to older revisions (moments
  gallery is stale per the dashboard). Every artifact on the page needs its
  revision and date.
- **Children and data:** the Chromebook and no-censorship decisions are Adam's;
  present them as decisions with reasons, not policy advice.
- **Judge outputs:** unedited model prose (for example
  `argon-creative-review/DIRECTOR.md`) may contain confident wrong claims; show
  only alongside the rejection tables.

## What is missing to make each claim well

1. Slice as persuasion: a one-page pitch or "what this slice proves" sheet;
   the trailer (queued).
2. Pipelines: setup notes for local TTS/music models and their licenses; one
   end-to-end regeneration recording.
3. Front of house: mobile/touch and school tier are not built; a current menu
   traversal video at a fixed revision.
4. Gameplay: measured beat durations; integrated briefings and staged
   flashback, or an honest "prototype" label.
5. QA: exported, committed copies of 3–5 key reels; commit the night
   verification folder.
6. Iteration: an "outcome" line per research folder.
7. Process: commit-density chart data (`git log --format=%ad` is enough); a
   short human-hours estimate from Adam.

## Proposed page outline (8 sections)

1. **What a vertical slice is for.** Artifacts: Built/Stubbed/Cut table from
   `PRODUCTION.md` plus the "Power relations" passage; a hangar wall screenshot.
2. **From E4 starter to slice.** Artifacts: side-by-side of the original
   (`research/2026-10-28-original-reference/` screenshots) and current frame;
   `src/contracts/pilot.ts` beside the starter's pilot code.
3. **Front of house.** Artifacts: player-journey flow diagram; trilingual
   settings contact sheet.
4. **A short game that shows the whole game.** Artifacts: beat-sheet diagram
   from `src/scenes/index.ts:77`; Warden defeat before/after viewer.
5. **Assets are programs.** Artifacts: pipeline diagrams (start from
   `sfx/README.md`); Blender model sheets with the script beside them.
6. **QA you can watch.** Artifacts: QA pyramid; autopilot split screen.
7. **Blind judges and being wrong.** Artifacts: night verification "7 of 10
   preferred BEFORE" scorecard; one rejected-claim card from intelligibility.
8. **Directing many agents.** Artifacts: ownership tables by wave; the
   `status.json` truncation incident from the integration skill.

## Five strongest artifacts

1. `src/scenes/index.ts:77` `timelineForEvent`: the whole slice structure in one function.
2. `research/2026-10-29-night-verification/` (scorecard, rejected claims, blind reveal viewer), then `morning-fix` as the response.
3. `research/2026-10-28-vertical-slice-checklist/README.md` "Power relations" plus `PRODUCTION.md` Built/Stubbed table.
4. `research/2026-10-29-warden-defeat/index.html` before/after viewer.
5. `sfx/README.md` pipeline diagram with `vo/render.py` and `art/blender/README.md` as siblings.

## Status and next step

Index only, at `dcbb6c4` (dirty checkout). No tests or reels re-run. Next:
Adam picks the outline, then a writer pass per section with media export.
