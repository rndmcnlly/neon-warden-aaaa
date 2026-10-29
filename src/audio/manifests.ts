/**
 * The three audio manifests, parsed into small typed lookups. All pure (no
 * Web Audio), so the fallback rules are unit-tested.
 *
 * - VO: `vo/cues.json`, written by `vo/render.py`. Durations are measured
 *   from the rendered audio, so subtitle timing follows any re-render.
 * - UI sfx: `sfx/manifest.json`, written by `sfx/promote.py`.
 * - Music: `music/manifest.json`, written by `music/promote.py`.
 *
 * Paths are relative to the public root (`vo/en/x.wav`, `sfx/confirm.ogg`).
 */

import type {
  Lang,
  LineId,
  MusicCueId,
  Speaker,
  WordTiming,
} from "../contracts/index.ts";

// ------------------------------------------------------------------- VO

/** The parts of `cues.json` the game reads. */
export interface VoCuesFile {
  readonly lines: Readonly<
    Record<string, {
      readonly speaker: Speaker;
      readonly scene: string;
      readonly langs: Readonly<
        Partial<
          Record<Lang, {
            readonly file: string;
            readonly duration: number;
            /** Word-level timing (VO tech fills it; absent on old takes). */
            readonly words?: readonly WordTiming[];
            /** Measured leading silence, seconds (`scripts/vo_onset.ts`). */
            readonly onsetS?: number;
          }>
        >
      >;
    }>
  >;
}

export interface ResolvedVoice {
  /** The language actually used, after fallback. */
  readonly lang: Lang;
  readonly url: string;
  /** Audible length: the file's duration minus the skipped lead-in. */
  readonly durationMs: number;
  /** Where playback starts in the file, seconds (`voStartS`). */
  readonly startS: number;
}

/**
 * Leading silence kept before a take's measured onset, seconds: a breath of
 * air so the first consonant is not clipped, and short enough that a
 * subtitle and its voice arrive together. The Captain recast opens with
 * about 0.64 s of silence (research/2026-10-29-vo-audit/); without this the
 * subtitle led the voice by most of a second.
 */
export const VO_LEAD_KEEP_S = 0.12;

/**
 * Where to start playing a take: non-destructive, so the files and their
 * measured onsets stay as rendered and the policy can change here alone.
 * A take without a measurement plays from the top.
 */
export function voStartS(take: { readonly onsetS?: number }): number {
  const onset = take.onsetS ?? 0;
  return Math.max(0, Math.round((onset - VO_LEAD_KEEP_S) * 1000) / 1000);
}

/** Word timings moved onto the trimmed clock (the same `startS` shift). */
export function shiftWords(
  words: readonly WordTiming[],
  startS: number,
): readonly WordTiming[] {
  if (startS === 0) return words;
  return words.map((w) => ({
    ...w,
    startS: Math.max(0, w.startS - startS),
    endS: Math.max(0, w.endS - startS),
  }));
}

/** The language every line is guaranteed to try last. */
export const FALLBACK_VOICE_LANG: Lang = "en";

/**
 * A voice variant's own take for a line, if the chosen variant has one
 * (`src/audio/variants.ts`); same shape as a `cues.json` language entry.
 */
export type VariantTakeLookup = (
  line: LineId,
  speaker: Speaker,
  lang: Lang,
) =>
  | {
    readonly file: string;
    readonly duration: number;
    readonly words?: readonly WordTiming[];
    readonly onsetS?: number;
  }
  | undefined;

export class VoCatalog {
  /** Shifted word lists, so per-frame subtitle lookups do not allocate. */
  private readonly shifted = new WeakMap<
    readonly WordTiming[],
    readonly WordTiming[]
  >();

  constructor(
    private readonly data: VoCuesFile,
    /** Where `cues.json` lives; file paths in it are relative to here. */
    private readonly base = "vo/",
    /** The chosen voice variant's takes win over the base files. */
    private readonly variant: VariantTakeLookup = () => undefined,
  ) {}

  /** The take for one language: the variant's, else the base file's. */
  private take(line: LineId, lang: Lang) {
    const entry = this.data.lines[line];
    if (!entry) return undefined;
    return this.variant(line, entry.speaker, lang) ?? entry.langs[lang];
  }

  /** Picks `lang` if rendered, else English, else nothing. */
  resolve(line: LineId, lang: Lang): ResolvedVoice | undefined {
    const entry = this.data.lines[line];
    if (!entry) return undefined;
    for (const l of [lang, FALLBACK_VOICE_LANG]) {
      const take = this.take(line, l);
      if (take) {
        const startS = voStartS(take);
        return {
          lang: l,
          url: this.base + take.file,
          durationMs: (take.duration - startS) * 1000,
          startS,
        };
      }
    }
    return undefined;
  }

  /** Word timings of the take `resolve` would pick, if it has any. */
  words(line: LineId, lang: Lang): readonly WordTiming[] | undefined {
    const take = this.take(line, lang) ??
      this.take(line, FALLBACK_VOICE_LANG);
    if (!take?.words) return undefined;
    // Subtitles and the word pulse run on the playback clock, which starts
    // at `voStartS`, not at the top of the file.
    const startS = voStartS(take);
    if (startS === 0) return take.words;
    const cached = this.shifted.get(take.words);
    if (cached) return cached;
    const words = shiftWords(take.words, startS);
    this.shifted.set(take.words, words);
    return words;
  }

  speaker(line: LineId): Speaker | undefined {
    return this.data.lines[line]?.speaker;
  }

  /** Every line id whose scene passes `match`, for staged preloading. */
  linesWhere(match: (scene: string) => boolean): LineId[] {
    return Object.entries(this.data.lines)
      .filter(([, e]) => match(e.scene))
      .map(([id]) => id as LineId);
  }
}

// --------------------------------------------------------------- UI sfx

export interface SfxManifestFile {
  readonly sounds: Readonly<
    Record<string, { readonly src: string } | null>
  >;
}

/** Role to URL, skipping roles not yet picked (`null` in the manifest). */
export function sfxUrls(file: SfxManifestFile | null): Map<string, string> {
  const urls = new Map<string, string>();
  for (const [role, entry] of Object.entries(file?.sounds ?? {})) {
    if (entry) urls.set(role, entry.src);
  }
  return urls;
}

// ---------------------------------------------------------------- music

export interface MusicTrack {
  readonly src: string;
  readonly loop: boolean;
  /** Loop region in seconds; defaults to the whole file. */
  readonly loopStart?: number;
  readonly loopEnd?: number;
  /**
   * The beat grid, measured at promote time (`music/promote.py`): tempo,
   * seconds to the first downbeat, and key. Absent until measured.
   */
  readonly bpm?: number;
  readonly beatOffset?: number;
  readonly beatsPerBar?: number;
  readonly key?: {
    readonly root: number;
    readonly mode: "major" | "minor" | "dorian" | "phrygian";
  };
  /** Which candidate this is (`cand1`); the manifest's default for a cue. */
  readonly variant?: string;
  /** Picked by objective stats, not yet by ear (`music/stats.py`). */
  readonly provisional?: boolean;
  /** Every candidate of the cue, for A/B (`?v.music.<cue>=<variant>`). */
  readonly variants?: Readonly<Record<string, MusicTrack>>;
}

export interface MusicManifestFile {
  readonly cues: Readonly<Partial<Record<MusicCueId, MusicTrack | null>>>;
}

/**
 * Cues that borrow another cue's track until their own is picked, so a new
 * cue id never means silence: both endings start out sharing `ending`, and
 * the menu shares the tutorial's onboarding theme.
 */
export const MUSIC_FALLBACK: Readonly<Partial<Record<MusicCueId, MusicCueId>>> =
  {
    endingKill: "ending",
    endingPacifist: "ending",
    menu: "tutorial",
    // The generic ending cue, once the two endings have their own picks.
    ending: "endingKill",
  };

/**
 * Cue to track, after fallbacks. `choose` picks a cue's variant (the A/B
 * registry); by default each cue plays the manifest's pick.
 */
export function musicTracks(
  file: MusicManifestFile | null,
  choose: (cue: MusicCueId) => string | undefined = () => undefined,
): Map<MusicCueId, MusicTrack> {
  const tracks = new Map<MusicCueId, MusicTrack>();
  for (const [cue, track] of Object.entries(file?.cues ?? {})) {
    if (!track) continue;
    const pick = choose(cue as MusicCueId);
    const chosen = pick !== undefined ? track.variants?.[pick] : undefined;
    tracks.set(cue as MusicCueId, chosen ?? track);
  }
  for (const [cue, fallback] of Object.entries(MUSIC_FALLBACK)) {
    const borrowed = tracks.get(fallback);
    if (!tracks.has(cue as MusicCueId) && borrowed) {
      tracks.set(cue as MusicCueId, borrowed);
    }
  }
  return tracks;
}
