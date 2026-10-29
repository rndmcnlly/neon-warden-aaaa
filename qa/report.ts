/**
 * Turns stage results and reel results into the three report forms, which
 * always agree because they come from the same data:
 *
 * - `index.html`: the dashboard a human reviews (tables, embedded videos)
 * - `summary.json`: the machine form, for diffing runs
 * - `summary.txt`: under 40 lines, pasted by agents into their final message
 */

import {
  type Check,
  type StageResult,
  type Status,
  tally,
  worst,
} from "./lib/common.ts";
import type { ReelResult } from "./capture.ts";
import type { Judgment } from "./judge.ts";
import { repo, writeJson } from "./lib/common.ts";

/** A reel's judge verdict as the summary carries it. */
export interface JudgeBrief {
  readonly mean: number | null;
  readonly trusted: boolean;
  readonly cached: boolean;
  readonly error?: string;
}

export interface Summary {
  readonly report: string;
  readonly created: string;
  readonly overall: Status;
  readonly counts: Record<Status, number>;
  readonly stages: readonly {
    stage: string;
    status: Status;
    stats: StageResult["stats"];
    problems: Check[];
  }[];
  readonly reels: readonly {
    id: string;
    status: Status;
    seconds: number;
    note: string;
    judge?: JudgeBrief;
    /** The same reel in the previous report, for trend. */
    prev?: { status: Status; judge?: JudgeBrief };
  }[];
  /** Report path this one is compared with, or null for the first run. */
  readonly previous: string | null;
}

function reelNote(r: ReelResult): string {
  const firstBad = r.assertions.find((a) =>
    a.status === r.status && a.status !== "pass"
  );
  return firstBad
    ? `${firstBad.id}: ${firstBad.detail}`
    : `${r.assertions.length} assertions`;
}

export function summarize(
  reportPath: string,
  stages: readonly StageResult[],
  reels: readonly ReelResult[],
  judges: ReadonlyMap<string, Judgment> = new Map(),
  previous: Summary | null = null,
): Summary {
  const brief = (j: Judgment | undefined): JudgeBrief | undefined =>
    j && {
      mean: j.mean ?? null,
      trusted: j.canary?.trusted ?? false,
      cached: j.cached,
      error: j.error,
    };
  const all = [
    ...stages.flatMap((s) => s.checks),
    ...reels.flatMap((r) => r.assertions),
  ];
  const statuses = [
    ...stages.map((s) => worst(s.checks.map((c) => c.status))),
    ...reels.map((r) => r.status),
  ];
  return {
    report: reportPath,
    created: new Date().toISOString(),
    overall: worst(statuses),
    counts: tally(all),
    stages: stages.map((s) => ({
      stage: s.stage,
      status: worst(s.checks.map((c) => c.status)),
      stats: s.stats,
      problems: s.checks.filter((c) => c.status !== "pass"),
    })),
    reels: reels.map((r) => {
      const p = previous?.reels.find((x) => x.id === r.id);
      return {
        id: r.id,
        status: r.status,
        seconds: r.seconds,
        note: reelNote(r),
        judge: brief(judges.get(r.id)),
        prev: p && { status: p.status, judge: p.judge },
      };
    }),
    previous: previous?.report ?? null,
  };
}

/** "up", "down" or "" for a reel against its previous run (status, then judge mean). */
export function trend(r: Summary["reels"][number]): "up" | "down" | "" {
  if (!r.prev) return "";
  const d = ORDER[r.status] - ORDER[r.prev.status];
  if (d) return d > 0 ? "up" : "down";
  const a = r.judge?.mean, b = r.prev.judge?.mean;
  if (a != null && b != null && Math.abs(a - b) >= 0.25) {
    return a > b ? "up" : "down";
  }
  return "";
}

const judgeText = (j?: JudgeBrief) =>
  !j
    ? ""
    : j.error
    ? " judge: error"
    : ` judge ${j.mean}${j.trusted ? "" : " (untrusted)"}`;

const ORDER: Record<Status, number> = { fail: 0, warn: 1, pending: 2, pass: 3 };

/** Compact text for agents: at most 40 lines, worst news first. */
export function summaryText(s: Summary): string {
  const lines: string[] = [];
  const c = s.counts;
  lines.push(`QA ${s.overall.toUpperCase()}  ${s.report}/index.html`);
  lines.push(
    `checks: ${c.pass} pass, ${c.warn} warn, ${c.fail} fail, ${c.pending} pending`,
  );
  for (const st of s.stages) {
    const stats = Object.entries(st.stats).map(([k, v]) => `${k} ${v}`).join(
      ", ",
    );
    lines.push(`${st.stage}: ${st.status.toUpperCase()} (${stats})`);
    const problems = [...st.problems].sort((a, b) =>
      ORDER[a.status] - ORDER[b.status]
    );
    for (const p of problems.slice(0, 7)) {
      lines.push(`  ${p.status} ${p.id}: ${p.detail}`);
    }
    if (problems.length > 7) {
      lines.push(`  ... ${problems.length - 7} more in the dashboard`);
    }
  }
  if (s.reels.length) {
    const t = tally(
      s.reels.map((r) => ({ id: r.id, status: r.status, detail: "" })),
    );
    lines.push(
      `reels: ${t.pass} pass, ${t.warn} warn, ${t.fail} fail, ${t.pending} pending`,
    );
    if (s.previous) {
      const ups = s.reels.filter((r) => trend(r) === "up").length;
      const downs = s.reels.filter((r) => trend(r) === "down").length;
      lines.push(`trend vs ${s.previous}: ${ups} better, ${downs} worse`);
    }
    for (const r of s.reels) {
      const arrow = { up: " (better)", down: " (worse)", "": "" }[trend(r)];
      lines.push(
        `  ${r.status.padEnd(7)} ${r.id} ${r.seconds}s${arrow}${
          judgeText(r.judge)
        }  ${r.note}`.slice(0, 180),
      );
    }
  }
  return lines.slice(0, 40).join("\n") + "\n";
}

// -- HTML

const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!),
  );

const badge = (s: Status) => `<span class="b ${s}">${s}</span>`;

function checksHtml(checks: readonly Check[]): string {
  const sorted = [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return `<table class="checks">${
    sorted.map((c) =>
      `<tr><td>${badge(c.status)}</td><td><code>${esc(c.id)}</code></td><td>${
        esc(c.detail)
      }${
        c.items?.length
          ? `<details><summary>${c.items.length} items</summary><ul>${
            c.items.map((i) => `<li>${esc(i)}</li>`).join("")
          }</ul></details>`
          : ""
      }</td></tr>`
    ).join("")
  }</table>`;
}

function stageHtml(s: StageResult): string {
  const tables = s.tables.map((t) =>
    `<details${t.rows.length <= 20 ? " open" : ""}><summary>${
      esc(t.title)
    } (${t.rows.length})</summary><div class="scroll"><table class="data"><tr>${
      t.columns.map((c) => `<th>${esc(c)}</th>`).join("")
    }</tr>${
      t.rows.map((r) =>
        `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`
      ).join("")
    }</table></div></details>`
  ).join("");
  return `<section id="${s.stage}"><h2>${esc(s.stage)} ${
    badge(worst(s.checks.map((c) => c.status)))
  }</h2>${checksHtml(s.checks)}${tables}</section>`;
}

function judgeHtml(j: Judgment | undefined): string {
  if (!j) {
    return `<p class="muted">not judged (deno task qa:judge ${""}&lt;id&gt;)</p>`;
  }
  if (j.error || !j.judgment) {
    return `<p class="muted">judge error: ${esc(j.error ?? "no judgment")}</p>`;
  }
  const g = j.judgment;
  const c = j.canary;
  return `<div class="judge${c?.trusted ? "" : " untrusted"}">
<h4>Judge ${esc(j.model)}: mean ${j.mean} ${
    c?.trusted ? badge("pass") : badge("warn")
  } <small>${c?.trusted ? "trusted" : "untrusted"}: ${esc(c?.detail ?? "")}${
    j.cached ? ", cached" : `, US$${j.costUsd.toFixed(3)}`
  }</small></h4>
<table class="data">${
    g.scores.map((s) =>
      `<tr><td><code>${
        esc(s.criterion)
      }</code></td><td class="score s${s.score}">${s.score}</td><td>${
        esc(s.justification)
      } <small>@ ${
        s.evidence_s.map((t) => t.toFixed(1)).join(", ")
      } s</small></td></tr>`
    ).join("")
  }</table>
<details open><summary>Listen-first transcript (${g.inventory.vo_lines.length} lines; music ${
    g.inventory.music_present ? "yes" : "no"
  }, SFX ${
    g.inventory.sfx_present ? "yes" : "no"
  })</summary><table class="data">${
    g.inventory.vo_lines.map((v, i) => {
      const h = c?.heard[i];
      return `<tr><td>${v.start_s.toFixed(1)}–${v.end_s.toFixed(1)} s</td><td>${
        esc(v.voice)
      }</td><td>${esc(v.transcript)}</td><td>${
        h
          ? `${
            h.match
              ? `<code>${esc(h.match)}</code> ${h.similarity}`
              : badge("fail") + " no script match"
          }${h.audible ? "" : " " + badge("warn") + " not in captured VO"}`
          : ""
      }</td></tr>`;
    }).join("")
  }</table><p class="muted">${esc(g.inventory.notes)}</p></details>
<details><summary>Fixes and summary</summary><ol>${
    g.fixes.map((f) =>
      `<li>${f.at_s.toFixed(1)} s, ${esc(f.discipline)}: ${esc(f.fix)}</li>`
    ).join("")
  }</ol><p>${esc(g.summary)}</p></details></div>`;
}

function reelHtml(
  r: ReelResult,
  j: Judgment | undefined,
  row: Summary["reels"][number] | undefined,
): string {
  const t = row ? trend(row) : "";
  const prev = row?.prev
    ? `<small class="trend ${t}">prev ${row.prev.status}${
      row.prev.judge?.mean != null ? `, judge ${row.prev.judge.mean}` : ""
    }${t === "up" ? ", better" : t === "down" ? ", worse" : ""}</small>`
    : "";
  return `<section class="reel" id="reel-${esc(r.id)}"><h3>${badge(r.status)} ${
    esc(r.id)
  } <small>${esc(r.topic)}, ${r.seconds} s</small> ${prev}</h3>
<p>${esc(r.title)}</p>
${
    r.needs.length
      ? `<p class="needs">needs: ${r.needs.map(esc).join("; ")}</p>`
      : ""
  }
<div class="media">${
    r.video
      ? `<video controls preload="none" width="640" height="360" ${
        r.sheet ? `poster="${esc(r.sheet)}"` : ""
      } src="${esc(r.video)}"></video>`
      : "<p>no video</p>"
  }
${
    r.sheet
      ? `<a href="${esc(r.sheet)}"><img src="${
        esc(r.sheet)
      }" width="480" alt="contact sheet for ${esc(r.id)}"></a>`
      : ""
  }<div class="judgecol">${judgeHtml(j)}</div></div>
${checksHtml(r.assertions)}
<details><summary>console and network (${r.errors.length})</summary><pre>${
    esc(r.errors.join("\n") || "none")
  }</pre></details>
</section>`;
}

export function dashboard(
  summary: Summary,
  stages: readonly StageResult[],
  reels: readonly ReelResult[],
  text: string,
  judges: ReadonlyMap<string, Judgment> = new Map(),
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QA ${
    esc(summary.report)
  }</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px auto;max-width:1200px;padding:0 16px;background:#101218;color:#dde2ea}
a{color:#7fd8ff}code{color:#ffd27f}h2{border-bottom:1px solid #333;padding-bottom:4px}
.b{display:inline-block;min-width:56px;text-align:center;border-radius:4px;padding:0 6px;font-weight:600;font-size:12px}
.pass{background:#1e5a34}.warn{background:#7a5b12}.fail{background:#8a1f2a}.pending{background:#2f3f63}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #262a33;padding:3px 6px;vertical-align:top;text-align:left}
.data td,.data th{font-size:12px}.scroll{max-height:420px;overflow:auto}
.media{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.needs{color:#9fb0d0}
pre{white-space:pre-wrap;background:#0a0b0f;padding:8px}nav a{margin-right:12px}
.judgecol{flex:1;min-width:420px}.judge h4{margin:0 0 6px}.untrusted{opacity:.55}.muted{color:#8a93a6}
.score{font-weight:700;text-align:center}.s1,.s2{color:#ff8a8a}.s3{color:#ffd27f}.s4,.s5{color:#8fe3a5}
.trend.up{color:#8fe3a5}.trend.down{color:#ff8a8a}
</style></head><body>
<h1>Neon Warden QA ${badge(summary.overall)}</h1>
<p>${esc(summary.created)} &middot; ${
    summary.previous
      ? `compared with <a href="../${
        esc(summary.previous.split("/").pop())
      }/index.html">${esc(summary.previous)}</a> &middot; `
      : ""
  } ${summary.counts.pass} pass, ${summary.counts.warn} warn, ${summary.counts.fail} fail, ${summary.counts.pending} pending &middot; <a href="summary.json">summary.json</a> &middot; <a href="summary.txt">summary.txt</a></p>
<nav>${stages.map((s) => `<a href="#${s.stage}">${s.stage}</a>`).join("")}${
    reels.map((r) => `<a href="#reel-${esc(r.id)}">${esc(r.id)}</a>`).join("")
  }</nav>
<details><summary>Agent summary (paste this)</summary><pre>${
    esc(text)
  }</pre></details>
${stages.map(stageHtml).join("\n")}
${
    reels.length
      ? `<section id="reels"><h2>Reels</h2>${
        reels.map((r) =>
          reelHtml(
            r,
            judges.get(r.id),
            summary.reels.find((x) => x.id === r.id),
          )
        ).join("\n")
      }</section>`
      : ""
  }
</body></html>
`;
}

// -- writing a report (used by qa/qa.ts after a run and qa/judge.ts after judging)

/** The newest report before `stamp` that has a summary, or null. */
async function previousSummary(stamp: string): Promise<Summary | null> {
  const names: string[] = [];
  for await (const e of Deno.readDir(repo("qa/reports"))) {
    if (e.isDirectory && /^\d{8}-\d{6}$/.test(e.name) && e.name < stamp) {
      names.push(e.name);
    }
  }
  for (const n of names.sort().reverse()) {
    try {
      return JSON.parse(
        await Deno.readTextFile(repo(`qa/reports/${n}/summary.json`)),
      );
    } catch { /* an interrupted run */ }
  }
  return null;
}

/** Writes summary.json, summary.txt and index.html for one report directory. */
export async function writeReport(
  dir: string,
  rel: string,
  stages: readonly StageResult[],
  results: readonly ReelResult[],
): Promise<{ summary: Summary; text: string }> {
  const judges = new Map<string, Judgment>();
  for (const r of results) {
    try {
      judges.set(
        r.id,
        JSON.parse(await Deno.readTextFile(`${dir}/reels/${r.id}/judge.json`)),
      );
    } catch { /* not judged */ }
  }
  const stamp = rel.split("/").pop() ?? "";
  const summary = summarize(
    rel,
    stages,
    results,
    judges,
    await previousSummary(stamp),
  );
  const text = summaryText(summary);
  await writeJson(`${dir}/summary.json`, summary);
  await Deno.writeTextFile(`${dir}/summary.txt`, text);
  await Deno.writeTextFile(
    `${dir}/index.html`,
    dashboard(summary, stages, results, text, judges),
  );
  return { summary, text };
}

/** Re-reads a finished report's JSON and writes its dashboard again. */
export async function rebuildReport(dir: string, rel: string): Promise<void> {
  const stages: StageResult[] = [];
  for (const f of ["coverage.json", "assets.json"]) {
    try {
      stages.push(JSON.parse(await Deno.readTextFile(`${dir}/${f}`)));
    } catch { /* absent */ }
  }
  const order = await Deno.readTextFile(`${dir}/summary.json`).then(
    (t) => (JSON.parse(t) as Summary).reels.map((r) => r.id),
    () => [] as string[],
  );
  const results: ReelResult[] = [];
  for (const id of order) {
    try {
      results.push(
        JSON.parse(await Deno.readTextFile(`${dir}/reels/${id}/result.json`)),
      );
    } catch { /* missing */ }
  }
  await writeReport(dir, rel, stages, results);
}
