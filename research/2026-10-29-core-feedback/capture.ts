/**
 * Before/after A/V capture for core feedback (night plan step 4a).
 *
 * Adapted from research/2026-10-29-argon-core-ideation/capture.ts: serves a
 * frozen archive build on a free port (never 8123 or 4321), taps the real
 * game audio (`qa/av.ts`), drives scripted clips with held keys, and keeps a
 * truth log (probe events, buffer starts) in recording seconds. Lore is
 * suppressed through settings (voice 0, subtitles off). Normal speed only.
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

const settingsFor = (clip: Clip) =>
  clip.story ? { ...SETTINGS, accessibility: { difficulty: "story" } } : SETTINGS;

type Page = import("npm:playwright@1.58.2").Page;
type Act = (page: Page, mark: (label: string) => void) => Promise<void>;

interface Clip {
  readonly id: string;
  readonly query: string;
  readonly recordS: number;
  readonly act: Act;
  /** Manual clips fly on story difficulty so an unarmed ship survives. */
  readonly story?: boolean;
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
    // Writ 1 and Writ 3, scripted rests, sweeping so some hit and some miss.
    id: "writ",
    story: true,
    query: `?skipto=sector1${GAME}`,
    recordS: 30,
    act: async (page, mark) => {
      await sleep(4000);
      let done = false;
      const moving = sweep(page, () => done, 1600);
      for (let i = 0; i < 4; i++) {
        await sleep(900);
        mark("press after 0.9 s rest (Writ 1 expected)");
        await hold(page, ["Space"], 60);
        await sleep(2400);
        mark("press after 2.4 s rest (Writ 3 expected)");
        await hold(page, ["Space"], 60);
      }
      done = true;
      await moving;
    },
  },
  {
    // Writ 1 only, from the lane's center, where drones descend.
    id: "writ1",
    story: true,
    query: `?skipto=sector1${GAME}`,
    recordS: 26,
    act: async (page, mark) => {
      await sleep(3500);
      for (let i = 0; i < 18; i++) {
        await sleep(1000);
        mark("press after 1.0 s rest (Writ 1 expected)");
        await hold(page, ["Space"], 60);
      }
    },
  },
  {
    // Ramming forward while streaming: same-tick kill and life lost.
    id: "ram",
    story: true,
    query: `?skipto=sector1${GAME}`,
    recordS: 34,
    act: async (page, mark) => {
      await sleep(3500);
      let done = false;
      const moving = sweep(page, () => done, 1200);
      for (let i = 0; i < 6; i++) {
        mark("stream + push up-lane");
        await hold(page, ["Space", "ArrowUp"], 2600);
        await hold(page, ["ArrowDown"], 900);
      }
      done = true;
      await moving;
    },
  },
  {
    id: "disarm",
    query: `?skipto=sector2&autoplay=pacifist&speed=1${GAME}`,
    recordS: 50,
    act: () => sleep(49_000),
  },
  {
    id: "boss-fight",
    query: `?skipto=boss&autoplay=fight&speed=1${GAME}`,
    recordS: 80,
    act: () => sleep(79_000),
  },
  {
    id: "boss-pacifist",
    query: `?skipto=boss&autoplay=pacifist&speed=1${GAME}`,
    recordS: 75,
    act: () => sleep(74_000),
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
