/**
 * Moments gallery, step 1: long A/V captures of real runs with a timestamped
 * event log on the capture clock.
 *
 *   deno run -A --no-lock research/2026-10-28-moments/capture.ts [id ...]
 *
 * Reuses qa/ as a library: `serve` and `launch` from qa/capture.ts, the
 * audio tap (`installAv`, `flushAv`, `finishAv`) from qa/av.ts, so the mix
 * in each capture.mp4 is exactly what QA reels hear. On top of that an init
 * script wraps `window.__nwqa.log.push` and `.events.push` so every entry
 * gets a wall-clock stamp (the probe itself keeps none), and polls a few DOM
 * signals (intel tag, radio lines, banners, continue screen, PAY readout).
 *
 * Serves `.build/` (a private Vite build, see README), never qa/.build.
 */

import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";
import type { Page } from "npm:playwright@1.58.2";

const HERE = new URL(".", import.meta.url).pathname;
const BUILD = `${HERE}.build`;
const OUT = `${HERE}captures`;
const VIEWPORT = { width: 1280, height: 720 };
const GAME = "&seed=121&qa=1";

type Step =
  | { do: "wait"; ms: number }
  | { do: "press"; key: string; times?: number; gapMs?: number }
  | { do: "waitFor"; selector: string; timeoutMs?: number }
  | { do: "until"; probe: string; timeoutMs: number; label: string }
  | { do: "navigate"; key: string }
  | { do: "advanceTo"; screen: string; max?: number };

interface Capture {
  id: string;
  title: string;
  query: string;
  steps: Step[];
  /** Hard stop for the whole capture. */
  maxSeconds: number;
}

const BOOT_TO_MENU: Step[] = [
  { do: "waitFor", selector: ".nw-screen-gate", timeoutMs: 15_000 },
  { do: "advanceTo", screen: "notice", max: 3 },
  { do: "advanceTo", screen: "title", max: 12 },
  { do: "advanceTo", screen: "main", max: 4 },
];

const has = (type: string, extra = "true") =>
  `p.events.some((e) => e.type === '${type}' && (${extra}))`;

const CAPTURES: Capture[] = [
  {
    id: "tutorial",
    title:
      "Tutorial, fight autopilot at 8x (2x stalls at the tap module), through the wink to sector 1",
    query: `?skipto=tutorial&autoplay=fight&speed=8${GAME}`,
    steps: [
      {
        do: "until",
        probe: "p.log.includes('line:tut_wink_001')",
        timeoutMs: 150_000,
        label: "wink line",
      },
      {
        do: "until",
        probe: "p.flags()['tut.complete'] === true",
        timeoutMs: 60_000,
        label: "tutorial complete",
      },
      { do: "wait", ms: 6000 },
    ],
    maxSeconds: 200,
  },
  {
    id: "fight-s1",
    title: "Sector 1, fight autopilot at 1x: scans, Writs, kills, chatter",
    query: `?skipto=sector1&autoplay=fight&speed=1${GAME}`,
    steps: [{ do: "wait", ms: 80_000 }],
    maxSeconds: 85,
  },
  {
    id: "fight-s3",
    title: "Sector 3, fight autopilot at 2x: the recorder and the flashback",
    query: `?skipto=sector3&autoplay=fight&speed=2${GAME}`,
    steps: [
      {
        do: "until",
        probe: "p.log.some((l) => l === 'scene:flashback')",
        timeoutMs: 120_000,
        label: "flashback starts",
      },
      {
        do: "until",
        probe: "p.scene() === 'play'",
        timeoutMs: 90_000,
        label: "flashback returns to play",
      },
      { do: "wait", ms: 8000 },
    ],
    maxSeconds: 220,
  },
  {
    id: "disarm-s2",
    title: "Sector 2, disarmer autopilot at 2x: disarms, grazes, near misses",
    query: `?skipto=sector2&autoplay=pacifist&speed=2${GAME}`,
    steps: [{ do: "wait", ms: 80_000 }],
    maxSeconds: 85,
  },
  {
    id: "boss-fight",
    title: "Warden, fight autopilot at 2x: descent, pods, core, phases, kill",
    query: `?skipto=boss&autoplay=fight&speed=2${GAME}`,
    steps: [
      {
        do: "until",
        probe: has("bossDefeated"),
        timeoutMs: 240_000,
        label: "Warden defeated",
      },
      {
        do: "until",
        probe: "p.log.includes('line:kill_ai_004')",
        timeoutMs: 90_000,
        label: "kill ending replacement line",
      },
      { do: "wait", ms: 5000 },
    ],
    maxSeconds: 360,
  },
  {
    id: "boss-pacifist",
    title: "Warden, disarmer autopilot at 2x: pods, core, survived, Lanes Kept",
    query: `?skipto=boss&autoplay=pacifist&speed=2${GAME}`,
    steps: [
      {
        do: "until",
        probe: "p.timeline() === 'ending-pacifist'",
        timeoutMs: 300_000,
        label: "pacifist ending",
      },
      {
        do: "until",
        probe: "p.flags()['banner.lanesKept'] === true",
        timeoutMs: 90_000,
        label: "Lanes Kept",
      },
      { do: "wait", ms: 8000 },
    ],
    maxSeconds: 420,
  },
  {
    id: "hangar",
    title: "Cold boot to main menu, hangar, cycle packages and cosmetics",
    query: "?qa=1",
    steps: [
      ...BOOT_TO_MENU,
      { do: "navigate", key: "hangar" },
      { do: "press", key: "Enter" },
      { do: "waitFor", selector: ".nw-screen-hangar" },
      { do: "wait", ms: 2500 },
      { do: "press", key: "ArrowRight", times: 3, gapMs: 2200 },
      { do: "navigate", key: "hangar-sensor" },
      { do: "press", key: "ArrowRight", times: 2, gapMs: 2200 },
      { do: "navigate", key: "hangar-paint" },
      { do: "press", key: "ArrowRight", times: 3, gapMs: 1800 },
      { do: "navigate", key: "hangar-trim" },
      { do: "press", key: "ArrowRight", times: 2, gapMs: 1800 },
      { do: "navigate", key: "hangar-trail" },
      { do: "press", key: "ArrowRight", times: 2, gapMs: 1800 },
      { do: "press", key: "ArrowDown", times: 8, gapMs: 600 },
      { do: "wait", ms: 2000 },
    ],
    maxSeconds: 120,
  },
  {
    id: "continue",
    title:
      "Sector 5 with no pilot input: lives lost, game over, continue screen",
    query: `?skipto=sector5${GAME}`,
    steps: [
      {
        do: "waitFor",
        selector: ".nw-screen-continue",
        timeoutMs: 200_000,
      },
      { do: "wait", ms: 4000 },
      { do: "press", key: "ArrowDown", gapMs: 1200 },
      { do: "press", key: "ArrowUp", gapMs: 1500 },
    ],
    maxSeconds: 220,
  },
];

// -- page side: timestamped probe entries and DOM signals

function pageMoments() {
  const now = () => performance.timeOrigin + performance.now();
  const post = (m: unknown) =>
    (globalThis as unknown as { __nwMoments: (m: unknown) => void })
      .__nwMoments(m);
  let probe: unknown;
  Object.defineProperty(globalThis, "__nwqa", {
    configurable: true,
    get: () => probe,
    set(v: { log: string[]; events: unknown[] }) {
      probe = v;
      const logPush = v.log.push.bind(v.log);
      v.log.push = (...xs: string[]) => {
        for (const x of xs) {
          if (!x.startsWith("sim:")) post({ k: "log", epoch: now(), e: x });
        }
        return logPush(...xs);
      };
      const evPush = v.events.push.bind(v.events);
      v.events.push = (...xs: unknown[]) => {
        for (const x of xs) post({ k: "ev", epoch: now(), e: x });
        return evPush(...xs);
      };
    },
  });
  // DOM signals: post on change only.
  const last: Record<string, string> = {};
  const signal = (name: string, value: string) => {
    if (last[name] === value) return;
    last[name] = value;
    post({ k: "dom", epoch: now(), name, value });
  };
  const visible = (el: Element | null) =>
    !!el && (el as HTMLElement).offsetParent !== null;
  const text = (sel: string) =>
    [...document.querySelectorAll(sel)].filter(visible).map((e) =>
      (e.textContent ?? "").trim().replace(/\s+/g, " ")
    ).join(" | ").slice(0, 200);
  setInterval(() => {
    signal("intel", text(".nw-intel-tag"));
    signal("radio", text(".nw-radio-line"));
    signal("banner", text(".nw-banner"));
    signal("continue", text(".nw-screen-continue"));
    signal("hangar", text(".nw-hangar-stats"));
    signal("pay", text("[class*='pay']"));
    signal("graze", text(".nw-hud-graze"));
    const screens = [...document.querySelectorAll(".nw-screen")].filter(
      visible,
    ).map((s) => [...s.classList].find((c) => c.startsWith("nw-screen-")))
      .join(",");
    signal("screen", screens);
  }, 100);
}

// -- driver

async function visibleSel(page: Page, sel: string): Promise<boolean> {
  return await page.evaluate(
    (s) =>
      [...document.querySelectorAll<HTMLElement>(s)].some((e) =>
        e.offsetParent !== null || getComputedStyle(e).position === "fixed"
      ),
    sel,
  );
}

async function run(
  page: Page,
  steps: Step[],
  deadline: number,
  notes: string[],
  t0: number,
) {
  const left = () => Math.max(1, deadline - Date.now());
  const at = () => ((Date.now() - t0) / 1000).toFixed(1);
  for (const s of steps) {
    if (Date.now() >= deadline) {
      notes.push(`time cap before ${s.do}`);
      return;
    }
    switch (s.do) {
      case "wait":
        await page.waitForTimeout(Math.min(s.ms, left()));
        break;
      case "press":
        for (let i = 0; i < (s.times ?? 1); i++) {
          await page.keyboard.press(s.key);
          await page.waitForTimeout(Math.min(s.gapMs ?? 250, left()));
        }
        break;
      case "waitFor":
        try {
          await page.waitForSelector(s.selector, {
            state: "visible",
            timeout: Math.min(s.timeoutMs ?? 8000, left()),
          });
          notes.push(`${s.selector} at ${at()} s`);
        } catch {
          notes.push(`MISSING ${s.selector}`);
        }
        break;
      case "advanceTo":
        for (let i = 0; i <= (s.max ?? 6); i++) {
          if (await visibleSel(page, `.nw-screen-${s.screen}`)) break;
          await page.keyboard.press("Enter");
          await page.waitForTimeout(700);
        }
        break;
      case "navigate": {
        let ok = false;
        for (let i = 0; i < 16 && !ok; i++) {
          ok = await page.evaluate(() =>
            (document.activeElement as HTMLElement | null)?.dataset?.key ?? ""
          ) === s.key;
          if (!ok) {
            await page.keyboard.press("ArrowDown");
            await page.waitForTimeout(140);
          }
        }
        if (!ok) {
          const found = await page.evaluate((k) => {
            const el = document.querySelector<HTMLElement>(`[data-key="${k}"]`);
            el?.focus();
            return !!el;
          }, s.key);
          notes.push(
            found
              ? `navigate ${s.key}: script focus`
              : `MISSING control ${s.key}`,
          );
        }
        break;
      }
      case "until": {
        const end = Date.now() + Math.min(s.timeoutMs, left());
        let ok = false;
        while (Date.now() < end && !ok) {
          ok = !!(await page.evaluate(
            `((p) => p && (${s.probe}))(globalThis.__nwqa)`,
          ).catch(() => false));
          if (!ok) await page.waitForTimeout(250);
        }
        notes.push(ok ? `${s.label} at ${at()} s` : `MISSING ${s.label}`);
        break;
      }
    }
  }
}

async function capture(c: Capture, base: string) {
  const dir = `${OUT}/${c.id}`;
  await Deno.remove(dir, { recursive: true }).catch(() => {});
  await Deno.mkdir(`${dir}/raw`, { recursive: true });
  const browser = await launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: `${dir}/raw`, size: VIEWPORT },
  });
  const moments: { k: string; epoch: number; [k: string]: unknown }[] = [];
  await context.exposeFunction(
    "__nwMoments",
    (m: { k: string; epoch: number }) => moments.push(m),
  );
  await context.addInitScript(pageMoments);
  const av = await installAv(context);
  const errors: string[] = [];
  const before = Date.now();
  const page = await context.newPage();
  av.videoEpoch = (before + Date.now()) / 2;
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  const notes: string[] = [];
  const t0 = Date.now();
  console.log(`[${c.id}] ${c.title}`);
  try {
    await page.goto(base + c.query);
    await run(page, c.steps, t0 + c.maxSeconds * 1000, notes, t0);
  } catch (err) {
    notes.push(`ERROR ${String(err).split("\n")[0]}`);
  }
  const wall = (Date.now() - t0) / 1000;
  await flushAv(page);
  const handle = page.video();
  await context.close();
  await browser.close();
  const raw = handle ? await handle.path() : null;
  if (!raw) throw new Error(`${c.id}: no video`);
  const webm = `${dir}/video.webm`;
  await Deno.rename(raw, webm);
  await Deno.remove(`${dir}/raw`, { recursive: true });
  const probe = await new Deno.Command("ffprobe", {
    args: [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      webm,
    ],
    stdout: "piped",
  }).output();
  const dur = Number(new TextDecoder().decode(probe.stdout).trim()) || wall;
  const { av: result, checks } = await finishAv(av, dir, webm, dur, {
    spatial: true,
  });
  await Deno.rename(`${dir}/reel.mp4`, `${dir}/capture.mp4`);
  await Deno.remove(webm);
  const t = (epoch: number) => Math.round(av.t(epoch) * 1000) / 1000;
  const timeline = {
    id: c.id,
    title: c.title,
    query: c.query,
    seconds: dur,
    notes,
    errors: errors.slice(0, 50),
    checks,
    av: result,
    entries: moments.map(({ epoch, ...rest }) => ({ t: t(epoch), ...rest })),
    subs: av.subs.map(({ epoch, ...rest }) => ({ t: t(epoch), ...rest })),
    words: av.words.map(({ epoch, ...rest }) => ({ t: t(epoch), ...rest })),
    sources: av.sources.map(({ epoch, ...rest }) => ({
      t: t(epoch),
      ...rest,
      url: rest.url.replace(/^https?:\/\/[^/]+\//, ""),
    })),
  };
  await Deno.writeTextFile(
    `${dir}/timeline.json`,
    JSON.stringify(timeline, null, 1),
  );
  console.log(
    `[${c.id}] ${
      dur.toFixed(1)
    } s, ${moments.length} entries, ${av.subs.length} sub changes, LUFS ${result.lufs}; ${
      notes.join("; ")
    }`,
  );
}

const want = Deno.args;
const server = serve(BUILD);
for (const c of CAPTURES) {
  if (want.length && !want.includes(c.id)) continue;
  try {
    await capture(c, server.url);
  } catch (err) {
    console.log(`[${c.id}] FAILED ${String(err).slice(0, 300)}`);
  }
}
await server.close();
