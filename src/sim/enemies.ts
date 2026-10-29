/**
 * The four enemy kinds as explicit, named state machines. The starter kept
 * these in one `ShmupPrefabSprite` class with `switch (this.kind)` in two
 * methods; here an enemy is plain data, and each tick runs two steps:
 *
 * 1. `nextState` picks the AI state (a pure function of age, flags and the
 *    current state), so the state the scan beam reports is the state that
 *    actually drives the enemy, never a guess layered on top;
 * 2. `act` moves and maybe fires according to that state.
 *
 * Firing schedules (and so the random draws) match the starter: a drone
 * still rolls its fire chance only on its firing tick.
 */

import type {
  EnemyAiState,
  EnemyKind,
  EnemyWeaponKind,
  EntityId,
  Vec2,
} from "../contracts/index.ts";
import type { Rng } from "./rng.ts";
import {
  ANATOMY,
  ENEMY_STATS,
  EVADE_SPEED,
  EVADE_TICKS,
  type PartSpec,
} from "./tuning.ts";

/** What an enemy may ask of the world that hosts it (the starter's `Arena`). */
export interface Arena {
  readonly rng: Rng;
  readonly player: Vec2;
  readonly bulletSpeed: number;
  readonly droneFireChance: number;
  readonly dartsArmed: boolean;
  /** Fires one bullet owned by `owner`; the sim groups a tick's bullets into volleys. */
  fire(
    owner: EntityId,
    weapon: EnemyWeaponKind,
    x: number,
    y: number,
    angle: number,
    speed: number,
    heavy?: boolean,
  ): void;
  summon(kind: EnemyKind, x: number, y: number): void;
}

/** A breakable weapon part; offsets are already mirrored for the owner. */
export interface Part {
  readonly spec: PartSpec;
  readonly offset: Vec2;
  hp: number;
  broken: boolean;
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
  /** Drones weave around this x (an evading drone shifts it). */
  homeX: number;
  /** +1 or -1: weave direction (drone) or travel direction (lancer). */
  readonly side: 1 | -1;
  /** A dart's sideways slide once it commits. */
  heading: number;
  /** Tutorial targets that never shoot. */
  readonly passive: boolean;
  /** Set when disarmed or when the Warden withdraws: leave, holding fire. */
  retreating: boolean;
  alive: boolean;
  ai: EnemyAiState;
  aiTicks: number;
  /** Which way an evading drone slides. */
  evadeDir: number;
  readonly parts: Part[];
  readonly weakPoint: { readonly offset: Vec2; readonly radius: number };
  /** Scan dwell in ticks, and whether it has locked. */
  lockDwell: number;
  locked: boolean;
  disarmed: boolean;
}

export function makeParts(specs: readonly PartSpec[], mirror: 1 | -1): Part[] {
  return specs.map((spec) => ({
    spec,
    offset: { x: spec.offset.x * mirror, y: spec.offset.y },
    hp: spec.hp,
    broken: false,
  }));
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
  const anatomy = ANATOMY[kind];
  const wp = anatomy.weakPoint;
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
    ai: passive ? "idle" : FIRST_STATE[kind],
    aiTicks: 0,
    evadeDir: 0,
    parts: makeParts(anatomy.parts, side),
    weakPoint: {
      offset: { x: wp.offset.x * side, y: wp.offset.y },
      radius: wp.radius,
    },
    lockDwell: 0,
    locked: false,
    disarmed: false,
  };
}

const FIRST_STATE: Readonly<Record<EnemyKind, EnemyAiState>> = {
  drone: "patrol",
  dart: "drift",
  turret: "descend",
  lancer: "strafe",
};

const DRONE_AIM_FROM = 40;
const DRONE_FIRE_AT = 60;
const DRONE_FIRE_HOLD = 10;
const DART_AIM_AGE = 35;
const DART_COMMIT_AGE = 50;
const TURRET_ARRIVE_AGE = 70;
const TURRET_FIRE_START = 80;
const TURRET_LEAVE_AGE = 420;
const TURRET_BURST = 40;
const LANCER_AIM_FROM = 10;
const LANCER_FIRE_AT = 20;
const RETREAT_SPEED = 5;

function aimAt(from: Enemy, target: Vec2): number {
  return Math.atan2(target.y - from.y, target.x - from.x);
}

/** Starts an evasive slide away from the ship (drones only; after a hit). */
export function startEvade(enemy: Enemy, from: Vec2): void {
  if (enemy.kind !== "drone" || enemy.retreating || enemy.passive) return;
  enemy.evadeDir = Math.sign(enemy.x - from.x) || enemy.side;
  setState(enemy, "evade");
}

function setState(enemy: Enemy, next: EnemyAiState): void {
  if (next === enemy.ai) return;
  enemy.ai = next;
  enemy.aiTicks = 0;
}

/** The transition function: which state this tick runs in. */
export function nextState(enemy: Enemy): EnemyAiState {
  if (enemy.retreating) return "retreat";
  const age = enemy.age;
  switch (enemy.kind) {
    case "drone": {
      if (enemy.ai === "evade" && enemy.aiTicks < EVADE_TICKS) return "evade";
      if (enemy.passive) return "idle";
      const cycle = age % 100;
      if (cycle >= DRONE_FIRE_AT && cycle < DRONE_FIRE_AT + DRONE_FIRE_HOLD) {
        return "fire";
      }
      return cycle >= DRONE_AIM_FROM && cycle < DRONE_FIRE_AT
        ? "aim"
        : "patrol";
    }
    case "dart":
      if (age >= DART_COMMIT_AGE) return "dive";
      if (enemy.passive) return "idle";
      return age >= DART_AIM_AGE ? "aim" : "drift";
    case "turret": {
      if (age < TURRET_ARRIVE_AGE) return "descend";
      if (enemy.passive) return "idle";
      if (age > TURRET_LEAVE_AGE) return "withdraw";
      const t = age - TURRET_FIRE_START;
      if (t < 0) return "aim";
      const cycle = t % 100;
      if (cycle <= TURRET_BURST) return "fire";
      return cycle >= 90 ? "aim" : "reload";
    }
    case "lancer": {
      if (enemy.passive) return "idle";
      const cycle = age % 40;
      if (cycle >= LANCER_FIRE_AT && cycle < LANCER_FIRE_AT + 6) return "fire";
      return cycle >= LANCER_AIM_FROM && cycle < LANCER_FIRE_AT
        ? "aim"
        : "strafe";
    }
  }
}

/** One tick of an enemy: choose a state, then act on it. */
export function stepEnemy(enemy: Enemy, arena: Arena): void {
  enemy.age++;
  enemy.aiTicks++;
  setState(enemy, nextState(enemy));
  const startX = enemy.x;
  const startY = enemy.y;
  if (enemy.ai === "retreat") enemy.y -= RETREAT_SPEED;
  else move(enemy, arena);
  enemy.vx = enemy.x - startX;
  enemy.vy = enemy.y - startY;
  if (enemy.ai === "fire" || enemy.ai === "dive") fire(enemy, arena);
}

function move(enemy: Enemy, arena: Arena): void {
  switch (enemy.kind) {
    case "drone":
      if (enemy.ai === "evade") enemy.homeX += enemy.evadeDir * EVADE_SPEED;
      enemy.y += 1.5;
      enemy.x = enemy.homeX + Math.sin(enemy.age * 0.045) * 46 * enemy.side;
      break;
    case "dart":
      // Drift in slowly, then commit to a dive toward the player's side.
      if (enemy.ai !== "dive") {
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
      if (enemy.ai === "descend") enemy.y += 1.6;
      else if (enemy.ai === "withdraw") enemy.y += 1.2;
      break;
    case "lancer":
      enemy.x += 2.4 * enemy.side;
      enemy.y += 0.35;
      break;
  }
}

function fire(enemy: Enemy, arena: Arena): void {
  if (enemy.passive || enemy.disarmed) return;
  const speed = arena.bulletSpeed;
  switch (enemy.kind) {
    case "drone":
      // The chance roll happens only on the firing tick, as in the starter,
      // so difficulty changes odds without shifting the random sequence.
      if (enemy.aiTicks !== 0) return;
      if (!arena.rng.chance(arena.droneFireChance)) return;
      arena.fire(
        enemy.id,
        "droneGun",
        enemy.x,
        enemy.y,
        aimAt(enemy, arena.player),
        2.4 * speed,
      );
      break;
    case "dart":
      // Restored cut content: the starter commented this shot out.
      if (arena.dartsArmed && enemy.age === DART_COMMIT_AGE) {
        arena.fire(
          enemy.id,
          "dartGun",
          enemy.x,
          enemy.y,
          aimAt(enemy, arena.player),
          3 * speed,
        );
      }
      break;
    case "turret":
      // Bursts: one shot every 8 ticks while in `fire`.
      if ((enemy.age - TURRET_FIRE_START) % 8 !== 0) return;
      arena.fire(
        enemy.id,
        "turretBarrel",
        enemy.x,
        enemy.y,
        aimAt(enemy, arena.player),
        3.4 * speed,
      );
      break;
    case "lancer": {
      // Three-way spread straight down, only while on screen. A lancer with
      // one emitter broken fires only that emitter's side of the spread.
      if (enemy.aiTicks !== 0 || enemy.x < 20 || enemy.x > 460) return;
      // A negative spread angles right (+x), so the right emitter owns it.
      const intact = (sign: number) =>
        enemy.parts.some((p) => !p.broken && Math.sign(p.offset.x) === sign);
      const spreads = [-0.25, 0, 0.25].filter((spread) =>
        spread === 0 || intact(spread < 0 ? 1 : -1)
      );
      for (const spread of spreads) {
        arena.fire(
          enemy.id,
          "lancerEmitter",
          enemy.x,
          enemy.y + 8,
          Math.PI / 2 + spread,
          2.6 * speed,
        );
      }
      break;
    }
  }
}
