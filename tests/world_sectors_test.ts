import { assert, assertEquals } from "@std/assert";
import {
  sectorBlocks,
  WORLD_BUDGET,
  WORLD_NAMES,
} from "../src/world/sectors.ts";
import { WORLD_LORE, WorldArchive } from "../src/world/lore.ts";

Deno.test("world: five distinct bounded kits, no geometry in the play plane", () => {
  const signatures = new Set<string>();
  for (let sector = 1; sector <= 5; sector++) {
    const blocks = sectorBlocks(sector);
    assert(blocks.length <= WORLD_BUDGET.blocks, WORLD_NAMES[sector - 1]);
    signatures.add(JSON.stringify(blocks));
    for (const b of blocks) {
      assert([b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite));
      assert(b.w > 0 && b.h > 0 && b.d > 0);
      // Central monumental gate is far below and behind the combat plane.
      assert(
        Math.abs(b.x) -
                (Math.abs(Math.cos(b.roll ?? 0)) * b.w +
                    Math.abs(Math.sin(b.roll ?? 0)) * b.d) / 2 > 6.2 ||
          b.y + b.h / 2 < -4,
        `sector ${sector}: ${JSON.stringify(b)}`,
      );
    }
  }
  assertEquals(signatures.size, 5);
});

Deno.test("world: all discoveries localized, stable ids, 3 per sector", () => {
  assertEquals(new Set(WORLD_LORE.map((r) => r.id)).size, 15);
  for (let s = 1; s <= 5; s++) {
    assertEquals(WORLD_LORE.filter((r) => r.sector === s).length, 3);
  }
  for (const r of WORLD_LORE) {
    for (const lang of ["en", "es", "zh"] as const) {
      assert(r.text[lang].trim().length > 0);
      assertEquals(r.text[lang].split("\n").length, 2);
      assert(!r.text[lang].includes("—"));
    }
  }
});

Deno.test("world: archives independently of reading windows, no premature or duplicate discovery", () => {
  const archive = new WorldArchive();
  archive.discover(3, 0);
  assertEquals(archive.entries().length, 1);
  archive.discover(3, 659);
  assertEquals(archive.entries().length, 1);
  archive.discover(3, 1500);
  archive.discover(3, 1500);
  assertEquals(archive.entries("es").length, 3);
  assert(archive.entries("zh")[2].text.includes("0121"));
  archive.discover(4, 0);
  assertEquals(archive.entries().length, 4);
  archive.clear();
  assertEquals(archive.entries().length, 0);
});
