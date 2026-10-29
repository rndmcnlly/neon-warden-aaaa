/**
 * Master capture: deterministic frame stepping for trailer takes.
 *
 * The draft path (capture.ts) records a live page with Playwright's video
 * recorder: 1280x720 VP8 at 25 fps and under 1 Mbit/s, fine for animatics.
 * A master needs every 60 Hz frame at full quality, which a real-time
 * recorder cannot promise (if a frame is slow, the game slows or the
 * recorder drops it). So this path takes time away from the page:
 *
 * 1. Virtual clock (init script `pageVclock`): `performance.now`,
 *    `Date.now`, `requestAnimationFrame`, `setTimeout` and `setInterval`
 *    read a clock that only moves when the driver says so, and CSS or Web
 *    Animations are paused and advanced by hand. One step is one 60 Hz
 *    frame; in autoplay the sim runs one tick per frame (src/main.ts), so
 *    the game sees perfect pacing however long a frame takes to grab.
 * 2. Slaved audio clock: every AudioContext is really suspended between
 *    steps and resumed until `currentTime` reaches the virtual time, so
 *    audio is rendered in lockstep with the picture (to within the
 *    overshoot of one suspend, measured per step and reported). The game
 *    still sees `state === "running"`, and its own suspend/resume (pause)
 *    stops the audio clock while virtual time goes on.
 * 3. Sample-exact tap: an AudioWorklet copies the master mix (everything
 *    wired to the speakers) as float PCM with its sample frame number, so
 *    the WAV is placed by frames, not by wall-clock chunk times.
 * 4. Frames: CDP `Page.captureScreenshot` of the composited page (canvas,
 *    DOM HUD and captions together) after each step, piped as PNG into
 *    FFmpeg (x264 4:4:4, CRF 12, a visually lossless intermediate).
 *
 * `scale` renders at a larger device pixel ratio with identical CSS layout
 * (1.333 gives 2560x1440 from a 1920x1080 layout) and downsizes with
 * Lanczos, for a supersampled 1080p master.
 */

import type { BrowserContext, Page } from "npm:playwright@1.58.2";

export const FPS = 60;

// -- page side (serialized: keep self-contained)

function pageVclock(): void {
  const w = globalThis as unknown as Record<string, unknown>;
  const realNow = performance.now.bind(performance);
  const realSetTimeout = globalThis.setTimeout.bind(globalThis);
  const realDateNow = Date.now;
  const origin = realNow();
  const dateOffset = realDateNow() - origin;
  let vnow = origin;
  performance.now = () => vnow;
  Date.now = () => Math.floor(vnow + dateOffset);

  // rAF
  let rafs = new Map<number, FrameRequestCallback>();
  let rafId = 1;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafs.set(rafId, cb);
    return rafId++;
  };
  globalThis.cancelAnimationFrame = (id: number) => void rafs.delete(id);

  // timers
  type Timer = { at: number; cb: () => void; every?: number };
  const timers = new Map<number, Timer>();
  let timerId = 1;
  const add = (
    cb: TimerHandler,
    ms: number | undefined,
    args: unknown[],
    every: boolean,
  ) => {
    const fn = typeof cb === "function"
      ? () => (cb as (...a: unknown[]) => void)(...args)
      : () => (0, eval)(cb as string);
    const d = Math.max(0, Number(ms) || 0);
    timers.set(timerId, {
      at: vnow + d,
      cb: fn,
      every: every ? Math.max(1, d) : undefined,
    });
    return timerId++;
  };
  // deno-lint-ignore no-explicit-any
  (globalThis as any).setTimeout = (
    cb: TimerHandler,
    ms?: number,
    ...a: unknown[]
  ) => add(cb, ms, a, false);
  // deno-lint-ignore no-explicit-any
  (globalThis as any).setInterval = (
    cb: TimerHandler,
    ms?: number,
    ...a: unknown[]
  ) => add(cb, ms, a, true);
  // deno-lint-ignore no-explicit-any
  (globalThis as any).clearTimeout = (id?: number) =>
    void timers.delete(id ?? 0);
  // deno-lint-ignore no-explicit-any
  (globalThis as any).clearInterval = (id?: number) =>
    void timers.delete(id ?? 0);
  const runTimers = () => {
    for (let guard = 0; guard < 1000; guard++) {
      let next: [number, Timer] | undefined;
      for (const e of timers) {
        if (e[1].at <= vnow && (!next || e[1].at < next[1].at)) next = e;
      }
      if (!next) return;
      const [id, t] = next;
      if (t.every) t.at += t.every;
      else timers.delete(id);
      try {
        t.cb();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Audio: contexts are registered at construction; the game's own
  // suspend/resume set intent, the driver does the real suspending.
  type Slaved = {
    ctx: AudioContext;
    want: boolean;
    target: number;
    tap?: GainNode;
    over: number[];
    /** From audio time aFrom (s) on, virtual ms = a * 1000 + offMs. */
    segs: { aFrom: number; offMs: number }[];
    running: boolean;
  };
  const slaved: Slaved[] = [];
  const RealAC = globalThis.AudioContext;
  const realResume = RealAC.prototype.resume;
  const realSuspend = RealAC.prototype.suspend;
  const connect = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
  const send = w.__nwMasterAudio as (m: unknown) => Promise<void>;
  const inflight = new Set<Promise<void>>();
  const tapSrc = `
    class NwTap extends AudioWorkletProcessor {
      constructor() {
        super(); this.buf = []; this.n = 0; this.start = -1;
        this.port.onmessage = () => this.flush();
      }
      process(inputs) {
        const ch = inputs[0];
        const f = 128;
        const l = ch[0] ?? new Float32Array(f), r = ch[1] ?? l;
        if (this.start < 0) this.start = currentFrame;
        const out = new Float32Array(f * 2);
        for (let i = 0; i < f; i++) { out[2 * i] = l[i]; out[2 * i + 1] = r[i]; }
        this.buf.push(out); this.n += f;
        if (this.n >= 4096) this.flush();
        return true;
      }
      flush() {
        if (!this.n) return;
        const all = new Float32Array(this.n * 2);
        let o = 0;
        for (const b of this.buf) { all.set(b, o); o += b.length; }
        this.port.postMessage({ frame: this.start, pcm: all }, [all.buffer]);
        this.buf = []; this.n = 0; this.start = -1;
      }
    }
    registerProcessor("nw-tap", NwTap);`;
  const toB64 = (u8: Uint8Array) => {
    let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) {
      bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };
  let ctxCount = 0;
  class SlavedAudioContext extends RealAC {
    constructor(...a: ConstructorParameters<typeof AudioContext>) {
      super(...a);
      const s: Slaved = {
        ctx: this,
        want: true,
        target: 0,
        over: [],
        segs: [],
        running: false,
      };
      slaved.push(s);
      const id = ctxCount++;
      void realSuspend.call(this);
      const tap = this.createGain();
      s.tap = tap;
      const url = URL.createObjectURL(
        new Blob([tapSrc], { type: "text/javascript" }),
      );
      this.audioWorklet.addModule(url).then(() => {
        const node = new AudioWorkletNode(this, "nw-tap", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelCount: 2,
          channelCountMode: "explicit",
        });
        node.port.onmessage = (e) => {
          const { frame, pcm } = e.data as { frame: number; pcm: Float32Array };
          const p = send({
            k: "pcm",
            ctx: id,
            rate: this.sampleRate,
            frame,
            b64: toB64(new Uint8Array(pcm.buffer)),
          }).catch(() => {});
          inflight.add(p);
          p.finally(() => inflight.delete(p));
        };
        (s as Slaved & { node?: AudioWorkletNode }).node = node;
        const mute = this.createGain();
        mute.gain.value = 0;
        connect.call(tap, node);
        connect.call(node, mute);
        connect.call(mute, this.destination);
      });
    }
    override get state(): AudioContextState {
      const s = slaved.find((x) => x.ctx === this);
      const real = super.state;
      if (real === "closed" || !s) return real;
      return s.want ? "running" : "suspended";
    }
    override resume(): Promise<void> {
      const s = slaved.find((x) => x.ctx === this);
      if (s) s.want = true;
      return Promise.resolve();
    }
    override suspend(): Promise<void> {
      const s = slaved.find((x) => x.ctx === this);
      if (s) s.want = false;
      return Promise.resolve();
    }
  }
  globalThis.AudioContext = SlavedAudioContext as typeof AudioContext;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).webkitAudioContext = SlavedAudioContext;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = connect.apply(this, args);
    if (args[0] instanceof AudioDestinationNode) {
      const s = slaved.find((x) => x.ctx === this.context);
      if (s?.tap && this !== s.tap) connect.call(this, s.tap);
    }
    return result;
  } as typeof AudioNode.prototype.connect;

  const sleep = (ms: number) => new Promise((r) => realSetTimeout(r, ms));
  /**
   * Render audio up to each context's target, then stop its clock. All
   * contexts run together, so a second context (a marker, a cutscene) does
   * not double the wait.
   */
  const advanceOne = async (s: Slaved, dtS: number) => {
    if (s.ctx.state === "closed" as AudioContextState) return;
    if (!s.want) {
      s.running = false;
      return;
    }
    if (!s.running) {
      // The audio clock (re)starts here: this step renders [target,
      // target + dt), shown from the frame after vnow.
      s.segs.push({ aFrom: s.target, offMs: vnow - s.target * 1000 });
      s.running = true;
    }
    s.target += dtS;
    const t0 = realNow();
    if (s.ctx.currentTime < s.target) {
      await realResume.call(s.ctx);
      while (s.ctx.currentTime < s.target && realNow() - t0 < 500) {
        const left = (s.target - s.ctx.currentTime) * 1000;
        await sleep(left > 6 ? left - 4 : 0);
      }
      await realSuspend.call(s.ctx);
    }
    s.over.push(s.ctx.currentTime - s.target);
  };
  const advanceAudio = (dtS: number) =>
    Promise.all(slaved.map((s) => advanceOne(s, dtS)));

  // Web Animations and CSS: paused, advanced by the step.
  const anims = new WeakSet<Animation>();
  const advanceAnimations = (dt: number) => {
    for (const a of document.getAnimations()) {
      if (!anims.has(a)) {
        anims.add(a);
        a.pause();
        continue;
      }
      if (a.playState === "finished") continue;
      a.currentTime = Number(a.currentTime ?? 0) + dt;
    }
  };

  let frames = 0;
  w.__nwMaster = {
    /** One frame: audio to time, clock, timers, animations, rAF. */
    async step(dtMs: number) {
      await advanceAudio(dtMs / 1000);
      vnow += dtMs;
      runTimers();
      if (document.documentElement) advanceAnimations(dtMs);
      const due = rafs;
      rafs = new Map();
      for (const cb of due.values()) {
        try {
          cb(vnow);
        } catch (err) {
          console.error(err);
        }
      }
      frames++;
    },
    now: () => vnow,
    origin,
    frames: () => frames,
    stats() {
      return slaved.map((s) => ({
        want: s.want,
        target: s.target,
        currentTime: s.ctx.currentTime,
        rate: s.ctx.sampleRate,
        over: s.over.splice(0),
        segs: s.segs,
      }));
    },
    async flush() {
      for (const s of slaved) {
        const n = (s as Slaved & { node?: AudioWorkletNode }).node;
        if (!n) continue;
        // Render one more quantum so the worklet's tail is posted.
        n.port.postMessage("flush");
      }
      await sleep(50);
      for (let i = 0; i < 20 && inflight.size; i++) {
        await Promise.all([...inflight]);
      }
    },
  };
}

// -- Deno side

export interface MasterAudio {
  rate: number;
  /** Per context: chunks of interleaved stereo float PCM by sample frame. */
  chunks: Map<number, { frame: number; pcm: Float32Array }[]>;
}

/** Call before the first page; register before other init scripts. */
export async function installMaster(
  context: BrowserContext,
): Promise<MasterAudio> {
  const audio: MasterAudio = { rate: 48000, chunks: new Map() };
  await context.exposeFunction(
    "__nwMasterAudio",
    (
      m: { k: string; ctx: number; rate: number; frame: number; b64: string },
    ) => {
      audio.rate = m.rate;
      const pcm = new Float32Array(fromB64(m.b64).buffer);
      const list = audio.chunks.get(m.ctx) ?? [];
      list.push({ frame: m.frame, pcm });
      audio.chunks.set(m.ctx, list);
    },
  );
  await context.addInitScript(pageVclock);
  return audio;
}

export interface StepLog {
  /** Per frame: audio overshoot after the step, seconds (first context). */
  overshoot: number[];
  /** Per frame: wall ms spent stepping and grabbing. */
  stepMs: number[];
  grabMs: number[];
}

export interface Grabber {
  page: Page;
  /** Steps n frames, grabbing each. */
  frames(n: number): Promise<void>;
  /** Steps until probe true, checking every `every` frames, up to maxFrames. */
  until(test: () => Promise<boolean>, maxFrames: number): Promise<boolean>;
  /** Frames grabbed so far (the video clock: frame / FPS seconds). */
  count(): number;
  /** Virtual ms of the first grabbed frame (page clock), for timelines. */
  startVnow(): number;
  close(): Promise<{
    frames: number;
    log: StepLog;
    segs: { aFrom: number; offMs: number }[][];
  }>;
}

export interface GrabOptions {
  /** Output size (the CSS viewport). */
  width: number;
  height: number;
  /** Grab at this multiple of the viewport, then Lanczos down (1.333: 1440p). */
  scale?: number;
  /** png: lossless, about 90 ms a 1080p frame; jpeg: quality 100, 4:2:0, about 40 ms. */
  format?: "png" | "jpeg";
  /** x264 CRF of the 4:4:4 intermediate. */
  crf?: number;
}

const fromB64 = (s: string): Uint8Array =>
  (Uint8Array as unknown as { fromBase64: (s: string) => Uint8Array })
    .fromBase64(s);

/**
 * Starts the stepping grabber on `page`: every grabbed frame is one PNG on
 * FFmpeg's stdin. `out` is the intermediate video (no audio).
 */
export async function startGrabber(
  page: Page,
  out: string,
  opt: GrabOptions,
): Promise<Grabber> {
  const cdp = await page.context().newCDPSession(page);
  const scale = opt.scale ?? 1;
  const format = opt.format ?? "png";
  const vf = scale !== 1
    ? ["-vf", `scale=${opt.width}:${opt.height}:flags=lanczos`]
    : [];
  const ff = new Deno.Command("ffmpeg", {
    args: [
      "-hide_banner",
      "-v",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-c:v",
      format === "png" ? "png" : "mjpeg",
      "-i",
      "-",
      ...vf,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      String(opt.crf ?? 14),
      "-pix_fmt",
      "yuv444p",
      "-g",
      String(FPS),
      "-r",
      String(FPS),
      out,
    ],
    stdin: "piped",
    stdout: "null",
    stderr: "piped",
  }).spawn();
  const writer = ff.stdin.getWriter();
  const log: StepLog = { overshoot: [], stepMs: [], grabMs: [] };
  let n = 0;
  let start = NaN;
  let pending: Promise<void> = Promise.resolve();
  const dt = 1000 / FPS;
  const one = async () => {
    const t0 = performance.now();
    await page.evaluate(
      (d) =>
        (globalThis as unknown as {
          __nwMaster: { step: (d: number) => Promise<void> };
        }).__nwMaster.step(d),
      dt,
    );
    if (Number.isNaN(start)) {
      start = await page.evaluate(() =>
        (globalThis as unknown as { __nwMaster: { now: () => number } })
          .__nwMaster.now()
      );
    }
    const t1 = performance.now();
    const shot = await cdp.send("Page.captureScreenshot", {
      format,
      ...(format === "png" ? { optimizeForSpeed: true } : { quality: 100 }),
      ...(scale !== 1
        ? {
          clip: {
            x: 0,
            y: 0,
            width: opt.width,
            height: opt.height,
            scale,
          },
        }
        : {}),
    } as never) as { data: string };
    const bytes = fromB64(shot.data);
    // Encode while the next frame steps; keep order with one pending write.
    await pending;
    pending = writer.write(bytes);
    log.stepMs.push(t1 - t0);
    log.grabMs.push(performance.now() - t1);
    n++;
    if (n % 60 === 0) {
      const st = await page.evaluate(() =>
        (globalThis as unknown as {
          __nwMaster: { stats: () => { over: number[] }[] };
        }).__nwMaster.stats()
      );
      log.overshoot.push(...(st[0]?.over ?? []));
    }
  };
  return {
    page,
    async frames(k: number) {
      for (let i = 0; i < k; i++) await one();
    },
    async until(test, maxFrames) {
      for (let i = 0; i < maxFrames; i += 15) {
        if (await test()) return true;
        for (let j = 0; j < 15; j++) await one();
      }
      return await test();
    },
    count: () => n,
    startVnow: () => start,
    async close() {
      const st = await page.evaluate(() =>
        (globalThis as unknown as {
          __nwMaster: {
            stats: () => {
              over: number[];
              segs: { aFrom: number; offMs: number }[];
            }[];
          };
        }).__nwMaster.stats()
      ).catch(() => []);
      log.overshoot.push(...(st[0]?.over ?? []));
      await pending;
      await writer.close();
      const r = await ff.output();
      if (!r.success) {
        throw new Error(
          `master encode: ${new TextDecoder().decode(r.stderr).slice(-600)}`,
        );
      }
      await cdp.detach().catch(() => {});
      return { frames: n, log, segs: st.map((x) => x.segs) };
    },
  };
}

/** Flushes the page's worklet taps (call before closing the page). */
export async function flushMaster(page: Page): Promise<void> {
  await page.evaluate(() =>
    (globalThis as unknown as { __nwMaster?: { flush: () => Promise<void> } })
      .__nwMaster?.flush()
  ).catch(() => {});
}

/**
 * Writes the mix as a 48 kHz stereo float WAV exactly `seconds` long, on
 * the video clock. Each context's audio time maps to virtual time through
 * its run segments (the clock stops while the game pauses audio), and
 * video time is virtual time since the first grabbed frame. Contexts are
 * summed; gaps are silence.
 */
export async function writeMasterWav(
  audio: MasterAudio,
  path: string,
  seconds: number,
  startVnow: number,
  segsByCtx: { aFrom: number; offMs: number }[][],
): Promise<{ samples: number; contexts: number }> {
  const rate = audio.rate;
  const len = Math.round(seconds * rate);
  const out = new Float32Array(len * 2);
  for (const [ctx, list] of audio.chunks) {
    const segs = segsByCtx[ctx] ?? [];
    if (!segs.length) continue;
    for (const c of list) {
      const n = c.pcm.length / 2;
      for (let i = 0; i < n; i++) {
        const a = (c.frame + i) / rate;
        let seg = segs[0];
        for (const x of segs) if (x.aFrom <= a + 1e-9) seg = x;
        const t = (a * 1000 + seg.offMs - startVnow) / 1000;
        const j = Math.round(t * rate);
        if (j < 0 || j >= len) continue;
        out[2 * j] += c.pcm[2 * i];
        out[2 * j + 1] += c.pcm[2 * i + 1];
      }
    }
  }
  // RIFF float32 stereo
  const data = new Uint8Array(out.buffer);
  const h = new DataView(new ArrayBuffer(44));
  const s = (o: number, t: string) =>
    [...t].forEach((ch, i) => h.setUint8(o + i, ch.charCodeAt(0)));
  s(0, "RIFF");
  h.setUint32(4, 36 + data.length, true);
  s(8, "WAVE");
  s(12, "fmt ");
  h.setUint32(16, 16, true);
  h.setUint16(20, 3, true);
  h.setUint16(22, 2, true);
  h.setUint32(24, rate, true);
  h.setUint32(28, rate * 8, true);
  h.setUint16(32, 8, true);
  h.setUint16(34, 32, true);
  s(36, "data");
  h.setUint32(40, data.length, true);
  const f = await Deno.open(path, {
    write: true,
    create: true,
    truncate: true,
  });
  await f.write(new Uint8Array(h.buffer));
  let o = 0;
  while (o < data.length) o += await f.write(data.subarray(o, o + (1 << 20)));
  f.close();
  return { samples: len, contexts: audio.chunks.size };
}
