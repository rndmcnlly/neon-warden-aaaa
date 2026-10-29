/**
 * Build step: converts `vo/script.yaml` into `src/i18n/script.gen.ts`.
 *
 * Why generate instead of loading YAML at runtime? The browser bundle then
 * needs no YAML parser, the text ships as plain data, and TypeScript learns
 * every line id as a literal type, so a timeline that names a line which does
 * not exist fails `deno check` instead of failing silently on stage.
 *
 *   deno run --allow-read --allow-write src/i18n/gen_script.ts          # write
 *   deno run --allow-read src/i18n/gen_script.ts --check                # verify
 *
 * `--check` exits non-zero when the generated file is stale (use it in CI).
 */

import { parse } from "jsr:@std/yaml@^1";
import type { Speaker } from "../contracts/index.ts";
import type { Route, ScriptLineData } from "./types.ts";

const SPEAKERS: readonly Speaker[] = [
  "tutorial_ai",
  "narrator",
  "warden",
  "pilot",
  "scout",
  "authority",
];
const ROUTES: readonly Route[] = ["any", "kill", "pacifist"];

export const SCRIPT_YAML_PATH = new URL(
  "../../vo/script.yaml",
  import.meta.url,
);
export const SCRIPT_GEN_PATH = new URL("./script.gen.ts", import.meta.url);

/** Collapses YAML line folding the same way `vo/render.py` does. */
function clean(text: unknown): string {
  return typeof text === "string"
    ? text.split(/\s+/).filter(Boolean).join(" ")
    : "";
}

/** Parses the script and validates it. Throws with every problem listed. */
export function parseScript(yamlText: string): Map<string, ScriptLineData> {
  const doc = parse(yamlText) as {
    speakers?: Record<string, unknown>;
    lines?: unknown[];
  };
  const problems: string[] = [];
  const lines = new Map<string, ScriptLineData>();

  for (const name of Object.keys(doc.speakers ?? {})) {
    if (!SPEAKERS.includes(name as Speaker)) {
      problems.push(
        `speaker "${name}" is not in the Speaker union (src/contracts/text.ts)`,
      );
    }
  }

  for (const raw of doc.lines ?? []) {
    const entry = raw as Record<string, unknown>;
    const id = String(entry.id ?? "");
    const speaker = entry.speaker as Speaker;
    const route = (entry.route ?? "any") as Route;
    if (!/^[a-z0-9_]+$/.test(id)) problems.push(`bad line id "${id}"`);
    if (lines.has(id)) problems.push(`duplicate line id "${id}"`);
    if (!SPEAKERS.includes(speaker)) {
      problems.push(`${id}: unknown speaker "${speaker}"`);
    }
    if (!ROUTES.includes(route)) {
      problems.push(`${id}: unknown route "${route}"`);
    }
    if (!clean(entry.en)) problems.push(`${id}: English text is required`);

    const es = clean(entry.es);
    const zh = clean(entry.zh);
    lines.set(id, {
      speaker,
      scene: String(entry.scene ?? ""),
      route,
      optional: entry.optional === true,
      direction: clean(entry.direction),
      text: {
        en: clean(entry.en),
        ...(es ? { es } : {}),
        ...(zh ? { zh } : {}),
      },
    });
  }

  if (problems.length > 0) {
    throw new Error(`vo/script.yaml:\n  ${problems.join("\n  ")}`);
  }
  return lines;
}

/** Renders the generated module. Pure, so a test can compare it with disk. */
export function renderScriptModule(yamlText: string): string {
  const lines = parseScript(yamlText);
  const body = [...lines].map(([id, line]) =>
    `  ${JSON.stringify(id)}: ${JSON.stringify(line)},`
  );
  return [
    "// GENERATED from vo/script.yaml by src/i18n/gen_script.ts. Do not edit.",
    "// deno run --allow-read --allow-write src/i18n/gen_script.ts",
    "// deno-fmt-ignore-file",
    "",
    'import type { ScriptLineData } from "./types.ts";',
    "",
    "export const SCRIPT_LINES = {",
    ...body,
    "} as const satisfies Record<string, ScriptLineData>;",
    "",
  ].join("\n");
}

if (import.meta.main) {
  const fresh = renderScriptModule(await Deno.readTextFile(SCRIPT_YAML_PATH));
  if (Deno.args.includes("--check")) {
    const current = await Deno.readTextFile(SCRIPT_GEN_PATH).catch(() => "");
    if (current !== fresh) {
      console.error("script.gen.ts is stale: rerun src/i18n/gen_script.ts");
      Deno.exit(1);
    }
    console.log("script.gen.ts is current");
  } else {
    await Deno.writeTextFile(SCRIPT_GEN_PATH, fresh);
    console.log(`wrote ${SCRIPT_GEN_PATH.pathname}`);
  }
}
