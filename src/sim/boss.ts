/**
 * The Warden. Three ways its fight can go:
 *
 * 1. Descent (phase 0): 150 ticks of invulnerable arrival, the speech.
 * 2. Kill route: phases 1–3 follow its HP (above 2/3, above 1/3, below).
 * 3. Survival route (open while `pacifistIntact`): phases also advance on a
 *    clock (`SURVIVAL_PHASE_TICKS`), whichever is further along, and the
 *    fight ends when the clock runs out. Then the Warden withdraws.
 *
 * Phases only ever advance. The phase actually fought is the high-water
 * mark of the two measures, so a survival run that turns violent mid-fight
 * (the clock said 2, the HP says 1) stays in phase 2 instead of dropping
 * back and announcing phase 2 a second time.
 *
 * Four weapon pods each own a part of the pattern: the two halves of the
 * fan, the heavy cannon, the phase 3 spiral. A broken pod deletes its part.
 * Two broken pods open the core. The summon bay has no pod.
 */

import type { BossPhase, EntityId, WardenAiState } from "../contracts/index.ts";
import { type Arena, makeParts, type Part } from "./enemies.ts";
import {
  BOSS,
  SURVIVAL_PHASE_TICKS,
  SURVIVAL_TOTAL_TICKS,
  WARDEN_CORE,
  WARDEN_PODS,
} from "./tuning.ts";

export interface Boss {
  readonly id: EntityId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  age: number;
  /** Rotating angle of the phase 3 spiral. */
  spin: number;
  /** Set once the fight is decided; the Warden stops attacking. */
  state: "fighting" | "defeated" | "withdrawing";
  /** The phase being fought: the high-water mark, never lower. */
  phase: BossPhase;
  ai: WardenAiState;
  readonly pods: Part[];
  lockDwell: number;
  locked: boolean;
}

export function makeBoss(id: EntityId): Boss {
  return {
    id,
    x: 240,
    y: BOSS.spawnY,
    vx: 0,
    vy: 0,
    hp: BOSS.hp,
    age: 0,
    spin: 0,
    state: "fighting",
    phase: 0,
    ai: "descend",
    pods: makeParts(WARDEN_PODS, 1),
    lockDwell: 0,
    locked: false,
  };
}

export function bossArrived(boss: Boss): boolean {
  return boss.age > BOSS.descentTicks;
}

/** Ticks of fighting since the descent ended (0 during the descent). */
export function fightTicks(boss: Boss): number {
  return Math.max(0, boss.age - BOSS.descentTicks);
}

export function coreOpen(boss: Boss): boolean {
  return boss.pods.filter((p) => p.broken).length >= WARDEN_CORE.podsToOpen;
}

function podIntact(boss: Boss, id: string): boolean {
  return boss.pods.some((p) => p.spec.id === id && !p.broken);
}

function hpPhase(boss: Boss): 1 | 2 | 3 {
  const fraction = boss.hp / BOSS.hp;
  return fraction > 2 / 3 ? 1 : fraction > 1 / 3 ? 2 : 3;
}

function clockPhase(boss: Boss): 1 | 2 | 3 {
  const t = fightTicks(boss);
  if (t <= SURVIVAL_PHASE_TICKS[0]) return 1;
  if (t <= SURVIVAL_PHASE_TICKS[0] + SURVIVAL_PHASE_TICKS[1]) return 2;
  return 3;
}

/** Raises the phase to whatever HP (and, on the survival route, the clock) says. */
export function updatePhase(boss: Boss, survivalOpen: boolean): BossPhase {
  if (!bossArrived(boss)) return boss.phase;
  const measured = survivalOpen
    ? Math.max(hpPhase(boss), clockPhase(boss))
    : hpPhase(boss);
  boss.phase = Math.max(boss.phase, measured) as BossPhase;
  return boss.phase;
}

/** True on the tick the survival clock runs out. */
export function survivalComplete(boss: Boss): boolean {
  return fightTicks(boss) >= SURVIVAL_TOTAL_TICKS;
}

/** One tick of the Warden: move, then attack according to its phase. */
export function stepBoss(
  boss: Boss,
  arena: Arena,
  survivalOpen: boolean,
): void {
  boss.age++;
  const startX = boss.x;
  const startY = boss.y;
  const phase = updatePhase(boss, survivalOpen);
  if (boss.state === "withdrawing") {
    boss.y -= BOSS.withdrawSpeed;
    boss.ai = "withdraw";
  } else if (boss.state === "defeated") {
    // Holds still for its death throes.
    boss.ai = "fallen";
  } else if (phase === 0) {
    boss.y += BOSS.descentSpeed;
    boss.ai = "descend";
  } else {
    const sway = phase === 3 ? BOSS.swayRatePhase3 : BOSS.swayRate;
    boss.x = 240 + Math.sin(fightTicks(boss) * sway) * BOSS.swayAmplitude;
    boss.ai = attack(boss, arena, phase, fightTicks(boss));
  }
  boss.vx = boss.x - startX;
  boss.vy = boss.y - startY;
}

/** Holds the Warden still while it talks (`boss.parley`). */
export function holdForParley(boss: Boss): void {
  if (boss.state === "fighting") boss.ai = "parley";
  boss.vx = 0;
  boss.vy = 0;
}

function aimAtPlayer(boss: Boss, arena: Arena): number {
  return Math.atan2(arena.player.y - boss.y, arena.player.x - boss.x);
}

/** Ticks a volley's state lingers after it fires, so intel can catch it. */
const VOLLEY_LINGER = 8;

/**
 * Fires this tick's pattern and returns the state it is in. Each attack is
 * a state while it fires and briefly after; otherwise the Warden `sweep`s.
 */
function attack(
  boss: Boss,
  arena: Arena,
  phase: BossPhase,
  t: number,
): WardenAiState {
  const speed = arena.bulletSpeed;
  const fanUp = podIntact(boss, "fanPodL") || podIntact(boss, "fanPodR");
  const cannonUp = podIntact(boss, "cannonPod");
  const spiralUp = podIntact(boss, "spiralPod");
  let state: WardenAiState = "sweep";
  if (phase === 1 && fanUp) {
    if (t % 55 === 0) fan(boss, arena, 9, 1.1, 2.8 * speed);
    if (t % 55 < VOLLEY_LINGER) state = "fan";
  }
  if (phase === 2) {
    if (fanUp) {
      if (t % 80 === 0) fan(boss, arena, 9, 1.2, 3 * speed);
      if (t % 80 < VOLLEY_LINGER) state = "fan";
    }
    if (cannonUp) {
      if (t % 80 === 40) {
        for (const offset of [-0.12, 0, 0.12]) {
          const angle = aimAtPlayer(boss, arena) + offset;
          arena.fire(
            boss.id,
            "wardenCannon",
            boss.x,
            boss.y + 30,
            angle,
            4.2 * speed,
            true,
          );
        }
      }
      if (t % 80 >= 40 && t % 80 < 40 + VOLLEY_LINGER) state = "cannon";
    }
    // Escorts: two of its own scouts, which fall with it.
    if (t % 360 === 180) {
      arena.summon("drone", boss.x - 70, boss.y);
      arena.summon("drone", boss.x + 70, boss.y);
    }
    if (t % 360 >= 180 && t % 360 < 200) state = "summon";
  }
  if (phase === 3) {
    if (spiralUp) {
      if (t % 6 === 0) {
        boss.spin += 0.23;
        for (let arm = 0; arm < 4; arm++) {
          const angle = boss.spin + (arm * Math.PI) / 2;
          arena.fire(
            boss.id,
            "wardenSpiral",
            boss.x,
            boss.y + 6,
            angle,
            2.6 * speed,
          );
        }
      }
      state = "spiral";
    }
    if (cannonUp) {
      if (t % 48 === 0) {
        const angle = aimAtPlayer(boss, arena);
        arena.fire(
          boss.id,
          "wardenCannon",
          boss.x,
          boss.y + 30,
          angle,
          4.6 * speed,
          true,
        );
      }
      if (t % 48 < VOLLEY_LINGER) state = "cannon";
    }
  }
  return state;
}

/** The fan: the left pod fires the left half, the right pod the right. */
function fan(
  boss: Boss,
  arena: Arena,
  count: number,
  width: number,
  speed: number,
): void {
  const left = podIntact(boss, "fanPodL");
  const right = podIntact(boss, "fanPodR");
  const middle = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    // Angles grow clockwise from +x, so low indices point right (+x).
    const owned = i < middle ? right : i > middle ? left : left || right;
    if (!owned) continue;
    const angle = Math.PI / 2 + (i / (count - 1) - 0.5) * width;
    arena.fire(boss.id, "wardenFan", boss.x, boss.y + 40, angle, speed);
  }
}
