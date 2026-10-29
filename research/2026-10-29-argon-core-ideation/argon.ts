/**
 * Two isolated Gemini Argon passes over the eight neutral clips.
 *
 * Pass A (blind): reconstruction only; no mechanics, no design goals, no
 * step 1 ideas. Pass B (ideation): a separate call that adds Adam's design
 * goals and a short mechanics glossary, still without step 1's list and
 * without Pass A's answer. OpenRouter with mandatory ZDR and data collection
 * denied; no provider fallback relaxes either.
 *
 * deno run -A --no-lock argon.ts a|b
 */

const pass = Deno.args[0];
if (pass !== "a" && pass !== "b") throw new Error("usage: argon.ts a|b");
const HERE = new URL(".", import.meta.url).pathname;
const MODEL = "google/gemini-4-argon";
const IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];

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

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const COMMON =
  "You will watch and listen to eight short clips, labeled A to H, of a " +
  "vertical-scrolling 3D shooter in a web browser, recorded at normal speed " +
  "with the game's own stereo mix. Each clip is independent. Timestamps are " +
  "seconds from the start of that clip.";

const PASS_A = `${COMMON}

Describe only what you can perceive. For each clip, in order:
1. events: an ordered list of moments, each with a timestamp (seconds,
   one decimal), what the player did (movement direction and speed changes,
   slow or precise movement, firing pattern: single shots, held continuous
   fire, larger or charged shots), what was hit (and which part of it, if you
   can tell), the visual feedback that signaled it and the sound you heard at
   that moment. Mark each moment with a channel: "seen", "heard" or "both",
   and a confidence from 0 to 1.
2. weak_or_ambiguous: what felt weak, unclear, mushy, missing or ambiguous in
   the feedback, with timestamps.
3. speech: every spoken word you hear, verbatim, with timestamps, or an empty
   list if there is no speech. Do not report on-screen text as speech.
4. onscreen_text: readable on-screen text that changes during the clip.
Do not guess the game's rules or names for mechanics; describe what happens.
If you cannot hear something, say so rather than inferring it from pictures.`;

const PASS_B = `${COMMON}

Context from the designer. The core verbs are MOVE and SHOOT to cause
DAMAGE. One fire button has three expressions: a short tap fires one precise
shot; holding it streams continuous fire; resting (not firing) charges a
"Writ", a heavier precise shot at level 1, 2 or 3 that is spent on the next
press. Enemies and the boss have breakable parts: breaking a weapon part
disarms that enemy (it stops firing and leaves), which also supports a
no-kill run. While the boss is talking or descending, shots are deflected.
Holding a focus button slows the ship for precision. The blue (or, at the
boss, red-orange) lane floor is the background the ship flies over.

The designer's goals:
- Discrete precise shots (taps) and Writs must feel deeply rewarding,
  rewarding players for not playing it like an arcade game (stream spam).
  Precision gets the richest payoff; stream stays serviceable but plainer.
- Physical disarming: broken parts should fling off along a direction and
  spin derived from the angle and point of impact (torque from hit offset,
  impulse along the shot, tumbling debris leaving the playfield), without
  creating new hazards or cluttering the bullet field.
- Damage must stay readable at density (many hits at once).
- Movement should be felt: movement sound and directional thruster puffs.
- The lane floor can carry much more activity (texture, traffic, signals,
  data flow, reflections) while still reading as background (value and
  saturation below combat).

Propose concrete audio-visual improvements in four areas: MOVE, SHOOT,
DAMAGE and LANE. Be specific: timings in milliseconds, sound layers
(transient, body, tail, frequency ranges, pitch behavior, voice limits),
shapes, sizes, colors relative to combat, particle counts, lifetimes and
motion. Cite the clips and timestamps that motivate each idea. Rank ideas by
expected payoff. Then list what NOT to do (anti-patterns that would hurt
readability, accessibility for photosensitive or motion-sensitive players,
low-end school Chromebook performance, or the precision-over-spam goal).`;

const SCHEMA_A = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          summary: { type: "string" },
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                t: { type: "number" },
                player_action: { type: "string" },
                hit: { type: "string" },
                visual: { type: "string" },
                sound: { type: "string" },
                channel: { type: "string", enum: ["seen", "heard", "both"] },
                confidence: { type: "number" },
              },
              required: [
                "t",
                "player_action",
                "hit",
                "visual",
                "sound",
                "channel",
                "confidence",
              ],
              additionalProperties: false,
            },
          },
          weak_or_ambiguous: {
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
          onscreen_text: { type: "array", items: { type: "string" } },
        },
        required: [
          "id",
          "summary",
          "events",
          "weak_or_ambiguous",
          "speech",
          "onscreen_text",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["clips"],
  additionalProperties: false,
};

const IDEA = {
  type: "object",
  properties: {
    rank: { type: "integer" },
    area: { type: "string", enum: ["MOVE", "SHOOT", "DAMAGE", "LANE"] },
    title: { type: "string" },
    what: { type: "string" },
    specifics: { type: "string" },
    evidence: { type: "string" },
    risk: { type: "string" },
    accessibility: { type: "string" },
  },
  required: [
    "rank",
    "area",
    "title",
    "what",
    "specifics",
    "evidence",
    "risk",
    "accessibility",
  ],
  additionalProperties: false,
};
const SCHEMA_B = {
  type: "object",
  properties: {
    ideas: { type: "array", items: IDEA },
    do_not: {
      type: "array",
      items: {
        type: "object",
        properties: { dont: { type: "string" }, why: { type: "string" } },
        required: ["dont", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas", "do_not"],
  additionalProperties: false,
};

const content: unknown[] = [{ type: "text", text: pass === "a" ? PASS_A : PASS_B }];
for (const id of IDS) {
  const bytes = await Deno.readFile(`${HERE}clips/clip-${id}.mp4`);
  content.push({ type: "text", text: `Clip ${id}:` });
  content.push({
    type: "video_url",
    video_url: { url: `data:video/mp4;base64,${b64(bytes)}` },
  });
}
const body = {
  model: MODEL,
  messages: [{ role: "user", content }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: pass === "a" ? "blind_reconstruction" : "av_ideation",
      strict: true,
      schema: pass === "a" ? SCHEMA_A : SCHEMA_B,
    },
  },
  usage: { include: true },
  max_tokens: 24000,
  provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
};
const t0 = Date.now();
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "X-Title": "neon-warden-aaaa argon core ideation",
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(900_000),
});
const raw = await res.text();
await Deno.mkdir(`${HERE}out`, { recursive: true });
await Deno.writeTextFile(`${HERE}out/pass-${pass}.response.json`, raw);
const out = JSON.parse(raw);
const text = out?.choices?.[0]?.message?.content ?? "";
try {
  await Deno.writeTextFile(
    `${HERE}out/pass-${pass}.json`,
    JSON.stringify(JSON.parse(text), null, 1),
  );
} catch {
  console.error("content was not JSON; raw response kept");
}
console.log(JSON.stringify({
  status: res.status,
  provider: out?.provider,
  model: out?.model,
  cost: out?.usage?.cost,
  tokens: [out?.usage?.prompt_tokens, out?.usage?.completion_tokens],
  wallS: (Date.now() - t0) / 1000,
  finish: out?.choices?.[0]?.finish_reason,
  error: out?.error,
}));
