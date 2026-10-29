/**
 * In-context paired capture and blind AV comparison:
 * deno task qa:ab tutorial voice.tutorial_ai
 * deno task qa:ab gameplay-fight music.gameplay
 *
 * Both arms use the same seeded autopilot, fixed duration and settings at
 * real time (not fast-forwarded, which cuts speech). Browser/render timing
 * is not lockstep: seed and inputs match, pixels are not promised identical.
 * The judge sees only A/B, never casting identities, picks or preferences.
 * Raw recordings are hashed with the prompt/model for the paid-call cache.
 */
import { build, captureReel, launch, serve } from "./capture.ts";
import { type Reel, REELS } from "./reels.ts";
import { repo, timestamp, writeJson } from "./lib/common.ts";
import { canary } from "./lib/canary.ts";
import { scriptLines } from "./judge.ts";
import type { AvResult } from "./av.ts";

const MODEL = "google/gemini-4-argon";
const BUDGET = 3;
const PROMPT = `Compare these two clips, labeled A then B, from the same game
scene. They differ on one audio axis. Judge their fit in context, with music,
effects and voice together. Do not infer missing audio from subtitles.
First list the actual audible speech in each clip with timestamps (a hearing
canary), then compare intelligibility, musical/character fit, fatigue and
scene timing. Return JSON only: {"heard":{"A":[{"at":"0:00","text":"..."}],
"B":[{"at":"0:00","text":"..."}]},"winner":"A|B|tie",
"why":"short reason", "evidence":[{"clip":"A|B","at":"0:00",
"observation":"specific audible difference"}],"confidence":"low|medium|high"}.
Give at least three timestamped observations. An audible absence matters.
Ignore differences in loading time or rendering speed. Do not treat louder
as better. This is a provisional creative recommendation, not a human pick.`;

async function hash(parts: Uint8Array[]): Promise<string> {
  const all = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let pos = 0;
  for (const p of parts) {
    all.set(p, pos);
    pos += p.length;
  }
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", all))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function videoPart(path: string, dest: string) {
  const r = await new Deno.Command("ffmpeg", {
    args: [
      "-y",
      "-v",
      "error",
      "-i",
      path,
      "-vf",
      "scale=854:480",
      "-r",
      "12",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      dest,
    ],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
  const bytes = await Deno.readFile(dest);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return {
    type: "video_url",
    video_url: { url: `data:video/mp4;base64,${btoa(binary)}` },
  };
}

async function judge(
  dir: string,
  axis: string,
): Promise<Record<string, unknown>> {
  const paths = ["A", "B"].map((arm) => `${dir}/reels/${arm}/reel.mp4`);
  const prompt = `${PROMPT}\nAxis: ${
    axis.startsWith("voice.") ? "voice casting" : "music candidate"
  }.`;
  const key = await hash([
    ...await Promise.all(paths.map((p) => Deno.readFile(p))),
    new TextEncoder().encode(prompt + MODEL),
  ]);
  const cache = repo(`qa/.build/ab-cache/${key}.json`);
  try {
    return {
      ...JSON.parse(await Deno.readTextFile(cache)),
      cached: true,
      costUsd: 0,
    };
  } catch { /* cache miss */ }
  const ledger = repo("research/SPEND.md");
  const prior = await Deno.readTextFile(ledger);
  const spent = prior.split("\n").filter((l) => l.includes("B wave 4 A/B"))
    .reduce((n, l) => n + Number(l.split("|")[6]?.trim() ?? 0), 0);
  if (spent + 0.15 > BUDGET) throw new Error(`A/B budget exhausted: $${spent}`);
  const env = Deno.env.get("OPENROUTER_API_KEY");
  const apiKey = env ?? JSON.parse(
    await Deno.readTextFile(
      `${Deno.env.get("HOME")}/.local/share/opencode/auth.json`,
    ),
  ).openrouter.key;
  const parts = await Promise.all(
    paths.map((p, i) => videoPart(p, `${dir}/judge-${i}.mp4`)),
  );
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        provider: { zdr: true, data_collection: "deny" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "text", text: "Clip A" },
            parts[0],
            { type: "text", text: "Clip B" },
            parts[1],
          ],
        }],
        response_format: { type: "json_object" },
        usage: { include: true },
        max_tokens: 8000,
      }),
      signal: AbortSignal.timeout(600_000),
    },
  );
  const raw = await response.json();
  const cost = Number(raw.usage?.cost ?? 0);
  // Always account for a charged response, including malformed JSON output.
  if (response.ok || cost > 0) {
    const current = await Deno.readTextFile(ledger);
    const totals = current.split("\n").filter((l) =>
      l.includes("| OpenRouter |")
    );
    const total = Number(totals.at(-1)?.split("|")[7]?.trim() ?? 0) + cost;
    await Deno.writeTextFile(
      ledger,
      `| 2026-10-28 | B wave 4 A/B ${axis} | OpenRouter | ${MODEL} (ZDR) | 1 | ${
        cost.toFixed(4)
      } | ${total.toFixed(4)} |\n`,
      { append: true },
    );
  }
  if (!response.ok) throw new Error(JSON.stringify(raw));
  await writeJson(`${dir}/judge-response.json`, raw);
  const result = {
    ...JSON.parse(raw.choices[0].message.content),
    model: MODEL,
    hash: key,
    costUsd: cost,
    cached: false,
    blind: true,
    trust: "provisional: transcript supplied, no automated canary validation",
  };
  await Deno.mkdir(repo("qa/.build/ab-cache"), { recursive: true });
  await writeJson(cache, result);
  return result;
}

const [id, axis] = Deno.args;
const source = REELS.find((r) => r.id === id);
const choices = axis === "voice.tutorial_ai"
  ? ["original", "a_captain"]
  : axis === "music.gameplay"
  ? ["cand1", "cand2"]
  : null;
if (!source || !choices) {
  console.error(
    "usage: deno task qa:ab <reel> <voice.tutorial_ai|music.gameplay>",
  );
  Deno.exit(2);
}
const dir = repo(`qa/reports/ab-${timestamp()}-${id}`);
await Deno.mkdir(dir, { recursive: true });
await build(repo("qa/.build/ab-dist"));
const server = serve(repo("qa/.build/ab-dist"));
const browser = await launch();
try {
  const results = [];
  for (const [i, choice] of choices.entries()) {
    const arm = i === 0 ? "A" : "B";
    const query = new URLSearchParams(source.query.replace(/^\?/, ""));
    query.set(`v.${axis}`, choice);
    query.set("speed", "1");
    query.set("seed", "121");
    query.delete("dev");
    const reel: Reel = {
      ...source,
      id: arm,
      query: `?${query}`,
      maxSeconds: 35,
      steps: [{ do: "wait", ms: 24000 }, {
        do: "assertFrame",
        label: "paired scene renders",
      }],
    };
    console.error(`${id}: ${arm} = ${choice}`);
    results.push(
      await captureReel(browser, reel, server.url, dir, { randomSeed: 121 }),
    );
  }
  await writeJson(`${dir}/capture.json`, {
    axis,
    choices,
    seed: 121,
    speed: 1,
    results,
  });
} finally {
  await browser.close();
  await server.close();
}
const verdict = await judge(dir, axis);
// Check the blind judge's hearing against the actual captured VO, not the
// subtitles. Preserve failures visibly rather than laundering a verdict.
const script = await scriptLines();
const heard = verdict.heard as Record<string, { at: string; text: string }[]>;
const canaries = await Promise.all(["A", "B"].map(async (arm) => {
  const av: AvResult = JSON.parse(
    await Deno.readTextFile(`${dir}/reels/${arm}/av.json`),
  );
  const lines = (heard?.[arm] ?? []).map((line) => {
    const t = line.at.split(":").reduce((n, v) => n * 60 + Number(v), 0);
    return { start_s: t, end_s: t + 1, transcript: line.text };
  });
  return canary(lines, script, av.voAudible);
}));
verdict.canaries = { A: canaries[0], B: canaries[1] };
verdict.trust = canaries.every((c) => c.trusted)
  ? "hearing canary passed"
  : "UNTRUSTED: hearing canary failed";
await writeJson(`${dir}/judge.json`, verdict);
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
await Deno.writeTextFile(
  `${dir}/index.html`,
  `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>A/B ${id}</title>
<style>body{background:#10151d;color:#e7f1f5;font:16px system-ui;margin:24px}
main{display:flex;flex-wrap:wrap;gap:16px}section{flex:1;min-width:280px}video{width:100%}
pre{white-space:pre-wrap}button{padding:12px}</style><h1>${id}: ${axis}</h1>
<p>Same seed 121, real-time fight autopilot, same 24-second input script. Rendering is not lockstep.
Choices remain provisional. Original voice remains default, regardless of the judge.</p>
<button onclick="document.querySelectorAll('video').forEach(v=>{v.pause();v.currentTime=0})">Reset both</button>
<main>${
    choices.map((_, i) =>
      `<section><h2>${
        i ? "B" : "A"
      }</h2><video controls preload="metadata" src="reels/${
        i ? "B" : "A"
      }/reel.mp4"></video></section>`
    ).join("")
  }</main>
<details><summary>Reveal identities and blind judge</summary><p>A: ${
    choices[0]
  }; B: ${choices[1]}</p>
<pre>${escape(JSON.stringify(verdict, null, 2))}</pre></details>`,
);
console.log(`${dir}/index.html`);
console.log(JSON.stringify(verdict));
