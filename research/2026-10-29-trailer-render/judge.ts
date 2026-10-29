/**
 * Blind trailer judge (one paid OpenRouter call per clip, ZDR enforced, no
 * fallbacks). The clip gets a neutral id and no facts about the game: the
 * model must first reconstruct what it saw and heard (ordered events,
 * verbatim speech with times, readable text, what the product is, the
 * question the trailer raises, uncertainty), and only then score the cut
 * against the craft concerns from research/2026-10-29-trailer-prep/README.md
 * section 2 and propose fixes. Schema order enforces reconstruction first.
 *
 *   deno run -A --no-lock research/2026-10-29-trailer-render/judge.ts teaser30 trailer90
 *
 * Writes judge/<clip>.json; appends one row per paid call to research/SPEND.md.
 */
const ROOT = new URL("../../", import.meta.url).pathname;
const HERE = new URL(".", import.meta.url).pathname;
const MODEL = "google/gemini-4-argon";
const BUDGET_USD = 1;

const CONCERNS: Record<string, { label: string; length: string; list: string[] }> = {
  teaser30: {
    label: "clip-A",
    length: "about 30 seconds",
    list: [
      "Hook: gameplay in frame 0; genre readable within 3 s; no logos up front.",
      "One idea that begs a question; every shot pulls its weight, no filler vistas.",
      "Music has shape: a ramp, a fakeout silence, the title on a hit, a closing button.",
      "Dialogue sits in musical troughs, never over a peak.",
      "Survives silent autoplay: burned captions, the joke readable muted.",
      "Captions are legible, timed to speech, at most two lines.",
      "Pacing: no shot overstays or is too short to read.",
    ],
  },
  trailer90: {
    label: "clip-B",
    length: "about 90 seconds",
    list: [
      "Hook within 6 s and the name within 10 s; at least 60% gameplay from the player's view.",
      "Text cards are specific to this game, not generic features, and are intercut rather than stacked on busy gameplay.",
      "Each mechanic shown has its visible result (receipt) inside its shot.",
      "No repeated shots or places; each section ends on something new.",
      "Story in seconds: lore never holds for more than a few seconds.",
      "The ending is not spoiled; any alternative path is teased, not resolved.",
      "Fragments work as standalone 1-second clips (store microtrailer).",
      "Clear call to action and where or how to play.",
      "Pacing: no section drags or rushes.",
    ],
  },
};

const PROMPT = (c: { length: string; list: string[] }) =>
  `You are an experienced game trailer editor reviewing a ${c.length} video cold. You have no other information about the product.

Step 1 (answer before judging): reconstruct the video. Give an ordered timeline of what happens on screen with timestamps (mm:ss), every line of speech you HEAR (timestamp, a guess at the speaker, the words verbatim; if you only read words in captions and cannot hear them, say so), all readable on-screen text, what you think the product is and how one would get it, the question the video makes you want answered, and what you are unsure about.

Step 2: score the video 1-5 against each of these concerns, with timestamped evidence:
${c.list.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Step 3: up to five specific fixes, each tied to a timestamp, with an honest cost (trivial: re-time or swap a shot or a card; small: new capture or new copy; large: new content). Prefer fixes that raise hook, clarity and pacing. Do not invent problems to fill the list.`;

const str = { type: "string" };
const obj = (props: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
});
const SCHEMA = obj({
  reconstruction: obj({
    timeline: { type: "array", items: obj({ t: str, what: str }) },
    heard_speech: {
      type: "array",
      items: obj({ t: str, speaker_guess: str, words: str, heard_or_read: { type: "string", enum: ["heard", "read only"] } }),
    },
    readable_text: { type: "array", items: obj({ t: str, text: str }) },
    product_guess: str,
    how_to_get_it: str,
    question_raised: str,
    uncertain: { type: "array", items: str },
  }),
  scores: { type: "array", items: obj({ concern: { type: "integer" }, score: { type: "integer" }, evidence: str }) },
  fixes: {
    type: "array",
    items: obj({ t: str, problem: str, fix: str, cost: { type: "string", enum: ["trivial", "small", "large"] } }),
  },
  overall: obj({ hook: { type: "integer" }, clarity: { type: "integer" }, pacing: { type: "integer" }, summary: str }),
});

function apiKey(): string {
  const env = Deno.env.get("OPENROUTER_API_KEY");
  if (env) return env;
  return JSON.parse(Deno.readTextFileSync(`${Deno.env.get("HOME")}/.local/share/opencode/auth.json`)).openrouter.key;
}

async function spent(): Promise<number> {
  const md = await Deno.readTextFile(`${ROOT}research/SPEND.md`);
  return md.split("\n").filter((l) => l.includes("trailer-render judge"))
    .reduce((n, l) => n + Number(l.split("|")[6] ?? 0), 0);
}

await Deno.mkdir(`${HERE}judge`, { recursive: true });
for (const cut of Deno.args) {
  const c = CONCERNS[cut];
  if ((await spent()) > BUDGET_USD - 0.15) throw new Error("trailer judge budget reached");
  const src = `${ROOT}trailer/out/${cut}/en/${cut}-en.mp4`;
  const small = await Deno.makeTempFile({ suffix: ".mp4" });
  const t = await new Deno.Command("ffmpeg", {
    args: ["-y", "-v", "error", "-i", src, "-vf", "scale=960:-2", "-r", "30", "-c:v", "libx264", "-crf", "26",
      "-preset", "fast", "-c:a", "aac", "-b:a", "128k", small],
  }).output();
  if (!t.success) throw new Error("transcode failed");
  const b = await Deno.readFile(small);
  await Deno.remove(small);
  const body = {
    model: MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PROMPT(c) },
        { type: "video_url", video_url: { url: `data:video/mp4;base64,${b.toBase64()}` } },
      ],
    }],
    response_format: { type: "json_schema", json_schema: { name: "trailer_review", strict: true, schema: SCHEMA } },
    usage: { include: true },
    max_tokens: 16000,
    provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
  };
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "X-Title": "neon-warden-aaaa trailer judge" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const out = await res.json().catch(() => ({}));
  const cost = Number(out?.usage?.cost ?? 0);
  if (res.ok || cost > 0) {
    await Deno.writeTextFile(
      `${ROOT}research/SPEND.md`,
      `| 2026-10-29 | trailer-render judge ${c.label} (${cut} EN master, blind, one call) | OpenRouter | ${MODEL} (ZDR, data_collection deny, no fallbacks; returned ${out?.provider ?? "?"}) | 1 | ${cost.toFixed(6)} | previous OpenRouter total + this row; task cap US $1; research/2026-10-29-trailer-render/judge/ |\n`,
      { append: true },
    );
  }
  const content = String(out?.choices?.[0]?.message?.content ?? "");
  let judgment: unknown = null;
  try {
    judgment = JSON.parse(content.trim().replace(/^```json/, "").replace(/```$/, ""));
  } catch { /* kept raw below */ }
  await Deno.writeTextFile(
    `${HERE}judge/${c.label}.json`,
    JSON.stringify({ clip: c.label, cut, model: MODEL, provider: out?.provider, costUsd: cost, wallS: (Date.now() - t0) / 1000,
      status: res.status, judgment, raw: judgment ? undefined : content.slice(0, 4000) || out }, null, 1),
  );
  console.log(`${c.label} (${cut}): HTTP ${res.status}, US$ ${cost.toFixed(4)}, ${judgment ? "parsed" : "UNPARSED"}`);
}
