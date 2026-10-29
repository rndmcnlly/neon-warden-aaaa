/**
 * Frozen before/after sector-world AV captures. Run from the repository root:
 *
 *   deno run -A --no-lock research/2026-10-29-sector-worlds-v2/capture.ts prepare
 *   deno run -A --no-lock research/2026-10-29-sector-worlds-v2/capture.ts capture [arm] [sector]
 *   deno run -A --no-lock research/2026-10-29-sector-worlds-v2/capture.ts stills
 *
 * `prepare` archives each committed revision into its own folder, overlays the
 * same three dirty selection files (Captain tutorial VO, cand1 gameplay music)
 * into both, records hashes, and builds with Vite directly (no vo:sync, which
 * would resync absent raw VO into the archive). Captures are real gameplay at
 * speed=1 (no-fire autopilot, seed 121), desktop 1366x768 and native portrait
 * 390x844, subtitles off so a judge cannot read the place from dialogue.
 */
import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";

const here = new URL("./", import.meta.url).pathname;
const repo = new URL("../../", import.meta.url).pathname;
// after2 re-captures only sector 5 after the blind judge's Last Approach miss.
const ARMS: Record<string, string> = {
  before: "c5fa3bf",
  after: "113ca27",
  after2: "8774627",
};
const OVERLAYS = [
  "music/picks.json",
  "public/music/manifest.json",
  "public/vo/variants/index.json",
];
const VIEWS = {
  desktop: { width: 1366, height: 768 },
  portrait: { width: 390, height: 844 },
} as const;
const SECONDS = 14;

async function run(cmd: string, args: string[], cwd = repo): Promise<string> {
  const out = await new Deno.Command(cmd, { args, cwd, stderr: "inherit" })
    .output();
  if (!out.success) throw new Error(`${cmd} ${args.join(" ")} failed`);
  return new TextDecoder().decode(out.stdout);
}

async function sha256(path: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await Deno.readFile(path));
  return Array.from(new Uint8Array(d), (n) => n.toString(16).padStart(2, "0"))
    .join("");
}

async function prepare(only?: string): Promise<void> {
  const provenance: Record<string, unknown> = {
    preparedAt: new Date().toISOString(),
    overlays: {} as Record<string, string>,
  };
  for (const f of OVERLAYS) {
    (provenance.overlays as Record<string, string>)[f] = await sha256(repo + f);
  }
  for (const [arm, rev] of Object.entries(ARMS)) {
    if (only && arm !== only) continue;
    const dir = `${here}${arm}`;
    await Deno.remove(dir, { recursive: true }).catch(() => {});
    await Deno.mkdir(dir, { recursive: true });
    await run("sh", ["-c", `git archive ${rev} | tar -x -C '${dir}'`]);
    for (const f of OVERLAYS) await Deno.copyFile(repo + f, `${dir}/${f}`);
    await Deno.symlink(`${repo}node_modules`, `${dir}/node_modules`);
    await run(
      "deno",
      ["run", "-A", "npm:vite@8.3.1", "build", "--outDir", "out/build"],
      dir,
    );
    provenance[arm] = {
      rev: (await run("git", ["rev-parse", rev])).trim(),
      worldFiles: Object.fromEntries(
        await Promise.all(
          ["src/world/environment.ts", "src/world/sectors.ts"].map(
            async (f) => [f, await sha256(`${dir}/${f}`)],
          ),
        ),
      ),
    };
  }
  await Deno.writeTextFile(
    `${here}provenance${only ? "-" + only : ""}.json`,
    JSON.stringify(provenance, null, 2),
  );
}

const settings = (low: boolean, reduced = false) =>
  JSON.stringify({
    version: 1,
    settings: {
      subtitles: { enabled: false },
      display: { preset: low ? "low" : "high" },
      accessibility: { reduceMotion: reduced },
    },
  });

async function capture(onlyArm?: string, onlySector?: number): Promise<void> {
  const browser = await launch();
  try {
    for (const arm of Object.keys(ARMS)) {
      if (onlyArm && arm !== onlyArm) continue;
      const server = serve(`${here}${arm}/out/build`);
      try {
        for (let sector = 1; sector <= 5; sector++) {
          if (onlySector && sector !== onlySector) continue;
          for (const [view, size] of Object.entries(VIEWS)) {
            const dir = `${here}out/${arm}-s${sector}-${view}`;
            await Deno.remove(dir, { recursive: true }).catch(() => {});
            await Deno.mkdir(dir, { recursive: true });
            const context = await browser.newContext({
              viewport: size,
              recordVideo: { dir: `${dir}/raw`, size },
            });
            await context.addInitScript((s) => {
              localStorage.setItem("neon-warden.settings", s);
              // Cap rAF so the recorder cannot run the autopilot uncapped.
              globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
                setTimeout(() => cb(performance.now()), 17) as unknown as number;
              globalThis.cancelAnimationFrame = (id: number) =>
                clearTimeout(id);
            }, settings(false));
            const av = await installAv(context);
            const page = await context.newPage();
            const errors: string[] = [];
            page.on("pageerror", (e) => errors.push(String(e)));
            av.videoEpoch = Date.now();
            await page.goto(
              `${server.url}?skipto=sector${sector}&autoplay=pacifist&speed=1&seed=121&qa=1&v.music.gameplay=cand1`,
              { waitUntil: "networkidle" },
            );
            const samples: unknown[] = [];
            for (let i = 0; i < SECONDS * 2; i++) {
              samples.push(
                await page.evaluate(() => {
                  // deno-lint-ignore no-explicit-any
                  const w = globalThis as any;
                  return {
                    t: performance.now(),
                    tick: w.__nwqa?.sim()?.tick,
                    world: w.__nwWorld?.stats(),
                  };
                }),
              );
              if (i === 12) {
                await page.screenshot({
                  path: `${dir}/mid.jpg`,
                  quality: 80,
                  type: "jpeg",
                });
              }
              await page.waitForTimeout(500);
            }
            await flushAv(page);
            const duration = (Date.now() - av.videoEpoch) / 1000;
            const video = page.video()!;
            await context.close();
            const result = await finishAv(
              av,
              dir,
              await video.path(),
              duration,
              {},
            );
            await Deno.remove(`${dir}/raw`, { recursive: true }).catch(
              () => {},
            );
            await Deno.writeTextFile(
              `${dir}/result.json`,
              JSON.stringify(
                { arm, sector, view, size, samples, errors, av: result },
                null,
                2,
              ),
            );
            console.log(
              arm,
              sector,
              view,
              errors.length,
              result.checks.map((c) => `${c.id}:${c.status}`).join(" "),
            );
          }
        }
      } finally {
        await server.close();
      }
    }
  } finally {
    await browser.close();
  }
}

/** Low-tier desktop and reduced-motion stills of the after arm, with stats. */
async function stills(): Promise<void> {
  const browser = await launch();
  const server = serve(`${here}after2/out/build`);
  const rows: unknown[] = [];
  try {
    for (const [mode, low, reduced] of [["low", true, false], ["reduced", false, true]] as const) {
      for (let sector = 1; sector <= 5; sector++) {
        const context = await browser.newContext({ viewport: VIEWS.desktop });
        await context.addInitScript(
          (s) => localStorage.setItem("neon-warden.settings", s),
          settings(low, reduced),
        );
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(
          `${server.url}?skipto=sector${sector}&autoplay=pacifist&speed=1&seed=121&qa=1`,
          { waitUntil: "networkidle" },
        );
        await page.waitForTimeout(5000);
        await Deno.mkdir(`${here}out/stills`, { recursive: true });
        await page.screenshot({
          path: `${here}out/stills/s${sector}-${mode}.jpg`,
          quality: 78,
          type: "jpeg",
        });
        const world = await page.evaluate(() =>
          // deno-lint-ignore no-explicit-any
          (globalThis as any).__nwWorld?.stats()
        );
        rows.push({ sector, mode, world: { ...world, render: undefined }, errors });
        await context.close();
      }
    }
  } finally {
    await server.close();
    await browser.close();
  }
  await Deno.writeTextFile(
    `${here}out/stills/stills.json`,
    JSON.stringify(rows, null, 2),
  );
}

const [step, arm, sector] = Deno.args;
if (step === "prepare") await prepare(arm);
else if (step === "capture") await capture(arm, sector ? Number(sector) : undefined);
else if (step === "stills") await stills();
else console.log("usage: capture.ts prepare | capture [arm] [sector] | stills");
