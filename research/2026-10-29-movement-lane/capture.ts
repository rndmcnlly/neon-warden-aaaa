/**
 * Before/after A/V capture for movement, lane floor, debris and VO sync
 * (night plan step 4b). Adapted from research/2026-10-29-core-feedback/:
 * serves a frozen archive build on a free port (never 8123 or 4321), taps
 * the real game audio (`qa/av.ts`), drives scripted clips with held keys and
 * keeps a truth log (probe events, buffer starts) in recording seconds.
 * Voice and subtitles are off except in the tutorial VO clip. Normal speed.
 *
 * deno run -A --no-lock capture.ts <dist> <outDir> [clip ids]
 */

import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";

const [dist, out, ...only] = Deno.args;
const VIEWPORT = { width: 1280, height: 720 };
const SETTINGS = {
  audio: { master: 0.8, music: 0.7, sfx: 0.8, voice: 0, ui: 0.6, mono: false },
  subtitles: {
    enabled: false,
    scale: 1,
    bgOpacity: 0.6,
    speakerNames: true,
    maxLines: 2,
  },
};

const VO_SETTINGS = {
  audio: { ...SETTINGS.audio, voice: 1 },
  subtitles: { ...SETTINGS.subtitles, enabled: true },
};

const DRY_SETTINGS = {
  audio: { ...SETTINGS.audio, music: 0 },
  subtitles: SETTINGS.subtitles,
  accessibility: { difficulty: "story" },
};

const settingsFor = (clip: Clip) =>
  clip.dry
    ? DRY_SETTINGS
    : clip.vo
    ? VO_SETTINGS
    : clip.story
    ? { ...SETTINGS, accessibility: { difficulty: "story" } }
    : SETTINGS;

type Page = import("npm:playwright@1.58.2").Page;
type Act = (page: Page, mark: (label: string) => void) => Promise<void>;

interface Clip {
  readonly id: string;
  readonly query: string;
  readonly recordS: number;
  readonly act: Act;
  /** Manual clips fly on story difficulty so an unarmed ship survives. */
  readonly story?: boolean;
  /** Voice and subtitles on (the VO sync clip). */
  readonly vo?: boolean;
  /** Music muted: measures the movement sound itself, not the mix. */
  readonly dry?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of keys.reverse()) await page.keyboard.up(k);
}

/** Sweep left and right until `stop()` says so, in parallel with firing. */
async function sweep(page: Page, stop: () => boolean, legMs = 900) {
  let dir = "ArrowLeft";
  await hold(page, [dir], legMs / 2);
  while (!stop()) {
    dir = dir === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
    await hold(page, [dir], legMs);
  }
}


const GAME = "&seed=121&qa=1";

const CLIPS: Clip[] = [
  {
    // MOVE alone: no fire. Starts, a held cruise, reversals, a stop, then
    // the same in focus, then diagonals. Marks name every direction change.
    id: "move",
    story: true,
    query: `?skipto=sector1${GAME}`,
    recordS: 22,
    act: async (page, mark) => {
      await sleep(3500);
      const legs: [string[], number, string][] = [
        [["ArrowLeft"], 700, "start left"],
        [["ArrowRight"], 900, "reverse right"],
        [["ArrowLeft"], 500, "reverse left"],
        [[], 600, "stop"],
        [["ArrowUp"], 500, "start up"],
        [["ArrowDown"], 500, "reverse down"],
        [[], 600, "stop"],
      ];
      for (const [keys, ms, label] of legs) {
        mark(label);
        if (keys.length) await hold(page, keys, ms);
        else await sleep(ms);
      }
      mark("focus on (held)");
      await page.keyboard.down("ShiftLeft");
      for (const [keys, ms, label] of legs) {
        mark(`focus: ${label}`);
        if (keys.length) await hold(page, keys, ms);
        else await sleep(ms);
      }
      await page.keyboard.up("ShiftLeft");
      mark("focus off");
      await sleep(400);
      mark("diagonal up-right");
      await hold(page, ["ArrowUp", "ArrowRight"], 600);
      mark("reverse diagonal down-left");
      await hold(page, ["ArrowDown", "ArrowLeft"], 600);
      mark("stop");
    },
  },
  {
    // The same flight with music muted, for measuring the engine bed.
    id: "move-sfx",
    dry: true,
    query: `?skipto=sector1${GAME}`,
    recordS: 22,
    act: (page, mark) => CLIPS[0].act(page, mark),
  },
  {
    // The lane floor in combat, sector 1 (blue).
    id: "lane-s1",
    query: `?skipto=sector1&autoplay=fight&speed=1${GAME}`,
    recordS: 16,
    act: () => sleep(15_000),
  },
  {
    // The lane floor in combat, sector 3 (a different world look).
    id: "lane-s3",
    query: `?skipto=sector3&autoplay=fight&speed=1${GAME}`,
    recordS: 16,
    act: () => sleep(15_000),
  },
  {
    // Disarms in sector 2 under the pacifist autopilot: flung debris.
    id: "debris",
    query: `?skipto=sector2&autoplay=pacifist&speed=1${GAME}`,
    recordS: 45,
    act: () => sleep(44_000),
  },
  {
    // Warden pod breaks under the pacifist autopilot: heavy flung debris
    // mid-screen (sector disarms mostly happen at the top edge).
    id: "debris-boss",
    query: `?skipto=boss&autoplay=pacifist&speed=1${GAME}`,
    recordS: 75,
    act: () => sleep(74_000),
  },
  {
    // Tutorial voice with subtitles: does the subtitle arrive with the voice?
    id: "tutorial-vo",
    vo: true,
    query: `?skipto=tutorial&autoplay=fight&speed=1${GAME}`,
    recordS: 40,
    act: () => sleep(39_000),
  },
];

/** Page-side: poll the probe every 30 ms; keep new events and shot deltas. */
function poller() {
  const log: unknown[] = [];
  (globalThis as unknown as { __argon: unknown[] }).__argon = log;
  const seen = new WeakSet<object>();
  let shots = 0;
  let lastTick = -1;
  setInterval(() => {
    // deno-lint-ignore no-explicit-any
    const p = (globalThis as any).__nwqa;
    if (!p) return;
    const s = p.sim();
    if (s.tick < lastTick) log.push({ k: "tickReset", epoch: Date.now(), from: lastTick, to: s.tick });
    lastTick = s.tick;
    if (s.shotsFired !== shots) {
      log.push({ k: "shots", epoch: Date.now(), n: s.shotsFired - shots });
      shots = s.shotsFired;
    }
    // Entries are fresh copies, so identity marks what we already logged.
    // Per-shot events live in their own buffer (absent on older probes).
    for (const ev of [...p.events, ...(p.impacts ?? [])] as object[]) {
      if (seen.has(ev)) continue;
      seen.add(ev);
      log.push({ k: "ev", epoch: Date.now(), ev });
    }
  }, 30);
}

const server = serve(dist);
const browser = await launch();
await Deno.mkdir(out, { recursive: true });

for (const clip of CLIPS.filter((c) => !only.length || only.includes(c.id))) {
  const dir = `${out}/${clip.id}`;
  await Deno.mkdir(`${dir}/raw`, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: `${dir}/raw`, size: VIEWPORT },
  });
  await context.addInitScript((value: string) => {
    if (sessionStorage.getItem("nwqa.seeded")) return;
    sessionStorage.setItem("nwqa.seeded", "1");
    localStorage.setItem("neon-warden.settings", value);
  }, JSON.stringify({ version: 1, settings: settingsFor(clip) }));
  await context.addInitScript(poller);
  const av = await installAv(context);
  const before = Date.now();
  const page = await context.newPage();
  av.videoEpoch = (before + Date.now()) / 2;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  const marks: { t: number; label: string }[] = [];
  const mark = (label: string) => marks.push({ t: av.t(Date.now()), label });
  await page.goto(server.url + clip.query);
  const t0 = Date.now();
  await clip.act(page, mark);
  const rest = clip.recordS * 1000 - (Date.now() - t0);
  if (rest > 0) await sleep(rest);
  const truth = await page.evaluate(() =>
    (globalThis as unknown as { __argon: unknown[] }).__argon
  );
  await flushAv(page);
  const handle = page.video();
  await context.close();
  const raw = await handle!.path();
  const webm = `${dir}/video.webm`;
  await Deno.rename(raw, webm);
  await Deno.remove(`${dir}/raw`, { recursive: true });
  const seconds = (Date.now() - before) / 1000;
  const { av: result, checks } = await finishAv(av, dir, webm, seconds, {});
  await Deno.remove(webm);
  const t = (e: number) => Math.round(av.t(e) * 1000) / 1000;
  await Deno.writeTextFile(
    `${dir}/truth.json`,
    JSON.stringify(
      {
        clip: clip.id,
        query: clip.query,
        settings: settingsFor(clip),
        errors,
        marks,
        checks: checks.map((c) => `${c.status} ${c.id}: ${c.detail}`),
        av: {
          lufs: result.lufs,
          truePeak: result.truePeak,
          buses: result.buses,
          audibleS: result.audibleS,
          voStarted: result.voStarted,
        },
        sources: av.sources.map((s) => ({
          t: t(s.epoch),
          url: s.url.replace(/^.*\/(sfx|music|vo)\//, "$1/"),
          dur: Math.round(s.dur * 100) / 100,
          loop: s.loop,
        })),
        subs: av.subs.map((s) => ({ t: t(s.epoch), ...s, epoch: undefined })),
        log: (truth as { k: string; epoch: number }[]).map((x) => ({
          ...x,
          t: t(x.epoch),
          epoch: undefined,
        })),
      },
      null,
      1,
    ),
  );
  console.log(
    `${clip.id}: ${seconds.toFixed(1)} s, errors ${errors.length}, ${
      checks.map((c) => `${c.id}=${c.status}`).join(" ")
    }`,
  );
}
await browser.close();
await server.close();
