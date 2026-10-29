/** Production boot regression and focused A/V reel, with isolated build/output. */
import { chromium } from "npm:playwright@1.58.2";
import { captureReel, serve } from "../qa/capture.ts";
import { REELS } from "../qa/reels.ts";
import { assets } from "../qa/assets.ts";
import { coverage } from "../qa/coverage.ts";

if (import.meta.main) await run();

async function run() {
  const report = `qa/reports/logo-integration-${
    new Date().toISOString().replaceAll(":", "-")
  }`;
  const out = "qa/.build/logo-integration";
  await Deno.mkdir(report, { recursive: true });
  // Do not run vo:sync here: Captain/cand1 are concurrently maintained selections.
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
  const server = serve(out);
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const checks: string[] = [];
  const errors: string[] = [];
  const ensure = (ok: unknown, text: string) => {
    if (!ok) throw new Error(text);
    checks.push(text);
  };
  try {
    for (
      const mode of [
        "desktop",
        "first",
        "second",
        "immediate",
        "motion",
        "flashing",
        "mobile",
      ] as const
    ) {
      const mobile = mode === "mobile";
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 720 },
        hasTouch: mobile,
        reducedMotion: mode === "motion" ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(({ motion, flashing }) => {
        localStorage.setItem(
          "neon-warden.settings",
          JSON.stringify({
            version: 1,
            settings: {
              accessibility: {
                reduceMotion: motion,
                reducedFlashing: flashing,
              },
            },
          }),
        );
      }, { motion: mode === "motion", flashing: mode === "flashing" });
      // Re-enter boot twice to catch overlays surviving a prior skipped screen.
      for (
        let attempt = 0;
        attempt < (mode === "immediate" ? 2 : 1);
        attempt++
      ) {
        await page.goto(`${server.url}?qa=1`);
        await page.locator(".nw-screen-gate").waitFor();
        await page.locator(".nw-screen-gate").click();
        await page.locator('[data-key="continue"]').click();
        await page.locator('.nw-flat-logos[data-brand="studio"]').waitFor();
        ensure(
          await page.locator(".nw-flat-logos").count() === 1,
          `${mode}: one screen-locked layer (${attempt})`,
        );
        ensure(
          await page.locator(".nw-screen-logos.is-3d").count() === 0,
          `${mode}: no legacy 3D boot class`,
        );
        ensure(
          await page.locator(".nw-skip").isVisible(),
          `${mode}: Skip stays visible`,
        );
        ensure(
          await page.locator(".nw-skip").evaluate((el) => {
            const b = el.getBoundingClientRect();
            return b.height >= 44 && b.left >= 0 && b.right <= innerWidth &&
              b.bottom <= innerHeight;
          }),
          `${mode}: Skip has an in-bounds touch target`,
        );
        const start = Date.now();
        if (mode === "immediate" || mode === "first") {
          if (mode === "first") await page.waitForTimeout(800);
          await page.keyboard.press(mode === "immediate" ? "Escape" : "Enter");
        } else {
          await page.waitForTimeout(800);
          if (mode === "motion" || mode === "flashing") {
            ensure(
              await page.locator(".nw-flat-lockup").evaluate((el) =>
                getComputedStyle(el).opacity
              ) === "1",
              `${mode}: identity fully visible`,
            );
            ensure(
              await page.locator(".nw-flat-glint").evaluate((el) =>
                getComputedStyle(el).opacity
              ) === "0",
              `${mode}: glint suppressed`,
            );
          }
          await page.screenshot({ path: `${report}/${mode}-studio.png` });
          await page.locator('.nw-flat-logos[data-brand="incubator"]')
            .waitFor();
          ensure(Date.now() - start >= 2800, `${mode}: studio hold retained`);
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${report}/${mode}-incubator.png` });
          const fits = await page.locator(".nw-flat-lockup").evaluate((el) => {
            const b = el.getBoundingClientRect();
            return b.left >= 0 && b.right <= innerWidth && b.top >= 0 &&
              b.bottom <= innerHeight && el.scrollWidth <= el.clientWidth;
          });
          ensure(fits, `${mode}: identity fits viewport`);
          if (mode === "second") await page.locator(".nw-skip").click();
          if (mobile) await page.locator(".nw-skip").tap();
        }
        await page.locator(".nw-screen-title").waitFor();
        if (["desktop", "motion", "flashing"].includes(mode)) {
          ensure(
            Date.now() - start >= 6000,
            `${mode}: both 3200 ms holds retained`,
          );
        }
        ensure(
          await page.locator(".nw-flat-logos").count() === 0,
          `${mode}: no overlay after completion/skip`,
        );
        const flags = await page.evaluate(() =>
          (window as unknown as {
            __nwqa: { flags(): Record<string, boolean> };
          }).__nwqa.flags()
        );
        ensure(
          flags["boot.logosDone"] && !flags["boot.studioLogo"] &&
            !flags["boot.publisherLogo"],
          `${mode}: Director reaches final boot flags`,
        );
        if (mode === "desktop") {
          await page.locator(".nw-screen-title").click();
          await page.locator('[data-key="newGame"]').click();
          await page.locator('[data-key="start"]').click();
          await page.locator('[data-key="launch"]').click();
          await page.waitForTimeout(400);
          await page.keyboard.press("Escape");
          await page.locator('[data-key="restart"]').click();
          await page.locator('[data-key="confirm"]').click();
          await page.waitForTimeout(400);
          ensure(
            await page.locator(".nw-flat-logos").count() === 0,
            "Checkpoint restart does not resurrect a boot overlay",
          );
          ensure(
            await page.locator(".nw-screen-logos").count() === 0,
            "Checkpoint restart leaves the boot screen unmounted",
          );
        }
      }
      await context.close();
    }
    const stages = [await coverage(), await assets()];
    await Deno.writeTextFile(
      `${report}/static.json`,
      JSON.stringify(stages, null, 2),
    );
    const reel = await captureReel(
      browser,
      REELS.find((r) => r.id === "boot-cinematic")!,
      server.url,
      report,
    );
    ensure(reel.status !== "fail", "Focused existing boot A/V reel passes");
    ensure(errors.length === 0, "No browser exceptions");
    await Deno.writeTextFile(
      `${report}/result.json`,
      JSON.stringify(
        {
          checks,
          errors,
          reel,
          static: stages.map((s) => ({
            stage: s.stage,
            checks: s.checks.map((c) => ({ id: c.id, status: c.status })),
          })),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          report,
          checks: checks.length,
          reel: reel.status,
          static: stages.map((s) => ({
            stage: s.stage,
            failures: s.checks.filter((c) => c.status === "fail"),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await server.close();
  }
}
