/**
 * Writ aim assist is a sim option, so it is deterministic and recorded:
 * the same seed, inputs and options always give the same run. Mirrors the
 * disarm test in sim_wave3_test.ts, with the ship parked just outside the
 * normal reach of the turret's barrel, on the side away from its weak point.
 */
import { assertEquals } from "@std/assert";
import {
  IDLE_INPUT,
  type InputFrame,
  type SimEvent,
} from "../src/contracts/index.ts";
import { createSim, type NeonWardenSim } from "../src/sim/sim.ts";
import { WRIT_ALIGN_SLACK, WRIT_ASSIST_SLACK } from "../src/sim/tuning.ts";

const FIRE: InputFrame = { ...IDLE_INPUT, fire: true };

function stepN(sim: NeonWardenSim, n: number, input: InputFrame): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...sim.step(input));
  return all;
}

/**
 * A Writ fired `offset` units right of the turret barrel, after a lock. The
 * turret faces left (side -1), so its weak point is on the barrel's left.
 */
function writAt(offset: number, aimAssist: boolean): SimEvent[] {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
    aimAssist,
    scriptedSpawns: [{ at: 1, kind: "turret", x: 240, passive: true }],
  });
  stepN(sim, 40, { ...IDLE_INPUT, move: { x: 0, y: -1 }, fire: true });
  stepN(sim, 1, IDLE_INPUT);
  const turret = sim.snapshot().enemies[0];
  const barrel = turret.parts.find((p) => p.kind === "barrel")!;
  const target = turret.pos.x + barrel.offset.x + offset;
  const right: InputFrame = {
    ...IDLE_INPUT,
    move: { x: 1, y: 0 },
    focus: true,
  };
  while (sim.snapshot().player.pos.x < target - 0.5) sim.step(right);
  for (let i = 0; i < 400; i++) {
    if (sim.step(IDLE_INPUT).some((e) => e.type === "scanLock")) break;
  }
  return stepN(sim, 1, FIRE).concat(stepN(sim, 400, IDLE_INPUT));
}

Deno.test("aim assist widens the barrel's reach so a finger can disarm", () => {
  // Measured with this setup: unassisted disarms end between 14 and 16
  // units off the barrel, assisted ones between 16 and 18 (part radius plus
  // slack, plus the Writ's own contact). 16 sits in the gap the assist adds.
  const offset = 16;
  assertEquals(WRIT_ASSIST_SLACK - WRIT_ALIGN_SLACK, 6);
  const plain = writAt(offset, false);
  const assisted = writAt(offset, true);
  assertEquals(plain.filter((e) => e.type === "disarm").length, 0);
  assertEquals(assisted.filter((e) => e.type === "disarm").length, 1);
  assertEquals(assisted.filter((e) => e.type === "kill").length, 0);
});

Deno.test("aim assist is deterministic: same options, same events", () => {
  const a = JSON.stringify(writAt(16, true));
  const b = JSON.stringify(writAt(16, true));
  assertEquals(a, b);
});
