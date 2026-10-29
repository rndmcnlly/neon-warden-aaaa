import { assertEquals } from "@std/assert";
import { logoFrame } from "../src/presentation/flatLogos.ts";

Deno.test("logo reveal is finite, seekable and only glints once", () => {
  assertEquals(logoFrame(-10).opacity, 0);
  assertEquals(logoFrame(NaN).opacity, 0);
  assertEquals(logoFrame(480).opacity, 1);
  assertEquals(logoFrame(0).glint, 0);
  assertEquals(logoFrame(2000).glint, 0);
  assertEquals(logoFrame(10000).glint, 0);
  assertEquals(logoFrame(1150).glint, 0.12);
});

Deno.test("either accessibility setting yields the full static identity", () => {
  for (
    const settings of [
      { reducedMotion: true },
      { reducedFlashing: true },
    ]
  ) {
    for (const ms of [0, 200, 1150, 10000]) {
      assertEquals(logoFrame(ms, settings).opacity, 1);
      assertEquals(logoFrame(ms, settings).glint, 0);
    }
  }
});
