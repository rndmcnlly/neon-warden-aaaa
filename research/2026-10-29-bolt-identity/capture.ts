/**
 * Bolt identity: isolated before/after real-time A/V capture, reusing the
 * studio's AV tap. Before = render files at `BASELINE`; after = the same
 * files at `AFTER` (both frozen by git show, never the working tree). Both arms share the current public assets; nothing
 * here runs vo:sync or touches qa/.build or qa/reports.
 *
 *   deno run -A --no-lock research/2026-10-29-bolt-identity/capture.ts
 */
import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";
import type { Page } from "npm:playwright@1.58.2";

const root = Deno.cwd();
const BASELINE = "62dc815";
const AFTER = "8522158";
const RENDER_FILES = [
  "src/render/bullets.ts",
  "src/render/cameraRig.ts",
  "src/render/stage.ts",
  "src/render/post.ts",
  "src/render/shaders/finish.glsl.ts",
];
const out = `${root}/research/2026-10-29-bolt-identity/clips`;
const temp = await Deno.makeTempDir({
  dir: "/private$TMPDIR/opencode",
  prefix: "bolt-identity-",
});

async function command(args: string[], cwd = root): Promise<string> {
  const result = await new Deno.Command(args[0], {
    args: args.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout);
}

// Two source trees: before (baseline render files) and after (working tree).
for (const arm of ["before", "after"]) {
  const dir = `${temp}/${arm}-src`;
  await Deno.mkdir(dir);
  await command([
    "cp",
    "-R",
    "src",
    "index.html",
    "deno.json",
    "deno.lock",
    "vite.config.ts",
    dir,
  ]);
  await Deno.symlink(`${root}/public`, `${dir}/public`);
  await Deno.symlink(`${root}/node_modules`, `${dir}/node_modules`);
  const rev = arm === "before" ? BASELINE : AFTER;
  const files = arm === "before"
    ? RENDER_FILES
    : [...RENDER_FILES, "src/render/shotLooks.ts"];
  for (const file of files) {
    await Deno.writeTextFile(
      `${dir}/${file}`,
      await command(["git", "show", `${rev}:${file}`]),
    );
  }
  await command([
    "deno",
    "run",
    "-A",
    "npm:vite@8.3.1",
    "build",
    "--outDir",
    `${temp}/${arm}`,
    "--logLevel",
    "warn",
  ], dir);
}

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
async function press(page: Page, ms = 70) {
  await page.keyboard.down("Space");
  await wait(page, ms);
  await page.keyboard.up("Space");
}
/** Rest long enough for Writ level n (40 ticks a level) plus margin. */
const restFor = (n: number) => n * 667 + 350;

type Scenario = (page: Page) => Promise<void>;
const SCENARIOS: Record<string, Scenario> = {
  tap: async (page) => {
    for (let i = 0; i < 14; i++) {
      await press(page);
      await wait(page, 230);
    }
  },
  stream: async (page) => {
    await page.keyboard.down("Space");
    await wait(page, 4200);
    await page.keyboard.up("Space");
  },
  writ1: async (page) => {
    for (let i = 0; i < 3; i++) {
      await wait(page, restFor(1));
      await press(page);
    }
  },
  writ2: async (page) => {
    for (let i = 0; i < 2; i++) {
      await wait(page, restFor(2));
      await press(page);
    }
  },
  writ3: async (page) => {
    for (let i = 0; i < 2; i++) {
      await wait(page, restFor(3));
      await press(page);
    }
  },
  mixed: async (page) => {
    for (let i = 0; i < 5; i++) {
      await press(page);
      await wait(page, 230);
    }
    await page.keyboard.down("Space");
    await wait(page, 1500);
    await page.keyboard.up("Space");
    await wait(page, restFor(3));
    await press(page);
  },
};

interface Clip {
  arm: "before" | "after";
  scenario: string;
  mode: "high" | "still" | "low";
}
const clips: Clip[] = [];
for (const arm of ["before", "after"] as const) {
  for (const scenario of ["tap", "stream", "writ1", "writ2", "writ3"]) {
    clips.push({ arm, scenario, mode: "high" });
  }
}
clips.push({ arm: "after", scenario: "mixed", mode: "still" });
clips.push({ arm: "after", scenario: "mixed", mode: "low" });

const browser = await launch();
const summary: Record<string, unknown>[] = [];
try {
  for (const arm of ["before", "after"] as const) {
    const server = serve(`${temp}/${arm}`);
    try {
      for (const clip of clips.filter((c) => c.arm === arm)) {
        const id = `${arm}-${clip.scenario}-${clip.mode}`;
        const dir = `${out}/${id}`;
        await Deno.mkdir(dir, { recursive: true });
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          recordVideo: { dir, size: { width: 1280, height: 720 } },
        });
        await context.addInitScript(({ mode }) => {
          localStorage.setItem(
            "neon-warden.settings",
            JSON.stringify({
              version: 1,
              settings: {
                display: { preset: mode === "low" ? "low" : "high" },
                accessibility: {
                  shake: mode === "still" ? 0 : 1,
                  reduceMotion: mode === "still",
                  reducedFlashing: mode === "still",
                },
              },
            }),
          );
        }, { mode: clip.mode });
        const av = await installAv(context);
        const start = Date.now();
        const page = await context.newPage();
        av.videoEpoch = (start + Date.now()) / 2;
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(`${server.url}?skipto=sector1&seed=121&qa=1`);
        await wait(page, 1500);
        // Preamble: spend whatever charge built up during load, then rest
        // briefly under the first threshold so the clip starts clean.
        await page.keyboard.down("Space");
        await wait(page, 400);
        await page.keyboard.up("Space");
        await wait(page, 250);
        const markSec = (Date.now() - av.videoEpoch) / 1000;
        await SCENARIOS[clip.scenario](page);
        await wait(page, 900);
        await flushAv(page);
        const handle = page.video()!;
        await context.close();
        const video = await handle.path();
        const duration = Number(
          (await command([
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            video,
          ])).trim(),
        );
        const result = await finishAv(av, dir, video, duration, {});
        // The reviewable clip starts at the scenario mark, audio included.
        const from = Math.max(0, markSec - 0.3).toFixed(2);
        await command([
          "ffmpeg",
          "-y",
          "-loglevel",
          "error",
          "-ss",
          from,
          "-i",
          `${dir}/reel.mp4`,
          "-c:v",
          "libx264",
          "-crf",
          "20",
          "-c:a",
          "aac",
          `${dir}/clip.mp4`,
        ]);
        await command([
          "ffmpeg",
          "-y",
          "-loglevel",
          "error",
          "-i",
          `${dir}/clip.mp4`,
          "-vf",
          "fps=1,scale=426:240,tile=3x2",
          "-frames:v",
          "1",
          `${dir}/sheet.jpg`,
        ]);
        const audio = await command([
          "ffprobe",
          "-v",
          "error",
          "-select_streams",
          "a",
          "-show_entries",
          "stream=codec_name",
          "-of",
          "csv=p=0",
          `${dir}/clip.mp4`,
        ]);
        const row = {
          id,
          ...clip,
          markSec: Number(from),
          errors,
          audioStream: audio.trim(),
          checks: result.checks.map((c) => `${c.status}: ${c.id}`),
        };
        await Deno.writeTextFile(
          `${dir}/result.json`,
          JSON.stringify({ ...row, ...result }, null, 2),
        );
        summary.push(row);
        console.log(id, errors.length, "errors;", row.checks.join(", "));
      }
    } finally {
      await server.close();
    }
  }
} finally {
  await browser.close();
}
await Deno.writeTextFile(
  `${out}/summary.json`,
  JSON.stringify(
    {
      baseline: BASELINE,
      after: AFTER,
      note: "Other src files copied from the working tree, identical in both arms",
      viewport: "1280x720",
      url: "?skipto=sector1&seed=121&qa=1",
      clips: summary,
    },
    null,
    2,
  ),
);
console.log(`Isolated builds retained: ${temp}`);
