/**
 * Gunnery for the autopilots: where to stand so a round fired now meets a
 * moving target, and whether anything else is in the way.
 *
 * Rounds fly straight up, so aiming is one number: the x to fire from. It
 * is the target's predicted x when the round arrives, plus the offset of
 * the component (weak point, part, pod) the pilot wants to hit.
 *
 * Like the planner, this reads only `SimState` plus its own memory of the
 * last two ticks, never sim internals. Deterministic.
 */

import type {
  EnemyView,
  EntityId,
  SimState,
  Vec2,
} from "../contracts/index.ts";
import { predictEnemy } from "./planner.ts";

/** Muzzle offset and Writ speed, mirrored from the sim's tuning. */
const MUZZLE = 18;
export const WRIT_SPEED = 12;
export const AIMED_SPEED = 14;

/** A firing solution: stand at `x`; `ticks` until impact. */
export interface Solution {
  readonly x: number;
  readonly ticks: number;
}

/** Remembers positions for the last two ticks, per entity. */
export class Tracker {
  private last = new Map<EntityId, Vec2>();
  private beforeLast = new Map<EntityId, Vec2>();

  /** Call once per tick, before solving. */
  observe(state: SimState): void {
    const now = new Map<EntityId, Vec2>();
    for (const e of state.enemies) now.set(e.id, e.pos);
    if (state.boss) now.set(state.boss.id, state.boss.pos);
    this.beforeLast = this.last;
    this.last = now;
  }

  /** Last tick's position (the observe call replaced it with this tick's). */
  previous(id: EntityId): Vec2 | undefined {
    return this.beforeLast.get(id);
  }

  /**
   * Where a round fired now at a scout's component meets it. Uses the
   * planner's knowledge of the scout patterns.
   */
  solveEnemy(
    state: SimState,
    enemy: EnemyView,
    offsetX: number,
    speed: number,
  ): Solution {
    const player = state.player.pos;
    const before = this.previous(enemy.id);
    let k = travel(player.y, enemy.pos.y + enemy.radius, speed, 0);
    let at = enemy.pos;
    // Two refinements: the target moves while the round flies.
    for (let i = 0; i < 2; i++) {
      at = predictEnemy(enemy.kind, enemy.pos, before, enemy.age, k, player);
      k = travel(player.y, at.y + enemy.radius, speed, 0);
    }
    return { x: at.x + offsetX, ticks: k };
  }

  /** The Warden sways on a smooth sine: a quadratic lead is exact enough. */
  solveBoss(state: SimState, offset: Vec2, speed: number): Solution | null {
    const boss = state.boss;
    if (!boss) return null;
    const p1 = this.previous(boss.id);
    const vx = p1 ? boss.pos.x - p1.x : 0;
    const k = travel(state.player.pos.y, boss.pos.y + offset.y, speed, 0);
    // Acceleration from the sway: x'' = -w^2 (x - 240) for a sine about 240.
    const w = vx === 0 ? 0 : swayRate(boss.phase);
    const ax = -w * w * (boss.pos.x - 240);
    return { x: boss.pos.x + vx * k + 0.5 * ax * k * k + offset.x, ticks: k };
  }
}

function swayRate(phase: number): number {
  return phase === 3 ? 0.012 : 0.008;
}

function travel(fromY: number, toY: number, speed: number, vy: number): number {
  return Math.max(1, Math.round((fromY - MUZZLE - toY) / (speed + vy)));
}

/**
 * True when a round fired from `x` could touch any scout other than
 * `except` on its way up (a Writ pierces, so a stray hit can kill).
 */
export function pathBlocked(
  state: SimState,
  x: number,
  roundRadius: number,
  except: EntityId | null,
  margin = 8,
): boolean {
  const player = state.player.pos;
  for (const e of state.enemies) {
    if (e.id === except || e.pos.y > player.y) continue;
    const reach = e.radius + roundRadius + margin;
    // Generous: scouts move sideways while the round climbs.
    if (Math.abs(e.pos.x - x) < reach + 30) return true;
  }
  return false;
}
