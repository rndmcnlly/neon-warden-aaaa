/**
 * Data shapes for the two text tables: spoken lines (generated from
 * `vo/script.yaml`) and unspoken UI strings (`ui.ts`). Both share one id
 * space so a `LineId` can name either.
 */

import type { Speaker } from "../contracts/index.ts";

/**
 * Text in each language. English is required and is the fallback; Spanish
 * and Chinese may be missing while a line is being drafted. The i18n tests
 * fail the build if anything ships without all three.
 */
export interface LocalizedText {
  readonly en: string;
  readonly es?: string;
  readonly zh?: string;
}

/** Which run can hear a line: both, only the kill run, or only the pacifist run. */
export type Route = "any" | "kill" | "pacifist";

/** One spoken line as stored in the generated table. */
export interface ScriptLineData {
  readonly speaker: Speaker;
  readonly scene: string;
  readonly route: Route;
  /** A line a timeline may leave out (Pilot's single line). */
  readonly optional: boolean;
  /** Acting note for TTS; never shown to the player. */
  readonly direction: string;
  readonly text: LocalizedText;
}
