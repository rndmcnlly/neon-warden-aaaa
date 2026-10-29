/**
 * Pure audio and timing helpers for the AV checks (no ffmpeg, no browser),
 * so they can be unit tested in tests/qa_audio_test.ts. qa/av.ts feeds them
 * PCM samples and spans that ffmpeg produced.
 *
 * Times are seconds on the reel clock (0 = the first video frame) unless a
 * name says otherwise.
 */

export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Parses `ffmpeg -af silencedetect` stderr into silent spans. An unclosed
 * silence (the file ends silent) runs to `duration`.
 */
export function parseSilence(stderr: string, duration: number): Span[] {
  const out: Span[] = [];
  let open: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && open !== null) {
      out.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: duration });
  return out;
}

/** The complement of `silent` within [0, duration]: where something is audible. */
export function audibleSpans(
  silent: readonly Span[],
  duration: number,
): Span[] {
  const out: Span[] = [];
  let t = 0;
  for (const s of [...silent].sort((a, b) => a.start - b.start)) {
    if (s.start > t) out.push({ start: t, end: s.start });
    t = Math.max(t, s.end);
  }
  if (t < duration) out.push({ start: t, end: duration });
  return out;
}

/** Seconds of `spans` that fall inside `window`. */
export function overlap(spans: readonly Span[], window: Span): number {
  let sum = 0;
  for (const s of spans) {
    sum += Math.max(
      0,
      Math.min(s.end, window.end) - Math.max(s.start, window.start),
    );
  }
  return sum;
}

export interface BalanceWindow {
  readonly t: number;
  /** RMS of the louder channel, in dBFS. */
  readonly db: number;
  /** (R - L) / (R + L) on RMS: -1 hard left, 0 centre, +1 hard right. */
  readonly balance: number;
}

/**
 * Per-window stereo balance from interleaved stereo float PCM. Windows
 * quieter than `floorDb` carry no image and are dropped.
 */
export function stereoBalance(
  pcm: Float32Array,
  rate: number,
  windowS = 0.1,
  floorDb = -50,
): BalanceWindow[] {
  const n = Math.max(1, Math.round(rate * windowS));
  const frames = Math.floor(pcm.length / 2);
  const out: BalanceWindow[] = [];
  for (let f0 = 0; f0 + n <= frames; f0 += n) {
    let l = 0;
    let r = 0;
    for (let f = f0; f < f0 + n; f++) {
      l += pcm[2 * f] ** 2;
      r += pcm[2 * f + 1] ** 2;
    }
    const lr = Math.sqrt(l / n);
    const rr = Math.sqrt(r / n);
    const db = 20 * Math.log10(Math.max(lr, rr, 1e-9));
    if (db < floorDb) continue;
    out.push({ t: f0 / rate, db, balance: (rr - lr) / (rr + lr) });
  }
  return out;
}

export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

/** Pearson correlation; NaN when either series is constant or too short. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] / n;
    my += ys[i] / n;
  }
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/**
 * Word-pulse alignment. `shown` are the moments (seconds, any clock) the
 * subtitle view highlighted word `index`; `words` are the cue's word start
 * times (seconds from line start). A shared offset (when the line started on
 * the page clock) is fitted as the median difference, and each highlight's
 * error is measured against it. Returns null when nothing pairs up.
 */
export function wordAlignment(
  shown: readonly { index: number; t: number }[],
  words: readonly number[],
):
  | { offset: number; maxErrMs: number; p95ErrMs: number; pairs: number }
  | null {
  // Keep the first highlight of each index (re-renders repeat the same word).
  const first = new Map<number, number>();
  for (const s of shown) {
    if (s.index >= 0 && s.index < words.length && !first.has(s.index)) {
      first.set(s.index, s.t);
    }
  }
  const pairs = [...first].map(([i, t]) => ({ d: t - words[i] }));
  if (!pairs.length) return null;
  const offset = quantile(pairs.map((p) => p.d), 0.5);
  const errs = pairs.map((p) => Math.abs(p.d - offset) * 1000);
  return {
    offset,
    maxErrMs: Math.max(...errs),
    p95ErrMs: quantile(errs, 0.95),
    pairs: pairs.length,
  };
}

/** Lowercase letters and digits (any script), split into tokens; CJK per character. */
export function tokens(text: string): string[] {
  const t = text.toLowerCase().normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  const out: string[] = [];
  for (const w of t.split(/\s+/).filter(Boolean)) {
    if (/\p{Script=Han}/u.test(w)) out.push(...[...w]);
    else out.push(w);
  }
  return out;
}

/** Token-set similarity in [0, 1] (Dice coefficient on multisets). */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const bag = new Map<string, number>();
  for (const t of tb) bag.set(t, (bag.get(t) ?? 0) + 1);
  let hit = 0;
  for (const t of ta) {
    const c = bag.get(t) ?? 0;
    if (c > 0) {
      hit++;
      bag.set(t, c - 1);
    }
  }
  return (2 * hit) / (ta.length + tb.length);
}

/** Best-matching script line for a heard transcript. */
export function bestLine(
  heard: string,
  lines: readonly { id: string; lang: string; text: string }[],
): { id: string; lang: string; score: number } | null {
  let best: { id: string; lang: string; score: number } | null = null;
  for (const l of lines) {
    // A heard fragment of a long line should still match: score against the
    // line's prefix of similar length as well as the whole line.
    const n = tokens(heard).length;
    const prefix = tokens(l.text).slice(0, Math.max(n + 2, 4)).join(" ");
    const score = Math.max(
      similarity(heard, l.text),
      similarity(heard, prefix),
    );
    if (!best || score > best.score) best = { id: l.id, lang: l.lang, score };
  }
  return best;
}
