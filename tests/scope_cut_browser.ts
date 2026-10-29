/** Focused production regression: deno run -A tests/scope_cut_browser.ts */
import { chromium } from "npm:playwright@1.58.2";

if (import.meta.main) await run();

async function run() {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const report = `qa/reports/scope-cut-${stamp}`;
  const out = "qa/.build/scope-cut";
  await Deno.mkdir(report, { recursive: true });
  const checks: string[] = [];
  const ensure = (ok: unknown, text: string) => {
    if (!ok) throw new Error(text);
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
  ensure(build.success, new TextDecoder().decode(build.stderr));
  checks.length = 0;
  const inventory = JSON.parse(
    await Deno.readTextFile(`${out}/offline-manifest.json`),
  );
  ensure(
    !inventory.files.some((f: { url: string }) => /pilot_figure/.test(f.url)),
    "Offline inventory excludes all historical Pilot figure GLBs",
  );
  const mime: Record<string, string> = {
    html: "text/html",
    js: "text/javascript",
    css: "text/css",
    json: "application/json",
    glb: "model/gltf-binary",
    ogg: "audio/ogg",
    png: "image/png",
  };
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (req) => {
      let path = decodeURIComponent(new URL(req.url).pathname).slice(1) ||
        "index.html";
      if (path.endsWith("/")) path += "index.html";
      if (path.includes("..")) {
        return new Response("Forbidden", {
          status: 403,
        });
      }
      try {
        return new Response(await Deno.readFile(`${out}/${path}`), {
          headers: {
            "content-type": mime[path.split(".").pop()!] ??
              "application/octet-stream",
          },
        });
      } catch {
        return new Response("Missing", { status: 404 });
      }
    },
  );
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const requests: string[] = [];
  const errors: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "neon-warden.progress",
        JSON.stringify({
          loadout: {
            weapon: "notary",
            sensor: "auditor",
            cosmetics: {
              paint: "rustRed",
              trimColor: "#ff4d6d",
              decal: "tallyMarks",
              trail: "ember",
              helmetLivery: "repainted",
            },
          },
          codex: ["codex.warden"],
          careerPay: 5000,
        }),
      )
    );
    // The game page; the site root is the landing page.
    const base = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}/play/`;
    await page.goto(`${base}?qa=1`);
    for (
      let i = 0;
      i < 16 && !(await page.locator('[data-key="hangar"]').isVisible());
      i++
    ) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(450);
    }
    await page.locator('[data-key="hangar"]').click();
    await page.locator(".nw-screen-hangar").waitFor();
    ensure(
      await page.locator('[data-key="hangar-helmet"]').count() === 0,
      "Hangar has no helmet control",
    );
    for (
      const slot of ["weapon", "sensor", "paint", "trim", "decal", "trail"]
    ) {
      ensure(
        await page.locator(`[data-key="hangar-${slot}"]`).isVisible(),
        `Ship ${slot} control remains available`,
      );
    }
    await page.locator('[data-key="hangar-paint"]').focus();
    await page.keyboard.press("ArrowRight");
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("neon-warden.progress")!)
    );
    ensure(
      saved.loadout.weapon === "notary" && saved.loadout.sensor === "auditor",
      "Legacy ship packages retained",
    );
    ensure(
      saved.careerPay === 5000 && saved.codex.includes("codex.warden"),
      "Legacy progress retained after hangar edit",
    );
    ensure(
      !("helmetLivery" in saved.loadout.cosmetics),
      "Next loadout save drops only retired helmet field",
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${report}/hangar.png` });
    await page.goto(
      `${base}?skipto=ending-pacifist&qa=1&autoplay=pacifist&speed=4`,
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      "window.__nwqa?.log.includes('line:pilot_keep_001')",
      null,
      { timeout: 25000 },
    );
    ensure(
      true,
      "Pacifist ending reaches Pilot's unchanged reply over ship framing",
    );
    // Camera interpolation uses wall time, not the accelerated story clock.
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${report}/ship-reply.png` });
    ensure(
      requests.some((url) => /pilot_ship\.glb/.test(url)),
      "Ship model still loads",
    );
    ensure(
      !requests.some((url) => /pilot_figure/.test(url)),
      "No figure requests during boot, hangar or pacifist ending",
    );
    ensure(errors.length === 0, `No browser errors: ${errors.join("; ")}`);
    await Deno.writeTextFile(
      `${report}/result.json`,
      JSON.stringify({ checks, requests, errors }, null, 2),
    );
    console.log(`${checks.length} checks passed: ${report}/result.json`);
  } finally {
    await browser.close();
    await server.shutdown();
  }
}
