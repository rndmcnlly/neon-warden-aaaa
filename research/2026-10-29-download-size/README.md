# Download and offline size audit, October 29, 2026

**Estimate from existing build bodies, not measured network traffic.** No build,
dependencies, paid calls, or game changes. All displayed sizes are MiB (2^20
bytes), rounded to 0.1. Exact body-byte totals are in `summary.json`.

## Evidence and freshness

- Checkout HEAD: `2ca039f5da96472b33a943d5fc0db80c8ae5f388`; shared checkout
  has unrelated uncommitted work. Build-to-git revision is not embedded.
- Primary inventory: `qa/.build/platform/offline-manifest.json`, release
  `6ec0647bd1491c8bfda8`, modified **2026-10-28 23:22:00 -07:00**.
  All **937** entries were independently SHA-256 checked against local bodies:
  no missing/mismatched files. All current `public/` files match this build,
  except the two historical Pilot figures intentionally excluded from its pack.
  This is the nearest existing build, not today's rebuilt checkout: subsequent
  commits `5a23867`, `ad32043`, `75b75c3` change shots, platform UI and controls.
- `dist/offline-manifest.json` is older: **22:41:02 -07:00**, release
  `b918a6a9e4870f650bbb`, 786 verified entries. It includes retired Pilot models,
  defaults to original tutorial VO rather than Captain, and differs from 238
  current public files. Do not deploy it as the current slice.
- Read `docs/PWA.md`, `src/platform/{build,worker,bootstrap}.ts`,
  `src/audio/{engine,manifests,variants}.ts`, `src/main.ts`, and model preload
  code. Asset manifests used: primary build's `vo/cues.json`,
  `vo/variants/index.json`, `music/manifest.json`, `sfx/manifest.json`,
  `sfx/gameplay.json`, plus the offline inventory. Documentation's older
  320-resource EN QA claim is not this 375-resource inventory.

## User-facing totals

| Scenario | Unique resources | Estimated compressed transfer | Expanded response bodies |
| --- | ---: | ---: | ---: |
| Boot/title baseline before background audio | 43 | 2.1 | 5.5 |
| Normal first play, EN Captain | 277 | 13.6 | 17.0 |
| Normal first play, ES | 277 | 14.6 | 18.0 |
| Normal first play, ZH | 277 | 13.7 | 17.1 |
| Normal play, union of all languages | 677 | 28.2 | 31.6 |
| Explicit offline slice + EN | 375 | 21.6 | 25.0 |
| Explicit offline slice + ES | 375 | 23.8 | 27.2 |
| Explicit offline slice + ZH | 375 | 21.7 | 25.1 |
| Offline, all languages together | 937 | 44.1 | 47.5 |

Boot baseline includes shell, icons, two flat marks, all ten eagerly preloaded
models, five metadata files, UI SFX, logo music and service-worker script.
Icons are a conservative allowance: browser-specific icon fetching varies.
It excludes non-requested `.DS_Store` and branding license. **There is no
stable small title download:** `main.ts:114–118` immediately loads menu,
gameplay and ending audio in the background, even before a run is started.
A player lingering at the title can therefore incur the full first-play total.
Normal play follows default music picks and current Captain/base VO, including
English fallback; unique URLs deduplicate reused tracks. Fifteen catalog lines
have no rendered languages and contribute no audio bytes, not invented files.

Offline rows are the worker's exact `!lang || lang === selected` inventory
selection, not an optimized runtime subset. Shared files are downloaded once
when adding languages, not three times. The worker itself adds 0.2 expanded /
0.0 compressed outside these inventory totals; `offline-manifest.json` is not
normally fetched because the inventory is embedded in the worker.

Installation alone fills no offline cache. Downloads use `cache: "no-store"`
and only reuse explicit CacheStorage entries, so first play followed by the
first offline download can transfer roughly **35.2 EN / 38.4 ES / 35.4 ZH**
in total. Expanded bodies are a CacheStorage payload estimate, not physical
disk usage: headers, browser bookkeeping, HTTP cache duplication, old retained
release caches, and decoded audio/GPU memory are additional or separate.

## Breakdown

| Category | Normal EN bodies | Offline EN bodies | Offline all bodies |
| --- | ---: | ---: | ---: |
| Code/CSS, HTML, manifest, icons | 1.2 | 1.2 | 1.2 |
| Models | 1.1 | 1.2 | 1.2 |
| SFX audio | 0.3 | 0.3 | 0.3 |
| Music audio | 4.7 | 9.3 | 9.3 |
| VO audio | 6.8 | 10.1 | 32.7 |
| Metadata | 2.7 | 2.9 | 2.9 |

Flat branding rounds to 0.0; the normal row additionally fetches the worker.
Category rounding need not sum exactly. No font files ship. JS is **1.2 raw /
0.3 gzip** (1,212,324 / 360,509 bytes); CSS rounds to **0.0 / 0.0**
(35,392 / 8,483 bytes). Text compression includes JSON, HTML, SVG and manifest
files, not just JS/CSS. Already-encoded Ogg/Opus and GLB bytes are counted
unchanged, not incorrectly charged as decoded PCM or GPU data. Actual hosting
compression is unknown: no compressed headers or wire capture were available.
Without text compression use the expanded-body column as transfer estimate.

Top five primary inventory files, also the top five for each offline language:

1. `vo/cues.json`: **1.8**.
2. `assets/index-B46I8-Gh.js`: **1.2**.
3. `vo/variants/index.json`: **0.9**.
4. `music/gameplay/cand2.ogg`: **0.8** (unselected comparison).
5. `music/gameplay/cand1.ogg`: **0.8** (selected).

## Waste and specific opportunities

1. **Make comparison packs opt-in.** Offline downloads include eight unselected
   music tracks (**4.6**) and 81 archived original tutorial takes per language
   (**3.3 EN / 4.6 ES / 3.4 ZH**, **11.3** all-language). Captain is the base
   `vo/{lang}/` take, not another required archive. These are alternatives,
   not byte-identical duplicates. Selected offline packs carry about
   **8.0 EN / 9.2 ES / 8.1 ZH** of avoidable comparison audio.
2. **Gate gameplay/ending prefetch on New Game.** Current eager staged loading
   defeats the 5 MiB title budget despite a 2.1 MiB boot baseline. Split VO
   metadata by language and omit variant timing metadata for ordinary players.
3. **Use an explicit shipping allowlist.** Current offline walk captures
   `.DS_Store`, `.gitkeep`, stamps and archival metadata. Two historical figures
   total **0.2** and are correctly excluded from the newer pack, but remain
   publicly deployed. The older dist still caches them. Two 3D logos total
   **0.5**, still eagerly loaded despite flat opening marks: assess removal
   from runtime preloading, not deletion of historical art.
4. **Keep maps out of ordinary delivery.** Latest build contains a **4.6** source
   map outside the offline inventory, plus **0.1** standalone inventory and
   **0.2** worker. Full output directory is **52.7**, not the user download.
   Exact-byte duplicate analysis finds only two icon/maskable pairs, under
   **0.1** total, not a meaningful audio deduplication opportunity.

**Chromebook budgets:** 5 MiB title is not reliably met because of immediate
background loading. 15 MiB full gameplay is provisionally met for normal
compressed transfer in every language (ES has little margin), not without
server text compression, and not for current offline downloads. This is a
byte-budget check, not a Chromebook runtime/performance test.

## Calculation and validation

Python standard library only: `pathlib`, `json`, `hashlib`, `gzip`; bytes read
from files, not `du`. For each scenario, form a set of resource URLs, then sum
`len(body)`; for transfer substitute
`len(gzip.compress(body, compresslevel=9, mtime=0))` for text extensions
`.js .css .html .json .svg .vtt .txt .webmanifest` only. Binary resources retain
their exact byte length. Offline selection follows `worker.ts:72`; normal
selection follows `AudioEngine` stage contents, manifest defaults and
`VoCatalog` fallback. Primary and older dist inventories both passed full hash
verification. No network measurement, huge build, or gameplay QA was performed.
