# Wave 3 brief (October 28, 2026)

Shared brief for seven parallel agents. Read with `AGENTS.md`, `CONTRACTS.md`,
and the research it cites. Goal: the core loop is genuinely interesting, the
slice feels like a window onto an 80-hour game (truncated honestly by
vertical-slice walls), and every action sounds excellent.

## Design

- **One fire verb.** Tap: single aimed round. Hold: stream. Rest (not firing):
  charge builds toward the "Writ" (three levels) AND a **scanning beam**
  sweeps ahead of the ship. The beam locks onto targets after a dwell; a lock
  reveals the target's AI state (its FSM state: patrol, aim, fire, evade,
  retreat, and so on, shown as intel), its weapon parts, and a weak point.
  A Writ released on a locked weak point is a kill shot (or, on a weapon
  part, a clean disarm). Intel from scans also unlocks codex lore.
- **Grazing**: near misses fill a meter and feed pay; on a pacifist run
  grazes carry the musical layer.
- **Parts and disarming**: aimed and Writ shots break weapon parts; disarmed
  scouts stop firing and leave, spared. The Warden has four weapon pods (one
  per pattern); two broken pods open its core.
- **Pay multiplier**: fed by kills, part breaks, disarms, grazes, scans;
  halved on hit. Disarm pays 40% of a kill. HUD shows PAY beside SCOUTS
  SPARED.
- **Pacifist** = no kills and no Warden kill; disarming is allowed. A
  `neverFired` flag lets the Warden react to the purest run.
- **Hangar (ship customization)**: weapon packages and sensor packages with
  real gameplay effects (e.g. wider scan cone vs faster lock; stronger Writ vs
  faster stream), plus cosmetic choices (paint, trim emissive color, decals,
  engine trail, helmet livery). Expression matters. Show the depth beyond the
  slice: more slots, packages and sector maps visible but walled "not
  included in this vertical slice". Also a codex, mastery ranks, and a
  campaign map with many sectors where only this chapter is open.
- **Salvage cache** in sector 3 is #0121's derelict flight recorder.
- **Enemy chatter**: scouts and Authority channels leak lore over radio,
  played spatially and shown as on-screen radio text (separate from
  subtitles of main dialogue).

## Audio

- Two layers: instant feel layer; musical layer snapped to the music's
  sixteenth grid and key (gameplay cue about 129 BPM; fire rate is already a
  sixteenth). Enemy fire stays off-key.
- **Spatial audio**: positional panning from sim coordinates (HRTF or
  equal-power), **doppler** pitch from radial velocity for passing enemies and
  bullets (computed manually; Web Audio has no doppler), **near-miss whooshes**
  for enemy shots that pass close, an `enemyFired` event for enemy weapon
  audio.
- VO: lines must never be dropped (queue or preload); loudness normalized
  (-18 LUFS, -1 dBTP); the Warden processed as an arena PA; Spanish gets
  per-language voice anchors.
- Gameplay SFX: ElevenLabs SFX v2 on fal for impacts and textures, Web Audio
  synthesis for musical and tiny UI ticks, local SA3 fallback. Budget rules
  in `research/SPEND.md`.

## Subtitles

- Word-level timing for every VO line (forced alignment or an ASR with word
  timestamps such as Parakeet or Qwen3-ASR), stored with cues. The subtitle
  view pulses the word being spoken, honoring reduced motion.

## Credits

- Original game: "Adam Smith, and his coupled agents".

## Ownership (each agent commits only its own paths, often, with clear
messages; never `git add -A`; never push)

| Agent | Owns | Contracts it may edit |
| --- | --- | --- |
| G Gameplay | `src/sim/`, `src/pilots/`, `tests/sim_*`, `tests/pilots_*` | `sim.ts`, `input.ts`, `pilot.ts`, new `loadout.ts` |
| V Visual | `src/render/`, `art/blender/`, `public/models/`, `tests/render_*` | none (request) |
| A Audio and wiring | `src/audio/`, `src/director/`, `src/main.ts`, `deno.json`, `sfx/`, `music/`, `public/sfx/`, `public/music/`, `public/vo/` build step, `tests/audio_*`, `tests/director_*` | `flags.ts`, `time.ts` |
| U UI | `src/ui/`, `src/i18n/ui.ts`, `src/data/`, `tests/ui_*`, `tests/i18n_*` | `settings.ts` |
| N Narrative | `vo/script.yaml` (text fields), `src/scenes/`, `docs/narrative/`, `src/i18n/` except `ui.ts` | `text.ts`, `timeline.ts` |
| T VO tech | `vo/render.py`, `vo/voices/`, `vo/casting/`, `vo/out/`, seed fields in `vo/script.yaml` after N commits | none |
| Q QA | `qa/`, `tests/qa_*` | none |

Cross-agent needs go in `docs/INTEGRATION-QUEUE.md` under a "Wave 3" heading
(append only). Code against another agent's announced API behind optional
checks, then finish hookup when its commit lands (check `git log`, do not
sleep-poll). Before reporting done: `deno task ci` green for your paths, the
relevant `deno task qa` reels run in the foreground, report path cited.
