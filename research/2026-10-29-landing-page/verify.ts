/**
 * Landing page and game-page checks against a GitHub-Pages-like static server.
 * Builds with REPO_NAME (so every path runs under a subpath), serves on its own
 * port, then checks desktop, phone and Chromebook-sized viewports.
 *
 * Run: deno run -A research/2026-10-29-landing-page/verify.ts
 * Writes out/verify.json and out/shots/*.png. Viewport sizes are layout
 * checks on a Mac, not Chromebook performance evidence; the throttled run is
 * a rough Lighthouse-style proxy only.
 */
import { chromium, type Page } from "npm:playwright@1.58.2";

const here = new URL(".", import.meta.url).pathname;
const root = new URL("../../", import.meta.url).pathname;
const REPO = "neon-warden-aaaa";
const out = `${here}out`;
const dist = `${out}/dist`;
const PORT = 4329;
const base = `http://127.0.0.1:${PORT}/${REPO}/`;
await Deno.mkdir(`${out}/shots`, { recursive: true });

if (!Deno.args.includes("--no-build")) {
  const b = await new Deno.Command("deno", {
    args: ["run", "-A", "npm:vite@8.3.1", "build", "--outDir", dist,
      "--emptyOutDir", "--logLevel", "warn"],
    cwd: root,
    env: { REPO_NAME: REPO },
    stderr: "piped",
  }).output();
  if (!b.success) throw new Error(new TextDecoder().decode(b.stderr));
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css",
  json: "application/json", webmanifest: "application/manifest+json",
  svg: "image/svg+xml", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", ogg: "audio/ogg", opus: "audio/ogg", glb: "model/gltf-binary",
  vtt: "text/vtt", txt: "text/plain",
};
// Like GitHub Pages: directory index, a 301 for a directory without a slash,
// 404 for anything missing (never an HTML fallback for assets).
const server = Deno.serve({ port: PORT, hostname: "127.0.0.1", onListen() {} },
  async (req) => {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (!path.startsWith(`/${REPO}/`)) {
      if (path === `/${REPO}`) {
        return Response.redirect(`${base}${url.search}`, 301);
      }
      return new Response("404", { status: 404 });
    }
    path = path.slice(REPO.length + 2);
    if (path.includes("..")) return new Response("bad", { status: 400 });
    if (path === "" || path.endsWith("/")) path += "index.html";
    try {
      const info = await Deno.stat(`${dist}/${path}`);
      if (info.isDirectory) {
        return Response.redirect(`${base}${path}/${url.search}`, 301);
      }
      const data = await Deno.readFile(`${dist}/${path}`);
      return new Response(data, { headers: {
        "content-type": MIME[path.split(".").pop()!] ?? "application/octet-stream",
      } });
    } catch {
      return new Response("404", { status: 404 });
    }
  });

type Result = { name: string; ok: boolean; detail?: unknown };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
};

const VIEWPORTS = [
  { id: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
  { id: "chromebook", viewport: { width: 1366, height: 768 }, touch: true },
  { id: "chromebook-11", viewport: { width: 1280, height: 720 }, touch: true },
  { id: "phone", viewport: { width: 360, height: 640 }, touch: true },
  { id: "phone-landscape", viewport: { width: 640, height: 360 }, touch: true },
] as const;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});

function watch(page: Page) {
  const requests: string[] = [];
  const failures: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { requests, failures, errors };
}
const external = (urls: string[]) =>
  urls.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}/`) &&
    !u.startsWith("data:") && !u.startsWith("blob:"));

try {
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: v.viewport, hasTouch: v.touch, isMobile: v.id.startsWith("phone"),
      deviceScaleFactor: v.id.startsWith("phone") ? 2 : 1, locale: "en-US",
    });
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(base, { waitUntil: "load" });
    await page.waitForTimeout(2200); // let the one-shot glint and glitch finish
    const play = page.locator("a.play");
    const box = await play.boundingBox();
    check(`${v.id}: Play above the fold`, !!box &&
      box.y >= 0 && box.y + box.height <= v.viewport.height,
      box && { top: Math.round(box.y), bottom: Math.round(box.y + box.height) });
    check(`${v.id}: Play target at least 44 px tall`, !!box && box.height >= 44);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - innerWidth
    );
    // body clips overflow-x, so also look for anything drawn past the edge.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > innerWidth + 1 &&
          !e.closest(".diagram, .hero-field, .skip");
      }).map((e) => e.className || e.tagName).slice(0, 5)
    );
    check(`${v.id}: no horizontal overflow`, overflow <= 0 && !clipped.length,
      { overflow, clipped });
    check(`${v.id}: no external requests`, external(w.requests).length === 0,
      external(w.requests));
    check(`${v.id}: teaser video not fetched before play`,
      !w.requests.some((u) => u.endsWith(".mp4")));
    check(`${v.id}: no landing errors or 404s`,
      w.errors.length + w.failures.length === 0, [...w.errors, ...w.failures]);
    await page.screenshot({ path: `${out}/shots/${v.id}-fold.png` });
    if (v.id === "desktop" || v.id === "phone") {
      await page.screenshot({
        path: `${out}/shots/${v.id}-full.png`,
        fullPage: true,
        scale: "css",
      });
    }

    // One tap or click on Play reaches the game page.
    if (v.touch) await play.tap();
    else await play.click();
    await page.waitForURL(`${base}play/`);
    check(`${v.id}: Play opens ${REPO}/play/ in one ${v.touch ? "tap" : "click"}`,
      page.url() === `${base}play/`);
    await page.waitForSelector("#stage canvas", {
      state: "attached",
      timeout: 20000,
    });
    await page.waitForTimeout(2500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);
    const gameFails = w.failures.filter((f) => !f.endsWith("favicon.ico"));
    check(`${v.id}: game page loads with no asset 404s or errors`,
      gameFails.length + w.errors.length === 0,
      [...gameFails, ...w.errors].slice(0, 8));
    check(`${v.id}: game requests stay on this site`,
      external(w.requests).length === 0, external(w.requests).slice(0, 5));
    await page.screenshot({ path: `${out}/shots/${v.id}-game.png` });
    await ctx.close();
  }

  // Languages, reduced motion, the service worker scope and the redirect shim.
  {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true,
      deviceScaleFactor: 2, locale: "es-MX", reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(base);
    check("browser language es picks Spanish",
      (await page.locator("a.play").innerText()).includes("Jugar"));
    const anim = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".title")!, "::before")
        .animationName
    );
    check("reduced motion: no title glitch animation", anim === "none", anim);
    await page.screenshot({ path: `${out}/shots/phone-es-fold.png` });
    await page.locator('[data-lang="zh"]').tap();
    check("switch to Chinese",
      (await page.locator("html").getAttribute("lang")) === "zh-Hans" &&
        (await page.locator("a.play").innerText()).includes("浏览器"));
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - innerWidth
    );
    check("Chinese: no horizontal overflow", overflow <= 0, { overflow });
    await page.screenshot({ path: `${out}/shots/phone-zh-fold.png` });
    await page.reload();
    check("tab keeps the language choice (sessionStorage)",
      (await page.locator("a.play").innerText()).includes("浏览器"));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(`${base}play/`);
    const scope = await page.evaluate(async () => {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      return reg?.scope ?? null;
    });
    check("service worker scope is play/", scope === `${base}play/`, scope);
    await page.goto(base);
    const controlled = await page.evaluate(() =>
      !!navigator.serviceWorker.controller
    );
    check("landing page is not controlled by the service worker", !controlled);
    const manifest = await (await fetch(`${base}manifest.webmanifest`)).json();
    check("manifest start_url and scope are play/",
      manifest.start_url === "./play/" && manifest.scope === "./play/");
    const pack = await (await fetch(`${base}offline-manifest.json`)).json();
    const urls: string[] = pack.files.map((f: { url: string }) => f.url);
    check("offline pack has the game page, not the landing page or media",
      urls.includes("play/index.html") && !urls.includes("index.html") &&
        !urls.some((u) => u.startsWith("media/") || /^assets\/landing-/.test(u) ||
          u.startsWith("making-of/")));
    await page.goto(`${base}?qa=1&seed=7`);
    await page.waitForURL(/\/play\/\?qa=1&seed=7$/);
    check("old root links with game flags forward to play/", true, page.url());
    await page.goto(`${base}?lang=zh`);
    check("?lang= stays on the landing page", page.url() === `${base}?lang=zh`);
    await ctx.close();
  }

  // The making-of write-up: reachable from the landing page, styled, local.
  for (const v of [VIEWPORTS[0], VIEWPORTS[3]]) {
    const ctx = await browser.newContext({
      viewport: v.viewport, hasTouch: v.touch, isMobile: v.id === "phone",
      deviceScaleFactor: v.id === "phone" ? 2 : 1,
    });
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(base);
    const more = page.locator('a[href="making-of/"]');
    if (v.touch) await more.tap();
    else await more.click();
    await page.waitForURL(`${base}making-of/`);
    await page.waitForLoadState("load");
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      styled: getComputedStyle(document.body).overflowX === "hidden",
      h1: document.querySelector("h1")?.textContent ?? "",
      stepico: !!document.querySelector('a[href*="stepico.com"]'),
    }));
    check(`${v.id}: making-of opens from the landing page, styled, no overflow`,
      info.styled && info.overflow <= 0 && info.h1.includes("Making of") &&
        info.stepico, info);
    check(`${v.id}: making-of has no errors, 404s or external requests`,
      w.errors.length + w.failures.length + external(w.requests).length === 0,
      [...w.errors, ...w.failures, ...external(w.requests)]);
    await page.screenshot({
      path: `${out}/shots/${v.id}-making-of.png`, fullPage: true, scale: "css",
    });
    await ctx.close();
  }

  // Rough low-end proxy: 4x CPU slowdown, ~1.6 Mbps / 150 ms network.
  {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 }, hasTouch: true,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: 1.6e6 / 8,
      uploadThroughput: 750e3 / 8,
    });
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
    await page.addInitScript(() => {
      (globalThis as unknown as { __lcp: number }).__lcp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          (globalThis as unknown as { __lcp: number }).__lcp = e.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(base, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming;
      return {
        lcpMs: Math.round((globalThis as unknown as { __lcp: number }).__lcp),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        domNodes: document.getElementsByTagName("*").length,
      };
    });
    const metrics = { ...m, transferredBytes: bytes };
    check("throttled first load under 150 KB transferred", bytes < 150_000, metrics);
    check("throttled LCP under 2.5 s", m.lcpMs > 0 && m.lcpMs < 2500, m.lcpMs);
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.shutdown();
}

const failed = results.filter((r) => !r.ok);
await Deno.writeTextFile(`${out}/verify.json`, JSON.stringify({
  when: new Date().toISOString(),
  base,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2));
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) Deno.exit(1);
