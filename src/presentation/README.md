# Flat opening logos

`flatLogos.ts` is a passive DOM presentation layer, not a scene controller.
It draws screen-locked, axis-aligned SVG marks and live-text identities over
an opaque dark background. No perspective, parallax, jitter, audio, timers,
animation frames, global listeners or third-party asset requests.

## API and integration

```ts
import { createFlatLogos } from "./presentation/flatLogos.ts";
import "./presentation/flatLogos.css";

const logos = createFlatLogos(slot, {
  reducedMotion: settings.accessibility.reduceMotion,
  reducedFlashing: settings.accessibility.reducedFlashing,
});
logos.show("studio", localizedStudioTagline);
logos.update(elapsedSinceStudioCueMs);
// At boot.publisherLogo, not at an independent timeout:
logos.show("incubator", localizedIncubatorTagline);
logos.update(elapsedSincePublisherCueMs);
// On abort/skip, completion or screen unmount:
logos.dispose();
```

The host must be positioned (`position: relative` or `fixed`) and have the
full intended logo viewport size. Its existing Skip control stays above the
layer (or outside its stacking context). The layer never intercepts input.
Do not add `.is-3d` to `.nw-screen-logos`, show 3D logo props or run a
`logoTurntable` shot. Remove that legacy boot wiring at integration.

`show` is idempotent for a visible brand and uses safe textContent taglines.
It starts fully visible as a static fallback; `update(0)` begins the optional
480 ms opacity reveal. A single 12%-opacity glint crosses between 600–1700 ms.
Caller elapsed time can pause, seek or jump straight to completion. No hold
duration or completion callback is owned here. `hide` is immediate and reusable;
`dispose` is idempotent, removes only its own DOM, and makes later calls inert.
`setSettings` immediately reapplies the last supplied frame. Either reduction
setting shows a full static identity; the OS reduced-motion preference also
disables effects in CSS. No effects are required for legibility.

Use the existing Director boot flags and clock. Preserve the two 3200 ms holds,
music cues, `boot.logosDone`, and AbortSignal → `director.skipScene()` behavior.
If the renderer must own the adapter later, pass a DOM host: never texture this
HTML onto a 3D plane. For a subdirectory deployment, the optional third argument
is the branding asset URL prefix (default `/branding/`). Include both SVGs in
the PWA offline cache when integrating; the layer itself never fetches a cache.

## Assets and QA

Original SVG vectors: `public/branding/`, CC0, with a local license notice.
Fonts use installed system families, with no download or font-blocking period.
Identity remains live text if SVGs cannot load. Decorative marks are hidden
from assistive technology; names and optional localized taglines remain text.

Reproduce isolated QA:

```sh
deno test --allow-read tests/logo_timing_test.ts
deno run -A --no-lock tests/logo_capture.ts
```

The capture script owns and closes its isolated Vite server and browser. It
writes two focused 10-second H.264 clips, four PNG stills and a JSON report in
`qa/reports/20261028-flat-logos/`. It does not start the game or touch `main.ts`.
Review harness: `/research/2026-10-28-flat-logos/` on a local Vite server.
