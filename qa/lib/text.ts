/**
 * Pure text helpers for the translation coverage report. No file access, so
 * `tests/qa_text_test.ts` can pin their behavior.
 */

/** The `{name}` placeholders in a template, sorted and deduplicated. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    .sort();
}

/** True when both templates use exactly the same placeholders. */
export function sameplaceholders(a: string, b: string): boolean {
  const pa = placeholders(a);
  const pb = placeholders(b);
  return pa.length === pb.length && pa.every((p, i) => p === pb[i]);
}

/**
 * Approximate rendered width in "Latin character" units. Character count is
 * the wrong measure across scripts: a CJK ideograph or full-width punctuation
 * mark is set on a full em, while an average Latin glyph is about 0.55 em, so
 * one CJK character costs about 1.8 Latin characters. Placeholders count as
 * four units (a key glyph or a short number).
 */
export const CJK_WIDTH = 1.8;

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

export function visualWidth(text: string): number {
  let width = 0;
  for (const ch of text.replace(/\{\w+\}/g, "\u0000")) {
    if (ch === "\u0000") width += 4;
    else width += WIDE.test(ch) ? CJK_WIDTH : 1;
  }
  return width;
}

/** Width of a translation relative to its English source (1 = same width). */
export function widthRatio(english: string, other: string): number {
  const base = visualWidth(english);
  return base === 0 ? 1 : visualWidth(other) / base;
}

/** Above this width ratio a translation is flagged as an overflow risk. */
export const OVERFLOW_RATIO = 1.35;

/**
 * Short strings swing wildly in ratio ("On" to "Activado" is 4x) without
 * being a layout problem in a padded button, so only strings at least this
 * wide in English are judged by ratio.
 */
export const OVERFLOW_MIN_WIDTH = 6;

/** A spoken line id: `tut_move_001`, `brief_warden_004`. */
export const SCRIPT_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*_\d{3}$/;
/** A UI string id: `ui.menu.newGame`. */
export const UI_ID = /^ui\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;

export interface IdReference {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  /** True for a template literal prefix such as `ui.settings.tab.${tab}`. */
  readonly dynamic: boolean;
}

/**
 * Finds every string literal in TypeScript source that looks like a line id.
 * A static scan: it cannot follow ids built from variables, but it catches
 * the common failure (a typo or a deleted id still referenced by a timeline
 * or menu). Template literals with a `${` report their static prefix.
 */
export function scanIds(source: string, file: string): IdReference[] {
  const out: IdReference[] = [];
  const lines = source.split("\n");
  lines.forEach((text, i) => {
    if (/^\s*(\*|\/\/)/.test(text)) return; // comments document ids, not use
    for (const m of text.matchAll(/"([^"\\\n]+)"|`([^`\\\n]+)`/g)) {
      const literal = m[1] ?? m[2];
      if (m[2] !== undefined && literal.includes("${")) {
        const prefix = literal.slice(0, literal.indexOf("${"));
        if (/^ui\.[A-Za-z0-9_.]+\.$/.test(prefix)) {
          out.push({ id: prefix, file, line: i + 1, dynamic: true });
        }
        continue;
      }
      if (SCRIPT_ID.test(literal) || UI_ID.test(literal)) {
        out.push({ id: literal, file, line: i + 1, dynamic: false });
      }
    }
  });
  return out;
}
