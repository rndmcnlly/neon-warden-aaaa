# qa/: studio QA tooling

Every check a workstream runs before it says "done" lives here. One command
produces one self-contained report directory with a dashboard, machine
JSON, short single-topic videos, and a paste-ready text summary.

```
qa/
  qa.ts          entry point: picks stages, writes the report, updates latest
  coverage.ts    translation coverage (text, placeholders, width, VO takes, references)
  assets.ts      asset pipeline (models, budgets, glTF, sfx, music, VO, licenses)
  capture.ts     build, static server, Playwright reel runner, contact sheets
  reels.ts       the reel list: data, one entry per video
  budgets.ts     triangle and byte budgets, animated nodes, third-party list
  report.ts      dashboard HTML, summary.json, summary.txt
  lib/           pure helpers (text widths, id scan, GLB reader) with tests
  REQUESTS.md    flags, hooks and tasks QA needs from the integration pass
  reports/       output, one folder per run, plus latest -> newest
```

All TypeScript under Deno. Media steps shell out to `ffmpeg`/`ffprobe`;
browsers are Playwright 1.58.2's Chromium (already cached on this machine).

## Run

Until the tasks in `REQUESTS.md` land in `deno.json`, use the long form:

| Want                         | Task (proposed)            | Long form                                           |
| ---------------------------- | -------------------------- | --------------------------------------------------- |
| coverage and assets, seconds | `deno task qa:static`      | `deno run -A --no-lock qa/qa.ts static`             |
| one or more reels            | `deno task qa:reel boss`   | `deno run -A --no-lock qa/qa.ts reel boss menus-es` |
| a topic                      | `deno task qa:topic menus` | `deno run -A --no-lock qa/qa.ts topic menus`        |
| everything (8–10 min)        | `deno task qa`             | `deno run -A --no-lock qa/qa.ts`                    |
| list reels                   | `deno task qa:list`        | `deno run -A --no-lock qa/qa.ts list`               |

Options: `--no-build` reuses `qa/.build/dist` (skip the 10 s Vite build when
only reels changed); `--url=http://localhost:3000/` records against a
running dev server instead (faster iteration, but not the shipped bundle).
Exit status is 1 if anything fails.

Every run, even a single reel, includes coverage and assets: they take
about a second and keep each report self-contained.

Open `qa/reports/latest/index.html`. `qa/reports/latest.txt` holds the same
path as text.

## Statuses

- **pass**: fine.
- **warn**: ship-able, someone should look (overflow risk by ratio, orphan
  files, keyboard path that needed script focus).
- **fail**: blocks "done" (missing translation, invalid GLB, overflow measured
  in the browser, console error, a reel that cannot reach its beat).
- **pending**: cannot be judged yet because another workstream owes a flag,
  hook or asset (QA probe absent, sfx not picked). Pending is not failure,
  but every pending item names what it waits for.

## Reels

A reel is a short, single-topic video with assertions: menus, accessibility,
cinematics, gameplay, endings. Never one long capture. Each reel writes
`reels/<id>/reel.webm` (1280x720, capped at `maxSeconds`, at most 60),
`sheet.jpg` (six 320x180 frames), `errors.txt` and `result.json`.

Current reels: `menus-en`, `menus-es`, `menus-zh`, `accessibility`,
`boot-cinematic`, `tutorial`, `gameplay-fight`, `flashback`, `boss`,
`ending-kill`, `ending-pacifist`.

### Add a reel

Append an entry to `REELS` in `qa/reels.ts`:

```ts
{
  id: "pause-menu",
  topic: "menus",
  title: "Pause during sector 2, every pause option, resume",
  query: "?skipto=sector2&seed=121&qa=1",
  settings: { textLang: "es" },         // optional, preseeded before load
  steps: [
    { do: "wait", ms: 2000 },
    { do: "press", key: "Escape" },
    { do: "waitFor", selector: ".nw-screen-pause", label: "pause opens" },
    { do: "assertNoOverflow", label: "pause menu fits" },
  ],
  maxSeconds: 30,
  needs: [],                             // known missing prerequisites
}
```

Step kinds are documented on the `Step` type. Drive with keys like a
player; `until` reads the QA probe (`window.__nwqa`, see REQUESTS.md) for
beats pixels cannot prove. Compress time with `autoplay=...&speed=N` rather
than long waits. If a reel needs something that does not exist yet, list it
in `needs` and file it in `REQUESTS.md`; the reel then reports pending
instead of failing.

## Citing reports (rule for every agent)

Before reporting a workstream done, run the checks that cover it
(`qa:static` always; the reels for your topic) and put in your final
message:

1. the report path, e.g. `qa/reports/20261028-185016/index.html`
2. the contents of that run's `summary.txt` (under 40 lines), or the lines
   that concern your workstream
3. any `fail` you are leaving, with why, and any `pending` you are adding

Do not paste videos or large JSON into context. Look at `sheet.jpg` for a
reel; open the WebM only to review a specific beat.

## How the checks work, briefly

- **Width ratio** uses estimated rendered width, not character count: a
  CJK character counts 1.8 Latin characters. Ratios above 1.35 are a
  warning; the menus reels then measure real overflow (`scrollWidth >
  clientWidth`, or a child escaping its panel) in the browser and fail on it.
- **Reference scan** is static: string literals in `src/scenes`, `src/ui`,
  `src/director` and `main.ts` that look like line ids must exist in a
  table. Template prefixes (`ui.settings.tab.${tab}`) must match at least
  one id.
- **glTF** is a light structural read (container, chunks, buffer ranges,
  triangle count, node names), not the full Khronos validator.
- **Blank-frame check** is a proxy: a 1280x720 JPEG of a blank frame is a
  few KB; a rendered scene is tens of KB.
