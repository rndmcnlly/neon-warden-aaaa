/**
 * Audio for reels. Playwright's `recordVideo` records pictures only, so this
 * module records the game's sound alongside it and checks it:
 *
 * 1. An init script (runs in every document before the game) patches
 *    `AudioNode.prototype.connect`: anything wired to the speakers is also
 *    wired to a `MediaStreamAudioDestinationNode`, the "mix tap", which an
 *    in-page `MediaRecorder` encodes to Opus. Every buffer source whose
 *    buffer came from `vo/` is also wired to a second tap, the "VO stem"
 *    (pre-fader), so silence detection on voice is not masked by music.
 *    The script also logs, on the epoch clock: sound starts (with the URL
 *    their buffer was fetched from), subtitle box changes, and the
 *    highlighted subtitle word.
 * 2. Chunks and logs stream out through an exposed function as they happen,
 *    so a `goto` step (a new document) loses at most a quarter second.
 * 3. After the reel, ffmpeg places each recorded segment at its offset from
 *    the first video frame, muxes `reel.mp4` (H.264 and stereo AAC), and the
 *    checks below run on PCM it decodes: VO-no-drop, loudness, stereo image,
 *    word-pulse timing.
 *
 * Headless Chromium may start the AudioContext suspended (the game waits for
 * a first key press, a browser courtesy). QA resumes it, so a skipto reel
 * sounds the way the game does right after the press-any-key gate.
 */

import type { BrowserContext } from "npm:playwright@1.58.2";
import { type Check, repo, type Status } from "./lib/common.ts";
import {
  audibleSpans,
  overlap,
  parseSilence,
  pearson,
  quantile,
  type Span,
  stereoBalance,
  wordAlignment,
} from "./lib/audio.ts";

/** Which optional AV analyses a reel asks for (all reels get the basics). */
export interface AvOptions {
  /** Stereo image must move (an enemy crossing); correlates with enemy x if the probe exposes it. */
  readonly spatial?: boolean;
  /** Highlighted subtitle words must land within 80 ms of the cue's word timings. */
  readonly wordPulse?: boolean;
}

// -- page side

/** The engine's mix buses, each recorded post-fader and post-trim (pre-master). */
export const BUS_STEMS = ["music", "sfx", "voice", "ui"] as const;
export type BusStem = typeof BUS_STEMS[number];
type StemKind = "mix" | "vo" | "spatial" | BusStem;

type Msg =
  | { k: "seg"; seg: string; kind: StemKind; epoch: number }
  | { k: "chunk"; seg: string; n: number; b64: string }
  | {
    k: "src";
    epoch: number;
    dur: number;
    offset?: number;
    loop: boolean;
    url: string;
  }
  | {
    k: "sub";
    epoch: number;
    text: string;
    visible: boolean;
    layer: string;
    line: string;
  }
  | {
    k: "word";
    epoch: number;
    line: string;
    index: number;
    text: string;
    /** True when `index` came from `data-word` (absolute in the line). */
    exact: boolean;
  }
  | { k: "enemies"; epoch: number; xs: number[] }
  | { k: "ctx"; epoch: number; state: string };

/**
 * Where QA looks for the highlighted word: U's `.nw-word.is-spoken`
 * (src/app/subtitleView.ts). Its index in the line comes from
 * `data-word` when the view sets it (requested in qa/REQUESTS.md); without
 * it QA counts spans, which is only right for a line's first chunk.
 */
const WORD_SELECTOR =
  ".nw-subtitle-live .nw-word.is-spoken, .nw-subtitle-live [aria-current='true']";

/** Serialized into the page: keep it self-contained. */
function pageAv(wordSelector: string): void {
  const w = globalThis as unknown as Record<string, unknown>;
  const send = w.__nwqaAv as (m: unknown) => Promise<void>;
  if (typeof send !== "function") return;
  const now = () => performance.timeOrigin + performance.now();
  const inflight = new Set<Promise<void>>();
  const post = (m: unknown) => {
    const p = send(m).catch(() => {});
    inflight.add(p);
    p.finally(() => inflight.delete(p));
  };
  const toB64 = async (blob: Blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };

  // Tag decoded buffers with the URL they were fetched from.
  const abUrl = new WeakMap<ArrayBuffer, string>();
  const bufUrl = new WeakMap<AudioBuffer, string>();
  const arrayBuffer = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function (this: Response) {
    const ab = await arrayBuffer.call(this);
    abUrl.set(ab, new URL(this.url, location.href).pathname);
    return ab;
  };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (
    this: BaseAudioContext,
    ab: ArrayBuffer,
    ...rest: unknown[]
  ) {
    const url = abUrl.get(ab) ?? "";
    // deno-lint-ignore no-explicit-any
    const p = (decode as any).call(this, ab, ...rest) as Promise<AudioBuffer>;
    return p.then((buf) => {
      if (url) bufUrl.set(buf, url);
      return buf;
    });
  } as typeof decode;

  const recorders: MediaRecorder[] = [];
  const taps = new WeakMap<
    BaseAudioContext,
    {
      mix: MediaStreamAudioDestinationNode;
      vo: MediaStreamAudioDestinationNode;
      spatial: MediaStreamAudioDestinationNode;
    }
  >();
  const record = (node: MediaStreamAudioDestinationNode, kind: string) => {
    const seg = `${kind}-${Math.random().toString(36).slice(2)}`;
    const rec = new MediaRecorder(node.stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 128_000,
    });
    // Numbered, and tracked from the moment data arrives: encoding is async,
    // so chunks can finish out of order, and a flush must wait for all of them.
    let n = 0;
    rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      const i = n++;
      const p = toB64(e.data).then((b64) =>
        post({ k: "chunk", seg, n: i, b64 })
      );
      inflight.add(p);
      p.finally(() => inflight.delete(p));
    };
    rec.start(250);
    post({ k: "seg", seg, kind, epoch: now() });
    recorders.push(rec);
  };
  const tapsFor = (ctx: AudioContext) => {
    let t = taps.get(ctx);
    if (!t) {
      t = {
        mix: ctx.createMediaStreamDestination(),
        vo: ctx.createMediaStreamDestination(),
        spatial: ctx.createMediaStreamDestination(),
      };
      for (const n of [t.mix, t.vo, t.spatial]) n.channelCount = 2;
      taps.set(ctx, t);
      record(t.mix, "mix");
      record(t.vo, "vo");
      record(t.spatial, "spatial");
      const state = ctx.state;
      if (state !== "running") ctx.resume().catch(() => {});
      post({ k: "ctx", epoch: now(), state });
    }
    return t;
  };
  const connect = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
  // Bus stems: the engine hands each bus's last node here as it builds the
  // graph (src/audio/engine.ts, `__nwqaBusTap`); one recorder per bus.
  const busTaps = new WeakMap<
    BaseAudioContext,
    Map<string, MediaStreamAudioDestinationNode>
  >();
  w.__nwqaBusTap = (bus: string, node: AudioNode) => {
    const ctx = node.context;
    if (!(ctx instanceof AudioContext)) return;
    tapsFor(ctx);
    let m = busTaps.get(ctx);
    if (!m) busTaps.set(ctx, m = new Map());
    let tap = m.get(bus);
    if (!tap) {
      tap = ctx.createMediaStreamDestination();
      tap.channelCount = 2;
      m.set(bus, tap);
      record(tap, bus);
    }
    connect.call(node, tap);
  };
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = connect.apply(this, args);
    if (
      args[0] instanceof AudioDestinationNode &&
      this.context instanceof AudioContext
    ) {
      connect.call(this, tapsFor(this.context).mix);
    }
    // Post-pan stem: every panner's output, so centred music and voice do
    // not mask what the spatial check measures. The ship's own engine bed
    // (src/audio/engineBed.ts) is a continuous self-cue panned by screen
    // position, not a world sound; it marks its panner `nwSelf` and stays
    // out, or it would drown the enemies this stem is about.
    if (
      (this instanceof StereoPannerNode || this instanceof PannerNode) &&
      !(this as AudioNode & { nwSelf?: boolean }).nwSelf &&
      this.context instanceof AudioContext &&
      !(args[0] instanceof MediaStreamAudioDestinationNode)
    ) {
      connect.call(this, tapsFor(this.context).spatial);
    }
    return result;
  } as typeof AudioNode.prototype.connect;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (
    this: AudioBufferSourceNode,
    ...a: Parameters<typeof start>
  ) {
    const buf = this.buffer;
    const url = buf ? bufUrl.get(buf) ?? "" : "";
    if (url.includes("/vo/") && this.context instanceof AudioContext) {
      connect.call(this, tapsFor(this.context).vo);
    }
    post({
      k: "src",
      epoch: now(),
      dur: buf?.duration ?? 0,
      // VO starts past its measured lead-in (`voStartS`); record where.
      offset: typeof a[1] === "number" ? a[1] : 0,
      loop: this.loop,
      url,
    });
    return start.apply(this, a);
  };

  // Subtitles and the highlighted word, sampled on every DOM change.
  let lastSub = "";
  let lastWord = "";
  const scan = () => {
    const box = document.querySelector<HTMLElement>(".nw-subtitle-live");
    if (!box) return;
    const text = box.querySelector(".nw-subtitle-text")?.textContent?.trim() ??
      "";
    const visible = !box.hidden && box.offsetParent !== null && text !== "";
    const layer = box.dataset.layer ?? "";
    const line = box.dataset.line ?? "";
    const key = `${visible}|${text}|${layer}|${line}`;
    if (key !== lastSub) {
      lastSub = key;
      post({ k: "sub", epoch: now(), text, visible, layer, line });
    }
    const cur = visible
      ? document.querySelector<HTMLElement>(wordSelector)
      : null;
    if (cur) {
      const sibs = [...(cur.parentElement?.children ?? [])];
      const exact = cur.dataset.word !== undefined;
      const index = exact ? Number(cur.dataset.word) : sibs.indexOf(cur);
      const wkey = `${line}|${text}|${index}`;
      if (wkey !== lastWord) {
        lastWord = wkey;
        post({
          k: "word",
          epoch: now(),
          line,
          index,
          text: cur.textContent ?? "",
        });
      }
    }
  };
  const observe = () => {
    new MutationObserver(scan).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  };
  if (document.documentElement) observe();
  else addEventListener("DOMContentLoaded", observe);

  // Enemy positions for the spatial check, when the probe offers them.
  setInterval(() => {
    const p = w.__nwqa as { enemies?: () => { x: number }[] } | undefined;
    if (typeof p?.enemies !== "function") return;
    try {
      post({ k: "enemies", epoch: now(), xs: p.enemies().map((e) => e.x) });
    } catch { /* probe mid-update */ }
  }, 100);

  w.__nwqaAvFlush = async () => {
    await Promise.all(
      recorders.map((r) =>
        r.state === "inactive"
          ? Promise.resolve()
          : new Promise<void>((done) => {
            r.addEventListener("stop", () => setTimeout(done, 50), {
              once: true,
            });
            r.stop();
          })
      ),
    );
    for (let i = 0; i < 20 && inflight.size; i++) {
      await Promise.all([...inflight]);
    }
  };
}

// -- Deno side

export class AvLog {
  readonly segs = new Map<
    string,
    {
      kind: StemKind;
      epoch: number;
      chunks: [number, string][];
    }
  >();
  readonly sources: {
    epoch: number;
    dur: number;
    loop: boolean;
    url: string;
  }[] = [];
  readonly subs: {
    epoch: number;
    text: string;
    visible: boolean;
    layer: string;
    line: string;
  }[] = [];
  readonly words: {
    epoch: number;
    line: string;
    index: number;
    text: string;
    exact: boolean;
  }[] = [];
  readonly enemies: { epoch: number; xs: number[] }[] = [];
  readonly ctx: { epoch: number; state: string }[] = [];
  /** Epoch ms of the first video frame (set when the page is created). */
  videoEpoch = 0;

  take(m: Msg): void {
    switch (m.k) {
      case "seg":
        this.segs.set(m.seg, { kind: m.kind, epoch: m.epoch, chunks: [] });
        return;
      case "chunk":
        this.segs.get(m.seg)?.chunks.push([m.n, m.b64]);
        return;
      case "src":
        this.sources.push(m);
        return;
      case "sub":
        this.subs.push(m);
        return;
      case "word":
        this.words.push(m);
        return;
      case "enemies":
        if (this.enemies.length < 2000) this.enemies.push(m);
        return;
      case "ctx":
        this.ctx.push(m);
        return;
    }
  }

  /** Epoch ms to reel seconds. */
  t(epoch: number): number {
    return (epoch - this.videoEpoch) / 1000;
  }
}

/** Call before the first page: exposes the sink and installs the page script. */
export async function installAv(context: BrowserContext): Promise<AvLog> {
  const log = new AvLog();
  await context.exposeFunction("__nwqaAv", (m: Msg) => log.take(m));
  await context.addInitScript(pageAv, WORD_SELECTOR);
  return log;
}

/** Stops the page's recorders and waits for their last chunks. */
export async function flushAv(page: import("npm:playwright@1.58.2").Page) {
  await page.evaluate(() =>
    (globalThis as { __nwqaAvFlush?: () => Promise<void> }).__nwqaAvFlush?.()
  ).catch(() => {});
}

async function ff(args: string[]): Promise<{ ok: boolean; err: string }> {
  const r = await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-nostats", ...args],
    stdout: "null",
    stderr: "piped",
  }).output();
  return { ok: r.success, err: new TextDecoder().decode(r.stderr) };
}

/**
 * Writes `<dir>/<kind>.wav` (48 kHz stereo, the reel's length) from every
 * segment of that kind, each placed at its offset from the first frame.
 * Returns false when the game never produced that kind of sound.
 */
async function stem(
  log: AvLog,
  kind: StemKind,
  dir: string,
  seconds: number,
): Promise<boolean> {
  const segs = [...log.segs.values()].filter((s) =>
    s.kind === kind && s.chunks.length
  );
  const out = `${dir}/${kind}.wav`;
  const inputs: string[] = [];
  const filters: string[] = [];
  for (const [i, s] of segs.entries()) {
    const file = `${dir}/${kind}-${i}.webm`;
    const parts = [...s.chunks].sort((a, b) => a[0] - b[0]).map(([, b]) =>
      Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
    );
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) all.set(p, (o += p.length) - p.length);
    await Deno.writeFile(file, all);
    inputs.push("-i", file);
    const delayMs = Math.max(0, Math.round(log.t(s.epoch) * 1000));
    const decode = "aresample=async=1:first_pts=0";
    const fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
    filters.push(
      `[${i + 1}:a]${decode},${fmt},adelay=${delayMs}|${delayMs}[s${i}]`,
    );
  }
  // Input 0 is silence of the full length, so the stem always spans the reel.
  const mix = `[0:a]${segs.map((_, i) => `[s${i}]`).join("")}amix=inputs=${
    segs.length + 1
  }:normalize=0:duration=first[out]`;
  const r = await ff([
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-t",
    seconds.toFixed(2),
    "-i",
    "anullsrc=r=48000:cl=stereo",
    ...inputs,
    "-filter_complex",
    [...filters, mix].join(";"),
    "-map",
    "[out]",
    "-c:a",
    "pcm_s16le",
    out,
  ]);
  if (!r.ok) {
    throw new Error(`stem ${kind}: ${r.err.split("\n").slice(-4).join(" ")}`);
  }
  return segs.length > 0;
}

/** Video plus mix: H.264 and stereo AAC, the file reviewers and the judge get. */
async function mux(video: string, mixWav: string, out: string): Promise<void> {
  const r = await ff([
    "-y",
    "-v",
    "error",
    "-i",
    video,
    "-i",
    mixWav,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "25",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ]);
  if (!r.ok) throw new Error(`mux: ${r.err.split("\n").slice(-4).join(" ")}`);
}

async function silence(wav: string, seconds: number): Promise<Span[]> {
  const r = await ff([
    "-i",
    wav,
    "-af",
    "silencedetect=noise=-50dB:d=0.25",
    "-f",
    "null",
    "-",
  ]);
  return parseSilence(r.err, seconds);
}

async function loudness(
  wav: string,
): Promise<{ lufs: number; truePeak: number }> {
  const r = await ff([
    "-i",
    wav,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const tail = r.err.slice(r.err.lastIndexOf("Summary:"));
  return {
    lufs: Number(tail.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1] ?? NaN),
    truePeak: Number(tail.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1] ?? NaN),
  };
}

async function pcm(wav: string, rate: number): Promise<Float32Array> {
  const r = await new Deno.Command("ffmpeg", {
    args: [
      "-v",
      "error",
      "-i",
      wav,
      "-ac",
      "2",
      "-ar",
      String(rate),
      "-f",
      "f32le",
      "-",
    ],
    stdout: "piped",
    stderr: "null",
  }).output();
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
}

// -- VO cue table (text and word timings), read once per run

export interface CueLine {
  readonly id: string;
  readonly texts: readonly string[];
  /** Word start times (s from line start) per language, when the VO pipeline provides them. */
  readonly words: Readonly<Record<string, readonly number[]>>;
}

let cueCache: Map<string, CueLine> | null = null;

/** `public/vo/cues.json` (what ships), falling back to `vo/out/cues.json`. */
export async function cueTable(): Promise<Map<string, CueLine>> {
  if (cueCache) return cueCache;
  let raw: {
    lines?: Record<string, { langs?: Record<string, Record<string, unknown>> }>;
  } = {};
  for (const p of ["public/vo/cues.json", "vo/out/cues.json"]) {
    try {
      raw = JSON.parse(await Deno.readTextFile(repo(p)));
      break;
    } catch { /* try the next */ }
  }
  cueCache = new Map();
  for (const [id, l] of Object.entries(raw.lines ?? {})) {
    const texts: string[] = [];
    const words: Record<string, number[]> = {};
    for (const [lang, take] of Object.entries(l.langs ?? {})) {
      if (typeof take.text === "string") texts.push(take.text);
      const ws = take.words;
      if (Array.isArray(ws)) {
        // WordTiming {startS} (src/contracts/text.ts); tolerate older shapes.
        words[lang] = ws.map((x) =>
          Array.isArray(x) ? Number(x[0]) : Number(
            (x as Record<string, unknown>).startS ??
              (x as Record<string, unknown>).start ??
              (x as Record<string, unknown>).s ??
              (x as Record<string, unknown>).t,
          )
        ).filter(Number.isFinite);
      }
    }
    cueCache.set(id, { id, texts, words });
  }
  return cueCache;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Line id for a subtitle chunk: `data-line` if the view sets it, else a text match. */
function lineOf(
  text: string,
  line: string,
  cues: Map<string, CueLine>,
): string {
  if (line) return line;
  const t = squash(text);
  if (!t) return "";
  for (const c of cues.values()) {
    if (c.texts.some((x) => squash(x).includes(t))) return c.id;
  }
  return `?${text.slice(0, 30)}`;
}

export interface SubInterval extends Span {
  readonly line: string;
  readonly layer: string;
  /** Seconds of audible VO stem inside the window. */
  audibleS?: number;
}

function subtitleIntervals(
  log: AvLog,
  cues: Map<string, CueLine>,
  end: number,
): SubInterval[] {
  const out: SubInterval[] = [];
  let open: { start: number; line: string; layer: string } | null = null;
  const close = (t: number) => {
    if (open) out.push({ ...open, end: t });
    open = null;
  };
  for (const s of log.subs) {
    const t = log.t(s.epoch);
    const line = s.visible ? lineOf(s.text, s.line, cues) : "";
    if (open && (!s.visible || line !== open.line)) close(t);
    if (s.visible && !open) open = { start: t, line, layer: s.layer };
  }
  close(end);
  return out;
}

// -- the result

export interface AvResult {
  readonly hasAudio: boolean;
  readonly voStem: boolean;
  readonly contextStates: readonly string[];
  readonly sourcesStarted: number;
  readonly voStarted: readonly string[];
  readonly lufs: number;
  readonly truePeak: number;
  /** Per-bus loudness (pre-master, so before the master fader and limiter). */
  readonly buses?: Readonly<
    Partial<Record<BusStem, { lufs: number; truePeak: number }>>
  >;
  readonly audibleS: number;
  readonly voAudible: readonly Span[];
  readonly subtitles: readonly SubInterval[];
  readonly balance?: { p10: number; p90: number; windows: number; r?: number };
  readonly wordPulse?: readonly {
    line: string;
    pairs: number;
    maxErrMs: number;
    p95ErrMs: number;
  }[];
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Builds `reel.mp4` next to `video` and runs the AV checks. Intermediates go
 * to `<dir>/av/` and are removed; `av.json` stays.
 */
export async function finishAv(
  log: AvLog,
  dir: string,
  video: string,
  seconds: number,
  opts: AvOptions,
): Promise<{ av: AvResult; checks: Check[] }> {
  const tmp = `${dir}/av`;
  await Deno.mkdir(tmp, { recursive: true });
  const checks: Check[] = [];
  const check = (
    id: string,
    status: Status,
    detail: string,
    items?: string[],
  ) => checks.push({ id, status, detail, items });
  const cues = await cueTable();
  try {
    const hasAudio = await stem(log, "mix", tmp, seconds);
    const voStem = await stem(log, "vo", tmp, seconds);
    const spatialStem = opts.spatial
      ? await stem(log, "spatial", tmp, seconds)
      : false;
    await mux(video, `${tmp}/mix.wav`, `${dir}/reel.mp4`);

    const mixSilent = await silence(`${tmp}/mix.wav`, seconds);
    const mixAudible = audibleSpans(mixSilent, seconds);
    const audibleS = mixAudible.reduce((n, s) => n + s.end - s.start, 0);
    const buses: Partial<Record<BusStem, { lufs: number; truePeak: number }>> =
      {};
    for (const b of BUS_STEMS) {
      if (await stem(log, b, tmp, seconds)) {
        const l = await loudness(`${tmp}/${b}.wav`);
        buses[b] = { lufs: r2(l.lufs), truePeak: r2(l.truePeak) };
      }
    }
    const voAudible = voStem
      ? audibleSpans(await silence(`${tmp}/vo.wav`, seconds), seconds)
      : [];
    const { lufs, truePeak } = hasAudio
      ? await loudness(`${tmp}/mix.wav`)
      : { lufs: NaN, truePeak: NaN };
    const voStarted = log.sources.filter((s) => s.url.includes("/vo/")).map((
      s,
    ) => `${r2(log.t(s.epoch))}s ${s.url.replace(/^.*\/vo\//, "")}`);

    check(
      "audio: captured",
      hasAudio ? (audibleS > 0.2 ? "pass" : "warn") : "warn",
      hasAudio
        ? `${r2(audibleS)} s audible of ${
          r2(seconds)
        } s, ${log.sources.length} sounds started, ${voStarted.length} VO`
        : "the game never wired a node to the speakers",
    );
    if (hasAudio && Number.isFinite(truePeak)) {
      check(
        "audio: true peak at or under -1 dBTP",
        truePeak <= -0.9 ? "pass" : "warn",
        `${r2(truePeak)} dBTP, ${
          Number.isFinite(lufs) ? r2(lufs) + " LUFS integrated" : "LUFS n/a"
        }`,
      );
    }

    if (Object.keys(buses).length) {
      check(
        "audio: bus loudness (pre-master)",
        "pass",
        BUS_STEMS.filter((b) => buses[b]).map((b) =>
          `${b} ${buses[b]!.lufs} LUFS / ${buses[b]!.truePeak} dBTP`
        ).join(", "),
      );
    }
    if (hasAudio && Number.isFinite(lufs) && audibleS > 5) {
      check(
        "audio: integrated loudness -20 to -14 LUFS",
        lufs >= -20 && lufs <= -14 ? "pass" : "warn",
        `${r2(lufs)} LUFS integrated (target about -17)`,
      );
    }

    // VO-no-drop: every subtitle window needs audible voice in it.
    const subs = subtitleIntervals(log, cues, seconds).filter((s) =>
      s.end - s.start >= 0.25
    );
    const audible = voStem ? voAudible : mixAudible;
    const dropped: string[] = [];
    // Takes keep about 0.12 s of lead-in after `voStartS` skips the rest,
    // but older captures and unmeasured takes opened with up to 0.7 s, so a
    // window under 0.75 s (a line cut at autoplay speed), or one the reel's
    // end cuts short, still can't be judged.
    const unjudged = subs.filter((s) =>
      s.end - s.start < 0.75 ||
      (s.end >= seconds - 0.1 && s.end - s.start < 1.5)
    );
    for (const s of subs) {
      if (unjudged.includes(s)) continue;
      s.audibleS = r2(overlap(audible, { start: s.start, end: s.end + 0.15 }));
      const need = Math.min(0.3, 0.5 * (s.end - s.start));
      if (s.audibleS < need) {
        dropped.push(
          `${r2(s.start)}–${r2(s.end)} s ${s.line} (${s.audibleS} s audible)`,
        );
      }
    }
    if (!subs.length) {
      check("VO not dropped", "pass", "no subtitles shown in this reel");
    } else {
      check(
        "VO not dropped",
        dropped.length ? "fail" : "pass",
        `${subs.length - unjudged.length - dropped.length} of ${
          subs.length - unjudged.length
        } subtitle windows have audible ${
          voStem ? "VO stem" : "mix (no VO stem)"
        }`,
        dropped.slice(0, 12),
      );
    }

    let balance: AvResult["balance"];
    if (opts.spatial) {
      const rate = 8000;
      const win = stereoBalance(
        await pcm(`${tmp}/${spatialStem ? "spatial" : "mix"}.wav`, rate),
        rate,
        0.1,
        -50,
      );
      const b = win.map((x) => x.balance);
      const p10 = quantile(b, 0.05);
      const p90 = quantile(b, 0.95);
      // Correlate with the mean enemy x (when the probe exposes positions).
      let r: number | undefined;
      if (log.enemies.length > 10) {
        const xs: number[] = [];
        const bs: number[] = [];
        for (const w of win) {
          const e = log.enemies.reduce((best, s) =>
            Math.abs(log.t(s.epoch) - w.t) < Math.abs(log.t(best.epoch) - w.t)
              ? s
              : best
          );
          if (!e.xs.length || Math.abs(log.t(e.epoch) - w.t) > 0.2) continue;
          xs.push(e.xs.reduce((a, c) => a + c, 0) / e.xs.length);
          bs.push(w.balance);
        }
        r = pearson(xs, bs);
      }
      balance = {
        p10: r2(p10),
        p90: r2(p90),
        windows: win.length,
        r: r === undefined ? undefined : r2(r),
      };
      const moves = win.length >= 20 && p90 - p10 >= 0.3 && p10 < -0.1 &&
        p90 > 0.1;
      check(
        "spatial: stereo image moves with the action",
        win.length < 20 ? "fail" : moves ? "pass" : "fail",
        win.length < 20
          ? `only ${win.length} audible windows`
          : `balance p5 ${r2(p10)}, p95 ${
            r2(p90)
          } over ${win.length} windows of the ${
            spatialStem ? "post-panner stem" : "full mix (no panner nodes seen)"
          } (need a spread of 0.3 crossing centre)`,
      );
      check(
        "spatial: balance follows enemy x",
        r === undefined || Number.isNaN(r)
          ? "pending"
          : r >= 0.3
          ? "pass"
          : "fail",
        r === undefined || Number.isNaN(r)
          ? "probe p.enemies() absent (qa/REQUESTS.md)"
          : `Pearson r = ${
            r2(r)
          } between L/R balance and mean enemy x (want >= 0.3)`,
      );
    }

    let wordPulse: AvResult["wordPulse"];
    if (opts.wordPulse) {
      const byLine = new Map<string, { index: number; t: number }[]>();
      for (const wd of log.words) {
        const sub = log.subs.findLast((s) => s.epoch <= wd.epoch);
        const id = lineOf(sub?.text ?? "", wd.line, cues);
        // Span counting is only absolute in a line's first chunk.
        const firstChunk = cues.get(id)?.texts.some((x) =>
          squash(x).startsWith(squash(sub?.text ?? "\u0000"))
        );
        if (!wd.exact && !firstChunk) continue;
        byLine.set(id, [...(byLine.get(id) ?? []), {
          index: wd.index,
          t: log.t(wd.epoch),
        }]);
      }
      const rows: {
        line: string;
        pairs: number;
        maxErrMs: number;
        p95ErrMs: number;
      }[] = [];
      const anyWords = [...cues.values()].some((c) =>
        Object.keys(c.words).length
      );
      for (const [id, shown] of byLine) {
        const c = cues.get(id);
        const words = c && (c.words.en ?? Object.values(c.words)[0]);
        if (!words?.length) continue;
        const lang = Object.entries(c!.words).find(([, w]) => w === words)?.[0];
        const a = wordAlignment(shown, words);
        if (a) {
          rows.push({
            line: `${id}.${lang}`,
            pairs: a.pairs,
            maxErrMs: Math.round(a.maxErrMs),
            p95ErrMs: Math.round(a.p95ErrMs),
          });
        }
      }
      wordPulse = rows;
      if (!anyWords) {
        check(
          "subtitles: word pulse within 80 ms",
          "pending",
          "no word timings in cues.json yet (agent T)",
        );
      } else if (!log.words.length) {
        check(
          "subtitles: word pulse within 80 ms",
          "pending",
          `no highlighted word found (${WORD_SELECTOR.split(",")[0]}; agent U)`,
        );
      } else {
        const bad = rows.filter((r) => r.p95ErrMs > 80);
        check(
          "subtitles: word pulse within 80 ms",
          !rows.length ? "fail" : bad.length ? "fail" : "pass",
          rows.length
            ? `${
              rows.length - bad.length
            } of ${rows.length} lines align (p95 error at most 80 ms)`
            : "highlights seen but none matched a cue with word timings",
          rows.map((r) =>
            `${r.line}: ${r.pairs} words, p95 ${r.p95ErrMs} ms, max ${r.maxErrMs} ms`
          ),
        );
      }
    }

    return {
      av: {
        hasAudio,
        voStem,
        contextStates: log.ctx.map((c) => c.state),
        sourcesStarted: log.sources.length,
        voStarted,
        lufs,
        truePeak,
        buses,
        audibleS: r2(audibleS),
        voAudible: voAudible.map((s) => ({
          start: r2(s.start),
          end: r2(s.end),
        })),
        subtitles: subs,
        balance,
        wordPulse,
      },
      checks,
    };
  } finally {
    // QA_KEEP_AV=1 keeps the stems and segments for debugging the capture.
    if (!Deno.env.get("QA_KEEP_AV")) {
      await Deno.remove(tmp, { recursive: true }).catch(() => {});
    }
  }
}
