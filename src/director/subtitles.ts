/**
 * The subtitle model: what caption is on screen right now, and when it
 * changes. It holds no DOM; the UI subscribes and renders. Captions are cut
 * into chunks that fit the player's line cap (one or two lines), and each
 * chunk gets a share of the voice line's duration proportional to its length.
 *
 * Two slots: a scripted line always wins the screen over an ambient bark, so
 * a ducked bark keeps talking quietly but loses its caption until the
 * scripted line ends (then the bark's caption returns if it is still going).
 */

import type { Lang, LineId, Speaker } from "../contracts/index.ts";
import type { VoiceLayer } from "./ports.ts";

/** Characters per subtitle line: about 42 for Latin text, 16 for Chinese. */
export function charsPerLine(lang: Lang): number {
  return lang === "zh" ? 16 : 42;
}

/** Reading-speed estimate, used when a line has no rendered audio yet. */
export function estimateDurationMs(text: string, lang: Lang): number {
  const perChar = lang === "zh" ? 220 : 65;
  return Math.max(1500, [...text].length * perChar);
}

export interface SubtitleChunk {
  readonly text: string;
  /** Offsets from the start of the line, in ms. */
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Splits `text` into chunks of at most `maxChars` characters, breaking at
 * sentence ends first, then at spaces (or anywhere, for Chinese), and times
 * each chunk in proportion to its length.
 */
export function chunkSubtitle(
  text: string,
  lang: Lang,
  durationMs: number,
  maxChars: number,
): SubtitleChunk[] {
  const pieces: string[] = [];
  for (const sentence of splitSentences(text)) {
    pieces.push(...wrapToLength(sentence, maxChars, lang));
  }
  // Greedily rejoin short pieces so a chunk uses the room it has.
  const joiner = lang === "zh" ? "" : " ";
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last !== undefined && length(last + joiner + piece) <= maxChars) {
      chunks[chunks.length - 1] = last + joiner + piece;
    } else {
      chunks.push(piece);
    }
  }
  const total = chunks.reduce((sum, c) => sum + length(c), 0) || 1;
  let t = 0;
  return chunks.map((c) => {
    const startMs = t;
    t += (durationMs * length(c)) / total;
    return { text: c, startMs, endMs: t };
  });
}

function length(s: string): number {
  return [...s].length;
}

function splitSentences(text: string): string[] {
  // Keep the punctuation with its sentence: "Hi! Go." -> ["Hi!", "Go."].
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function wrapToLength(s: string, maxChars: number, lang: Lang): string[] {
  if (length(s) <= maxChars) return [s];
  if (lang === "zh") {
    const chars = [...s];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i += maxChars) {
      out.push(chars.slice(i, i + maxChars).join(""));
    }
    return out;
  }
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (length(next) > maxChars && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/** What the UI draws. `null` means no caption. */
export interface SubtitleView {
  readonly line: LineId;
  readonly speaker: Speaker | undefined;
  readonly text: string;
  readonly lang: Lang;
  readonly layer: VoiceLayer;
}

interface Utterance {
  readonly line: LineId;
  readonly speaker: Speaker | undefined;
  readonly lang: Lang;
  readonly startedAt: number;
  readonly chunks: readonly SubtitleChunk[];
}

export type SubtitleListener = (view: SubtitleView | null) => void;

export class SubtitleModel {
  private readonly slots: Record<VoiceLayer, Utterance | null> = {
    scripted: null,
    ambient: null,
  };
  private current: SubtitleView | null = null;
  private readonly listeners = new Set<SubtitleListener>();

  /** The caption on screen now. */
  get view(): SubtitleView | null {
    return this.current;
  }

  /** Calls `listener` whenever the caption changes. Returns unsubscribe. */
  subscribe(listener: SubtitleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  show(
    layer: VoiceLayer,
    line: LineId,
    speaker: Speaker | undefined,
    text: string,
    lang: Lang,
    durationMs: number,
    maxLines: 1 | 2,
    now: number,
  ): void {
    const chunks = chunkSubtitle(
      text,
      lang,
      durationMs,
      charsPerLine(lang) * maxLines,
    );
    this.slots[layer] = { line, speaker, lang, startedAt: now, chunks };
    this.update(now);
  }

  clear(layer: VoiceLayer, now: number): void {
    this.slots[layer] = null;
    this.update(now);
  }

  /** Advances chunks and expires finished lines. Call once per frame. */
  update(now: number): void {
    const next = this.viewOf("scripted", now) ?? this.viewOf("ambient", now);
    if (!sameView(next, this.current)) {
      this.current = next;
      for (const listener of this.listeners) listener(next);
    }
  }

  private viewOf(layer: VoiceLayer, now: number): SubtitleView | null {
    const u = this.slots[layer];
    if (!u) return null;
    const t = now - u.startedAt;
    const chunk = u.chunks.find((c) => t >= c.startMs && t < c.endMs);
    if (!chunk) {
      if (t >= (u.chunks.at(-1)?.endMs ?? 0)) this.slots[layer] = null;
      return null;
    }
    return {
      line: u.line,
      speaker: u.speaker,
      text: chunk.text,
      lang: u.lang,
      layer,
    };
  }
}

function sameView(a: SubtitleView | null, b: SubtitleView | null): boolean {
  if (a === null || b === null) return a === b;
  return a.line === b.line && a.text === b.text && a.layer === b.layer;
}
