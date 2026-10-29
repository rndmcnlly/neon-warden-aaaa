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
