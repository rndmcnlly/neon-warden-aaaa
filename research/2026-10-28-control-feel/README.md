# Control feel: make precision legible, then test cruise

**Research, October 28, 2026. No game changes.** Framing: can sustained movement feel more alive without making tight dodges unreliable? Disciplines: game feel, human motor control, deterministic simulation, accessible audiovisual communication.

## Recommendation (executive summary)

Prototype **hybrid cruise**, opt-in behind a future `?controls=hybrid` selector or a clearly named control setting. Keep the shipped controller as the default until Adam tries it. Compare against a classic precision candidate, not against an intentionally sluggish straw person. Treat diagonal normalization as a separate, disclosed balance change.

Hybrid starts at **126 px/s**, reaches **252 px/s** through a **0.25 s scalar ramp**, retains speed through turns, and coasts for at most **0.05 s** on release. Steering redirects velocity immediately, even through 180°. Focus immediately becomes **120 px/s**, stops immediately on neutral, reveals the hitbox, and cancels cruise; leaving focus restarts the normal ramp. A brief neutral gap retains the cruise envelope, so corners do not demand overlapping key chords. These are proposed starting numbers, not established genre constants.

**Actual current controller:** 60 Hz, immediate 252 px/s normal and 120 px/s focus, immediate stops and reversals, no hold-duration acceleration. Keyboard/D-pad diagonals reach **356.4 px/s**, while the radially normalized analogue stick generally does not. Collision radius stays **6 px** in both modes. Loadouts do not change movement. No gameplay touch movement adapter was found in the current source. Focus does not govern scan or Writ: releasing **fire** does. The tutorial promises a focus graze ring, but focus is absent from the render snapshot and no focus-specific renderer/audio branch was found. This is a source audit, not a listening/visibility playtest.

**Fix legibility independently:** a short, distinct entry sound, steady thin hitbox/focus outline and restrained thruster change, then a different exit sound. Do not imply invulnerability, flash the screen, add tutorial text clutter, or reuse the scanner's sound/shape. Keep focus available as a toggle.

**Why not ordinary inertia?** Precision dodging depends on predictable tap distance and immediate correction. Vector acceleration can keep the ship travelling into danger after a reversal. Scalar cruise plus immediate steering preserves the requested held-motion character without that specific penalty. Coast still adds stopping distance and may be undesirable. The classic candidate remains a valid outcome.

**Numerical result, not preference:** a 100 ms tap moves 25.2 px in classic; hybrid moves 14.7 px under input plus 2.8 px after release. Full-cruise coast adds 4.2 px, significant next to a 6 px hitbox radius. Prototype testing must determine whether that cost is acceptable.

## Artifacts and status

- [Actual source audit](AUDIT.md), [sources and confidence](SOURCES.md), [tuning, events and QA plan](PROPOSAL.md).
- [Response plots and tables](comparison.html), [metrics](metrics.json), [raw trajectories](trajectories.csv), [simulator](simulate.py).
- Run: `uv run --script research/2026-10-28-control-feel/simulate.py`. No dependencies, no paid calls. **23 invariant checks pass**, nine scenarios, four controllers including actual legacy behavior: [report](simulator-checks.json).
- Existing `qa/` coverage/assets reused read-only via [local wrapper](check_static.ts): **32 pass, 6 warn, 0 fail** in [dated report](static-qa.json). No game captures, no `qa/` writes. Warnings are shared-checkout context, not caused or resolved here.
- Next: Adam tests classic versus hybrid in the same short bullet pattern, with focus feedback identical in both. No implementation approved by this research.
