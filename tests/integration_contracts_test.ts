/**
 * Contract features added in the integration pass: the Director's `waitFlag`
 * cue and flag port, and the sim's story flags (`boss.parley`,
 * `tut.spawnTarget`) plus the boss `spawn` and blocked `hit` events.
 */

import { assert, assertEquals } from "@std/assert";
import {
  IDLE_INPUT,
  lineId,
  type SimEvent,
  type Timeline,
} from "../src/contracts/index.ts";
import { makeRig } from "../src/director/fakes.ts";
import { createSim } from "../src/sim/sim.ts";

const NUDGE = lineId("nudge");

const waiting: Timeline = {
  id: "wait-test",
  cues: [
    { type: "setFlag", flag: "x.ready", value: false },
    {
      type: "waitFlag",
      flag: "x.ready",
      value: true,
      nudge: { line: NUDGE, afterMs: 1000 },
    },
    { type: "music", cue: "gameplay", fadeMs: 0 },
  ],
};

Deno.test("waitFlag blocks until the flag flips, nudging once", async () => {
  const rig = makeRig({ nudge: 300 });
  const done = rig.director.play(waiting);
  rig.advance(900);
  assertEquals(rig.log, []);
  rig.advance(3000);
  const nudges = rig.log.filter((l) => l.startsWith("say scripted nudge"));
  assertEquals(nudges.length, 1, "the nudge plays exactly once");
  rig.director.setFlag("x.ready", true);
  rig.advance(16);
  assertEquals(rig.flagLog, ["x.ready false", "x.ready true"]);
  assertEquals(rig.log.at(-1), "music gameplay 0");
  await done;
});

Deno.test("skipping a scene releases a flag wait and reports flags", async () => {
  const rig = makeRig();
  const done = rig.director.play({
    id: "skip-test",
    cues: [
      { type: "waitFlag", flag: "never", value: true },
      { type: "setFlag", flag: "boss.parley", value: true },
    ],
  });
  rig.director.skipScene();
  await done;
  assert(rig.flagLog.includes("boss.parley true"));
});

function bossSim() {
  return createSim({
    seed: 3,
    start: { kind: "sector", sector: 6 },
    difficulty: "normal",
  });
}

function stepUntil(
  sim: ReturnType<typeof createSim>,
  done: (events: readonly SimEvent[]) => boolean,
  limit = 2000,
): readonly SimEvent[] {
  for (let i = 0; i < limit; i++) {
    const events = sim.step(IDLE_INPUT);
    if (done(events)) return events;
  }
  throw new Error("condition never met");
}

Deno.test("the Warden's arrival is a spawn event", () => {
  const sim = bossSim();
  const events = stepUntil(
    sim,
    (es) => es.some((e) => e.type === "spawn" && e.kind === "warden"),
  );
  assert(events.length > 0);
  assert(sim.snapshot().boss !== null);
});

Deno.test("boss.parley holds the Warden still and blocks damage", () => {
  const sim = bossSim();
  stepUntil(sim, () => sim.snapshot().boss?.invulnerable === false);
  sim.setStoryFlag("boss.parley", true);
  const before = sim.snapshot().boss!;
  let blocked = 0;
  for (let i = 0; i < 120; i++) {
    for (const e of sim.step({ ...IDLE_INPUT, fire: true })) {
      if (e.type === "hit" && e.target === "boss") {
        assert(e.blocked, "no damage while it talks");
        blocked++;
      }
    }
  }
  const after = sim.snapshot().boss!;
  assertEquals(after.hp, before.hp);
  assertEquals(after.pos, before.pos);
  assert(after.invulnerable);
  assert(blocked > 0, "shots still connect, as deflections");
  sim.setStoryFlag("boss.parley", false);
  stepUntil(
    sim,
    (es) => es.some((e) => e.type === "hit" && !e.blocked),
    600,
  );
});

Deno.test("tut.spawnTarget drops one passive practice drone", () => {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  sim.setStoryFlag("tut.spawnTarget", true);
  sim.setStoryFlag("tut.spawnTarget", true);
  const events = sim.step(IDLE_INPUT);
  assertEquals(events.filter((e) => e.type === "spawn").length, 1);
  assertEquals(sim.snapshot().enemies.length, 1);
});
