/**
 * Builds the shipped voice-over: `vo/out/` (the VO pipeline's raw WAV takes)
 * becomes `public/vo/`, where `src/audio/` looks:
 *
 * - `public/vo/<lang>/<id>.ogg`: Ogg Opus, mono, 48 kHz, loudness-normalized
 *   per line to -18 LUFS integrated with a -1 dBTP ceiling (barks and
 *   chatter sit 2 LU lower, under story lines). Two-pass `loudnorm`: pass one
 *   measures, pass two applies one linear gain, so a line's own dynamics
 *   (a shout inside a whisper) survive.
 * - `public/vo/cues.json`: `vo/out/cues.json` with each take's `file`
 *   pointing at its `.ogg`, plus the measured input loudness.
 * - `public/vo/stamps.json`: which render (the take's `hash` in cues.json)
 *   each `.ogg` came from, so a rerun only encodes changed takes.
 *
 * Raw WAVs are not in git (about 90 MB, and every re-render churns them);
 * the Opus files and manifests are, so a fresh clone builds without `vo/out`
 * WAVs or ffmpeg. A take whose WAV is absent keeps its committed `.ogg`.
 * Needs ffmpeg on PATH only when a take changed. `deno task dev` and
 * `deno task build` run this first; run it alone with `deno task vo:sync`.
 */

const SOURCE = "vo/out";
const TARGET = "public/vo";
/** Bump to re-encode everything after changing the recipe below. */
const RECIPE = "opus48k-v1";
const TARGET_LUFS = -18;
/** Reactive lines (barks, chatter) sit under story lines. */
const AMBIENT_OFFSET_LU = -2;
const CEILING_DBTP = -1;
const BITRATE = "48k";
const WORKERS = 8;

interface Take {
  file: string;
  hash?: string;
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
}

const exists = (p: string) =>
  Deno.stat(p).then((s) => s.isFile, () => false);

function targetFor(id: string): number {
  return /^(amb|bark)_/.test(id) ? TARGET_LUFS + AMBIENT_OFFSET_LU : TARGET_LUFS;
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
): Promise<{ inputLufs: number; inputTruePeak: number }> {
  const spec = `I=${lufs}:TP=${CEILING_DBTP}:LRA=20`;
  const log = await ffmpeg([
    "-i",
    wav,
    "-af",
    `loudnorm=${spec}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
  await ffmpeg([
    "-y",
    "-i",
    wav,
    "-af",
    `loudnorm=${spec}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
    `:offset=${m.target_offset}:linear=true`,
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

for (const [id, line] of Object.entries(cues.lines)) {
  for (const [lang, take] of Object.entries(line.langs)) {
    const wav = `${SOURCE}/${take.file}`;
    const rel = take.file.replace(/\.wav$/, ".ogg");
    const ogg = `${TARGET}/${rel}`;
    const lufs = targetFor(id);
    const key = `${RECIPE}:${lufs}:${take.hash ?? "nohash"}`;
    const old = stamps[rel];
    const haveOgg = await exists(ogg);
    take.file = rel;
    if (haveOgg && (old?.key === key || !(await exists(wav)))) {
      if (old) nextStamps[rel] = old;
      Object.assign(take, old ? { inputLufs: old.inputLufs } : {});
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
      const measured = await encode(wav, ogg, lufs);
      nextStamps[rel] = { key, ...measured };
      take.inputLufs = measured.inputLufs;
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
  if (!dir.isDirectory) continue;
  for await (const f of Deno.readDir(`${TARGET}/${dir.name}`)) {
    const rel = `${dir.name}/${f.name}`;
    if (!wanted.has(rel)) await Deno.remove(`${TARGET}/${rel}`);
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
  `vo:sync ${encoded} encoded, ${kept} up to date, ${missing} missing ` +
    `(no WAV, no Opus) -> ${TARGET}`,
);
