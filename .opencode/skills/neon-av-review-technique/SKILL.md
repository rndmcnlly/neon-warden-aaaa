---
name: neon-av-review-technique
description: Use for silent QA captures, blinded audiovisual intelligibility or creative review, and assessing what footage cannot establish.
metadata:
  opencode/autoinvoke: false
---

# Review what actually reached eyes and ears

## When to use

Before paying a judge, diagnosing a perceptual failure, or presenting review clips.
All paths below are repository-root-relative. Domestic workflow, informed by the
project's capture and observer failures, not a universal model ranking.

## Shortest workflow

1. Define one question and event chain, not “is it AAA?” Freeze revision, dirty
   overlays and asset choices with timestamps/hashes. Use an isolated archive
   when active workers make the checkout unstable. Do not resync absent raw VO
   into an archive and accidentally change the captured public assets.
2. Use the canonical reel/capture, audio-tap and judge interfaces in
   `qa/README.md` (`qa/capture.ts`, `qa/av.ts`, `qa/judge.ts`, `qa/ab.ts`).
   Start with `deno task qa:list`; run the focused reel. A Playwright video alone
   is silent. Verify an audio stream **and nonsilent content**, actual voice
   source starts and intended music/SFX. Preserve final speech tails before flush.
3. Record viewport, quality/input mode, frame/tick pacing and timestamp uncertainty.
   Browser background throttling can change timing: foreground performance tests
   or measure actual pacing. Never infer Chromebook speed from a Mac viewport.
   Use native target resolutions, including real portrait layout, not desktop crops.
4. Consult current model/endpoint discovery via the existing judge transport and
   saved catalog procedure in `research/2026-10-28-omni-judges/README.md`.
   Keep ZDR/data policy; no silent fallback. Check budget and log paid calls in
   `research/SPEND.md`. A historical winner is not permanently the best model.
5. **Blind reconstruction first:** neutral clip IDs, no mechanics/script/events
   or production explanation. Ask ordered events, threat origins, action→response,
   resources, heard words, readable text and uncertainty before scores/advice.
   Then compare with separately retained inputs, events, stems and script.
6. Test hearing with audio-only/black-picture and picture-only ablations when
   subtitles could leak answers. Reject claimed speech in silent windows, even
   if quoted perfectly. Multiple roles using one model are independent **passes**,
   not diverse-model consensus or human participants.
7. Make a focused guided viewer: one clip at a time, timestamped evidence revealed
   after watching, clear next/previous, limitations. Not 30 competing players.
   Preserve correct uncertainty; turn corroborated defects into proposed tests,
   not implementation tickets based on an observer's guessed cause.

## Interpretation pitfalls

- Detection is not comprehension: require the observer to connect Writ→pod loss
  →core exposure and reconstruct life losses, not merely notice bright threats.
- Initial attention-budget hypothesis: one urgent threat cue, one causal action
  receipt, one main speech owner; defer lore/toasts. Test it, do not present it
  as an established universal numerical budget. Don't solve every miss with VFX.
- Video cannot establish human control feel, motor accessibility, low-end hardware
  performance, unseen endings or a complete pacifist run. Recruit hands-on players.
- Perceptual absence is not code absence. Existing ducking can be inaudible;
  wrong causal diagnosis must not erase a genuine observed defect.

## Evidence and cultivation log

- Observed failure/win: `research/2026-10-28-omni-judges/README.md`, Finding 0
  and trial: silent Playwright output; real audio tap exposed dropped VO.
- `research/2026-10-28-intelligibility/README.md`, frozen `85ee111`: D observers
  missed real pod breaks; G observers “heard” silent corrective subtitles.
  Audio-only ablation rejected that false hearing. Native H exposed narrow layout
  loss. Event truth and audio ablation were exercised, not merely proposed.
- `research/2026-10-28-argon-creative-review/README.md`, artifact commit `2ca039f`,
  code `ad32043` plus three documented audio overlays: source inspection rejected
  “add ducking” and repeated-flashback diagnoses. Capture slowed combat 12–13%.
  Seven clips had zero page exceptions, but D failed VO coverage: not all-green QA.

## Success criteria

Verified audible media, revision/asset provenance, blind account before truth,
timestamped corroboration, explicit rejected claims and coverage limits. Any
recommended change has an authorized next test, not automatic implementation.
