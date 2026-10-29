/**
 * QA entry point. Every run writes one self-contained report directory,
 * `qa/reports/<timestamp>/`, and points `qa/reports/latest` at it.
 *
 *   deno run -A --no-lock qa/qa.ts                  # coverage, assets, every reel
 *   deno run -A --no-lock qa/qa.ts static           # coverage and assets only (seconds)
 *   deno run -A --no-lock qa/qa.ts reel boss menus-es
 *   deno run -A --no-lock qa/qa.ts topic menus      # every reel of one topic
 *   deno run -A --no-lock qa/qa.ts list             # reel ids, topics, needs
 *
 * Options: `--no-build` reuses qa/.build/dist; `--url http://localhost:3000/`
 * captures against an already running server instead of a fresh build;
 * `--judge=boss,menus-en` sends those reels to the paid AV judge
 * (qa/judge.ts) after capture, so the dashboard shows its scores.
 * Exit status is 1 when anything fails, so CI can gate on it.
 */

import { repo, type StageResult, timestamp, writeJson } from "./lib/common.ts";
import { judgeReel } from "./judge.ts";
import { coverage } from "./coverage.ts";
import { assets } from "./assets.ts";
import { type Reel, REELS } from "./reels.ts";
import {
  build,
  captureReel,
  launch,
  type ReelResult,
  serve,
} from "./capture.ts";
import { writeReport } from "./report.ts";

const args = Deno.args.filter((a) => !a.startsWith("--"));
const opt = (name: string) => Deno.args.find((a) => a.startsWith(`--${name}`));
const mode = args[0] ?? "all";

if (mode === "list") {
  for (const r of REELS) {
    console.log(
      `${r.id.padEnd(16)} ${r.topic.padEnd(13)} ${r.maxSeconds}s  ${
        r.needs?.length ? "needs: " + r.needs.join("; ") : ""
      }`,
    );
  }
  Deno.exit(0);
}

let reels: readonly Reel[] = [];
if (mode === "all") reels = REELS;
else if (mode === "reel") {
  const unknown = args.slice(1).filter((id) => !REELS.some((r) => r.id === id));
  if (unknown.length || args.length < 2) {
    console.error(
      `unknown or missing reel id: ${unknown.join(", ")}; try: qa/qa.ts list`,
    );
    Deno.exit(2);
  }
  reels = REELS.filter((r) => args.slice(1).includes(r.id));
} else if (mode === "topic") {
  reels = REELS.filter((r) => args.slice(1).includes(r.topic));
} else if (mode !== "static") {
  console.error(
    `unknown mode "${mode}"; use all, static, reel <ids>, topic <topics>, list`,
  );
  Deno.exit(2);
}

const stamp = timestamp();
const rel = `qa/reports/${stamp}`;
const dir = repo(rel);
await Deno.mkdir(dir, { recursive: true });

const stages: StageResult[] = [await coverage(), await assets()];
await writeJson(`${dir}/coverage.json`, stages[0]);
await writeJson(`${dir}/assets.json`, stages[1]);

const results: ReelResult[] = [];
if (reels.length) {
  let base = opt("url")?.split("=")[1] ?? "";
  let server: { url: string; close: () => Promise<void> } | null = null;
  if (!base) {
    const out = repo("qa/.build/dist");
    if (!opt("no-build")) {
      console.error("building production bundle into qa/.build/dist ...");
      // Build beside the old bundle and swap on success: other agents edit
      // the tree mid-run, and a broken build should not leave nothing.
      const next = repo("qa/.build/next");
      try {
        await build(next);
        await Deno.remove(out, { recursive: true }).catch(() => {});
        await Deno.rename(next, out);
      } catch (err) {
        const msg = String(err).split("\n").slice(0, 6).join("\n");
        console.error(`build failed; reusing the previous bundle:\n${msg}`);
        stages.push({
          stage: "build",
          checks: [{
            id: "build.vite",
            status: "warn",
            detail:
              "vite build failed (tree mid-edit?); reels ran on the previous bundle",
            items: [msg.slice(0, 300)],
          }],
          tables: [],
          stats: { reused: 1 },
        });
      }
    }
    server = serve(out);
    base = server.url;
  }
  const browser = await launch();
  try {
    for (const reel of reels) {
      console.error(`reel ${reel.id} (up to ${reel.maxSeconds} s) ...`);
      const r = await captureReel(browser, reel, base, dir);
      console.error(`  ${r.status} in ${r.seconds} s`);
      results.push(r);
    }
  } finally {
    await browser.close();
    await server?.close();
  }
}

const toJudge = (opt("judge")?.split("=")[1] ?? "").split(",").filter((id) =>
  results.some((r) => r.id === id && r.video?.endsWith(".mp4"))
);
for (const id of toJudge) {
  console.error(`judge ${id} ...`);
  const j = await judgeReel(dir, id);
  console.error(
    `  ${
      j.error ??
        `mean ${j.mean}, ${j.canary?.trusted ? "trusted" : "untrusted"}`
    }${j.cached ? " (cached)" : `, US$${j.costUsd.toFixed(3)}`}`,
  );
}

const { summary, text } = await writeReport(dir, rel, stages, results);

// Point qa/reports/latest at this run (symlink plus a plain-text pointer for
// tools that do not follow links).
const latest = repo("qa/reports/latest");
try {
  await Deno.remove(latest);
} catch { /* first run */ }
await Deno.symlink(stamp, latest);
await Deno.writeTextFile(repo("qa/reports/latest.txt"), `${rel}\n`);

console.log(text.trimEnd());
Deno.exit(summary.overall === "fail" ? 1 : 0);
