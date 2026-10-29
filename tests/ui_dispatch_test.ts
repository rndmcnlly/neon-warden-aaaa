/**
 * The quit dialog bug from the integration playtest: "focus reports Cancel
 * after ArrowLeft, yet Enter quits". Cancel is the leftmost button, so Left
 * cannot move (correct), and the harness then pressed Right, landing on Quit.
 * These tests pin the two halves: Left from Cancel stays on Cancel, and
 * Confirm activates whatever has focus, never a remembered default.
 */

import { assertEquals } from "@std/assert";
import type { MenuIntent } from "../src/input/inputLayer.ts";
import { decideMenuIntent, type DispatchState } from "../src/ui/dispatch.ts";
import { nextColumn, pickInDirection, type Rect } from "../src/ui/focus.ts";

const intents = (...list: MenuIntent[]) => new Set<MenuIntent>(list);
const dialog: DispatchState = {
  inMenu: true,
  playing: true,
  inTutorial: false,
  focusInTop: true,
};

// The confirm dialog's action row: [Keep playing] [Quit to title].
const cancel: Rect = { left: 400, top: 400, width: 200, height: 48 };
const quit: Rect = { left: 612, top: 400, width: 200, height: 48 };

Deno.test("quit dialog: Left from Cancel finds nothing, so focus stays", () => {
  assertEquals(pickInDirection(cancel, [quit], "left"), -1);
  assertEquals(pickInDirection(cancel, [quit], "right"), 0);
  assertEquals(pickInDirection(quit, [cancel], "left"), 0);
});

Deno.test("quit dialog: Enter activates the focused element", () => {
  assertEquals(decideMenuIntent(intents("confirm"), dialog), {
    kind: "activateFocused",
  });
  // Nothing focused inside the dialog: focus the safe default, do not act.
  assertEquals(
    decideMenuIntent(intents("confirm"), { ...dialog, focusInTop: false }),
    { kind: "focusDefault" },
  );
});

Deno.test("dispatch: Esc in play pauses; Backspace in the tutorial offers skip", () => {
  const play = { ...dialog, inMenu: false };
  assertEquals(decideMenuIntent(intents("pause", "back"), play), {
    kind: "pause",
  });
  assertEquals(
    decideMenuIntent(intents("back"), { ...play, inTutorial: true }),
    { kind: "skipTutorial" },
  );
  assertEquals(decideMenuIntent(intents("back"), play), { kind: "ignore" });
  assertEquals(
    decideMenuIntent(intents("pause"), { ...play, playing: false }),
    { kind: "ignore" },
  );
});

Deno.test("grid wrap: Down off a column's bottom goes to the next column's top", () => {
  // Two columns of two tiles: [A B] / [C D]. From C (bottom left), next is B.
  const tile = (left: number, top: number): Rect => ({
    left,
    top,
    width: 200,
    height: 80,
  });
  const b = tile(220, 0), d = tile(220, 100);
  assertEquals(nextColumn(tile(0, 100), [tile(0, 0), d, b], true), 2);
  assertEquals(nextColumn(b, [tile(0, 0), tile(0, 100)], false), 1);
  assertEquals(nextColumn(d, [tile(0, 0)], true), -1);
});
