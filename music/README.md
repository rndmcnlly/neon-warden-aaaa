# Music cues (workstream 6)

One cue per beat: logos, menu, tutorial, gameplay, flashback, boss, and the
two endings. A local model renders candidates from written briefs, Adam
auditions and picks, and picks are promoted into `public/music/`, which the
audio engine (`src/audio/music.ts`) plays with crossfades and loop points.
Same spirit as `sfx/README.md`: every step is a file, so any cue can be
re-briefed and regenerated later.

```
cues.yaml  ->  render.py  ->  candidates/  ->  audition.html  ->  picks.json  ->  promote.py  ->  public/music/
 (briefs)      (SA3 MLX)      (wav + index)    (listen, pick)     (choices)      (ffmpeg)        (<cue>.ogg + manifest.json)
```

## Workflow

1. **Brief**: edit `cues.yaml`. Prompt = `"<cue brief>. <family brief>"` plus a
   negative prompt (vocals, hiss). Use library-tag language with a BPM.
2. **Render**: `uv run music/render.py` (all cues, 2 each), or
   `--cue boss --count 4`. Unchanged inputs are skipped (hash of prompt, seed,
   model, length, steps, cfg). Seeds are deterministic per cue and take number.
3. **Audition**: open `music/audition.html` (works from `file://`). Pick one
   take per cue; copy the JSON into `music/picks.json`; add `loopStart` and
   `loopEnd` (seconds) for looping cues once a clean seam is found.
4. **Promote**: `uv run music/promote.py` (or `--dry-run`). Encodes Ogg Opus,
   normalized to -16 LUFS, and writes `public/music/manifest.json`.

## Spike result (October 28, 2026)

Model: Stable Audio 3 medium (1.4B DiT + SAME-L decoder), MLX on M3 Max,
8 steps, cfg 3. All 16 candidates (8 cues x 2; 15 s logos, 60 s gameplay and
boss, 45 s otherwise) rendered in **126 s wall**, about 4–11 s each (6–8x
realtime). Not yet auditioned by ear: speed says nothing about musical fit.
Every take comes out peak-normalized to 1.0 by the sampler, which may hide
clipping; promote re-normalizes by loudness. Candidates total 121 MB of WAV:
keep `music/candidates/` out of git (only briefs, picks and the index matter).

Known gaps: SA3 renders do not loop seamlessly by construction; loop points
need hand-trimming or an inpainting pass (`--init-audio ... --inpaint-range`)
across the seam. Stings (logos) and endings are one-shots with a 1.5 s fade.

## License

SA3 weights: [Stability AI Community License](https://stability.ai/license).
Outputs belong to us ("You own any outputs generated from the Models"), free
for research, non-commercial, and commercial use under US $1M annual revenue
(commercial use requires registering with Stability AI). If we distribute the
model or a product that uses it, ship the license and display "Powered by
Stability AI"; shipping only the rendered music is the output case, but we
credit it anyway in the third-party licenses screen. Training data is
licensed (AudioSparx plus CC Freesound), so students can reuse this workflow
without the scraped-data problem.
