/**
 * Cut sheets to an edit plan: pure, no browser and no ffmpeg.
 *
 * A cut sheet (trailer/cuts/*.yaml) names takes (capture recipes), shots
 * (which take, which moment, how long), a music edit list, VO placements and
 * localized cards. `planCut` turns that into absolute times for one language:
 * where each shot starts, which music segment plays, where each VO take lands
 * and how its caption is chunked, plus every warning a human should see
 * before compute is spent. Durations come from the shipped data
 * (public/music/manifest.json, public/vo/cues.json), never from the sheet.
 */

import { parse } from "jsr:@std/yaml@1";

export const ROOT = new URL("..", import.meta.url).pathname;
export const LANGS = ["en", "es", "zh"] as const;
export type Lang = typeof LANGS[number];
export type Localized = Record<Lang, string>;

// -- sheet shape (as written in YAML)

export type Step = Record<string, unknown> & { do: string };

export interface TakeSpec {
  query?: string;
  settings?: Record<string, unknown>;
  steps?: Step[];
  maxSeconds?: number;
  /** Import query, settings and steps from a QA reel; `{lang}` is replaced. */
  fromReel?: string;
  /** The take shows readable UI text, so each language needs its own take. */
  langSensitive?: boolean;
}

export type Anchor =
  | { event: string; where?: string; nth?: number }
  | { line: string; nth?: number }
  | { log: string; nth?: number }
  | { dom: string; match: string; nth?: number }
  | { at: number };

export interface ShotSpec {
  id: string;
  beats?: number;
  seconds?: number;
  purpose?: string;
  evidence?: string;
  take?: string;
  anchor?: Anchor;
  /** Where the anchor lands inside the shot, in beats (beat cuts) or seconds. */
  align?: number;
  /** Seconds added to the anchor time before aligning. */
  offset?: number;
  /** Game audio gain in dB for this shot. */
  game?: number;
  card?: string;
  chapter?: string;
  /** Lower-third card id overlaid on a gameplay shot. */
  label?: string;
  pending?: string;
}

export interface MusicSegment {
  cue?: string;
  from?: number;
  beats?: number;
  silence?: number;
  fadeOut?: number;
}

export interface CardSpec {
  style: "title" | "slate" | "tell" | "chapter" | "lower" | "placeholder";
  text?: Localized;
  small?: Localized;
}

export interface CutSheet {
  id: string;
  title: string;
  audience: "public" | "internal";
  targetSeconds: number;
  viewport: { width: number; height: number };
  master: { width: number; height: number; fps: number };
  loudness: { lufs: number; truePeak: number };
  captions: "burned+srt" | "burned" | "srt" | "game" | "none";
  speakerLabels: boolean;
  music: { cue?: string; edit: MusicSegment[]; duckUnderVoiceDb?: number };
  takes: Record<string, TakeSpec>;
  shots: ShotSpec[];
  vo?: { line: string; shot: string; offset: number }[];
  cards: Record<string, CardSpec>;
  chapters?: { id: string; title: Localized }[];
}

export async function loadSheet(id: string): Promise<CutSheet> {
  const text = await Deno.readTextFile(`${ROOT}trailer/cuts/${id}.yaml`);
  return parse(text) as CutSheet;
}

// -- shipped data

export interface CueInfo {
  src: string;
  bpm: number;
  beatOffset: number;
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
}

export async function musicManifest(): Promise<Record<string, CueInfo>> {
  const m = JSON.parse(
    await Deno.readTextFile(`${ROOT}public/music/manifest.json`),
  );
  return m.cues;
}

export interface VoTake {
  file: string;
  duration: number;
  text: string;
  words: {
    text: string;
    charStart: number;
    charEnd: number;
    startS: number;
    endS: number;
  }[];
}
export interface VoLine {
  speaker: string;
  langs: Record<Lang, VoTake>;
}

export async function voCues(): Promise<Record<string, VoLine>> {
  const c = JSON.parse(await Deno.readTextFile(`${ROOT}public/vo/cues.json`));
  return c.lines;
}

export async function speakerNames(): Promise<Record<string, Localized>> {
  const { UI_STRINGS } = await import("../src/i18n/ui.ts");
  const out: Record<string, Localized> = {};
  for (const [k, v] of Object.entries(UI_STRINGS)) {
    if (k.startsWith("ui.speaker.")) out[k.slice(11)] = v as Localized;
  }
  return out;
}

// -- caption limits (research README, section 1: Netflix timed-text guides)

export const CAPTION_LIMITS: Record<Lang, { perLine: number; cps: number }> = {
  en: { perLine: 42, cps: 20 },
  es: { perLine: 42, cps: 17 }, // Latin-script assumption, not a citation
  zh: { perLine: 16, cps: 9 },
};
const MAX_LINES = 2;

// -- plan

export interface PlannedSegment {
  start: number;
  dur: number;
  /** The cue that sounds; absent in a silence. */
  cue?: string;
  /** The cue whose tempo times beat-timed shots (a silence keeps the last). */
  tempo?: string;
  /** Seconds into the cue file; may wrap at the loop point. */
  cueStart?: number;
  fadeOut?: number;
}

export interface PlannedShot {
  spec: ShotSpec;
  index: number;
  start: number;
  dur: number;
  /** Seconds per beat at the shot's start (0 for seconds-timed cuts). */
  beat: number;
  /** The anchor's position inside the shot, in seconds. */
  alignS: number;
}

export interface Caption {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface PlannedVo {
  line: string;
  speaker: string;
  file: string;
  start: number;
  dur: number;
  captions: Caption[];
}

export interface Plan {
  sheet: CutSheet;
  lang: Lang;
  seconds: number;
  segments: PlannedSegment[];
  shots: PlannedShot[];
  vo: PlannedVo[];
  warnings: string[];
}

export async function planCut(sheet: CutSheet, lang: Lang): Promise<Plan> {
  const warnings: string[] = [];
  const cues = await musicManifest();
  const lines = await voCues();
  const names = await speakerNames();

  // Music segments in absolute seconds.
  const segments: PlannedSegment[] = [];
  let t = 0;
  let lastCue = sheet.music.cue;
  for (const seg of sheet.music.edit) {
    if (seg.silence !== undefined) {
      const cue = cues[lastCue ?? ""];
      if (!cue) {
        throw new Error(`${sheet.id}: silence needs a tempo (no cue yet)`);
      }
      const dur = seg.silence * 60 / cue.bpm;
      // A silence keeps the previous tempo for beat-timed shots.
      segments.push({ start: t, dur, tempo: lastCue });
      t += dur;
      continue;
    }
    const name = seg.cue ?? sheet.music.cue;
    const cue = name ? cues[name] : undefined;
    if (!name || !cue) {
      throw new Error(`${sheet.id}: unknown music cue ${name}`);
    }
    lastCue = name;
    const spb = 60 / cue.bpm;
    const dur = (seg.beats ?? 0) * spb;
    segments.push({
      start: t,
      dur,
      cue: name,
      tempo: name,
      cueStart: cue.beatOffset + (seg.from ?? 0) * spb,
      fadeOut: seg.fadeOut,
    });
    t += dur;
  }
  const tempoAt = (time: number): number => {
    const s =
      segments.find((s) =>
        time >= s.start - 1e-6 && time < s.start + s.dur - 1e-6
      ) ?? segments.at(-1);
    return s?.tempo ? 60 / cues[s.tempo].bpm : 0;
  };

  // Shots.
  const shots: PlannedShot[] = [];
  t = 0;
  sheet.shots.forEach((spec, index) => {
    const beat = spec.beats !== undefined ? tempoAt(t) : 0;
    if (spec.beats !== undefined && !beat) {
      throw new Error(`${spec.id}: beats given but no music tempo at ${t}`);
    }
    const dur = spec.beats !== undefined
      ? spec.beats * beat
      : spec.seconds ?? 0;
    if (!(dur > 0)) throw new Error(`${spec.id}: no duration`);
    const alignS = (spec.align ?? 0) * (beat || 1);
    if (spec.take && !sheet.takes[spec.take]) {
      warnings.push(`${spec.id}: unknown take ${spec.take}`);
    }
    for (const c of [spec.card, spec.label]) {
      if (c && !sheet.cards[c]) warnings.push(`${spec.id}: unknown card ${c}`);
    }
    if (!spec.take && !spec.card) {
      warnings.push(`${spec.id}: neither take nor card`);
    }
    if (spec.pending) warnings.push(`${spec.id}: pending (${spec.pending})`);
    shots.push({ spec, index, start: t, dur, beat, alignS });
    t += dur;
  });
  const seconds = t;
  const musicEnd = segments.reduce((a, s) => Math.max(a, s.start + s.dur), 0);
  if (segments.length && Math.abs(musicEnd - seconds) > 0.05) {
    warnings.push(
      `music edit lasts ${musicEnd.toFixed(2)} s but shots last ${
        seconds.toFixed(2)
      } s`,
    );
  }
  for (const s of segments) {
    if (s.cue === undefined) continue;
    const near = shots.some((p) => Math.abs(p.start - s.start) < 0.02);
    if (!near) {
      warnings.push(`music segment at ${s.start.toFixed(2)} s is not on a cut`);
    }
  }
  if (Math.abs(seconds - sheet.targetSeconds) > 1.5) {
    warnings.push(
      `runs ${seconds.toFixed(1)} s, target ${sheet.targetSeconds} s`,
    );
  }

  // VO, checked in every language so one master never forces a re-cut.
  const vo: PlannedVo[] = [];
  const byShot = new Map(shots.map((s) => [s.spec.id, s]));
  for (const v of sheet.vo ?? []) {
    const shot = byShot.get(v.shot);
    const line = lines[v.line];
    if (!shot || !line) {
      warnings.push(`vo ${v.line}: unknown ${shot ? "line" : "shot"}`);
      continue;
    }
    const start = shot.start + v.offset * (shot.beat || 1);
    for (const l of LANGS) {
      const end = start + line.langs[l].duration;
      if (end > seconds) warnings.push(`vo ${v.line} [${l}] runs past the end`);
      for (const other of sheet.vo ?? []) {
        if (other === v) continue;
        const os = byShot.get(other.shot);
        if (!os) continue;
        const oStart = os.start + other.offset * (os.beat || 1);
        if (oStart > start && oStart < end + 0.15) {
          warnings.push(
            `vo ${v.line} [${l}] ends ${
              end.toFixed(2)
            } s, ${other.line} starts ${
              oStart.toFixed(2)
            } s (needs 0.15 s air)`,
          );
        }
      }
      // A line inside a silence must end before the music returns.
      for (const s of segments) {
        if (s.cue !== undefined) continue;
        const sEnd = s.start + s.dur;
        if (start >= s.start && start < sEnd && end > sEnd) {
          warnings.push(
            `vo ${v.line} [${l}] overruns the stopdown by ${
              (end - sEnd).toFixed(2)
            } s`,
          );
        }
      }
    }
    const take = line.langs[lang];
    const label = sheet.speakerLabels ? names[line.speaker]?.[lang] : undefined;
    vo.push({
      line: v.line,
      speaker: line.speaker,
      file: take.file,
      start,
      dur: take.duration,
      captions: chunkCaptions(take, lang, start, label),
    });
  }
  return { sheet, lang, seconds, segments, shots, vo, warnings };
}

/**
 * Splits one VO take into captions of at most two lines, at sentence (then
 * clause) boundaries, timed from the forced-aligned words when available.
 */
export function chunkCaptions(
  take: VoTake,
  lang: Lang,
  at: number,
  speaker?: string,
): Caption[] {
  const { perLine } = CAPTION_LIMITS[lang];
  const budget = perLine * MAX_LINES - (speaker ? speaker.length + 2 : 0);
  const text = take.text.replace(/\s+/g, " ").trim();
  const pieces = text.match(/[^.!?。！？]+[.!?。！？]*["”」]?\s*/g) ?? [text];
  const chunks: { text: string; from: number; to: number }[] = [];
  let pos = 0;
  for (const raw of pieces) {
    const from = text.indexOf(raw.trim(), pos);
    const to = from + raw.trim().length;
    pos = to;
    const last = chunks.at(-1);
    if (last && last.text.length + 1 + raw.trim().length <= budget) {
      last.text = `${last.text}${lang === "zh" ? "" : " "}${raw.trim()}`;
      last.to = to;
    } else chunks.push({ text: raw.trim(), from, to });
  }
  const timeAt = (char: number, end: boolean): number | undefined => {
    const ws = take.words.filter((w) =>
      end ? w.charEnd <= char + 1 : w.charStart >= char - 1
    );
    if (!ws.length) return undefined;
    return end ? ws.at(-1)!.endS : ws[0].startS;
  };
  return chunks.map((c, i) => {
    const s = i === 0 ? 0 : timeAt(c.from, false) ??
      take.duration * c.from / text.length;
    const e = i === chunks.length - 1 ? take.duration : timeAt(c.to, true) ??
      take.duration * c.to / text.length;
    return {
      start: at + s,
      end: at + Math.max(e, s + 0.8) + 0.25,
      text: c.text,
      speaker,
    };
  }).map((c, i, all) => {
    // Two empty frames between consecutive captions (Lieu).
    const next = all[i + 1];
    if (next && c.end > next.start - 0.07) c.end = next.start - 0.07;
    return c;
  });
}

// -- takes and their cache keys

export interface ResolvedTake {
  id: string;
  lang: Lang | "any";
  query: string;
  settings: Record<string, unknown>;
  steps: Step[];
  maxSeconds: number;
  viewport: { width: number; height: number };
  /**
   * "master": deterministic frame stepping (trailer/master.ts). Absent for
   * draft takes, so their recipe hashes (and cached takes) are unchanged.
   */
  capture?: "master";
}

export const GAME_FLAGS = "seed=121&qa=1";

export async function resolveTake(
  id: string,
  spec: TakeSpec,
  lang: Lang,
  viewport: { width: number; height: number },
): Promise<ResolvedTake> {
  let query = spec.query ?? "";
  let settings = structuredClone(spec.settings ?? {});
  let steps = spec.steps ?? [];
  let maxSeconds = spec.maxSeconds ?? 60;
  if (spec.fromReel) {
    const { REELS } = await import("../qa/reels.ts");
    const name = spec.fromReel.replace("{lang}", lang);
    const reel = REELS.find((r) => r.id === name);
    if (!reel) throw new Error(`take ${id}: no QA reel ${name}`);
    query = reel.query;
    settings = { ...structuredClone(reel.settings ?? {}), ...settings };
    steps = reel.steps as unknown as Step[];
    maxSeconds = spec.maxSeconds ?? reel.maxSeconds;
  }
  const sensitive = spec.langSensitive === true;
  if (sensitive) settings = { ...settings, textLang: lang, voiceLang: lang };
  if (!/[?&]seed=/.test(query)) {
    query += (query.includes("?") ? "&" : "?") + "seed=121";
  }
  if (!/[?&]qa=1/.test(query)) query += "&qa=1";
  return {
    id,
    lang: sensitive ? lang : "any",
    query,
    settings,
    steps,
    maxSeconds,
    viewport,
  };
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${
      Object.keys(v).sort().map((k) =>
        `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(v);
}

/** Cache key: the recipe plus the frozen build it runs against. */
export async function takeKey(
  t: ResolvedTake,
  buildId: string,
): Promise<string> {
  const { id: _id, ...recipe } = t;
  const bytes = new TextEncoder().encode(stable({ recipe, buildId }));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)].map((b) =>
    b.toString(16).padStart(2, "0")
  )
    .join("");
  return `${t.id}-${t.lang}-${hex.slice(0, 12)}`;
}

// -- anchors over a captured take's timeline

export interface TimelineEntry {
  t: number;
  k: "log" | "ev" | "dom";
  e?: unknown;
  name?: string;
  value?: string;
}

export function findAnchor(
  entries: TimelineEntry[],
  anchor: Anchor,
): number | undefined {
  if ("at" in anchor) return anchor.at;
  const nth = anchor.nth ?? 0;
  let hits: number[] = [];
  if ("event" in anchor) {
    const pred = anchor.where
      ? new Function("e", `return (${anchor.where});`) as (
        e: unknown,
      ) => boolean
      : () => true;
    hits = entries.filter((x) => {
      const e = x.e as { type?: string } | undefined;
      return x.k === "ev" && e?.type === anchor.event && pred(e);
    }).map((x) => x.t);
  } else if ("line" in anchor) {
    hits = entries.filter((x) => x.k === "log" && x.e === `line:${anchor.line}`)
      .map((x) => x.t);
  } else if ("log" in anchor) {
    hits = entries.filter((x) => x.k === "log" && x.e === anchor.log).map((x) =>
      x.t
    );
  } else if ("dom" in anchor) {
    hits = entries.filter((x) =>
      x.k === "dom" && x.name === anchor.dom &&
      (x.value ?? "").split(",").at(-1) === anchor.match
    ).map((x) => x.t);
  }
  return hits[nth];
}
