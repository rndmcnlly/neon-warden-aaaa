/** Production-only platform integration QA. Run: deno run -A tests/platform_browser.ts */
import { chromium, type Page } from "npm:playwright@1.58.2";

if (import.meta.main) await run();

async function run() {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const report = `qa/reports/platform-${stamp}`;
  const out = "qa/.build/platform";
  await Deno.mkdir(report, { recursive: true });
  const checks: string[] = [];
  const ensure = (value: unknown, text: string) => {
    if (!value) throw new Error(text);
    checks.push(text);
  };
  const build = await new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:vite@8.3.1",
      "build",
      "--outDir",
      out,
      "--emptyOutDir",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!build.success) throw new Error(new TextDecoder().decode(build.stderr));
  const mime: Record<string, string> = {
    html: "text/html",
    js: "text/javascript",
    css: "text/css",
    json: "application/json",
    webmanifest: "application/manifest+json",
    ogg: "audio/ogg",
    wav: "audio/wav",
    png: "image/png",
    glb: "model/gltf-binary",
  };
  let corrupt = false;
  let updated = false;
  const server = Deno.serve({
    port: 4317,
    hostname: "127.0.0.1",
    onListen() {},
  }, async (req) => {
    const path = decodeURIComponent(new URL(req.url).pathname).slice(1) ||
      "index.html";
    if (path.includes("..")) return new Response("Forbidden", { status: 403 });
    if (corrupt && path.endsWith(".ogg")) {
      return new Response("<html>bad fallback</html>", {
        headers: { "content-type": "text/html" },
      });
    }
    try {
      let data = await Deno.readFile(`${out}/${path}`);
      if (updated && path === "sw.js") {
        const manifest = JSON.parse(
          await Deno.readTextFile(`${out}/offline-manifest.json`),
        );
        data = new TextEncoder().encode(
          new TextDecoder().decode(data).replaceAll(
            manifest.version,
            `${manifest.version}-update-test`,
          ),
        );
      }
      return new Response(data, {
        headers: {
          "content-type": mime[path.split(".").pop()!] ??
            "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    } catch {
      return new Response("Missing", { status: 404 });
    }
  });
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const base = "http://127.0.0.1:4317/";
  let closeContext = async () => {};
  const persistentOptions = {
    headless: true,
    args: [
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--autoplay-policy=no-user-gesture-required",
    ],
    viewport: { width: 960, height: 720 },
    hasTouch: true,
  };
  async function rpc(page: Page, type: string, lang = "en") {
    return await page.evaluate(async ({ type, lang }) => {
      const registration = await navigator.serviceWorker.ready;
      return await new Promise<Record<string, unknown>>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = ({ data }) => {
          if (data.done || data.error) {
            channel.port1.close();
            resolve(data);
          }
        };
        registration.active!.postMessage({ type, lang }, [channel.port2]);
      });
    }, { type, lang });
  }
  try {
    const cold = await browser.newContext();
    await cold.setOffline(true);
    let coldFailed = false;
    try {
      await (await cold.newPage()).goto(base);
    } catch {
      coldFailed = true;
    }
    ensure(coldFailed, "Cold offline launch fails honestly");
    await cold.close();
    let context = await chromium.launchPersistentContext(
      `${report}/profile`,
      persistentOptions,
    );
    closeContext = () => context.close();
    let page = await context.newPage();
    page.on("pageerror", (error) => console.error("PAGE", error));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("CONSOLE", msg.text());
    });
    await page.goto(base + "?qa=1");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "No persistent platform label at boot",
    );
    ensure(
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        globalThis.dispatchEvent(event);
        return !event.defaultPrevented;
      }),
      "Native browser installation event is not prevented",
    );
    await page.keyboard.press("f");
    await page.waitForFunction(() => !!document.fullscreenElement);
    checks.push("F enters browser fullscreen");
    await page.keyboard.press("f");
    await page.waitForFunction(() => !document.fullscreenElement);
    checks.push("F leaves browser fullscreen");
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "platform-focus-test";
      document.body.append(input);
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyF", key: "f", bubbles: true }),
      );
    });
    ensure(
      await page.evaluate(() => !document.fullscreenElement),
      "Typing does not activate fullscreen",
    );
    await page.evaluate(() => {
      document.querySelector("#platform-focus-test")!.remove();
      const capture = document.createElement("button");
      capture.className = "is-capturing";
      document.body.append(capture);
      globalThis.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyF", key: "f" }),
      );
      capture.remove();
    });
    ensure(
      await page.evaluate(() => !document.fullscreenElement),
      "Rebinding capture does not activate fullscreen",
    );
    ensure(
      !(await rpc(page, "STATUS")).ready,
      "Worker installation alone is not offline readiness",
    );
    corrupt = true;
    const failed = await rpc(page, "DOWNLOAD");
    ensure(
      String(failed.error).includes("invalid response"),
      "HTML masquerading as audio is rejected",
    );
    ensure(
      !(await rpc(page, "STATUS")).ready,
      "Failed partial download does not mark ready",
    );
    corrupt = false;
    const downloaded = await rpc(page, "DOWNLOAD");
    ensure(
      downloaded.ready,
      "Playable slice and English VO download completes",
    );
    ensure(
      (await rpc(page, "STATUS")).ready,
      "Readiness verifies actual cached entries",
    );
    ensure(
      !(await rpc(page, "STATUS", "es")).ready,
      "Other languages remain explicitly not ready",
    );
    // Simulate eviction and recover by reusing the rest of the pack.
    await page.evaluate(async () => {
      const key = (await caches.keys()).find((k) =>
        k.startsWith("neon-release-")
      )!;
      const cache = await caches.open(key);
      const asset = (await cache.keys()).find((r) => r.url.endsWith(".ogg"))!;
      await cache.delete(asset);
    });
    ensure(
      !(await rpc(page, "STATUS")).ready,
      "Evicted resource invalidates readiness",
    );
    ensure(
      (await rpc(page, "DOWNLOAD")).ready,
      "Retry repairs incomplete pack",
    );
    await context.setOffline(true);
    const misses: string[] = [];
    const cancellations: string[] = [];
    const offlineRequests = new Set<unknown>();
    const successfulHeads = new Set<unknown>();
    const watchOffline = (watched: Page) => {
      watched.on("response", (response) => {
        if (response.request().method() === "HEAD" && response.ok()) {
          successfulHeads.add(response.request());
        }
      });
      watched.on("request", (request) => offlineRequests.add(request));
      watched.on("requestfailed", (request) => {
        // Chromium reports body-less SW HEAD responses as ERR_ABORTED even when
        // fetch resolved with 200. Count only HEADs lacking a successful response.
        if (offlineRequests.has(request) && !successfulHeads.has(request)) {
          if (request.failure()?.errorText === "net::ERR_ABORTED") {
            cancellations.push(request.url());
            return;
          }
          misses.push(
            `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
          );
        }
      });
    };
    watchOffline(page);
    await page.reload();
    const inventory = JSON.parse(
      await Deno.readTextFile(`${out}/offline-manifest.json`),
    ).files as { url: string; bytes: number; lang: string | null }[];
    const required = inventory.filter((f) => !f.lang || f.lang === "en");
    const verified = await page.evaluate(async (files) => {
      const failures: string[] = [];
      for (const file of files) {
        try {
          const response = await fetch(file.url);
          if (
            !response.ok ||
            (await response.arrayBuffer()).byteLength !== file.bytes
          ) failures.push(file.url);
        } catch {
          failures.push(file.url);
        }
      }
      return failures;
    }, required);
    ensure(
      verified.length === 0,
      `Every required pack resource is retrievable offline (${required.length} resources): ${
        verified.join(", ")
      }`,
    );
    ensure(
      await page.evaluate(async () => {
        const r = await fetch("models/pilot_ship.glb", { method: "HEAD" });
        return r.ok && r.headers.get("content-type") === "model/gltf-binary";
      }),
      "Offline HEAD returns actual model metadata",
    );
    // Record only the short, reviewable menu-to-run traversal, not downloads,
    // exhaustive resource verification or browser quota timeout behavior.
    await context.close();
    context = await chromium.launchPersistentContext(`${report}/profile`, {
      ...persistentOptions,
      recordVideo: {
        dir: `${report}/video`,
        size: { width: 960, height: 720 },
      },
    });
    await context.setOffline(true);
    page = await context.newPage();
    watchOffline(page);
    await page.goto(base + "?qa=1");
    await page.waitForTimeout(1500);
    for (
      let i = 0;
      i < 25 && !await page.locator(".nw-screen-main").count();
      i++
    ) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(350);
    }
    await page.locator('.nw-screen-main [data-key="settings"]').click();
    await page.locator(".nw-screen-settings").waitFor();
    checks.push("Offline settings menu opens");
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "No persistent platform label in menus",
    );
    const offlineAction = page.locator('[data-key="offline"]');
    await offlineAction.focus();
    await page.keyboard.press("Enter");
    await page.locator("#platform-tools[open]").waitFor();
    await page.screenshot({ path: `${report}/offline.png` });
    await page.keyboard.press("Escape");
    ensure(
      await offlineAction.evaluate((el) => document.activeElement === el),
      "Keyboard offline access and Escape restore Settings focus",
    );
    ensure(
      await page.locator(".nw-screen-settings").isVisible(),
      "Escape closes only offline dialog, not Settings",
    );
    await offlineAction.tap();
    await page.locator("#platform-close").tap();
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "Touch offline action and Back close without a hidden hit target",
    );
    ensure(
      await offlineAction.evaluate((el) => document.activeElement === el),
      "Touch Back restores Settings focus",
    );
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new CustomEvent("platform-notice", {
          detail: "Fullscreen unavailable test",
        }),
      )
    );
    await page.locator("#platform-notice[open]").waitFor();
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "Fullscreen notice never opens unrelated offline panel",
    );
    await page.keyboard.press("Escape");
    ensure(
      !await page.locator("#platform-notice").isVisible(),
      "Contextual fullscreen notice dismisses with Escape",
    );
    await page.keyboard.press("Escape");
    await page.locator('.nw-screen-main [data-key="newGame"]').click();
    await page.locator('[data-key="start"]').click();
    await page.locator('[data-key="launch"]').click();
    await page.waitForFunction(() =>
      !!(globalThis as unknown as {
        __nwqa?: { sim(): { phase: string | null } };
      }).__nwqa?.sim().phase
    );
    checks.push("Offline menus launch a real run");
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "No persistent platform label during gameplay",
    );
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${report}/offline-run.png` });
    await Deno.writeTextFile(
      `${report}/offline-dom.txt`,
      await page.locator("body").innerText(),
    );
    ensure(
      misses.length === 0,
      `Offline reload has no resource misses: ${misses.join(", ")}`,
    );
    await context.close();
    context = await chromium.launchPersistentContext(
      `${report}/profile`,
      persistentOptions,
    );
    await context.setOffline(true);
    page = await context.newPage();
    page.on("response", (response) => {
      if (response.request().method() === "HEAD" && response.ok()) {
        successfulHeads.add(response.request());
      }
    });
    page.on("requestfailed", (r) => {
      if (
        !successfulHeads.has(r) && r.failure()?.errorText !== "net::ERR_ABORTED"
      ) misses.push(r.url());
    });
    await page.goto(base);
    ensure(
      (await rpc(page, "STATUS")).ready,
      "Cache survives page restart offline",
    );
    await page.waitForTimeout(1000);
    ensure(misses.length === 0, "Restart has no uncached resource misses");
    await context.close();
    context = await chromium.launchPersistentContext(
      `${report}/profile`,
      persistentOptions,
    );
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto(base);
    ensure(
      (await rpc(page, "STATUS")).ready,
      "Offline cache survives full browser/context restart using persistent profile",
    );
    // A restrictive storage quota must surface an error and leave readiness false.
    await context.setOffline(false);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Storage.overrideQuotaForOrigin", {
      origin: base.slice(0, -1),
      quotaSize: 1,
    });
    const quotaResult = await rpc(page, "DOWNLOAD", "es");
    ensure(
      !!quotaResult.error,
      "Quota exhaustion is reported rather than claiming readiness",
    );
    ensure(
      !(await rpc(page, "STATUS", "es")).ready,
      "Quota-failed language remains not ready",
    );
    await cdp.send("Storage.overrideQuotaForOrigin", {
      origin: base.slice(0, -1),
    });
    await context.setOffline(false);
    updated = true;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await page.waitForFunction(async () =>
      !!(await navigator.serviceWorker.getRegistration())?.waiting
    );
    ensure(
      (await rpc(page, "STATUS")).ready,
      "Pending update leaves active offline release intact",
    );
    const before = page.url();
    await page.evaluate(() => {
      document.documentElement.dataset.updateSentinel = "unchanged";
    });
    await page.waitForTimeout(700);
    ensure(
      page.url() === before &&
        await page.evaluate(() =>
          document.documentElement.dataset.updateSentinel === "unchanged"
        ),
      "Pending update never reloads automatically",
    );
    ensure(
      !await page.locator("#platform-tools").isVisible(),
      "Pending update does not reopen offline controls",
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const changed = new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        )
      );
      const channel = new MessageChannel();
      registration.waiting!.postMessage({ type: "ACTIVATE" }, [channel.port2]);
      await changed;
    });
    ensure(
      !(await rpc(page, "STATUS")).ready,
      "Explicit update requires its own verified offline pack",
    );
    ensure(
      await page.evaluate(async () =>
        (await caches.keys()).filter((k) => k.startsWith("neon-release-"))
          .length >= 2
      ),
      "Activation retains previous release cache safely",
    );
    await context.close();
    await Deno.writeTextFile(
      `${report}/result.json`,
      JSON.stringify({ status: "pass", checks, cancellations }, null, 2),
    );
    console.log(`Platform QA passed: ${report}/result.json`);
  } catch (error) {
    await Deno.writeTextFile(
      `${report}/result.json`,
      JSON.stringify({ status: "fail", checks, error: String(error) }, null, 2),
    );
    throw error;
  } finally {
    await closeContext();
    await browser.close();
    await server.shutdown();
  }
}
