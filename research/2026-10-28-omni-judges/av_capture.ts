/**
 * Audio-visual reel capture sidecar (research prototype, not part of qa/).
 *
 * Playwright's recordVideo writes video only, so every qa/ reel is silent.
 * This script records the same page twice over: Playwright for pictures, and
 * an in-page MediaRecorder for sound. The init script patches
 * AudioNode.prototype.connect so that anything wired to an AudioContext's
 * destination is also wired to a MediaStreamAudioDestinationNode (a tap),
 * which MediaRecorder encodes to Opus. The two tracks are muxed with ffmpeg,
 * offset by the time between page creation and recorder start.
 *
 * Usage (from the repo root, after a qa run has built qa/.build/dist):
 *   deno run -A --no-lock research/2026-10-28-omni-judges/av_capture.ts \
 *     "?skipto=boss&seed=121&qa=1" 55 out/boss-av
 * Writes out/boss-av/{video.webm,audio.webm,reel.mp4,meta.json}.
 */

import { chromium } from "npm:playwright@1.58.2";
import { serve } from "../../qa/capture.ts";

const [query = "?skipto=boss&seed=121&qa=1", secondsArg = "45", outArg] =
  Deno.args;
const seconds = Number(secondsArg);
const out = outArg ?? "research/2026-10-28-omni-judges/out/reel-av";
await Deno.mkdir(`${out}/raw`, { recursive: true });

const server = serve("qa/.build/dist");
const browser = await chromium.launch({
  headless: true,
  args: [
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    "--use-angle=metal",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: `${out}/raw`, size: { width: 1280, height: 720 } },
});

await context.addInitScript(() => {
  const w = window as unknown as Record<string, unknown>;
  const chunks: Blob[] = [];
  const taps = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();
  w.__avChunks = chunks;
  w.__avStart = null;
  // Diagnostics: how many sounds actually started, and how many fetches.
  w.__avStarts = 0;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a: Parameters<typeof start>) {
    (w.__avStarts as number)++;
    return start.apply(this, a);
  };
  const connect = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = connect.apply(this, args);
    const target = args[0];
    if (target instanceof AudioDestinationNode && this.context instanceof AudioContext) {
      let tap = taps.get(this.context);
      if (!tap) {
        tap = this.context.createMediaStreamDestination();
        taps.set(this.context, tap);
        const rec = new MediaRecorder(tap.stream, { mimeType: "audio/webm;codecs=opus" });
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.start(250);
        w.__avStart = performance.now();
        w.__avRecorder = rec;
        w.__avCtx = this.context;
      }
      connect.call(this, tap);
    }
    return result;
  } as typeof AudioNode.prototype.connect;
});

const page = await context.newPage();
const consoleLog: string[] = [];
page.on("console", (m) => {
  if (m.type() !== "log" && consoleLog.length < 40) consoleLog.push(`${m.type()}: ${m.text().slice(0, 200)}`);
});
const requests: string[] = [];
page.on("request", (r) => {
  if (/\.(wav|ogg|mp3|m4a|opus)$/.test(r.url()) && requests.length < 60) requests.push(r.url().replace(server.url, "/"));
});
const pageCreated = Date.now();
await page.goto(server.url + query);
const navigated = Date.now();
// The game keeps its AudioContext suspended until a first press (a browser
// autoplay courtesy). A press would also count as input, so resume directly.
await page.waitForFunction(() => (window as unknown as { __avCtx?: unknown }).__avCtx, null, { timeout: 15_000 }).catch(() => {});
const ctxState = await page.evaluate(async () => {
  const ctx = (window as unknown as { __avCtx?: AudioContext }).__avCtx;
  if (!ctx) return "none";
  const before = ctx.state;
  await ctx.resume();
  return `${before} -> ${ctx.state}`;
});
await page.waitForTimeout(seconds * 1000);

const audio = await page.evaluate(async () => {
  const w = window as unknown as Record<string, unknown>;
  const rec = w.__avRecorder as MediaRecorder | undefined;
  if (!rec) return null;
  await new Promise<void>((done) => {
    rec.onstop = () => done();
    rec.stop();
  });
  const blob = new Blob(w.__avChunks as Blob[], { type: "audio/webm" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { starts: w.__avStarts as number, b64: btoa(bin), startEpochMs: performance.timeOrigin + (w.__avStart as number) };
});

const video = page.video();
await context.close();
await browser.close();
await server.close();

const rawVideo = video ? await video.path() : null;
if (!rawVideo) throw new Error("no video recorded");
await Deno.rename(rawVideo, `${out}/video.webm`);
await Deno.remove(`${out}/raw`, { recursive: true });

// Video frames count from page creation; the recorder starts when the game
// first wires a node to the speakers. Both are compared on the epoch clock.
const offsetS = audio ? Math.max(0, audio.startEpochMs - pageCreated) / 1000 : 0;
const meta = { query, seconds, offsetS, ctxState, hasAudio: !!audio, sourcesStarted: audio?.starts ?? 0, navLagMs: navigated - pageCreated, audioRequests: requests, console: consoleLog };
await Deno.writeTextFile(`${out}/meta.json`, JSON.stringify(meta, null, 2));

const args = ["-y", "-v", "error", "-i", `${out}/video.webm`];
if (audio) {
  await Deno.writeFile(`${out}/audio.webm`, Uint8Array.from(atob(audio.b64), (c) => c.charCodeAt(0)));
  args.push("-itsoffset", offsetS.toFixed(3), "-i", `${out}/audio.webm`, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "128k");
}
args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-r", "24", `${out}/reel.mp4`);
const r = await new Deno.Command("ffmpeg", { args }).output();
if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
console.log(JSON.stringify(meta));
