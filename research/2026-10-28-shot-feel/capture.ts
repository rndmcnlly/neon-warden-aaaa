/** Isolated before/after real-time capture, using the studio's existing AV tap. */
import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";

const root = Deno.cwd();
const baseline = "3f785ff";
const out = `${root}/research/2026-10-28-shot-feel`;
const temp = await Deno.makeTempDir({
  dir: "/private$TMPDIR/opencode",
  prefix: "shot-feel-",
});
async function command(args: string[], cwd = root) {
  const result = await new Deno.Command(args[0], {
    args: args.slice(1), cwd, stdout: "piped", stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout);
}
await command(["cp", "-R", "src", "index.html", "deno.json", "deno.lock", "vite.config.ts", temp]);
await Deno.symlink(`${root}/public`, `${temp}/public`);
await Deno.symlink(`${root}/node_modules`, `${temp}/node_modules`);
for (const file of ["src/sim/tuning.ts", "src/sim/sim.ts", "src/render/stage.ts", "src/render/cameraRig.ts"]) {
  await Deno.writeTextFile(`${temp}/${file}`, await command(["git", "show", `${baseline}:${file}`]));
}
// Never run vo:sync or touch the shared QA build/output directories.
await command(["deno", "run", "-A", "npm:vite@8.3.1", "build", "--outDir", `${temp}/before`, "--logLevel", "warn"], temp);
await command(["deno", "run", "-A", "npm:vite@8.3.1", "build", "--outDir", `${temp}/after`, "--logLevel", "warn"]);
const browser = await launch();
try {
  for (const arm of ["before", "after"]) {
    const server = serve(`${temp}/${arm}`);
    try {
      for (const mode of ["high", "shake-off-low"]) {
        const dir = `${out}/${arm}-${mode}`;
        await Deno.mkdir(dir, { recursive: true });
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          recordVideo: { dir, size: { width: 1280, height: 720 } },
        });
        await context.addInitScript(({ mode }) => {
          localStorage.setItem("neon-warden.settings", JSON.stringify({ version: 1, settings: {
            display: { preset: mode === "high" ? "high" : "low" },
            accessibility: { shake: mode === "high" ? 1 : 0, reducedFlashing: true },
          } }));
        }, { mode });
        const av = await installAv(context);
        const start = Date.now();
        const page = await context.newPage();
        av.videoEpoch = (start + Date.now()) / 2;
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(String(e)));
        await page.goto(`${server.url}?skipto=sector1&seed=121&qa=1`);
        await page.waitForTimeout(1500);
        await page.keyboard.down("Space");
        await page.waitForTimeout(500);
        await page.keyboard.up("Space");
        // Under the first charge threshold: these are individual aimed shots.
        for (let i = 0; i < 6; i++) {
          await page.waitForTimeout(280);
          await page.keyboard.press("Space");
        }
        await page.keyboard.down("Space");
        await page.waitForTimeout(2300);
        await page.keyboard.up("Space");
        await page.waitForTimeout(2400);
        await page.keyboard.press("Space");
        await page.waitForTimeout(1100);
        await flushAv(page);
        const handle = page.video()!;
        await context.close();
        const video = await handle.path();
        const duration = Number((await command(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video])).trim());
        const result = await finishAv(av, dir, video, duration, {});
        await Deno.writeTextFile(`${dir}/result.json`, JSON.stringify({ errors, ...result }, null, 2));
        await command(["ffmpeg", "-y", "-i", `${dir}/reel.mp4`, "-vf", "fps=1/2,scale=426:240,tile=3x2", "-frames:v", "1", `${dir}/sheet.jpg`]);
        console.log(arm, mode, result.checks.map(c => `${c.status}: ${c.id}`).join(", "));
      }
    } finally { await server.close(); }
  }
} finally { await browser.close(); }
console.log(`Isolated build retained: ${temp}`);
