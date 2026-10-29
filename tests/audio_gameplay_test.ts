import { assert, assertEquals } from "@std/assert";
import type { SimEvent, SimState } from "../src/contracts/index.ts";
import {
  GameplayAudio,
  PACIFIST_MELODY,
  type SoundCue,
} from "../src/audio/gameplayAudio.ts";
import { GAMEPLAY_SOUNDS } from "../src/audio/gameplaySounds.ts";

/** Just the state fields gameplay audio reads. */
function state(over: {
  enemies?: { id: number; x: number; y: number; lock?: number }[];
  pacifist?: boolean;
  scanning?: boolean;
} = {}): SimState {
  return {
    player: {
      pos: { x: 240, y: 560 },
      vel: { x: 0, y: 0 },
      scan: { active: over.scanning ?? false },
    },
    enemies: (over.enemies ?? []).map((e) => ({
      id: e.id,
      kind: "dart",
      pos: { x: e.x, y: e.y },
      lock: e.lock ?? 0,
      locked: false,
    })),
    boss: null,
    flags: { pacifistIntact: over.pacifist ?? false },
  } as unknown as SimState;
}

function rig() {
  const cues: SoundCue[] = [];
  const loops: string[] = [];
  const audio = new GameplayAudio({
    play: (c) => cues.push(c),
    loop: (role, on) => loops.push(`${role} ${on}`),
  });
  return { audio, cues, loops, roles: () => cues.map((c) => c.role) };
}

const ev = (e: Record<string, unknown>) => ({ tick: 0, ...e }) as SimEvent;

Deno.test("every role referenced by the mapping exists in the table", () => {
  const { audio, roles } = rig();
  const s = state({ enemies: [{ id: 1, x: 100, y: 100 }] });
  audio.frame(s);
  const events = [
    { type: "playerFired", shot: "stream", level: 0 },
    { type: "playerFired", shot: "writ", level: 3 },
    { type: "enemyFired", id: 1, weapon: "dartGun", pos: { x: 1, y: 1 } },
    { type: "enemyFired", id: 1, weapon: "wardenCannon", pos: { x: 1, y: 1 } },
    { type: "nearMiss", pos: { x: 1, y: 1 }, relVel: { x: 0, y: 5 } },
    { type: "graze", pos: { x: 1, y: 1 }, count: 1 },
    { type: "kill", id: 1, kind: "lancer", byRam: false },
    { type: "partBreak", id: 1, target: "enemy", pos: { x: 1, y: 1 } },
    { type: "disarm", id: 1, kind: "dart", pos: { x: 1, y: 1 } },
    { type: "scanLock", id: 1, pos: { x: 1, y: 1 } },
    { type: "payChanged", delta: 10, rate: 4, reason: "kill" },
    { type: "lifeLost", livesLeft: 1 },
  ];
  for (const e of events) audio.onEvent(ev(e), s);
  for (const r of roles()) assert(r in GAMEPLAY_SOUNDS, r);
  assertEquals(roles(), [
    "shot_stream",
    "writ_release_3",
    "writ_chord",
    "enemy_fire",
    "enemy_fire_heavy",
    "near_miss",
    "graze",
    "kill_large",
    "kill_note",
    "part_break",
    "part_stab",
    "disarm_unlatch",
    "power_down",
    "lock_confirm",
    "pay_tick",
    "life_lost",
    "life_alarm",
  ]);
});

Deno.test("a killed enemy is heard where it last was", () => {
  const { audio, cues } = rig();
  audio.frame(state({ enemies: [{ id: 7, x: 30, y: 200 }] }));
  audio.onEvent(ev({ type: "kill", id: 7, kind: "drone" }), state());
  assertEquals(cues[0].pos, { x: 30, y: 200 });
});

Deno.test("grazes climb in a streak, and sing a melody when pacifist", () => {
  const fight = rig();
  for (let t = 0; t < 3; t++) {
    fight.audio.onEvent(ev({ type: "graze", tick: t * 10 }), state());
  }
  assertEquals(fight.cues.map((c) => c.pitch), [0, 1, 2]);
  const calm = rig();
  for (let t = 0; t < 4; t++) {
    calm.audio.onEvent(
      ev({ type: "graze", tick: t }),
      state({ pacifist: true }),
    );
  }
  assertEquals(calm.cues.map((c) => c.pitch), PACIFIST_MELODY.slice(0, 4));
});

Deno.test("scan loop follows the beam; lock ticks rise; fly-bys once", () => {
  const { audio, loops, cues } = rig();
  audio.frame(state({ scanning: true, enemies: [{ id: 1, x: 240, y: 300 }] }));
  audio.frame(
    state({ scanning: true, enemies: [{ id: 1, x: 240, y: 302, lock: 0.3 }] }),
  );
  audio.frame(
    state({ scanning: false, enemies: [{ id: 1, x: 240, y: 304, lock: 0.6 }] }),
  );
  assertEquals(loops, ["scan_sweep true", "scan_sweep false"]);
  assertEquals(
    cues.filter((c) => c.role === "lock_tick").map((c) => c.pitch),
    [2, 4],
  );
  // A fast dart diving at the ship: one fly-by, not one per tick.
  for (let y = 420; y < 560; y += 30) {
    audio.frame(state({ enemies: [{ id: 2, x: 250, y }] }));
  }
  assertEquals(cues.filter((c) => c.role === "flyby").length, 1);
});
