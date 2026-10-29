# AGENTS.md: Neon Warden AAAA

A deliberately over-produced, high-polish 3D vertical slice of _Neon Warden_,
the small Phaser shmup written as the CMPM 121 Fall 2026 E4 starter. Started as
an "AAAA" parody idea; now an authentic slice (see Framing). Project by Adam
Smith; students in a later course will read its source.

## Fiction

- Studio: `adamsmith.systems` (cyberpunk-flavored). Adam owns the domain; a
  Cloudflare subdomain for hosting is possible later (ask before any DNS or
  deploy step: it is outward-facing).
- Publisher/incubator: `CM121`, a fake VC-funded incubator, `f26` cohort.
- Tone: speculative-2027 aesthetics, high-polish 3D adaptation of the 2D original.

## Framing (revised October 28, 2026, after Adam played the Minesweeper parody)

An authentic, high-polish vertical slice, not a parody. Self-aware and a bit
over the top is fine, but the polish is real: a nearly complete front end
(title, main menu, settings with graphics, audio mix, language, subtitles,
accessibility and controls, pause menu, credits). Features outside the slice
are stubbed honestly with an audience-facing "not included in this vertical
slice" message rather than hidden. Secondary purpose: a reference example for
students building high-polish vertical slices in a later course, so the
structure and the production checklist should be legible and teachable.

## Decisions (October 28, 2026)

- Full three.js rewrite; the original lives read-only in `reference/e4-starter/`
  for design reference (enemies, waves, pilots, powerups, feel). Screenshots of
  the original serve as visual reference.
- All 3D models are built by agents scripting Blender headlessly (`bpy`),
  exported as glTF.
- VO and subtitles: one script-as-data file (each line with EN, ES, ZH text and
  a speaker), rendered by local TTS in a consistent, editable voice style;
  subtitle timings derive from rendered audio, so any line can be rewritten and
  regenerated at any time.
- Music: multiple cues (logos, tutorial, gameplay, flashback, boss, ending).

## Required beats

1. Fake studio and incubator logo sequence.
2. One tutorial: properly built, knowingly overlong, one small wink.
3. Main gameplay phase; picking up the first powerup triggers a mid-scene
   narrative flashback.
4. Over-acted boss battle against the Warden.
5. Gritty, morally gray ending that makes the player doubt beating the Warden
   was right, motivating a pacifist run.

## Narrative directions (October 28, 2026)

- Protagonist: Pilot (kept after `research/2026-10-28-narrative-tropes/`).
  Male (Spanish: "el piloto"; Chinese pronoun 他). Look and bearing evoke Din
  Djarin from _The Mandalorian_: helmet never removed, faceless, terse,
  code-bound, lone gun for hire. Evoke the archetype, do not copy the IP (no
  T-visor, beskar, or creed quotations): design our own helmet silhouette.
  Motive, after Descent's Material Defender: a contractor just trying to get
  paid. Speech: silent except possibly one line, spent once (open).
- Narrative spine: "Enclosure" (research/2026-10-28-narrative-tropes/), with
  the tutorial AI (Lane Authority onboarding) doing the Warden build-up.
- Pacifist run: built for real, not stubbed, and supported by a high-speed
  no-fire autopilot.
- Tutorial: properly built, knowingly overlong, one small wink.
- Wave 3 decisions (October 28, evening): disarming counts as pacifist, plus a
  `neverFired` flag the Warden can react to; the sector-3 salvage cache is
  #0121's derelict flight recorder; the helmet is corporate-issue early and
  worn by the end (two variants); the original game is credited "Adam Smith,
  and his coupled agents"; the full wave-3 brief (scan beam, hangar, spatial
  audio, word-pulse subtitles, ownership) is `docs/WAVE3.md`; raw VO WAVs stay out of git (Opus copies built into
  `public/vo/`, metadata committed). Core loop: tap, hold, rest-to-charge
  "Writ" shot; grazing; part damage and disarming; a pay multiplier
  (research/2026-10-28-gameplay-microsystems/). Audio: two layers, feel and
  beat-quantized musical (research/2026-10-28-critique-audio/).
- Platforms (Adam, October 28): fully playable in desktop AND mobile
  browsers. Every menu has a visible Back affordance for mouse and touch
  (not only Esc or a gamepad button); touch gameplay must express the full
  fire verb (tap, hold, rest-to-charge, Writ release) and scan; mobile
  performance tiers, portrait-first layout (a vertical shmup), safe areas,
  iOS audio unlock. Good Chromebook coverage: elementary-school kids will
  play it on low-end managed school Chromebooks (touchscreen, trackpad,
  keyboard hybrids), so the low tier must be smooth and the game must suit
  young players (no data collection, readable text, school-network friendly).
- Students will read the source: TypeScript for everything except custom
  shaders. No Rust/Bevy swerve.
- The Warden in three moves: (1) another character builds up its terror in
  advance; (2) the real Warden deflates it, very angry but not deep-voiced or
  truly scary, which is a little funny; (3) a further turn reveals it is
  misunderstood, feeding the morally gray ending and the pacifist run.
- Casting consequence: keep the current Warden voice anchor (high, furious,
  not gravelly); the "very low pitch" description in `vo/script.yaml` should
  be rewritten to match the anchor rather than recast. The scary register
  belongs to whoever hypes the Warden up.

## Working style

- Organize work mostly through subagents with clear, file-scoped tasks.
- Subagent token hygiene: three of four research subagents spent about 1M
  tokens each, mostly re-reading large pages or sources held in context. Trim
  big fetches in a script (or hand them to a summarizing sub-subagent) before
  they enter context, and split capture work from analysis.
- Subagents must not end their turn while their own long job (renders, QA
  runs) is still going: a backgrounded job orphans its reporting. Run long
  jobs in the foreground with a generous timeout (`timeout: 0` if needed),
  then report.
- QA is dogfooded: before any agent reports a workstream done, it runs the
  relevant `qa/` checks (translation coverage, asset pipeline, focused
  traversal videos) and cites the report path. Reviewable videos are short
  and single-topic (menus, gameplay, cinematics, endings, accessibility),
  never one long capture.
- Paid APIs: budgets and the spend ledger live in `research/SPEND.md` (US $20
  fal, US $20 OpenRouter as of October 28, 2026). Log every paid call there.
- Research notes go in `research/YYYY-MM-DD-topic/README.md` (framing question,
  findings as options with tradeoffs, status of what was tried, next step).
- House style: no emdashes, no emoji; en dashes for ranges.
- Prior teardown of the AAA Minesweeper parody:
  `(private course workspace)/research/2026-10-28-aaa-minesweeper-teardown/README.md`.
