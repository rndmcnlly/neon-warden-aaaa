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
  readonly durationMs: number;
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
  }
  | undefined;

export class VoCatalog {
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
        return {
          lang: l,
          url: this.base + take.file,
          durationMs: take.duration * 1000,
        };
      }
    }
    return undefined;
  }

  /** Word timings of the take `resolve` would pick, if it has any. */
  words(line: LineId, lang: Lang): readonly WordTiming[] | undefined {
    const take = this.take(line, lang) ??
      this.take(line, FALLBACK_VOICE_LANG);
    return take?.words;
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
