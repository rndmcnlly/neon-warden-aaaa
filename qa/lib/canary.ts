/**
 * The judge's listen-first canary (pure, unit tested): does what an omni
 * model claims to hear match the script and the voice the capture really
 * played? See qa/judge.ts.
 */

import { bestLine, overlap, type Span } from "./audio.ts";

export interface ScriptLine {
  readonly id: string;
  readonly lang: string;
  readonly text: string;
}

export interface Canary {
  readonly trusted: boolean;
  readonly detail: string;
  readonly heard: readonly {
    start_s: number;
    transcript: string;
    match: string | null;
    similarity: number;
    audible: boolean;
  }[];
}

/**
 * Trust the judgment when at least 75% of the lines it claims to hear both
 * match a script line (similarity at least 0.5) and fall where the capture
 * actually had audible voice. Claiming voice in a reel with none is an
 * automatic fail.
 */
export function canary(
  voLines: readonly { start_s: number; end_s: number; transcript: string }[],
  script: readonly ScriptLine[],
  audible: readonly Span[],
): Canary {
  const heard = voLines.map((v) => {
    const best = bestLine(v.transcript, script);
    const ok = best !== null && best.score >= 0.5;
    const win = { start: v.start_s - 1, end: Math.max(v.end_s, v.start_s) + 1 };
    return {
      start_s: v.start_s,
      transcript: v.transcript.slice(0, 200),
      match: ok ? `${best!.id}.${best!.lang}` : null,
      similarity: Math.round((best?.score ?? 0) * 100) / 100,
      audible: overlap(audible, win) > 0.2,
    };
  });
  if (!heard.length) {
    const voice = audible.reduce((n, s) => n + s.end - s.start, 0);
    return {
      trusted: voice < 1,
      detail: voice < 1
        ? "heard no voice, and the capture had none"
        : `heard no voice, but the capture had ${voice.toFixed(1)} s of it`,
      heard,
    };
  }
  const good = heard.filter((h) => h.match && h.audible).length;
  const trusted = good / heard.length >= 0.75;
  return {
    trusted,
    detail:
      `${good} of ${heard.length} heard lines match the script and the captured VO`,
    heard,
  };
}
