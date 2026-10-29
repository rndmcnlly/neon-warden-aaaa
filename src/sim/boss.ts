/**
 * The Warden. Three ways its fight can go:
 *
 * 1. Descent (phase 0): 150 ticks of invulnerable arrival, the speech.
 * 2. Kill route: phases 1–3 follow its HP (above 2/3, above 1/3, below).
 * 3. Survival route (open while `pacifistIntact`): phases also advance on a
 *    clock (`SURVIVAL_PHASE_TICKS`), whichever is further along, and the
 *    fight ends when the clock runs out. Then the Warden withdraws.
 */

import type { BossPhase, EntityId } from "../contracts/index.ts";
import type { Arena } from "./enemies.ts";
import { BOSS, SURVIVAL_PHASE_TICKS, SURVIVAL_TOTAL_TICKS } from "./tuning.ts";

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
  };
}

export function bossArrived(boss: Boss): boolean {
  return boss.age > BOSS.descentTicks;
}

/** Ticks of fighting since the descent ended (0 during the descent). */
export function fightTicks(boss: Boss): number {
  return Math.max(0, boss.age - BOSS.descentTicks);
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

export function bossPhase(boss: Boss, survivalOpen: boolean): BossPhase {
  if (!bossArrived(boss)) return 0;
  const byHp = hpPhase(boss);
  if (!survivalOpen) return byHp;
  return Math.max(byHp, clockPhase(boss)) as BossPhase;
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
  const phase = bossPhase(boss, survivalOpen);
  if (boss.state === "withdrawing") {
    boss.y -= BOSS.withdrawSpeed;
  } else if (boss.state === "defeated") {
    // Holds still for its death throes.
  } else if (phase === 0) {
    boss.y += BOSS.descentSpeed;
  } else {
    const sway = phase === 3 ? BOSS.swayRatePhase3 : BOSS.swayRate;
    boss.x = 240 + Math.sin(fightTicks(boss) * sway) * BOSS.swayAmplitude;
    attack(boss, arena, phase, fightTicks(boss));
  }
  boss.vx = boss.x - startX;
  boss.vy = boss.y - startY;
}

function aimAtPlayer(boss: Boss, arena: Arena): number {
  return Math.atan2(arena.player.y - boss.y, arena.player.x - boss.x);
}

function attack(boss: Boss, arena: Arena, phase: BossPhase, t: number): void {
  const speed = arena.bulletSpeed;
  if (phase === 1 && t % 55 === 0) fan(boss, arena, 9, 1.1, 2.8 * speed);
  if (phase === 2) {
    if (t % 80 === 0) fan(boss, arena, 9, 1.2, 3 * speed);
    if (t % 80 === 40) {
      for (const offset of [-0.12, 0, 0.12]) {
        const angle = aimAtPlayer(boss, arena) + offset;
        arena.fire(boss.x, boss.y + 30, angle, 4.2 * speed, true);
      }
    }
    // Escorts: two of its own scouts, which fall with it.
    if (t % 360 === 180) {
      arena.summon("drone", boss.x - 70, boss.y);
      arena.summon("drone", boss.x + 70, boss.y);
    }
  }
  if (phase === 3 && t % 6 === 0) {
    boss.spin += 0.23;
    for (let arm = 0; arm < 4; arm++) {
      const angle = boss.spin + (arm * Math.PI) / 2;
      arena.fire(boss.x, boss.y + 6, angle, 2.6 * speed);
    }
    if (t % 48 === 0) {
      const angle = aimAtPlayer(boss, arena);
      arena.fire(boss.x, boss.y + 30, angle, 4.6 * speed, true);
    }
  }
}

function fan(
  boss: Boss,
  arena: Arena,
  count: number,
  width: number,
  speed: number,
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.PI / 2 + (i / (count - 1) - 0.5) * width;
    arena.fire(boss.x, boss.y + 40, angle, speed);
  }
}
