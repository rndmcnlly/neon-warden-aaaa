/** Focused viewer QA only: no game captures, builds, APIs or evidence edits. */
import { chromium } from "npm:playwright@1.58.2";
const here = new URL(".", import.meta.url).pathname;
const url =
  "http://127.0.0.1:8123/artifacts/research/2026-10-28-moments/index.html";
const browser = await chromium.launch({ headless: true });
const checks: { name: string; pass: boolean; detail?: unknown }[] = [];
const check = (name: string, pass: boolean, detail?: unknown) => {
  checks.push({ name, pass, detail });
  if (!pass) throw new Error(name);
};
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [[390, 844], [800, 600], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.waitForFunction(() =>
      document.querySelector("#clip-title")?.textContent === "Loadout choices"
    );
    const initial = await page.evaluate(() => ({
      players: document.querySelectorAll("video").length,
      paused: document.querySelector("video")!.paused,
      overflow: document.documentElement.scrollWidth > innerWidth,
      chapters: document.querySelectorAll("#chapters button").length,
      archive: document.querySelectorAll("#archive-list button").length,
      minButton: Math.min(
        ...[...document.querySelectorAll("button")].filter((b) =>
          b.getBoundingClientRect().height > 0
        ).map((b) => b.getBoundingClientRect().height),
      ),
    }));
    check(
      `${width}×${height}: one player, no autoplay, no overflow`,
      initial.players === 1 && initial.paused && !initial.overflow,
      initial,
    );
    check(
      `${width}×${height}: six chapters, full archive, 48px controls`,
      initial.chapters === 6 && initial.archive === 30 &&
        initial.minButton >= 48,
    );
    await page.locator("#next").focus();
    await page.keyboard.press("ArrowRight");
    check(
      `${width}: keyboard next`,
      await page.locator("#clip-title").textContent() === "Ship appearance",
    );
    await page.keyboard.press("ArrowLeft");
    check(
      `${width}: keyboard previous`,
      await page.locator("#clip-title").textContent() === "Loadout choices",
    );
    await page.locator("#toggle").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      !document.querySelector("video")!.paused &&
      document.querySelector("video")!.currentTime > 0
    );
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      (globalThis as unknown as { pauseEvents: number }).pauseEvents = 0;
      // load() can cancel a queued pause event. Observe the explicit pause
      // while the previous media is still playing, not that queued event.
      const originalPause = v.pause.bind(v);
      v.pause = () => {
        if (!v.paused) {
          (globalThis as unknown as { pauseEvents: number }).pauseEvents++;
        }
        originalPause();
      };
    });
    await page.locator("#next").click();
    const switched = await page.evaluate(() => ({
      paused: document.querySelector("video")!.paused,
      time: document.querySelector("video")!.currentTime,
      players: document.querySelectorAll("video").length,
      pauses: (globalThis as unknown as { pauseEvents: number }).pauseEvents,
    }));
    check(
      `${width}: changing clip stops audio and does not autoplay`,
      switched.paused && switched.time === 0 && switched.players === 1 &&
        switched.pauses > 0,
      switched,
    );
    if (width < 850) await page.locator("#chapter-select").selectOption("5");
    else await page.locator("#chapters button").nth(5).click();
    check(
      `${width}: endings gated and player source removed`,
      await page.locator("#spoiler").isVisible() &&
        await page.locator("#player").getAttribute("src") === null,
    );
    await page.locator("#archive summary").click();
    await page.locator("#archive-list button").filter({
      hasText: "A near miss",
    }).click();
    check(
      `${width}: ordinary archive clip exits spoiler gate`,
      await page.locator("#viewing").isVisible() &&
        await page.locator("#clip-title").textContent() === "A near miss",
    );
    await page.locator("#archive-list button").filter({
      hasText: "The killing blow",
    }).click();
    check(
      `${width}: archive ending also requires explicit reveal`,
      await page.locator("#spoiler").isVisible(),
    );
    await page.locator("#archive summary").click();
    if (width < 850) await page.locator("#chapter-select").selectOption("5");
    else await page.locator("#chapters button").nth(5).click();
    await page.locator("#reveal").click();
    check(
      `${width}: explicit reveal remains paused`,
      await page.locator("#clip-title").textContent() === "After the kill" &&
        await page.locator("video").evaluate((v) =>
          (v as HTMLVideoElement).paused
        ),
    );
    await page.locator("#archive summary").click();
    check(
      `${width}: expanded archive has no overflow`,
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    );
    await page.locator("#archive-list button").filter({
      hasText: "A near miss",
    }).click();
    check(
      `${width}: archive uses same player with its own guidance`,
      await page.locator("#clip-title").textContent() === "A near miss" &&
        await page.locator("video").count() === 1,
    );
    await page.goto(url);
    if (width === 1366) {
      await page.locator("#player").evaluate((el) =>
        el.scrollIntoView({ block: "start" })
      );
      await page.screenshot({
        path: `${here}gallery-desktop.jpg`,
        type: "jpeg",
        quality: 80,
      });
    }
    if (width === 390) {
      await page.locator("#chapter-title").evaluate((el) =>
        el.scrollIntoView({ block: "start" })
      );
      await page.screenshot({
        path: `${here}gallery-mobile.jpg`,
        type: "jpeg",
        quality: 80,
      });
      // A real touch context, not just a narrow desktop layout.
      const touch = await browser.newContext({
        viewport: { width, height },
        hasTouch: true,
        isMobile: true,
      });
      const p = await touch.newPage();
      await p.goto(url);
      await p.locator("#next").tap();
      check(
        "390: touch next",
        await p.locator("#clip-title").textContent() === "Ship appearance",
      );
      await touch.close();
    }
  }
  check("No browser page errors", errors.length === 0, errors);
} finally {
  await browser.close();
  await Deno.writeTextFile(
    `${here}gallery-qa.json`,
    JSON.stringify(
      {
        created: new Date().toISOString(),
        scope: "Viewer-only QA; original capture evidence unchanged",
        url,
        checks,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(`${checks.length} viewer checks passed`);
