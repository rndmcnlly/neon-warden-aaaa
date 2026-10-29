/**
 * The front end's menu input rule as a pure function, so it can be tested
 * without a browser. `frontEnd.ts` asks the top screen and the focused
 * widget first (they may consume the intent), then calls this for the rest.
 *
 * The rule that matters most: Confirm activates whatever has focus, never a
 * remembered default. In a confirm dialog that means Enter on Cancel
 * cancels, even after an arrow press that could not move (Cancel is the
 * leftmost button, so Left stays put; the front end plays an edge bump).
 */

import type { MenuIntent } from "../input/inputLayer.ts";
import type { CycleStep } from "../input/langCycle.ts";
import type { Direction } from "./focus.ts";

export type MenuDecision =
  | { readonly kind: "ignore" }
  | { readonly kind: "pause" }
  | { readonly kind: "skipTutorial" }
  /** `[` `]` or a shoulder in play: step voice and text language together. */
  | { readonly kind: "cycleLang"; readonly step: CycleStep }
  | { readonly kind: "move"; readonly direction: Direction }
  /** Nothing in the top screen has focus yet: focus its default first. */
  | { readonly kind: "focusDefault" }
  | { readonly kind: "activateFocused" }
  | { readonly kind: "back" };

export interface DispatchState {
  /** A screen is open (title, menus, pause, dialogs). */
  readonly inMenu: boolean;
  /** A run is in progress (the sim is live or paused under a menu). */
  readonly playing: boolean;
  readonly inTutorial: boolean;
  /** Focus is inside the top screen. */
  readonly focusInTop: boolean;
}

const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export function decideMenuIntent(
  intents: ReadonlySet<MenuIntent>,
  state: DispatchState,
): MenuDecision {
  if (!state.inMenu) {
    if (!state.playing) return { kind: "ignore" };
    if (intents.has("pause")) return { kind: "pause" };
    // Back alone (Backspace, pad B) offers the skip; Esc means pause above.
    if (state.inTutorial && intents.has("back")) {
      return { kind: "skipTutorial" };
    }
    // Only in play: in menus the same shoulders switch Settings tabs, and a
    // language picked under the pause menu belongs to the Settings screen.
    if (intents.has("langPrev")) return { kind: "cycleLang", step: -1 };
    if (intents.has("langNext")) return { kind: "cycleLang", step: 1 };
    return { kind: "ignore" };
  }
  for (const direction of DIRECTIONS) {
    if (intents.has(direction)) {
      return state.focusInTop
        ? { kind: "move", direction }
        : { kind: "focusDefault" };
    }
  }
  if (intents.has("confirm")) {
    return state.focusInTop
      ? { kind: "activateFocused" }
      : { kind: "focusDefault" };
  }
  if (intents.has("back")) return { kind: "back" };
  return { kind: "ignore" };
}
