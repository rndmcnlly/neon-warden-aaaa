/**
 * Blind place-specificity test: one picture-only clip per call, neutral ids,
 * no captions, no production context. Run from the repository root:
 *
 *   deno run -A --no-lock research/2026-10-29-sector-worlds-v2/judge.ts
 *
 * Model google/gemini-4-argon via OpenRouter with mandatory ZDR and denied
 * data collection (no fallback). Each paid call is logged in research/SPEND.md
 * by the existing qa/judge.ts convention; the task budget is US $1.00.
 */
const here = new URL("./", import.meta.url).pathname;
const repo = new URL("../../", import.meta.url).pathname;
const MODEL = "google/gemini-4-argon";
const BUDGET = 1.0;

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

// Neutral ids, assigned by a fixed shuffle; the key is written separately.
const CLIPS = [
  ["K7", "after-s3"],
  ["B2", "before-s1"],
  ["Q4", "after-s1"],
  ["M9", "before-s4"],
  ["T1", "after-s5"],
  ["D6", "before-s2"],
  ["R3", "after-s2"],
  ["H8", "before-s5"],
  ["W5", "after-s4"],
  ["F0", "before-s3"],
  // Added after the Last Approach fix (8774627); a fresh id, same prompt.
  ["P2", "after2-s5"],
] as const;

const PROMPT =
  `You are watching a short silent screen recording from a video game. Do not guess what game it is.
Describe only what you can see in the environment around the central play area (the scenery at the sides, top and bottom), not the abstract play area itself.
Answer in this order:
1. place_kind: what kind of place is this? Be as specific as the images allow (for example "a harbor" is better than "an industrial area" only if you can see why).
2. activity: what is happening there, if anything? Name concrete motions you observe.
3. inhabitants: who works or lives here, if anyone? What suggests it?
4. readable_text: every piece of text you can actually read in the scenery (not the HUD), verbatim, with a timestamp. Empty list if none.
5. evidence: 3-8 timestamped observations (mm:ss) supporting your answers.
6. confidence: 0-1, how sure you are that this depicts a specific, functioning place rather than abstract decoration.
7. uncertainty: what you could not tell.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "place_kind",
    "activity",
    "inhabitants",
    "readable_text",
    "evidence",
    "confidence",
    "uncertainty",
  ],
  properties: {
    place_kind: { type: "string" },
    activity: { type: "string" },
    inhabitants: { type: "string" },
    readable_text: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["time", "text"],
        properties: { time: { type: "string" }, text: { type: "string" } },
      },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["time", "observation"],
        properties: {
          time: { type: "string" },
          observation: { type: "string" },
        },
      },
    },
    confidence: { type: "number" },
    uncertainty: { type: "string" },
  },
};

async function silentSmall(src: string, dst: string): Promise<void> {
  const out = await new Deno.Command("ffmpeg", {
    args: [
      "-y",
      "-loglevel",
      "error",
      "-i",
      src,
      "-an",
      "-vf",
      "scale='min(1366,iw)':-2",
      "-c:v",
      "libx264",
      "-crf",
      "26",
      "-preset",
      "veryfast",
      dst,
    ],
  }).output();
  if (!out.success) throw new Error(`ffmpeg failed for ${src}`);
}

const outDir = `${here}out/judge`;
await Deno.mkdir(outDir, { recursive: true });
// Endpoint discovery first (free): refuse to run without a ZDR endpoint.
const ep = await fetch(
  `https://openrouter.ai/api/v1/models/${MODEL}/endpoints`,
).then((r) => r.json());
await Deno.writeTextFile(`${outDir}/endpoints.json`, JSON.stringify(ep, null, 2));
let spent = 0;
const results: Record<string, unknown> = {};
for (const [id, clip] of CLIPS) {
  const cached = `${outDir}/${id}.json`;
  try {
    results[id] = JSON.parse(await Deno.readTextFile(cached));
    continue;
  } catch { /* not judged yet */ }
  if (spent >= BUDGET) {
    console.log("budget reached, stopping");
    break;
  }
  const mp4 = `${outDir}/${id}.mp4`;
  await silentSmall(`${here}out/${clip}-desktop/reel.mp4`, mp4);
  const bytes = await Deno.readFile(mp4);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Title": "neon-warden-aaaa sector worlds v2 blind place test",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          {
            type: "video_url",
            video_url: { url: `data:video/mp4;base64,${btoa(bin)}` },
          },
        ],
      }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "place_reading", strict: true, schema: SCHEMA },
      },
      usage: { include: true },
      max_tokens: 6000,
      provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
    }),
    signal: AbortSignal.timeout(600_000),
  });
  const body = await res.json().catch(() => ({}));
  const cost = Number(body?.usage?.cost ?? 0);
  spent += cost;
  let answer: unknown = null;
  try {
    answer = JSON.parse(body.choices[0].message.content);
  } catch { /* kept raw below */ }
  const record = {
    id,
    model: body.model,
    provider: body.provider,
    status: res.status,
    costUsd: cost,
    wallS: (Date.now() - t0) / 1000,
    answer,
    raw: answer ? undefined : body,
  };
  results[id] = record;
  await Deno.writeTextFile(cached, JSON.stringify(record, null, 2));
  console.log(id, res.status, cost.toFixed(4), body.provider);
}
await Deno.writeTextFile(
  `${outDir}/key.json`,
  JSON.stringify(Object.fromEntries(CLIPS), null, 2),
);
const total = Object.values(results).reduce(
  (n: number, r) => n + Number((r as { costUsd?: number }).costUsd ?? 0),
  0,
);
console.log(`total US$ ${total.toFixed(6)} this task (cached calls count once)`);
void repo;
