/**
 * Asset pipeline report: models, UI sound, music, VO and license notices,
 * each checked against what the code expects.
 *
 * - Models: `public/models/manifest.json` vs the renderer's `PLACEHOLDERS`
 *   registry, every GLB parsed (qa/lib/gltf.ts), budgets from qa/budgets.ts,
 *   animated node names present.
 * - SFX: `public/sfx/manifest.json` roles vs `UI_SOUND_ROLES` and scene
 *   `sfx()` cues, and whether each role has a picked take.
 * - Music: `music/cues.yaml` and the promoted manifest vs `MusicCueId`.
 * - VO: `vo/out/cues.json` vs `vo/script.yaml`, orphan takes, shipped copy.
 * - Licenses: every third-party source named on the licenses or credits screen.
 *
 *   deno run -A qa/assets.ts      # prints JSON
 */

import { parse as parseYaml } from "jsr:@std/yaml@1";
import {
  type Check,
  exists,
  listCheck,
  readJson,
  repo,
  type StageResult,
  type Table,
  walk,
} from "./lib/common.ts";
import { readGlb } from "./lib/gltf.ts";
import {
  ANIMATED_NODES,
  BUDGET_WARN,
  DEFAULT_MODEL_BUDGET,
  MODEL_BUDGETS,
  THIRD_PARTY,
} from "./budgets.ts";

interface ManifestEntry {
  readonly file: string;
  readonly bytes: number;
  readonly triangles: number;
  readonly nodes: readonly string[];
}

async function text(path: string): Promise<string> {
  try {
    return await Deno.readTextFile(repo(path));
  } catch {
    return "";
  }
}

/** Keys of `export const NAME = { key: ..., }` in a TS file, by regex. */
function objectKeys(source: string, name: string): string[] {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return [];
  const body = source.slice(start, source.indexOf("\n};", start));
  return [...body.matchAll(/^ {2}"?([a-z_][a-z0-9_]*)"?:/gm)].map((m) => m[1]);
}

/** String members of `export type NAME = | "a" | "b";`. */
function unionMembers(source: string, name: string): string[] {
  const bare = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const m = bare.match(new RegExp(`export type ${name} =([^;]+);`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
}

/** `ending_kill` to `endingKill`: music briefs are snake_case, cue ids camel. */
const camel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Every literal string argument of `fn(...)` across the given files: the
 * first argument, or the second with `second` (for `findPart(slot, "x")`).
 */
async function callArgs(
  files: readonly string[],
  fn: string,
  second = false,
): Promise<Set<string>> {
  const out = new Set<string>();
  const re = second
    ? new RegExp(`\\b${fn}\\(\\s*[\\w.]+,\\s*"([^"]+)"`, "g")
    : new RegExp(`\\b${fn}\\(\\s*"([^"]+)"`, "g");
  for (const f of files) {
    for (const m of (await text(f)).matchAll(re)) out.add(m[1]);
  }
  return out;
}

async function models(
  checks: Check[],
  tables: Table[],
): Promise<Record<string, number>> {
  const registry = objectKeys(
    await text("src/render/placeholders.ts"),
    "PLACEHOLDERS",
  );
  const manifest = await readJson<Record<string, ManifestEntry>>(
    repo("public/models/manifest.json"),
  ) ?? {};
  const expected = new Set(registry);
  const shipped = new Set(Object.keys(manifest));
  checks.push({
    id: "assets.models.registry",
    status: registry.length ? "pass" : "fail",
    detail: registry.length
      ? `renderer registry lists ${registry.length} models`
      : "could not read PLACEHOLDERS keys from src/render/placeholders.ts",
  });
  checks.push(listCheck(
    "assets.models.missing",
    [...expected].filter((id) => !shipped.has(id)),
    "every model the renderer loads is in the manifest",
    (n) =>
      `${n} models the renderer loads have no GLB (placeholder geometry shows)`,
  ));
  checks.push(listCheck(
    "assets.models.unused",
    [...shipped].filter((id) => !expected.has(id)),
    "no orphan models in the manifest",
    (n) => `${n} manifest models are not in the renderer registry`,
    "warn",
  ));

  const invalid: string[] = [];
  const drift: string[] = [];
  const over: string[] = [];
  const near: string[] = [];
  const missingNodes: string[] = [];
  const rows: (string | number)[][] = [];
  for (const id of [...new Set([...registry, ...shipped])].sort()) {
    const path = `public/models/${id}.glb`;
    if (!(await exists(repo(path)))) {
      rows.push([id, "MISSING", "", "", "", "", ""]);
      continue;
    }
    const bytes = await Deno.readFile(repo(path));
    const glb = readGlb(bytes);
    if (!glb.ok) invalid.push(`${id}: ${glb.errors.join("; ")}`);
    const m = manifest[id];
    if (m && (m.bytes !== bytes.byteLength || m.triangles !== glb.triangles)) {
      drift.push(
        `${id}: manifest ${m.bytes} B / ${m.triangles} tris, file ${bytes.byteLength} B / ${glb.triangles} tris`,
      );
    }
    const budget = MODEL_BUDGETS[id] ?? DEFAULT_MODEL_BUDGET;
    const use = Math.max(
      glb.triangles / budget.triangles,
      bytes.byteLength / budget.bytes,
    );
    if (use > 1) over.push(`${id} at ${(use * 100).toFixed(0)}% of budget`);
    else if (use > BUDGET_WARN) {
      near.push(`${id} at ${(use * 100).toFixed(0)}% of budget`);
    }
    for (const [node, owners] of Object.entries(ANIMATED_NODES)) {
      if (
        owners.includes(id) &&
        !glb.nodes.some((n) =>
          n === node || n.startsWith(`${node}_`) || n.startsWith(node)
        )
      ) {
        missingNodes.push(`${id} lacks animated node "${node}"`);
      }
    }
    rows.push([
      id,
      glb.ok ? "valid" : "INVALID",
      glb.triangles,
      `${(100 * glb.triangles / budget.triangles).toFixed(0)}%`,
      bytes.byteLength,
      `${(100 * bytes.byteLength / budget.bytes).toFixed(0)}%`,
      glb.nodes.length,
    ]);
  }
  checks.push(
    listCheck(
      "assets.models.valid",
      invalid,
      "every GLB parses and its buffers are in range",
      (n) => `${n} GLBs are structurally invalid`,
    ),
  );
  checks.push(
    listCheck(
      "assets.models.manifestDrift",
      drift,
      "manifest bytes and triangles match the files",
      (n) => `${n} manifest entries disagree with their GLB; rebuild art`,
      "warn",
    ),
  );
  checks.push(
    listCheck(
      "assets.models.budget",
      over,
      "every model is within its triangle and byte budget",
      (n) => `${n} models over budget`,
    ),
  );
  checks.push(
    listCheck(
      "assets.models.budgetNear",
      near,
      `no model above ${BUDGET_WARN * 100}% of budget`,
      (n) => `${n} models near budget`,
      "warn",
    ),
  );
  checks.push(
    listCheck(
      "assets.models.animatedNodes",
      missingNodes,
      "every animated node name is present",
      (n) => `${n} animated nodes missing; the renderer will not animate them`,
    ),
  );

  // findPart names in the renderer that the convention table does not know.
  const renderFiles = await walk("src/render", /\.ts$/);
  const used = await callArgs(renderFiles, "findPart", true);
  checks.push(listCheck(
    "assets.models.animatedTable",
    [...used].filter((n) => !(n in ANIMATED_NODES)),
    `all ${used.size} findPart names are mapped in qa/budgets.ts`,
    (n) =>
      `${n} findPart names unknown to qa/budgets.ts ANIMATED_NODES; add them`,
    "warn",
  ));

  tables.push({
    title: "Models",
    columns: [
      "id",
      "glTF",
      "triangles",
      "of budget",
      "bytes",
      "of budget",
      "nodes",
    ],
    rows,
  });
  return { models: shipped.size, registry: registry.length };
}

async function sfx(
  checks: Check[],
  tables: Table[],
): Promise<Record<string, number>> {
  const soundTs = await text("src/ui/sound.ts");
  const m = soundTs.match(/UI_SOUND_ROLES = \[([^\]]+)\]/);
  const uiRoles = m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  const sceneFiles = await walk("src/scenes", /\.ts$/);
  const sceneRoles = await callArgs(sceneFiles, "sfx");
  const manifest = await readJson<
    { sounds?: Record<string, { src?: string } | null> }
  >(
    repo("public/sfx/manifest.json"),
  );
  const sounds = manifest?.sounds ?? {};
  const roles = new Set([...uiRoles, ...sceneRoles]);
  checks.push(listCheck(
    "assets.sfx.roles",
    [...roles].filter((r) => !(r in sounds)),
    `all ${roles.size} roles used in code are in the sfx manifest`,
    (n) =>
      `${n} sound roles used in code are absent from public/sfx/manifest.json`,
  ));
  const unpicked = Object.entries(sounds).filter(([, v]) => !v).map(([k]) => k);
  checks.push(listCheck(
    "assets.sfx.picked",
    unpicked,
    "every sfx role has a picked take",
    (n) =>
      `${n} of ${
        Object.keys(sounds).length
      } sfx roles have no pick yet (silent); audition in sfx/`,
    "pending",
  ));
  const missingFiles: string[] = [];
  for (const [role, v] of Object.entries(sounds)) {
    if (v?.src && !(await exists(repo(`public/${v.src}`)))) {
      missingFiles.push(`${role}: ${v.src}`);
    }
  }
  checks.push(
    listCheck(
      "assets.sfx.files",
      missingFiles,
      "every picked sfx file exists",
      (n) => `${n} picked sfx files missing`,
    ),
  );
  tables.push({
    title: "UI sound roles",
    columns: ["role", "used by", "picked"],
    rows: [...new Set([...roles, ...Object.keys(sounds)])].sort().map((r) => [
      r,
      [uiRoles.includes(r) ? "ui" : "", sceneRoles.has(r) ? "scenes" : ""]
        .filter(Boolean).join(", ") || "unused",
      sounds[r]?.src ?? (r in sounds ? "no" : "NOT IN MANIFEST"),
    ]),
  });
  return {
    sfxRoles: Object.keys(sounds).length,
    sfxPicked: Object.keys(sounds).length - unpicked.length,
  };
}

async function music(
  checks: Check[],
  tables: Table[],
): Promise<Record<string, number>> {
  const contract = unionMembers(
    await text("src/contracts/timeline.ts"),
    "MusicCueId",
  );
  const sceneFiles = await walk("src/scenes", /\.ts$/);
  const used = await callArgs(sceneFiles, "music");
  let briefs: string[] = [];
  try {
    const doc = parseYaml(await text("music/cues.yaml")) as {
      cues?: Record<string, unknown>;
    };
    briefs = Object.keys(doc.cues ?? {}).map(camel);
  } catch { /* reported below */ }
  const promoted = await readJson<Record<string, unknown>>(
    repo("public/music/manifest.json"),
  );
  const promotedIds = new Set(
    Object.keys(
      (promoted?.cues ?? promoted?.tracks ?? promoted ?? {}) as Record<
        string,
        unknown
      >,
    ).map(camel),
  );

  checks.push(listCheck(
    "assets.music.scenesInContract",
    [...used].filter((c) => !contract.includes(c)),
    `all ${used.size} music cues used by scenes are MusicCueIds`,
    (n) => `${n} music cues used by scenes are not MusicCueIds`,
  ));
  checks.push(listCheck(
    "assets.music.briefs",
    contract.filter((c) => c !== "silence" && !briefs.includes(c)),
    "every MusicCueId has a brief in music/cues.yaml (snake_case ids camelized)",
    (n) => `${n} MusicCueIds have no brief in music/cues.yaml`,
    "warn",
  ));
  checks.push(listCheck(
    "assets.music.contractGaps",
    briefs.filter((b) => !contract.includes(b)),
    "every music brief maps to a MusicCueId",
    (n) =>
      `${n} music briefs are not MusicCueIds yet (contract request in INTEGRATION-QUEUE)`,
    "warn",
  ));
  checks.push(listCheck(
    "assets.music.promoted",
    promoted
      ? contract.filter((c) => c !== "silence" && !promotedIds.has(c))
      : ["public/music/manifest.json"],
    "every MusicCueId has a promoted track",
    (n) =>
      promoted
        ? `${n} MusicCueIds have no promoted track`
        : "no music promoted yet (public/music/manifest.json missing); picks pending",
    "pending",
  ));
  tables.push({
    title: "Music cues",
    columns: ["cue", "MusicCueId", "brief", "used by scenes", "promoted"],
    rows: [...new Set([...contract, ...briefs])].map((c) => [
      c,
      contract.includes(c) ? "yes" : "no",
      briefs.includes(c) ? "yes" : "no",
      used.has(c) ? "yes" : "",
      promotedIds.has(c) ? "yes" : "",
    ]),
  });
  return { musicCues: contract.length, musicPromoted: promotedIds.size };
}

async function vo(checks: Check[]): Promise<Record<string, number>> {
  let scriptIds: string[] = [];
  try {
    const doc = parseYaml(await text("vo/script.yaml")) as {
      lines?: { id: string }[];
    };
    scriptIds = (doc.lines ?? []).map((l) => l.id);
  } catch { /* coverage reports the parse error */ }
  const cues = await readJson<
    { lines?: Record<string, { langs?: Record<string, { file?: string }> }> }
  >(
    repo("vo/out/cues.json"),
  );
  const cueIds = Object.keys(cues?.lines ?? {});
  checks.push(
    listCheck(
      "assets.vo.cuesComplete",
      scriptIds.filter((id) => !cueIds.includes(id)),
      "cues.json lists every script line",
      (n) => `${n} script lines absent from vo/out/cues.json`,
    ),
  );
  checks.push(
    listCheck(
      "assets.vo.cuesOrphans",
      cueIds.filter((id) => !scriptIds.includes(id)),
      "cues.json has no retired lines",
      (n) => `${n} cues.json lines no longer in the script`,
      "warn",
    ),
  );
  const referenced = new Set(
    Object.values(cues?.lines ?? {}).flatMap((l) =>
      Object.values(l.langs ?? {}).map((t) => t.file ?? "")
    ),
  );
  const wavs = (await walk("vo/out", /\.wav$/)).map((p) =>
    p.replace(/^vo\/out\//, "")
  );
  checks.push(
    listCheck(
      "assets.vo.orphanFiles",
      wavs.filter((w) => !referenced.has(w)),
      "every wav in vo/out is referenced by cues.json",
      (n) => `${n} orphan wavs in vo/out (retired lines or test takes)`,
      "warn",
    ),
  );
  const shipped = await exists(repo("public/vo/cues.json"));
  checks.push({
    id: "assets.vo.shipped",
    status: shipped ? "pass" : "pending",
    detail: shipped
      ? "public/vo/cues.json present; VO ships in the build"
      : "public/vo/cues.json missing; VO will not load in the build (integration: copy or build-step vo/out)",
  });
  return {
    voCueLines: cueIds.length,
    voTakes: referenced.size,
    voWavs: wavs.length,
  };
}

async function licenses(checks: Check[], tables: Table[]): Promise<void> {
  const texts: string[] = [];
  try {
    const ui = (await import(`file://${repo("src/i18n/ui.ts")}`))
      .UI_STRINGS as Record<string, { en: string }>;
    for (const [k, v] of Object.entries(ui)) {
      if (/^ui\.(licenses|credits)\./.test(k)) texts.push(v.en);
    }
  } catch { /* coverage reports load errors */ }
  try {
    const legacy = (await import(`file://${repo("src/ui/strings.ts")}`))
      .UI_STRINGS_EN as Record<string, string> | undefined;
    for (const [k, v] of Object.entries(legacy ?? {})) {
      if (/^ui\.(licenses|credits)\./.test(k)) texts.push(v);
    }
  } catch { /* optional table */ }
  const all = texts.join("\n");
  const rows: string[][] = [];
  const unnamed: string[] = [];
  for (const tp of THIRD_PARTY) {
    const used = await exists(repo(tp.evidence));
    const named = tp.match.test(all);
    if (used && !named) unnamed.push(tp.name);
    rows.push([
      tp.name,
      tp.evidence,
      used ? "yes" : "no",
      named ? "yes" : "NO",
    ]);
  }
  checks.push(listCheck(
    "assets.licenses",
    unnamed,
    "every third-party source is named on the licenses or credits screen",
    (n) => `${n} third-party sources missing from ui.licenses.* / ui.credits.*`,
  ));
  tables.push({
    title: "Third-party notices",
    columns: ["source", "evidence", "used", "named on screen"],
    rows,
  });
}

export async function assets(): Promise<StageResult> {
  const checks: Check[] = [];
  const tables: Table[] = [];
  const stats = {
    ...await models(checks, tables),
    ...await sfx(checks, tables),
    ...await music(checks, tables),
    ...await vo(checks),
  };
  await licenses(checks, tables);
  return { stage: "assets", checks, tables, stats };
}

if (import.meta.main) {
  console.log(JSON.stringify(await assets(), null, 2));
}
