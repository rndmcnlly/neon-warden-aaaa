# Memory action and enemy inspection, October 29, 2026

## Framing question and status

Can the existing recording become a readable remembered **event**, rather than a
cool filter over frozen combat? Can six seconds make the next new enemy legible?

**Implemented isolated prototype, not integrated into gameplay.** Sources:
`src/presentation/{inspectionScene,memoryScene,enemyBriefing}.ts`. No stage,
backdrop, model registry, world, main-loop or flat-logo changes. No Pilot figure.
Open `viewer.html` for one clip at a time, with interpretation hidden until after
viewing. Captures and frozen snapshots are local ignored artifacts; committed
stills, source hashes, judge evidence and this report remain reproducible.

## Existing event contract and baseline

`src/main.ts` reacts to `pickup.firstPowerup` once per run. Sector 3's recorder
can cause that same first-powerup trigger. `flashback.timeline.ts` additionally
guards `story.flashbackSeen`; `recorder.timeline.ts` reuses it before its coda.
The timeline freezes the sim **before** `flash_ai_001`, flags recording after that
line, and resumes only after `flash_ai_002`, before `flash_ai_003`.

Baseline, source-verified rather than a newly captured baseline video: stage's
`setFlashback` desaturates the frozen combat scene, slows effects and invokes its
existing camera rig. It does not instantiate the remembered ships/traffic/recall.
The new proposal replaces that view, not the recording or combat state.

The registry's model-slot proxy is a good existing seam: clone instances borrow
shared geometry/materials while late-loaded art swaps beneath them. The new
presentation follows that pattern, releasing slots without disposing shared art.
Art axis authority is `art/blender/README.md`: ships nose -Z; enemies face +Z.

## Exact storyboard, no rewritten dialogue

Five shots. EN times are seconds relative to `flashbackRecording=true`, including
the timeline's 0.8-second initial hold. Actual shots key off line identity and
the unchanged take clock, **not these EN wall-clock offsets**. ES/ZH preserve
their own durations and word offsets from the frozen `public/vo/cues.json`.

| Line | EN interval | Shot and action |
| --- | --- | --- |
| `flash_rec_001` | 0.80–8.08 | Approach: #0121's ship enters the left lane, decelerates, stops facing the large Warden across the same space. No shots fired. |
| `flash_rec_002` | 8.48–16.24 | Stop: wide two-subject composition holds the stopped ship while the Authority begs it to fire. Weapon remains cold. |
| `flash_rec_003` | 16.24–21.68 | Same stop shot: Warden reacts, with its comms identity anchored to the machine. No invented attack. |
| `flash_rec_004` | 21.98–29.26 | Traffic: reverse three-quarter view preserves ship-left/Warden-right continuity and reveals three small hulls traversing the middle lane. Their weapon sockets are hidden. |
| `flash_rec_005` | 30.16–36.80 | Recall: closer view of the same stopped hull; an amber uplink appears and readout changes to recall initiated. |
| `flash_rec_006` | 36.80–40.32 | Cut: hull remains, engine goes dark, signal-lost readout; Warden objects. Nothing depicts a body, death, teleport or destruction. |
| silence | 40.32–41.82 | Hold the lost signal, then release presentation at the existing recording flag's falling edge. |

`flash_ai_001`, `flash_ai_002`, `flash_ai_003` stay in the **existing** present-day
timeline, outside this recording-only standalone clip. The abandoned-vessel/day-312
claim belongs to the later `rec_log_001`, not a new spoken line or extra action
inserted into this flashback. The uplink is symbolic, not a specified physical
recall mechanism. No disarming was added: #0121's weapon is explicitly cold.

Registry glTFs are shown at inspection scale with side/raking light and no bloom
washout. Civilian hull reuse is a prototype art limitation. Reduced motion uses
static compositions/cuts with still traffic, not swooping cameras. There is no
strobing/noise path in either setting. A first-pass invented cyan instrument
block proved distracting and was removed, rather than presented as finished art.

## Briefings

`nextBriefing` derives novelty from the original restored `SECTORS` wave data:
sector 1 drone, 2 dart (first scheduled tick 300), 3 turret (60), 4 lancer (60),
5 no new type. Prior-sector types cannot be relabeled new at a checkpoint start.
Actual encountered types must also be supplied, including tutorial spawns.

Example: sector-2 Dart, six seconds, a real gold blade glTF, modest inspection
rotation followed by one committed dive. One localized name and tactical line:
“Commits to a dive. Move out of its path.” No claim about a gun, because darts
are unarmed on Story difficulty. One unseen enemy per card, visible Skip and
Don't show again. `BriefingGate` marks seen on open, so skip does not repeat it;
the standalone checkbox persists a prototype-only preference. Production settings
ownership remains with the integrator. No spawn schedule was changed.

## Capture and comprehension evidence

Frozen source/media hashes: `provenance.json` (final) and `provenance-v1.json`
(judged first pass). Final clips: `out/A/clip.mp4` recording EN 1280×720;
`out/B/clip.mp4` Dart EN 1280×720; `out/C/clip.mp4` Dart ES 390×844 reduced motion;
`out/D/clip.mp4` recording ZH 390×844 reduced motion. Real-time playback, no
accelerated sim. Browser RAF approximately 120 Hz on this Mac; this is **not** a
Chromebook performance result. Recorder timestamp uses actual audio clock.

The canonical `qa/av.ts` tap captured six actual VO source starts and the selected
existing flashback music cue. A: 40.32 seconds audible, -18.3 LUFS, -4.3 dBTP.
D: 42.72 seconds audible, -18.3 LUFS, -4.1 dBTP. Briefings B/C are intentionally
**silent prototypes**, not a finished audio mix. Capture reports correctly warn
that no speaker node was connected there. No new voice, synthetic narration or
offline remix is substituted. Word highlights use original take word offsets.
The QA “VO not dropped” result is vacuous here: the harness doesn't use the
canonical subtitle selector. Actual source starts and nonsilence were verified;
production subtitle/no-drop assertions still require integration.

One **blind** Argon action-reconstruction pass, actual returned model
`google/gemini-4-argon`, provider Google, mandatory ZDR and data_collection deny,
live video-capable catalog checked, cost **$0.022402**, below $0.35. Raw evidence:
`judge-response.json`, `judge.json`, `judge-meta.json`, `judge-catalog.json`.
The judge saw **v1 clips**, now `out-v1/A/clip.mp4` and `out-v1/B/clip.mp4`, not
the final revision. It received no script, intended events or character mapping.

Result: it reconstructed cold weapon → refusal → Warden's traffic claim → recall
→ distressed protest. It correctly identified the silent Dart instruction. But
it reported all ships as stationary and could not visually assign the male voice
to the red machine. It called the initial Dart animation a tilt, not a dive.
Thus story comprehension was predominantly **audio/text-led**, not a visual pass.
Final revision strengthens arrival/braking, doubles traffic traversal, makes the
Dart's dive a committed cross-frame action and anchors Warden's comms label.
Final clips were recaptured, **not re-judged**: only one paid pass was requested.
Do not claim a demonstrated comprehension improvement without another blind test.

## Checks, limitations, next step

- `deno test --allow-read tests/presentation_memory_test.ts`: **5 pass**,
  including frozen-snapshot identity across completion/skip cleanup, resume tick,
  safe-transition rejection, suppression, order/novelty and EN/ES/ZH coverage.
- Focused `deno check` and `deno lint`: pass for owned runtime modules/tests.
- `deno task qa:static`: **32 pass, 6 warn, 0 fail**;
  `qa/reports/20261029-003433/index.html`. Existing translation-width, ASR,
  model-registry/budget/node-table and music-brief warnings remain.
- Four final browser captures: **zero page exceptions, zero horizontal overflow**.
  EN normal and ZH reduced-motion recordings have real, nonsilent audio.
- `check_browser.ts`: **6 pass**, including visible Skip, persisted prototype
  suppression, blocked repeat, recording skip, portrait overflow and page errors.
  Machine evidence: `browser-checks.json` and `capture-summary.json`.
- Production caller/Director skip, mixed subtitle and VO languages, full
  accessibility settings, iOS unlock, low-tier device performance, production
  music ducking and offline caching remain untested integration work.
- No full `ci` claim: this shared checkout contains concurrent world/route/audio
  work, and the requested phase is deliberately isolated.

Next: apply `INTEGRATION.md` only after renderer owner finishes, then run a focused
flashback reel with production Director/word-pulse and a **new authorized** blind
picture-only action reconstruction. The final prototype is an audition candidate,
not already-promoted gameplay.

Process feedback: disabling Vite watch inside a minimal frozen snapshot was
necessary. Unrelated research HTML, renderer and QA report writes caused live
checkout reloads mid-capture. The slot proxy avoided shared-material mutation;
the no-renderer scene port avoids a second GPU loop in production.
