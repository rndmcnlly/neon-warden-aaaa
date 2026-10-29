# Trilingual VO pipeline proof of concept (October 28, 2026)

## Framing question

Can we render editable, over-acted voiceover for Neon Warden AAAA in English,
Spanish, and Mandarin Chinese entirely on Adam's M3 Max, with one consistent
voice per character across all three languages, subtitle timing derived from
the rendered audio, and cheap regeneration whenever a line changes?

Disciplines in play: speech synthesis (engine selection, voice cloning),
localization (translation register), build systems (content-hash caching), and
evaluation methodology (listen-free proxies versus human casting authority).

## Short answer

Yes, at proof-of-concept quality. **Qwen3-TTS through `audiocpp` on Metal**
rendered 3 lines x 3 languages in about 45 s for 83 s of audio. A Qwen3-ASR
round trip recovered every clip at 0.80–1.00 similarity. Adam has not listened
yet, so casting and acting quality are unjudged.

## Files

- Script as data: [`vo/script.yaml`](../../vo/script.yaml), with a `speakers`
  casting record (design prompt, anchor line, seed) plus `lines`
  `{id, speaker, scene, direction, en, es, zh}`.
- Renderer: [`vo/render.py`](../../vo/render.py), a single-file
  `uv run --script` (deps: pyyaml, soundfile, numpy).
- Voice anchors: `vo/voices/<speaker>.wav` plus a `.json` request record.
- Output (clone mode): `vo/out/<lang>/<id>.wav`, `.json` (request, hash,
  duration, peak), `.vtt`; `vo/out/cues.json`.
- Comparison output (design mode): `vo/out-design/...`, same shape.

## Options considered

| Option | Identity across languages | Acting control | Status here |
|---|---|---|---|
| **A. Qwen3-TTS design-then-clone** (VoiceDesign creates an anchor once, Base clones it per line and language) | Strong: the anchor recording is the identity | Weak: Base clone does not consume `instruct`, so delivery comes from the anchor's style, the punctuation, and the seed | **Chosen default** (`--mode clone`) |
| **B. Qwen3-TTS VoiceDesign per line** (character description plus the line's direction) | Weak: each line is a fresh design | Stronger, since the direction actually reaches the model | Tried (`--mode design`) for comparison |
| **C. Breeze TTS 2 on MLX** (reference plus instruction) | Good in the September 8 tests | Best tested: whisper and laughter directions worked | Not tried. Its outputs are restricted to research and non-commercial use, and its language coverage beyond English and Mandarin is unverified (Spanish unknown). See `generative-media-router/engines/breeze-voice-workflow.md` |
| D. Other audiocpp families in the catalog (IndexTTS2 with emotion reference, CosyVoice3, Fish S2 Pro / Fish Drama3) | Varies | IndexTTS2 has separate emotion and timbre conditioning, which is exactly what over-acting wants | Not installed. Worth a later bake-off, especially IndexTTS2 for Chinese and English. Spanish support needs checking |
| E. Hosted (DeepInfra, Gemini TTS, ElevenLabs) | Good | Good | Excluded: paid cloud TTS needs Adam's approval |

Qwen3-TTS won because it was already installed (the GGUFs are at
`~/Code/bbb-artifact-tour/audio.cpp/models/`, from the Big Buck Bunny tour), it
officially covers zh, en, and es among its 10 languages, and cross-lingual
cloning needs no extra training.

## What was actually tried

1. **Casting**: VoiceDesign (`--task vdes`) created three anchors from
   English design prompts (seeds 11, 22, 33). It took 26.3 s for all three
   (8.96–12.4 s each), with peaks of 0.44–0.66 and no clipping.
2. **Clone render** (`uv run vo/render.py`): 9 requests in one model session,
   44.8 s wall for 82.6 s of audio. Per-request RTF was 0.39–0.67, and
   English ran slower (about 0.63) than Spanish and Chinese (about 0.42).
   The total command, including uv and the cast check, took 74 s.
3. **Cache**: the rerun printed "all anchors current / all lines current" and
   rendered nothing. The hash covers mode, text, language, direction, the
   speaker's cast hash (design + anchor + seed + model), the seed, and the
   model file. Recasting a speaker therefore invalidates that speaker's lines,
   and only those.
4. **ASR round trip** (`--asr`): Qwen3-ASR 0.6B Q8_0 via audiocpp (installed
   today, 1.15 GB, same models directory). It runs with a language hint and
   **without the script**, then compares with difflib (words for en/es,
   characters for zh). That comparison is not WER.

| Line | en | es | zh |
|---|---|---|---|
| tut_move_001 (clone) | 1.00 | 0.91 | 1.00 |
| flash_rain_001 (clone) | 1.00 | 0.90 | 0.97 |
| boss_taunt_001 (clone) | 1.00 | **0.80** | 1.00 |
| tut_move_001 (design) | 1.00 | 1.00 | 1.00 |
| flash_rain_001 (design) | 1.00 | 1.00 | 0.97 |
| boss_taunt_001 (design) | 1.00 | 1.00 | 0.99 |

   Clone-mode Spanish failures that the ASR heard:
   - Warden: "¿A eso le llamas disparar?" became "Hizo lejamas disparar".
   - Narrator: "No volvió" became "No volvería", and the repeated "Lluvia, y"
     was dropped.
   - Tutorial AI: "presionaste" became "presiona".

   The zh 0.97 is a 他/她 homophone, which ASR cannot resolve: an artifact,
   not a speech error.
5. **Identity proxy**: median F0 (librosa pyin), plus pitch spread in
   semitones. Pitch is a weak stand-in for timbre, but cheap and listen-free.

| Speaker | anchor | clone en / es / zh | design en / es / zh |
|---|---|---|---|
| narrator | 73 Hz | 76 / 77 / 76 | 111 / 91 / 74 |
| tutorial_ai | 446 Hz | 354 / 441 / 434 | 481 / 449 / 405 |
| warden | 312 Hz | 261 / 298 / 296 | 354 / 269 / 298 |

   Clone mode holds the narrator within 4 Hz across languages, while design
   mode wanders by 37 Hz (about 7 semitones). That is the expected tradeoff:
   B acts and articulates, A stays the same person.

## Caveats

- **Nobody has listened yet.** The Warden anchor's median of 312 Hz is
  suspicious for a "very low pitch" brief. It may be shouting, a pyin octave
  error on a rough voice, or a casting miss. Adam must audition the anchors
  before anything else.
- **Clone mode ignores `direction`.** Over-acting therefore has to be baked
  into the anchor recording, and every line inherits that one register. A
  character who needs several registers (Warden calm versus roaring) should
  get several anchors, one per register.
- Cross-lingual cloning from an **English-only anchor** degraded Spanish
  intelligibility for the gravelly Warden. Anchors per language, or a
  bilingual anchor, could help, at some identity risk.
- VTT cues split sentences in proportion to character count. This is not
  aligned. For real timing, use the Qwen3 forced aligner in audiocpp (the
  `--task align` family is documented but not installed) after reconciling
  ASR against the script.
- Qwen3-TTS weights are Apache-2.0 upstream. Check them before any public
  release; Breeze outputs would be non-commercial.
- One seed per speaker, one take per line. There is no take management yet.
- The models live in another project's directory (`VO_MODELS_DIR` overrides
  it). A shared models location would be cleaner.

## Music cues (brief)

The media router lists local engines for music: Stable Audio 3 on MLX
(licensed-data music and ambience), Foundation-1 (loops and one-shots),
acestep.cpp (songs with lyrics), and YuE2 on audio.cpp. A music-scoring guide
and Ardour handle authored cues. None were run here, and their installation
state was not checked. Stable Audio 3 is the natural first try for the
instrumental logo, tutorial, gameplay, boss, and ending cues.

## Preferred next step

1. Adam auditions the three anchors and the 9 clone clips against
   `vo/out-design/`. Per the casting workflow, design 3–4 candidates per role
   and let him pick by ear.
2. Recast the Warden as needed. Consider two anchors (taunt, roar) and a
   Spanish-language anchor if Spanish stays weak.
3. Add an ASR gate (flag anything below 0.95 for a reseed) and optional
   per-line `seed` overrides in `script.yaml`.
4. If the clone voices sound too flat for the parody, run a small IndexTTS2
   bake-off, since it conditions emotion separately from timbre.

## Status, October 28, 2026 (evening): full render

- `vo/render.py` changes: anchors are locked (identity is the anchor
  sidecar's hash, and the clone reference text comes from that sidecar), so a
  speaker's `design` can be edited without recasting; `--recast <speaker>`
  re-makes one. Per-line `seed` overrides (all languages or per language) and
  a per-line `mode: design` override join the cache hash. New flags:
  `--dry-run`, `--prune`, `--retry-low` (with `--threshold`, default 0.85, and
  `--retry-seeds`, default 3). ASR runs batched, one audiocpp session per
  language (about 0.4 s per clip), and its results live in each take's
  sidecar. The scorer is now accent-insensitive, since Qwen3-ASR drops Spanish
  accents on correctly spoken words.
- The dry run confirmed that the refactor alone rendered nothing: the 12
  existing takes stayed current. `--prune` removed the 9 `flash_rain_001`
  files.
- Full pass: 288 takes in 38 min wall (render RTF 0.79). Total VO is 32.5 min
  across 300 takes (en 9:38, es 12:49, zh 10:02). Mean ASR is en 0.991,
  es 0.924, zh 0.976. Retry reseeded 62 low takes; 49 lines now carry seed
  overrides. Spanish improved the least.
- Pilot's "Keep the money.": 15 clone seeds plateaued (es 0.75, zh 0.55), so
  the line now renders in design mode. That fixes zh. In es the "-se" of
  "Quédense" is swallowed ("Queden con el dinero") in both modes.
- 16 takes are still under 0.85 (15 es, 1 zh). See `vo/out/REPORT.md`.
  Several of these are ASR artifacts, such as zh `warn_narr_001`, a single
  word, "守望者". Others are real slurs: es `bark_lifelost_001` and
  `tut_route_001`.
- Next: Adam listens to the 16 flagged takes and the design-mode Pilot line.
  For Spanish, try a Spanish-language anchor per speaker (a recast, so ask
  first) or small text edits ("Quédate con el dinero" if the Pilot addresses
  one person).

## Wave 3, October 28, 2026 (night): word timing, language anchors, loudness

Framing: subtitles need word-level timing; Spanish needed better ASR (goal:
mean >= 0.95, min >= 0.85); VO should arrive at -18 LUFS, -1 dBTP.

- **Word timing: forced alignment, not ASR timestamps.** Qwen3 Forced
  Aligner 0.6B (q8_0 GGUF, `audio-cpp/audio.cpp-gguf`, 1.1 GB, in the shared
  models dir) aligns the *script* text, so spans never inherit ASR
  mishearings. It is fast: 450 takes in about 60 s, one audiocpp session via
  `--request-sequence` plus `--words-out` (writes `words_<id>.json` per
  request). Word spans in en and es, character spans in zh, 80 ms
  resolution. It drops hyphens and apostrophes ("non-performance" returns as
  "nonperformance"), so `attach_chars` matches on letters and digits only.
  Output is N's `WordTiming { text, charStart, charEnd, startS, endS }`
  (UTF-16 offsets) in each sidecar and in `cues.json`; VTTs now time
  sentences from the words and carry WebVTT inline word timestamps.
  Sanity on all 450 takes: 100% coverage, 0 non-monotonic, 1 out of bounds
  (es `tut_rest_001`, words packed into the last 80 ms: a truncated take,
  which the tutorial_ai recast replaces). The bounds check doubles as a
  listen-free truncation detector.
- **Per-language anchors** (`vo/casting/cast_lang_anchors.py`, index at
  `vo/casting/lang_anchors/<lang>/index.json`). Two methods per speaker, 2
  seeds each, scored by ES ASR on the speaker's 8 worst lines and by median
  f0 against the English anchor:
  - *bootstrap* (Base clones the EN anchor speaking a Spanish line) keeps
    identity but also the accent: warden, scout, authority anchors only
    transcribed at 0.47–0.81.
  - *design* (VoiceDesign from a Spanish-language description of the voice
    as `description` says it sounds) won for warden (test mean 0.715 ->
    0.994), scout (0.588 -> 0.996), authority (0.818 -> 0.972; f0 1.23x EN,
    past the 20% proxy, accepted as still adult male at 122 Hz).
  - bootstrap won for narrator and pilot (already near-native).
  - zh: only the narrator needed one (守望者 heard as "Show wander" on 7 of 8
    seeds); bootstrap_s22 chosen over the ASR-max design for identity.
  Result: every non-tutorial_ai take is >= 0.85 in all languages. ES overall
  0.877 -> 0.935 mean (the tutorial_ai voice is pending Adam's recast; its
  ES anchor should be auditioned from the picked anchor right after). zh
  mean 0.981, min 0.857.
- **Loudness at render time**: gain to -18 LUFS (pyloudnorm, BS.1770), and
  only when that pushes true peak (4x oversampled) over -1 dBTP, a
  latency-compensated `alimiter` on those peaks (up to 4.3 dB on shouted
  lines, about a third of takes). All 450 land at -18.0 to -18.9 LUFS,
  max -1.05 dBTP. A plain-gain first attempt left 104 takes up to 3.9 LU
  quiet, which is why the limiter is there. Measurements are in each
  sidecar and in `cues.json` (`loudness`), with `recipe` so a change
  re-normalizes once.
- Process note: run `--dry-run` before every render. One plain run here
  rendered 150 new takes N had just committed, tutorial_ai included, because
  the cache saw them as stale.
- Next: on Adam's tutorial_ai pick, promote it (vo/casting/README.md), add a
  tutorial_ai entry to `ANCHORS["es"]`, audition, promote, then
  `render.py --speaker tutorial_ai --asr --retry-low`.
