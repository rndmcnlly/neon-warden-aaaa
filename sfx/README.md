# UI sound design (workstream 7)

Front-end UI sounds for Neon Warden AAAA: crisp, short, tactile, one cohesive
family ("premium 2027 console UI, cyberpunk-clean", not retro chiptune). A
local model renders several candidates per role, Adam auditions and picks,
and the picks are promoted into `public/sfx/` for the game. Every step is a
file, so anyone can rewrite a brief, regenerate, and re-pick later.

```
manifest.yaml  ->  render.py  ->  candidates/  ->  audition.html  ->  picks.json  ->  promote.py  ->  public/sfx/
 (briefs)          (model +       (wav + index)    (listen, pick)     (choices)        (encode)        (<role>.ogg +
                    post-proc)                                                                          manifest.json)
```

## Files

| File | Role |
| --- | --- |
| `manifest.yaml` | Family brief, loudness policy, 16 roles with brief, target length, gain, seed, count |
| `render.py` | `uv run --script` tool: renders candidates, post-processes, writes `candidates/index.json` and `index.js` |
| `candidates/<role>/<role>_<nn>.wav` | Processed candidates (mono, 48 kHz, 24-bit) |
| `candidates/.cache/<hash>.wav` | Raw model renders (stereo 44.1 kHz), keyed by render inputs |
| `audition.html` | Static audition page; no network |
| `picks.json` | One pick per role (or `null`), with the render hash it refers to |
| `promote.py` | Encodes picks to `public/sfx/<role>.ogg` and writes `public/sfx/manifest.json` |

## Workflow

1. **Edit briefs** in `manifest.yaml`. The prompt sent to the model is
   `"<role brief>. <family brief>"`, plus a shared negative prompt (music,
   chiptune, reverb, hiss, and so on). Write briefs in sound-library tag
   language ("short crisp click, glassy, dry"), since the model was trained on
   tagged library audio, not prose.
2. **Render**: `uv run sfx/render.py` (all roles, 6 each). Quick check:
   `uv run sfx/render.py --count 2`. Only renders whose inputs changed hit the
   model; everything else is a cache hit.
3. **Audition**: either open `sfx/audition.html` directly in a browser (it
   loads `candidates/index.js` via a script tag, so `file://` works), or serve
   it:

   ```sh
   python3 -m http.server -d sfx 8121      # then open http://localhost:8121/audition.html
   # or: deno run -A jsr:@std/http/file-server sfx --port 8121
   ```

   Keys: Up/Down move between roles, Left/Right between candidates, Space
   plays, Enter picks (again to unpick), 1–9 play candidate n, A toggles
   autoplay on move. Each candidate shows duration, active RMS, true peak,
   LUFS (when at least 400 ms long), and any automatic flags. Picks persist in
   the browser's localStorage; when served over http with no stored picks, the
   page seeds from `picks.json`.
4. **Record picks**: click "Export picks.json" and save it over `sfx/picks.json`
   (or "Copy JSON" and paste). Commit it: this file is the decision record.
5. **Promote**: `uv run sfx/promote.py` (add `--dry-run` to preview). Writes
   `public/sfx/<role>.ogg` (Ogg Opus, 96 kb/s, mono 48 kHz) and
   `public/sfx/manifest.json` (`{ sounds: { role: { src, duration_ms, source:
   {file, hash, seed, model} } | null } }`). Unpicked roles are `null` and any
   previously promoted file for them is removed.

## Regenerating one role

```sh
# edit roles.confirm.brief (or seed, target_ms, gain_db) in manifest.yaml
uv run sfx/render.py --role confirm             # repeat --role for several
uv run sfx/render.py --role confirm --count 12  # more candidates for a stubborn role
```

Changing the brief, seed, model, render length, steps, cfg, or negative prompt
changes the cache key and triggers new renders. Changing `target_ms`,
`gain_db`, or anything under `loudness` only reprocesses cached audio
(`--reprocess` forces that path and never calls the model). Changing the
family brief re-renders everything, which is intended: it is the family.

If you re-render a role after picking, `promote.py` compares the stored hash
and refuses to ship a file that now holds a different sound; re-pick it.

The cache only grows. Delete `candidates/.cache/` to reclaim space (about
350 KB per render); renders are deterministic per seed, so they come back.

## Post-processing and loudness policy

Per candidate: stereo to mono, resample 44.1 to 48 kHz, remove DC, trim
leading silence (first point within 40 dB of the envelope peak, minus 2 ms),
end at the natural tail (50 dB below peak) or `target_ms`, whichever is first,
1 ms fade-in and a 12 ms cosine fade-out.

Loudness: most UI sounds are shorter than the 400 ms EBU R128 gating block, so
integrated LUFS is unreliable for them. Instead each clip's **active RMS**
(RMS over samples within 40 dB of its envelope peak) is normalized to
**-20 dBFS plus the role's `gain_db`**, then gain is reduced if needed to keep
the 4x-oversampled **true peak at or below -1 dBTP** (no limiter). Role gains
encode the mix hierarchy: hover and slider ticks sit 6–8 dB below confirm and
notifications. Levels are baked in, so the game plays them at unity on the UI
bus.

## Automatic flags (in `index.json` and on the audition page)

| Flag | Meaning |
| --- | --- |
| `clipped` | More than 0.5% of raw samples at full scale (the model peak-normalizes then clamps, so loud renders saturate) |
| `noisy` | Spectral flatness above 0.45: closer to a noise burst than a tone or click |
| `truncated` | The sound was still within 18 dB of its peak where `target_ms` cut it; the fade may sound abrupt |
| `peak_limited` | The true-peak ceiling kept it more than 1.5 dB under its loudness target |
| `late_onset` | More than 400 ms of leading silence in the raw render |
| `too_short`, `silent` | Under 25 ms after trimming, or no signal |

Flags are hints, not vetoes. A flagged candidate can still be the best one.

## Model

**Stable Audio 3, small SFX variant** (`sm-sfx`, 433M parameters, MLX on
Apple Silicon), local at `~/Code/sa3/stable-audio-3/optimized/mlx` (override
with `SA3_DIR`). Weights in `models/mlx/` there. `render.py` calls
`.venv/bin/python scripts/sa3_mlx.py` in that directory once per candidate.
Settings: 8 steps, cfg 3.0 with the negative prompt, 1.0 s raw renders (2.0 s for the notification). Tested: 1.0 s renders produce
naturally short sounds (~200 ms) with clean tails; 1.5 and 2.0 s renders tend
to fill the whole window with sound (every pause candidate was flagged
`truncated` at 1.5 s, none at 1.0 s); 0.5 s renders are mush. `medium` is available by
setting `defaults.model` (or a per-role `model`) but is untested here.

Why this model: it is tuned for sound effects, fast (about 1 s per candidate
on an M3 Max once warm), and trained only on licensed data (AudioSparx plus
CC0, CC-BY, and CC Sampling+ Freesound recordings), which makes the workflow
honestly recommendable to students. Alternatives considered: Foundation-1.2
Samples (synth one-shots, possibly cleaner tonal blips; a good second engine
if SA3 sounds too "foley"), ACE-Step (music with lyrics; wrong tool).

## Licensing of outputs

The SA3 weights are under the **Stability AI Community License** (gated on
Hugging Face; the code is MIT). Plainly:

- As between us and Stability AI, **we own the outputs** "to the extent
  permitted by applicable law". In the US, purely machine-generated audio may
  not be copyrightable at all; our selection, editing, and processing add
  some human authorship, but do not count on strong protection.
- Free use, including commercial, while the user or organization has under
  US $1M annual revenue; above that the license terminates and an enterprise
  license is needed.
- The "Powered by Stability AI" display requirement attaches to distributing
  the model or derivative models, which explicitly exclude outputs. Shipping
  the sounds does not trigger it; a credits line is still a courteous and
  transparent choice, and we should take it.
- Outputs may not be used to train other foundation generative models, and use
  must follow Stability's Acceptable Use Policy.
- Provided as is, with no non-infringement warranty. The licensed training
  data lowers, but does not remove, the chance a render resembles a library
  sound.

Checked October 28, 2026 against the `stable-audio-3-small-sfx` model card
and `LICENSE.md` on Hugging Face.

## Gameplay sounds (wave 3)

Gameplay sound has two layers (see `src/audio/gameplaySounds.ts`, the tuning
table, and `research/2026-10-28-critique-audio/`):

- **Feel and texture** (impacts, weapons, whooshes, debris): rendered with
  ElevenLabs SFX v2 on fal from `sfx/gameplay.yaml`:
  `set -a; source ~/.tokens/fal-ai; set +a; uv run sfx/render.py --manifest sfx/gameplay.yaml`.
  The script estimates the cost of uncached renders and refuses past
  `--max-usd` (default 3); raw responses are cached by spec hash (no seed
  exists), and each paid call is logged to
  `sfx/candidates/gameplay/.cache/fal_calls.jsonl`. Log totals in
  `research/SPEND.md`.
- **Musical layer and tiny ticks** (stream shot, enemy fire, graze, lock
  ticks, pay, Writ chords, scan beam): synthesized in `src/audio/synth.ts`,
  pitched to the playing cue's key and snapped to its grid. No files.

Audition with `audition.html?set=gameplay`. There, a role can keep several
takes: each becomes a round-robin variant. Promote with
`uv run sfx/promote.py --gameplay` (`--provisional` first picks the cleanest
take for every unpicked role, marked provisional in `picks-gameplay.json`
and in the audition page). Output: `public/sfx/gameplay/*.ogg` and
`public/sfx/gameplay.json`. Until a role has a sample, the game plays its
synth stand-in, so nothing is ever silent. Note that the quality flags were
tuned for UI clicks: `noisy` is normal for an explosion, and `truncated`
means the render ran past `target_ms` and was faded.
