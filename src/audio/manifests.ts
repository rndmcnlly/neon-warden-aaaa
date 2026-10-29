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

import type { Lang, LineId, MusicCueId, Speaker } from "../contracts/index.ts";

// ------------------------------------------------------------------- VO

/** The parts of `cues.json` the game reads. */
export interface VoCuesFile {
  readonly lines: Readonly<
    Record<string, {
      readonly speaker: Speaker;
      readonly scene: string;
      readonly langs: Readonly<
        Partial<
          Record<Lang, { readonly file: string; readonly duration: number }>
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

export class VoCatalog {
  constructor(
    private readonly data: VoCuesFile,
    /** Where `cues.json` lives; file paths in it are relative to here. */
    private readonly base = "vo/",
  ) {}

  /** Picks `lang` if rendered, else English, else nothing. */
  resolve(line: LineId, lang: Lang): ResolvedVoice | undefined {
    const entry = this.data.lines[line];
    if (!entry) return undefined;
    for (const l of [lang, FALLBACK_VOICE_LANG]) {
      const take = entry.langs[l];
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
  };

export function musicTracks(
  file: MusicManifestFile | null,
): Map<MusicCueId, MusicTrack> {
  const tracks = new Map<MusicCueId, MusicTrack>();
  for (const [cue, track] of Object.entries(file?.cues ?? {})) {
    if (track) tracks.set(cue as MusicCueId, track);
  }
  for (const [cue, fallback] of Object.entries(MUSIC_FALLBACK)) {
    const borrowed = tracks.get(fallback);
    if (!tracks.has(cue as MusicCueId) && borrowed) {
      tracks.set(cue as MusicCueId, borrowed);
    }
  }
  return tracks;
}
