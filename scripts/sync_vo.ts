/**
 * Builds the shipped voice-over: `vo/out/` (the VO pipeline's raw WAV takes)
 * becomes `public/vo/`, where `src/audio/` looks:
 *
 * - `public/vo/<lang>/<id>.ogg`: Ogg Opus, mono, 48 kHz, loudness-normalized
 *   per line to -18 LUFS integrated with a -1 dBTP ceiling (barks and
 *   chatter sit 2 LU lower, under story lines). Already normalized WAVs use
 *   their render-time loudness metadata and plain linear gain, avoiding a
 *   second loudnorm pass. Legacy WAVs are measured with two-pass loudnorm.
 * - `public/vo/cues.json`: `vo/out/cues.json` with each take's `file`
 *   pointing at its `.ogg`, plus the measured input loudness.
 * - `public/vo/stamps.json`: which render (the take's `hash` in cues.json)
 *   each `.ogg` came from, so a rerun only encodes changed takes, plus the
 *   take's measured speech onset (`onsetS`, `scripts/vo_onset.ts`). The
 *   onset is copied into each take in `cues.json` and into the voice
 *   variants index, so the game can skip leading silence without a
 *   re-encode (`voStartS` in `src/audio/manifests.ts`).
 *
 * Raw WAVs are not in git (about 90 MB, and every re-render churns them);
 * the Opus files and manifests are, so a fresh clone builds without `vo/out`
 * WAVs or ffmpeg. A take whose WAV is absent keeps its committed `.ogg`.
 * Needs ffmpeg on PATH only when a take changed. `deno task dev` and
 * `deno task build` run this first; run it alone with `deno task vo:sync`.
 */

import { measureOnset } from "./vo_onset.ts";

const SOURCE = "vo/out";
const TARGET = "public/vo";
/** Bump to re-encode everything after changing the recipe below. */
const RECIPE = "opus48k-v2-linear-normalized";
const TARGET_LUFS = -18;
/** Reactive lines (barks, chatter) sit under story lines. */
const AMBIENT_OFFSET_LU = -2;
const CEILING_DBTP = -1;
const BITRATE = "48k";
const WORKERS = 8;

interface Take {
  file: string;
  hash?: string;
  loudness?: { lufs: number; true_peak_dbtp: number; limited_db?: number };
  [key: string]: unknown;
}
interface Line {
  speaker: string;
  scene: string;
  langs: Record<string, Take>;
  [key: string]: unknown;
}
interface Cues {
  lines: Record<string, Line>;
  [key: string]: unknown;
}
interface Stamp {
  readonly key: string;
  readonly inputLufs: number;
  readonly inputTruePeak: number;
  /** Seconds of leading silence in the `.ogg`; absent until measured. */
  readonly onsetS?: number;
}

const exists = (p: string) => Deno.stat(p).then((s) => s.isFile, () => false);

function targetFor(id: string): number {
  return /^(amb|bark)_/.test(id)
    ? TARGET_LUFS + AMBIENT_OFFSET_LU
    : TARGET_LUFS;
}

async function ffmpeg(args: string[]): Promise<string> {
  const out = await new Deno.Command("ffmpeg", {
    args: ["-hide_banner", "-nostats", ...args],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(out.stderr);
  if (!out.success) throw new Error(`ffmpeg failed:\n${log.slice(-800)}`);
  return log;
}

/** Two-pass loudnorm, then Opus. Returns the measured input loudness. */
async function encode(
  wav: string,
  ogg: string,
  lufs: number,
  normalized?: Take["loudness"],
): Promise<{ inputLufs: number; inputTruePeak: number }> {
  const spec = `I=${lufs}:TP=${CEILING_DBTP}:LRA=20`;
  const known = normalized && Number.isFinite(normalized.lufs) &&
      Number.isFinite(normalized.true_peak_dbtp)
    ? normalized
    : undefined;
  const log = known ? "" : await ffmpeg([
    "-i",
    wav,
    "-af",
    `loudnorm=${spec}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  const m = known
    ? { input_i: known.lufs, input_tp: known.true_peak_dbtp }
    : JSON.parse(
      log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1),
    );
  const gainDb = known ? lufs - known.lufs : 0;
  // Render-time normalization already limited true peaks. Only protect a
  // genuinely over-ceiling input; never turn the limiter's auto-level on.
  const filter = known
    ? `volume=${gainDb}dB` +
      (known.true_peak_dbtp + gainDb > CEILING_DBTP
        ? `,alimiter=limit=${10 ** (-1.5 / 20)}:level=false`
        : "")
    : `loudnorm=${spec}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
      `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
      `:offset=${m.target_offset}:linear=true`;
  await ffmpeg([
    "-y",
    "-i",
    wav,
    "-af",
    filter,
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    BITRATE,
    "-map_metadata",
    "-1",
    ogg,
  ]);
  return { inputLufs: Number(m.input_i), inputTruePeak: Number(m.input_tp) };
}

const cues: Cues = JSON.parse(await Deno.readTextFile(`${SOURCE}/cues.json`));
const stampsPath = `${TARGET}/stamps.json`;
const stamps: Record<string, Stamp> = await exists(stampsPath)
  ? JSON.parse(await Deno.readTextFile(stampsPath))
  : {};
const nextStamps: Record<string, Stamp> = {};
const jobs: (() => Promise<void>)[] = [];
let kept = 0;
let encoded = 0;
let missing = 0;
let measured = 0;

for (const [id, line] of Object.entries(cues.lines)) {
  for (const [lang, take] of Object.entries(line.langs)) {
    const wav = `${SOURCE}/${take.file}`;
    const rel = take.file.replace(/\.wav$/, ".ogg");
    const ogg = `${TARGET}/${rel}`;
    const lufs = targetFor(id);
    const key = `${RECIPE}:${lufs}:${take.hash ?? "nohash"}:${
      JSON.stringify(take.loudness ?? null)
    }`;
    const old = stamps[rel];
    const haveOgg = await exists(ogg);
    take.file = rel;
    if (haveOgg && (old?.key === key || !(await exists(wav)))) {
      if (old?.onsetS !== undefined) {
        nextStamps[rel] = old;
        Object.assign(take, { inputLufs: old.inputLufs, onsetS: old.onsetS });
      } else {
        // Up to date, but measured before onsets existed: decode once.
        jobs.push(async () => {
          const onsetS = await measureOnset(ogg);
          if (old) nextStamps[rel] = { ...old, onsetS };
          Object.assign(take, old ? { inputLufs: old.inputLufs } : {});
          take.onsetS = onsetS;
          measured++;
        });
      }
      kept++;
      continue;
    }
    if (!(await exists(wav))) {
      delete line.langs[lang];
      missing++;
      continue;
    }
    jobs.push(async () => {
      await Deno.mkdir(ogg.slice(0, ogg.lastIndexOf("/")), { recursive: true });
      const loudness = await encode(wav, ogg, lufs, take.loudness);
      const onsetS = await measureOnset(ogg);
      nextStamps[rel] = { key, ...loudness, onsetS };
      take.inputLufs = loudness.inputLufs;
      take.onsetS = onsetS;
      encoded++;
    });
  }
}

await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) await job();
  }),
);

// Retired takes (deleted lines) must not linger in builds.
const wanted = new Set(Object.keys(nextStamps));
for (const line of Object.values(cues.lines)) {
  for (const take of Object.values(line.langs)) wanted.add(take.file);
}
for await (const dir of Deno.readDir(TARGET)) {
  // Variants are frozen assets, not stale base-language takes.
  if (!dir.isDirectory || !["en", "es", "zh"].includes(dir.name)) continue;
  for await (const f of Deno.readDir(`${TARGET}/${dir.name}`)) {
    const rel = `${dir.name}/${f.name}`;
    if (!wanted.has(rel)) await Deno.remove(`${TARGET}/${rel}`);
  }
}

// Voice variants are frozen takes (`scripts/extract_voice_variant.ts`), but
// their onsets are measured the same way, once, and kept in their index.
const variantsPath = `${TARGET}/variants/index.json`;
if (await exists(variantsPath)) {
  type VariantTake = { file: string; onsetS?: number };
  const index: {
    speakers: Record<
      string,
      { variants: Record<string, { lines: Record<string, Record<string, VariantTake>> }> }
    >;
  } = JSON.parse(await Deno.readTextFile(variantsPath));
  const pending: VariantTake[] = [];
  for (const speaker of Object.values(index.speakers)) {
    for (const variant of Object.values(speaker.variants)) {
      for (const langs of Object.values(variant.lines)) {
        for (const take of Object.values(langs)) {
          if (take.onsetS === undefined) pending.push(take);
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (let take = pending.shift(); take; take = pending.shift()) {
        take.onsetS = await measureOnset(`${TARGET}/${take.file}`);
        measured++;
      }
    }),
  );
  if (measured > 0) {
    // The index was written by Python with ASCII escapes; keep them, so a
    // measurement pass diffs as added fields rather than a rewrite.
    const ascii = JSON.stringify(index, null, 1).replace(
      /[\u007f-\uffff]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
    await Deno.writeTextFile(variantsPath, ascii + "\n");
  }
}

cues.loudness = {
  targetLufs: TARGET_LUFS,
  ambientOffsetLu: AMBIENT_OFFSET_LU,
  ceilingDbtp: CEILING_DBTP,
  recipe: RECIPE,
};
const sorted = Object.fromEntries(
  Object.entries(nextStamps).sort(([a], [b]) => a.localeCompare(b)),
);
await Deno.writeTextFile(stampsPath, JSON.stringify(sorted, null, 1) + "\n");
await Deno.writeTextFile(
  `${TARGET}/cues.json`,
  JSON.stringify(cues, null, 1) + "\n",
);
console.log(
  `vo:sync ${encoded} encoded, ${kept} up to date, ${missing} missing, ` +
    `${measured} onsets measured ` +
    `(no WAV, no Opus) -> ${TARGET}`,
);
