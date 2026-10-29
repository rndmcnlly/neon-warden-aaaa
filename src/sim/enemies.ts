/**
 * The four enemy kinds: how each moves and fires. The starter kept these in
 * one `ShmupPrefabSprite` class with `switch (this.kind)` in two methods and
 * ten positional constructor arguments; here an enemy is plain data plus two
 * small functions, and the stats live in `tuning.ts`.
 */

import type { EnemyKind, EntityId, Vec2 } from "../contracts/index.ts";
import type { Rng } from "./rng.ts";
import { ENEMY_STATS } from "./tuning.ts";

/** What an enemy may ask of the world that hosts it (the starter's `Arena`). */
export interface Arena {
  readonly rng: Rng;
  readonly player: Vec2;
  readonly bulletSpeed: number;
  readonly droneFireChance: number;
  readonly dartsArmed: boolean;
  fire(
    x: number,
    y: number,
    angle: number,
    speed: number,
    heavy?: boolean,
  ): void;
  summon(kind: EnemyKind, x: number, y: number): void;
}

export interface Enemy {
  readonly id: EntityId;
  readonly kind: EnemyKind;
  x: number;
  y: number;
  /** Movement during the last tick, so pilots can predict paths. */
  vx: number;
  vy: number;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly score: number;
  readonly dropChance: number;
  age: number;
  /** Drones weave around this x. */
  readonly homeX: number;
  /** +1 or -1: weave direction (drone) or travel direction (lancer). */
  readonly side: 1 | -1;
  /** A dart's sideways slide once it commits. */
  heading: number;
  /** Tutorial targets that never shoot. */
  readonly passive: boolean;
  /** Set when the Warden withdraws: fly off the top, holding fire. */
  retreating: boolean;
  alive: boolean;
}

export function makeEnemy(
  id: EntityId,
  kind: EnemyKind,
  x: number,
  y: number,
  side: 1 | -1,
  passive = false,
): Enemy {
  const stats = ENEMY_STATS[kind];
  return {
    id,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    radius: stats.radius,
    score: stats.score,
    dropChance: stats.dropChance,
    age: 0,
    homeX: x,
    side,
    heading: 0,
    passive,
    retreating: false,
    alive: true,
  };
}

const DART_COMMIT_AGE = 50;
const TURRET_ARRIVE_AGE = 70;
const TURRET_FIRE_START = 80;
const TURRET_LEAVE_AGE = 420;
const RETREAT_SPEED = 5;

function aimAt(from: Enemy, target: Vec2): number {
  return Math.atan2(target.y - from.y, target.x - from.x);
}

/** One tick of an enemy: move, then maybe fire. */
export function stepEnemy(enemy: Enemy, arena: Arena): void {
  enemy.age++;
  const startX = enemy.x;
  const startY = enemy.y;
  if (enemy.retreating) enemy.y -= RETREAT_SPEED;
  else move(enemy, arena);
  enemy.vx = enemy.x - startX;
  enemy.vy = enemy.y - startY;
  if (!enemy.passive && !enemy.retreating) fire(enemy, arena);
}

function move(enemy: Enemy, arena: Arena): void {
  switch (enemy.kind) {
    case "drone":
      enemy.y += 1.5;
      enemy.x = enemy.homeX + Math.sin(enemy.age * 0.045) * 46 * enemy.side;
      break;
    case "dart":
      // Drift in slowly, then commit to a dive toward the player's side.
      if (enemy.age < DART_COMMIT_AGE) {
        enemy.y += 1.2;
      } else {
        if (enemy.age === DART_COMMIT_AGE) {
          enemy.heading = Math.sign(arena.player.x - enemy.x) * 1.4;
        }
        enemy.y += 5.2;
        enemy.x += enemy.heading;
      }
      break;
    case "turret":
      // Descend, hold and shoot, then sink away off the bottom.
      if (enemy.age < TURRET_ARRIVE_AGE) enemy.y += 1.6;
      else if (enemy.age > TURRET_LEAVE_AGE) enemy.y += 1.2;
      break;
    case "lancer":
      enemy.x += 2.4 * enemy.side;
      enemy.y += 0.35;
      break;
  }
}

function fire(enemy: Enemy, arena: Arena): void {
  const speed = arena.bulletSpeed;
  switch (enemy.kind) {
    case "drone":
      // The chance roll happens only on the firing tick, as in the starter,
      // so difficulty changes odds without shifting the random sequence.
      if (enemy.age % 100 !== 60) return;
      if (!arena.rng.chance(arena.droneFireChance)) return;
      arena.fire(enemy.x, enemy.y, aimAt(enemy, arena.player), 2.4 * speed);
      break;
    case "dart":
      // Restored cut content: the starter commented this shot out.
      if (arena.dartsArmed && enemy.age === DART_COMMIT_AGE) {
        arena.fire(enemy.x, enemy.y, aimAt(enemy, arena.player), 3 * speed);
      }
      break;
    case "turret": {
      // Bursts: one shot every 8 ticks for 40 of every 100 ticks.
      const t = enemy.age - TURRET_FIRE_START;
      if (t < 0 || enemy.age > TURRET_LEAVE_AGE) return;
      if (t % 100 > 40 || t % 8 !== 0) return;
      arena.fire(enemy.x, enemy.y, aimAt(enemy, arena.player), 3.4 * speed);
      break;
    }
    case "lancer":
      // Three-way spread straight down, only while on screen.
      if (enemy.age % 40 !== 20 || enemy.x < 20 || enemy.x > 460) return;
      for (const spread of [-0.25, 0, 0.25]) {
        arena.fire(enemy.x, enemy.y + 8, Math.PI / 2 + spread, 2.6 * speed);
      }
      break;
  }
}
