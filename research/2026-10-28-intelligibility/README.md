# Blinded audiovisual intelligibility study

Disciplines: human–computer interaction, information design/accessibility, game feedback, audiovisual causality, and multimodal-model evaluation.

## Framing

Can a first-time observer reconstruct what happened, where danger came from, what action caused a response, and what changed in resources while feedback channels compete? This is **not a beauty-score review**. No game changes were made.

**Revision:** `85ee1114a2177cdf20faf85edeefc7821b3d6bee`, the newest commit when this study was frozen, including fresh lesson-local onboarding actions. Captured from a `git archive` of that revision, not the concurrently edited checkout. Later voice selections, scope cuts and commits are not represented. Committed `public/vo` was used without resyncing uncommitted raw takes.

**Start here:** [guided one-clip report](index.html). It shows one video, then reveals timestamped ground truth and the observers' accounts. [Structured evidence table](evidence.json), [capture/event manifest](out/manifest.json), [validation](out/validation.json).

## Main result: detection is not understanding

The three independent role passes usually detect projectile origins, but disagree about action causes and fail to reconstruct important state changes. High threat-detection scores must not conceal this:

* **D, 10.05 and 16.67 s:** real Writ-caused left/right boss pod breaks, followed by core exposure. All three accounts miss the causal chain and say the player is not firing. One confidently recommends fixing a timer. Ground truth disproves that diagnosis: do not turn it into a code ticket.
* **E, 1.47 / 3.49 / 5.50 s:** three life losses, not one-hit death. Observers miss the sequence, despite hull being present in DOM and small cells. The persistent install/offline control occupies the hull's top-right region. Positive graze/lock commentary competes with damage and failure.
* **C, 20–25 s:** concurrent assistant and radio speech is difficult to separate. Combined audio-source ratings are 2/1/2. The audio-only ablation independently identifies speech masking without any subtitle to read. This is evidence of interference, not merely a mix preference.
* **F versus H:** the calm desktop hangar is readily understood. In the full 390×844 viewport, text remains readable but the inspector and bottom control legend disappear outside the visible frame. Readable letters are not the same as usable information architecture.

## Five changes, before adding effects

1. **One speech owner:** share a priority queue across radio, assistant and boss; defer lore and cancel stale praise on damage/death.
2. **Protect survival information:** move install/offline chrome away from hull, expose readable remaining lives, and remove competing HUD motion at damage transitions.
3. **One causal action confirmation:** consolidate scan/intel/disarm/codex receipts and show the actual affected part/state. Make Writ → pod loss → core opening readable before adding VFX.
4. **Consolidate reading:** preserve subtitle word spacing, remove or enlarge essential moving tags, defer nonurgent codex/radio reading; stack the narrow hangar inspector.
5. **Actionable tutorial state:** show the current resolved binding and release/repress requirement, with a visible focus state and less hitbox-obscuring bloom. Do not imply an unvoiced correction was spoken.

### Proposed attention budget

This is a testable initial design constraint, not an unexplained universal law:

* **One urgent threat cue:** E's missing three-loss account argues for reserving attention for survival rather than permanent utility chrome and congratulation.
* **One action confirmation:** C's sampled lock-to-clean-kill transition is only about 0.18 s, and D's consequential part changes are missed. One compact target-linked receipt should replace several scattered notices.
* **One main speech priority:** C's audio-only result supports serializing intelligible speech, not making all voices louder. Required instruction or the current salient character owns speech; critical nonverbal survival feedback remains available.
* **Deferred lore/toasts:** file detail for a lull or pause. Calm F works; combat reading competes across subtitles, left radio, top codex, and moving labels.

The intended reduction is fewer simultaneous demands, not a prescribed percentage of glowing pixels. The read-only QA probe is a useful observability boundary; independently triggered feedback pipelines without a shared attention arbiter are the architectural issue to investigate.

## Captures and coverage

| Neutral ID | Actual sequence | Viewport | Length |
| --- | --- | --- | --- |
| A | Quiet sector-1 combat, first disarm/lock, later radio and pickup | 1280×720 | 24 s |
| B | Dense sector-4 combat, crossfire, scan and overlapping radio/assistant | 1366×768 | 34 s |
| C | Sector-2 scan → lock → Writ outcome, dense speech and pickup | 1280×720 | 32 s |
| D | Boss, two pod breaks and core exposure | 1366×768 | 27 s |
| E | Player hit/life losses with praise, subtitle, codex and game over | 1280×720 | 9 s |
| F | Calm hangar, weapon inspector → sensor inspector | 1280×720 | 18 s |
| G | Wrong horizontal input, held focus before lesson, release and fresh focus | 1366×768 | 58 s |
| H | Actual narrow hangar viewport, not a crop | 390×844 | 16 s |

These are wall-clock recordings played at 1×, with no accelerated URL or accelerated media. Auto-play uses `speed=1`. A browser-side timer paces its frame-dependent stepping to prevent an uncapped Metal renderer from accelerating the simulation. Measured active median is about **49.18 simulation ticks/s**, slower than the nominal 60. E and G use normal input timing, about 60.11 ticks/s. This makes the recorded workload easier/slower than an ideal 60-tick combat run, not faster. No performance claim about physical Chromebooks follows from a viewport size on this Mac.

The isolated archive was built directly with Vite into `out/build` and served on a private ephemeral port. Existing `qa/av.ts` speaker taps record and mux sound. Every delivered clip has an ffprobe audio stream and finite, nonsilent ffmpeg `volumedetect` output (`out/<ID>/ffprobe.json`, `audio-verification.txt`). Separate stems, source starts, subtitles, input records, page errors and sampled event logs are retained. Timestamps are clip-relative, sampled about every 180 ms; browser recording epoch and model temporal sampling add uncertainty, so do not use these as subframe sync measurements.

**Coverage shortfall:** E has player-hit + speech/subtitle + codex + HUD competition, but does **not** contain a visible radio box at the fatal hit. B/C cover radio overlap separately. The exact requested all-at-once radio-box/hit/codex condition remains to be replicated through real inputs. Do not claim full coverage. No old 30-moment clips were used, and no phone gameplay-control implementation is inferred from H.

## Judging method and canary audit

`judge_study.py` adapts the existing `omni-judges/judge.py` request mechanism, retaining mandatory `provider.zdr=true` and `data_collection=deny`. Live model and ZDR catalogs were fetched and saved before selection. The selected native audio+video model is `google/gemini-4-argon`; requests report Google as provider. Its ability to hear these uploads is evidenced by the black-picture audio-only pass correctly transcribing real lines, not by assuming every video-capable model hears audio. API token accounting labels these inputs as video tokens.

Three fresh, stateless requests receive the same neutral A–H sequence IDs and different roles: novice survivor, information-design/accessibility critic, audiovisual-causality critic. No scripts, external captions, expected mechanic names, input records, production explanations or event ground truth are included. The role prompts ask for ordered events, threat origin, action/response links, resource changes, heard words, actually readable text, uncertainty, simultaneous channels and five task-oriented ratings. Native pixel dimensions are preserved in upload; the model's internal frame sampling is not under our control. A single request contains all eight scenes, so scenes within a role are not independent trials.

Capture engineering inspected logs to validate coverage. **The judges did not receive them.** Their accounts were generated before the post hoc comparison in `evidence.json`; this is observer blinding, not double-blind human research. Same model, independent judging passes: **not three-model consensus**. No score averages or statistical prevalence estimates are offered.

Additional fresh requests judge C and G as audio-only (black picture, unchanged audio) and picture-only (unchanged picture, no audio). Raw responses and exact role prompts are under `out/judgments/`.

### Observer failures retained, not silently corrected

* **Silent correction canary, G 4.04–7.43 s:** wrong-way corrective text is visible, but the VO stem has zero audible speech and no corrective VO source starts. Novice and causality passes nevertheless claim to hear the exact sentence. The audio-only pass does not report it. Their G audio scores cannot certify that line. This is direct cross-modal leakage.
* Information-design pass invents firing at G 52–57 s. No fire input was sent; other passes correctly see no bullets. The intentional idle tail is not proof of a user unable to fire.
* D's absent-damage/timer explanation and E's one-hit explanation are rejected against events.
* Novice F mislabels a beneficial lock-time delta as red; other passes and the frame show cyan/green. Do not reverse correct comparison semantics based on that recommendation.
* Some reported HUD numbers, timestamps and frame dimensions differ from captured data. Use the manifest for dimensions and events, not the model's numerals.

The G audio-only pass follows the lesson more easily than C, while G picture-only cannot verify the focus state. In C, picture-only finds threats but not precise action rules, and audio-only cannot locate threats and suffers overlapping speech. Combined is not universally worse than either alone: picture supplies threat location, speech supplies context, but simultaneous speech interferes and subtitles can manufacture false confidence. These are qualitative contrasts, not controlled human effect-size measurements.

## Spend and policy

| Call | US$ |
| --- | ---: |
| Initial novice response, truncated, retained and excluded from final ratings | 0.146654 |
| Fresh novice pass | 0.096098 |
| Information-design pass | 0.101634 |
| Causality pass | 0.127058 |
| Audio-only C/G pass | 0.042958 |
| Picture-only C/G pass | 0.034314 |
| **Total** | **0.548716** |

All six calls are logged in `research/SPEND.md`. Initial novice raw response is now `out/judgments/novice-truncated.json`; its original ledger path predates that rename. No data-policy relaxation, non-ZDR fallback or paid generation was used.

## Validation and reproducibility

```
deno run -A --no-lock capture.ts
python3 prepare.py
uv run --script judge_study.py novice
uv run --script judge_study.py information
uv run --script judge_study.py causality
uv run --script judge_study.py audio
uv run --script judge_study.py picture
python3 report.py
deno run -A --no-lock validate_report.ts
deno check --config deno.study.json --no-lock capture.ts validate_report.ts
```

Run the commands from this folder after restoring the frozen archive and isolated Vite build. Judge commands are paid and create new calls; existing responses are sufficient to rebuild the report without spending again. Capture deliberately omits game actions after focus; the filename alone is not a passing assertion. Media and the snapshot/build are ignored by git, but retained locally.

`report.py`: **PASS**, eight native-resolution AV clips under 60 s, 24 complete role/clip accounts, four ablation accounts, no page exceptions, budget reconciliation and artifact links validated. `out/validation.json` records limitations rather than hiding them. Browser report traversal also passes: hidden evidence, timestamp playback, ablation switching, native source dimensions, and narrow report layout (`out/report-traversal.json`). Type checking passes with explicit browser DOM libraries in `deno.study.json` (`out/typecheck.txt`); the repository's default configuration excludes research files, so its first check did not inspect these scripts.

Frozen-source `qa:static` report: [out/qa-static/index.html](out/qa-static/index.html), [summary](out/qa-static-summary.txt). **29 pass, 7 warn, 2 fail, 0 pending.** Failures are `coverage.vo.files` (450 raw takes absent from archive) and `assets.vo.cuesComplete` (65 script lines absent from committed cue metadata). The read-only archive excludes uncommitted/untracked raw WAVs, so this is not a claim that the working checkout has lost 450 files. The playable clips load committed Opus audio. A/B/G capture VO checks also flag intentionally unvoiced text windows; D's source capture warns at −13.2 LUFS. All retained warnings/failures concern this frozen evidence, not newer builds.

## Limitations and next step

AI judges are not human usability tests: they may inspect detail a novice cannot, invent input actions, mistake subtitle reading for hearing, and overrate readability. Roles do not simulate lived disability or novice motor demands. Audio-only and picture-only ablations are different viewing tasks, not randomized participant conditions. Browser playback on a Mac is not low-end Chromebook performance validation. The 49-tick autopilot recordings, lack of a controller overlay for the blind observers, source-epoch uncertainty, short clips and partial all-channel overlap limit conclusions.

Next: implement no game changes from this document yet. First agree on the five reductions, reproduce the complete hit/radio/codex overlap, then compare the same recorded event chain before/after with the same blinding and canary. Recruit actual first-time players, including Chromebook users, for action-based comprehension and recovery testing.
