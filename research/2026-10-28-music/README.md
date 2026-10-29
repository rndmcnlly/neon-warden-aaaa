# Music cue generation spike

Framing question: can a local, licensed-data model give us credible draft
cues for every beat fast enough to iterate on briefs?

## Options

| Option | Tradeoffs |
| --- | --- |
| Stable Audio 3 medium (MLX) | Chosen. Licensed training data, outputs ours, 6–8x realtime, no lyrics (fine: score is instrumental). Loops are not seamless. |
| Stable Audio 3 small-music | Faster, lower musicality; useful for brief iteration. |
| ACE-Step (acestep.cpp) | Only if a cue needs sung lyrics (none planned). |
| Authored score (Ardour/MIDI) | Best control and loop seams; far more labor. A later polish pass could replace picks with authored versions. |

## Status

16 candidates (8 cues x 2) rendered in 126 s wall; see `music/README.md` for
workflow, timings and license. Not auditioned yet.

## Next step

Adam auditions `music/audition.html`, picks, and we hand-set loop points for
tutorial, gameplay, flashback and boss before promoting.
