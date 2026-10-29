/**
 * Text identity. No player-facing string is written inline in code: code
 * holds a `LineId`, and the i18n layer resolves it for the current text
 * language (subtitles, captions, menus) or voice language (audio).
 *
 * Spoken lines live in `vo/script.yaml`. Unspoken UI strings use the same
 * `LineId` space (ids unique across both sources).
 */

/** Languages with text and voice. Text and voice language are set separately. */
export type Lang = "en" | "es" | "zh";

export const LANGS: readonly Lang[] = ["en", "es", "zh"];

/**
 * A line id such as `tut_move_001`. Branded so a raw string cannot slip into
 * a subtitle or menu label without passing through `lineId()`.
 */
export type LineId = string & { readonly __brand: "LineId" };

/** Marks a string as a line id. Use at data boundaries, not to wrap prose. */
export function lineId(id: string): LineId {
  return id as LineId;
}

/**
 * Speaking characters, matching `speakers:` keys in `vo/script.yaml`. Narrative
 * adds new speakers here and in the script together.
 */
export type Speaker = "tutorial_ai" | "narrator" | "warden" | "pilot";

/** One entry of `vo/script.yaml` `lines:` as loaded at runtime. */
export interface ScriptLine {
  readonly id: LineId;
  readonly speaker: Speaker;
  readonly scene: string;
  /** Acting note for TTS; never shown to the player. */
  readonly direction: string;
  readonly text: Readonly<Record<Lang, string>>;
}
