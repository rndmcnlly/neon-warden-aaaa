/**
 * Shared plumbing for every QA stage: repo paths, the `Check` record that
 * every report is made of, and the report directory.
 *
 * A QA stage is a function that reads the tree and returns a `StageResult`:
 * a list of checks plus free-form tables for the dashboard. Stages never
 * print verdicts themselves; `qa/qa.ts` writes JSON, the dashboard and the
 * compact text summary from the results, so all three always agree.
 */

export const ROOT = new URL("../../", import.meta.url).pathname.replace(
  /\/$/,
  "",
);

/** Absolute path from a repo-relative one. */
export function repo(path: string): string {
  return `${ROOT}/${path}`;
}

/**
 * pass: fine. warn: ship-able but someone should look. fail: blocks a
 * workstream from reporting done. pending: cannot be checked yet (missing
 * flag, hook or asset that another workstream owes); not a failure.
 */
export type Status = "pass" | "warn" | "fail" | "pending";

export interface Check {
  /** Stable id, for diffing reports: `coverage.es.placeholders`. */
  readonly id: string;
  readonly status: Status;
  /** One line a human can act on. */
  readonly detail: string;
  /** Optional offending items, capped by the stage (never thousands). */
  readonly items?: readonly string[];
}

export interface Table {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
}

export interface StageResult {
  readonly stage: string;
  readonly checks: readonly Check[];
  readonly tables: readonly Table[];
  /** Headline numbers for the summary line, e.g. `{ ids: 412 }`. */
  readonly stats: Readonly<Record<string, number | string>>;
}

const RANK: Record<Status, number> = { pass: 0, pending: 1, warn: 2, fail: 3 };

/** The worst status in a list (pending outranks pass, never warn or fail). */
export function worst(statuses: readonly Status[]): Status {
  return statuses.reduce<Status>(
    (acc, s) => (RANK[s] > RANK[acc] ? s : acc),
    "pass",
  );
}

/** Counts per status, for summary lines. */
export function tally(checks: readonly Check[]): Record<Status, number> {
  const out: Record<Status, number> = { pass: 0, warn: 0, fail: 0, pending: 0 };
  for (const c of checks) out[c.status]++;
  return out;
}

/** Caps an item list so a report stays reviewable. */
export function cap(items: readonly string[], max = 40): string[] {
  return items.length <= max
    ? [...items]
    : [...items.slice(0, max), `... and ${items.length - max} more`];
}

/** A check that passes when `items` is empty, else takes `bad` status. */
export function listCheck(
  id: string,
  items: readonly string[],
  okDetail: string,
  badDetail: (n: number) => string,
  bad: Status = "fail",
): Check {
  return items.length === 0
    ? { id, status: "pass", detail: okDetail }
    : { id, status: bad, detail: badDetail(items.length), items: cap(items) };
}

export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as T;
  } catch {
    return null;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}

/** Every file under `dir` (repo-relative) whose name matches `pattern`. */
export async function walk(dir: string, pattern: RegExp): Promise<string[]> {
  const out: string[] = [];
  async function visit(rel: string): Promise<void> {
    let entries: Deno.DirEntry[];
    try {
      entries = [...Deno.readDirSync(repo(rel))];
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory) await visit(child);
      else if (pattern.test(e.name)) out.push(child);
    }
  }
  await visit(dir);
  return out;
}

/** `20261028-193005`, local time, sortable. */
export function timestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${
    p(date.getHours())
  }${p(date.getMinutes())}${p(date.getSeconds())}`;
}
