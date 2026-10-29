/**
 * Reel capture: builds the production bundle, serves it statically, and
 * records each reel in `qa/reels.ts` with headless Chromium (Playwright under
 * Deno). Per reel it writes, into `<report>/reels/<id>/`:
 *
 * - `reel.mp4`: 1280x720 video with the game's stereo audio (qa/av.ts),
 *   capped at the reel's `maxSeconds`
 * - `sheet.jpg`: six small frames tiled 3x2 (ffmpeg)
 * - `errors.txt`: uncaught exceptions, console errors, failed requests
 * - `av.json`: what was heard (sound starts, subtitle windows, loudness)
 * - `result.json`: assertions and status
 *
 * Playwright is pinned to 1.58.2 because that release matches the Chromium
 * build already in ~/Library/Caches/ms-playwright; bumping it means running
 * `npx playwright@<v> install chromium` once.
 */

import { type Browser, chromium, type Page } from "npm:playwright@1.58.2";
import {
  type Check,
  repo,
  ROOT,
  type Status,
  worst,
  writeJson,
} from "./lib/common.ts";
import type { Reel, Requirement, Step } from "./reels.ts";
import { type AvResult, finishAv, flushAv, installAv } from "./av.ts";

export interface ReelResult {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly status: Status;
  readonly seconds: number;
  readonly assertions: readonly Check[];
  readonly errors: readonly string[];
  readonly needs: readonly string[];
  /** Paths relative to the report directory. */
  readonly video: string | null;
  readonly sheet: string | null;
  readonly av: AvResult | null;
}

const VIEWPORT = { width: 1280, height: 720 };

/** How long an `until` step waits for the QA probe to be installed. */
const PROBE_BOOT_MS = 8_000;

// -- build and serve

export async function build(outDir: string): Promise<void> {
  // Same order as `deno task build`: refresh public/vo first, or the bundle
  // ships whatever VO happened to be synced last.
  const sync = await new Deno.Command("deno", {
    args: ["task", "vo:sync"],
    cwd: ROOT,
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!sync.success) {
    console.error(
      `vo:sync failed, building with the current public/vo:\n${
        new TextDecoder().decode(sync.stderr).slice(-400)
      }`,
    );
  }
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:vite@8.3.1",
      "build",
      "--outDir",
      outDir,
      "--emptyOutDir",
      "--logLevel",
      "warn",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr, stdout } = await cmd.output();
  if (code !== 0) {
    const tail = new TextDecoder().decode(stderr || stdout).split("\n").slice(
      -15,
    ).join("\n");
    throw new Error(`vite build failed:\n${tail}`);
  }
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript",
  css: "text/css",
  json: "application/json",
  glb: "model/gltf-binary",
  wav: "audio/wav",
  ogg: "audio/ogg",
  vtt: "text/vtt",
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  ttf: "font/ttf",
  map: "application/json",
};

/** A tiny static server over `dir` on a free port. */
export function serve(
  dir: string,
): { url: string; close: () => Promise<void> } {
  const server = Deno.serve({
    port: 0,
    hostname: "127.0.0.1",
    onListen: () => {},
  }, async (req) => {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith("/")) path += "index.html";
    if (path.includes("..")) return new Response("bad path", { status: 400 });
    try {
      const body = await Deno.readFile(`${dir}${path}`);
      const ext = path.split(".").pop() ?? "";
      return new Response(body, {
        headers: { "content-type": TYPES[ext] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
  const addr = server.addr as Deno.NetAddr;
  return {
    url: `http://127.0.0.1:${addr.port}/`,
    close: () => server.shutdown(),
  };
}

// -- settings seed

async function settingsIdentity(): Promise<{ key: string; version: number }> {
  const src = await Deno.readTextFile(repo("src/settings/store.ts"));
  return {
    key: src.match(/SETTINGS_KEY = "([^"]+)"/)?.[1] ?? "neon-warden.settings",
    version: Number(src.match(/SETTINGS_VERSION = (\d+)/)?.[1] ?? 1),
  };
}

// -- page-side helpers (run in the browser)

/** Elements of the topmost visible screen whose content is wider than their box. */
function overflowScan(): string[] {
  // Inlined: this function is serialized into the page. Overflow of a few
  // pixels is usually a focus ring or a focused button's scale, not text.
  const OVERFLOW_TOLERANCE_PX = 4;
  const screens = [...document.querySelectorAll<HTMLElement>(".nw-screen")]
    .filter((s) =>
      s.offsetParent !== null || getComputedStyle(s).position === "fixed"
    );
  const screen = screens[screens.length - 1];
  if (!screen) return ["no visible .nw-screen"];
  const out: string[] = [];
  const panel = screen.querySelector<HTMLElement>(".nw-panel") ?? screen;
  const right = panel.getBoundingClientRect().right;
  for (const el of [screen, ...screen.querySelectorAll<HTMLElement>("*")]) {
    if (!(el instanceof HTMLElement) || el.clientWidth === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const scrolls = style.overflowX === "auto" || style.overflowX === "scroll";
    const wide = el.scrollWidth > el.clientWidth + 1 && !scrolls;
    const escapes = el !== screen && panel.contains(el) &&
      el.getBoundingClientRect().right > right + 1;
    if (wide || escapes) {
      const name = `${el.tagName.toLowerCase()}${
        el.className
          ? "." + String(el.className).trim().split(/\s+/).join(".")
          : ""
      }`;
      const text = (el.textContent ?? "").trim().slice(0, 40);
      const by = wide
        ? el.scrollWidth - el.clientWidth
        : Math.round(el.getBoundingClientRect().right - right);
      out.push(
        `${by > OVERFLOW_TOLERANCE_PX ? "" : "minor "}${name} "${text}" ${
          wide
            ? `scroll ${el.scrollWidth} > client ${el.clientWidth}`
            : "escapes panel"
        }`,
      );
    }
  }
  return out.slice(0, 20);
}

// -- one reel

class ReelRun {
  readonly assertions: Check[] = [];
  readonly errors: string[] = [];
  private readonly start = Date.now();

  constructor(
    readonly reel: Reel,
    readonly page: Page,
    readonly base: string,
  ) {}

  elapsed(): number {
    return (Date.now() - this.start) / 1000;
  }

  remainingMs(): number {
    return Math.max(0, this.reel.maxSeconds * 1000 - (Date.now() - this.start));
  }

  check(label: string, status: Status, detail: string, items?: string[]): void {
    this.assertions.push({ id: label, status, detail, items });
  }

  /** Fail on real overflow; warn when every offender is a few pixels ("minor"). */
  overflow(label: string, bad: string[]): void {
    const real = bad.filter((b) => !b.startsWith("minor "));
    const status: Status = real.length ? "fail" : bad.length ? "warn" : "pass";
    const detail = real.length
      ? `${real.length} elements overflow by more than 4 px`
      : bad.length
      ? `${bad.length} elements overflow by 2–4 px (focus ring or scale?)`
      : "fits";
    this.check(label, status, detail, bad);
  }

  async visible(selector: string): Promise<boolean> {
    return await this.page.evaluate(
      (sel) =>
        [...document.querySelectorAll<HTMLElement>(sel)].some((e) =>
          e.offsetParent !== null || getComputedStyle(e).position === "fixed"
        ),
      selector,
    );
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(Math.min(ms, this.remainingMs()));
  }

  async step(s: Step): Promise<void> {
    const page = this.page;
    switch (s.do) {
      case "wait":
        return await this.wait(s.ms);
      case "press":
        for (let i = 0; i < (s.times ?? 1); i++) {
          await page.keyboard.press(s.key);
          await this.wait(s.gapMs ?? 250);
        }
        return;
      case "goto":
        await page.goto(this.base + s.query);
        return await this.wait(500);
      case "advanceTo": {
        const sel = `.nw-screen-${s.screen}`;
        for (let i = 0; i <= (s.max ?? 6); i++) {
          if (await this.visible(sel)) {
            return this.check(
              `reach ${s.screen}`,
              "pass",
              `after ${i} presses of ${s.key ?? "Enter"}`,
            );
          }
          if (this.remainingMs() === 0) break;
          await page.keyboard.press(s.key ?? "Enter");
          await this.wait(700);
        }
        return this.check(
          `reach ${s.screen}`,
          "fail",
          `${sel} not visible after ${s.max ?? 6} presses`,
        );
      }
      case "waitFor": {
        try {
          await page.waitForSelector(s.selector, {
            state: "visible",
            timeout: Math.min(s.timeoutMs ?? 5000, this.remainingMs() || 1),
          });
          return this.check(
            s.label,
            "pass",
            `${s.selector} visible at ${this.elapsed().toFixed(1)} s`,
          );
        } catch {
          return this.check(
            s.label,
            s.pendingIfMissing ? "pending" : "fail",
            s.pendingIfMissing ?? `${s.selector} never visible`,
          );
        }
      }
      case "navigate": {
        const focused = () =>
          page.evaluate(() =>
            (document.activeElement as HTMLElement | null)?.dataset?.key ?? ""
          );
        for (let i = 0; i < (s.max ?? 14); i++) {
          if (await focused() === s.key) return;
          await page.keyboard.press("ArrowDown");
          await this.wait(120);
        }
        const found = await page.evaluate((k) => {
          const el = document.querySelector<HTMLElement>(`[data-key="${k}"]`);
          el?.focus();
          return !!el;
        }, s.key);
        return this.check(
          `navigate to ${s.key}`,
          found ? "warn" : "fail",
          found
            ? "arrow keys did not reach it; used script focus (keyboard path unverified)"
            : `no control with data-key="${s.key}"`,
        );
      }
      case "settingsTabs": {
        const tabs = await page.evaluate(() =>
          document.querySelectorAll(".nw-tab").length
        );
        if (tabs === 0) {
          return this.check("settings tabs", "fail", "no .nw-tab buttons");
        }
        const seen: string[] = [];
        for (let i = 0; i < tabs; i++) {
          const name = await page.evaluate(() =>
            document.querySelector(".nw-tab[aria-selected=true]")
              ?.textContent ?? "?"
          );
          seen.push(name);
          const bad = await page.evaluate(overflowScan);
          this.overflow(`no overflow: settings tab "${name}"`, bad);
          await this.wait(s.holdMs ?? 800);
          if (i < tabs - 1) {
            await page.keyboard.press("KeyE");
            await this.wait(300);
          }
        }
        return this.check(
          "visit every settings tab with E",
          new Set(seen).size === tabs ? "pass" : "fail",
          seen.join(", "),
        );
      }
      case "remap": {
        await this.step({ do: "navigate", key: s.cell, max: 30 });
        const before = await page.evaluate(
          (k) => document.querySelector(`[data-key="${k}"]`)?.textContent ?? "",
          s.cell,
        );
        await page.keyboard.press("Enter");
        await this.wait(400);
        await page.keyboard.press(s.newKey);
        await this.wait(900);
        const after = await page.evaluate(
          (k) => document.querySelector(`[data-key="${k}"]`)?.textContent ?? "",
          s.cell,
        );
        const want = s.newKey.replace(/^Key|^Digit/, "");
        return this.check(
          `remap ${s.cell} to ${s.newKey} by keyboard`,
          after.includes(want) ? "pass" : "fail",
          `label "${before}" became "${after}"`,
        );
      }
      case "assertNoOverflow": {
        const bad = await page.evaluate(overflowScan);
        return this.overflow(`no overflow: ${s.label}`, bad);
      }
      case "assertBgAlpha": {
        const alpha = await page.evaluate((sel) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return null;
          const m = getComputedStyle(el).backgroundColor.match(
            /rgba?\(([^)]+)\)/,
          );
          const parts = m ? m[1].split(/[ ,/]+/).filter(Boolean) : [];
          return parts.length === 4
            ? Number(parts[3])
            : parts.length === 3
            ? 1
            : null;
        }, s.selector);
        if (alpha === null) {
          return this.check(
            s.label,
            "pending",
            `${s.selector} absent or has no background color`,
          );
        }
        return this.check(
          s.label,
          Math.abs(alpha - s.alpha) <= 0.06 ? "pass" : "fail",
          `alpha ${alpha.toFixed(2)}, want ${s.alpha}`,
        );
      }
      case "assertFrame": {
        const shot = await page.screenshot({ type: "jpeg", quality: 50 });
        // A flat or black 1280x720 JPEG compresses to a few KB; a rendered
        // scene with geometry and bloom is tens of KB. A cheap blankness proxy.
        return this.check(
          s.label,
          shot.byteLength > 14_000 ? "pass" : "fail",
          `frame jpeg ${
            Math.round(shot.byteLength / 1024)
          } KB (blank under 14 KB)`,
        );
      }
      case "assertChanges": {
        const read = () =>
          s.probe
            ? page.evaluate(
              `JSON.stringify(((p) => (${s.probe}))(globalThis.__nwqa) ?? null)`,
            ).catch(() => "null")
            : page.evaluate(
              (sel) => document.querySelector(sel!)?.textContent ?? null,
              s.selector,
            );
        const before = await read();
        if (before === null || before === "null") {
          return this.check(
            s.label,
            "fail",
            `nothing to compare: ${s.probe ?? s.selector} is absent`,
          );
        }
        await page.keyboard.press(s.key);
        await this.wait(s.waitMs ?? 600);
        const after = await read();
        const clip = (v: unknown) => String(v).slice(0, 80);
        return this.check(
          s.label,
          after !== before ? "pass" : "fail",
          after !== before
            ? `after ${s.key}: ${clip(before)} -> ${clip(after)}`
            : `${s.key} left it unchanged: ${clip(before)}`,
        );
      }
      case "until": {
        // The game installs the probe after its async boot (audio, assets),
        // so give it a few seconds to appear before calling it absent.
        const hasProbe = await page.waitForFunction(
          () => typeof (globalThis as { __nwqa?: unknown }).__nwqa === "object",
          undefined,
          { timeout: Math.min(s.timeoutMs, PROBE_BOOT_MS) },
        ).then(() => true, () => false);
        if (!hasProbe) {
          // Keep recording for part of the window so the video still shows
          // whatever the build does, then report pending.
          await this.wait(Math.min(s.timeoutMs, 12_000));
          return this.check(
            s.label,
            "pending",
            "QA probe window.__nwqa absent (see qa/REQUESTS.md)",
          );
        }
        const deadline = Date.now() + Math.min(s.timeoutMs, this.remainingMs());
        let lastErr = "";
        while (Date.now() < deadline) {
          try {
            const ok = await page.evaluate(
              `((p) => (${s.probe}))(globalThis.__nwqa)`,
            );
            if (ok) {
              return this.check(
                s.label,
                "pass",
                `at ${this.elapsed().toFixed(1)} s`,
              );
            }
          } catch (err) {
            lastErr = String(err).split("\n")[0];
          }
          await page.waitForTimeout(250);
        }
        return this.check(
          s.label,
          "fail",
          `not true within ${s.timeoutMs / 1000} s${
            lastErr ? `; ${lastErr}` : ""
          }: ${s.probe}`,
        );
      }
    }
  }
}

/** Duration from the container, falling back to wall time (Playwright WebMs may omit it). */
async function videoSeconds(video: string, fallback: number): Promise<number> {
  const out = await new Deno.Command("ffprobe", {
    args: [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      video,
    ],
    stdout: "piped",
    stderr: "null",
  }).output();
  const d = Number(new TextDecoder().decode(out.stdout).trim());
  return Number.isFinite(d) && d > 0 ? d : fallback;
}

/** Six evenly spaced frames, each 320x180, tiled 3x2. */
async function contactSheet(
  video: string,
  sheet: string,
  seconds: number,
): Promise<boolean> {
  const d = await videoSeconds(video, Math.max(1, seconds));
  const interval = d / 6;
  const cmd = new Deno.Command("ffmpeg", {
    args: [
      "-y",
      "-v",
      "error",
      "-ss",
      (interval / 2).toFixed(2),
      "-i",
      video,
      "-vf",
      `fps=1/${interval.toFixed(3)},scale=320:180,tile=3x2`,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      sheet,
    ],
    stdout: "null",
    stderr: "piped",
  });
  return (await cmd.output()).code === 0;
}

export async function captureReel(
  browser: Browser,
  reel: Reel,
  base: string,
  reportDir: string,
  options: { randomSeed?: number } = {},
): Promise<ReelResult> {
  const rel = `reels/${reel.id}`;
  const dir = `${reportDir}/${rel}`;
  await Deno.mkdir(`${dir}/raw`, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: `${dir}/raw`, size: VIEWPORT },
  });
  if (options.randomSeed !== undefined) {
    await context.addInitScript((seed: number) => {
      let state = seed >>> 0;
      Math.random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }, options.randomSeed);
  }
  if (reel.settings) {
    const { key, version } = await settingsIdentity();
    await context.addInitScript(({ key, value }) => {
      if (sessionStorage.getItem("nwqa.seeded")) return;
      sessionStorage.setItem("nwqa.seeded", "1");
      localStorage.setItem(key, value);
    }, { key, value: JSON.stringify({ version, settings: reel.settings }) });
  }
  const unmet = await unmetRequirements(reel.requires ?? []);
  const av = await installAv(
    context,
    (reel.av?.musicDuring ?? []).map((m) => m.selector),
  );
  const before = Date.now();
  const page = await context.newPage();
  // Playwright's video starts with the page; take the middle of the call.
  av.videoEpoch = (before + Date.now()) / 2;
  const run = new ReelRun(reel, page, base);
  page.on(
    "pageerror",
    (e) => run.errors.push(`uncaught: ${String(e).split("\n")[0]}`),
  );
  page.on("console", (m) => {
    // Chrome echoes every failed request as a console error; the response
    // handler already records those with their URL, so skip the echo.
    if (
      m.type() === "error" && !m.text().startsWith("Failed to load resource")
    ) run.errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) {
      run.errors.push(`HTTP ${r.status()}: ${r.url().replace(base, "/")}`);
    }
  });

  try {
    await page.goto(base + reel.query);
    for (const step of reel.steps) {
      if (run.remainingMs() === 0) {
        run.check(
          "time cap",
          "warn",
          `stopped at ${reel.maxSeconds} s before step ${step.do}`,
        );
        break;
      }
      await run.step(step);
    }
  } catch (err) {
    run.check("reel ran to completion", "fail", String(err).split("\n")[0]);
  }
  const seconds = run.elapsed();
  const uncaught = run.errors.filter((e) => e.startsWith("uncaught"));
  const consoleErrors = run.errors.filter((e) => e.startsWith("console"));
  const http = run.errors.filter((e) => e.startsWith("HTTP"));
  run.check(
    "no uncaught exceptions",
    uncaught.length ? "fail" : "pass",
    `${uncaught.length} uncaught`,
    uncaught.slice(0, 10),
  );
  run.check(
    "no console errors",
    consoleErrors.length ? "fail" : "pass",
    `${consoleErrors.length} console errors`,
    consoleErrors.slice(0, 10),
  );
  run.check(
    "no failed requests",
    http.length ? "warn" : "pass",
    `${http.length} failed requests`,
    [...new Set(http)].slice(0, 10),
  );

  await flushAv(page);
  const videoHandle = page.video();
  await context.close();
  let video: string | null = null;
  let sheet: string | null = null;
  let avResult: AvResult | null = null;
  const raw = videoHandle ? await videoHandle.path() : null;
  if (raw) {
    const webm = `${dir}/video.webm`;
    await Deno.rename(raw, webm);
    await Deno.remove(`${dir}/raw`, { recursive: true });
    const d = await videoSeconds(webm, seconds);
    if (await contactSheet(webm, `${dir}/sheet.jpg`, seconds)) {
      sheet = `${rel}/sheet.jpg`;
    }
    try {
      const { av: a, checks } = await finishAv(av, dir, webm, d, reel.av ?? {});
      avResult = a;
      run.assertions.push(...checks);
      await writeJson(`${dir}/av.json`, a);
      await Deno.remove(webm);
      video = `${rel}/reel.mp4`;
    } catch (err) {
      run.check("audio: mux and analysis", "fail", String(err).slice(0, 300));
      await Deno.rename(webm, `${dir}/reel.webm`);
      video = `${rel}/reel.webm`;
    }
  }
  await Deno.writeTextFile(`${dir}/errors.txt`, run.errors.join("\n") + "\n");

  // A reel whose feature has not landed yet reports pending, not fail; the
  // generic error checks still fail, since a crash is a crash.
  if (unmet.length) {
    const generic = new Set(["no uncaught exceptions", "no console errors"]);
    for (const [i, a] of run.assertions.entries()) {
      if (a.status === "fail" && !generic.has(a.id)) {
        run.assertions[i] = {
          ...a,
          status: "pending",
          detail: `${a.detail} (waits for: ${unmet.join("; ")})`,
        };
      }
    }
  }
  const statuses = run.assertions.map((a) => a.status);
  let status = worst(statuses);
  // A reel blocked only by known-missing prerequisites is pending, not failed.
  if (status === "fail" && reel.needs?.length && statuses.includes("pending")) {
    status = "pending";
  }
  // Unproven beats outrank cosmetic warnings: the reel has not shown its topic.
  if (status === "warn" && statuses.includes("pending")) status = "pending";
  const result: ReelResult = {
    id: reel.id,
    title: reel.title,
    topic: reel.topic,
    status,
    seconds: Number(seconds.toFixed(1)),
    assertions: run.assertions,
    errors: run.errors.slice(0, 200),
    needs: [...(reel.needs ?? []), ...unmet],
    video,
    sheet,
    av: avResult,
  };
  await writeJson(`${dir}/result.json`, result);
  return result;
}

/**
 * Requirements whose code has not landed: a requirement is met when any
 * TypeScript file under its `path` matches its `pattern`. Read from the
 * working tree, so a reel turns real as soon as the owning agent's code is
 * in place (committed or not), without anyone editing qa/.
 */
export async function unmetRequirements(
  reqs: readonly Requirement[],
): Promise<string[]> {
  const out: string[] = [];
  for (const r of reqs) {
    if (!(await treeMatches(repo(r.path), new RegExp(r.pattern)))) {
      out.push(r.what);
    }
  }
  return out;
}

async function treeMatches(path: string, re: RegExp): Promise<boolean> {
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(path);
  } catch {
    return false;
  }
  if (info.isFile) return re.test(await Deno.readTextFile(path));
  for await (const e of Deno.readDir(path)) {
    const p = `${path}/${e.name}`;
    if (e.isDirectory && await treeMatches(p, re)) return true;
    if (
      e.isFile && /\.(ts|json|css)$/.test(e.name) && await treeMatches(p, re)
    ) {
      return true;
    }
  }
  return false;
}

/** Launches Chromium with GPU paths enabled where the host has them. */
export async function launch(): Promise<Browser> {
  return await chromium.launch({
    headless: true,
    args: [
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--use-angle=metal",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
}
