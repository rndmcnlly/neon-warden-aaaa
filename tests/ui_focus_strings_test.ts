import { assertEquals } from "@std/assert";
import { pickEntry, pickInDirection, type Rect } from "../src/ui/focus.ts";
import { id, t } from "../src/i18n/index.ts";

const box = (left: number, top: number, width = 100, height = 40): Rect => ({
  left,
  top,
  width,
  height,
});

Deno.test("down in a list picks the next row, not a nearer diagonal", () => {
  const from = box(0, 0);
  const candidates = [box(0, 100), box(110, 45), box(0, 50)];
  // The diagonal at (110, 45) is penalized for sideways drift; row at 50 wins.
  assertEquals(pickInDirection(from, candidates, "down"), 2);
});

Deno.test("right in a grid picks the same-row neighbor", () => {
  const from = box(0, 0);
  const candidates = [box(120, 60), box(120, 0), box(240, 0)];
  assertEquals(pickInDirection(from, candidates, "right"), 1);
});

Deno.test("no candidate in a direction returns -1", () => {
  assertEquals(pickInDirection(box(0, 0), [box(0, 100)], "up"), -1);
});

Deno.test("keyboard reaches the remap table: Down from the tab enters the Keyboard column", () => {
  // Measured layout (1280x720): the Controls tab sits over the Gamepad
  // column, so geometry alone lands on a gamepad cell and Down stays there.
  const tab = box(627, 129, 75, 30);
  const row = [
    box(411, 200, 118, 25),
    box(535, 200, 118, 25),
    box(658, 200, 118, 25),
  ];
  const landed = pickInDirection(tab, row, "down");
  assertEquals(landed, 2);
  // Entering the row retargets to the device's entry cell.
  const entries = ["key", undefined, "pad"];
  assertEquals(pickEntry(entries, "keyboard"), 0);
  assertEquals(pickEntry(entries, "mouse"), 0);
  assertEquals(pickEntry(entries, "gamepad"), 2);
  assertEquals(pickEntry([undefined, undefined], "keyboard"), 0);
  // From the Keyboard column, Down walks the column to Fire.
  const column = [
    box(411, 226, 118, 25),
    box(535, 226, 118, 25),
    box(411, 308, 118, 25),
  ];
  assertEquals(pickInDirection(row[0], column, "down"), 0);
});

Deno.test("UI strings fill placeholders in every language", () => {
  const vars = { w: 1920, h: 1080 };
  const key = id("ui.settings.renderScaleHint");
  assertEquals(t(key, "en", vars), "Renders at 1920 x 1080");
  assertEquals(t(key, "es", vars), "Renderiza a 1920 x 1080");
  assertEquals(t(key, "zh", vars), "渲染分辨率 1920 x 1080");
});
