/**
 * Translation coverage: every LineId (spoken lines and `ui.*` strings) times
 * every language, plus VO audio and subtitle takes, plus a static scan for
 * ids referenced in code that no table defines.
 *
 * Sources, all read fresh on each run:
 * - `vo/script.yaml`, the source of truth for spoken lines
 * - `src/i18n/script.gen.ts`, its generated table (checked for staleness)
 * - `src/i18n/ui.ts`, translated UI strings
 * - `src/ui/strings.ts`, the front end's legacy English-only table, if any
 * - `vo/out/cues.json` and `vo/out/<lang>/`, rendered VO takes
 * - `src/scenes`, `src/ui`, `src/director`, `src/main.ts`, for references
 *
 *   deno run -A qa/coverage.ts      # prints JSON
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
import {
  OVERFLOW_MIN_WIDTH,
  OVERFLOW_RATIO,
  placeholders,
  sameplaceholders,
  scanIds,
  visualWidth,
  widthRatio,
} from "./lib/text.ts";

const LANGS = ["en", "es", "zh"] as const;
type Lang = typeof LANGS[number];

/** ASR similarity below this is worth a listen; below the floor, re-render. */
const ASR_WARN = 0.9;
const ASR_FLOOR = 0.7;

type Texts = Partial<Record<Lang, string>>;

interface ScriptEntry {
  readonly speaker?: string;
  readonly optional?: boolean;
  readonly text: Texts;
}

interface Take {
  readonly file?: string;
  readonly vtt?: string;
  readonly duration?: number;
  readonly text?: string;
  readonly asr_similarity?: number;
}

interface CuesJson {
  readonly lines?: Record<
    string,
    { readonly langs?: Partial<Record<Lang, Take>> }
  >;
}

/** One row of the full matrix, kept in coverage.json for tooling. */
export interface CoverageRow {
  readonly id: string;
  readonly kind: "script" | "ui" | "ui-legacy";
  readonly lang: Lang;
  readonly present: boolean;
  readonly placeholdersOk: boolean;
  readonly widthRatio: number;
  readonly overflowRisk: boolean;
  readonly audio?: boolean;
  readonly duration?: number;
  readonly asr?: number;
  readonly subtitle?: boolean;
  readonly staleTake?: boolean;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function importTable(
  path: string,
  exportName: string,
): Promise<Record<string, unknown> | string> {
  try {
    const mod = await import(`file://${repo(path)}`);
    const table = mod[exportName];
    return table && typeof table === "object"
      ? table as Record<string, unknown>
      : `${path} has no export ${exportName}`;
  } catch (err) {
    return `${path} failed to load: ${String(err).split("\n")[0]}`;
  }
}

async function loadYamlScript(): Promise<Map<string, ScriptEntry> | string> {
  try {
    const doc = parseYaml(await Deno.readTextFile(repo("vo/script.yaml"))) as {
      lines?: Array<Record<string, unknown>>;
    };
    const out = new Map<string, ScriptEntry>();
    for (const line of doc.lines ?? []) {
      const text: Texts = {};
      for (const lang of LANGS) {
        if (typeof line[lang] === "string") text[lang] = String(line[lang]);
      }
      out.set(String(line.id), {
        speaker: String(line.speaker),
        optional: line.optional === true,
        text,
      });
    }
    return out;
  } catch (err) {
    return `vo/script.yaml failed to parse: ${String(err).split("\n")[0]}`;
  }
}

export async function coverage(): Promise<StageResult> {
  const checks: Check[] = [];
  const rows: CoverageRow[] = [];

  // -- load the tables
  const yaml = await loadYamlScript();
  const gen = await importTable("src/i18n/script.gen.ts", "SCRIPT_LINES");
  const uiOnly = await importTable("src/i18n/ui.ts", "UI_STRINGS");
  // Radio chatter and codex text are dotted ids with the same per-language
  // shape as UI strings (wave 3, agent N), so they get the same checks.
  const radio = await importTable("src/i18n/radio.ts", "RADIO_TEXT");
  const codex = await importTable("src/i18n/codex.ts", "CODEX_TEXT");
  const ui = typeof uiOnly === "string" ? uiOnly : {
    ...uiOnly,
    ...(typeof radio === "string" ? {} : radio),
    ...(typeof codex === "string" ? {} : codex),
  };
  const legacyPath = "src/ui/strings.ts";
  const legacy = (await exists(repo(legacyPath)))
    ? await importTable(legacyPath, "UI_STRINGS_EN")
    : {};
  for (
    const [name, t] of [
      ["vo/script.yaml", yaml],
      ["script.gen.ts", gen],
      ["i18n/ui.ts", uiOnly],
      ["i18n/radio.ts", radio],
      ["i18n/codex.ts", codex],
      ["ui/strings.ts", legacy],
    ] as const
  ) {
    if (typeof t === "string") {
      checks.push({ id: `coverage.load.${name}`, status: "fail", detail: t });
    }
  }
  const script = yaml instanceof Map ? yaml : new Map<string, ScriptEntry>();
  const genTable = typeof gen === "string" ? {} : gen;
  const uiTable = typeof ui === "string" ? {} : ui as Record<string, Texts>;
  const legacyTable = typeof legacy === "string"
    ? {}
    : legacy as Record<string, string>;

  // -- generated table is in sync with the YAML
  const stale: string[] = [];
  for (const [id, entry] of script) {
    const g = genTable[id] as { text?: Texts } | undefined;
    if (!g) stale.push(`${id}: missing from script.gen.ts`);
    else if (
      LANGS.some((l) => norm(g.text?.[l] ?? "") !== norm(entry.text[l] ?? ""))
    ) {
      stale.push(`${id}: text differs`);
    }
  }
  for (const id of Object.keys(genTable)) {
    if (!script.has(id)) stale.push(`${id}: in script.gen.ts, not in YAML`);
  }
  checks.push(listCheck(
    "coverage.scriptGen.fresh",
    stale,
    "script.gen.ts matches vo/script.yaml",
    (n) =>
      `script.gen.ts is stale for ${n} lines; run deno run --allow-read --allow-write src/i18n/gen_script.ts`,
  ));

  // -- id collisions across tables
  const collisions = Object.keys(uiTable).filter((id) => script.has(id));
  checks.push(listCheck(
    "coverage.ids.unique",
    collisions,
    "UI and script ids are disjoint",
    (n) => `${n} ids defined in both the script and ui.ts`,
  ));

  // -- VO takes
  const cues = await readJson<CuesJson>(repo("vo/out/cues.json"));
  if (!cues) {
    checks.push({
      id: "coverage.vo.cues",
      status: "fail",
      detail: "vo/out/cues.json missing or unreadable",
    });
  }

  // -- the matrix
  const missing: Record<Lang, string[]> = { en: [], es: [], zh: [] };
  const badPlaceholders: string[] = [];
  const overflow: string[] = [];
  const noAudio: Record<Lang, string[]> = { en: [], es: [], zh: [] };
  const noSubtitle: string[] = [];
  const lowAsr: string[] = [];
  const brokenAsr: string[] = [];
  const staleTakes: string[] = [];
  const missingFiles: string[] = [];

  async function judge(
    id: string,
    kind: CoverageRow["kind"],
    text: Texts,
    entry?: ScriptEntry,
  ): Promise<void> {
    const en = text.en ?? "";
    for (const lang of LANGS) {
      const value = text[lang];
      const present = typeof value === "string" && value.trim() !== "";
      if (!present) missing[lang].push(id);
      const placeholdersOk = !present || sameplaceholders(en, value);
      if (!placeholdersOk) {
        badPlaceholders.push(
          `${id} [${lang}]: en {${placeholders(en)}} vs {${
            placeholders(value!)
          }}`,
        );
      }
      const ratio = present ? widthRatio(en, value) : 0;
      const overflowRisk = lang !== "en" && present &&
        visualWidth(en) >= OVERFLOW_MIN_WIDTH && ratio > OVERFLOW_RATIO;
      if (overflowRisk && kind !== "script") {
        overflow.push(`${id} [${lang}] x${ratio.toFixed(2)}`);
      }
      let row: CoverageRow = {
        id,
        kind,
        lang,
        present,
        placeholdersOk,
        widthRatio: Number(ratio.toFixed(2)),
        overflowRisk,
      };
      if (kind === "script") {
        const take = cues?.lines?.[id]?.langs?.[lang];
        const wav = take?.file ? repo(`vo/out/${take.file}`) : null;
        const vtt = take?.vtt ? repo(`vo/out/${take.vtt}`) : null;
        const audio = wav !== null && await exists(wav);
        const subtitle = vtt !== null && await exists(vtt);
        if (take?.file && !audio) missingFiles.push(take.file);
        if (!audio && !entry?.optional) noAudio[lang].push(id);
        if (audio && !subtitle) noSubtitle.push(`${id} [${lang}]`);
        const asr = take?.asr_similarity;
        if (audio && typeof asr === "number") {
          if (asr < ASR_FLOOR) {
            brokenAsr.push(`${id} [${lang}] ${asr.toFixed(2)}`);
          } else if (asr < ASR_WARN) {
            lowAsr.push(`${id} [${lang}] ${asr.toFixed(2)}`);
          }
        }
        const staleTake = audio && present && typeof take?.text === "string" &&
          norm(take.text) !== norm(value);
        if (staleTake) staleTakes.push(`${id} [${lang}]`);
        row = {
          ...row,
          audio,
          duration: take?.duration,
          asr,
          subtitle,
          staleTake,
        };
      }
      rows.push(row);
    }
  }

  for (const [id, entry] of script) {
    await judge(id, "script", entry.text, entry);
  }
  for (const [id, text] of Object.entries(uiTable)) await judge(id, "ui", text);
  const legacyOnly = Object.keys(legacyTable).filter((id) => !(id in uiTable));
  for (const id of legacyOnly) {
    await judge(id, "ui-legacy", { en: legacyTable[id] });
  }

  for (const lang of LANGS) {
    checks.push(listCheck(
      `coverage.text.${lang}`,
      missing[lang],
      `every id has ${lang} text`,
      (n) => `${n} ids lack ${lang} text`,
    ));
  }
  checks.push(listCheck(
    "coverage.legacyStrings",
    legacyOnly,
    "no ids live only in src/ui/strings.ts",
    (n) =>
      `${n} ids exist only in the English-only src/ui/strings.ts (not yet merged into src/i18n/ui.ts)`,
  ));
  checks.push(listCheck(
    "coverage.placeholders",
    badPlaceholders,
    "placeholder sets match English everywhere",
    (n) => `${n} translations change the {placeholder} set`,
  ));
  checks.push(listCheck(
    "coverage.overflowRisk",
    overflow,
    `no UI translation exceeds ${OVERFLOW_RATIO}x English width`,
    (n) =>
      `${n} UI translations exceed ${OVERFLOW_RATIO}x English width (CJK counted ${1.8}x); confirm in menus-es / menus-zh reels`,
    "warn",
  ));
  for (const lang of LANGS) {
    checks.push(listCheck(
      `coverage.vo.audio.${lang}`,
      noAudio[lang],
      `every required line has ${lang} audio`,
      (n) => `${n} of ${script.size} lines lack rendered ${lang} audio`,
      "warn",
    ));
  }
  checks.push(listCheck(
    "coverage.vo.files",
    missingFiles,
    "every take in cues.json has its wav on disk",
    (n) => `${n} takes in cues.json point at missing files`,
  ));
  checks.push(listCheck(
    "coverage.vo.subtitles",
    noSubtitle,
    "every rendered take has a subtitle cue file",
    (n) => `${n} rendered takes lack a .vtt`,
  ));
  checks.push(listCheck(
    "coverage.vo.asr",
    lowAsr,
    `every take scores ASR >= ${ASR_WARN}`,
    (n) => `${n} takes score ASR ${ASR_FLOOR}-${ASR_WARN}; listen`,
    "warn",
  ));
  checks.push(listCheck(
    "coverage.vo.asrFloor",
    brokenAsr,
    `no take scores ASR < ${ASR_FLOOR}`,
    (n) => `${n} takes score ASR < ${ASR_FLOOR}; re-render (reseed)`,
  ));
  checks.push(listCheck(
    "coverage.vo.staleTakes",
    staleTakes,
    "every take was rendered from the current text",
    (n) => `${n} takes were rendered from older text; re-render`,
    "warn",
  ));

  // -- references in code
  const known = new Set([
    ...script.keys(),
    ...Object.keys(uiTable),
    ...Object.keys(legacyTable),
  ]);
  const files = [
    ...await walk("src/scenes", /\.ts$/),
    ...await walk("src/ui", /\.ts$/),
    ...await walk("src/director", /\.ts$/),
    "src/main.ts",
  ].filter((f) => f !== legacyPath);
  const dangling: string[] = [];
  let refCount = 0;
  for (const file of files) {
    let source: string;
    try {
      source = await Deno.readTextFile(repo(file));
    } catch {
      continue;
    }
    for (const ref of scanIds(source, file)) {
      refCount++;
      const ok = ref.dynamic
        ? [...known].some((id) => id.startsWith(ref.id))
        : known.has(ref.id);
      if (!ok) {
        dangling.push(
          `${ref.file}:${ref.line} ${ref.id}${ref.dynamic ? "*" : ""}`,
        );
      }
    }
  }
  checks.push(listCheck(
    "coverage.references",
    dangling,
    `all ${refCount} id references in scenes and UI resolve`,
    (n) => `${n} of ${refCount} id references in code resolve to no table`,
  ));

  // -- tables for the dashboard
  const perLang: Table = {
    title: "Coverage by language",
    columns: [
      "kind",
      "lang",
      "ids",
      "text",
      "audio",
      "subtitle",
      "overflow risk",
    ],
    rows: (["script", "ui", "ui-legacy"] as const).flatMap((kind) =>
      LANGS.map((lang) => {
        const r = rows.filter((x) => x.kind === kind && x.lang === lang);
        return [
          kind,
          lang,
          r.length,
          r.filter((x) => x.present).length,
          kind === "script" ? r.filter((x) => x.audio).length : "",
          kind === "script" ? r.filter((x) => x.subtitle).length : "",
          r.filter((x) => x.overflowRisk).length,
        ];
      })
    ).filter((row) => row[2] !== 0),
  };
  const problems: Table = {
    title:
      "Rows needing attention (missing text, placeholder drift, overflow risk, weak take)",
    columns: [
      "id",
      "kind",
      "lang",
      "text",
      "placeholders",
      "width ratio",
      "audio s",
      "ASR",
    ],
    rows: rows
      .filter((r) =>
        !r.present || !r.placeholdersOk ||
        (r.overflowRisk && r.kind !== "script") ||
        (typeof r.asr === "number" && r.asr < ASR_WARN) || r.staleTake
      )
      .slice(0, 400)
      .map((r) => [
        r.id,
        r.kind,
        r.lang,
        r.present ? "yes" : "MISSING",
        r.placeholdersOk ? "ok" : "DRIFT",
        r.widthRatio,
        r.duration ?? "",
        typeof r.asr === "number" ? r.asr.toFixed(2) : "",
      ]),
  };
  const takes: Table = {
    title: "Rendered VO takes",
    columns: ["id", "lang", "duration s", "ASR", "subtitle", "stale"],
    rows: rows.filter((r) => r.audio).map((r) => [
      r.id,
      r.lang,
      r.duration ?? "",
      typeof r.asr === "number" ? r.asr.toFixed(2) : "",
      r.subtitle ? "yes" : "NO",
      r.staleTake ? "STALE" : "",
    ]),
  };

  return {
    stage: "coverage",
    checks,
    tables: [perLang, takes, problems],
    stats: {
      scriptLines: script.size,
      uiStrings: Object.keys(uiTable).length,
      legacyOnly: legacyOnly.length,
      rows: rows.length,
      takes: rows.filter((r) => r.audio).length,
      references: refCount,
    },
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await coverage(), null, 2));
}
