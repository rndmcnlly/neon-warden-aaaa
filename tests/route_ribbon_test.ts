import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "@std/assert";
import {
  add,
  authoredPoint,
  buildRoute,
  cross,
  distortion,
  dot,
  length,
  mul,
  project,
  sample,
  SEGMENTS,
  simToWorld,
  sub,
  transport,
  unit,
  worldToSim,
} from "../src/presentation/routeRibbon/math.ts";
import { IDLE_INPUT } from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";

const route = buildRoute();

Deno.test("route: straight tangent tails do not clamp or fold at authored endpoints", () => {
  for (const start of [-30, route.length]) {
    const a = sample(route, start), b = sample(route, start + 10);
    assertAlmostEquals(length(sub(a.center, b.center)), 10, 1e-8);
    assert(dot(a.forward, b.forward) > 0.999999);
  }
  for (const progress of [12, route.length - 12]) {
    for (const y of [-880, 1520]) {
      const d = distortion({ route, progress, curve: 0 }, { x: 240, y });
      assert(d.min > 0.8 && d.determinant > 0);
    }
  }
});

Deno.test("route: frames orthonormal, right-handed [right,up,-forward], no flips", () => {
  for (let s = 0; s < route.length; s += 0.1) {
    const f = sample(route, s), previous = sample(route, Math.max(0, s - 0.1));
    for (const v of [f.forward, f.right, f.up]) {
      assertAlmostEquals(length(v), 1, 1e-10);
    }
    assertAlmostEquals(dot(f.right, f.forward), 0, 1e-10);
    assertAlmostEquals(dot(f.up, f.forward), 0, 1e-10);
    assertAlmostEquals(dot(f.right, f.up), 0, 1e-10);
    assertAlmostEquals(dot(cross(f.right, f.up), mul(f.forward, -1)), 1, 1e-10);
    assert(dot(f.right, previous.right) > 0.999);
  }
});

Deno.test("route: transported orientation crosses vertical and inflections without flipping", () => {
  let before = unit([0, 0, -1]), right = unit(cross(before, [0, 1, 0]));
  for (let i = 1; i <= 720; i++) {
    const a = Math.sin(i / 720 * Math.PI * 2) * 2;
    const after = unit([0.001 * Math.sin(a), Math.sin(a), -Math.cos(a)]);
    const next = transport(right, before, after);
    assert(dot(right, next) > 0.999);
    assertAlmostEquals(dot(next, after), 0, 1e-10);
    before = after;
    right = next;
  }
  assertThrows(() => transport([1, 0, 0], [0, 0, -1], [0, 0, 1]));
});

Deno.test("route: segment seams continuous and arc-length stable under LUT refinement", () => {
  const refined = buildRoute(SEGMENTS, 640);
  assert(Math.abs(refined.length - route.length) < 0.0001);
  for (const s of route.joins) {
    const a = sample(route, s - 1e-5), b = sample(route, s + 1e-5);
    assert(length(sub(a.center, b.center)) < 0.000021);
    assert(dot(a.forward, b.forward) > 0.999999);
    assert(dot(a.right, b.right) > 0.999999);
  }
  for (let s = 1; s < route.length - 1; s += 0.31) {
    assertAlmostEquals(
      length(sub(sample(route, s + 0.01).center, sample(route, s).center)),
      0.01,
      1e-7,
    );
    assert(
      length(sub(sample(route, s).center, sample(refined, s).center)) < 0.0003,
    );
  }
  for (const seg of SEGMENTS) {
    assert(authoredPoint(seg, 1)[2] < authoredPoint(seg, 0)[2]);
  }
});

Deno.test("route: inverse roundtrip at both curve amounts, joins, edges and dense patterns", () => {
  for (
    const progress of [12, 40, 72, ...route.joins, 125, 180, route.length - 12]
  ) {
    for (const curve of [0, 1]) {
      const mapping = { route, progress, curve };
      for (const x of [0, 120, 240, 360, 480]) {
        for (const y of [0, 80, 320, 540, 640]) {
          const inverse = worldToSim(mapping, simToWorld(mapping, { x, y }));
          assertAlmostEquals(inverse.x, x, 0.001);
          assertAlmostEquals(inverse.y, y, 0.001);
          assert(inverse.residual < 0.00003);
        }
      }
    }
  }
});

Deno.test("route: projected distortion bounded, near patch exact, no local folds", () => {
  for (let progress = 12; progress < route.length - 12; progress += 2) {
    for (const curve of [0, 1]) {
      for (const x of [0, 120, 240, 360, 480]) {
        for (const y of [0, 80, 320, 540, 640]) {
          const mapping = { route, progress, curve };
          const d = distortion(mapping, { x, y });
          assert(d.min > 0.90 && d.max < 1.10 && d.anisotropy < 1.12);
          assert(d.determinant > 0);
          if (!curve) {
            assertAlmostEquals(d.min, 1, 0.000001);
            assertAlmostEquals(d.max, 1, 0.000001);
            const p = project(mapping, simToWorld(mapping, { x, y }));
            assertAlmostEquals(p.x, x, 1e-8);
            assertAlmostEquals(p.y, y, 1e-8);
          }
        }
      }
    }
  }
});

Deno.test("route: mapping cannot alter diagonal/reversal sim state or replay hash", () => {
  const options = {
    seed: 121,
    start: { kind: "sector" as const, sector: 1 as const },
    difficulty: "normal" as const,
  };
  const control = createSim(options), observed = createSim(options);
  for (let tick = 0; tick < 360; tick++) {
    const sign = tick % 120 < 60 ? 1 : -1;
    const input = {
      ...IDLE_INPUT,
      move: { x: sign, y: sign },
      focus: tick % 90 < 45,
    };
    control.step(input);
    observed.step(input);
    const before = hashSimState(observed.snapshot());
    const p = observed.snapshot().player.pos;
    const mapping = { route, progress: 12 + tick / 2, curve: tick % 2 };
    worldToSim(mapping, add(simToWorld(mapping, p), [0, 0, 0]));
    assertEquals(hashSimState(observed.snapshot()), before);
  }
  assertEquals(
    hashSimState(observed.snapshot()),
    hashSimState(control.snapshot()),
  );
});
