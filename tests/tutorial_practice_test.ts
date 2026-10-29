/**
 * Regression for Adam's first playtest: the first required kill was a trick
 * shot that sent the practice target flying off screen, and the tutorial
 * never registered it. Cause: aimed taps from below break the hologram's
 * forward gun part first, which disarms it; a disarmed scout retreats off
 * the top and leaves as `despawn: spared`, never as `kill`, and the
 * tutorial only listened for kills. Now any removal by the player counts,
 * and a target that escapes on its own is re-issued with a line.
 */

import { assert, assertEquals } from "@std/assert";
import {
  IDLE_INPUT,
  type InputFrame,
  type LineId,
  type SimEvent,
} from "../src/contracts/index.ts";
import { createSim, type NeonWardenSim } from "../src/sim/sim.ts";
import {
  ESCAPED_FALLBACK,
  TutorialProgress,
} from "../src/director/tutorialProgress.ts";
import { FLAGS } from "../src/scenes/flags.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";

function tutorialRig() {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const flags = new Set<string>();
  const said: LineId[] = [];
  const progress = new TutorialProgress({
    setFlag: (flag) => flags.add(flag),
    getFlag: (flag) => flags.has(flag),
    interject: (line) => (said.push(line), true),
  });
  const events: SimEvent[] = [];
  const run = (ticks: number, input: (t: number) => InputFrame) => {
    for (let t = 0; t < ticks; t++) {
      for (const event of sim.step(input(t))) {
        events.push(event);
        progress.note(event);
      }
    }
  };
  return { sim, flags, said, events, run };
}

const practice = (events: readonly SimEvent[]) =>
  events.filter((e): e is Extract<SimEvent, { type: "practiceTarget" }> =>
    e.type === "practiceTarget"
  );

function targetIds(sim: NeonWardenSim): number[] {
  return sim.snapshot().enemies.map((e) => e.id);
}

Deno.test("tutorial: a disarm that sends the target flying counts", () => {
  const rig = tutorialRig();
  rig.sim.setStoryFlag(FLAGS.tutSpawnTarget, true);
  // Tap from straight below until the gun part breaks, then stop shooting
  // and watch the hologram fly off the top (the playtest's trick shot).
  let disarmedAt = -1;
  rig.run(400, (t) => {
    if (disarmedAt < 0 && rig.events.some((e) => e.type === "disarm")) {
      disarmedAt = t;
    }
    return { ...IDLE_INPUT, fire: disarmedAt < 0 && t % 12 < 2 };
  });
  assert(disarmedAt > 0, "the taps disarmed the hologram");
  // Reported once, as a disarm, even if a round already in flight later
  // catches the retreating hologram.
  assertEquals(practice(rig.events).map((e) => e.result), ["disarmed"]);
  assert(rig.flags.has(FLAGS.tutTargetDestroyed));
});

Deno.test("tutorial: a kill counts, and the lesson's end stops re-issue", () => {
  const rig = tutorialRig();
  rig.sim.setStoryFlag(FLAGS.tutSpawnTarget, true);
  // Hold the stream: hull damage, no aimed part hits, so it dies.
  rig.run(600, () => ({ ...IDLE_INPUT, fire: true }));
  assertEquals(practice(rig.events)[0]?.result, "destroyed");
  assert(rig.flags.has(FLAGS.tutTargetDestroyed));
  // The timeline clears the flag right after; nothing new appears.
  rig.sim.setStoryFlag(FLAGS.tutSpawnTarget, false);
  rig.run(300, () => IDLE_INPUT);
  assertEquals(targetIds(rig.sim), []);
});

Deno.test("tutorial: a player removal mid-lesson re-issues the target", () => {
  const rig = tutorialRig();
  rig.sim.setStoryFlag(FLAGS.tutSpawnTarget, true);
  rig.run(600, () => ({ ...IDLE_INPUT, fire: true }));
  const first = practice(rig.events)[0];
  assert(first);
  // Flag still on (say, the lock lesson): a fresh hologram after a beat.
  rig.run(120, () => IDLE_INPUT);
  const ids = targetIds(rig.sim);
  assertEquals(ids.length, 1);
  assert(ids[0] !== first.id);
});

Deno.test("tutorial: an escaped target respawns with a line", () => {
  const rig = tutorialRig();
  rig.sim.setStoryFlag(FLAGS.tutSpawnTarget, true);
  const [original] = targetIds(rig.sim);
  // Park the ship in the corner and never shoot: the hologram drifts away.
  rig.run(3000, () => ({ ...IDLE_INPUT, move: { x: -1, y: 0 } }));
  const escaped = practice(rig.events).find((e) => e.result === "escaped");
  assert(escaped, "the hologram escaped");
  assertEquals(escaped.id, original);
  assert(escaped.respawned !== null);
  assert(!rig.flags.has(FLAGS.tutTargetDestroyed), "an escape is no kill");
  assertEquals(rig.said, [ESCAPED_FALLBACK]);
  assert(targetIds(rig.sim).includes(escaped.respawned));
});

Deno.test("tutorial: drill stats never leak into the run", () => {
  const rig = tutorialRig();
  rig.run(200, () => ({ ...IDLE_INPUT, fire: true }));
  assert(rig.sim.playerStats().roundsFired > 0);
  rig.sim.beginSector(1);
  assertEquals(rig.sim.playerStats().roundsFired, 0);
});

Deno.test("tutorial: idle fighting autopilot demonstrates the complete trigger verb", () => {
  const rig = tutorialRig();
  const pilot = new FightingAutopilot();
  rig.run(720, () => pilot.next(rig.sim.snapshot()));
  for (
    const flag of [
      FLAGS.tutTapped,
      FLAGS.tutStreamed,
      FLAGS.tutCharged,
      FLAGS.tutWritFired,
    ]
  ) assert(rig.flags.has(flag), `autopilot demonstrates ${flag}`);
});

Deno.test("tutorial: a missed graze volley is retryable and the demo can complete it", () => {
  const rig = tutorialRig();
  rig.flags.add(FLAGS.tutGrazeDrill);
  rig.sim.setStoryFlag(FLAGS.tutGrazeDrill, true);
  // Miss an entire volley. The lesson must still offer fresh bullets.
  rig.run(600, () => ({ ...IDLE_INPUT, move: { x: -1, y: 0 } }));
  assert(rig.sim.snapshot().bullets.some((b) => b.kind !== "shot"));
  const pilot = new FightingAutopilot();
  rig.run(900, () => pilot.next(rig.sim.snapshot()));
  assert(rig.flags.has(FLAGS.tutGrazed));
  rig.sim.setStoryFlag(FLAGS.tutGrazeDrill, false);
  rig.run(900, () => IDLE_INPUT);
  assertEquals(rig.sim.snapshot().bullets.length, 0);
});
