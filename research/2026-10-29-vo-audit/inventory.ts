/**
 * VO inventory: every line id the game can speak, against the script, the
 * raw takes in `vo/out/` and the shipped Opus in `public/vo/`, per language.
 *
 *   deno run -A research/2026-10-29-vo-audit/inventory.ts [--json out.json]
 *
 * Read-only. Prints a markdown summary; `--json` also writes every row.
 * Never reads audio content: only sidecars, manifests and file existence.
 */

import { parse } from "jsr:@std/yaml@^1";
import {
  BARK_LINES,
  fightChatter,
  noFireChatter,
  RADIO_LINES,
  spokenLines,
  TIMELINES,
} from "../../src/scenes/index.ts";
import { allVariants } from "../../src/scenes/banks/index.ts";

const LANGS = ["en", "es", "zh"] as const;
type Lang = typeof LANGS[number];
const ASR_FLOOR = 0.85;

interface ScriptLine {
  id: string;
  speaker: string;
  scene: string;
  optional?: boolean;
  route?: string;
  en: string;
  es: string;
  zh: string;
}
const script = parse(await Deno.readTextFile("vo/script.yaml")) as {
  speakers: Record<string, unknown>;
  lines: ScriptLine[];
};
const byId = new Map(script.lines.map((l) => [l.id, l]));

// Where each id is referenced from.
const refs = new Map<string, Set<string>>();
const ref = (id: string, where: string) => {
  if (!refs.has(id)) refs.set(id, new Set());
  refs.get(id)!.add(where);
};
for (const tl of TIMELINES) {
  for (const id of spokenLines(tl.cues)) ref(id, `timeline:${tl.id}`);
}
for (const id of fightChatter.lines) ref(id, "chatter:fight");
for (const id of noFireChatter.lines) ref(id, "chatter:noFire");
for (const id of BARK_LINES) ref(id, "barks");
for (const id of RADIO_LINES) ref(id, "radio");
for (const v of allVariants()) {
  ref(v.id, `bank:${v.bank.id}${v.vo ? "" : ":text"}`);
}
// Literal VO-looking ids anywhere else in src/ (director, app, ui).
const ID_RE = /["'`]((?:tut|var|stat|bark|amb|rad|rec|boss|end|fb|wd|sec|cred|beat|chat|flash|pil)[a-z0-9]*_[a-z0-9_]*\d{3})["'`]/g;
for await (const f of walk("src")) {
  if (!/\.ts$/.test(f) || f.includes("script.gen.ts")) continue;
  const text = await Deno.readTextFile(f);
  for (const m of text.matchAll(ID_RE)) {
    if (!refs.has(m[1])) ref(m[1], `literal:${f}`);
  }
}
async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) yield* walk(p);
    else yield p;
  }
}

// Pending VO files.
const pending: string[] = [];
const pendingDir = await Deno.stat("vo/pending").then(() => true, () => false);
for await (const e of pendingDir ? Deno.readDir("vo/pending") : []) {
  if (!e.name.endsWith(".yaml")) continue;
  const y = parse(await Deno.readTextFile(`vo/pending/${e.name}`)) as {
    lines?: ScriptLine[];
  };
  for (const l of y.lines ?? []) {
    pending.push(l.id);
    ref(l.id, `pending:${e.name}`);
  }
}

const readJson = async <T>(p: string): Promise<T | null> => {
  try {
    return JSON.parse(await Deno.readTextFile(p)) as T;
  } catch {
    return null;
  }
};
const exists = (p: string) => Deno.stat(p).then(() => true, () => false);

// deno-lint-ignore no-explicit-any
type Json = any;
const outCues = (await readJson<Json>("vo/out/cues.json"))?.lines ?? {};
const pubCues = (await readJson<Json>("public/vo/cues.json"))?.lines ?? {};
const stamps = (await readJson<Json>("public/vo/stamps.json")) ?? {};
const variants = (await readJson<Json>("public/vo/variants/index.json")) ?? {};
const original = variants.speakers?.tutorial_ai?.variants?.original?.lines ??
  {};

interface Row {
  id: string;
  speaker: string;
  scene: string;
  refs: string[];
  inScript: boolean;
  textOnly: boolean;
  langs: Record<Lang, {
    wav: boolean;
    current: boolean;
    asr?: number;
    duration?: number;
    words: number;
    alignOk?: boolean;
    lufs?: number;
    dbtp?: number;
    ogg: boolean;
    pubHash?: string;
    outHash?: string;
    synced: boolean;
    textMatch: boolean;
    original: boolean;
  }>;
  problems: string[];
}

const ids = new Set<string>([...byId.keys(), ...refs.keys()]);
const rows: Row[] = [];
for (const id of [...ids].sort()) {
  const line = byId.get(id);
  const r = [...(refs.get(id) ?? [])];
  const textOnly = !line && (id.startsWith("bank.") || id.startsWith("radio."));
  const row: Row = {
    id,
    speaker: line?.speaker ?? "?",
    scene: line?.scene ?? "?",
    refs: r,
    inScript: !!line,
    textOnly,
    langs: {} as Row["langs"],
    problems: [],
  };
  if (!line && !textOnly) row.problems.push("referenced but not in script");
  if (line && r.length === 0) row.problems.push("orphan script line");
  for (const lang of LANGS) {
    const wav = await exists(`vo/out/${lang}/${id}.wav`);
    const side = await readJson<Json>(`vo/out/${lang}/${id}.json`);
    const oc = outCues[id]?.langs?.[lang];
    const pc = pubCues[id]?.langs?.[lang];
    const ogg = await exists(`public/vo/${lang}/${id}.ogg`);
    const stamp = stamps[`${lang}/${id}.ogg`];
    const want = line ? line[lang].split(/\s+/).join(" ") : "";
    const info = {
      wav,
      current: false,
      asr: side?.asr_similarity ?? oc?.asr_similarity,
      duration: oc?.duration ?? side?.duration,
      words: (pc?.words ?? oc?.words ?? []).length,
      alignOk: pc?.align?.ok ?? oc?.align?.ok,
      lufs: pc?.loudness?.lufs ?? oc?.loudness?.lufs,
      dbtp: pc?.loudness?.true_peak_dbtp ?? oc?.loudness?.true_peak_dbtp,
      ogg,
      pubHash: pc?.hash,
      outHash: oc?.hash,
      synced: !!pc && !!oc && pc.hash === oc.hash &&
        (typeof stamp === "string" ? stamp : stamp?.key ?? "").includes(
          oc.hash,
        ),
      textMatch: !!pc && pc.text === want,
      original: !!original[id]?.[lang],
    };
    info.current = !!side && side.hash === oc?.hash;
    row.langs[lang] = info;
    if (!line) continue;
    if (!ogg) row.problems.push(`${lang}: no shipped ogg`);
    if (pc && !info.textMatch) row.problems.push(`${lang}: stale text`);
    if (!pc) row.problems.push(`${lang}: not in public cues`);
    if (pc && pubCues[id].speaker !== line.speaker) {
      row.problems.push(`${lang}: speaker tag ${pubCues[id].speaker}`);
    }
    if (pc && pubCues[id].scene !== line.scene) {
      row.problems.push(`${lang}: scene tag ${pubCues[id].scene}`);
    }
    if (typeof info.asr === "number" && info.asr < ASR_FLOOR) {
      row.problems.push(`${lang}: asr ${info.asr}`);
    }
    if (pc && info.words === 0) row.problems.push(`${lang}: no words`);
    if (pc && info.alignOk === false) row.problems.push(`${lang}: align !ok`);
    if (pc && (info.lufs === undefined || info.dbtp === undefined)) {
      row.problems.push(`${lang}: no loudness`);
    }
    if (pc && typeof info.dbtp === "number" && info.dbtp > -1.0) {
      row.problems.push(`${lang}: true peak ${info.dbtp}`);
    }
    if (pc && !(info.duration! > 0.3 && info.duration! < 40)) {
      row.problems.push(`${lang}: duration ${info.duration}`);
    }
    if (pc) {
      const w = pc.words as {
        startS: number;
        endS: number;
        charStart: number;
        charEnd: number;
      }[];
      let last = 0;
      for (const x of w) {
        if (
          x.startS < last - 0.05 || x.endS < x.startS ||
          x.endS > (info.duration ?? 0) + 0.1 ||
          x.charEnd > pc.text.length
        ) {
          row.problems.push(`${lang}: word timing insane`);
          break;
        }
        last = x.startS;
      }
    }
  }
  rows.push(row);
}

// Summaries.
const voiced = rows.filter((r) => r.inScript);
const textOnly = rows.filter((r) => r.textOnly);
const lines: string[] = [];
lines.push(
  `script lines: ${voiced.length}; text-only referenced ids: ${textOnly.length}; pending ids: ${pending.length}`,
);
lines.push("", "| lang | script | wav current | shipped ogg | synced | text match | asr<0.85 | no words | align !ok |", "|---|---|---|---|---|---|---|---|---|");
for (const lang of LANGS) {
  const L = voiced.map((r) => r.langs[lang]);
  lines.push(
    `| ${lang} | ${L.length} | ${L.filter((x) => x.current).length} | ${
      L.filter((x) => x.ogg).length
    } | ${L.filter((x) => x.synced).length} | ${
      L.filter((x) => x.textMatch).length
    } | ${L.filter((x) => (x.asr ?? 1) < ASR_FLOOR).length} | ${
      L.filter((x) => x.ogg && x.words === 0).length
    } | ${L.filter((x) => x.alignOk === false).length} |`,
  );
}
const speakers = [...new Set(voiced.map((r) => r.speaker))].sort();
lines.push("", "| speaker | lines | shipped all 3 langs | original-voice takes |", "|---|---|---|---|");
for (const s of speakers) {
  const R = voiced.filter((r) => r.speaker === s);
  lines.push(
    `| ${s} | ${R.length} | ${
      R.filter((r) => LANGS.every((l) => r.langs[l].ogg && r.langs[l].textMatch))
        .length
    } | ${
      s === "tutorial_ai"
        ? R.filter((r) => LANGS.every((l) => r.langs[l].original)).length
        : "-"
    } |`,
  );
}
const scenes = [...new Set(voiced.map((r) => r.scene))].sort();
lines.push("", "| scene | lines |", "|---|---|");
for (const s of scenes) {
  lines.push(`| ${s} | ${voiced.filter((r) => r.scene === s).length} |`);
}
const bad = rows.filter((r) => r.problems.length);
lines.push("", `rows with problems: ${bad.length}`);
for (const r of bad) lines.push(`- ${r.id} (${r.speaker}): ${r.problems.join("; ")}`);
const noOrig = voiced.filter((r) =>
  r.speaker === "tutorial_ai" && !LANGS.every((l) => r.langs[l].original)
);
lines.push("", `tutorial_ai lines without original-voice take: ${noOrig.length}`);
lines.push(noOrig.map((r) => r.id).join(" "));
console.log(lines.join("\n"));

const jsonAt = Deno.args.indexOf("--json");
if (jsonAt >= 0) {
  await Deno.writeTextFile(
    Deno.args[jsonAt + 1],
    JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1),
  );
}
