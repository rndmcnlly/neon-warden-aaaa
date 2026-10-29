# Flat opening identities, October 28, 2026

## Framing question

How can the studio and incubator feel produced without pretending their logos
are objects in the game's 3D world?

## Decision and tradeoffs

Use static vector marks, system-font live wordmarks, restrained halftone,
colored glow and a single caller-driven reveal/glint. This keeps lettering
sharp at phone and desktop sizes and avoids GPU scenes, font requests and
repeating motion on school Chromebooks. System font appearance varies across
platforms, intentionally trading exact font matching for a no-download fallback.
No paid calls or generated third-party assets were used.

The component follows the passive-view pattern: the existing Director remains
the single sequencing authority. `show` alone gives a static fallback. Only an
explicit `update(elapsedMs)` asks it to animate. The isolated harness owns a
review clock, but production must not import that harness.

## Tried and verified

- 1280×720 desktop and 390×844 phone: both identities, no horizontal overflow,
  loaded local vectors, no transforms, reduced flashing, OS reduced motion,
  immediate hide and disposal. Six grouped browser checks pass.
- Two timing tests pass; focused lint and strict type checks pass.
- Focused 10-second clips and stills:
  `qa/reports/20261028-flat-logos/{desktop,phone}.mp4`,
  `{desktop,phone}-{studio,incubator}.png`, `result.json`.
- Project asset/translation static QA:
  `qa/reports/20261028-225320/index.html`: 32 pass, six warnings, zero failures.
  Warnings concern existing translation width/ASR, model registry/budgets/node
  names, and an unbriefed music cue. This is not a full current-build traversal.

An initial capture found the decorative glint could extend the scrollable
width even while visually clipped. Constraining its path inside the viewport
removed that overflow rather than weakening the test.

## Next step

Main/stage owner integrates after off-screen Pilot work ends, following
`src/presentation/README.md` and the integration queue. Keep the original
3200 + 3200 ms Director sequence, music and skip semantics. No shared renderer,
UI, timeline or `main.ts` edits belong to this isolated change.
