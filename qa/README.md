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
  av.ts          audio for reels: connect tap, VO and spatial stems, mux, AV checks
  judge.ts       paid AV judge (Gemini Argon, ZDR) with per-topic rubrics, cache, canary
  reels.ts       the reel list: data, one entry per video
  probe.ts       watch window.__nwqa live for a query (writing `until` steps)
  budgets.ts     triangle and byte budgets, animated nodes, third-party list
  report.ts      dashboard HTML, summary.json, summary.txt
  lib/           pure helpers (text widths, id scan, GLB reader, audio math, canary) with tests
  REQUESTS.md    flags, hooks and tasks QA needs from the integration pass
  reports/       output, one folder per run, plus latest -> newest
```

All TypeScript under Deno. Media steps shell out to `ffmpeg`/`ffprobe`;
browsers are Playwright 1.58.2's Chromium (already cached on this machine).

## Run

| Want                         | Task                                        | Long form                                               |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| coverage and assets, seconds | `deno task qa:static`                       | `deno run -A --no-lock qa/qa.ts static`                 |
| one or more reels            | `deno task qa:reel boss`                    | `deno run -A --no-lock qa/qa.ts reel boss menus-es`     |
| a topic                      | `deno task qa:topic menus`                  | `deno run -A --no-lock qa/qa.ts topic menus`            |
| everything (8–10 min)        | `deno task qa`                              | `deno run -A --no-lock qa/qa.ts`                        |
| list reels                   | `deno task qa:list`                         | `deno run -A --no-lock qa/qa.ts list`                   |
| watch the probe              | `deno task qa:probe "?skipto=boss&qa=1" 20` | `deno run -A --no-lock qa/probe.ts --build ...`         |
| judge reels (paid)           | `deno task qa:judge boss` (task requested)  | `deno run -A --no-lock qa/judge.ts boss menus-en`       |
| capture and judge in one run | `deno task qa:reel boss --judge=boss`       | `deno run -A --no-lock qa/qa.ts reel boss --judge=boss` |

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
cinematics, gameplay, endings, audio. Never one long capture. Each reel
writes `reels/<id>/reel.mp4` (1280x720 H.264 with the game's stereo audio,
capped at `maxSeconds`, at most 60), `sheet.jpg` (six 320x180 frames),
`errors.txt`, `av.json` (sound starts, subtitle windows, loudness) and
`result.json`; `judge.json` too once judged.

Current reels: `menus-en`, `menus-es`, `menus-zh`, `accessibility`,
`boot-cinematic`, `tutorial`, `gameplay-fight`, `flashback`, `boss`,
`ending-kill`, `ending-pacifist`, and wave 3: `hangar`, `scan-lock`,
`disarm-boss`, `graze`, `spatial-audio`, `subtitle-word-pulse`,
`vo-no-drop`. A reel's `requires` names code another agent owes; until a
file under its path matches its pattern, the reel's failures report as
pending (crashes still fail).

## Audio in reels (qa/av.ts)

An init script patches `AudioNode.prototype.connect`: whatever reaches the
speakers is also recorded (the mix); buffers fetched from `vo/` also feed a
pre-fader VO stem; every panner's output feeds a spatial stem. Chunks
stream out as they are recorded, so `goto` steps keep their sound. QA
resumes a suspended AudioContext (the sound right after the gate press).
Checks on every reel: audio captured; true peak at or under -1 dBTP;
**VO not dropped** (each subtitle window has audible VO stem, by ffmpeg
`silencedetect` at -50 dB). Opt-in: `av: { spatial: true }` (5th–95th
percentile L/R balance of the spatial stem spans 0.3 and crosses centre;
correlation with enemy x once the probe exposes it) and
`av: { wordPulse: true }` (each `.nw-word.is-spoken` highlight within 80 ms
of the cue's word timing, after fitting the line's start offset).

## The judge (qa/judge.ts)

`google/gemini-4-argon` on OpenRouter, ZDR endpoints only. Listen first:
the model lists every voice line it hears (times and transcript) before
scoring a rubric chosen by the reel's topic (`RUBRICS`), then gives five
timestamped fixes. The transcript is a canary, compared with
`vo/script.yaml` and with the VO stem's audible spans; a judgment that
fails is shown greyed out as untrusted. Judgments are cached in
`qa/.build/judge-cache/` by a hash of the reel bytes, prompt and model, so
re-running costs nothing. Each paid call appends a row to
`research/SPEND.md`; the judge refuses to call once its rows would pass
the wave budget (`WAVE_BUDGET_USD`, US $4). About US $0.04 per minute of
reel. The dashboard shows scores and transcript beside each reel, and
every report is compared with the previous one (status and judge mean).

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
than long waits: auto-play runs the sim N times faster and the Director's
scene clock min(N, 8) times faster, so scenes keep pace and lines cut each
other short. In the tutorial, auto-play also performs the movement and focus
prompts (`src/app/tutorialDemo.ts`).

The probe (`src/app/qaProbe.ts`): `scene()`, `timeline()`, `sim()` (tick,
sector, phase, outcome, kills, shotsFired, frozen), `flags()` (story flags
this run), `log` (`sim:`, `scene:`, `line:`, `bark:` entries) and `events`
(sim events with fields). Per-shot events are left out of both logs. To see
what a query actually does before writing `until` steps, run
`deno task qa:probe "<query>" <seconds> [interval]` (add `--build` after a
source change; it otherwise reuses the last reel build). If a reel needs something that does not exist yet, list it
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
