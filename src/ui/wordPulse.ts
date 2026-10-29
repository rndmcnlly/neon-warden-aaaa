/**
 * Word-level subtitle timing: which word of a caption is being spoken now.
 * Pure functions, so tests run without a browser or audio.
 *
 * Word timings (`WordTiming`, from T's forced alignment) index the FULL
 * subtitle text of a line, but the caption on screen may be one chunk of
 * it (long lines are split into timed pieces). `segmentChunk` maps the
 * line-level offsets onto the visible chunk; words outside it are dropped.
 * A take with no timings yields one plain segment: graceful fallback.
 */

import type { WordTiming } from "../contracts/index.ts";

export interface Segment {
  readonly text: string;
  /** Index into the line's `words`, or -1 for the text between words. */
  readonly word: number;
}

/**
 * Splits `chunk` (a piece of `full`) into word and gap segments. Returns a
 * single gap segment if the chunk cannot be located or there are no words.
 */
export function segmentChunk(
  full: string,
  chunk: string,
  words: readonly WordTiming[] | undefined,
): Segment[] {
  const offset = full.indexOf(chunk);
  if (!words || words.length === 0 || offset < 0) {
    return [{ text: chunk, word: -1 }];
  }
  const out: Segment[] = [];
  let cursor = 0;
  words.forEach((w, i) => {
    const start = w.charStart - offset;
    const end = w.charEnd - offset;
    if (end <= cursor || start >= chunk.length || start < cursor) return;
    if (start > cursor) {
      out.push({ text: chunk.slice(cursor, start), word: -1 });
    }
    const clipped = Math.min(end, chunk.length);
    out.push({ text: chunk.slice(start, clipped), word: i });
    cursor = clipped;
  });
  if (cursor < chunk.length) out.push({ text: chunk.slice(cursor), word: -1 });
  return out;
}

/**
 * The word being spoken `t` seconds into the take, or -1 before the first
 * word and after the last. Between two words the earlier one stays lit, so
 * the highlight does not flicker across short pauses.
 */
export function activeWord(words: readonly WordTiming[], t: number): number {
  if (words.length === 0 || t < words[0].startS) return -1;
  if (t >= words[words.length - 1].endS) return -1;
  let lo = 0;
  let hi = words.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (words[mid].startS <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
