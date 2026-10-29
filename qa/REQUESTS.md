# QA requests for the integration pass

Owner of `src/contracts`, `src/main.ts`, `deno.json`, `.gitignore`: the
integration agent. QA tooling never edits those; it files requests here.
Status as of October 28, 2026.

## Status (wiring pass, October 28, 2026)

Items 1–6 are done. The probe also exposes `timeline()`, `flags()`,
`events`, and `kills`, `phase`, `frozen` in `sim()`; the six gameplay reels
now assert their real beats and no longer carry `needs`. Item 6 is fixed at
the source: `music/promote.py` always writes `public/music/manifest.json`
(every runtime cue, `null` until picked). Item 7 and "For other
workstreams" remain with their owners.

## 1. deno.json tasks and config

```jsonc
"tasks": {
  // everything: coverage, assets, every reel (about 8–10 min)
  "qa": "deno run -A --no-lock qa/qa.ts",
  // coverage and assets only (seconds); run before every report
  "qa:static": "deno run -A --no-lock qa/qa.ts static",
  // one or more reels: deno task qa:reel boss menus-es
  "qa:reel": "deno run -A --no-lock qa/qa.ts reel",
  // every reel of a topic: deno task qa:topic menus
  "qa:topic": "deno run -A --no-lock qa/qa.ts topic",
  "qa:list": "deno run -A --no-lock qa/qa.ts list"
}
```

- `"exclude"`: add `qa/reports` and `qa/.build` (fmt and lint otherwise walk
  generated JSON and the bundle).
- `"imports"` (optional, then drop `--no-lock` above and commit the lock):
  `"playwright": "npm:playwright@1.58.2"`, `"@std/yaml": "jsr:@std/yaml@1"`.
  Playwright 1.58.2 is pinned because it matches the Chromium already in
  `~/Library/Caches/ms-playwright`.

## 2. .gitignore

```
qa/reports/
qa/.build/
```

Reports carry WebM videos (about 3 MB per reel). If Adam wants a reviewed
report kept, copy it into `research/` deliberately.

## 3. QA probe in main.ts (unblocks 7 of 11 reels)

With `?qa=1`, expose a read-only probe. Reels poll it with `until` steps;
without it they report `pending`, not `fail`.

```ts
interface QaProbe {
  /** Director timeline id now playing (`tutorial`, `flashback`, `wardenDescent`,
   *  `endingKill`, `endingPacifist`, ...), or `menu` while the front end owns input. */
  scene(): string;
  sim(): {
    tick: number;
    sector: number | null; // 1–5, null in the boss arena or menus
    outcome: "none" | "kill" | "pacifist" | "gameover";
    shotsFired: number; // the pacifist reel asserts this stays 0
  };
  /** Append-only, last 500: `sim:<SimEvent.type>`, `scene:<id>`, `line:<LineId>`. */
  readonly log: readonly string[];
}
declare global {
  var __nwqa: QaProbe | undefined;
}
```

Write-only from the game side; QA never mutates it. The cost is one array
push per event while `?qa=1` is set, nothing otherwise.

## 4. Skip-to wiring

`startFor()` in `main.ts` handles `tutorial` and `sector1..5` only. The
`flashback`, `boss`, `ending-kill`, `ending-pacifist` reels need the other
`SKIP_TARGETS` to start the matching timeline (today they silently start
sector 1).

## 5. Director subtitles in play

The accessibility reel waits for `.nw-subtitle` during `?skipto=tutorial`;
today it never appears (Director not mounted in `main.ts`), so that
assertion is `pending`.

## 6. One failed request in every reel: `GET /music/manifest.json` 404

`src/audio/engine.ts:140` fetches `music/manifest.json`; no music is
promoted yet, so `public/music/` does not exist. `fetchJson` already returns
null on a non-OK response (no crash, no game-side log), but Chromium logs
the 404, so every reel reports a failed request (warn). Fix, pick one:

- Preferred (audio owner, `music/promote.py`): always write
  `public/music/manifest.json`, with an empty cue map when nothing is
  picked, the way `public/sfx/manifest.json` lists roles as `null`.
- Stopgap (integration): commit `public/music/manifest.json` containing
  `{"version": 1, "cues": {}}` (match whatever shape `MusicManifestFile` in
  `src/audio/manifests.ts` expects).

## 7. Notice and main menu overflow by 3 px (front-end owner)

Seen in menus-en, menus-es, menus-zh and accessibility: `div.nw-actions`
(photosensitivity notice, scrollWidth 485 > clientWidth 482) and `nav.nw-menu`
(main menu, 289 > 286). Same 3 px in every language, so it is not text.
Cause: `src/ui/frontend.css:824-826`, inside
`@media (prefers-reduced-motion: no-preference)`:

```css
.nw-button:focus,
.nw-row:focus {
  transform: translateX(3px);
}
```

The focused button fills its flex or grid track, so the nudge pushes its
right edge 3 px past the container. Fix: nudge the content, not the box,
for example

```css
.nw-button:focus > *,
.nw-row:focus > * {
  transform: translateX(3px);
}
```

or keep the box transform and give `.nw-actions` and `.nw-menu`
`padding-inline-end: 3px`. QA now grades 2–4 px overflow as `warn`
("minor", likely focus scale) and more than 4 px as `fail`, so this no
longer fails reels, but the fix still belongs in the CSS.

## For other workstreams (not integration)

- Strings: `ui.licenses.*` / `ui.credits.*` do not name the Orbitron font
  (OFL) or Stable Audio 3 (`assets.licenses` fails). See qa/budgets.ts
  `THIRD_PARTY`.
- Front end: in Extras, arrow keys from the first tile do not reach
  `licenses` within 14 presses of ArrowDown (grid layout; ArrowRight is
  probably needed). The reel falls back to script focus and warns; either
  is fine, but confirm the grid is fully keyboard reachable.
