/**
 * The Director's ports: every outside system it talks to, as a narrow
 * interface. The Director never imports Web Audio, three.js, the DOM or the
 * sim; `main.ts` plugs real implementations in, and tests plug in fakes. This
 * is the "ports and adapters" (hexagonal) pattern, and it is what lets the
 * whole cutscene system run under `deno test` with a fake clock.
 */

import type {
  CameraShotId,
  Lang,
  LineId,
  MusicCueId,
  SfxRoleId,
  Speaker,
} from "../contracts/index.ts";

/** Milliseconds from any monotonic source. In the game: the audio clock. */
export interface Clock {
  now(): number;
}

/** Which voice layer a line plays on. Ambient chatter yields to scripted. */
export type VoiceLayer = "scripted" | "ambient";

/** A playing voice line. */
export interface VoiceHandle {
  /** Ramps this line's own gain (ducking a bark under a scripted line). */
  setGain(gain: number, rampMs: number): void;
  stop(fadeMs?: number): void;
}

/**
 * Whether a line's audio can start right now: `ready` (decoded), `loading`
 * (it exists and is on its way) or `missing` (never rendered, or the
 * download failed). The Director holds a `loading` line rather than showing
 * its subtitle over silence.
 */
export type VoiceStatus = "ready" | "loading" | "missing";

export interface VoicePort {
  /**
   * Starts a line in `lang` (the port falls back to English if that language
   * has no audio). Returns `null` when no audio is available yet; the
   * Director still shows subtitles for the estimated duration.
   */
  play(line: LineId, lang: Lang, layer: VoiceLayer): VoiceHandle | null;
  /**
   * Optional: the line's load state, which also starts its download. A port
   * without it is treated as always `ready` (play now or never).
   */
  status?(line: LineId, lang: Lang): VoiceStatus;
  /** Rendered length of the line in `lang` (after fallback), if known. */
  durationMs(line: LineId, lang: Lang): number | undefined;
  /** Who speaks the line, if known (from `cues.json`). */
  speaker(line: LineId): Speaker | undefined;
}

export interface MusicPort {
  play(cue: MusicCueId, fadeMs: number): void;
}

export interface SfxPort {
  play(role: SfxRoleId): void;
}

export interface CameraPort {
  shot(shot: CameraShotId, durationMs: number, ease: "linear" | "inOut"): void;
}

/** The game loop's freeze switch (it decides ticks; see CONTRACTS.md rule 3). */
export interface SimPort {
  freeze(): void;
  resume(): void;
}

/**
 * Text lookup, injected so the Director does not depend on `src/i18n/`.
 * Returns `undefined` for an unknown id.
 */
export type TextLookup = (line: LineId, lang: Lang) => string | undefined;

/** The settings the Director reads, a narrow slice of `Settings`. */
export interface DirectorSettings {
  readonly textLang: Lang;
  readonly voiceLang: Lang;
  readonly subtitles: { readonly maxLines: 1 | 2 };
}
