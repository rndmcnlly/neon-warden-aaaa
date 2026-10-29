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
 * captures against an already running server instead of a fresh build.
 * Exit status is 1 when anything fails, so CI can gate on it.
 */

import { repo, type StageResult, timestamp, writeJson } from "./lib/common.ts";
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
import { dashboard, summarize, summaryText } from "./report.ts";

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
      await build(out);
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

const summary = summarize(rel, stages, results);
const text = summaryText(summary);
await writeJson(`${dir}/summary.json`, summary);
await Deno.writeTextFile(`${dir}/summary.txt`, text);
await Deno.writeTextFile(
  `${dir}/index.html`,
  dashboard(summary, stages, results, text),
);

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
