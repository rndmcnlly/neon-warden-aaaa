/**
 * Plan plus cached takes to a localized master, with FFmpeg.
 *
 * Steps: resolve each shot's anchor in its take's timeline; trim and conform
 * every shot (scale and pad to the output size, fixed fps, game audio at the
 * shot's gain); render cards, lower thirds and captions as PNGs in Chromium
 * (this machine's ffmpeg has no drawtext or libass, and the browser gets CJK
 * and the game's look right); build the music edit from the cue manifest's
 * beat grid; place VO; duck music under VO with a sidechain compressor; mix;
 * normalize loudness in two passes; mux; write SRT and chapter files and a
 * report with the measured loudness.
 *
 * Loudness targets come from the sheet (all three use -16 LUFS integrated,
 * -2 dBTP true peak, the published Xbox trailer master spec; see the
 * research README). Measured values are recorded per master, not assumed.
 */

import { chromium } from "npm:playwright@1.58.2";
import {
  type Caption,
  type CardSpec,
  findAnchor,
  type Lang,
  musicManifest,
  type Plan,
  type PlannedShot,
  ROOT,
  type TimelineEntry,
} from "./plan.ts";

export interface ShotSource {
  shot: string;
  takeDir?: string;
  takeKey?: string;
}

export interface AssembleOptions {
  out: string;
  draft: boolean;
  /** Take directory per take id, for takes that exist in the cache. */
  takes: Record<string, { dir: string; key: string } | undefined>;
  playUrl?: string;
  log?: (s: string) => void;
  /** Output frame rate; defaults to the sheet's (master takes are 60 fps). */
  fps?: number;
  /**
   * A partial master (`--master --shots`): full size and quality, but
   * placeholders allowed and never public; files get a `-partial` suffix.
   */
  partial?: boolean;
}

interface ResolvedShot {
  shot: PlannedShot;
  kind: "take" | "card" | "placeholder";
  takeKey?: string;
  file?: string;
  inPoint?: number;
  anchorAt?: number;
  note?: string;
}

async function ff(args: string[], what: string): Promise<string> {
  const o = await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-nostdin", "-y", ...args],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const err = new TextDecoder().decode(o.stderr);
  if (!o.success) {
    throw new Error(`ffmpeg ${what} failed:\n${err.slice(-1500)}`);
  }
  return err;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// -- HTML for cards and captions (rendered at output size)

function cardHtml(
  card: CardSpec,
  text: string,
  small: string,
  lang: Lang,
  W: number,
  H: number,
  extra = "",
): string {
  const u = H / 1080; // design at 1080 lines, scale to the output
  const font = lang === "zh"
    ? `"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",system-ui,sans-serif`
    : `"Avenir Next","Helvetica Neue",system-ui,sans-serif`;
  const lines = esc(text).replace(/\n/g, "<br>");
  const base =
    `*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;font-family:${font};color:#eafcff}`;
  const dark =
    `body{background:radial-gradient(ellipse at 50% 40%,#10233a 0%,#05070d 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}`;
  const glow = `text-shadow:0 0 ${18 * u}px #19e3ff99,0 0 ${4 * u}px #19e3ff`;
  switch (card.style) {
    case "title":
      return `<style>${base}${dark}h1{font-size:${150 * u}px;letter-spacing:${
        0.12 * 150 * u
      }px;font-weight:800;${glow}}</style><h1>${lines}</h1>`;
    case "tell":
      return `<style>${base}${dark}h2{font-size:${
        84 * u
      }px;font-weight:800;letter-spacing:${
        4 * u
      }px;max-width:80%;${glow}}</style><h2>${lines}</h2>`;
    case "slate":
      return `<style>${base}${dark}h2{font-size:${
        64 * u
      }px;font-weight:700;line-height:1.3;${glow}}p{margin-top:${
        48 * u
      }px;font-size:${30 * u}px;color:#8fb6c4;letter-spacing:${
        2 * u
      }px}</style><h2>${lines}</h2><p>${esc(small)}</p>`;
    case "chapter":
      return `<style>${base}${dark}p{font-size:${
        34 * u
      }px;color:#19e3ff;letter-spacing:${8 * u}px}h2{margin-top:${
        16 * u
      }px;font-size:${88 * u}px;font-weight:800;${glow}}</style><p>${
        esc(small)
      }</p><h2>${lines}</h2>`;
    case "lower":
      return `<style>${base}body{background:transparent}div{position:absolute;left:${
        64 * u
      }px;top:${64 * u}px;padding:${14 * u}px ${
        26 * u
      }px;background:#05070dcc;border-left:${6 * u}px solid #19e3ff;font-size:${
        38 * u
      }px;font-weight:700}</style><div>${lines}</div>`;
    case "placeholder":
      return `<style>${base}body{background:#1b1e24;display:flex;flex-direction:column;justify-content:center;padding:0 ${
        90 * u
      }px;color:#c9ced6}h2{font-size:${56 * u}px;color:#ffb347}p{font-size:${
        34 * u
      }px;margin-top:${20 * u}px;line-height:1.35}code{font-size:${
        28 * u
      }px;color:#8a93a3}</style><h2>${lines}</h2><p>${esc(small)}</p><p><code>${
        esc(extra)
      }</code></p>`;
  }
}

function captionHtml(c: Caption, lang: Lang, W: number, H: number): string {
  const u = H / 1080;
  const font = lang === "zh"
    ? `"PingFang SC","Hiragino Sans GB",system-ui,sans-serif`
    : `"Helvetica Neue",Arial,system-ui,sans-serif`;
  const who = c.speaker ? `<b>${esc(c.speaker)}</b>` : "";
  return `<style>*{margin:0}html,body{width:${W}px;height:${H}px;background:transparent;font-family:${font}}div{position:absolute;left:50%;bottom:${
    90 * u
  }px;transform:translateX(-50%);max-width:${
    lang === "zh" ? 62 : 72
  }%;padding:${12 * u}px ${
    24 * u
  }px;background:#000000b8;color:#fff;font-size:${
    46 * u
  }px;line-height:1.3;text-align:center;border-radius:${
    6 * u
  }px}b{display:block;font-size:${30 * u}px;color:#19e3ff;letter-spacing:${
    1 * u
  }px}</style><div>${who}${esc(c.text)}</div>`;
}

async function renderPngs(
  items: { file: string; html: string }[],
  W: number,
  H: number,
) {
  if (!items.length) return;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const it of items) {
    await page.setContent(`<!doctype html><meta charset="utf-8">${it.html}`);
    await page.screenshot({ path: it.file, omitBackground: true });
  }
  await browser.close();
}

// -- music edit

async function buildMusic(
  plan: Plan,
  dir: string,
): Promise<string | undefined> {
  if (!plan.segments.length) return undefined;
  const cues = await musicManifest();
  const parts: string[] = [];
  let i = 0;
  for (const s of plan.segments) {
    const f = `${dir}/music-${i++}.wav`;
    if (!s.cue) {
      await ff([
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-t",
        s.dur.toFixed(4),
        "-c:a",
        "pcm_s16le",
        f,
      ], "silence");
    } else {
      const cue = cues[s.cue];
      const src = `${ROOT}public/${cue.src}`;
      // Loop cues wrap from loopEnd back to loopStart.
      const pieces: [number, number][] = [];
      let at = s.cueStart ?? 0;
      let need = s.dur;
      while (need > 1e-3) {
        const end = cue.loop && cue.loopEnd ? cue.loopEnd : Infinity;
        const take = Math.min(need, end - at);
        pieces.push([at, take]);
        need -= take;
        at = cue.loopStart ?? 0;
      }
      const inputs = pieces.flatMap((
        [a, d],
      ) => ["-ss", a.toFixed(4), "-t", d.toFixed(4), "-i", src]);
      const fade = s.fadeOut
        ? `,afade=t=out:st=${(s.dur - s.fadeOut).toFixed(3)}:d=${s.fadeOut}`
        : "";
      const chain = `${
        pieces.map((_, k) => `[${k}:a]`).join("")
      }concat=n=${pieces.length}:v=0:a=1,aresample=48000,aformat=channel_layouts=stereo,atrim=0:${
        s.dur.toFixed(4)
      }${fade}[m]`;
      await ff([
        ...inputs,
        "-filter_complex",
        chain,
        "-map",
        "[m]",
        "-c:a",
        "pcm_s16le",
        f,
      ], `music ${s.cue}`);
    }
    parts.push(f);
  }
  const list = `${dir}/music.txt`;
  await Deno.writeTextFile(list, parts.map((p) => `file '${p}'`).join("\n"));
  const out = `${dir}/music.wav`;
  await ff(
    ["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out],
    "music concat",
  );
  return out;
}

// -- loudness

interface Loudness {
  I: number;
  TP: number;
  LRA: number;
  thresh: number;
  offset: number;
}

async function measure(
  file: string,
  lufs: number,
  tp: number,
): Promise<Loudness> {
  const err = await ff([
    "-i",
    file,
    "-af",
    `loudnorm=I=${lufs}:TP=${tp}:LRA=11:print_format=json`,
    "-f",
    "null",
    "-",
  ], "loudness pass 1");
  const j = JSON.parse(
    err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1),
  );
  return {
    I: +j.input_i,
    TP: +j.input_tp,
    LRA: +j.input_lra,
    thresh: +j.input_thresh,
    offset: +j.target_offset,
  };
}

async function verify(
  file: string,
): Promise<{ lufs: number; truePeak: number }> {
  const err = await ff([
    "-i",
    file,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ], "ebur128");
  const sum = err.slice(err.lastIndexOf("Summary:"));
  return {
    lufs: Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]),
    truePeak: Number(sum.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]),
  };
}

// -- main

export async function assemble(plan: Plan, opt: AssembleOptions) {
  const log = opt.log ?? console.log;
  const t0 = Date.now();
  const { sheet, lang } = plan;
  const W = opt.draft ? 640 : sheet.master.width;
  const H = opt.draft ? 360 : sheet.master.height;
  const fps = opt.fps ?? sheet.master.fps;
  const work = `${opt.out}/work`;
  await Deno.mkdir(work, { recursive: true });
  const warnings = [...plan.warnings];

  const fill = (s: string) => {
    if (s.includes("{{PLAY_URL}}") && !opt.playUrl) {
      if (sheet.audience === "public" && !opt.draft && !opt.partial) {
        throw new Error(
          "unresolved {{PLAY_URL}}: set TRAILER_PLAY_URL for a public master",
        );
      }
      warnings.push("CTA URL unresolved (placeholder shown)");
    }
    return s.replaceAll("{{PLAY_URL}}", opt.playUrl ?? "[play URL pending]");
  };

  // 1. Resolve shots.
  const resolved: ResolvedShot[] = [];
  const timelines = new Map<
    string,
    { entries: TimelineEntry[]; seconds: number }
  >();
  for (const shot of plan.shots) {
    const s = shot.spec;
    if (s.card && !s.take) {
      resolved.push({ shot, kind: "card" });
      continue;
    }
    const take = s.take ? opt.takes[s.take] : undefined;
    if (!take) {
      resolved.push({ shot, kind: "placeholder", note: "take not captured" });
      continue;
    }
    if (!timelines.has(take.dir)) {
      const tl = JSON.parse(
        await Deno.readTextFile(`${take.dir}/timeline.json`),
      );
      timelines.set(take.dir, { entries: tl.entries, seconds: tl.seconds });
    }
    const tl = timelines.get(take.dir)!;
    const anchorAt = s.anchor ? findAnchor(tl.entries, s.anchor) : 0;
    if (anchorAt === undefined) {
      warnings.push(
        `${s.id}: anchor ${JSON.stringify(s.anchor)} not found in ${take.key}`,
      );
      resolved.push({
        shot,
        kind: "placeholder",
        takeKey: take.key,
        note: "anchor not found",
      });
      continue;
    }
    let inPoint = anchorAt + (s.offset ?? 0) - shot.alignS;
    if (inPoint < 0) {
      warnings.push(
        `${s.id}: in-point ${
          inPoint.toFixed(2)
        } s before take start, clamped (sync lost)`,
      );
      inPoint = 0;
    }
    if (inPoint + shot.dur > tl.seconds) {
      warnings.push(
        `${s.id}: needs ${
          (inPoint + shot.dur - tl.seconds).toFixed(2)
        } s past the end of ${take.key}`,
      );
    }
    resolved.push({
      shot,
      kind: "take",
      takeKey: take.key,
      file: `${take.dir}/take.mp4`,
      inPoint,
      anchorAt,
    });
  }

  // 2. Cards, lower thirds, placeholders and captions as PNGs.
  const pngs: { file: string; html: string }[] = [];
  const chapterNo = new Map(
    (sheet.chapters ?? []).map((c, i) => [c.id, i + 1]),
  );
  const cardFile = (r: ResolvedShot) => `${work}/card-${r.shot.index}.png`;
  const labelFile = (r: ResolvedShot) => `${work}/label-${r.shot.index}.png`;
  for (const r of resolved) {
    const s = r.shot.spec;
    if (r.kind === "card" && s.card) {
      const card = sheet.cards[s.card];
      let text = card.text?.[lang] ?? "";
      let small = fill(card.small?.[lang] ?? "");
      if (card.style === "chapter" && s.chapter) {
        const ch = sheet.chapters?.find((c) => c.id === s.chapter);
        text = ch?.title[lang] ?? s.chapter;
        small = String(chapterNo.get(s.chapter) ?? "").padStart(2, "0");
      }
      pngs.push({
        file: cardFile(r),
        html: cardHtml(card, text, small, lang, W, H),
      });
    } else if (r.kind === "placeholder") {
      pngs.push({
        file: cardFile(r),
        html: cardHtml(
          { style: "placeholder" },
          `${s.id}: ${r.note}`,
          s.purpose ?? s.evidence ?? "",
          lang,
          W,
          H,
          `take ${s.take ?? "-"} anchor ${JSON.stringify(s.anchor ?? {})}`,
        ),
      });
    }
    if (r.kind === "take" && s.label) {
      const card = sheet.cards[s.label];
      pngs.push({
        file: labelFile(r),
        html: cardHtml(card, card.text?.[lang] ?? "", "", lang, W, H),
      });
    }
  }
  const burn = sheet.captions === "burned" || sheet.captions === "burned+srt";
  const captions = plan.vo.flatMap((v) => v.captions);
  if (burn) {
    captions.forEach((c, i) =>
      pngs.push({
        file: `${work}/cap-${i}.png`,
        html: captionHtml(c, lang, W, H),
      })
    );
  }
  await renderPngs(pngs, W, H);
  log(`  rendered ${pngs.length} text layers`);

  // 3. Conform each shot to an intermediate with the same codec parameters.
  const vcodec = [
    "-c:v",
    "libx264",
    "-preset",
    opt.draft ? "ultrafast" : "slow",
    "-crf",
    opt.draft ? "28" : "16",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
  ];
  const acodec = ["-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2"];
  const scale =
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps}`;
  const segs: string[] = [];
  for (const r of resolved) {
    // Shot boundaries quantized to the frame grid, so every segment is a
    // whole number of frames and the concat cannot drift from the plan's
    // clock (beat-length cuts rounded up one frame each: 8 frames, 133 ms of
    // picture lag behind music, VO and captions by the end of trailer90).
    const g0 = Math.round(r.shot.start * fps);
    const nFrames = Math.round((r.shot.start + r.shot.dur) * fps) - g0;
    const d = (nFrames / fps).toFixed(6);
    const exact = ["-frames:v", String(nFrames)];
    const f = `${work}/seg-${String(r.shot.index).padStart(2, "0")}.mkv`;
    if (r.kind === "take") {
      const label = r.shot.spec.label ? ["-i", labelFile(r)] : [];
      const vf = label.length
        ? `[0:v]${scale}[b];[b][1:v]overlay=0:0[v]`
        : `[0:v]${scale}[v]`;
      const gain = r.shot.spec.game ?? 0;
      // In-point on the take's frame grid: between frames, the conform's fps
      // filter repeats the first decoded frame (a doubled first frame).
      await ff([
        "-ss",
        (Math.round(r.inPoint! * fps) / fps).toFixed(6),
        "-t",
        d,
        "-i",
        r.file!,
        ...label,
        "-filter_complex",
        `${vf};[0:a]volume=${gain}dB,aresample=48000,apad[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        d,
        ...exact,
        ...vcodec,
        ...acodec,
        f,
      ], `shot ${r.shot.spec.id}`);
    } else {
      // The still is read at the output rate and over-read by a frame; the
      // frame cap trims it (read at the default 25 fps it came up short).
      await ff([
        "-framerate",
        String(fps),
        "-loop",
        "1",
        "-t",
        ((nFrames + 2) / fps).toFixed(6),
        "-i",
        cardFile(r),
        "-f",
        "lavfi",
        "-t",
        d,
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-filter_complex",
        `[0:v]format=rgb24,${scale}[v]`,
        "-map",
        "[v]",
        "-map",
        "1:a",
        "-t",
        d,
        ...exact,
        ...vcodec,
        ...acodec,
        f,
      ], `card ${r.shot.spec.id}`);
    }
    segs.push(f);
  }
  const list = `${work}/shots.txt`;
  await Deno.writeTextFile(list, segs.map((s) => `file '${s}'`).join("\n"));
  const body = `${work}/body.mkv`;
  await ff(
    ["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", body],
    "concat shots",
  );
  log(`  conformed ${segs.length} shots`);

  // 4. Audio: game (in body), music edit, VO; duck music under VO; mix.
  const music = await buildMusic(plan, work);
  const total = plan.seconds.toFixed(4);
  const voInputs = plan.vo.flatMap((v) => ["-i", `${ROOT}public/vo/${v.file}`]);
  const nIn = 1 + (music ? 1 : 0);
  const voChain = plan.vo.map((v, i) =>
    `[${nIn + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${
      Math.round(v.start * 1000)
    }:all=1[v${i}]`
  ).join(";");
  const voMix = plan.vo.length
    ? `;${
      plan.vo.map((_, i) => `[v${i}]`).join("")
    }amix=inputs=${plan.vo.length}:normalize=0,apad,atrim=0:${total}[vo]`
    : "";
  let graph = `[0:a]atrim=0:${total}[game]`;
  if (voChain) graph += `;${voChain}${voMix}`;
  const out = ["[game]"];
  if (music && plan.vo.length) {
    // Duck: threshold -30 dBFS, ratio 6:1, 20 ms attack, 350 ms release.
    graph +=
      `;[vo]asplit[vo1][vokey];[1:a]volume=-3dB[mus];[mus][vokey]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[ducked]`;
    out.push("[ducked]", "[vo1]");
  } else if (music) {
    graph += `;[1:a]volume=-3dB[ducked]`;
    out.push("[ducked]");
  } else if (plan.vo.length) out.push("[vo]");
  graph += `;${
    out.join("")
  }amix=inputs=${out.length}:normalize=0,atrim=0:${total}[mix]`;
  const mix = `${work}/mix.wav`;
  await ff([
    "-i",
    body,
    ...(music ? ["-i", music] : []),
    ...voInputs,
    "-filter_complex",
    graph,
    "-map",
    "[mix]",
    "-c:a",
    "pcm_s24le",
    "-ar",
    "48000",
    mix,
  ], "mix");

  // 5. Two-pass loudness: measure, then linear normalization to target.
  const { lufs, truePeak } = sheet.loudness;
  const m = await measure(mix, lufs, truePeak);
  // loudnorm's linear mode silently falls back to dynamic mode when the gain
  // would push the true peak over the ceiling (trailer90's first draft: -0.8
  // dBTP). Then: the same linear gain, and a 4x-oversampled brickwall
  // limiter 1 dB under the ceiling (margin for the AAC encode).
  const gain = lufs - m.I;
  const ceiling = Math.pow(10, (truePeak - 1) / 20).toFixed(4);
  const norm = m.TP + gain <= truePeak - 0.5
    ? `loudnorm=I=${lufs}:TP=${truePeak}:LRA=11:measured_I=${m.I}:measured_TP=${m.TP}:measured_LRA=${m.LRA}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true,aresample=48000`
    : `aresample=192000,volume=${
      gain.toFixed(2)
    }dB,alimiter=limit=${ceiling}:attack=1:release=60:level=disabled,aresample=48000`;

  // 6. Captions overlay and final mux.
  const capIn = burn
    ? captions.flatMap((_, i) => ["-i", `${work}/cap-${i}.png`])
    : [];
  let vgraph = "[0:v]null[v0]";
  if (burn) {
    vgraph = "[0:v]null[c0]";
    captions.forEach((c, i) => {
      vgraph += `;[c${i}][${2 + i}:v]overlay=0:0:enable='between(t,${
        c.start.toFixed(3)
      },${c.end.toFixed(3)})'[c${i + 1}]`;
    });
    vgraph += `;[c${captions.length}]null[v0]`;
  }
  const suffix = opt.draft ? "-draft" : opt.partial ? "-partial" : "";
  const master = `${opt.out}/${sheet.id}-${lang}${suffix}.mp4`;
  await ff([
    "-i",
    body,
    "-i",
    mix,
    ...capIn,
    "-filter_complex",
    `${vgraph};[1:a]${norm}[a]`,
    "-map",
    "[v0]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    opt.draft ? "veryfast" : "slow",
    "-crf",
    opt.draft ? "26" : "16",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    master,
  ], "master");
  const measured = await verify(master);
  if (measured.lufs > lufs + 1 || measured.lufs < lufs - 1) {
    warnings.push(
      `integrated ${measured.lufs} LUFS misses ${lufs} by more than 1 LU`,
    );
  }
  if (measured.truePeak > truePeak + 0.5) {
    warnings.push(`true peak ${measured.truePeak} dBTP over ${truePeak}`);
  }

  // 7. Sidecars: SRT, chapters.
  const ts = (x: number, sep: string) => {
    const ms = Math.round(x * 1000);
    const h = Math.floor(ms / 3600000),
      mi = Math.floor(ms / 60000) % 60,
      s = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${
      String(s).padStart(2, "0")
    }${sep}${String(ms % 1000).padStart(3, "0")}`;
  };
  if (
    captions.length && sheet.captions !== "game" && sheet.captions !== "none"
  ) {
    await Deno.writeTextFile(
      `${opt.out}/${sheet.id}-${lang}${suffix}.srt`,
      captions.map((c, i) =>
        `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${
          c.speaker ? `${c.speaker.toUpperCase()}: ` : ""
        }${c.text}\n`
      ).join("\n"),
    );
  }
  if (sheet.chapters?.length) {
    const starts = sheet.chapters.map((ch) => ({
      ch,
      at: plan.shots.find((p) => p.spec.chapter === ch.id)?.start ?? 0,
    }));
    const yt = starts.map(({ ch, at }) =>
      `${ts(at, ".").slice(3, 8)} ${ch.title[lang]}`
    ).join("\n");
    await Deno.writeTextFile(
      `${opt.out}/${sheet.id}-${lang}${suffix}.chapters.txt`,
      yt + "\n",
    );
    const vtt = starts.map(({ ch, at }, i) =>
      `${ts(at, ".")} --> ${ts(starts[i + 1]?.at ?? plan.seconds, ".")}\n${
        ch.title[lang]
      }\n`
    ).join("\n");
    await Deno.writeTextFile(
      `${opt.out}/${sheet.id}-${lang}${suffix}.chapters.vtt`,
      `WEBVTT\n\n${vtt}`,
    );
  }
  const report = {
    cut: sheet.id,
    lang,
    draft: opt.draft,
    partial: opt.partial ?? false,
    size: `${W}x${H}@${fps}`,
    seconds: plan.seconds,
    master,
    loudness: { target: sheet.loudness, preMix: m, measured },
    shots: resolved.map((r) => ({
      id: r.shot.spec.id,
      start: +r.shot.start.toFixed(3),
      dur: +r.shot.dur.toFixed(3),
      kind: r.kind,
      take: r.takeKey,
      anchorAt: r.anchorAt,
      inPoint: r.inPoint && +r.inPoint.toFixed(3),
      note: r.note,
    })),
    vo: plan.vo.map((v) => ({
      line: v.line,
      start: +v.start.toFixed(3),
      dur: v.dur,
    })),
    warnings,
    assembleSeconds: (Date.now() - t0) / 1000,
  };
  await Deno.writeTextFile(
    `${opt.out}/${sheet.id}-${lang}${suffix}.report.json`,
    JSON.stringify(report, null, 1),
  );
  return report;
}
