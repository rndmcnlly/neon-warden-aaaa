/**
 * Full headless runs of both autopilots, start to ending, at max speed, plus
 * focused checks of the sim's hooks (freeze, tutorial spawns, continues, the
 * two Warden endings). Run `deno run tests/sim_harness.ts 30` for a
 * survival-rate table across more seeds.
 */

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  IDLE_INPUT,
  type InputFrame,
  type SimEvent,
} from "../src/contracts/index.ts";
import { createSim, type NeonWardenSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { SECTORS, sectorSchedule } from "../src/sim/waves.ts";
import { BOSS, SURVIVAL_TOTAL_TICKS } from "../src/sim/tuning.ts";
import { PILOTS, runToEnd } from "./sim_harness.ts";

const SEEDS = [1, 2, 3, 121];

Deno.test("full runs replay identically from the same seed", () => {
  for (const make of [PILOTS.fight, PILOTS.pacifist]) {
    const a = runToEnd(121, make);
    const b = runToEnd(121, make);
    assertEquals(a.hash, b.hash);
    assertEquals(a.ticks, b.ticks);
  }
  assertNotEquals(
    runToEnd(1, PILOTS.fight).hash,
    runToEnd(2, PILOTS.fight).hash,
  );
});

Deno.test("the fighting autopilot defeats the Warden", () => {
  for (const seed of SEEDS) {
    const run = runToEnd(seed, PILOTS.fight);
    assertEquals(run.outcome, "bossDefeated", `seed ${seed}`);
    assertEquals(run.pacifistIntact, false);
    assert(run.firstPowerupTick !== null, "the flashback trigger fired");
  }
});

Deno.test("the pacifist autopilot survives the Warden without a kill", () => {
  for (const seed of SEEDS) {
    const run = runToEnd(seed, PILOTS.pacifist);
    assertEquals(run.outcome, "bossSurvived", `seed ${seed}`);
    assertEquals(run.kills, 0);
    assertEquals(run.pacifistIntact, true);
    // The salvage cache is the pacifist's route into the flashback.
    assert(run.firstPowerupTick !== null, "the flashback trigger fired");
  }
});

Deno.test("wave tables keep the starter's head counts", () => {
  const counts = SECTORS.map((plan) => sectorSchedule(plan).length);
  assertEquals(counts, [28, 38, 26, 40, 48]);
});

/** Steps until `done` says stop; returns every event seen. */
function runUntil(
  sim: NeonWardenSim,
  input: (sim: NeonWardenSim) => InputFrame,
  done: (events: readonly SimEvent[]) => boolean,
  limit = 20_000,
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < limit; i++) {
    const events = sim.step(input(sim));
    all.push(...events);
    if (done(events)) return all;
  }
  throw new Error("runUntil hit its limit");
}

Deno.test("freeze holds the world still for the flashback", () => {
  const sim = createSim({
    seed: 5,
    start: { kind: "sector", sector: 1 },
    difficulty: "normal",
  });
  for (let i = 0; i < 300; i++) sim.step(IDLE_INPUT);
  const before = hashSimState(sim.snapshot());
  sim.freeze();
  for (let i = 0; i < 500; i++) assertEquals(sim.step(IDLE_INPUT).length, 0);
  assertEquals(hashSimState(sim.snapshot()), before);
  sim.resume();
  sim.step(IDLE_INPUT);
  assertEquals(sim.snapshot().tick, 301);
});

Deno.test("the tutorial spawns only scripted targets and costs nothing", () => {
  const sim = createSim(
    {
      seed: 1,
      start: { kind: "tutorial" },
      difficulty: "normal",
      scriptedSpawns: [
        { at: 10, kind: "drone", x: 240, y: 100, passive: true },
        { at: 20, kind: "spread", x: 240, y: 500 },
      ],
    },
  );
  const fire = { ...IDLE_INPUT, fire: true };
  const events = runUntil(
    sim,
    () => fire,
    (e) => e.some((x) => x.type === "kill"),
  );
  assert(events.every((e) => e.type !== "spawn" || e.kind === "drone"));
  assertEquals(sim.snapshot().phase, "tutorial");
  sim.beginSector(1);
  const state = sim.snapshot();
  assertEquals(state.kills, 0);
  assertEquals(state.flags.pacifistIntact, true);
  assertEquals(state.phase, "sector");
});

Deno.test("game over waits for a continue", () => {
  const sim = createSim({
    seed: 2,
    start: { kind: "sector", sector: 3 },
    difficulty: "hard",
  });
  runUntil(sim, () => IDLE_INPUT, (e) => e.some((x) => x.type === "gameOver"));
  assertEquals(sim.snapshot().phase, "ended");
  const tick = sim.snapshot().tick;
  sim.step(IDLE_INPUT);
  assertEquals(sim.snapshot().tick, tick, "ended is terminal");
  assert(sim.continueRun());
  assertEquals(sim.snapshot().phase, "sector");
  assertEquals(sim.snapshot().player.lives, 3);
  runUntil(sim, () => IDLE_INPUT, (e) => e.some((x) => x.type === "gameOver"));
  assert(!sim.continueRun(), "hard offers one continue");
});

Deno.test("the Warden: descent, phases, and a timed survival ending", () => {
  const sim = createSim({
    seed: 3,
    start: { kind: "sector", sector: 6 },
    difficulty: "normal",
  });
  const pacifist = PILOTS.pacifist();
  const events = runUntil(
    sim,
    (s) => pacifist.next(s.snapshot()),
    () => sim.snapshot().phase === "ended",
  );
  const phases = events.flatMap((e) => e.type === "bossPhase" ? [e.phase] : []);
  assertEquals(phases, [0, 1, 2, 3]);
  const survived = events.find((e) => e.type === "bossSurvived");
  assert(survived);
  // The Warden spawns at the end of the warning and steps on that same tick,
  // hence the minus one.
  assertEquals(
    survived.tick,
    BOSS.warningTicks + BOSS.descentTicks + SURVIVAL_TOTAL_TICKS - 1,
  );
  // Nothing the player spared stays on screen.
  assertEquals(sim.snapshot().boss, null);
  assertEquals(sim.snapshot().enemies.length, 0);
});

Deno.test("killing the Warden takes its escorts and bullets with it", () => {
  const sim = createSim({
    seed: 4,
    start: { kind: "sector", sector: 6 },
    difficulty: "normal",
  });
  const fighter = PILOTS.fight();
  runUntil(
    sim,
    (s) => fighter.next(s.snapshot()),
    (e) => e.some((x) => x.type === "bossDefeated"),
  );
  const state = sim.snapshot();
  assertEquals(state.outcome, "bossDefeated");
  assertEquals(state.enemies.length, 0);
  assertEquals(state.bullets.filter((b) => b.kind !== "shot").length, 0);
  assertEquals(state.boss?.hp, 0);
});

Deno.test("only the first real powerup is flagged as the flashback trigger", () => {
  const sim = createSim(
    {
      seed: 1,
      start: { kind: "sector", sector: 1 },
      difficulty: "normal",
      scriptedSpawns: [
        { at: 5, kind: "spread", x: 240, y: 540 },
        { at: 6, kind: "shield", x: 240, y: 540 },
      ],
    },
  );
  const pickups = runUntil(
    sim,
    () => IDLE_INPUT,
    () => sim.snapshot().pickups.length === 0 && sim.snapshot().tick > 6,
  ).flatMap((e) => e.type === "pickup" ? [e.firstPowerup] : []);
  assertEquals(pickups, [true, false]);
  assert(sim.snapshot().flags.firstPowerupTaken);
});
