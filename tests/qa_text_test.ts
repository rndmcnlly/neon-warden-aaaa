import { assert, assertEquals } from "@std/assert";
import {
  placeholders,
  sameplaceholders,
  scanIds,
  visualWidth,
  widthRatio,
} from "../qa/lib/text.ts";

Deno.test("placeholders are sorted and deduplicated", () => {
  assertEquals(placeholders("{b} then {a} then {b}"), ["a", "b"]);
  assertEquals(placeholders("none"), []);
});

Deno.test("placeholder parity ignores order but not names", () => {
  assert(sameplaceholders("{w} x {h}", "{h} por {w}"));
  assert(!sameplaceholders("{serial}", "{serie}"));
});

Deno.test("CJK counts wider than Latin", () => {
  assertEquals(visualWidth("abcd"), 4);
  assert(visualWidth("返回") > visualWidth("Ba"));
  // "Back" (4) vs "返回" (2 x 1.8 = 3.6): not an overflow risk.
  assert(widthRatio("Back", "返回") < 1);
});

Deno.test("scanIds finds script and ui ids, skips comments and prose", () => {
  const src = [
    `// "tut_fake_001" in a comment is documentation`,
    `say("tut_move_001"); t("ui.menu.newGame");`,
    'const x = `ui.settings.tab.${tab}`; const y = "not an id";',
  ].join("\n");
  const refs = scanIds(src, "f.ts");
  assertEquals(refs.map((r) => r.id), [
    "tut_move_001",
    "ui.menu.newGame",
    "ui.settings.tab.",
  ]);
  assertEquals(refs[2].dynamic, true);
  assertEquals(refs[0].line, 2);
});
