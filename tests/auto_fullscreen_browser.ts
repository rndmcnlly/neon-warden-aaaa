/**
 * Auto fullscreen on mobile (src/platform/autoFullscreen.ts), by Playwright
 * device emulation:
 *
 *   deno run -A --unsafe-proto tests/auto_fullscreen_browser.ts [baseUrl]
 *
 * Needs a running dev or preview server (default http://127.0.0.1:4396/).
 * Pixel 7 and iPhone 15, each in Chromium and WebKit, plus a desktop
 * control. `requestFullscreen` is wrapped to count calls, because whether a
 * headless engine grants the request is the engine's business; the game's
 * business is asking on the right tap. Checks: the gate tap asks on Android
 * (and nothing else does on iPhone, where the Add to Home Screen hint shows
 * once instead); a tap during play never asks; desktop never asks.
 */
import { chromium, devices, type Page, webkit } from "npm:playwright@1.64.0";

const BASE = Deno.args[0] ?? "http://127.0.0.1:4396/";
const stamp = new Date().toISOString().replaceAll(":", "-");
const report = `qa/reports/auto-fullscreen-${stamp}`;
await Deno.mkdir(report, { recursive: true });

interface Check {
  device: string;
  name: string;
  pass: boolean;
  detail?: string;
}
const checks: Check[] = [];

const COUNT = `(() => {
  const real = Element.prototype.requestFullscreen;
  globalThis.__fsCalls = 0;
  if (real) {
    Element.prototype.requestFullscreen = function (...args) {
      globalThis.__fsCalls++;
      return real.apply(this, args);
    };
  }
})();`;

const calls = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as { __fsCalls: number }).__fsCalls
  );
const hintOpen = (page: Page) =>
  page.evaluate(() =>
    (document.getElementById("platform-notice") as HTMLDialogElement | null)
      ?.open ?? false
  );

async function gateTap(page: Page, touch: boolean) {
  await page.goto(`${BASE}?qa=1&autofs`);
  await page.locator(".nw-screen-gate").waitFor({
    state: "attached",
    timeout: 20000,
  });
  await page.waitForTimeout(800);
  if (touch) {
    await page.tap(".nw-screen-gate", { position: { x: 150, y: 300 } });
  } else await page.click(".nw-screen-gate", { position: { x: 150, y: 300 } });
  await page.waitForTimeout(600);
}

const COMBOS = [
  { id: "pixel7-chromium", engine: chromium, device: "Pixel 7", ios: false },
  { id: "pixel7-webkit", engine: webkit, device: "Pixel 7", ios: false },
  { id: "iphone15-webkit", engine: webkit, device: "iPhone 15", ios: true },
  { id: "iphone15-chromium", engine: chromium, device: "iPhone 15", ios: true },
] as const;

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const combo of COMBOS.filter((c) => c.engine === engine)) {
      const ok = (name: string, pass: unknown, detail?: string) =>
        checks.push({ device: combo.id, name, pass: !!pass, detail });
      const context = await browser.newContext({ ...devices[combo.device] });
      await context.addInitScript(COUNT);
      const page = await context.newPage();
      const errors: string[] = [];
      // WebKit reports VO fetches cut off by our own `goto` as "access
      // control checks"; that is navigation, not this feature.
      page.on("pageerror", (e) => {
        if (!/\.ogg due to access control checks/.test(e.message)) {
          errors.push(e.message);
        }
      });
      try {
        await gateTap(page, true);
        const n = await calls(page);
        const full = await page.evaluate(() => !!document.fullscreenElement);
        // Playwright's WebKit build has no element fullscreen at all, so a
        // Pixel profile there is an unsupported browser: it gets the hint.
        const capable = await page.evaluate(() =>
          !!document.documentElement.requestFullscreen &&
          document.fullscreenEnabled
        );
        if (combo.ios || !capable) {
          ok(
            `gate tap does not request fullscreen (${
              combo.ios ? "iPhone" : "engine lacks element fullscreen"
            })`,
            n === 0,
            `${n}`,
          );
          ok(
            "gate tap shows the Add to Home Screen hint",
            await hintOpen(page),
          );
          const text = await page.locator("#platform-notice p").textContent();
          ok("hint names Add to Home Screen", /Home Screen/.test(text ?? ""));
          await page.screenshot({ path: `${report}/${combo.id}-hint.png` });
          await page.tap("#platform-notice button");
          await page.waitForTimeout(300);
          ok("hint dismisses by tap", !(await hintOpen(page)));
          await gateTap(page, true);
          ok("hint shows only once per device", !(await hintOpen(page)));
        } else {
          ok(
            "gate tap requests fullscreen",
            n >= 1,
            `calls ${n}, full ${full}`,
          );
          ok("no hint on Android", !(await hintOpen(page)));
          ok(
            "gate still proceeds to the notice",
            await page.locator(".nw-screen-notice").isVisible(),
          );
        }
        // Mid-run taps are controls, never fullscreen requests.
        await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
        await page.goto(`${BASE}?qa=1&autofs&skipto=sector1`);
        await page.waitForFunction(() => "__nwqa" in globalThis, null, {
          timeout: 20000,
        });
        await page.waitForTimeout(1500);
        const before = await calls(page);
        // The first tap of a run is a control (it also shows the deck).
        await page.touchscreen.tap(200, 300);
        await page.locator('[data-qa="touch-fire"]').waitFor({
          timeout: 15000,
        });
        await page.touchscreen.tap(200, 320);
        await page.waitForTimeout(400);
        ok(
          "a tap during play never requests fullscreen",
          (await calls(page)) === before,
        );
        ok("no hint during play", !(await hintOpen(page)));
      } catch (e) {
        ok("ran to the end", false, String(e).slice(0, 300));
      }
      ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// Desktop control: a mouse click on the gate never asks.
{
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(COUNT);
  const page = await context.newPage();
  await gateTap(page, false);
  checks.push({
    device: "desktop-chromium",
    name: "desktop click never requests fullscreen or hints",
    pass: (await calls(page)) === 0 && !(await hintOpen(page)),
  });
  await browser.close();
}

const failed = checks.filter((c) => !c.pass);
await Deno.writeTextFile(
  `${report}/result.json`,
  JSON.stringify(
    {
      base: BASE,
      passed: checks.length - failed.length,
      failed: failed.length,
      checks,
    },
    null,
    2,
  ),
);
for (const c of checks) {
  console.log(
    `${c.pass ? "PASS" : "FAIL"} ${c.device}: ${c.name}${
      c.detail ? ` (${c.detail})` : ""
    }`,
  );
}
console.log(`${checks.length - failed.length}/${checks.length} -> ${report}`);
if (failed.length) Deno.exit(1);
