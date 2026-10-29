/**
 * Takes: real-time A/V captures of a frozen build, cached by recipe hash.
 *
 * A take is the expensive unit (minutes of real-time play); shots are cheap
 * trims of takes. Each take is recorded once per (recipe, build) and lands
 * in trailer/.cache/takes/<id>-<lang|any>-<hash>/ with take.mp4 (the game's
 * own stereo mix through qa/av.ts, so capture hears what QA hears) and
 * timeline.json (probe log, sim events and DOM signals on the video clock).
 *
 * Reuses qa/ as a library, as the moments gallery does: `serve`/`launch`
 * from qa/capture.ts and the audio tap from qa/av.ts.
 */

import { launch, serve } from "../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../qa/av.ts";
import type { Page } from "npm:playwright@1.58.2";
import { type ResolvedTake, ROOT, type Step, takeKey } from "./plan.ts";

export const CACHE = `${ROOT}trailer/.cache`;
const BUILD = `${CACHE}/build`;

// -- frozen build

export interface BuildInfo {
  id: string;
  rev: string;
  dirty: boolean;
  builtAt: string;
}

async function git(...args: string[]): Promise<string> {
  const o = await new Deno.Command("git", { args, cwd: ROOT, stdout: "piped" })
    .output();
  return new TextDecoder().decode(o.stdout).trim();
}

async function hashDir(dir: string): Promise<string> {
  const files: string[] = [];
  const walk = async (d: string) => {
    for await (const e of Deno.readDir(d)) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory) await walk(p);
      else files.push(p);
    }
  };
  await walk(dir);
  files.sort();
  const parts: Uint8Array[] = [];
  for (const f of files) {
    parts.push(new TextEncoder().encode(f.slice(dir.length)));
    parts.push(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await Deno.readFile(f)),
      ),
    );
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("").slice(
    0,
    16,
  );
}

/**
 * The build every take runs against. Built once (Vite only, no `vo:sync`,
 * so public/vo is never touched while other agents work) and then frozen:
 * pass `rebuild` to replace it, which invalidates every cached take.
 */
export async function frozenBuild(rebuild = false): Promise<BuildInfo> {
  const infoPath = `${BUILD}/build.json`;
  if (!rebuild) {
    try {
      return JSON.parse(await Deno.readTextFile(infoPath));
    } catch { /* build below */ }
  }
  await Deno.mkdir(BUILD, { recursive: true });
  const o = await new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:vite@8.3.1",
      "build",
      "--outDir",
      `${BUILD}/dist`,
      "--emptyOutDir",
      "--logLevel",
      "warn",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!o.success) {
    throw new Error(
      `vite build failed:\n${new TextDecoder().decode(o.stderr).slice(-800)}`,
    );
  }
  const info: BuildInfo = {
    id: await hashDir(`${BUILD}/dist`),
    rev: await git("rev-parse", "--short", "HEAD"),
    dirty:
      (await git("status", "--porcelain", "--", "src", "public")).length > 0,
    builtAt: new Date().toISOString(),
  };
  await Deno.writeTextFile(infoPath, JSON.stringify(info, null, 1));
  return info;
}

// -- page side: timestamped probe entries and DOM signals (moments pattern)

function pageTimeline() {
  const now = () => performance.timeOrigin + performance.now();
  const post = (m: unknown) =>
    (globalThis as unknown as { __nwTrailer: (m: unknown) => void })
      .__nwTrailer(m);
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
  const last: Record<string, string> = {};
  const visible = (el: Element) =>
    (el as HTMLElement).offsetParent !== null ||
    getComputedStyle(el).position === "fixed";
  setInterval(() => {
    const screens = [...document.querySelectorAll(".nw-screen")].filter(visible)
      .map((s) => [...s.classList].find((c) => c.startsWith("nw-screen-")))
      .join(",");
    if (last.screen !== screens) {
      last.screen = screens;
      post({ k: "dom", epoch: now(), name: "screen", value: screens });
    }
  }, 100);
}

// -- step interpreter: the interactive subset of qa/reels.ts steps

async function visibleSel(page: Page, sel: string): Promise<boolean> {
  return await page.evaluate(
    (s) =>
      [...document.querySelectorAll<HTMLElement>(s)].some((e) =>
        e.offsetParent !== null || getComputedStyle(e).position === "fixed"
      ),
    sel,
  );
}

async function runSteps(
  page: Page,
  base: string,
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
    const n = (k: string, d: number) => (s[k] as number | undefined) ?? d;
    const str = (k: string) => s[k] as string;
    switch (s.do) {
      case "wait":
        await page.waitForTimeout(Math.min(n("ms", 0), left()));
        break;
      case "press":
        for (let i = 0; i < n("times", 1); i++) {
          await page.keyboard.press(str("key"));
          await page.waitForTimeout(Math.min(n("gapMs", 250), left()));
        }
        break;
      case "goto":
        await page.goto(base + str("query"));
        break;
      case "waitFor":
        try {
          await page.waitForSelector(str("selector"), {
            state: "visible",
            timeout: Math.min(n("timeoutMs", 8000), left()),
          });
          notes.push(`${s.label ?? str("selector")} at ${at()} s`);
        } catch {
          notes.push(`MISSING ${s.label ?? str("selector")}`);
        }
        break;
      case "advanceTo":
        for (let i = 0; i <= n("max", 6); i++) {
          if (await visibleSel(page, `.nw-screen-${str("screen")}`)) break;
          await page.keyboard.press(str("key") ?? "Enter");
          await page.waitForTimeout(700);
        }
        break;
      case "navigate": {
        let ok = false;
        for (let i = 0; i < n("max", 16) && !ok; i++) {
          ok = await page.evaluate(() =>
            (document.activeElement as HTMLElement | null)?.dataset?.key ?? ""
          ) === str("key");
          if (!ok) {
            await page.keyboard.press("ArrowDown");
            await page.waitForTimeout(140);
          }
        }
        if (!ok) {
          await page.evaluate((k) => {
            document.querySelector<HTMLElement>(`[data-key="${k}"]`)?.focus();
          }, str("key"));
          notes.push(`navigate ${str("key")}: script focus`);
        }
        break;
      }
      case "settingsTabs": {
        const tabs = await page.locator(".nw-tab").count();
        for (let i = 0; i < tabs; i++) {
          await page.waitForTimeout(Math.min(n("holdMs", 900), left()));
          await page.keyboard.press("KeyE");
        }
        break;
      }
      case "until": {
        const end = Date.now() + Math.min(n("timeoutMs", 10000), left());
        let ok = false;
        while (Date.now() < end && !ok) {
          ok = !!(await page.evaluate(
            `((p) => p && (${str("probe")}))(globalThis.__nwqa)`,
          ).catch(() => false));
          if (!ok) await page.waitForTimeout(250);
        }
        notes.push(ok ? `${s.label} at ${at()} s` : `MISSING ${s.label}`);
        break;
      }
      default:
        // Assertions (assertNoOverflow, assertFrame, ...) and remaps are QA
        // concerns; a take only needs the footage.
        break;
    }
  }
}

// -- capture

export interface TakeResult {
  key: string;
  dir: string;
  cached: boolean;
  seconds: number;
  wallSeconds: number;
  notes: string[];
  errors: string[];
}

async function settingsIdentity(): Promise<{ key: string; version: number }> {
  const src = await Deno.readTextFile(`${ROOT}src/settings/store.ts`);
  return {
    key: src.match(/SETTINGS_KEY = "([^"]+)"/)?.[1] ?? "neon-warden.settings",
    version: Number(src.match(/SETTINGS_VERSION = (\d+)/)?.[1] ?? 1),
  };
}

export async function takeDir(t: ResolvedTake, build: BuildInfo) {
  const key = await takeKey(t, build.id);
  return { key, dir: `${CACHE}/takes/${key}` };
}

export async function captureTake(
  t: ResolvedTake,
  build: BuildInfo,
  log: (s: string) => void = console.log,
): Promise<TakeResult> {
  const { key, dir } = await takeDir(t, build);
  try {
    const meta = JSON.parse(await Deno.readTextFile(`${dir}/timeline.json`));
    return {
      key,
      dir,
      cached: true,
      seconds: meta.seconds,
      wallSeconds: meta.wallSeconds,
      notes: meta.notes,
      errors: meta.errors,
    };
  } catch { /* capture below */ }

  await Deno.remove(dir, { recursive: true }).catch(() => {});
  await Deno.mkdir(`${dir}/raw`, { recursive: true });
  const server = serve(`${BUILD}/dist`);
  const browser = await launch();
  const context = await browser.newContext({
    viewport: t.viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: `${dir}/raw`, size: t.viewport },
  });
  const entries: { k: string; epoch: number; [k: string]: unknown }[] = [];
  await context.exposeFunction(
    "__nwTrailer",
    (m: { k: string; epoch: number }) => entries.push(m),
  );
  await context.addInitScript(pageTimeline);
  if (Object.keys(t.settings).length) {
    const { key: sk, version } = await settingsIdentity();
    await context.addInitScript(({ key, value }) => {
      if (sessionStorage.getItem("nwtrailer.seeded")) return;
      sessionStorage.setItem("nwtrailer.seeded", "1");
      localStorage.setItem(key, value);
    }, { key: sk, value: JSON.stringify({ version, settings: t.settings }) });
  }
  const av = await installAv(context);
  const before = Date.now();
  const page = await context.newPage();
  av.videoEpoch = (before + Date.now()) / 2;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  const notes: string[] = [];
  const t0 = Date.now();
  log(`[take ${key}] ${t.query} (max ${t.maxSeconds} s)`);
  try {
    await page.goto(server.url + t.query);
    await runSteps(
      page,
      server.url,
      t.steps,
      t0 + t.maxSeconds * 1000,
      notes,
      t0,
    );
  } catch (err) {
    notes.push(`ERROR ${String(err).split("\n")[0]}`);
  }
  const wall = (Date.now() - t0) / 1000;
  await flushAv(page);
  const handle = page.video();
  await context.close();
  await browser.close();
  await server.close();
  const raw = handle ? await handle.path() : null;
  if (!raw) throw new Error(`${key}: no video`);
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
  const seconds = Number(new TextDecoder().decode(probe.stdout).trim()) || wall;
  const { av: avResult, checks } = await finishAv(av, dir, webm, seconds, {});
  await Deno.rename(`${dir}/reel.mp4`, `${dir}/take.mp4`);
  await Deno.remove(webm);
  const tt = (epoch: number) => Math.round(av.t(epoch) * 1000) / 1000;
  const timeline = {
    key,
    recipe: t,
    build,
    seconds,
    wallSeconds: (Date.now() - t0) / 1000,
    notes,
    errors: errors.slice(0, 50),
    checks,
    av: avResult,
    entries: entries.map(({ epoch, ...rest }) => ({ t: tt(epoch), ...rest })),
  };
  await Deno.writeTextFile(
    `${dir}/timeline.json`,
    JSON.stringify(timeline, null, 1),
  );
  log(
    `[take ${key}] ${seconds.toFixed(1)} s, ${entries.length} entries; ${
      notes.join("; ")
    }`,
  );
  return {
    key,
    dir,
    cached: false,
    seconds,
    wallSeconds: timeline.wallSeconds,
    notes,
    errors,
  };
}
