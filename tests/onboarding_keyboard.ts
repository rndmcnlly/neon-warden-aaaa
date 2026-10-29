/** Foreground keyboard-only regression, no autoplay or sim mutation.
 * deno run -A --no-lock tests/onboarding_keyboard.ts
 * Build first: deno run -A npm:vite@8.3.1 build --outDir qa/.build/onboarding
 */
import { assert } from "@std/assert";
import { launch, serve } from "../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../qa/av.ts";
import type {} from "../src/app/qaProbe.ts";

const dir = "qa/reports/20261028-onboarding-keyboard";
await Deno.mkdir(`${dir}/raw`, { recursive: true });
const server = serve("qa/.build/onboarding");
const browser = await launch();
const checks: string[] = [];
const errors: string[] = [];
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir: `${dir}/raw`, size: { width: 960, height: 540 } },
});
const av = await installAv(context);
const start = Date.now();
const page = await context.newPage();
av.videoEpoch = start;
page.on("pageerror", (e) => errors.push(e.message));
const flag = (name: string) =>
  page.evaluate((n) => !!globalThis.__nwqa?.flags()[n], name);
const check = (name: string, value: boolean) => {
  assert(value, name);
  checks.push(name);
  console.log("PASS", name);
};
const line = async (id: string) => {
  await page.waitForFunction(
    (id) => globalThis.__nwqa?.log.includes(`line:${id}`),
    id,
    { timeout: 60000 },
  );
};
const ready = async (id: string) => {
  await line(id);
  await page.waitForFunction(
    () => {
      const box = document.querySelector<HTMLElement>(".nw-subtitle-live");
      return !box || box.hidden;
    },
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(250);
};
const press = async (key: string) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(160);
  await page.keyboard.up(key);
};
let failure: unknown;
let focusStart = 0;
try {
  await page.goto(server.url + "?skipto=tutorial&qa=1");
  await page.waitForFunction(() => !!globalThis.__nwqa);
  // Early input during the greeting must not count for later lessons.
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ShiftLeft"]) {
    await press(key);
  }
  await ready("tut_move_000");
  await page.waitForTimeout(1200);
  await check(
    "early input and idle do not credit movement/focus",
    !(await flag("tut.movedLeft")) && !(await flag("tut.focused")),
  );
  await press("KeyA");
  await check(
    "alternate left binding completes only active left lesson",
    await flag("tut.movedLeft") && !(await flag("tut.movedRight")),
  );
  await ready("tut_move_001");
  await press("KeyD");
  await check(
    "fresh right completes right lesson",
    await flag("tut.movedRight"),
  );
  await ready("tut_move_002");
  await page.keyboard.down("ShiftLeft");
  await press("ArrowUp");
  await check(
    "fresh vertical completes vertical lesson",
    await flag("tut.movedVertical"),
  );
  await line("tut_focus_001");
  focusStart = (Date.now() - start) / 1000 - 1;
  await ready("tut_focus_001");
  await page.waitForTimeout(1600);
  await check(
    "held Shift across focus cue does not auto-complete",
    !(await flag("tut.focused")),
  );
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(300);
  await check(
    "browser focus is not slow-flight focus",
    !(await flag("tut.focused")),
  );
  await page.keyboard.up("ShiftLeft");
  await page.waitForTimeout(120);
  await press("KeyX");
  await check(
    "fresh alternate focus binding completes focus",
    await flag("tut.focused"),
  );
  await line("tut_fire_001");
  await check(
    "passive charging has not pre-credited rest lesson",
    !(await flag("tut.charged")),
  );
  await page.waitForTimeout(3500);
} catch (e) {
  failure = String(e);
}
await flushAv(page);
const video = page.video();
await context.close();
try {
  if (video) {
    const raw = await video.path();
    const duration = (Date.now() - start) / 1000;
    const result = await finishAv(av, dir, raw, duration, {});
    await Deno.writeTextFile(`${dir}/av.json`, JSON.stringify(result, null, 2));
    if (focusStart > 0) {
      const trimmed = await new Deno.Command("ffmpeg", {
        args: [
          "-y",
          "-ss",
          String(focusStart),
          "-i",
          `${dir}/reel.mp4`,
          "-t",
          "35",
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          `${dir}/focus-fresh-input.mp4`,
        ],
        stdout: "null",
        stderr: "piped",
      }).output();
      assert(trimmed.success, "trim clip");
    }
  }
} finally {
  await browser.close();
  await server.close();
  await Deno.writeTextFile(
    `${dir}/result.json`,
    JSON.stringify({ checks, errors, failure: failure ?? null }, null, 2),
  );
}
if (failure) throw new Error(String(failure));
assert(errors.length === 0, "no uncaught errors");
