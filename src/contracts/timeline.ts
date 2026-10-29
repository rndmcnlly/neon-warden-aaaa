/**
 * Scripted scenes as data. A timeline is a list of cues the Director runs in
 * order; a cue either finishes instantly (music change, flag) or blocks until
 * it is done (wait). Keeping scenes as data means narrative can be rewritten
 * without touching playback code, and a test can walk every timeline.
 *
 * Timelines live in `src/scenes/*.timeline.ts`, each exporting one `Timeline`.
 */

import type { LineId } from "./text.ts";

/** Music cues, one per beat. Audio owns the files behind them. */
export type MusicCueId =
  | "logos"
  | "tutorial"
  | "gameplay"
  | "flashback"
  | "boss"
  | "ending"
  | "silence";

/**
 * A UI or gameplay sound role from the `sfx/` manifest (for example
 * `confirm`). A brand rather than a union: the manifest is still growing.
 */
export type SfxRoleId = string & { readonly __brand: "SfxRoleId" };

export function sfxRole(id: string): SfxRoleId {
  return id as SfxRoleId;
}

/** Named camera framings. The renderer owns their actual transforms. */
export type CameraShotId =
  | "gameplay"
  | "bossIntro"
  | "bossCloseup"
  | "pilotCloseup"
  | "flashback"
  | "endingWide";

/** Story flags the Director reads and writes, plus mirrored sim flags. */
export type FlagName = string;

export type Cue =
  /** Starts a voice line with subtitles. Does not block; follow with a wait. */
  | { readonly type: "say"; readonly line: LineId }
  /** Blocks for a fixed time, or until the most recent `say` finishes. */
  | { readonly type: "wait"; readonly ms: number }
  | { readonly type: "wait"; readonly until: "lineEnds" }
  /** Crossfades to a music cue. */
  | {
    readonly type: "music";
    readonly cue: MusicCueId;
    readonly fadeMs?: number;
  }
  | { readonly type: "sfx"; readonly role: SfxRoleId }
  | {
    readonly type: "camera";
    readonly shot: CameraShotId;
    readonly durationMs: number;
    readonly ease?: "linear" | "inOut";
  }
  | {
    readonly type: "setFlag";
    readonly flag: FlagName;
    readonly value: boolean;
  }
  /** Runs `then` or `else` inline, depending on a flag's current value. */
  | {
    readonly type: "branch";
    readonly flag: FlagName;
    readonly then: readonly Cue[];
    readonly else?: readonly Cue[];
  }
  /** Stops stepping the sim (the flashback freezes the world). */
  | { readonly type: "freezeSim" }
  | { readonly type: "resumeSim" };

export type CueType = Cue["type"];

export interface Timeline {
  /** Stable id, also used by `?skipto=` and chapter select. */
  readonly id: string;
  readonly cues: readonly Cue[];
}
