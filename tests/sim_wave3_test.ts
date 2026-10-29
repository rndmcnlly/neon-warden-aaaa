/**
 * Wave 3 core loop: the trigger verb, the scan beam, parts and disarming,
 * grazing, pay, the Warden's pods, the flight recorder, loadouts, and the
 * three autopilots across seeds and difficulties.
 */

import { assert, assertEquals } from "@std/assert";
import {
  DEFAULT_LOADOUT,
  type Difficulty,
  IDLE_INPUT,
  type InputFrame,
  type Loadout,
  type SimEvent,
} from "../src/contracts/index.ts";
import { createSim, type NeonWardenSim } from "../src/sim/sim.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";
import { GhostAutopilot } from "../src/pilots/pacifist.ts";
import { PILOTS, runToEnd } from "./sim_harness.ts";

const FIRE: InputFrame = { ...IDLE_INPUT, fire: true };

function stepN(sim: NeonWardenSim, n: number, input: InputFrame): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...sim.step(input));
  return all;
}

function ofType<T extends SimEvent["type"]>(
  events: readonly SimEvent[],
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> =>
    e.type === type
  );
}

/** A tutorial sim with one passive turret overhead and the ship raised. */
function turretRange(loadout?: Loadout): NeonWardenSim {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
    loadout,
    scriptedSpawns: [{ at: 1, kind: "turret", x: 240, passive: true }],
  });
  // Up 40 ticks at full speed: the turret parks inside every beam's range.
  stepN(sim, 40, { ...IDLE_INPUT, move: { x: 0, y: -1 }, fire: true });
  stepN(sim, 1, IDLE_INPUT);
  return sim;
}

function untilLock(sim: NeonWardenSim): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < 400; i++) {
    const events = sim.step(IDLE_INPUT);
    all.push(...events);
    if (events.some((e) => e.type === "scanLock")) return all;
  }
  throw new Error("no lock");
}

Deno.test("trigger: tap is aimed, hold streams, rest charges a Writ", () => {
  const sim = createSim({
    seed: 9,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const held = ofType(stepN(sim, 30, FIRE), "playerFired");
  assertEquals(held[0].shot, "aimed");
  assertEquals(held[0].tick, 1);
  assert(held.slice(1).every((e) => e.shot === "stream" && e.tick > 8));
  const rest = stepN(sim, 120, IDLE_INPUT);
  assertEquals(ofType(rest, "chargeLevel").map((e) => e.level), [1, 2, 3]);
  assertEquals(sim.snapshot().player.chargeLevel, 3);
  assertEquals(sim.snapshot().player.trigger, "rest");
  const press = stepN(sim, 1, FIRE);
  const writ = ofType(press, "playerFired")[0];
  assertEquals([writ.shot, writ.level], ["writ", 3]);
  assertEquals(ofType(press, "chargeLevel")[0].level, 0);
});

Deno.test("scan: dwell locks, and the intel is the real FSM state", () => {
  const sim = turretRange();
  const events = untilLock(sim);
  const lock = ofType(events, "scanLock")[0];
  const turret = sim.snapshot().enemies.find((e) => e.id === lock.id)!;
  assertEquals(lock.ai, turret.ai);
  assert(turret.locked);
  assertEquals(lock.first, true);
  const intel = ofType(events, "intel")[0];
  assertEquals(intel.codexId, "codex.enemy.turret");
  assert(ofType(events, "payChanged").some((e) => e.reason === "scan"));
});

Deno.test("a locked Writ on the barrel disarms; on the weak point it kills", () => {
  // Centered: the barrel. The turret is spared and leaves.
  const spare = turretRange();
  untilLock(spare);
  const spared = stepN(spare, 1, FIRE).concat(stepN(spare, 400, IDLE_INPUT));
  const disarm = ofType(spared, "disarm")[0];
  assert(disarm, "disarmed");
  assertEquals(ofType(spared, "kill").length, 0);
  assertEquals(spare.snapshot().scoutsSpared, 1);
  assert(
    ofType(spared, "despawn").some((e) => e.reason === "spared"),
    "it leaves the screen alive",
  );

  // Offset onto the weak point (the turret faces left: side -1).
  const kill = turretRange();
  const turret = kill.snapshot().enemies[0];
  const wpX = turret.pos.x + turret.weakPoint.offset.x;
  const left: InputFrame = {
    ...IDLE_INPUT,
    move: { x: -1, y: 0 },
    focus: true,
  };
  while (kill.snapshot().player.pos.x > wpX + 0.5) kill.step(left);
  untilLock(kill);
  const shot = stepN(kill, 1, FIRE).concat(stepN(kill, 60, IDLE_INPUT));
  const kills = ofType(shot, "kill");
  assertEquals(kills.length, 1);
  assertEquals(kills[0].clean, true);
});

Deno.test("graze drill: near misses graze once each and pay", () => {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  sim.step(IDLE_INPUT);
  sim.setStoryFlag("tut.grazeDrill", true);
  const events = stepN(sim, 400, IDLE_INPUT);
  const grazes = ofType(events, "graze");
  assertEquals(grazes.length, 6);
  assertEquals(grazes[0].first, true);
  assertEquals(new Set(grazes.map((g) => g.bulletId)).size, 6);
  assertEquals(ofType(events, "nearMiss").length, 6);
  assertEquals(ofType(events, "hit").length, 0);
  assertEquals(sim.snapshot().graze.count, 6);
  assert(sim.snapshot().pay.rate > 1);
});

Deno.test("enemies announce their volleys", () => {
  const sim = createSim({
    seed: 3,
    start: { kind: "sector", sector: 1 },
    difficulty: "normal",
    autoContinue: true,
  });
  const events = stepN(sim, 900, IDLE_INPUT);
  const volleys = ofType(events, "enemyFired");
  assert(volleys.length > 0);
  assert(volleys.every((v) => v.bullets > 0));
});

Deno.test("the flight recorder is the sector 3 cache and the flashback key", () => {
  const sim = createSim({
    seed: 2,
    start: { kind: "sector", sector: 3 },
    difficulty: "story",
    autoContinue: true,
  });
  const events = stepN(sim, 800, IDLE_INPUT);
  const pickup = ofType(events, "pickup").find((e) => e.kind === "recorder");
  assert(pickup, "recorder collected");
  assertEquals(pickup.firstPowerup, true);
  assert(
    ofType(events, "intel").some((e) => e.codexId === "codex.recorder.0121"),
  );
  assert(sim.snapshot().flags.recorderRecovered);
});

Deno.test("regression: each boss phase is announced once, even when a survival run turns violent", () => {
  const sim = createSim({
    seed: 5,
    start: { kind: "sector", sector: 6 },
    difficulty: "normal",
    autoContinue: true,
  });
  const ghost = new GhostAutopilot();
  const fighter = new FightingAutopilot();
  const phases: number[] = [];
  let pods = 0;
  let exposed = 0;
  for (let i = 0; i < 30_000 && sim.snapshot().phase !== "ended"; i++) {
    const state = sim.snapshot();
    // Survive into the clock's phase 2 (HP still says 1), then attack.
    const pilot = phases.includes(2) ? fighter : ghost;
    for (const e of sim.step(pilot.next(state))) {
      if (e.type === "bossPhase") phases.push(e.phase);
      if (e.type === "partBreak" && e.target === "boss") pods++;
      if (e.type === "coreExposed") exposed++;
    }
  }
  assertEquals(phases, [0, 1, 2, 3]);
  assertEquals(sim.snapshot().outcome, "bossDefeated");
  assert(pods >= 2);
  assertEquals(exposed, 1);
});

Deno.test("loadouts change play: sensors and weapons", () => {
  const lockTicks = (sensor: Loadout["sensor"]) =>
    ofType(
      untilLock(turretRange({ ...DEFAULT_LOADOUT, sensor })),
      "scanLock",
    )[0].tick;
  assert(lockTicks("auditor") < lockTicks("standard"));
  assert(lockTicks("standard") < lockTicks("surveyor"));

  const volleys = (weapon: Loadout["weapon"]) => {
    const sim = createSim({
      seed: 1,
      start: { kind: "tutorial" },
      difficulty: "normal",
      loadout: { ...DEFAULT_LOADOUT, weapon },
    });
    return ofType(stepN(sim, 200, FIRE), "playerFired").length;
  };
  assert(volleys("courier") > volleys("standard"));
  assert(volleys("standard") > volleys("magistrate"));
});

const DIFFICULTIES: readonly Difficulty[] = ["story", "normal", "hard"];
const SEEDS = [1, 121];

Deno.test("autopilots reach their endings across seeds and difficulties", () => {
  for (const difficulty of DIFFICULTIES) {
    for (const seed of SEEDS) {
      const at = `${difficulty} seed ${seed}`;
      const fight = runToEnd(seed, PILOTS.fight, difficulty);
      assertEquals(fight.outcome, "bossDefeated", at);
      assert(
        fight.writs > 0 && fight.locks > 0,
        `fighter scans and Writs, ${at}`,
      );

      const pacifist = runToEnd(seed, PILOTS.pacifist, difficulty);
      assertEquals(pacifist.outcome, "bossSurvived", at);
      assertEquals(pacifist.kills, 0, at);
      assert(pacifist.pacifistIntact, at);
      assert(pacifist.partsBroken > 0, `the disarmer disarms, ${at}`);

      let fired = 0;
      const ghost = runToEnd(seed, PILOTS.ghost, difficulty, undefined, (e) => {
        if (e.type === "playerFired") fired++;
      });
      assertEquals(ghost.outcome, "bossSurvived", at);
      assertEquals(fired, 0, at);
      assert(ghost.neverFired && ghost.pacifistIntact, at);
      assert(ghost.grazes > 0, at);
      for (const run of [fight, pacifist, ghost]) {
        assertEquals(run.bossPhases, [0, 1, 2, 3], at);
      }
    }
  }
});

Deno.test("every autopilot replays identically", () => {
  for (const make of [PILOTS.fight, PILOTS.pacifist, PILOTS.ghost]) {
    const a = runToEnd(7, make, "hard");
    const b = runToEnd(7, make, "hard");
    assertEquals(a.hash, b.hash);
    assertEquals(a.credits, b.credits);
  }
});
