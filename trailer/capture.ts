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
import {
  flushMaster,
  FPS,
  installMaster,
  startGrabber,
  writeMasterWav,
} from "./master.ts";

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
  // TRAILER_BUILD_REV=<commit> builds an exported snapshot of that commit
  // (git archive) instead of the working tree, so other agents' uncommitted
  // edits cannot leak into the frozen build.
  const rev = Deno.env.get("TRAILER_BUILD_REV");
  let cwd = ROOT;
  if (rev) {
    const full = await git("rev-parse", "--short", rev);
    cwd = `${CACHE}/src-${full}/`;
    await Deno.remove(cwd, { recursive: true }).catch(() => {});
    await Deno.mkdir(cwd, { recursive: true });
    const tar = await new Deno.Command("sh", {
      args: ["-c", `git archive ${full} | tar -x -C '${cwd}'`],
      cwd: ROOT,
    }).output();
    if (!tar.success) throw new Error(`git archive ${full} failed`);
    await Deno.symlink(`${ROOT}node_modules`, `${cwd}node_modules`);
  }
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
    cwd,
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
    rev: await git("rev-parse", "--short", rev ?? "HEAD"),
    dirty: !rev &&
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

/**
 * Where steps get their time. Draft takes run on the wall clock; master
 * takes run on the page's virtual clock, where waiting means stepping (and
 * grabbing) frames, so a page that is never stepped never moves.
 */
interface StepClock {
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Master only: Playwright's own waits would stall a frozen page. */
  stepped: boolean;
  /**
   * The `roll` step: the take starts here. Steps before it are pre-roll
   * (stepped but not grabbed in master takes; trimmed off draft takes), so
   * long approaches cost little and `nth` anchors count from the roll.
   */
  roll?: () => void;
}

const wallClock = (page: Page, onRoll?: () => void): StepClock => ({
  now: () => Date.now(),
  sleep: (ms) => page.waitForTimeout(ms),
  stepped: false,
  roll: onRoll,
});

async function runSteps(
  page: Page,
  base: string,
  steps: Step[],
  deadline: number,
  notes: string[],
  t0: number,
  clock: StepClock = wallClock(page),
) {
  const left = () => Math.max(1, deadline - clock.now());
  const at = () => ((clock.now() - t0) / 1000).toFixed(1);
  for (const s of steps) {
    if (clock.now() >= deadline) {
      notes.push(`time cap before ${s.do}`);
      return;
    }
    const n = (k: string, d: number) => (s[k] as number | undefined) ?? d;
    const str = (k: string) => s[k] as string;
    switch (s.do) {
      case "roll":
        clock.roll?.();
        notes.push(`roll at ${at()} s`);
        break;
      case "wait":
        await clock.sleep(Math.min(n("ms", 0), left()));
        break;
      case "press":
        for (let i = 0; i < n("times", 1); i++) {
          await page.keyboard.press(str("key"));
          await clock.sleep(Math.min(n("gapMs", 250), left()));
        }
        break;
      case "goto":
        if (clock.stepped) {
          // A new document restarts the page clock and its audio contexts.
          notes.push(`goto unsupported in master capture: ${str("query")}`);
          return;
        }
        await page.goto(base + str("query"));
        break;
      case "waitFor":
        if (clock.stepped) {
          const end = clock.now() + Math.min(n("timeoutMs", 8000), left());
          let ok = false;
          while (
            clock.now() < end && !(ok = await visibleSel(page, str("selector")))
          ) {
            await clock.sleep(100);
          }
          notes.push(
            ok
              ? `${s.label ?? str("selector")} at ${at()} s`
              : `MISSING ${s.label ?? str("selector")}`,
          );
          break;
        }
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
          await clock.sleep(700);
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
            await clock.sleep(140);
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
          await clock.sleep(Math.min(n("holdMs", 900), left()));
          await page.keyboard.press("KeyE");
        }
        break;
      }
      case "until": {
        const end = clock.now() + Math.min(n("timeoutMs", 10000), left());
        // Story watchdog (stepped capture only): the probe log gains story
        // entries (not `sim:` events, which flow even in a stall) whenever a
        // line, scene or flag moves. None for `stallMs` of game
        // time means the run is stuck (an autopilot waiting on a drill it
        // cannot pass), so fail now with what the game was doing, instead
        // of stepping on to the timeout. A flashback still speaks.
        const stallMs = n("stallMs", STALL_GAME_MS);
        let seen = -1;
        let movedAt = clock.now();
        let ok = false;
        while (clock.now() < end && !ok) {
          const r = await wallLimit(
            page.evaluate(
              `((p) => p && { ok: !!(${
                str("probe")
              }), n: p.log.filter((e) => !String(e).startsWith("sim:")).length })(globalThis.__nwqa)`,
            ).catch(() => null) as Promise<{ ok: boolean; n: number } | null>,
            `until ${s.label}: probe`,
          );
          ok = !!r?.ok;
          if (r && r.n !== seen) {
            seen = r.n;
            movedAt = clock.now();
          }
          if (!ok && clock.stepped && clock.now() - movedAt > stallMs) {
            throw new Error(
              `stalled: no story progress for ${
                stallMs / 1000
              } s of game time waiting for "${s.label}"; ${await stallDiagnostics(
                page,
              )}`,
            );
          }
          if (!ok) {
            await wallLimit(clock.sleep(250), `until ${s.label}: step`);
          }
        }
        if (!ok && clock.stepped) {
          throw new Error(
            `MISSING ${s.label} by ${at()} s; ${await stallDiagnostics(page)}`,
          );
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

/** Game time with no new probe-log entry before a stepped take fails. */
const STALL_GAME_MS = 120_000;
/** Wall time one probe or step may take before a stepped take fails. */
const STALL_WALL_MS = 120_000;

/** Rejects if `p` has not settled within STALL_WALL_MS of wall time. */
async function wallLimit<T>(p: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `stalled: ${what} made no progress in ${
                  STALL_WALL_MS / 1000
                } s of wall time (browser or encoder hung)`,
              ),
            ),
          STALL_WALL_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** What the game was doing: tick, freeze, raised flags, last log entries. */
async function stallDiagnostics(page: Page): Promise<string> {
  const d = await page.evaluate(`((p) => p && JSON.stringify({
    tick: p.sim()?.tick, frozen: p.sim()?.frozen, phase: p.sim()?.phase,
    enemies: p.sim()?.enemies?.length,
    flags: Object.keys(p.flags?.() ?? {}).filter((k) => p.flags()[k]).slice(-8),
    log: p.log.slice(-6),
  }))(globalThis.__nwqa)`).catch((e) => `diagnostics failed: ${e}`);
  return String(d ?? "QA probe absent");
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

  if (t.capture === "master") {
    return await captureMaster(t, build, key, dir, log);
  }

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
  let rollEpoch: number | undefined;
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
      wallClock(page, () => rollEpoch = Date.now()),
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
  let seconds = Number(new TextDecoder().decode(probe.stdout).trim()) || wall;
  const { av: avResult, checks } = await finishAv(av, dir, webm, seconds, {});
  await Deno.remove(webm);
  // A `roll` step trims the pre-roll off, so the take starts where a master
  // take of the same recipe would.
  const rollT = rollEpoch === undefined ? 0 : av.t(rollEpoch);
  if (rollT > 0) {
    await ffmpeg([
      "-y",
      "-v",
      "error",
      "-ss",
      rollT.toFixed(3),
      "-i",
      `${dir}/reel.mp4`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      `${dir}/take.mp4`,
    ]);
    await Deno.remove(`${dir}/reel.mp4`);
    seconds -= rollT;
  } else await Deno.rename(`${dir}/reel.mp4`, `${dir}/take.mp4`);
  const tt = (epoch: number) => Math.round((av.t(epoch) - rollT) * 1000) / 1000;
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
    preroll: rollT,
    // Rolled takes drop pre-roll entries; others keep a first entry that
    // lands a hair before frame 0 (the boot gate's screen change).
    entries: entries.map(({ epoch, ...rest }) => ({ t: tt(epoch), ...rest }))
      .filter((x) => rollT === 0 || x.t >= 0),
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

// -- master capture (trailer/master.ts)

async function ffmpeg(args: string[]): Promise<string> {
  const o = await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-nostats", ...args],
    stdout: "null",
    stderr: "piped",
  }).output();
  const err = new TextDecoder().decode(o.stderr);
  if (!o.success) throw new Error(`ffmpeg: ${err.slice(-500)}`);
  return err;
}

/**
 * A master take: the page runs on a virtual clock and is stepped one 60 Hz
 * frame at a time; every frame is grabbed losslessly and the audio clock is
 * slaved to the frame clock, so the take has no dropped or doubled frames
 * and sound lands within a few milliseconds of its frame (the per-step
 * audio overshoot, recorded in timeline.json). Wall time is several times
 * the take's length; the take's own time is exact.
 */
async function captureMaster(
  t: ResolvedTake,
  build: BuildInfo,
  key: string,
  dir: string,
  log: (s: string) => void,
): Promise<TakeResult> {
  await Deno.remove(dir, { recursive: true }).catch(() => {});
  await Deno.mkdir(dir, { recursive: true });
  const server = serve(`${BUILD}/dist`);
  const browser = await launch();
  const context = await browser.newContext({
    viewport: t.viewport,
    deviceScaleFactor: 1,
  });
  // The virtual clock first, so every later script reads it.
  const audio = await installMaster(context);
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
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  const notes: string[] = [];
  const wall0 = Date.now();
  log(
    `[take ${key}] master ${t.viewport.width}x${t.viewport.height}@${FPS} ${t.query} (max ${t.maxSeconds} s of game time)`,
  );
  await page.goto(server.url + t.query);
  // Assets load on the wall clock while the page is frozen at frame 0.
  await page.waitForLoadState("networkidle").catch(() => {});
  const grab = await startGrabber(page, `${dir}/video.mp4`, {
    width: t.viewport.width,
    height: t.viewport.height,
    format: "png",
  });
  // Before a `roll` step, frames are stepped but not grabbed (pre-roll);
  // without one, the take starts at load. maxSeconds caps both together.
  let rolled = !t.steps.some((s) => s.do === "roll");
  if (rolled) await grab.frames(1);
  const clock: StepClock = {
    now: () => ((grab.count() + grab.skipped()) * 1000) / FPS,
    sleep: (ms: number) => {
      const k = Math.max(1, Math.round((ms * FPS) / 1000));
      return rolled ? grab.frames(k) : grab.skip(k);
    },
    stepped: true,
    roll: () => rolled = true,
  };
  let failure: unknown = null;
  let lastReport = Date.now();
  const progress = setInterval(() => {
    if (Date.now() - lastReport < 30000) return;
    lastReport = Date.now();
    log(
      `[take ${key}] ${(grab.count() / FPS).toFixed(1)} s grabbed, ${
        (grab.skipped() / FPS).toFixed(1)
      } s pre-rolled, ${((Date.now() - wall0) / 1000).toFixed(0)} s wall`,
    );
  }, 5000);
  try {
    await runSteps(
      page,
      server.url,
      t.steps,
      clock.now() + t.maxSeconds * 1000,
      notes,
      clock.now(),
      clock,
    );
  } catch (err) {
    failure = err;
    notes.push(`ERROR ${String(err).split("\n")[0]}`);
  } finally {
    clearInterval(progress);
  }
  if (failure) {
    // A master take that missed its moment is useless: clean up, then fail
    // the take loudly rather than caching footage that lacks its event.
    log(`[take ${key}] FAILED: ${String(failure).split("\n")[0]}`);
    await grab.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
    await Deno.remove(dir, { recursive: true }).catch(() => {});
    throw failure;
  }
  if (grab.count() === 0) await grab.frames(1); // rolled with no steps after
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await flushMaster(page);
  const r = await grab.close();
  await context.close();
  await browser.close();
  await server.close();
  const seconds = r.frames / FPS;
  const wav = `${dir}/mix.wav`;
  await writeMasterWav(audio, wav, seconds, grab.startVnow(), r.segs);
  await ffmpeg([
    "-y",
    "-v",
    "error",
    "-i",
    `${dir}/video.mp4`,
    "-i",
    wav,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "flac",
    "-movflags",
    "+faststart",
    `${dir}/take.mp4`,
  ]);
  const err = await ffmpeg([
    "-i",
    wav,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const sum = err.slice(err.lastIndexOf("Summary:"));
  await Deno.remove(`${dir}/video.mp4`);
  await Deno.remove(wav);
  const over = r.log.overshoot.map((x) => x * 1000);
  const mean = (a: number[]) =>
    a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const wallSeconds = (Date.now() - wall0) / 1000;
  const tt = (epoch: number) =>
    Math.round(epoch - timeOrigin - grab.startVnow()) / 1000;
  const timeline = {
    key,
    recipe: t,
    build,
    seconds,
    wallSeconds,
    notes,
    errors: errors.slice(0, 50),
    capture: {
      mode: "master",
      fps: FPS,
      size: `${t.viewport.width}x${t.viewport.height}`,
      grab: "CDP Page.captureScreenshot PNG, x264 4:4:4 CRF 14, FLAC",
      frames: r.frames,
      stepMs: +mean(r.log.stepMs).toFixed(1),
      grabMs: +mean(r.log.grabMs).toFixed(1),
      audioOvershootMs: {
        mean: +mean(over).toFixed(2),
        max: +Math.max(0, ...over).toFixed(2),
      },
      audioContexts: r.segs.length,
      prerollFrames: grab.skipped(),
    },
    av: {
      lufs: Number(sum.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1] ?? NaN),
      truePeak: Number(sum.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1] ?? NaN),
    },
    preroll: grab.skipped() / FPS,
    entries: entries.map(({ epoch, ...rest }) => ({ t: tt(epoch), ...rest }))
      .filter((x) => grab.skipped() === 0 || x.t >= 0),
  };
  await Deno.writeTextFile(
    `${dir}/timeline.json`,
    JSON.stringify(timeline, null, 1),
  );
  log(
    `[take ${key}] ${seconds.toFixed(1)} s in ${
      wallSeconds.toFixed(0)
    } s wall (${
      (wallSeconds / seconds).toFixed(1)
    }x), ${entries.length} entries; ${notes.join("; ")}`,
  );
  return { key, dir, cached: false, seconds, wallSeconds, notes, errors };
}
