/** Isolated foreground QA and 10-second phone/desktop reels.
 * deno run -A --no-lock tests/logo_capture.ts
 */
import { assert, assertEquals } from "@std/assert";
import { launch } from "../qa/capture.ts";
import type { FlatLogoLayer } from "../src/presentation/flatLogos.ts";

declare global {
  var logoReview: FlatLogoLayer;
}
const dir = "qa/reports/20261028-flat-logos";
await Deno.mkdir(dir, { recursive: true });
const server = new Deno.Command("deno", {
  args: [
    "run",
    "-A",
    "npm:vite@8.3.1",
    "--host",
    "127.0.0.1",
    "--port",
    "5198",
    "--strictPort",
  ],
  stdout: "null",
  stderr: "inherit",
}).spawn();
const browser = await launch();
const checks: string[] = [];
const errors: string[] = [];
try {
  // Bounded startup retries, not a long-running task completion poll.
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch("http://127.0.0.1:5198/");
      await response.body?.cancel();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  for (
    const [id, width, height] of [["desktop", 1280, 720], [
      "phone",
      390,
      844,
    ]] as const
  ) {
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: `${dir}/raw`, size: { width, height } },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5198/research/2026-10-28-flat-logos/");
    await page.waitForFunction(() => !!globalThis.logoReview);
    await page.click("#play");
    await page.waitForTimeout(2100);
    await page.screenshot({ path: `${dir}/${id}-studio.png` });
    await page.waitForTimeout(3200);
    await page.screenshot({ path: `${dir}/${id}-incubator.png` });
    await page.waitForTimeout(4700);
    const video = page.video()!;
    for (const brand of ["studio", "incubator"] as const) {
      await page.evaluate((brand) => {
        logoReview.show(brand);
      }, brand);
      assertEquals(
        await page.locator(".nw-flat-lockup").evaluate((e) =>
          getComputedStyle(e).opacity
        ),
        "1",
        "show without a clock provides a full static fallback",
      );
      await page.evaluate((brand) => {
        logoReview.update(0);
        logoReview.show(brand);
      }, brand);
      assertEquals(
        await page.locator(".nw-flat-lockup").evaluate((e) =>
          getComputedStyle(e).opacity
        ),
        "0",
        "repeated show calls do not restart or override the caller's frame",
      );
      await page.evaluate(() => logoReview.update(2000));
      const metrics = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>(".nw-flat-logos")!;
        const name = document.querySelector<HTMLElement>(".nw-flat-name")!;
        const mark = document.querySelector<HTMLImageElement>(".nw-flat-mark")!;
        return {
          overflow: root.scrollWidth > root.clientWidth,
          transform: getComputedStyle(name).transform,
          image: mark.complete && mark.naturalWidth > 0,
        };
      });
      assertEquals(metrics.overflow, false);
      assertEquals(metrics.transform, "none");
      await page.waitForFunction(() =>
        document.querySelector<HTMLImageElement>(".nw-flat-mark")!
          .naturalWidth > 0
      );
      checks.push(
        `${id}/${brand}: no overflow, no transform, local vector loaded`,
      );
    }
    await page.evaluate(() => {
      logoReview.setSettings({ reducedFlashing: true });
      logoReview.update(1150);
    });
    assertEquals(
      await page.locator(".nw-flat-glint").evaluate((e) =>
        getComputedStyle(e).opacity
      ),
      "0",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      logoReview.setSettings({});
      logoReview.update(0);
    });
    assertEquals(
      await page.locator(".nw-flat-lockup").evaluate((e) =>
        getComputedStyle(e).opacity
      ),
      "1",
    );
    await page.evaluate(() => logoReview.hide());
    assert(await page.locator(".nw-flat-logos").isHidden());
    await page.evaluate(() => {
      logoReview.dispose();
      logoReview.show("studio");
    });
    assertEquals(await page.locator(".nw-flat-logos").count(), 0);
    checks.push(
      `${id}: reduced flashing, OS reduced motion, skip/hide and dispose`,
    );
    await context.close();
    const raw = await video.path();
    const result = await new Deno.Command("ffmpeg", {
      args: [
        "-y",
        "-i",
        raw,
        "-t",
        "10",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        `${dir}/${id}.mp4`,
      ],
      stdout: "null",
      stderr: "piped",
    }).output();
    assert(result.success, new TextDecoder().decode(result.stderr));
  }
  assertEquals(errors, []);
  await Deno.writeTextFile(
    `${dir}/result.json`,
    JSON.stringify({ status: "pass", checks, errors }, null, 2),
  );
  console.log(`${checks.length} checks PASS: ${dir}/result.json`);
} finally {
  await browser.close();
  server.kill("SIGTERM");
  await server.status;
}
