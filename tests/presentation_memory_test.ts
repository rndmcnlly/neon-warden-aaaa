import { assertEquals } from "@std/assert";
import {
  MEMORY_READOUT,
  MEMORY_SHOTS,
  MemoryScene,
} from "../src/presentation/memoryScene.ts";
import { ModelRegistry } from "../src/render/models.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { PacifistAutopilot } from "../src/pilots/pacifist.ts";
import {
  BriefingGate,
  ENEMY_INTEL,
  nextBriefing,
} from "../src/presentation/enemyBriefing.ts";

Deno.test("completion and skip leave the frozen snapshot untouched", () => {
  for (const skip of [false, true]) {
    const sim = createSim({
      seed: 121,
      start: { kind: "sector", sector: 2 },
      difficulty: "normal",
    });
    const pilot = new PacifistAutopilot();
    for (let i = 0; i < 100; i++) sim.step(pilot.next(sim.snapshot()));
    const before = hashSimState(sim.snapshot());
    sim.freeze();
    const scene = new MemoryScene(new ModelRegistry());
    scene.resize(390, 844);
    for (const line of Object.keys(MEMORY_SHOTS)) {
      scene.update(line as keyof typeof MEMORY_SHOTS, 2, 7, {
        reduceMotion: skip,
        reduceFlashing: true,
      });
      assertEquals(sim.step(pilot.next(sim.snapshot())), []);
      if (skip) break;
    }
    scene.dispose();
    assertEquals(scene.scene.children.length, 0);
    assertEquals(hashSimState(sim.snapshot()), before);
    // The orchestrator, not scene.dispose(), releases its own freeze lease.
    assertEquals(sim.step(pilot.next(sim.snapshot())), []);
    const tick = sim.snapshot().tick;
    sim.resume();
    sim.step(pilot.next(sim.snapshot()));
    assertEquals(sim.snapshot().tick, tick + 1);
  }
});

Deno.test("recording has five shots, cold weapon before Warden reaction", () => {
  assertEquals(new Set(Object.values(MEMORY_SHOTS)).size, 5);
  assertEquals(MEMORY_SHOTS.flash_rec_002, "stop");
  assertEquals(MEMORY_SHOTS.flash_rec_003, "stop");
  assertEquals(MEMORY_SHOTS.flash_rec_004, "traffic");
  assertEquals(MEMORY_SHOTS.flash_rec_005, "recall");
  assertEquals(MEMORY_SHOTS.flash_rec_006, "cut");
});

Deno.test("every presentation readout and enemy has EN ES ZH", () => {
  for (const lang of ["en", "es", "zh"] as const) {
    assertEquals(Object.keys(MEMORY_READOUT[lang]).length, 5);
    for (const intel of Object.values(ENEMY_INTEL)) {
      assertEquals(intel[lang].length, 2);
      assertEquals(intel[lang].every((s) => s.length > 0), true);
    }
  }
});

Deno.test("real wave order introduces only drone dart turret lancer", () => {
  const gate = new BriefingGate();
  assertEquals([1, 2, 3, 4, 5].map((s) => gate.open(s, true)), [
    "drone",
    "dart",
    "turret",
    "lancer",
    null,
  ]);
  assertEquals(gate.open(2, true), null);
});

Deno.test("unsafe transition, suppression, encountered and resume are guarded", () => {
  const gate = new BriefingGate();
  assertEquals(gate.open(2, false), null);
  assertEquals(gate.seen.size, 0);
  assertEquals(gate.open(2, true), "dart");
  gate.suppressed = true;
  assertEquals(gate.open(3, true), null);
  assertEquals(
    nextBriefing({
      sector: 5,
      safeTransition: true,
      encountered: new Set(),
      suppressed: false,
    }),
    null,
  );
  assertEquals(
    nextBriefing({
      sector: 3,
      safeTransition: true,
      encountered: new Set(["turret"]),
      suppressed: false,
    }),
    null,
  );
});
