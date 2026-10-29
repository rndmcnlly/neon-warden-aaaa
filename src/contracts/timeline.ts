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
  | "menu"
  /** Kept for older timelines; prefer the two specific endings. */
  | "ending"
  | "endingKill"
  | "endingPacifist"
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
  | "shipCloseup"
  | "flashback"
  | "endingWide"
  /** Boot: the studio and incubator logos turn on a plinth. */
  | "logoTurntable";

/**
 * Who is on the radio: the Warden's scouts talking among themselves, Lane
 * Control (Authority traffic), or #0121's derelict flight recorder.
 */
export type RadioChannel = "scout" | "authority" | "recorder";

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
  /**
   * Blocks until a story flag has `value` (the tutorial waits for the player
   * to actually move, fire and hit the target). `nudge` plays one line, once,
   * if the wait runs past `afterMs`.
   */
  | {
    readonly type: "waitFlag";
    readonly flag: FlagName;
    readonly value: boolean;
    readonly nudge?: { readonly line: LineId; readonly afterMs: number };
  }
  /**
   * Shows a line as on-screen radio text, apart from the main subtitles,
   * and plays it if it is a VO line (spatially, when the Director knows
   * where the speaker is). Does not block. Text-only radio ids are `radio.*`.
   */
  | {
    readonly type: "radio";
    readonly line: LineId;
    readonly channel: RadioChannel;
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
