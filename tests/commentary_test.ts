/**
 * The commentary scheduler (shuffle bags, cooldowns, priorities, scenes
 * winning) and the sim's player statistics and `statsMoment`s.
 */

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  IDLE_INPUT,
  type LineId,
  type SimEvent,
  type StatsMomentKind,
} from "../src/contracts/index.ts";
import {
  type CommentaryContext,
  type CommentaryPorts,
  CommentaryScheduler,
  memoryBagStore,
} from "../src/director/commentary.ts";
import type { Bank, StatsMoment } from "../src/scenes/banks/types.ts";
import { ALL_BANKS } from "../src/scenes/banks/index.ts";
import { lookup } from "../src/i18n/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { PlayerStats, STATS } from "../src/sim/stats.ts";
import { makeRig } from "../src/director/fakes.ts";
import type { Timeline } from "../src/contracts/index.ts";
import { lineId } from "../src/contracts/index.ts";

// The sim's moment names and W's bank names must stay one vocabulary.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const momentsAgree: Same<StatsMomentKind, StatsMoment> = true;

const CTX: CommentaryContext = {
  phase: "sector",
  sector: 2,
  bossPhase: null,
  livesLeft: 3,
  hasFired: true,
  neverFired: false,
};

function bank(id: string, n: number, extra: Partial<Bank> = {}): Bank {
  return {
    id,
    note: "test",
    triggers: [{ on: "event", type: "graze" }],
    speaker: "tutorial_ai",
    cooldownMs: 0,
    priority: 40,
    variants: Array.from({ length: n }, (_, i) => ({
      id: `bank.${id}.${i}`,
      vo: false,
      en: `${id} ${i}`,
      es: `${id} ${i}`,
      zh: `${id} ${i}`,
    })),
    ...extra,
  };
}

const graze: SimEvent = {
  type: "graze",
  tick: 1,
  bulletId: 1,
  pos: { x: 0, y: 0 },
  count: 1,
  meter: 0.1,
  first: false,
};

function scheduler(
  banks: readonly Bank[],
  over: Partial<CommentaryPorts> = {},
) {
  let t = 0;
  const spoken: LineId[] = [];
  let seed = 7;
  const ports: CommentaryPorts = {
    now: () => t,
    bark: (line) => (spoken.push(line), true),
    interject: () => false,
    sceneId: () => null,
    store: memoryBagStore(),
    random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
    ...over,
  };
  const s = new CommentaryScheduler(banks, ports);
  return {
    s,
    spoken,
    ports,
    later: (ms: number) => (t += ms),
  };
}

Deno.test("commentary: stats moment names match the banks", () => {
  assert(momentsAgree);
});

Deno.test("commentary: a bag never repeats until it empties", () => {
  const rig = scheduler([bank("b", 5)]);
  for (let i = 0; i < 15; i++) {
    rig.s.onEvent(graze, CTX);
    rig.later(10_000);
  }
  for (let round = 0; round < 3; round++) {
    const pool = rig.spoken.slice(round * 5, round * 5 + 5);
    assertEquals(new Set(pool).size, 5, `round ${round} deals all five`);
  }
  // Never the same line across a bag boundary.
  for (let i = 1; i < rig.spoken.length; i++) {
    assertNotEquals(rig.spoken[i], rig.spoken[i - 1]);
  }
});

Deno.test("commentary: bags persist across runs and sessions", () => {
  const store = memoryBagStore();
  const a = scheduler([bank("b", 4)], { store });
  a.s.onEvent(graze, CTX);
  a.later(10_000);
  a.s.onEvent(graze, CTX);
  const b = scheduler([bank("b", 4)], { store });
  b.s.onEvent(graze, CTX);
  b.later(10_000);
  b.s.onEvent(graze, CTX);
  assertEquals(new Set([...a.spoken, ...b.spoken]).size, 4);
});

Deno.test("commentary: cooldowns, the global gap, and urgent lines", () => {
  const rig = scheduler([
    bank("slow", 3, { cooldownMs: 20_000 }),
    bank("urgent", 3, {
      priority: 80,
      triggers: [{ on: "event", type: "lifeLost" }],
    }),
  ]);
  assert(rig.s.onEvent(graze, CTX));
  rig.later(8_000);
  assertEquals(rig.s.onEvent(graze, CTX), null, "bank cooldown");
  rig.later(1_000);
  const life: SimEvent = { type: "lifeLost", tick: 2, livesLeft: 2 };
  assert(rig.s.onEvent(life, CTX), "safety cuts the gap");
  rig.later(13_000);
  assert(rig.s.onEvent(graze, CTX));
});

Deno.test("commentary: higher priority wins; conditions filter", () => {
  const rig = scheduler([
    bank("low", 2, { priority: 20 }),
    bank("high", 2, { priority: 60 }),
    bank("pacifist", 2, { priority: 90, conditions: { run: "neverFired" } }),
  ]);
  assertEquals(rig.s.onEvent(graze, CTX)?.bank, "high");
});

Deno.test("commentary: scenes win; tutorial_ai may interject in the tutorial", () => {
  const interjected: LineId[] = [];
  let scene: string | null = "boss";
  const rig = scheduler([bank("b", 3)], {
    sceneId: () => scene,
    interject: (line) => (interjected.push(line), true),
  });
  assertEquals(rig.s.onEvent(graze, CTX), null, "a scene holds the floor");
  scene = "tutorial";
  assertEquals(rig.s.onEvent(graze, CTX)?.how, "interject");
  assertEquals(rig.spoken, []);
  assertEquals(interjected.length, 1);
});

Deno.test("commentary: an unspoken line goes back in the bag", () => {
  let open = false;
  const rig = scheduler([bank("b", 2)], { bark: () => open });
  assertEquals(rig.s.onEvent(graze, CTX), null);
  open = true;
  const first = rig.s.onEvent(graze, CTX);
  rig.later(10_000);
  const second = rig.s.onEvent(graze, CTX);
  assert(first && second);
  assertNotEquals(first.line, second.line);
});

Deno.test("commentary: every registered variant has text in every language", () => {
  for (const b of ALL_BANKS) {
    for (const v of b.variants) {
      for (const lang of ["en", "es", "zh"] as const) {
        assert(lookup(lineId(v.id), lang), `${v.id} ${lang}`);
      }
    }
  }
});

Deno.test("director: interject speaks only while a scene waits", () => {
  const rig = makeRig({ x: 2000, after: 1000 });
  const scene: Timeline = {
    id: "tutorial",
    cues: [
      { type: "waitFlag", flag: "go", value: true },
      { type: "say", line: lineId("after") },
    ],
  };
  assertEquals(rig.director.interject(lineId("x")), false, "no scene");
  void rig.director.play(scene);
  assert(rig.director.interject(lineId("x")));
  assertEquals(rig.director.interject(lineId("y")), false, "floor taken");
  // The flag arrives mid-interjection: the scene lets it finish first.
  rig.director.setFlag("go", true);
  rig.advance(100);
  assert(!rig.log.some((l) => l.includes("after")));
  rig.advance(10_000);
  assert(rig.log.some((l) => l.includes("after")));
});

// ------------------------------------------------------------- the sim

function moments(events: readonly SimEvent[]): StatsMomentKind[] {
  return events.flatMap((e) => e.type === "statsMoment" ? [e.moment] : []);
}

Deno.test("stats: firing at nothing is intoTheMist, once per spell", () => {
  const sim = createSim({
    seed: 3,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const events: SimEvent[] = [];
  // Taps at an empty sky: 12+ volleys.
  for (let t = 0; t < 900; t++) {
    events.push(...sim.step({ ...IDLE_INPUT, fire: t % 10 < 2 }));
  }
  const stats = sim.playerStats();
  assert(stats.volleysIntoMist >= STATS.mistVolleys);
  assertEquals(stats.roundsHit, 0);
  assertEquals(moments(events).filter((m) => m === "intoTheMist").length, 1);
});

Deno.test("stats: hysteresis and gaps keep moments rare", () => {
  const stats = new PlayerStats();
  const fired: StatsMomentKind[] = [];
  const ctx = (tick: number) => ({
    tick,
    gameplay: true,
    firing: false,
    moving: false,
    fullCharge: false,
    bossFighting: false,
  });
  // Graze, graze, graze: one grazeStreak per burst, bursts 30 s apart.
  for (let tick = 1; tick < 60 * 90; tick++) {
    if (tick % 1800 < 60 && tick % 6 === 0) {
      stats.note({ ...graze, tick });
    }
    for (const e of stats.step({ ...ctx(tick), moving: true })) {
      fired.push(e.moment);
    }
  }
  assertEquals(fired.filter((m) => m === "grazeStreak").length, 3);
});

Deno.test("stats: deaths in quick succession, accuracy and ratio", () => {
  const stats = new PlayerStats();
  stats.note({ type: "lifeLost", tick: 100, livesLeft: 2 });
  stats.note({ type: "lifeLost", tick: 1000, livesLeft: 1 });
  const out = stats.step({
    tick: 1000,
    gameplay: true,
    firing: true,
    moving: true,
    fullCharge: false,
    bossFighting: false,
  });
  assertEquals(out.map((e) => e.moment), ["repeatedDeaths"]);
  stats.volley("aimed", 4, 0, false);
  for (const hit of [true, false, false, true]) stats.roundResolved(hit);
  stats.note({
    type: "disarm",
    tick: 1001,
    id: 1,
    kind: "drone",
    pos: { x: 0, y: 0 },
    cancelled: 0,
    first: true,
  });
  const view = stats.view();
  assertEquals(view.deaths, 2);
  assertEquals(view.accuracy, 0.5);
  assertEquals(view.disarmRatio, 1);
});

Deno.test("stats: a fighting run says something, but not much", () => {
  const sim = createSim({
    seed: 11,
    start: { kind: "sector", sector: 1 },
    difficulty: "normal",
    autoContinue: true,
  });
  const events: SimEvent[] = [];
  for (let t = 0; t < 60 * 120; t++) {
    events.push(...sim.step({ ...IDLE_INPUT, fire: t % 120 < 90 }));
  }
  const said = moments(events);
  // Two minutes: some remarks, never more than one per global gap.
  assert(said.length <= (60 * 120) / STATS.globalGap + 1);
  const ticks = events.filter((e) => e.type === "statsMoment").map((e) =>
    e.tick
  );
  for (let i = 1; i < ticks.length; i++) {
    assert(
      ticks[i] - ticks[i - 1] >= STATS.globalGap || said[i] === "perfectSector",
    );
  }
});
