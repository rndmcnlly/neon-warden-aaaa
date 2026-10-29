/**
 * Live language cycling during play: `[` steps back and `]` forward through
 * EN, ES, ZH, and so do the gamepad shoulder buttons (which stay Settings
 * tab switching in menus). Pure, so the order, the clobbering of both
 * language settings and the key filter all run under `deno test`.
 *
 * One press overwrites the voice AND the text language at once. Nothing here
 * touches a line already playing: the Director reads both languages when a
 * line starts (`director.ts`, `start`), so the current line finishes as it
 * began and the next one speaks and captions in the new language.
 */

import type { Lang, Settings } from "../contracts/index.ts";

/** Cycle order, also the order of the language pickers in Settings. */
export const LANG_CYCLE: readonly Lang[] = ["en", "es", "zh"];

export type CycleStep = -1 | 1;

/** Keyboard codes (layout-independent, like the bindings) and their step. */
export const LANG_CYCLE_KEYS: Readonly<Record<string, CycleStep>> = {
  BracketLeft: -1,
  BracketRight: 1,
};

/** Standard Gamepad mapping: 4 left shoulder, 5 right shoulder. */
export const LANG_CYCLE_BUTTONS: Readonly<Record<number, CycleStep>> = {
  4: -1,
  5: 1,
};

export function cycleLang(from: Lang, step: CycleStep): Lang {
  const at = Math.max(0, LANG_CYCLE.indexOf(from));
  const n = LANG_CYCLE.length;
  return LANG_CYCLE[(at + step + n) % n];
}

/**
 * Both languages become the next one after the text language. The text
 * language is the base because it is what the player sees confirmed in the
 * badge; a split menu choice (Spanish voice, English text) is clobbered on
 * purpose, as Adam specified: the shortcut means "everything in X now".
 */
export function withCycledLang(settings: Settings, step: CycleStep): Settings {
  const lang = cycleLang(settings.textLang, step);
  return { ...settings, textLang: lang, voiceLang: lang };
}

/**
 * The step a key press asks for, or null. Same filter as the F fullscreen
 * shortcut (`platform/fullscreen.ts`): no key repeat (holding `]` must not
 * spin through languages), no modifiers (Shift+`]` is `}` on many layouts,
 * Ctrl/Cmd+`]` belong to the browser), not while typing in a field, not
 * while a remap is capturing, and never when the player bound the key to an
 * action, because their binding wins.
 */
export function langCycleKeyStep(
  event: Pick<
    KeyboardEvent,
    "code" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
  >,
  typing: boolean,
  capturing: boolean,
  bound: boolean,
): CycleStep | null {
  const step = LANG_CYCLE_KEYS[event.code];
  if (step === undefined) return null;
  if (event.repeat || typing || capturing || bound) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return null;
  }
  return step;
}

/** The step a newly pressed pad button asks for; bound buttons never cycle. */
export function langCycleButtonStep(
  index: number,
  bound: boolean,
): CycleStep | null {
  return bound ? null : LANG_CYCLE_BUTTONS[index] ?? null;
}
