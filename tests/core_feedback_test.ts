/**
 * Core feedback (night plan step 4a): the feedback ladder, tick-domain
 * hitstop and its determinism, the sim's impact fields, and how gameplay
 * audio routes the new rungs.
 */

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import type {
  Pilot,
  SimEvent,
  SimStart,
  SimState,
} from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";
import { PacifistAutopilot } from "../src/pilots/pacifist.ts";
import { runTicks } from "../src/app/tickLoop.ts";
import {
  Hitstop,
  HITSTOP_BUDGET_TICKS,
  HITSTOP_MAX_SPEED,
} from "../src/render/hitstop.ts";
import {
  deferredBy,
  isDeferrable,
  LADDER,
  type Rung,
  rungOf,
} from "../src/render/feedbackLadder.ts";
import { GameplayAudio, type SoundCue } from "../src/audio/gameplayAudio.ts";
import { GAMEPLAY_SOUNDS } from "../src/audio/gameplaySounds.ts";

const ev = (e: Record<string, unknown>) => ({ tick: 0, ...e }) as SimEvent;

// ---------------------------------------------------------------- ladder

Deno.test("ladder: neighbors differ in at least two channels", () => {
  const rungs = (Object.entries(LADDER) as [Rung, typeof LADDER[Rung]][])
    .sort((a, b) => a[1].rank - b[1].rank);
  assertEquals(rungs.map(([r]) => r), [
    "graze",
    "hullHit",
    "deflect",
    "weakPointHit",
    "partBreak",
    "disarm",
    "kill",
    "podBreak",
    "lifeLost",
  ]);
  for (let i = 1; i < rungs.length; i++) {
    const [a, b] = [rungs[i - 1][1], rungs[i][1]];
    const differ = (["sound", "shape", "motion"] as const)
      .filter((k) => a[k] !== b[k]).length;
    assert(differ >= 2, `${rungs[i - 1][0]} vs ${rungs[i][0]}`);
  }
});

Deno.test("ladder: events find their rungs", () => {
  const hit = (over: Record<string, unknown>) =>
    ev({
      type: "hit",
      target: "enemy",
      blocked: false,
      part: null,
      level: 0,
      ...over,
    });
  assertEquals(rungOf(hit({})), "hullHit");
  assertEquals(rungOf(hit({ part: "gun" })), "weakPointHit");
  assertEquals(rungOf(hit({ level: 2 })), "weakPointHit");
  assertEquals(rungOf(hit({ target: "boss", blocked: true })), "deflect");
  assertEquals(rungOf(hit({ target: "player" })), null);
  assertEquals(rungOf(ev({ type: "partBreak", target: "boss" })), "podBreak");
  assertEquals(rungOf(ev({ type: "partBreak", target: "enemy" })), "partBreak");
  assertEquals(rungOf(ev({ type: "lifeLost" })), "lifeLost");
  const kill = ev({ type: "kill", kind: "drone" });
  assert(deferredBy([kill, ev({ type: "lifeLost" })]));
  assert(!deferredBy([kill]));
  assert(isDeferrable(kill));
});

// --------------------------------------------------------------- hitstop

Deno.test("hitstop: a lost life freezes longest and ignores the budget", () => {
  const h = new Hitstop();
  const lifeLost = ev({ type: "lifeLost" });
  const pod = ev({ type: "partBreak", target: "boss" });
  h.note([pod]);
  assertEquals(h.pending, LADDER.podBreak.hitstopTicks);
  h.note([lifeLost]);
  assertEquals(h.pending, LADDER.lifeLost.hitstopTicks);
  // Burn the whole crowd budget, then a pod break gets nothing more, but a
  // lost life still gets its full freeze.
  const crowded = new Hitstop();
  let frozen = 0;
  for (let i = 0; i < 20; i++) {
    crowded.note([pod]);
    while (crowded.hold()) frozen++;
  }
  assertEquals(frozen, HITSTOP_BUDGET_TICKS);
  crowded.note([pod]);
  assertEquals(crowded.pending, 0);
  crowded.note([lifeLost]);
  assertEquals(crowded.pending, LADDER.lifeLost.hitstopTicks);
});

Deno.test("hitstop: off under autoplay faster than real time", () => {
  const h = new Hitstop(HITSTOP_MAX_SPEED);
  h.note([ev({ type: "lifeLost" })]);
  assertEquals(h.hold(), false);
  assert(new Hitstop(1).enabled);
  assert(!new Hitstop(1, false).enabled);
});

// ----------------------------------------------------------- determinism

interface Recorded {
  readonly events: string;
  readonly hash: string;
  readonly frozen: number;
  readonly outcome: string | null;
}

/** Runs to an ending through the real tick loop, hitstop on or off. */
function play(
  start: SimStart,
  makePilot: () => Pilot,
  withHitstop: boolean,
  seed = 121,
): Recorded {
  const sim = createSim({
    seed,
    start,
    difficulty: "normal",
    autoContinue: true,
  });
  const pilot = makePilot();
  const hitstop = new Hitstop(1, withHitstop);
  const log: SimEvent[] = [];
  let frozen = 0;
  // Frames of 3 ticks, like a 20 Hz display: freezes straddle frames.
  for (let frame = 0; frame < 30_000; frame++) {
    if (sim.snapshot().phase === "ended") break;
    const r = runTicks(3, sim, pilot, hitstop, ({ events }) => {
      log.push(...events);
    });
    frozen += r.frozen;
  }
  const end = sim.snapshot();
  return {
    events: JSON.stringify(log),
    hash: hashSimState(end),
    frozen,
    outcome: end.outcome,
  };
}

Deno.test("hitstop: a fighting run to the Warden replays identically", () => {
  const boss: SimStart = { kind: "sector", sector: 6 };
  const plain = play(boss, () => new FightingAutopilot(), false);
  const frozen = play(boss, () => new FightingAutopilot(), true);
  assertEquals(plain.frozen, 0);
  assert(frozen.frozen > 0, "the run should have frozen at least once");
  assertEquals(frozen.outcome, plain.outcome);
  assertEquals(frozen.hash, plain.hash);
  assertEquals(frozen.events, plain.events);
});

Deno.test("hitstop: autopilot endings stay deterministic (sector 1)", () => {
  const start: SimStart = { kind: "sector", sector: 1 };
  for (
    const make of [() => new FightingAutopilot(), () => new PacifistAutopilot()]
  ) {
    const plain = play(start, make, false, 7);
    const frozen = play(start, make, true, 7);
    assert(frozen.frozen > 0);
    assertEquals(frozen.hash, plain.hash);
    assertEquals(frozen.events, plain.events);
    assertNotEquals(plain.outcome, null);
  }
});

// ------------------------------------------------------- impact fields

Deno.test("sim: hits, part breaks and Writ misses carry impact data", () => {
  const sim = createSim({
    seed: 121,
    start: { kind: "sector", sector: 1 },
    difficulty: "normal",
    autoContinue: true,
  });
  const pilot = new FightingAutopilot();
  const seen = { hit: 0, writHit: 0, partBreak: 0, writMissed: 0 };
  while (sim.snapshot().phase !== "ended" && sim.snapshot().tick < 40_000) {
    for (const e of sim.step(pilot.next(sim.snapshot()))) {
      if (e.type === "hit" && e.target !== "player") {
        seen.hit++;
        if (e.by === "ram") {
          assertEquals(e.shotVel, { x: 0, y: 0 });
        } else {
          assert(e.shotVel.y < 0, "player rounds fly up-lane");
          assertEquals(e.level > 0, e.by === "writ");
        }
        if (e.level > 0) seen.writHit++;
      }
      if (e.type === "partBreak") {
        seen.partBreak++;
        assert(Number.isFinite(e.hitPos.x) && e.shotVel.y < 0);
      }
      if (e.type === "writMissed") {
        seen.writMissed++;
        assert(e.level >= 1 && e.level <= 3);
        assert(e.pos.y < 0, "a miss leaves through the top");
      }
    }
  }
  assert(seen.hit > 0 && seen.writHit > 0 && seen.partBreak > 0, `${seen}`);
  assert(seen.writMissed > 0, JSON.stringify(seen));
});

// ---------------------------------------------------------------- audio

function audioRig() {
  const cues: SoundCue[] = [];
  const audio = new GameplayAudio({
    play: (c) => cues.push(c),
    loop: () => {},
  });
  const state = {
    player: { pos: { x: 240, y: 560 }, vel: { x: 0, y: 0 }, scan: {} },
    enemies: [],
    boss: null,
    flags: { pacifistIntact: false },
  } as unknown as SimState;
  return { audio, cues, state, roles: () => cues.map((c) => c.role) };
}

const impact = (over: Record<string, unknown>) =>
  ev({
    type: "hit",
    target: "enemy",
    id: 1,
    blocked: false,
    absorbedByShield: false,
    pos: { x: 100, y: 100 },
    shotVel: { x: 0, y: -10 },
    by: "stream",
    level: 0,
    part: null,
    ...over,
  });

Deno.test("audio: stream hits in one tick merge into one louder voice", () => {
  const { audio, cues, state } = audioRig();
  for (let i = 0; i < 4; i++) audio.onEvent(impact({}), state);
  assertEquals(cues.length, 0, "merged hits wait for the tick's end");
  audio.frame(state);
  assertEquals(cues.map((c) => c.role), ["hit_enemy"]);
  assertEquals(cues[0].gainDb, 4);
});

Deno.test("audio: each rung has its own sound", () => {
  const { audio, roles, state } = audioRig();
  audio.onEvent(impact({ by: "aimed" }), state);
  audio.onEvent(impact({ by: "writ", level: 1 }), state);
  audio.onEvent(impact({ by: "writ", level: 3 }), state);
  audio.onEvent(
    ev({ type: "writMissed", pos: { x: 0, y: -5 }, level: 2 }),
    state,
  );
  audio.onEvent(
    impact({ target: "boss", blocked: true, by: "writ", level: 2 }),
    state,
  );
  audio.onEvent(impact({ target: "boss", blocked: true }), state);
  audio.onEvent(
    ev({ type: "disarm", id: 1, kind: "drone", pos: { x: 0, y: 0 } }),
    state,
  );
  audio.onEvent(
    ev({ type: "partBreak", id: 9, target: "boss", pos: { x: 0, y: 0 } }),
    state,
  );
  audio.onEvent(ev({ type: "lifeLost", livesLeft: 1 }), state);
  audio.frame(state);
  const heard = roles();
  for (
    const role of [
      "tap_impact",
      "writ_impact_1",
      "writ_impact_3",
      "writ_miss",
      "writ_blocked_2",
      "hit_deflect",
      "ricochet_tink",
      "disarm_unlatch",
      "power_down",
      "pod_break",
      "life_lost",
      "life_alarm",
    ] as const
  ) {
    assert(heard.includes(role), role);
    assert(role in GAMEPLAY_SOUNDS, role);
  }
  assert(!heard.includes("kill_small") && !heard.includes("disarm"));
});

Deno.test("audio: a Writ on armor clangs, apart from stream deflects", () => {
  const { audio, roles, state } = audioRig();
  audio.onEvent(
    impact({ target: "boss", blocked: true, by: "writ", level: 3 }),
    state,
  );
  audio.frame(state);
  const heard = roles();
  assert(heard.includes("writ_blocked_3"));
  assert(!heard.includes("writ_impact_3"));
  assert(!heard.includes("hit_deflect") && !heard.includes("ricochet_tink"));
});

Deno.test("audio: deferred kills wait; threat cues are protected", () => {
  const { audio, cues, state } = audioRig();
  audio.onEvent(
    ev({ type: "kill", id: 1, kind: "drone", byRam: true }),
    state,
    { delayS: 0.35 },
  );
  assert(cues.length > 0 && cues.every((c) => c.delayS === 0.35));
  for (
    const role of [
      "enemy_fire",
      "enemy_fire_heavy",
      "hit_player",
      "life_lost",
      "life_alarm",
      "boss_roar",
    ] as const
  ) {
    assert(GAMEPLAY_SOUNDS[role].protected, role);
  }
  assertEquals(GAMEPLAY_SOUNDS.life_lost.clearBelow, 6);
});
