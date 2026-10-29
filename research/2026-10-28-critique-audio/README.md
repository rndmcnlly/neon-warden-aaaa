# Audio direction critique: SFX, UI sound, music, mix, VO

Author: game-audio-director subagent, October 28, 2026. Read-only critique: no
code, `sfx/`, `music/` or `vo/` edits. Disciplines in play: sound design,
music systems (interactive and quantized audio), mix engineering (loudness,
ducking), production pipeline design, and pedagogy (students will read this).

## Framing question

Neon Warden has a clean, file-driven UI sound pipeline (`sfx/`), a music
pipeline (`music/`), and a VO pipeline (`vo/`), all local Stable Audio 3 (SA3)
or local TTS. It has **no gameplay SFX at all**, no promoted UI picks
(`sfx/picks.json` is all `null`), no promoted music (`public/music/manifest.json`
is all `null`), and a mix with one rule (voice ducks music by about 9 dB,
`src/audio/ducker.ts`). What should the game sound like, where should the
gameplay sounds come from, and what mix rules make it legible?

## Evidence: what premium games do (cited)

- **Rez, Tetris Effect (Mizuguchi): SFX as music.** In Tetris Effect "every
  time you rotate a piece you hear a harmonised note or sound, quantised to the
  beat (making it sound like you're playing in time to the music, even if your
  input is slightly off)", and line clears land chords that grow with the
  clear ([Singer](https://www.nicholassinger.com/blog/tetriseffect);
  [Meta interview](https://www.meta.com/blog/a-chat-with-the-team-behind-vr-puzzler-tetris-effect/)).
  In Rez the lock-on impacts "automatically sync with the background track"
  ([Wikipedia](https://en.wikipedia.org/wiki/Rez_(video_game)); see also
  [Mizuguchi interview](https://wccftech.com/interview-tetsuya-mizuguchi-synesthesia-tetris-effect-rez-lumines/)).
  Key detail: the quantized sounds are *rewards and confirmations*, never the
  only feedback for an input that needs to feel instant.
- **Hi-Fi Rush: an "Inst FX" tool** delivers "a suite of musical sound effects
  when the player or enemies attack and connect their hit … like what the
  player did … added to the song" ([Guardian](https://www.theguardian.com/games/2023/mar/10/hi-fi-rush-fresh-take-on-the-rhythm-game-player-drives-the-music-));
  animation authored at 120 BPM and retimed ([GameAnim](https://www.gameanim.com/2023/09/08/hi-fi-rush-music-synced-animation/));
  GDC talk ([Vault](https://gdcvault.com/play/1034256/Developing-Hi-Fi-RUSH-Backwards)).
  Lesson: a beat grid is infrastructure, not a per-sound trick.
- **Thumper:** "rhythm violence", where audio cues are the warnings you read
  at speed ([Game Developer](https://www.gamedeveloper.com/audio/why-i-thumper-i-s-twist-on-rhythm-games-is-so-well-suited-for-vr);
  [Noclip](https://www.youtube.com/watch?v=to0s52kbcFo)). Lesson: threat
  sounds can be in the music's language and still be unmistakable.
- **DOOM (2016):** weapons and impacts built from layered, slightly distorted
  metal ("It had to be chunky"), then layered, mixed and mastered in a DAW
  ([ADSR Q&A with Carney and Mossholder](https://www.adsrsounds.com/news/the-sound-design-of-doom-exclusive-qa/);
  [Siege talk](https://www.youtube.com/watch?v=4J4d-rjMtXw)).
- **Destiny:** one systems team owns "weapons, abilities, and general UI
  year-round" ([Inverse, Juan Uribe](https://www.inverse.com/gaming/destiny-2-sounds-lorentz-driver-stasis);
  [ViDoc](https://www.youtube.com/watch?v=D5-P9emLQrI)). Lesson: UI and weapon
  sounds cohere when one family brief and one owner cover both.
- **Hades:** players report that bosses' distinct vocal tells 1–2 s before an
  attack make the fights easier ([r/HadesTheGame](https://www.reddit.com/r/HadesTheGame/comments/1cvnkzj/sound_design_makes_fights_easier/);
  [Korb interview](https://www.thesoundarchitect.co.uk/tsap-s04e01/)). The
  Warden's tantrum should telegraph.
- **Mix hierarchy:** DICE's HDR audio makes soft sounds drop out when loud
  ones play and return when alone ([Designing Sound](https://designingsound.org/2013/06/21/finding-your-way-with-high-dynamic-range-audio-in-wwise/);
  [Audiokinetic](https://www.audiokinetic.com/en/community/blog/wwise-hdr-overview-and-best-practices-for-game-mixing/));
  ACE COMBAT 8's "Focus Mixing" picks what matters among music, radio,
  engines and explosions ([GDC 2026](https://schedule.gdconf.com/session/focus-mixing-making-the-right-sound-matter-in-ace-combat-8s-aerial-battles/920965)).
  A tiny priority ladder in Web Audio gets most of this.
- **Loudness:** Sony ASWG-R001 sets -24 (±2) LKFS for home consoles, -18 (±2)
  for portable, true peak at or below -1 dBTP, measured over 30+ minutes of
  representative play ([ASWG-R001 PDF](http://gameaudiopodcast.com/ASWG-R001.pdf);
  [RTW table](https://www.rtw.com/en/blog/worldwide-loudness-delivery-standards.html)).
  Commentators suggest internet-delivered games sit nearer -18 to -16
  ([Anso Audio](https://ansoaudio.com/2016/07/27/loudness-and-metering-in-game-audio/)).
- **Variation:** random pitch on repeated sounds is the cheapest anti-fatigue
  tool ([Game Developer](https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting));
  control repetition, randomization and frequency bands together
  ([A Sound Effect](https://www.asoundeffect.com/game-audio-immersion/)).
  Stacking too many layers on one frame flattens impact rather than adding it
  ([video](https://www.youtube.com/watch?v=jTTkUFb8hx8)).
- **Shmup readability:** graze is "a sharp pop/crackle" in Touhou, tiny and
  rate-limited (already cited in `research/2026-10-28-gameplay-microsystems/`).
  Genre practice (from that note and CAVE-style design docs,
  [Boghog 101](https://shmups.wiki/library/Boghog%27s_bullet_hell_shmup_101)):
  the player's own fire is quiet and constant, enemy fire is sparse and
  distinct, and danger is never masked by reward.

## Objective analysis of our assets

Scripts: `scratch/analyze.py` (librosa, pyloudnorm; output `scratch/stats.json`),
`scratch/fal_test.py`. No audio was listened to; these are numbers only.

### SA3 UI candidates (`sfx/candidates/index.json`, 16 roles x 6)

- 96 candidates; flags: 13 `noisy` (spectral flatness above 0.45), 8
  `clipped`, 10 `truncated`, 7 `peak_limited`.
- The failures cluster in the shortest, most "clicky" roles: `slider_tick`
  (target 50 ms) is 6/6 truncated and 5/6 noisy with median flatness 0.54;
  `toggle_off` is 3/6 clipped and 3/6 noisy with a median natural length of
  998 ms against a 140 ms target; `focus` and `tab_switch` 2/6 noisy each.
- Tonal roles do well: `locked` (flatness 0.04), `back` (0.06), `confirm`
  (0.13), `error`, `menu_open`, `pause_in` have zero flags.
- **SA3 foley tendency:** SA3's training data is library audio (AudioSparx
  plus Freesound, per `music/README.md`), so tiny clicks come out as
  noise-burst foley (paper, switch, static) instead of designed synthetic
  ticks. The higher the transient-to-tone ratio a role needs, the worse SA3
  does. That argues for synthesizing the tiny tonal ticks (focus,
  slider_tick, toggle) in Web Audio and keeping SA3 for textured roles.

### Music candidates (`music/candidates`, 8 cues x 2)

| cue | briefed BPM | estimated BPM (take 1 / 2) | raw LUFS | centroid (Hz) |
| --- | ---: | --- | --- | --- |
| logos | 90 | 89 / 89 | -11.2 / -10.9 | 3500–3700 |
| menu | 80 | 108 / 108 | -13.0 / -12.8 | 1200–1800 |
| tutorial | 110 | 144 / 112 | -13.0 / -12.5 | 2300–3700 |
| gameplay | 128 | 129 / 129 | -12.1 / -13.1 | 2500–3000 |
| flashback | 70 | 70 / 144 | -12.8 / -11.7 | 700–750 |
| boss | 140 | 70 / 144 | -13.1 / -10.0 | 1900–2000 |
| ending_kill | 60 | 118 / 60 | -10.9 / -11.5 | 700–1100 |
| ending_pacifist | 72 | 72 / 72 | -14.0 / -13.8 | 740–970 |

- Tempo estimates are octave-ambiguous (70 vs 140 is half time, not wrong),
  but menu and tutorial take 1 are plausibly off-brief. **SA3 does not
  reliably honor a BPM tag**, so any beat-quantized SFX must use a tempo
  *measured and verified at promote time*, not the brief's number.
- Raw true peaks reach +2.8 dBTP (logos); `promote.py` re-normalizes to -16
  LUFS, but it should also true-peak limit, or the overs survive into Opus.
- Gameplay music's spectral centroid (2.5–3.0 kHz) sits right where a player
  shot lives (ElevenLabs fire: 3.3–4.2 kHz): a masking risk. Gameplay SFX
  should put their identifying transient above 4 kHz or below 300 Hz.
- Every take but the gameplay ones ends in silence or a fade (first and last
  50 ms differ by 60–170 dB); loops need seam work as `music/README.md` says.

### VO (`vo/out/{en,es,zh}`, 100 lines each)

| lang | median LUFS | range | max true peak |
| --- | ---: | --- | ---: |
| en | -22.2 | -27.6 to -15.3 | -0.5 dBTP |
| es | -22.2 | -26.6 to -12.6 | **+2.6 dBTP** |
| zh | -22.7 | -26.5 to -16.1 | **+0.9 dBTP** |

Medians agree across languages within 0.5 LU (good: switching language does
not change the mix), but the per-line spread is 11–14 LU, and ES and ZH have
inter-sample overs. Per-line normalization to a dialog target is missing.

### Player fire cadence

`PLAYER.fireInterval` is 7 ticks at 60 Hz = 116.7 ms = 8.57 shots per second,
which is exactly a sixteenth note at 128.6 BPM. The gameplay cue measures
129 BPM. The stream is already almost on the grid: a signature waiting to
be switched on.

## (1) Audio direction statement

Neon Warden sounds like a contract being executed by an expensive machine:
clean, glassy, synthetic transients over sub weight, every sound in the key
of the current cue, nothing retro or chiptune. Sounds come in **two layers**.
The *feel* layer (the crack of your shot, the thud of a hit you take, a
deflection) plays the instant it happens, because a shmup's input must never
wait. The *music* layer (the tonal tail of a kill, part breaks, pickups, the
pay-rate tick, grazes, sector clears) is pitched to the cue's scale and
**quantized to the next sixteenth of the music**, Rez and Tetris Effect
style, so competent play sounds like the score answering back. The player's
stream is phase-locked to the beat grid (its cadence already is a sixteenth at
128 BPM), mixed low and short so it reads as a hi-hat, not a drill. Enemy fire
is sparse, low, and outside the scale, so danger is the one thing that never
sounds musical. The Lane Authority speaks in the corporate-pleasant major
mode of the UI; the Warden's sounds are high, furious and off-key, a tantrum,
not a growl. In a pacifist run the grazes carry the melody, so restraint has
a sound. Yes, quantize: it is the signature, and it is cheap because the
cadence is already aligned.

## (2) Gameplay SFX generation plan

### Sources compared (prices from each model's `llms.txt`, October 28, 2026)

| Source | Price | Strengths | Weaknesses |
| --- | --- | --- | --- |
| Local SA3 `sm-sfx` (MLX) | free | deterministic seeds, cached, fits `sfx/render.py`, good textures | foley/noise bias on tiny ticks; 1 s minimum render; clipping flags |
| fal **ElevenLabs SFX v2** (`fal-ai/elevenlabs/sound-effects/v2`) | $0.002/s | honors duration exactly (0.5–22 s), sharp attacks, tonal, `loop` option, PCM 48 kHz output | no seed (not reproducible: cache raw output), level varies about 35 dB across briefs, stereo |
| fal **MMAudio v2** (`fal-ai/mmaudio-v2/text-to-audio`) | $0.001/s | cheapest, seedable, negative prompt | 1 s minimum, slow attacks, over 0 dBTP, MP3 output; tuned for video foley |
| fal Stable Audio 2.5 | $0.20/clip | music quality | 100x the per-clip cost of ElevenLabs for a 1 s SFX |
| fal CassetteAI SFX | $0.01/gen | fast | integer seconds only |
| fal Hunyuan Video Foley, ThinkSound | $0.01/s, compute | video-to-audio | wrong input type for us |
| Web Audio synthesis | free, 0 bytes | infinite variation, sample-accurate quantization, scale-locked pitch | needs design time; weak at organic texture (debris, roars) |

**Recommendation:** a hybrid. Synthesize the *music* layer and tiny ticks in
Web Audio (oscillator plus filtered-noise envelopes: about 150 lines of
TypeScript, legible to students). Generate the *feel* and *texture* layers
with ElevenLabs SFX v2 through the existing pipeline (add an `elevenlabs`
engine to `sfx/render.py` that caches raw responses by input hash, which
gives back the reproducibility the model lacks). Keep SA3 as the free farm
for variations and the fallback. Full gameplay set: about 45 roles x 6
candidates x about 1 s x $0.002 = **about US $0.55**.

### Every gameplay event

Sources: `SimEvent` in `src/contracts/sim.ts`, plus the recommended
micro-systems A–D in `research/2026-10-28-gameplay-microsystems/`. Layers: T =
transient (0–20 ms), B = body (20–200 ms), L = tail (200 ms+); M = musical
synthesized layer, quantized to the next 1/16 unless marked "now". RR = round
robin variants; pitch is a random range in semitones unless scale-locked.

| Event (source) | Sound | Layers and source | Variation | Timing |
| --- | --- | --- | --- | --- |
| `playerFired` (stream) | shot tick, under 60 ms | T synth click plus B EL "laser tap" | RR 3, ±0.5 st, gain -2 dB per extra concurrent | phase-locked to grid |
| aimed round (A) | crack | T plus B EL, brighter | RR 3 | now |
| Writ release 1–3 (A) | rising tiers | B EL plus M chord (root, fifth, octave by tier) | per tier | M on 1/16 |
| capacitor pips, full hum (A) | ticks, hum loop | M synth, scale steps | none | on 1/8 |
| enemy fire `bullet` | soft low "tock" | B synth, off-scale | ±1 st, rate limit 6/s | now (**no event exists**) |
| enemy fire `heavy` | sub thump plus whine | B EL plus T | RR 2 | now |
| `hit` enemy | tick plus spark | T synth | ±1 st | now |
| `hit` boss | metal ping | T plus B EL | RR 4 | now |
| `hit` blocked (deflect) | glassy ricochet | T EL | RR 3 | now |
| `hit` player, absorbed by shield | shield bloom | B EL plus M down-third | none | now |
| `lifeLost` | heavy hit, then music drops | T plus B plus L EL; duck rule | none | now |
| `kill` drone, dart, turret, lancer | small to large pop per kind | T plus B EL per kind, plus M note (scale degree by kind) | RR 3, ±1 st | B now, M on 1/16 |
| `kill` `byRam` | crunch | B EL metal | RR 2 | now |
| part ping, crack, break pop (B) | armored deflect, crack, debris | T EL, B plus L EL, plus M stab | RR 3 | break M on 1/16 |
| disarm sigh (B) | power-down glide | M synth falling glide | none | on 1/8 |
| bullet cancel shimmer (B) | shimmer sweep | M synth noise plus partials | none | on 1/16 |
| `graze` (C) | tiny crackle | T synth, pitch climbs the scale within a streak | rate limit 10/s | on 1/16 |
| rate tick (D) | scale step | M synth | scale-locked | on 1/16 |
| `pickup` spread, shield | arpeggio up, shield chord | M synth plus L EL shimmer | none | on 1/16 |
| `pickup` firstPowerup | tape-stop into flashback | L EL plus music crossfade | none | now |
| `spawn` per kind | arrival telegraph | B EL whoosh, panned to x | RR 2 | now |
| `spawn` warden | descent bed | L EL long sweep | none | Director-timed |
| `despawn` retreat, wiped | retreat whoosh, quiet fizzle | B EL | RR 2 | now |
| `sectorStarted`, `sectorCleared` | sting in, resolve chord | M synth plus L EL | none | on the bar |
| `bossWarning` | alarm, in the hype voice's register | B EL plus M tritone | none | on the bar |
| `bossPhase` 1–3 | Warden roar, servo, phase sting | B plus L EL, pitched up per phase | 2 per phase | roar now, sting on the bar |
| `bossDefeated` | long collapse, then silence | L EL plus a music cut | none | now |
| `bossSurvived` | Warden withdraws, unresolved chord | M synth plus L EL | none | on the bar |
| `gameOver` | power-down | L EL plus music tape stop | none | now |

Gaps: there is **no enemy-fire event**, so the most important readability
sound has no trigger. Add `enemyFired { kind, pos }` to `SimEvent` (or derive
it in the renderer by diffing bullet ids). Positional pan (x mapped to -0.6–0.6)
costs one `StereoPannerNode` per voice.

## (3) fal test: same 4 briefs, 2 models, 2 takes each

Spend: ElevenLabs 11.2 s billed x $0.002 = **$0.022**; MMAudio 13.0 s x $0.001
= **$0.013**; total **about US $0.04** (logged in `research/SPEND.md`). Outputs
in `scratch/fal/`, stats in `scratch/stats.json`, call log in
`scratch/fal/runs.json`. Wall time per call: 3–5 s (one MMAudio call took 15 s).

| brief | model | length (s) | active (s) | LUFS | true peak | attack (ms) | centroid (Hz) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ui_confirm | EL | 0.60 | 0.60 / 0.22 | -30.4 / -25.3 | -10.8 / -12.4 | 0.5 / 5.5 | 7600 / 5600 |
| ui_confirm | MM | 1.02 | 1.02 | -20.4 / -23.7 | -2.8 / -11.4 | 165 / 211 | **955** / 5750 |
| player_fire | EL | 0.48 | 0.48 / 0.19 | -38.4 / -43.3 | -20 / -22 | 0.5 / 2.8 | 3300 / 4200 |
| player_fire | MM | 1.02 | 1.02 | -12.3 / -15.2 | **+1.2** / -2.2 | **957** / 77 | 3000 / 4900 |
| part_break | EL | 1.48 | 1.48 | -11.9 / -10.8 | +0.6 / +0.5 | 225 / 133 | 5700 / 5000 |
| part_break | MM | 1.51 | 0.93 / 1.51 | -16.9 / -13.3 | -2.0 / 0.0 | 402 / 180 | 5100 / 5900 |
| warden_roar | EL | 3.00 | 3.00 | -8.6 / -7.8 | +0.1 / +0.3 | 1403 / 61 | 2000 / 2600 |
| warden_roar | MM | 3.02 | 3.02 | -5.1 / -4.0 | **+2.2 / +1.2** | 2580 / 2204 | 4200 / 2900 |

Reading (attack = onset to envelope peak; lower is punchier):

- **ElevenLabs wins the short, transient briefs**: sub-6 ms attacks on
  confirm and fire, and it stops when the sound ends (active 0.19–0.22 s
  inside a 0.5–0.6 s window), which SA3 and MMAudio cannot do. Its levels are
  inconsistent (fire at -40 LUFS, roar at -8), so our normalizer is mandatory;
  part break and roar exceed 0 dBTP.
- **MMAudio is unsuited to UI and fire**: it fills its 1 s minimum, attacks
  are slow (77–957 ms), one "UI confirm" came out dull (955 Hz centroid), and
  roars clip by up to +2.2 dBTP. It is fine for long textured beds.
- Flatness read 0.0 on MMAudio's MP3s (the encoder's low-pass zeroes high
  bins), so that column is omitted: a measurement artifact, not a finding.
- Not yet heard. Adam should audition `scratch/fal/` against the SA3 UI
  candidates before any decision; the numbers only rank punch and fit.

## (4) Mix targets and ducking map

Program target: **-18 LUFS integrated (±2), -1 dBTP**, after ASWG-R001's
portable figure, because a web game plays on laptop speakers and phones.
Measure it on the QA reels (`qa/reels.ts` captures), per beat, not just once.

| Element | Target | How |
| --- | --- | --- |
| VO, story | -18 LUFS per line (±1), -1 dBTP | normalize in `vo/render.py` (fixes ES +2.6 and ZH +0.9 dBTP) |
| VO, barks and chatter | -20 LUFS per line | same, with a role offset |
| Music files | -16 LUFS, -1 dBTP limited | `music/promote.py` already normalizes; add the true-peak limit |
| Music bus in gameplay | about -22 LUFS short-term | bus gain about -6 dB by default |
| Gameplay SFX | active RMS -20 dBFS plus role gain, like UI | ladder: player hit 0, lifeLost 0, boss roar -2, kill large -4, part break -4, kill small -8, enemy fire -8, graze -14, player stream -14 |
| UI | existing `sfx/manifest.yaml` policy | unchanged |
| Master | `DynamicsCompressorNode` as a safety limiter (threshold -3 dB, ratio 20, fast) | one node before the destination |

Voice caps (HDR-lite): stream shot 3 concurrent, kills 4 (steal oldest), graze
2, enemy fire 4; the priority ladder above decides what gets stolen.

| Trigger | Ducks | Depth | Attack / release |
| --- | --- | --- | --- |
| Story VO (tutorial, flashback, Warden, endings) | music | -9 dB (current `duckedGain` 0.35) | 80 ms / 450 ms (current) |
| Story VO | gameplay SFX bus | -4 dB | 80 ms / 450 ms |
| Barks, chatter | music | -5 dB | 50 ms / 300 ms |
| `lifeLost` | music and other SFX | -10 dB plus 800 Hz low-pass on music | 10 ms / 1.2 s |
| Boss roar, `bossPhase` | music | -4 dB | 20 ms / 600 ms |
| Part break, large kill | music | -2 dB micro-duck | 5 ms / 150 ms |
| Flashback | gameplay SFX bus | -12 dB plus low-pass (the past is muffled) | 300 ms / 1 s |
| Pause | context suspended (existing); UI bus unducked | – | – |
| Enemy `heavy` fire | player stream | -4 dB, so danger reads over your own gun | 5 ms / 200 ms |

## (5) Prioritized top 10

1. **Beat grid**: `music/promote.py` writes `bpm`, `beatOffset`, `key` and
   bar-aligned loop points per cue (beat-tracked, then checked by a person);
   the engine exposes `nextGridTime(division)` on the audio clock.
2. **Two-layer SFX player** in `src/audio/engine.ts`: `play(role, { quantize,
   scaleDegree, pan })` with round robin, pitch range, voice caps and the
   priority ladder.
3. **`enemyFired` event** and distinct, off-scale enemy bullet sounds: the
   biggest readability gap.
4. **Gameplay SFX manifest** (`sfx/gameplay.yaml`) plus an `elevenlabs` engine
   in `sfx/render.py` with a raw-response cache; render the table above (about
   US $0.55).
5. **Player stream**: under 60 ms, -14 dB, 3 round-robin variants,
   phase-locked to the sixteenth grid; a 60 s fatigue reel in `qa/`.
6. **VO loudness pass**: per-line -18 LUFS, -1 dBTP in `vo/render.py`.
7. **Master limiter plus a loudness check** on QA reels (target -18 LUFS, -1
   dBTP) cited in reports like the other `qa/` checks.
8. **Ducking map** implemented as data (a table like the one above), so
   students can read and tune it.
9. **Synthesize the tiny UI ticks** (focus, slider_tick, toggles) in Web Audio
   where SA3 flags noisy, and pick the rest so `sfx/picks.json` stops being
   all `null`.
10. **Pacifist melody**: graze and dodge sounds play the cue's melody line in
    a no-fire run, so the autopilot's restraint is audible: the ending's
    argument made in sound.

## Status and next step

Done: research, objective analysis, fal test (US $0.04). Not done: any
listening. Next: Adam auditions `scratch/fal/` (8 EL, 8 MM files) and chooses
the gameplay SFX source; then items 1–2 as one engine workstream.
