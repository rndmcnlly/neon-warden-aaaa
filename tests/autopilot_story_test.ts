/**
 * The autopilots must reach the story beats a patient player reaches, or
 * attract mode, QA reels and the trailers silently skip them. Two gaps the
 * trailer render found (research/2026-10-29-trailer-render/README.md):
 *
 * - the tutorial demo rested exactly as long as a full charge takes, so the
 *   rest gate (30 ticks of rest at full charge) never opened and the wink
 *   (`tut_wink_001`) was unreachable;
 * - the fighting autopilot killed the Warden about 16 s into phase 3, before
 *   its turn (`boss_turn_001/002`) started.
 *
 * Headless: the real tutorial timeline's gates are walked against the sim
 * (lines take no time here; the sim waits only on `waitFlag`).
 */

import { assert, assertEquals } from "@std/assert";
import {
  type Cue,
  DEFAULT_LOADOUT,
  IDLE_INPUT,
  type Pilot,
  type SimEvent,
  type WeaponPackageId,
} from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { TutorialProgress } from "../src/director/tutorialProgress.ts";
import { tutorial } from "../src/scenes/tutorial.timeline.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";
import { PacifistAutopilot } from "../src/pilots/pacifist.ts";
import { withTutorialDemo } from "../src/app/tutorialDemo.ts";

/** A gate a patient player clears well inside a minute. */
const GATE_CAP = 60 * 60;

function flatten(cues: readonly Cue[]): Cue[] {
  return cues.flatMap((cue) =>
    cue.type === "branch" ? flatten(cue.else ?? []) : [cue]
  );
}

/** Walks the tutorial; returns the gates cleared in order and their ticks. */
function walkTutorial(pilot: Pilot, weapon: WeaponPackageId = "standard") {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
    loadout: { ...DEFAULT_LOADOUT, weapon },
  });
  const flags = new Set<string>();
  let waiting: string | null = null;
  const progress = new TutorialProgress({
    setFlag: (flag) => flags.add(flag),
    getFlag: (flag) => flags.has(flag),
    interject: () => true,
    waitingFlag: () => waiting,
    humanInput: () => false,
  });
  const cleared: { flag: string; ticks: number }[] = [];
  let reachedWink = false;
  const step = () => {
    const before = sim.snapshot();
    const input = pilot.next(before);
    progress.input(input, before);
    for (const event of sim.step(input)) progress.note(event);
  };
  for (const cue of flatten(tutorial.cues)) {
    if (cue.type === "say" && cue.line === "tut_wink_001") reachedWink = true;
    if (cue.type === "say") { for (let i = 0; i < 30; i++) step(); }
    if (cue.type === "setFlag") {
      cue.value ? flags.add(cue.flag) : flags.delete(cue.flag);
      sim.setStoryFlag(cue.flag, cue.value);
    }
    if (cue.type !== "waitFlag") continue;
    waiting = cue.flag;
    let ticks = 0;
    while (!flags.has(cue.flag) && ticks < GATE_CAP) {
      step();
      ticks++;
    }
    waiting = null;
    if (!flags.has(cue.flag)) {
      return { cleared, stalledAt: cue.flag, reachedWink };
    }
    cleared.push({ flag: cue.flag, ticks });
  }
  return { cleared, stalledAt: null, reachedWink };
}

Deno.test("fighting autopilot clears every tutorial gate to the wink", () => {
  const walk = walkTutorial(withTutorialDemo(new FightingAutopilot()));
  assertEquals(walk.stalledAt, null, JSON.stringify(walk.cleared));
  assert(walk.reachedWink);
});

Deno.test("the rest drill passes on the slowest-charging weapon too", () => {
  const walk = walkTutorial(
    withTutorialDemo(new FightingAutopilot()),
    "magistrate",
  );
  assertEquals(walk.stalledAt, null, JSON.stringify(walk.cleared));
});

// Known gap, recorded rather than hidden: the pacifist demo never fires, so
// it waits at the first firing drill. Pacifist reels start past the tutorial.
Deno.test("pacifist demo still stops at the first firing drill", () => {
  const walk = walkTutorial(withTutorialDemo(new PacifistAutopilot()));
  assertEquals(walk.stalledAt, "tut.fired");
});

Deno.test("a practice turret destroyed before its barrel breaks is re-issued", () => {
  const sim = createSim({
    seed: 1,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  sim.setStoryFlag("tut.spawnTurret", true);
  const events: SimEvent[] = [];
  // Hold the stream under it: hull damage, no Writ for the barrel.
  for (let t = 0; t < 900; t++) {
    events.push(...sim.step({ ...IDLE_INPUT, fire: true }));
  }
  const turrets = events.filter((e) => e.type === "spawn");
  const kill = events.find((e) => e.type === "kill");
  assert(kill, "the stream destroyed the turret");
  assert(!events.some((e) => e.type === "partBreak"), "barrel never broke");
  assertEquals(turrets.length >= 2, true, "a second turret was issued");
  // Once the drill ends, no more turrets.
  sim.setStoryFlag("tut.spawnTurret", false);
  const after: SimEvent[] = [];
  for (let t = 0; t < 600; t++) {
    after.push(...sim.step({ ...IDLE_INPUT, fire: true }));
  }
  assert(!after.some((e) => e.type === "spawn"));
});

/**
 * The phase 3 timeline's schedule in English, in ticks: `boss_p3_001` (4.24
 * s), 5 s, `boss_p3_002` (3.28 s), 6 s, then the turn as a parley (6.8 s and
 * 3.12 s). Before this, the autopilot killed the Warden 12–15 s in.
 */
const TURN_AT = Math.round((4.24 + 5 + 3.28 + 6) * 60);
const TURN_TICKS = Math.round((6.8 + 3.12) * 60);

Deno.test("the fighting autopilot hears the Warden's turn out", () => {
  for (const seed of [1, 121]) {
    const sim = createSim({
      seed,
      start: { kind: "sector", sector: 1 },
      difficulty: "normal",
      autoContinue: true,
    });
    const pilot = new FightingAutopilot();
    let phase3: number | null = null;
    let defeated: number | null = null;
    let firedInParley = 0;
    while (defeated === null && sim.snapshot().tick < 40_000) {
      const state = sim.snapshot();
      if (phase3 !== null) {
        const t = state.tick - phase3;
        if (t === TURN_AT) sim.setStoryFlag("boss.parley", true);
        if (t === TURN_AT + TURN_TICKS) sim.setStoryFlag("boss.parley", false);
      }
      const input = pilot.next(sim.snapshot());
      if (sim.snapshot().boss?.ai === "parley" && input.fire) firedInParley++;
      for (const event of sim.step(input)) {
        if (event.type === "bossPhase" && event.phase === 3) {
          phase3 = event.tick;
        }
        if (event.type === "bossDefeated") defeated = event.tick;
      }
    }
    assert(phase3 !== null && defeated !== null, `seed ${seed}`);
    assert(
      defeated - phase3 > TURN_AT + TURN_TICKS,
      `seed ${seed}: killed ${(defeated - phase3) / 60} s into phase 3`,
    );
    assertEquals(firedInParley, 0, "held fire while the Warden talked");
  }
});
