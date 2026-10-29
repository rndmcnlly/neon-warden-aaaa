/**
 * Three isolated, text-only judge passes over OUTLINE.md, each primed with one
 * set of web-anchored concerns (see README.md, "Concerns"). Same model, three
 * independent passes: not a diverse-model consensus and not human reviewers.
 *
 * Run: deno run -A research/2026-10-29-landing-page/judge.ts
 * Writes out/judge-<persona>.json (prompt, answer, usage). ZDR is mandatory;
 * there is no fallback model or relaxed data policy.
 */
const MODEL = "google/gemini-4-argon";
const BUDGET_USD = 0.5;
const here = new URL(".", import.meta.url).pathname;

const PERSONAS: Record<string, string> = {
  player:
    `You review game landing pages for players. Your concerns, from itch.io's creator docs and store-page practice (Steam above-the-fold guidance, presskit()): one obvious Play action above the fold on every screen size; show the game itself (footage) early; say what the game is in one line; no friction (accounts, cookie walls, newsletters); honest description of length and content; a child on a slow school Chromebook or a cheap phone must reach the game in one tap and understand what will happen next (large download, sound, fullscreen).`,
  teacher:
    `You review project pages written to teach game-development students. Your concerns, from presskit() (a resource with easy-to-access information, not decoration), Game Developer postmortem practice (name specifics, what went wrong as well as right) and making-of devlogs: claims must be specific and checkable, with links to source and evidence; failures and rejected ideas must be visible, not just wins; the role of generative AI must be described precisely (which models did what, which ran locally, what humans decided), with no hype and no implication that the slice was cheap or effortless; the structure should let a student go from a one-line summary to the source file.`,
  auditor:
    `You audit static websites for accessibility, performance and ethics. Your concerns: WCAG 2.2 (2.2.2 Pause, Stop, Hide for moving content; 2.3 flashes; 2.5.8 target size; contrast; keyboard path; reduced motion); Alex Russell's "Performance Inequality Gap, 2026" budgets for low-end devices (small JavaScript, no heavy media on first load); no tracking, no third-party requests, local fonts; GitHub Pages constraints (static, 1 GB site, soft 100 GB per month bandwidth, so large video must be on demand); privacy for children using school devices; a service worker that must not hijack the landing page.`,
};

const TASK =
  `Critique the landing-page wireframe below against your concerns only. Be concrete and brief (under 450 words). Return Markdown with three headings: "Top risks" (at most 5, each with the section it concerns), "Changes I would make" (at most 6, each one sentence, ordered by value), and "Things that are fine". Do not invent facts about the game; if the wireframe is unclear, say what is unclear.`;

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

const outline = await Deno.readTextFile(`${here}OUTLINE.md`);
await Deno.mkdir(`${here}out`, { recursive: true });
let spent = 0;
for (const [persona, concerns] of Object.entries(PERSONAS)) {
  if (spent > BUDGET_USD * 0.8) {
    console.error(`stopping before ${persona}: spent $${spent.toFixed(4)}`);
    break;
  }
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: concerns },
      { role: "user", content: `${TASK}\n\n---\n\n${outline}` },
    ],
    max_tokens: 2500,
    provider: { zdr: true, data_collection: "deny", allow_fallbacks: false },
    usage: { include: true },
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${persona}: ${JSON.stringify(json)}`);
  const cost = Number(json.usage?.cost ?? 0);
  spent += cost;
  await Deno.writeTextFile(
    `${here}out/judge-${persona}.json`,
    JSON.stringify(
      {
        persona,
        model: MODEL,
        provider: json.provider,
        concerns,
        task: TASK,
        answer: json.choices?.[0]?.message?.content,
        usage: json.usage,
      },
      null,
      2,
    ),
  );
  console.log(`${persona}: $${cost.toFixed(6)} via ${json.provider}`);
}
console.log(`total $${spent.toFixed(6)}`);
