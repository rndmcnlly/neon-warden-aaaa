# Fullscreen and offline installation

## Player workflow

Open **Install / offline / screen** at the top right. Fullscreen is available
there and in Graphics settings. **F** toggles it, unless F is explicitly bound
to any game/menu action: an intentional binding wins and the visible button
remains usable. Repeated keys, modifier shortcuts, typing/contenteditable and
the controls screen's `.is-capturing` remapping mode do not trigger fullscreen.
Escape/browser fullscreen changes synchronize the existing shared settings
store. Denied requests produce a visible message, not an unhandled rejection.

Installation and offline readiness are separate. **Install game** uses the
browser install prompt when available; otherwise it explains the browser menu
and Safari's Share → Add to Home Screen workflow. On unsupported iOS fullscreen
the same home-screen advice is shown. The platform panel currently uses English
labels, including when the game's own menus use another language.

**Download playable slice + voice pack** downloads the shell and the chosen
voice language. The picker starts with the game's selected voice language and
follows changes in settings; choosing an additional pack does not change the
game's voice setting. English, Spanish and Chinese packs can coexist. Progress
counts actual downloaded/cached resource bytes. Readiness is checked against all
required cache entries, not service worker installation or a marker alone.
Quota, network, release mismatch and invalid-response errors leave readiness
false. Partial downloads are reusable. Browser eviction and clearing site data
can remove downloads, even after installation. Persistent storage is requested
but never presumed granted. A cold offline launch without a downloaded shell
fails normally in the browser: there is no fictional offline-ready screen.

## Implementation and deployment

- The site has two pages: a static landing page at the root (`index.html`,
  `src/landing/`, never controlled by the worker) and the game at
  `play/index.html`. The worker file `sw.js` sits at the site root beside the
  asset folders but is registered with scope `play/`; release paths resolve
  from the worker's own URL, and offline navigation serves the cached
  `play/index.html`. The landing page, its `assets/landing-*` files and
  `media/` (the teaser) are not part of any offline pack. Root URLs carrying
  game flags (`?skipto=`, `?qa=1` ...) are forwarded to `play/`.
- `play/index.html` boots `src/platform/bootstrap.ts` separately from `main.ts`.
  Fullscreen uses `createSettingsStore()`'s existing per-storage singleton.
  The small Graphics settings hook routes requests through the same helper.
- `src/platform/build.ts` is a Vite production plugin, using Vite 8's built-in
  Oxc transformer. No additional runtime/build dependency is needed. It hashes
  every shipped file except source maps, its own generated inventory and worker.
  Worker source participates in the release ID. It writes
  `offline-manifest.json` and `sw.js` alongside the built HTML.
- The pack includes hashed JS/CSS, HTML, manifest/icons, glTFs, SFX, all shipped
  music, shared cue/stamp/variant manifests and the chosen language's base and
  variant VO. Non-language public assets are shared. No external resources or
  CDN dependencies are requested by this platform layer. Future public assets
  are included automatically: students should keep non-shipping work elsewhere.
- `src/platform/worker.ts` verifies SHA-256 before caching a response. A server
  returning status-200 HTML for missing audio/models cannot poison the pack.
  Only explicit downloads populate caches. Cached GETs and model-loader HEAD
  metadata work offline. Navigation ignores query strings and uses the cached
  app shell. Uncached resources go to the network, never an HTML audio fallback.
- Registration is production-only. `deno task dev` does not register/cache a
  worker. `deno task build` followed by `deno task preview` supports localhost
  testing. Use a different origin/port for development versus production preview
  if a production worker was previously installed: browsers retain registrations
  per origin. Dev mode does not forcibly unregister a user's existing worker.
- Deployment requires **HTTPS**, except localhost's secure-context exemption.
  Serve the entire build, including `sw.js`, local icons and binary assets;
  serve JS with its correct MIME type. Do not apply an HTML fallback to missing
  audio/model files. The official build is served at a domain root (`docs/PUBLISHING.md`);
  subpath hosting (a fork) uses Vite's existing `REPO_NAME` base;
  manifest identity, scope and start URL are relative to that location.
- Updates wait while the old app is open. Nothing reloads an active run without
  explicit confirmation. **Apply update and reload** ends the current run and
  requires a fresh pack for that release. Other game tabs must be closed before
  activation so their runs are not taken over. Old caches are retained until
  **Remove obsolete downloads** is explicitly requested with no other game tab
  open. Keeping old releases uses additional disk space, intentionally favoring
  active-version safety over aggressive automatic cleanup.

## Verification, October 28–29, 2026

Commands:

```sh
deno test --allow-read tests/platform_test.ts
deno lint src/platform tests/platform_test.ts tests/platform_browser.ts
deno check src/platform/ tests/platform_test.ts tests/platform_browser.ts vite.config.ts
deno run -A tests/platform_browser.ts
deno run -A --no-lock qa/qa.ts static
deno task ci
```

The production Playwright runner builds into `qa/.build/platform`, serves port
4317, and uses a fresh persistent Chromium profile. It runs in the foreground.
On this Mac its Chromium GPU arguments use Metal. The quota-exhaustion portion
can take several minutes; only the short offline menu-to-run traversal is
recorded, not downloads or the quota wait.

Passing report: `qa/reports/platform-2026-10-29T05-23-53.590Z/result.json`.
That directory contains `offline.png`, `offline-run.png`, `offline-dom.txt` and
short `video/*.webm` recordings. It verifies real F enter/exit, typing and remap
exclusion, cold offline failure, successful download, HTML-as-audio rejection,
partial recovery, eviction detection, **all 320 required English-pack resources
retrieved with the browser offline**, model HEAD metadata, offline settings and
new-game/hangar/run launch, page restart, full browser/context restart with its
persistent profile, quota failure, pending-update non-reload, explicit activation
and previous-release retention. Repeated/modifier/conflicting-binding cases and
manifest/PNG dimensions are also covered by the two passing unit tests.

The focused offline traversal is
`qa/reports/platform-2026-10-29T05-23-53.590Z/video/690d42f34fc2b61e7235be9c10444c48.webm`
(8.44 seconds). The full existing unit suite also passes: **180 passed, zero
failed**, recorded in `qa/reports/platform-unit-suite.log`.

Chromium's successful bodyless service-worker HEAD responses can additionally
emit CDP `ERR_ABORTED`; the runner distinguishes those from network misses and
checks the actual successful fetch metadata. Intentionally cancelled voice
requests are recorded separately. It also independently fetches every pack URL
and verifies response byte lengths while offline, so cancellation filtering
cannot conceal an uncached essential resource.

Project-wide checks were attempted, not claimed green:

- `qa/reports/platform-ci.log`: CI stops on pre-existing formatting in shared
  documentation/generated assets. Those other agents' files were not formatted.
- `qa/reports/platform-static.log`, dashboard
  `qa/reports/20261028-222215/index.html`: static QA has 31 passes, five warnings
  and two failures: one low-ASR VO take and 65 script lines absent from the
  concurrently generated VO cue manifest. These are VO integration issues,
  not platform cache failures.

This is desktop Chromium automation, not a real iPhone, Android installation or
managed low-end Chromebook test. Safari installation instructions and unsupported
fullscreen messaging are implemented but have not been device-validated. English
pack contents were exhaustively verified offline; ES/ZH pack classification and
download support are implemented, but full successful ES/ZH offline traversals
remain device/release QA. Browser install-prompt acceptance itself requires an
eligible browser and user gesture and was not claimed as a real OS installation.
