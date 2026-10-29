/** Foreground, normal-speed capture through the canonical QA audio tap. */
import { launch } from "../../qa/capture.ts";
import { installAv, flushAv, finishAv } from "../../qa/av.ts";
const root = new URL("./", import.meta.url).pathname;
const browser = await launch();
const cases = [
  { id: "A", query: "mode=memory", width: 1280, height: 720 },
  { id: "B", query: "mode=briefing", width: 1280, height: 720 },
  { id: "C", query: "mode=briefing&lang=es&quiet=1", width: 390, height: 844 },
  { id: "D", query: "mode=memory&lang=zh&quiet=1", width: 390, height: 844 },
];
try {
  for (const c of cases) {
    const dir = root + "out/" + c.id;
    await Deno.mkdir(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      recordVideo: { dir: dir + "/raw", size: { width: c.width, height: c.height } },
    });
    const av = await installAv(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    av.videoEpoch = Date.now();
    await page.goto("http://127.0.0.1:5192/research/2026-10-29-memory-and-briefings/prototype.html?" + c.query);
    await page.waitForFunction(() => (globalThis as any).__memoryPrototype?.ready);
    const before = await page.evaluate(() => ({
      schedule: (globalThis as any).__memoryPrototype.schedule,
      models: (globalThis as any).__memoryPrototype.models,
      duration: (globalThis as any).__memoryPrototype.duration,
    }));
    const cutStart = (Date.now() - av.videoEpoch) / 1000;
    await page.locator("#start").click();
    await page.waitForTimeout(c.id === "A" ? 5500 : 2800);
    await page.screenshot({ path: dir + "/still.png" });
    if (c.id === "A") {
      await page.waitForTimeout(19800);
      await page.screenshot({ path: dir + "/traffic.png" });
    }
    await page.waitForFunction(() => (globalThis as any).__memoryPrototype.done, undefined, { timeout: 60000 });
    await page.waitForTimeout(600);
    const pacing = await page.evaluate(() => (globalThis as any).__memoryPrototype.pacing);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await flushAv(page);
    const duration = (Date.now() - av.videoEpoch) / 1000;
    const video = page.video()!;
    await context.close();
    const result = await finishAv(av, dir, await video.path(), duration, {});
    await Deno.writeTextFile(dir + "/capture.json", JSON.stringify({ case: c, cutStart, ...before, pacing, overflow, errors, av: result, sources: av.sources }, null, 2));
    console.log(JSON.stringify({ case: c.id, cutStart, duration, pacing, overflow, errors, checks: result.checks }));
  }
} finally { await browser.close(); }
