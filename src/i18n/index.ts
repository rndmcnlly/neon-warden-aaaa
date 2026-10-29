/**
 * Text lookup: the one way player-facing text reaches the screen.
 *
 *   t(id("ui.menu.newGame"), "es")                 -> "Nueva partida"
 *   t(id("ui.hud.serial"), "zh", { serial: "0122" }) -> "0122号飞行员"
 *
 * Two tables share one id space: spoken lines generated from
 * `vo/script.yaml` (see gen_script.ts) and UI strings in `ui.ts`. A missing
 * translation falls back to English; a missing id shows the id itself in
 * brackets, so the hole is visible on screen rather than silently blank.
 * Either case warns once in the console.
 */

import type { Lang, LineId, ScriptLine } from "../contracts/index.ts";
import { lineId } from "../contracts/index.ts";
import { SCRIPT_LINES } from "./script.gen.ts";
import { UI_STRINGS } from "./ui.ts";
import { RADIO_TEXT } from "./radio.ts";
import { CODEX_TEXT } from "./codex.ts";
import { BANK_TEXT } from "./banks.ts";
import type { LocalizedText, ScriptLineData } from "./types.ts";

export type { LocalizedText, Route, ScriptLineData } from "./types.ts";

/** Every spoken line id, as a literal type. */
export type ScriptKey = keyof typeof SCRIPT_LINES;
/** Every UI string id, as a literal type. */
export type UiKey = keyof typeof UI_STRINGS;
/** Text-only radio lines and callsigns (`radio.*`). */
export type RadioKey = keyof typeof RADIO_TEXT;
/** Codex entries (`codex.*`). */
export type CodexKey = keyof typeof CODEX_TEXT;
/** Any id that exists in any table. */
export type TextKey = ScriptKey | UiKey | RadioKey | CodexKey;

/** Values substituted into `{name}` placeholders. */
export type TextParams = Readonly<Record<string, string | number>>;

const script: Readonly<Record<string, ScriptLineData>> = SCRIPT_LINES;
const ui: Readonly<Record<string, LocalizedText>> = UI_STRINGS;
/**
 * Narrative's unspoken tables: radio text, the codex and text-only bank
 * variants (`bank.*`, keyed by plain strings, so they are not `TextKey`s).
 */
const narrative: Readonly<Record<string, LocalizedText>> = {
  ...RADIO_TEXT,
  ...CODEX_TEXT,
  ...BANK_TEXT,
};

/**
 * Turns a known id into a `LineId`. Prefer this over the contract's
 * `lineId()` in code: a typo here is a compile error, not a blank subtitle.
 */
export function id(key: TextKey): LineId {
  return lineId(key);
}

function entry(line: string): LocalizedText | undefined {
  return script[line]?.text ?? ui[line] ?? narrative[line];
}

/** True if the id exists in either table. */
export function hasText(line: string): boolean {
  return entry(line) !== undefined;
}

/** All known ids, for tests and tooling. */
export function allTextIds(): readonly string[] {
  return [
    ...Object.keys(script),
    ...Object.keys(ui),
    ...Object.keys(narrative),
  ];
}

// -- missing-text warnings (each problem reported once)

export type MissingTextHandler = (message: string) => void;

let onMissing: MissingTextHandler = (message) =>
  console.warn(`[i18n] ${message}`);
const reported = new Set<string>();

/** Replaces the warning sink (tests silence it; a dev overlay can collect it). */
export function setMissingTextHandler(handler: MissingTextHandler): void {
  onMissing = handler;
}

function warnOnce(key: string, message: string): void {
  if (reported.has(key)) return;
  reported.add(key);
  onMissing(message);
}

/**
 * Raw lookup with no fallback and no warning: `undefined` if this exact
 * language is missing. Matches the Director's `TextLookup` port.
 */
export function lookup(line: LineId, lang: Lang): string | undefined {
  return entry(line)?.[lang];
}

/** Player-facing text for `line` in `lang`, with English fallback and params. */
export function t(line: LineId, lang: Lang, params?: TextParams): string {
  const text = entry(line);
  if (text === undefined) {
    warnOnce(line, `unknown text id "${line}"`);
    return `[${line}]`;
  }
  let result = text[lang];
  if (result === undefined) {
    warnOnce(`${line}:${lang}`, `"${line}" has no ${lang} text; using English`);
    result = text.en;
  }
  return params ? fill(result, params) : result;
}

/** Replaces `{name}` with `params.name`; unknown names are left visible. */
function fill(template: string, params: TextParams): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * The full contract `ScriptLine` for a spoken line, with any missing
 * translation filled from English. `undefined` for UI ids.
 */
export function scriptLine(line: LineId): ScriptLine | undefined {
  const data = script[line];
  if (data === undefined) return undefined;
  const { en, es = en, zh = en } = data.text;
  return {
    id: line,
    speaker: data.speaker,
    scene: data.scene,
    direction: data.direction,
    text: { en, es, zh },
  };
}

/**
 * The subtitle name for a line's speaker, in `lang`. Radio speakers (scouts,
 * Lane Control) have no `ui.speaker.*` entry; their channel callsign stands in.
 */
export function speakerName(line: LineId, lang: Lang): string | undefined {
  const data = script[line];
  if (!data) return undefined;
  const name = `ui.speaker.${data.speaker}`;
  return t(lineId(name in ui ? name : `radio.callsign.${data.speaker}`), lang);
}
