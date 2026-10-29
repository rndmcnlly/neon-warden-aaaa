import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  type AssetStats,
  BUDGET_CAPS,
  estimateBudget,
  instancesOf,
  METERS,
  piecesFor,
  SECTOR_LAYOUTS,
  WORLD_NAMES,
} from "../src/world/sectors.ts";
import { WORLD_LORE, WorldArchive } from "../src/world/lore.ts";
import { canvasSize, SIGNS } from "../src/world/signage.ts";
import {
  BEHIND,
  FULL,
  RIGID,
  routePose,
  routeWeight,
  wrapRel,
} from "../src/world/route.ts";
import {
  cranePose,
  podVisible,
  podY,
  REST_T,
  sparkLevel,
  tollPose,
} from "../src/world/activity.ts";

interface Entry extends AssetStats {
  readonly signs: Record<string, [number, number]>;
}
const manifest: Record<string, Entry> = JSON.parse(
  await Deno.readTextFile(
    new URL("../public/models/world/manifest.json", import.meta.url),
  ),
);
const signBytes = (asset: string, node: string) => {
  const [w, h] = manifest[asset].signs[node];
  const [cw, ch] = canvasSize(w, h);
  return cw * ch * 4 * 4 / 3;
};

Deno.test("world: five distinct places, each with a hero kept on the low tier", () => {
  assertEquals(SECTOR_LAYOUTS.length, 5);
  const heroes = new Set<string>();
  for (const layout of SECTOR_LAYOUTS) {
    const name = WORLD_NAMES[layout.sector - 1];
    for (const p of layout.pieces) {
      assert(manifest[p.asset], `${name}: ${p.asset}`);
    }
    const mid = new Set(
      layout.pieces.filter((p) => p.layer === "mid").map((p) => p.asset),
    );
    assert(mid.size >= 2, `${name}: at least two distinct mid set pieces`);
    const low = piecesFor(layout, true);
    assert(
      low.some((p) => p.layer === "mid"),
      `${name}: low keeps a set piece`,
    );
    // A recognizable hero carries its own localized signage or a moving part.
    assert(
      low.some((p) =>
        Object.keys(manifest[p.asset].signs).length > 0 || p.activity
      ),
      name,
    );
    heroes.add(low.map((p) => p.asset).join());
  }
  assertEquals(heroes.size, 5);
});

Deno.test("world: nothing above the lane floor intrudes into the combat lane", () => {
  for (const layout of SECTOR_LAYOUTS) {
    for (const p of layout.pieces) {
      const [x0, y0, z0, x1, y1, z1] = manifest[p.asset].bounds;
      for (const c of instancesOf(p)) {
        const unit = METERS * (p.scale ?? 1) * c.scale;
        const yaw = (p.yaw ?? 0) + c.yaw;
        // Blender (x, y) footprint corners; three local z = -Blender y.
        const x = p.x + c.dx;
        let lo = Infinity, hi = -Infinity;
        for (const [bx, by] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
          // Tumbling rocks may face any way: use their bounding sphere.
          const r = Math.hypot(bx, by, Math.max(-z0, z1)) * unit;
          const wx = p.activity === "tumble"
            ? 0
            : (bx * Math.cos(yaw) - by * Math.sin(yaw)) * unit;
          lo = Math.min(lo, x + wx - (p.activity === "tumble" ? r : 0));
          hi = Math.max(hi, x + wx + (p.activity === "tumble" ? r : 0));
        }
        const top = p.y + c.dy +
          (p.activity === "tumble" ? Math.hypot(x0, y0, z1) : z1) * unit;
        assert(
          top < -1.2 || lo > 6.8 || hi < -6.8,
          `sector ${layout.sector} ${p.asset}: x ${lo}..${hi} top ${top}`,
        );
      }
    }
  }
});

Deno.test("world: per-sector budgets fit the high and school-Chromebook tiers", () => {
  for (const layout of SECTOR_LAYOUTS) {
    for (const low of [false, true]) {
      const b = estimateBudget(layout, low, manifest, signBytes);
      const cap = low ? BUDGET_CAPS.low : BUDGET_CAPS.high;
      const tag = `sector ${layout.sector} ${low ? "low" : "high"}`;
      assert(b.drawCalls <= cap.drawCalls, `${tag} draws ${b.drawCalls}`);
      assert(b.triangles <= cap.triangles, `${tag} tris ${b.triangles}`);
      assert(
        b.textureBytes <= cap.textureBytes,
        `${tag} tex ${b.textureBytes}`,
      );
    }
  }
});

Deno.test("world: every physical sign is localized in EN, ES and ZH", () => {
  const ids = new Set(
    Object.values(manifest).flatMap((e) =>
      Object.keys(e.signs).map((n) => n.replace(/^(sign|paint)__/, ""))
    ),
  );
  assert(ids.size >= 10);
  for (const id of ids) {
    const spec = SIGNS[id];
    assert(spec, id);
    for (const lang of ["en", "es", "zh"] as const) {
      const lines = spec.text[lang];
      assert(lines.length > 0 && lines.every((l) => l.trim().length > 0));
      assert(lines.every((l) => !l.includes("—")), `${id} ${lang} emdash`);
    }
    assert(/[一-鿿]/.test(spec.text.zh.join("")), `${id} zh`);
  }
});

Deno.test("route: the combat patch is exactly rigid; the distant bend is smooth", () => {
  for (let rel = -BEHIND; rel <= RIGID; rel += 0.25) {
    const p = routePose(rel, 11, -3, 4);
    assertEquals([p.x, p.y, p.yaw], [11, -3, -0]);
    assertEquals(p.z, -rel);
  }
  assertEquals(routeWeight(FULL), 1);
  let last = 0;
  for (let rel = RIGID; rel <= FULL + 4; rel += 0.05) {
    const w = routeWeight(rel);
    assert(w >= last && w - last < 0.02);
    last = w;
  }
  for (let progress = 0; progress < 200; progress += 3.7) {
    const r = wrapRel(5, progress, 64);
    assert(r >= -BEHIND && r < 64 - BEHIND);
  }
});

Deno.test("activity: continuous choreography, bounded poses, frozen reduced motion", () => {
  let prev = tollPose(0), pod = podY(0, 0), crane = cranePose(0);
  for (let t = 0.01; t < 64; t += 0.01) {
    const toll = tollPose(t);
    assert(toll.arm >= 0 && toll.arm <= 1.25);
    assert(Math.abs(toll.arm - prev.arm) < 0.2);
    const y = podY(t, 0);
    // The only jump is the wrap, which happens off the road deck.
    if (Math.abs(y - pod) > 1) assert(!podVisible(y) && !podVisible(pod));
    const c = cranePose(t);
    assert(Math.abs(c.trolley - crane.trolley) < 0.5);
    assert(c.drop >= 14 && c.drop <= 20);
    prev = toll, pod = y, crane = c;
  }
  assertEquals(sparkLevel(1.234, 1, true), sparkLevel(9.87, 2, true));
  assertAlmostEquals(tollPose(REST_T).arm, 1.25 * 0.5, 0.7);
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
