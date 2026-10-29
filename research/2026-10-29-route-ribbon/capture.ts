/** Foreground evidence capture, deliberately silent. Reuses canonical QA
 * Chromium launch flags, not its game-only scene/reel automation.
 * deno run -A research/2026-10-29-route-ribbon/capture.ts
 */
import { launch } from "../../qa/capture.ts";
import {
  buildRoute,
  distortion,
  dot,
  length,
  projectPerspective,
  sample,
  sub,
} from "../../src/presentation/routeRibbon/math.ts";

const out = new URL("./", import.meta.url).pathname;
const url = "http://127.0.0.1:5188/src/presentation/routeRibbon/index.html";
const route = buildRoute();
const metrics = [];
const perspectiveMetrics = [];
for (const curve of [0, 1]) {
  let min = Infinity, max = 0, anisotropy = 0;
  for (let progress = 12; progress <= route.length - 12; progress += 2) {
    for (const x of [0, 120, 240, 360, 480]) {
      for (const y of [0, 80, 320, 540, 640]) {
        const d = distortion(
          { route, progress, curve },
          { x, y },
          projectPerspective,
        );
        min = Math.min(min, d.min);
        max = Math.max(max, d.max);
        anisotropy = Math.max(anisotropy, d.anisotropy);
      }
    }
  }
  perspectiveMetrics.push({
    curve,
    min,
    max,
    anisotropy,
    distance: 32,
    tilt: 0.47,
    pixelEquivalentNotNativeViewport: true,
  });
}
for (const curve of [0, 1]) {
  let min = Infinity, max = -Infinity, anisotropy = 0, determinant = Infinity;
  let transitionMin = Infinity, transitionMax = -Infinity;
  for (let progress = 30; progress < route.length - 30; progress += 1) {
    for (let x = 0; x <= 480; x += 40) {
      for (let y = 0; y <= 640; y += 40) {
        const d = distortion({ route, progress, curve }, { x, y });
        min = Math.min(min, d.min);
        max = Math.max(max, d.max);
        anisotropy = Math.max(anisotropy, d.anisotropy);
        determinant = Math.min(determinant, d.determinant);
      }
    }
    for (const x of [-120, 0, 240, 480, 600]) {
      for (let y = -880; y <= 1520; y += 40) {
        const d = distortion({ route, progress, curve }, { x, y });
        transitionMin = Math.min(transitionMin, d.min);
        transitionMax = Math.max(transitionMax, d.max);
      }
    }
  }
  metrics.push({
    curve,
    min,
    max,
    anisotropy,
    determinant,
    transitionMin,
    transitionMax,
  });
}
let maxCurvature = 0, minimumAdjacentUp = 1;
for (let s = 1; s < route.length - 1; s += 0.1) {
  const a = sample(route, s - 0.05), b = sample(route, s + 0.05);
  maxCurvature = Math.max(
    maxCurvature,
    length(sub(a.forward, b.forward)) / 0.1,
  );
  minimumAdjacentUp = Math.min(minimumAdjacentUp, dot(a.up, b.up));
}
const revision = new TextDecoder().decode(
  (await new Deno.Command("git", {
    args: ["rev-parse", "HEAD"],
    stdout: "piped",
  }).output()).stdout,
).trim();
const hashes: Record<string, string> = {};
for (
  const path of [
    "src/presentation/routeRibbon/math.ts",
    "src/presentation/routeRibbon/harness.ts",
    "src/presentation/routeRibbon/index.html",
    "public/models/pilot_ship.glb",
    "public/models/drone.glb",
    "public/models/lancer.glb",
    "public/models/pickup_shield.glb",
  ]
) {
  const hash = await crypto.subtle.digest("SHA-256", await Deno.readFile(path));
  hashes[path] = [...new Uint8Array(hash)].map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
// Two explicitly exaggerated orthographic diagrams, not screenshot evidence.
const poly = (axis: 0 | 1, origin: number, scale: number) =>
  route.frames.map((f) =>
    `${30 - f.center[2] * 2.2},${origin - f.center[axis] * scale}`
  ).join(" ");
await Deno.writeTextFile(
  out + "mapping.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="310" viewBox="0 0 620 310"><rect width="620" height="310" fill="#081420"/><g font-family="system-ui" font-size="13" fill="#dbeafa"><text x="20" y="23">Authored route, not spline physics</text><text x="20" y="49">Plan: transverse X exaggerated 6× relative to route distance</text><text x="20" y="179">Elevation: height exaggerated 4× relative to route distance</text><text x="30" y="293">0             industrial bend          rising gate           flat boss arena → progress s</text></g><polyline points="${
    poly(0, 145, 13.2)
  }" fill="none" stroke="#44e1e8" stroke-width="3"/><polyline points="${
    poly(1, 270, 8.8)
  }" fill="none" stroke="#edb95a" stroke-width="3"/></svg>`,
);
const captures = [];
const browser = await launch();
try {
  for (
    const spec of [
      {
        id: "desktop-comparison",
        width: 1280,
        height: 900,
        panel: "both",
        reduced: false,
        camera: "ortho",
      },
      {
        id: "portrait-flat",
        width: 390,
        height: 844,
        panel: "flat",
        reduced: false,
        camera: "ortho",
      },
      {
        id: "portrait-ribbon",
        width: 390,
        height: 844,
        panel: "ribbon",
        reduced: false,
        camera: "ortho",
      },
      {
        id: "reduced-static",
        width: 1280,
        height: 900,
        panel: "both",
        reduced: true,
        camera: "ortho",
      },
      {
        id: "perspective-warning",
        width: 1280,
        height: 900,
        panel: "both",
        reduced: false,
        camera: "perspective",
      },
    ]
  ) {
    const dir = out + spec.id;
    await Deno.mkdir(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      recordVideo: { dir, size: { width: spec.width, height: spec.height } },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(url);
    await page.waitForFunction(() =>
      (globalThis as unknown as { routeHarness?: { models: number[] } })
        .routeHarness?.models.every((n) => n === 4)
    );
    await page.selectOption("#panel", spec.panel);
    await page.selectOption("#camera", spec.camera);
    await page.locator("#reduced").setChecked(spec.reduced);
    // Start deterministic presentation survey after model loading; combat is frozen.
    await page.locator("#pause").click();
    const before = await page.evaluate(() =>
      (globalThis as unknown as { routeHarness: unknown }).routeHarness
    );
    await page.evaluate(async (reduced) => {
      const slider = document.getElementById("progress") as HTMLInputElement;
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const next = (now: number) => {
          slider.value = String(
            reduced ? 40 : 12 +
              Math.min(1, (now - start) / 12000) * (Number(slider.max) - 12),
          );
          slider.dispatchEvent(new Event("input"));
          if (now - start < 12000) requestAnimationFrame(next);
          else resolve();
        };
        requestAnimationFrame(next);
      });
    }, spec.reduced);
    const after = await page.evaluate(() =>
      (globalThis as unknown as { routeHarness: unknown }).routeHarness
    );
    await page.screenshot({ path: dir + "/frame.png" });
    await page.locator("#progress").fill("120");
    await page.locator("#progress").dispatchEvent("input");
    await page.waitForTimeout(80);
    await page.screenshot({ path: dir + "/rising-gate.png" });
    const video = page.video()!;
    await context.close();
    const raw = await video.path();
    const ffmpeg = await new Deno.Command("ffmpeg", {
      args: [
        "-y",
        "-i",
        raw,
        "-t",
        "15",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "27",
        dir + "/reel.mp4",
      ],
      stdout: "null",
      stderr: "piped",
    }).output();
    if (!ffmpeg.success) {
      throw new Error(new TextDecoder().decode(ffmpeg.stderr));
    }
    await Deno.remove(raw);
    const probe = await new Deno.Command("ffprobe", {
      args: [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        dir + "/reel.mp4",
      ],
      stdout: "piped",
    }).output();
    const media = JSON.parse(new TextDecoder().decode(probe.stdout));
    captures.push({
      ...spec,
      before,
      after,
      errors,
      silent: true,
      seconds: Number(media.format.duration),
      audioStreams: media.streams.filter((s: { codec_type: string }) =>
        s.codec_type === "audio"
      ).length,
    });
  }
} finally {
  await browser.close();
}
const report = {
  capturedAt: new Date().toISOString(),
  baseRevision: revision,
  hashes,
  dirtyOwnedPrototype: true,
  frozenTick: 420,
  routeLength: route.length,
  lutFrames: route.frames.length,
  joins: route.joins,
  maxCurvature,
  lateralMarginAt9Wu: 1 - 9 * maxCurvature,
  minimumAdjacentUp,
  metrics,
  perspectiveMetrics,
  captures,
  limits: [
    "Orthographic guarantee; perspective diagnostic has separate weaker bounds",
    "No live gameplay or collision fairness test",
    "Mac Metal Chromium, not Chromebook performance",
    "Silent, no audio stream by design",
    "Snapshot revision has concurrent foreign dirty files",
  ],
};
await Deno.writeTextFile(
  out + "qa.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
