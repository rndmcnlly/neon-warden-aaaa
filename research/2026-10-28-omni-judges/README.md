# Omni judges: models that watch and listen to a QA reel

Disciplines: audio direction and game QA (what "holistic audiovisual
integration" means), ML systems (which models really fuse audio with video),
and research ethics and data governance (ZDR routing for unreleased work).

## Framing question

Which models can take video with its audio track as one input and judge sync,
mix, SFX fit, music fit and polish for our QA reels? Which can we reach on
OpenRouter or fal today? Can we turn that into a per-reel, dogfooded
`qa/judge` stage?

## Finding 0: every existing qa/ reel is silent

Playwright's `recordVideo` records pictures only: every `reel.webm` under
`qa/reports/*/reels/` has a single vp8 stream and no audio (checked with
`ffprobe`). No judge can hear a reel until capture records sound.

Fix, prototyped here as `av_capture.ts` (Deno, reuses `serve` from
`qa/capture.ts` read-only). An init script patches
`AudioNode.prototype.connect` so that any node wired to the speakers is also
wired to a `MediaStreamAudioDestinationNode`. An in-page `MediaRecorder`
encodes that tap to Opus, and ffmpeg muxes it with the Playwright video. The
offset comes from comparing epoch clocks: page creation against recorder
start, about 0.22–0.27 s. In headless Chromium the AudioContext already
reports `running`, so no input gesture is needed.

## Finding 1: on the skipto paths, VO is mostly dropped (a real bug)

The capture showed that most VO never plays when a reel starts with
`?skipto=`:

- `AudioEngine.play` (`src/audio/engine.ts:180`) returns `null` when a line's
  buffer is not decoded yet, and only requests it "ready for next time". With
  `skipto`, scenes start before staged preloading reaches their lines, so a
  line is dropped silently and its subtitle still shows.
- Across five captures, `AudioBufferSourceNode.start` ran 0 or 1 times. With
  `autoplay=fight`, it was 0 every time.
- The judged boss take has exactly one audible line (`desc_001`, 9.9–14.9 s
  by `silencedetect`, 5.12 s rendered). The other 40 s are digital silence.
- `qa/.build/dist/vo/en/` held only 4 wavs at capture time, against 100 in
  `vo/out/en/`. The build may also be stale.

Music and UI SFX are absent by design: every cue in `public/music/manifest.json`
and every role in `public/sfx/manifest.json` is `null` (picks pending). So
today a judge can only assess VO, sync between subtitles and VO, and the
silence itself. It is still useful: it found the dropped-VO bug on its own.

Handoff (not done here, qa/ and src/ are out of scope): either the Director
should wait for, or warm, a scene's lines before starting it, or `skipto`
should await `loadStage` for that scene. QA should assert
`sourcesStarted >= lines logged`.

## Catalog (OpenRouter, fetched 2026-10-28)

457 models listed; about 60 accept `video`, but most of those see frames only
(Kimi K3.x, GLM 5.x, Qwen3.8 non-omni, MiniMax M3, Seed, Gemma 4). Those
cannot judge sound. The models below claim both audio and video input:

| Model | Joint AV? | Price (in/out per M tokens) | ZDR endpoint | Notes |
| --- | --- | --- | --- | --- |
| google/gemini-4-argon | yes, native (audio track of video is tokenized) | $2 / $10 (flex $1 / $5) | yes (Vertex) | Flagship. Passed the hearing canary. |
| google/gemini-3.8-flash | yes, native | $0.75 / $3.75 (flex $0.375) | yes (Vertex) | Failed the canary (see trial). |
| google/gemini-3.5–3.7 flash, 3.5-flash-lite, 3.1-pro-preview, 2.5-pro/flash | yes | $0.10–$2 in | yes (Vertex) | Older or cheaper Gemini options, untested. |
| qwen/qwen3.8-omni-flash | yes, "native audio-video" | $0.15 / $0.47 | no (Alibaba only) | Blocked by account-level ZDR. |
| xiaomi/mimo-v2.6-pro / flash | audio and video listed | $0.44 / $0.87; $0.14 / $0.28 | not in ZDR list | Untested. Joint fusion unverified. |
| meta/muse-wonder | text, image, video, audio, PDF | $4 / $20 | no | Untested. |
| nvidia/nemotron-3-nano-omni-30b-a3b:free | audio and video | free | no | Free tiers usually log prompts. |
| perceptron/perceptron-mk1.5 | audio and video | $0.15 / $1.5 | no | Embodied-robotics focus, 36k context. |
| cloudflare/clef-omni | audio and video | ? | yes | Decisions-only model (`/api/alpha/decisions`). Code Mode's `inference.decide` has no video adapter yet. |
| openai/gpt-audio(-mini), mistralai/voxtral-small | audio only | | | Could judge the audio stem separately, but not sync. |

Sending local files: base64 `data:video/mp4;base64,...` in a `video_url`
content part on `/api/v1/chat/completions`. MP4 and WebM are accepted. Vertex
Gemini does not take video URLs, and AI Studio takes only YouTube URLs. A
45 s reel transcoded to 854x480, 12 fps, mono AAC is 1.4 MB. Gemini charged
about 5–6k prompt tokens for it, so input cost is about $0.01/min for Argon.

Account policy: this OpenRouter account enforces ZDR. Any request to a
non-ZDR endpoint fails with `zdr-violation-by-account`, which in practice
means Gemini on Vertex. That is a good default for unreleased work, but it
concentrates judging in one vendor. Using Qwen or MiMo would mean relaxing
the account setting, a decision for Adam.

## Catalog (fal, fetched 2026-10-28)

fal sells generation, not judgment. Its understanding endpoints are thin and
opaque:

- `fal-ai/video-understanding` ($0.01 per 5 s): takes a video URL and a
  prompt. The backend is undisclosed and audio use is unstated.
- `fal-ai/audio-understanding` ($0.01 per 5 s): audio only.
- `fal-ai/qwen3-omni`: the schema exposes text prompts only.

For SFX and music generation, fal is the right shop (prices from each model's
`llms.txt`):

- `fal-ai/mmaudio-v2` ($0.001/s): video-to-audio. Feed it a silent reel and
  get synced foley, a draft-SFX source and a reference for timing. Already
  used in `research/2026-10-28-critique-audio/`.
- `fal-ai/elevenlabs/sound-effects/v2` ($0.002/s): text-to-SFX, best for UI
  roles.
- `fal-ai/hunyuan-video-foley` ($0.10 per 10 s) and `fal-ai/thinksound`
  ($0.001 per compute second): video-to-audio alternatives.
- `fal-ai/stable-audio-25/text-to-audio` ($0.20 per clip): music beds.

## Trial (boss reel, 45 s, real-time, same rubric, 2026-10-28)

Clip: `out/boss-av/reel.mp4` (query `?skipto=boss&seed=121&qa=1`). Rubric and
schema are in `judge.py`. The ground truth: one VO line, no music, no SFX.

| | Gemini 4 Argon | Gemini 3.8 Flash |
| --- | --- | --- |
| VO lines heard | 1, 10.0–15.0 s, verbatim `desc_001` | 5, four hallucinated from on-screen subtitles |
| Music / SFX present | false / false (correct) | false / false (correct) |
| Scores (sync, mix, sfx, music, VO, polish) | 1, 1, 1, 1, 2, 1 | 2, 2, 2, 2, 3, 2 |
| Followed "absent scores 1" | yes | no |
| Diagnosis | "10 of 11 subtitled lines have no audio"; listed each orphan subtitle timestamp | "Assistant subtitles lack audio"; misattributed Warden lines as heard |
| Fixes | Hook up missing VO with timestamps; boss music with per-beat plan; descent, shockwave and bullet SFX; worldize Warden VO as PA or radio; ambient bed for dead air | Similar but generic |
| Cost, wall time | $0.031, 29 s | $0.015, 20 s |

Argon's fifth fix is a genuine audio-direction note, not a checklist item:
the Warden's VO plays dry. Our own reading agrees with Argon: the dominant
defect is missing VO, which is a pipeline bug, not a mix problem.

Lesson: cross-modal leakage is the main failure. A weaker omni model "hears"
what it reads. The VO-transcript canary in the schema detects this
mechanically: diff the inventory against `vo/script.yaml` and the
ffmpeg `silencedetect` spans.

## Proposal: `qa/judge`

1. Capture: give `captureReel` an `audio: true` option that installs the
   connect-tap init script and muxes `reel.mp4` (video and Opus/AAC). Keep
   `reel.webm` for the dashboard.
2. Ground truth, free and local: ffmpeg `silencedetect` and `ebur128`
   (integrated LUFS, true peak) per reel, plus the qa probe's `line:` log and
   `sourcesStarted`. These become ordinary pass/fail checks: dropped VO
   becomes a `fail` without any model.
3. Judge, paid and opt-in: `deno task qa:judge <reel>` posts the 480p MP4 and
   the rubric to `google/gemini-4-argon` with `provider.zdr`, and writes
   `reels/<id>/judge.json` (schema in `judge.py`: inventory, six 1–5 scores
   with timestamps, five fixes tagged by discipline).
4. Canary gate: compare the judge's `vo_lines` with the probe log and the
   silence spans (matching start within 1 s, transcript similarity against
   `script.yaml`). If it fails, mark the judgment `untrusted` and show it
   greyed out on the dashboard.
5. Context: pass a production note (for example "music and UI SFX picks are
   pending") through `--context`, so scores separate "absent by plan" from
   "broken". The trial ran blind on purpose, to test the canary.
6. Spend: about $0.04 per minute of reel with Argon, so all 11 reels cost
   about $0.30 per run. Append each run's `usage.cost` to SPEND.md
   automatically.

## Files

- `av_capture.ts`: Deno sidecar that records reel video and game audio and
  muxes MP4 (`deno run -A --no-lock research/2026-10-28-omni-judges/av_capture.ts "<query>" <seconds> <outdir>`).
- `judge.py`: `uv run --script` judge (OpenRouter, base64 MP4, strict JSON
  schema, `--zdr`, `--context`).
- `out/boss-av/judge-google_gemini-4-argon.json`,
  `out/boss-av/judge-google_gemini-3.8-flash.json`: trial outputs.
  `meta.json` holds capture diagnostics. Media is gitignored.

## Status and next steps

- Done: catalog scan, capture prototype, two-model trial ($0.046 total on
  OpenRouter).
- Not tried: Qwen3.8 Omni and MiMo (ZDR-blocked), clef-omni through the raw
  decisions API, and a reel that actually contains music and SFX. Rerun the
  trial once the music and UI SFX picks land, ideally with a deliberately
  desynced copy (shift audio +300 ms) to test whether Argon catches sync
  errors and not just absence.
- Next: fix the VO preload race (Finding 1), then fold steps 1–2 of the
  proposal into qa/. Both are integration work for whoever owns qa/ and the
  audio engine.
