/**
 * Blind before/after judge for night verification (night plan step 5).
 *
 * Pass A: one call per clip, the identical prompt for every clip (no topic,
 * arm or revision named): reconstruct events in a fixed vocabulary with
 * timestamps, channel and confidence. Pass B: one call per pair, clips
 * labeled X and Y in a balanced random order (out/key.json), the identical
 * comparison checklist for every pair. Pass B never sees Pass A.
 *
 * OpenRouter `google/gemini-4-argon`, ZDR required, data collection denied,
 * no provider fallback.
 *
 * deno run -A --no-lock judge.ts a|b
 */

const pass = Deno.args[0];
if (pass !== "a" && pass !== "b") throw new Error("usage: judge.ts a|b");
const HERE = new URL(".", import.meta.url).pathname;
const OUT = `${HERE}out/judge`;
const MODEL = "google/gemini-4-argon";
const BUDGET = 0.8;

function apiKey(): string {
  const env = Deno.env.get("OPENROUTER_API_KEY");
  if (env) return env;
  const auth = JSON.parse(
    Deno.readTextFileSync(`${Deno.env.get("HOME")}/.local/share/opencode/auth.json`),
  );
  return auth.openrouter.key;
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const GLOSSARY =
  "Context, the same for every clip: a vertical-scrolling 3D shooter in a web " +
  "browser, recorded at normal speed with the game's own stereo mix (voice is " +
  "muted). The player ship can fire single taps, a held continuous stream, or " +
  "a charged shot released after resting; charged shots come in strengths 1 " +
  "to 3. A small enemy can be destroyed, or disarmed: its weapon part breaks " +
  "off and the enemy survives, harmless, and leaves. The large boss has pods " +
  "or parts that can be broken off it. Some shots bounce off armor. The " +
  "player can lose a life. Not every clip contains every kind of event.";

const EVENT_TYPES = [
  "direction_change",
  "focus_or_slow_mode",
  "tap_shot",
  "stream_fire",
  "charged_release",
  "charged_hit",
  "charged_miss",
  "hull_hit",
  "deflect_off_armor",
  "enemy_part_broken_off",
  "enemy_disarmed",
  "enemy_destroyed",
  "boss_part_broken_off",
  "life_lost",
  "other",
];

const PASS_A = `${GLOSSARY}

Watch and listen to the one clip. Timestamps are seconds from the clip's
start (one decimal). Report only what you perceive:
1. events: every moment that fits one of the event types, in order, with
   the strength (1, 2 or 3) for charged shots or 0 if you cannot tell or it
   does not apply, what was hit, the evidence (what you saw and heard), the
   channel (seen, heard, both) and a confidence from 0 to 1. When you are
   unsure whether an enemy was destroyed or disarmed, give your best guess
   with low confidence rather than skipping it.
2. readability_issues: moments where combat was hard to read (bullets hard
   to see, debris or effects that could be mistaken for bullets, background
   competing with combat, sounds masking each other), with timestamps.
3. speech: every spoken word you hear, verbatim, with timestamps, or an
   empty list. Do not report on-screen text as speech.
If you cannot hear something, say so rather than inferring it from pictures.`;

const CHECKLIST = [
  "ship movement, direction changes and slow or focus mode",
  "a single tap shot hitting",
  "an enemy disarmed versus destroyed",
  "a charged shot's strength (1 to 3)",
  "a charged shot hitting versus missing",
  "shots bouncing off armor",
  "a boss part breaking off",
  "the player losing a life",
  "many hits at once (which hit did what)",
];

const PASS_B = `${GLOSSARY}

You will watch and listen to two clips, X then Y, from two builds of the
same game. They show similar but not identical moments. Timestamps are
seconds from each clip's start.
1. per_event: for each checklist item, which clip communicates it better
   (X, Y, same, or not_present when neither clip shows it), why (what you saw
   and heard, with timestamps), and a confidence from 0 to 1. Checklist:
${CHECKLIST.map((c, i) => `   ${i + 1}. ${c}`).join("\n")}
2. clutter: any readability loss in either clip: enemy bullets harder to
   see, debris or effects mistaken for bullets, the floor or background
   competing with combat, sounds masking threat cues. Clip, timestamp,
   issue and severity (low, medium, high).
3. overall: which clip is easier to read as combat (X, Y or same), and why.`;

const SCHEMA_A = {
  type: "object",
  properties: {
    summary: { type: "string" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          type: { type: "string", enum: EVENT_TYPES },
          strength: { type: "integer" },
          target: { type: "string" },
          evidence: { type: "string" },
          channel: { type: "string", enum: ["seen", "heard", "both"] },
          confidence: { type: "number" },
        },
        required: ["t", "type", "strength", "target", "evidence", "channel", "confidence"],
        additionalProperties: false,
      },
    },
    readability_issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          issue: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["t", "issue", "confidence"],
        additionalProperties: false,
      },
    },
    speech: {
      type: "array",
      items: {
        type: "object",
        properties: { t: { type: "number" }, words: { type: "string" } },
        required: ["t", "words"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "events", "readability_issues", "speech"],
  additionalProperties: false,
};

const SCHEMA_B = {
  type: "object",
  properties: {
    per_event: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "integer" },
          better: { type: "string", enum: ["X", "Y", "same", "not_present"] },
          why: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["item", "better", "why", "confidence"],
        additionalProperties: false,
      },
    },
    clutter: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: { type: "string", enum: ["X", "Y"] },
          t: { type: "number" },
          issue: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["clip", "t", "issue", "severity"],
        additionalProperties: false,
      },
    },
    overall: {
      type: "object",
      properties: {
        better: { type: "string", enum: ["X", "Y", "same"] },
        why: { type: "string" },
      },
      required: ["better", "why"],
      additionalProperties: false,
    },
  },
  required: ["per_event", "clutter", "overall"],
  additionalProperties: false,
};

const video = async (id: string) => ({
  type: "video_url",
  video_url: {
    url: `data:video/mp4;base64,${b64(await Deno.readFile(`${HERE}out/clips/${id}.mp4`))}`,
  },
});

async function call(name: string, content: unknown[], schema: object, schemaName: string) {
  const body = {
    model: MODEL,
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema },
    },
    usage: { include: true },
    max_tokens: 12000,
    provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
  };
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Title": "neon-warden-aaaa night verification",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const raw = await res.text();
  await Deno.writeTextFile(`${OUT}/${name}.response.json`, raw);
  const out = JSON.parse(raw);
  const text = out?.choices?.[0]?.message?.content ?? "";
  let ok = false;
  try {
    await Deno.writeTextFile(`${OUT}/${name}.json`, JSON.stringify(JSON.parse(text), null, 1));
    ok = true;
  } catch {
    console.error(`${name}: content was not JSON; raw response kept`);
  }
  const meta = {
    name,
    ok,
    status: res.status,
    provider: out?.provider,
    model: out?.model,
    cost: out?.usage?.cost ?? 0,
    tokens: [out?.usage?.prompt_tokens, out?.usage?.completion_tokens],
    wallS: (Date.now() - t0) / 1000,
    finish: out?.choices?.[0]?.finish_reason,
    error: out?.error,
  };
  console.log(JSON.stringify(meta));
  return meta;
}

await Deno.mkdir(OUT, { recursive: true });
const key = JSON.parse(await Deno.readTextFile(`${HERE}out/key.json`));
const jobs: (() => Promise<{ cost: number }>)[] = [];
if (pass === "a") {
  for (const c of key.clips) {
    if (c.missing) continue;
    jobs.push(async () =>
      call(`a-${c.id}`, [{ type: "text", text: PASS_A }, { type: "text", text: "Clip:" }, await video(c.id)], SCHEMA_A, "blind_events")
    );
  }
} else {
  key.pairs.forEach((p: { X: string; Y: string }, i: number) => {
    jobs.push(async () =>
      call(`b-pair${i + 1}`, [
        { type: "text", text: PASS_B },
        { type: "text", text: "Clip X:" },
        await video(p.X),
        { type: "text", text: "Clip Y:" },
        await video(p.Y),
      ], SCHEMA_B, "pair_compare")
    );
  });
}

// Four at a time; stop launching if the pass nears its budget.
let spent = 0;
const metas: unknown[] = [];
for (let i = 0; i < jobs.length; i += 4) {
  if (spent > BUDGET) {
    console.error(`budget guard: stopped at ${spent.toFixed(4)}`);
    break;
  }
  const batch = await Promise.all(jobs.slice(i, i + 4).map((j) => j()));
  for (const m of batch) {
    spent += m.cost;
    metas.push(m);
  }
}
await Deno.writeTextFile(`${OUT}/pass-${pass}-meta.json`, JSON.stringify({ spent, calls: metas }, null, 1));
console.log(`pass ${pass}: ${metas.length} calls, US $${spent.toFixed(6)}`);
