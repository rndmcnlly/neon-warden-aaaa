/**
 * The AV judge: an omni model watches and listens to one reel and scores it
 * against a rubric for the reel's topic. Paid and opt-in.
 *
 *   deno task qa:judge boss menus-en          # reels of qa/reports/latest
 *   deno run -A --no-lock qa/judge.ts --report=qa/reports/<stamp> boss
 *   options: --model=google/gemini-4-argon  --force (ignore the cache)
 *
 * Design, for students reading this (research/2026-10-28-omni-judges/):
 *
 * - Listen first. Before any score the model must list what it HEARS: every
 *   voice line with times and a verbatim transcript, whether music and SFX
 *   exist at all. That transcript is a canary: weaker omni models "hear"
 *   the subtitles they read. We diff it against vo/script.yaml and against
 *   the VO the capture actually played (ffmpeg silence detection on the VO
 *   stem, qa/av.ts). A judgment that fails the canary is kept but marked
 *   untrusted, and the dashboard greys it out.
 * - Evidence with timestamps, schema enforced by the API (strict
 *   json_schema), so no regex scraping.
 * - Zero data retention: requests go only to ZDR endpoints (Gemini on
 *   Vertex), and the account enforces it too. Unreleased work stays put.
 * - Cost: cached by a hash of the reel's bytes, the prompt and the model, so
 *   re-running costs nothing; every paid call appends a row to
 *   research/SPEND.md, and a wave budget stops the judge before it passes.
 */

import { parse as parseYaml } from "jsr:@std/yaml@1";
import { repo, ROOT, writeJson } from "./lib/common.ts";
import { type Canary, canary, type ScriptLine } from "./lib/canary.ts";
import type { Topic } from "./reels.ts";
import { REELS } from "./reels.ts";
import type { AvResult } from "./av.ts";

export const DEFAULT_MODEL = "google/gemini-4-argon";
/** Wave 3 cap for QA judging on OpenRouter, US$ (Adam, docs/WAVE3.md brief). */
export const WAVE_BUDGET_USD = 4;
/** Rows this module writes to SPEND.md start with this, so the budget can sum them. */
const LEDGER_TAG = "Q qa:judge";
const CACHE = repo("qa/.build/judge-cache");
/** Bump when the prompt or schema changes meaningfully (invalidates the cache). */
const PROMPT_VERSION = 1;

// -- rubrics: one per topic, each criterion scored 1–5 with evidence

const AV_CORE: Record<string, string> = {
  av_sync:
    "Audio-visual sync: do sounds and voice line up with on-screen events, subtitles and cuts?",
  mix_balance:
    "Mix balance: VO vs music vs SFX levels, clarity, ducking, clipping, dead air.",
  polish_vs_aaa: "Overall audiovisual polish compared with a shipped AAA game.",
};

export const RUBRICS: Record<Topic, Record<string, string>> = {
  menus: {
    ui_sfx:
      "UI sound: do focus, confirm, back and tab changes each have a fitting, consistent sound?",
    music_fit: "Menu music: present, on-tone (cyberpunk), loops cleanly?",
    readability:
      "Readability and hierarchy of the menus at 720p: contrast, grouping, what is selected.",
    transitions: "Screen transitions: motion, timing, and sound together.",
    ...AV_CORE,
  },
  accessibility: {
    subtitle_sync:
      "Subtitles appear, change and leave in time with the voice; the highlighted word (if any) tracks speech.",
    subtitle_legibility:
      "Subtitle size, background, speaker names and line length are legible over gameplay.",
    vo_intelligibility:
      "Voice is intelligible over music and SFX (ducking, EQ, level).",
    comfort:
      "Reduced flashing and no shake are honored: no strobes or camera shake on screen.",
    ...AV_CORE,
  },
  cinematics: {
    sfx_fit:
      "SFX fit: do weapon, hit, explosion and UI sounds exist where the picture implies them, and suit the style?",
    music_fit:
      "Music fit: is there a score, and does it suit the scene's energy and the cyberpunk tone?",
    vo_performance: "VO performance: delivery, character fit, intelligibility.",
    ...AV_CORE,
  },
  gameplay: {
    feedback_feel:
      "Game feel: does every player action (fire, hit, lock, kill, graze, pickup) read instantly in picture AND sound?",
    readability:
      "Shmup readability: bullets, player, enemies and threats distinguishable at a glance.",
    sfx_fit:
      "SFX fit and variety: weapons, impacts and enemy fire suit the style without fatigue.",
    music_fit: "Music fit: energy and tone match the action.",
    ...AV_CORE,
  },
  endings: {
    tone:
      "Tone: does the ending land morally gray, sound and picture together?",
    vo_performance: "VO performance: delivery, character fit, intelligibility.",
    music_fit: "Music fit for the ending's emotional turn.",
    pacing: "Pacing: holds, silences and cuts serve the beat (not dead air).",
    ...AV_CORE,
  },
  audio: {
    spatial_image:
      "Spatial image: do enemies, shots and passes sound where they are on screen (panning, doppler, near-miss whooshes)?",
    sfx_fit:
      "SFX fit: do the sounds suit what the picture shows and the cyberpunk style?",
    vo_performance:
      "VO: every subtitled line is heard, delivered well and intelligible.",
    music_fit: "Music fit: present and appropriate.",
    ...AV_CORE,
  },
};

function schema(criteria: string[]) {
  const span = {
    type: "object",
    additionalProperties: false,
    required: ["start_s", "end_s"],
    properties: { start_s: { type: "number" }, end_s: { type: "number" } },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["inventory", "scores", "fixes", "summary"],
    properties: {
      inventory: {
        type: "object",
        additionalProperties: false,
        required: [
          "vo_lines",
          "music_present",
          "sfx_present",
          "silent_spans",
          "notes",
        ],
        properties: {
          vo_lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["start_s", "end_s", "transcript", "voice"],
              properties: {
                start_s: { type: "number" },
                end_s: { type: "number" },
                transcript: { type: "string" },
                voice: { type: "string" },
              },
            },
          },
          music_present: { type: "boolean" },
          sfx_present: { type: "boolean" },
          silent_spans: { type: "array", items: span },
          notes: { type: "string" },
        },
      },
      scores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["criterion", "score", "justification", "evidence_s"],
          properties: {
            criterion: { type: "string", enum: criteria },
            score: { type: "integer", minimum: 1, maximum: 5 },
            justification: { type: "string" },
            evidence_s: { type: "array", items: { type: "number" } },
          },
        },
      },
      fixes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["at_s", "fix", "discipline"],
          properties: {
            at_s: { type: "number" },
            fix: { type: "string" },
            discipline: {
              type: "string",
              enum: [
                "sound design",
                "music",
                "mix",
                "VO",
                "animation",
                "UI",
                "VFX",
                "camera",
                "accessibility",
                "other",
              ],
            },
          },
        },
      },
      summary: { type: "string" },
    },
  };
}

function prompt(
  title: string,
  rubric: Record<string, string>,
  context: string,
): string {
  const list = Object.entries(rubric).map(([k, d]) => `- ${k}: ${d}`).join(
    "\n",
  );
  return `You are an audio director and game QA lead reviewing a capture from a 3D shoot-'em-up vertical slice.
Reel: ${title}. The video includes its full game audio track. Judge sound and picture together.

First, take inventory of what you actually HEAR: every voice line with start and end time in seconds
and a verbatim transcript, whether any music plays, whether any sound effects play, and the spans of
silence longer than 2 s. Do not infer sound from the picture or from on-screen subtitles; if you hear
nothing, say so.

Then score each criterion 1-5 (5 = shippable AAA, 1 = absent or broken) with a justification that
cites timestamps:
${list}
A criterion whose element is absent scores 1 and says so, unless the production context below says
it is absent by plan, in which case score what is present and say what is planned.

Then list exactly 5 concrete fixes, highest impact first, each with a timestamp in seconds.
Production context: ${context}`;
}

// -- inputs: production context and the script

async function productionContext(): Promise<string> {
  const notes: string[] = [];
  for (
    const [name, path] of [
      ["music cues", "public/music/manifest.json"],
      ["sfx roles", "public/sfx/manifest.json"],
    ]
  ) {
    try {
      const m = JSON.parse(await Deno.readTextFile(repo(path)));
      const table = (m.cues ?? m.roles ?? m) as Record<string, unknown>;
      const vals = Object.values(table);
      const missing = vals.filter((v) => v === null).length;
      notes.push(`${missing} of ${vals.length} ${name} are still unpicked`);
    } catch {
      notes.push(`no ${name} manifest`);
    }
  }
  return `${
    notes.join("; ")
  }. Sound that is absent for that reason is planned, not broken. Reels may run the game faster than real time (autoplay), so voice lines can cut each other short.`;
}

let scriptCache: ScriptLine[] | null = null;

/** Every spoken line in every language, from vo/script.yaml. */
export async function scriptLines(): Promise<ScriptLine[]> {
  if (scriptCache) return scriptCache;
  const doc = parseYaml(await Deno.readTextFile(repo("vo/script.yaml"))) as {
    lines?: Record<string, unknown>[];
  };
  scriptCache = [];
  for (const l of doc.lines ?? []) {
    for (const lang of ["en", "es", "zh"]) {
      if (typeof l[lang] === "string") {
        scriptCache.push({ id: String(l.id), lang, text: String(l[lang]) });
      }
    }
  }
  return scriptCache;
}

// -- one call

function apiKey(): string {
  const env = Deno.env.get("OPENROUTER_API_KEY");
  if (env) return env;
  const auth = JSON.parse(
    Deno.readTextFileSync(
      `${Deno.env.get("HOME")}/.local/share/opencode/auth.json`,
    ),
  );
  return auth.openrouter.key;
}

async function sha256(...parts: (string | Uint8Array)[]): Promise<string> {
  const enc = new TextEncoder();
  const chunks = parts.map((p) => typeof p === "string" ? enc.encode(p) : p);
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) all.set(c, (o += c.length) - c.length);
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("").slice(
    0,
    24,
  );
}

/** 854x480, 12 fps, mono AAC: a minute stays under about 4 MB; Gemini samples about 1 fps. */
async function transcode(src: string, dst: string): Promise<void> {
  const r = await new Deno.Command("ffmpeg", {
    args: [
      "-y",
      "-v",
      "error",
      "-i",
      src,
      "-vf",
      "scale=854:-2",
      "-r",
      "12",
      "-c:v",
      "libx264",
      "-crf",
      "30",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ac",
      "1",
      dst,
    ],
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
}

export interface Judgment {
  readonly reel: string;
  readonly model: string;
  readonly topic: Topic;
  readonly hash: string;
  readonly cached: boolean;
  readonly costUsd: number;
  readonly wallS: number;
  readonly error?: string;
  readonly judgment?: {
    inventory: {
      vo_lines: {
        start_s: number;
        end_s: number;
        transcript: string;
        voice: string;
      }[];
      music_present: boolean;
      sfx_present: boolean;
      silent_spans: { start_s: number; end_s: number }[];
      notes: string;
    };
    scores: {
      criterion: string;
      score: number;
      justification: string;
      evidence_s: number[];
    }[];
    fixes: { at_s: number; fix: string; discipline: string }[];
    summary: string;
  };
  readonly mean?: number;
  readonly canary?: Canary;
}

/** Sum of this module's SPEND.md rows (the wave's judge spend so far). */
async function spentSoFar(): Promise<number> {
  const md = await Deno.readTextFile(repo("research/SPEND.md"));
  let sum = 0;
  for (const line of md.split("\n")) {
    if (!line.includes(LEDGER_TAG)) continue;
    const cells = line.split("|").map((c) => c.trim());
    sum += Number(cells[6]) || 0;
  }
  return sum;
}

async function ledger(
  reel: string,
  model: string,
  cost: number,
  seconds: number,
) {
  const md = await Deno.readTextFile(repo("research/SPEND.md"));
  const rows = md.split("\n").filter((l) => /^\|.*OpenRouter/.test(l));
  const last = rows.at(-1)?.split("|").map((c) => c.trim());
  const running = (Number(last?.[7]) || 0) + cost;
  const date = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
  const row = `| ${date} | ${LEDGER_TAG} ${reel} (${
    seconds.toFixed(0)
  } s reel) | OpenRouter | ${model} (ZDR, Vertex) | 1 | ${cost.toFixed(3)} | ${
    running.toFixed(2)
  } |`;
  await Deno.writeTextFile(
    repo("research/SPEND.md"),
    md.trimEnd() + "\n" + row + "\n",
  );
}

/**
 * Judges `<reportDir>/reels/<id>/reel.mp4`, writing `judge.json` beside it.
 * Hits the cache when the same bytes, prompt and model were judged before.
 */
export async function judgeReel(
  reportDir: string,
  id: string,
  opts: { model?: string; force?: boolean } = {},
): Promise<Judgment> {
  const model = opts.model ?? DEFAULT_MODEL;
  const reel = REELS.find((r) => r.id === id);
  if (!reel) throw new Error(`unknown reel ${id}`);
  const dir = `${reportDir}/reels/${id}`;
  const mp4 = `${dir}/reel.mp4`;
  const bytes = await Deno.readFile(mp4);
  const rubric = RUBRICS[reel.topic];
  const context = await productionContext();
  const text = prompt(reel.title, rubric, context);
  const hash = await sha256(bytes, text, model, String(PROMPT_VERSION));
  const av: AvResult | null = await Deno.readTextFile(`${dir}/av.json`).then(
    JSON.parse,
    () => null,
  );
  const audible = av?.voStem ? av.voAudible : [];
  const seconds = av ? (await mp4Seconds(mp4)) : 60;

  const finish = async (j: Judgment) => {
    await writeJson(`${dir}/judge.json`, j);
    return j;
  };

  await Deno.mkdir(CACHE, { recursive: true });
  const cacheFile = `${CACHE}/${hash}.json`;
  if (!opts.force) {
    const hit = await Deno.readTextFile(cacheFile).then(JSON.parse, () => null);
    if (hit) return await finish({ ...hit, cached: true, costUsd: 0 });
  }

  const estimate = 0.05 * Math.max(1, seconds / 60);
  const spent = await spentSoFar();
  if (spent + estimate > WAVE_BUDGET_USD) {
    return await finish({
      reel: id,
      model,
      topic: reel.topic,
      hash,
      cached: false,
      costUsd: 0,
      wallS: 0,
      error: `wave budget: US$${
        spent.toFixed(2)
      } spent of ${WAVE_BUDGET_USD}; not calling`,
    });
  }

  const tmp = await Deno.makeTempDir();
  const small = `${tmp}/reel.mp4`;
  await transcode(mp4, small);
  const b = await Deno.readFile(small);
  await Deno.remove(tmp, { recursive: true });
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) {
    bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  }
  const body = {
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text },
        {
          type: "video_url",
          video_url: { url: `data:video/mp4;base64,${btoa(bin)}` },
        },
      ],
    }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "av_judgment",
        strict: true,
        schema: schema(Object.keys(rubric)),
      },
    },
    usage: { include: true },
    max_tokens: 16000,
    provider: { zdr: true, data_collection: "deny" },
  };
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Title": "neon-warden-aaaa qa judge",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const wallS = Math.round((Date.now() - t0) / 100) / 10;
  const out = await res.json().catch(() => ({}));
  const cost = Number(out?.usage?.cost ?? 0);
  // Log before anything else can throw: a paid call is a paid call.
  if (res.ok || cost > 0) await ledger(id, model, cost, seconds);
  const base = {
    reel: id,
    model,
    topic: reel.topic,
    hash,
    cached: false,
    costUsd: cost,
    wallS,
  };
  if (!res.ok || !out.choices) {
    return await finish({
      ...base,
      error: `HTTP ${res.status}: ${
        JSON.stringify(out?.error ?? out).slice(0, 300)
      }`,
    });
  }
  const content = String(out.choices[0].message?.content ?? "");
  let judgment: Judgment["judgment"];
  try {
    judgment = JSON.parse(
      content.trim().replace(/^```json/, "").replace(/```$/, ""),
    );
  } catch {
    return await finish({
      ...base,
      error: `unparsed: ${content.slice(0, 300)}`,
    });
  }
  const scores = judgment!.scores.map((s) => s.score);
  const mean = Math.round(
    (scores.reduce((a, c) => a + c, 0) / Math.max(1, scores.length)) * 100,
  ) / 100;
  const result: Judgment = {
    ...base,
    judgment,
    mean,
    canary: canary(judgment!.inventory.vo_lines, await scriptLines(), audible),
  };
  await writeJson(cacheFile, result);
  return await finish(result);
}

async function mp4Seconds(file: string): Promise<number> {
  const out = await new Deno.Command("ffprobe", {
    args: [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ],
    stdout: "piped",
    stderr: "null",
  }).output();
  return Number(new TextDecoder().decode(out.stdout).trim()) || 60;
}

// -- CLI: judge reels of an existing report, then rebuild its dashboard

if (import.meta.main) {
  const { rebuildReport } = await import("./report.ts");
  const opt = (n: string) =>
    Deno.args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
  const ids = Deno.args.filter((a) => !a.startsWith("--"));
  const rel = opt("report") ??
    (await Deno.readTextFile(repo("qa/reports/latest.txt"))).trim();
  const dir = rel.startsWith("/") ? rel : `${ROOT}/${rel}`;
  const present = [];
  for await (const e of Deno.readDir(`${dir}/reels`)) present.push(e.name);
  const want = ids.includes("all") ? present : ids;
  if (!want.length) {
    console.error(
      `usage: qa/judge.ts [--report=<dir>] [--model=<id>] [--force] <reel ids|all>; reels here: ${
        present.join(", ")
      }`,
    );
    Deno.exit(2);
  }
  for (const id of want) {
    if (!present.includes(id)) {
      console.error(`${id}: not in ${rel}; run deno task qa:reel ${id} first`);
      continue;
    }
    const j = await judgeReel(dir, id, {
      model: opt("model"),
      force: Deno.args.includes("--force"),
    });
    console.log(
      `${id}: ${
        j.error ??
          `mean ${j.mean} ${
            j.canary?.trusted ? "trusted" : "UNTRUSTED"
          } (${j.canary?.detail})`
      }, ${j.cached ? "cached" : `US$${j.costUsd.toFixed(3)}, ${j.wallS} s`}`,
    );
  }
  await rebuildReport(dir, rel.replace(`${ROOT}/`, ""));
  console.log(`dashboard: ${rel}/index.html`);
}
