/**
 * Blind check: Gemini 4 Argon (OpenRouter, ZDR only) watches each clip under
 * a neutral id and reconstructs what happens, then names empty screen
 * regions and dead time. No mechanics, script or production intent in the
 * prompt. The id-to-clip mapping lives in `../blind-key.json`, read only
 * after the answers are saved. Every paid call is logged in research/SPEND.md.
 *
 * Run from the repo root:
 *   deno run -A research/2026-10-29-warden-defeat/tools/blind.ts
 */

const DIR = "research/2026-10-29-warden-defeat";
const MODEL = "google/gemini-4-argon";
const BUDGET_USD = 0.5;
const KEY: Record<string, string> = JSON.parse(
  await Deno.readTextFile(`${DIR}/blind-key.json`),
);

const PROMPT = `You are watching a short clip (with sound) from a video game.
Watch and listen to all of it before answering. Do not guess the game's
title. Answer only from what is on screen and in the audio.

1. events: what happens, in order, with timestamps (seconds from clip start).
2. emptyRegions: moments where a large part of the screen (say a quarter or
   more) is empty, unused or visually dead. Give the time span, the region
   (left, right, top, bottom, centre, whole frame) and why it feels empty.
3. deadTime: stretches of 3 s or more where nothing meaningful changes on
   screen. Give spans and what, if anything, carries them (voice, music).
4. heard: sounds you hear (impacts, machinery, music, silence, voices) with
   timestamps. Do not transcribe speech word for word; say who seems to speak.
5. payoff: does the climax read as a consequence of something, and does it
   feel worth having played for? One or two sentences.
6. uncertainty: what you could not tell.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "events",
    "emptyRegions",
    "deadTime",
    "heard",
    "payoff",
    "uncertainty",
  ],
  properties: {
    events: { type: "array", items: span(["what"]) },
    emptyRegions: { type: "array", items: span(["region", "why"]) },
    deadTime: { type: "array", items: span(["carriedBy"]) },
    heard: { type: "array", items: span(["what"]) },
    payoff: { type: "string" },
    uncertainty: { type: "string" },
  },
};

function span(fields: string[]) {
  const props: Record<string, unknown> = {
    start: { type: "number" },
    end: { type: "number" },
  };
  for (const f of fields) props[f] = { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["start", "end", ...fields],
    properties: props,
  };
}

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

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

await Deno.mkdir(`${DIR}/judge`, { recursive: true });
let spent = 0;
for (const id of Object.keys(KEY).sort()) {
  const out = `${DIR}/judge/${id}.json`;
  try {
    await Deno.stat(out);
    console.log(`${id}: cached`);
    continue;
  } catch { /* not judged yet */ }
  if (spent >= BUDGET_USD) {
    console.log(`${id}: skipped, budget US $${BUDGET_USD} reached`);
    continue;
  }
  const video = await Deno.readFile(`${DIR}/clips/${KEY[id]}.mp4`);
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Title": "neon-warden-aaaa warden-defeat blind check",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          {
            type: "video_url",
            video_url: { url: `data:video/mp4;base64,${base64(video)}` },
          },
        ],
      }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "blind_clip", strict: true, schema },
      },
      usage: { include: true },
      max_tokens: 8000,
      // Zero data retention, no silent fallback to a retaining endpoint.
      provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
    }),
    signal: AbortSignal.timeout(600_000),
  });
  const body = await res.json().catch(() => ({}));
  const cost = Number(body?.usage?.cost ?? 0);
  spent += cost;
  // Log before parsing: a paid call is a paid call.
  if (cost > 0 || res.ok) {
    await Deno.writeTextFile(
      "research/SPEND.md",
      `| ${new Date().toISOString().slice(0, 10)} | warden-defeat blind ${id} | OpenRouter | ${MODEL} (ZDR) | 1 | ${
        cost.toFixed(4)
      } | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |\n`,
      { append: true },
    );
  }
  const text = body?.choices?.[0]?.message?.content ?? "";
  let answer: unknown = { error: `HTTP ${res.status}`, raw: body };
  try {
    answer = JSON.parse(text);
  } catch { /* keep the error record */ }
  await Deno.writeTextFile(
    out,
    JSON.stringify(
      {
        id,
        model: MODEL,
        provider: body?.provider ?? null,
        costUsd: cost,
        wallS: (Date.now() - t0) / 1000,
        answer,
      },
      null,
      2,
    ),
  );
  console.log(`${id}: US $${cost.toFixed(4)} in ${(Date.now() - t0) / 1000} s`);
}
console.log(`total this run: US $${spent.toFixed(4)}`);
