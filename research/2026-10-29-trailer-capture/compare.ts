/**
 * Capture bake-off: one 10 s gameplay window (sector 2, fight autopilot,
 * seed 121) through each candidate capture path, measured the same way.
 *
 *   deno run -A --no-lock research/2026-10-29-trailer-capture/compare.ts [a,b,c,d,e]
 *
 * A  Playwright recordVideo at 1920x1080, real time, qa/av.ts tap (the
 *    current trailer path at master size; take.mp4 as the pipeline uses it)
 * B  CDP screencast (JPEG q100, every frame), real time, qa/av.ts tap
 * C  trailer/master.ts: virtual-time stepping, PNG grab, slaved audio clock
 * D  as C, JPEG q100 grab (faster, 4:2:0)
 * E  as C, grabbed at 2560x1440 (same CSS layout) and Lanczos to 1080p
 *
 * A sync marker is injected in every path: every 2 s of page time a white
 * 40x40 square shows in the top-left corner for 100 ms and a 9.5 kHz beep
 * starts in the same frame. A/V offset = beep onset in the audio track
 * minus the first video frame showing the square (positive: audio late).
 * Outputs (gitignored, large) in trailer/.cache/compare/<id>/; the summary
 * is written to research/2026-10-29-trailer-capture/compare.json.
 */

import { launch, serve } from "../../qa/capture.ts";
import { finishAv, flushAv, installAv } from "../../qa/av.ts";
import {
  flushMaster,
  type GrabOptions,
  installMaster,
  startGrabber,
  writeMasterWav,
} from "../../trailer/master.ts";
import { CACHE } from "../../trailer/capture.ts";
import { ROOT } from "../../trailer/plan.ts";

Deno.env.set("QA_KEEP_AV", "1");
const QUERY = "?skipto=sector2&autoplay=fight&speed=1&seed=121&qa=1";
const LEAD = 2; // seconds of play before the measured window
const WINDOW = 10;
const W = 1920, H = 1080;
const OUT = `${CACHE}/compare`;
const which = (Deno.args[0] ?? "a,b,c,d,e").split(",");

/** The sync marker (page side, serialized). */
function marker() {
  const start = () => {
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;left:0;top:0;width:40px;height:40px;background:#fff;z-index:2147483647;display:none;pointer-events:none";
    document.body.appendChild(box);
    let ctx: AudioContext | null = null;
    let next = performance.now() + 1000;
    let hide = 0;
    const tick = (now: number) => {
      if (now >= next) {
        next += 2000;
        box.style.display = "block";
        hide = now + 100;
        ctx ??= new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 9500;
        g.gain.value = 0.5;
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.05);
      } else if (hide && now >= hide) {
        box.style.display = "none";
        hide = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (document.body) start();
  else addEventListener("DOMContentLoaded", start);
}

async function run(cmd: string, args: string[]): Promise<string> {
  const o = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" })
    .output();
  if (!o.success) {
    throw new Error(`${cmd}: ${new TextDecoder().decode(o.stderr).slice(-400)}`);
  }
  return new TextDecoder().decode(o.stdout) + new TextDecoder().decode(o.stderr);
}

// -- measurement

interface Metrics {
  approach: string;
  file: string;
  width: number;
  height: number;
  fps: number;
  /** Distinct (non-duplicate) frames per second in the window. */
  uniqueFps: number;
  /** Longest run of identical frames, in frames of the container rate. */
  maxDupRun: number;
  /** Video bitrate of the file, Mbit/s. */
  mbps: number;
  /** blurdetect mean over the window (lower is sharper). */
  blur: number;
  /** Per marker: audio onset minus flash frame, ms. */
  syncMs: number[];
  wallSeconds: number;
  /** Page rAF rate in real time (the game's tick rate in autoplay). */
  gameHz?: number;
  notes: string[];
}

async function probe(file: string) {
  const o = JSON.parse(
    await run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,bit_rate:format=duration,bit_rate",
      "-of",
      "json",
      file,
    ]),
  );
  const st = o.streams[0];
  const [n, d] = st.r_frame_rate.split("/").map(Number);
  return {
    width: st.width,
    height: st.height,
    fps: n / d,
    duration: Number(o.format.duration),
    bitrate: Number(st.bit_rate ?? o.format.bit_rate),
  };
}

/** Per-frame values from a video filter chain ending in metadata print. */
async function perFrame(
  file: string,
  vf: string,
  key: string,
  from: number,
  dur: number,
): Promise<number[]> {
  const tmp = await Deno.makeTempFile();
  await run("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(from),
    "-t",
    String(dur),
    "-i",
    file,
    "-vf",
    `${vf},metadata=print:key=${key}:file=${tmp}`,
    "-f",
    "null",
    "-",
  ]);
  const txt = await Deno.readTextFile(tmp);
  await Deno.remove(tmp);
  return [...txt.matchAll(new RegExp(`${key.replace(/\./g, "\\.")}=([\\d.]+)`, "g"))]
    .map((m) => Number(m[1]));
}

async function measure(
  approach: string,
  file: string,
  wav: string,
  from: number,
  wallSeconds: number,
  extra: Partial<Metrics> = {},
): Promise<Metrics> {
  const p = await probe(file);
  // Duplicates: mean absolute luma difference to the previous frame
  // (the marker corner excluded), under 0.02 of 255 counts as identical.
  const diffs = await perFrame(
    file,
    "crop=iw-80:ih-80:80:80,tblend=all_mode=difference,signalstats",
    "lavfi.signalstats.YAVG",
    from,
    WINDOW,
  );
  let unique = 0, run_ = 0, maxRun = 0;
  for (const d of diffs) {
    if (d > 0.02) {
      unique++;
      run_ = 0;
    } else maxRun = Math.max(maxRun, ++run_);
  }
  const blurs = await perFrame(
    file,
    "crop=iw-80:ih-80:80:80,blurdetect=block_width=32:block_height=32",
    "lavfi.blur",
    from,
    WINDOW,
  );
  // Flash frames: the corner's mean luma.
  const corner = await perFrame(
    file,
    "crop=32:32:4:4,signalstats",
    "lavfi.signalstats.YAVG",
    0,
    p.duration,
  );
  const flashes: number[] = [];
  for (let i = 0; i < corner.length; i++) {
    if (corner[i] > 180 && (i === 0 || corner[i - 1] <= 180)) {
      flashes.push(i / p.fps);
    }
  }
  // Beep onsets: 9.5 kHz band envelope in 1 ms windows.
  const raw = await new Deno.Command("ffmpeg", {
    args: [
      "-v",
      "error",
      "-i",
      wav,
      "-af",
      "bandpass=f=9500:width_type=h:w=300,bandpass=f=9500:width_type=h:w=300",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "f32le",
      "-",
    ],
    stdout: "piped",
  }).output();
  const pcm = new Float32Array(
    raw.stdout.buffer,
    raw.stdout.byteOffset,
    Math.floor(raw.stdout.byteLength / 4),
  );
  const env: number[] = [];
  for (let i = 0; i + 48 <= pcm.length; i += 48) {
    let s = 0;
    for (let j = 0; j < 48; j++) s += pcm[i + j] * pcm[i + j];
    env.push(Math.sqrt(s / 48));
  }
  const peak = Math.max(...env);
  const onsets: number[] = [];
  for (let i = 1; i < env.length; i++) {
    if (env[i] > peak * 0.3 && env[i - 1] <= peak * 0.3) {
      if (!onsets.length || i / 1000 - onsets.at(-1)! > 0.5) {
        onsets.push(i / 1000);
      }
    }
  }
  const syncMs: number[] = [];
  for (const f of flashes) {
    const o = onsets.reduce(
      (b, x) => (Math.abs(x - f) < Math.abs(b - f) ? x : b),
      Infinity,
    );
    if (Math.abs(o - f) < 0.5) syncMs.push(Math.round((o - f) * 1000));
  }
  return {
    approach,
    file: file.replace(ROOT, ""),
    width: p.width,
    height: p.height,
    fps: p.fps,
    uniqueFps: Math.round((unique / WINDOW) * 10) / 10,
    maxDupRun: maxRun,
    mbps: Math.round(p.bitrate / 1e5) / 10,
    blur: Math.round(
      (blurs.reduce((a, b) => a + b, 0) / Math.max(1, blurs.length)) * 100,
    ) / 100,
    syncMs,
    wallSeconds: Math.round(wallSeconds * 10) / 10,
    notes: [`${flashes.length} flashes, ${onsets.length} beeps`],
    ...extra,
  };
}

/** Real rAF rate over one second (the page's own clock). */
async function rafHz(page: import("npm:playwright@1.58.2").Page) {
  return await page.evaluate(() =>
    new Promise<number>((done) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 1000) requestAnimationFrame(f);
        else done((n * 1000) / (performance.now() - t0));
      };
      requestAnimationFrame(f);
    })
  );
}

// -- approaches

const server = serve(`${CACHE}/build/dist`);
const results: Metrics[] = [];

async function realtime(id: string, screencast: boolean) {
  const dir = `${OUT}/${id}`;
  await Deno.remove(dir, { recursive: true }).catch(() => {});
  await Deno.mkdir(`${dir}/raw`, { recursive: true });
  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    ...(screencast ? {} : { recordVideo: { dir: `${dir}/raw`, size: { width: W, height: H } } }),
  });
  await context.addInitScript(marker);
  const av = await installAv(context);
  const before = Date.now();
  const page = await context.newPage();
  av.videoEpoch = (before + Date.now()) / 2;
  const t0 = performance.now();
  const frames: { t: number; data: string }[] = [];
  let cdp;
  if (screencast) {
    cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", (f: {
      data: string;
      sessionId: number;
      metadata: { timestamp: number };
    }) => {
      frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
      cdp!.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(
        () => {},
      );
    });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 100,
      maxWidth: W,
      maxHeight: H,
      everyNthFrame: 1,
    });
  }
  await page.goto(server.url + QUERY);
  await page.waitForLoadState("networkidle").catch(() => {});
  const loadedEpoch = Date.now();
  const hz = await rafHz(page);
  await page.waitForTimeout((LEAD + WINDOW + 1) * 1000 - 1000);
  const hz2 = await rafHz(page);
  if (cdp) await cdp.send("Page.stopScreencast");
  await flushAv(page);
  const handle = page.video();
  await context.close();
  await browser.close();
  const wall = (performance.now() - t0) / 1000;
  let video: string;
  let seconds: number;
  if (screencast) {
    // Variable-rate frames on the wall clock, conformed to CFR 60.
    av.videoEpoch = frames[0].t;
    let list = "ffconcat version 1.0\n";
    for (const [i, f] of frames.entries()) {
      const name = `f${String(i).padStart(5, "0")}.jpg`;
      await Deno.writeFile(
        `${dir}/raw/${name}`,
        (Uint8Array as unknown as { fromBase64: (s: string) => Uint8Array })
          .fromBase64(f.data),
      );
      const next = frames[i + 1]?.t ?? f.t + 1000 / 60;
      list += `file ${name}\nduration ${((next - f.t) / 1000).toFixed(6)}\n`;
    }
    await Deno.writeTextFile(`${dir}/raw/list.txt`, list);
    video = `${dir}/video.mp4`;
    await run("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "concat",
      "-i",
      `${dir}/raw/list.txt`,
      "-fps_mode",
      "cfr",
      "-r",
      "60",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "14",
      "-pix_fmt",
      "yuv444p",
      video,
    ]);
    seconds = (frames.at(-1)!.t - frames[0].t) / 1000;
  } else {
    video = `${dir}/video.webm`;
    await Deno.rename((await handle!.path())!, video);
    seconds = (await probe(video)).duration;
  }
  await finishAv(av, dir, video, seconds, {});
  const wav = `${dir}/av/mix.wav`;
  let file = video;
  if (screencast) {
    file = `${dir}/take.mp4`;
    await run("ffmpeg", ["-v", "error", "-y", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", file]);
  } else {
    // What the trailer pipeline keeps from this path (qa/av.ts mux).
    file = `${dir}/reel.mp4`;
  }
  const from = (loadedEpoch - av.videoEpoch) / 1000 + LEAD;
  const m = await measure(id, file, wav, from, wall, {
    gameHz: Math.round(((hz + hz2) / 2) * 10) / 10,
  });
  if (screencast) {
    m.notes.push(
      `${frames.length} screencast frames in ${seconds.toFixed(1)} s (${
        (frames.length / seconds).toFixed(1)
      } fps delivered)`,
    );
  } else {
    const raw = await probe(video);
    m.notes.push(
      `raw recorder ${raw.width}x${raw.height} ${raw.fps} fps ${
        (raw.bitrate / 1e6).toFixed(2)
      } Mbit/s VP8 (before the qa/av.ts mux)`,
    );
  }
  m.notes.push(`rAF ${hz.toFixed(1)} Hz at start, ${hz2.toFixed(1)} Hz at end`);
  results.push(m);
  console.log(JSON.stringify(m));
}

async function stepped(id: string, grab: Omit<GrabOptions, "width" | "height">) {
  const dir = `${OUT}/${id}`;
  await Deno.remove(dir, { recursive: true }).catch(() => {});
  await Deno.mkdir(dir, { recursive: true });
  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: grab.scale ?? 1,
  });
  const audio = await installMaster(context);
  await context.addInitScript(marker);
  const page = await context.newPage();
  const t0 = performance.now();
  await page.goto(server.url + QUERY);
  await page.waitForLoadState("networkidle").catch(() => {});
  const g = await startGrabber(page, `${dir}/video.mp4`, {
    width: W,
    height: H,
    ...grab,
  });
  await g.frames((LEAD + WINDOW + 1) * 60);
  await flushMaster(page);
  const r = await g.close();
  await context.close();
  await browser.close();
  const wall = (performance.now() - t0) / 1000;
  const wav = `${dir}/mix.wav`;
  await writeMasterWav(audio, wav, r.frames / 60, g.startVnow(), r.segs);
  const file = `${dir}/take.mp4`;
  await run("ffmpeg", ["-v", "error", "-y", "-i", `${dir}/video.mp4`, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", file]);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const over = r.log.overshoot.map((x) => x * 1000);
  const m = await measure(id, file, wav, LEAD, wall, { gameHz: 60 });
  m.notes.push(
    `step ${avg(r.log.stepMs).toFixed(1)} ms + grab ${
      avg(r.log.grabMs).toFixed(1)
    } ms per frame; ${(wall / (r.frames / 60)).toFixed(1)}x real time`,
    `audio clock overshoot per step: mean ${avg(over).toFixed(1)} ms, max ${
      Math.max(...over).toFixed(1)
    } ms`,
  );
  results.push(m);
  console.log(JSON.stringify(m));
}

if (which.includes("a")) await realtime("a-recordvideo", false);
if (which.includes("b")) await realtime("b-screencast", true);
if (which.includes("c")) await stepped("c-stepped-png", { format: "png" });
if (which.includes("d")) await stepped("d-stepped-jpeg", { format: "jpeg" });
if (which.includes("e")) {
  await stepped("e-stepped-1440", { format: "png", scale: 4 / 3 });
}
await server.close();

const path = `${ROOT}research/2026-10-29-trailer-capture/compare.json`;
const prev = await Deno.readTextFile(path).then(JSON.parse).catch(() => ({}));
for (const m of results) prev[m.approach] = m;
await Deno.writeTextFile(`${path}.tmp`, JSON.stringify(prev, null, 1) + "\n");
await Deno.rename(`${path}.tmp`, path);
