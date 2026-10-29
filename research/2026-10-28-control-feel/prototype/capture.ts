/** Isolated production build, existing QA audio tap, real-time keyboard control. */
import { launch, serve } from "../../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../../qa/av.ts";
import type {} from "../../../src/app/qaProbe.ts";
const root = Deno.cwd();
const out = `${root}/research/2026-10-28-control-feel/prototype`;
const temp = await Deno.makeTempDir({
  dir: "/private$TMPDIR/opencode",
  prefix: "movement-focus-",
});
async function command(args: string[], cwd = root) {
  const result = await new Deno.Command(args[0], { args: args.slice(1), cwd, stdout: "piped", stderr: "piped" }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout);
}
// No vo:sync or shared qa/.build mutation. Snapshot source for an isolated fixture.
await command(["cp", "-R", "src", "deno.json", "deno.lock", temp]);
await Deno.symlink(`${root}/public`, `${temp}/public`);
await Deno.symlink(`${root}/node_modules`, `${temp}/node_modules`);
await Deno.mkdir(`${temp}/research/2026-10-28-control-feel/prototype`, { recursive: true });
await Deno.copyFile(`${out}/demo.ts`, `${temp}/research/2026-10-28-control-feel/prototype/demo.ts`);
await Deno.writeTextFile(`${temp}/index.html`, `<html><head><style>html,body{margin:0;background:#02040b;width:100%;height:100%;overflow:hidden}canvas{width:100%;height:100%;display:block}</style></head><body><canvas></canvas><script type="module" src="/research/2026-10-28-control-feel/prototype/demo.ts"></script></body></html>`);
await command(["deno", "run", "-A", "npm:vite@8.3.1", "build", "--outDir", `${temp}/dist`, "--logLevel", "warn"], temp);
const server = serve(`${temp}/dist`);
const browser = await launch();
const summaries = [];
try {
  for (const profile of ["classic", "hybrid"]) for (const mode of ["high", "reduced-low"]) {
    const dir = `${out}/isolated-${profile}-${mode}`;
    await Deno.mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } }, reducedMotion: mode === "reduced-low" ? "reduce" : "no-preference" });
    await context.addInitScript(({ mode }) => {
      localStorage.setItem("neon-warden.settings", JSON.stringify({ version: 1, settings: {
        display: { preset: mode === "high" ? "high" : "low" },
        accessibility: { shake: mode === "high" ? 1 : 0, reduceMotion: mode !== "high", reducedFlashing: mode !== "high", gameSpeed: 1 },
      } }));
    }, { mode });
    const av = await installAv(context);
    const start = Date.now();
    const page = await context.newPage();
    av.videoEpoch = (start + Date.now()) / 2;
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`${server.url}?skipto=sector1&movement=${profile}&seed=121&qa=1`);
    await page.waitForTimeout(1200);
    // Unlock audio without firing. Matched, normal-speed hold/corner/release.
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(450);
    await page.keyboard.down("ShiftLeft");
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}/focus-rest.png` });
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(450);
    // Focus + firing demonstrates that compact precision and forward scan differ.
    await page.keyboard.down("Space");
    await page.waitForTimeout(700);
    await page.keyboard.up("ArrowRight");
    await page.screenshot({ path: `${dir}/focus-fire.png` });
    await page.keyboard.up("ShiftLeft");
    await page.waitForTimeout(550);
    await page.keyboard.up("Space");
    await page.waitForTimeout(650);
    const focusEvents = await page.evaluate(() => globalThis.__nwqa?.events.filter(e => e.type === "focusChanged"));
    // Blur cancels held focus. Pause integration is checked in the full game below.
    await page.keyboard.down("ShiftLeft");
    await page.waitForTimeout(100);
    await page.evaluate(() => dispatchEvent(new Event("blur")));
    await page.keyboard.up("ShiftLeft");
    await page.waitForTimeout(200);
    await page.waitForTimeout(250);
    await flushAv(page);
    const video = page.video()!;
    await context.close();
    const path = await video.path();
    const duration = Number((await command(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])).trim());
    const result = await finishAv(av, dir, path, duration, {});
    const summary = { profile, mode, errors, focusEvents, ...result };
    await Deno.writeTextFile(`${dir}/result.json`, JSON.stringify(summary, null, 2));
    summaries.push(summary);
    await command(["ffmpeg", "-y", "-i", `${dir}/reel.mp4`, "-vf", "fps=1,scale=426:240,tile=3x2", "-frames:v", "1", `${dir}/sheet.jpg`]);
    console.log(profile, mode, JSON.stringify(focusEvents), result.checks.map(c => `${c.status}:${c.id}`).join(","));
  }
  // Full production entry point, not the isolation fixture: verify real menu pause/blur.
  await command(["deno", "run", "-A", "npm:vite@8.3.1", "build", "--outDir", `${temp}/integrated`, "--logLevel", "warn"]);
  const integrated = serve(`${temp}/integrated`);
  const lifecycle = [];
  try {
    for (const profile of ["classic", "hybrid"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(String(e)));
      await page.goto(`${integrated.url}?skipto=sector1&movement=${profile}&qa=1`);
      await page.waitForTimeout(1000);
      const checks = [];
      for (const reason of ["pause", "blur"]) {
        await page.keyboard.down("ShiftLeft");
        await page.keyboard.down("ArrowRight");
        await page.waitForTimeout(100);
        if (reason === "pause") await page.keyboard.press("Escape");
        else await page.evaluate(() => dispatchEvent(new Event("blur")));
        await page.waitForTimeout(100);
        const a = await page.evaluate(() => globalThis.__nwqa!.sim().tick);
        await page.waitForTimeout(200);
        const b = await page.evaluate(() => globalThis.__nwqa!.sim().tick);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        const active = await page.evaluate(() => globalThis.__nwqa!.events.filter(e => e.type === "focusChanged").at(-1));
        checks.push({ reason, tickFrozen: a === b, focusedAfterResume: active?.type === "focusChanged" ? active.active : null });
        await page.keyboard.up("ShiftLeft");
        await page.keyboard.up("ArrowRight");
      }
      lifecycle.push({ profile, errors, checks });
      await context.close();
    }
  } finally { await integrated.close(); }
  await Deno.writeTextFile(`${out}/lifecycle-browser.json`, JSON.stringify(lifecycle, null, 2));
} finally { await browser.close(); await server.close(); }
await Deno.writeTextFile(`${out}/capture-summary.json`, JSON.stringify({ recorded: new Date().toISOString(), isolatedBuild: temp, summaries }, null, 2));
