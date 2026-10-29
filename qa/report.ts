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
  }[];
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
): Summary {
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
    reels: reels.map((r) => ({
      id: r.id,
      status: r.status,
      seconds: r.seconds,
      note: reelNote(r),
    })),
  };
}

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
    for (const r of s.reels) {
      lines.push(
        `  ${r.status.padEnd(7)} ${r.id} ${r.seconds}s  ${r.note}`.slice(
          0,
          160,
        ),
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

function reelHtml(r: ReelResult): string {
  return `<section class="reel" id="reel-${esc(r.id)}"><h3>${badge(r.status)} ${
    esc(r.id)
  } <small>${esc(r.topic)}, ${r.seconds} s</small></h3>
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
  }</div>
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
</style></head><body>
<h1>Neon Warden QA ${badge(summary.overall)}</h1>
<p>${
    esc(summary.created)
  } &middot; ${summary.counts.pass} pass, ${summary.counts.warn} warn, ${summary.counts.fail} fail, ${summary.counts.pending} pending &middot; <a href="summary.json">summary.json</a> &middot; <a href="summary.txt">summary.txt</a></p>
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
        reels.map(reelHtml).join("\n")
      }</section>`
      : ""
  }
</body></html>
`;
}
