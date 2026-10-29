/**
 * The shared brain of both autopilots: a short lookahead search. Each tick
 * it tries a fixed menu of maneuvers (eight directions or hold, full speed or
 * focus, for a short burst or the whole horizon), predicts where every
 * threat will be over the next half second, and picks the maneuver with the
 * lowest cost: collisions weigh most, near misses a little, and distance from
 * the pilot's goal breaks ties.
 *
 * The starter's AutoPilot summed repulsion "pushes" from predicted threat
 * positions. That works for sparse waves but fails in the Warden's spiral,
 * where pushes cancel out and the ship freezes between two bullets. Scoring
 * whole candidate paths avoids that: a path either stays clear or it does
 * not.
 *
 * Deterministic: candidates are tried in a fixed order and ties keep the
 * earlier one. The planner reads only `SimState` (plus its own memory of the
 * previous tick), never the sim's internals.
 */

import type { EntityId, SimState, Vec2 } from "../contracts/index.ts";

/** Ship speeds and clamp, mirrored from the sim's tuning. */
const SHIP = {
  speed: 4.2,
  focusSpeed: 2.0,
  minX: 18,
  maxX: 462,
  minY: 60,
  maxY: 616,
};

/** Lookahead sample ticks: dense near now, sparse further out. */
const SAMPLES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30, 36];
const HORIZON = SAMPLES[SAMPLES.length - 1];
/** A "burst" maneuver moves this many ticks, then holds still. */
const BURST_TICKS = 8;

const DIRECTIONS: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

interface Maneuver {
  readonly dir: Vec2;
  readonly focus: boolean;
  /** Ticks of movement before holding still. */
  readonly duration: number;
}

const MANEUVERS: readonly Maneuver[] = DIRECTIONS.flatMap((dir) =>
  [false, true].flatMap((focus) =>
    [HORIZON, BURST_TICKS].map((duration) => ({ dir, focus, duration }))
  )
);

/** Where the pilot would like to be, and how much it cares. */
export interface Goal {
  readonly x: number;
  readonly y: number;
  /** Cost per unit of distance from the goal (horizontal). */
  readonly weightX: number;
  /** Cost per unit of distance from the goal (vertical). */
  readonly weightY: number;
}

export interface PlanResult {
  readonly move: Vec2;
  readonly focus: boolean;
  /** Danger of the chosen maneuver; 0 means a clean path. */
  readonly danger: number;
}

interface Threat {
  /** Predicted positions at each sample. */
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly radius: number;
}

const DRONE_WEAVE = { rate: 0.045, amplitude: 46, fall: 1.5 };
const DART = { commitAge: 50, drift: 1.2, dive: 5.2, slide: 1.4 };

/**
 * Remembers last tick's enemy positions so velocities can be estimated,
 * then plans. One instance per pilot.
 */
export class Planner {
  private previous = new Map<EntityId, Vec2>();
  private previousBoss: Vec2 | null = null;
  private lastChoice = 0;

  plan(state: SimState, goal: Goal): PlanResult {
    const player = state.player.pos;
    const threats = this.predictThreats(state);

    let best = 0;
    let bestCost = Infinity;
    let bestDanger = 0;
    for (let m = 0; m < MANEUVERS.length; m++) {
      const maneuver = MANEUVERS[m];
      const speed = maneuver.focus ? SHIP.focusSpeed : SHIP.speed;
      let danger = 0;
      let endX = player.x;
      let endY = player.y;
      for (let s = 0; s < SAMPLES.length; s++) {
        const k = SAMPLES[s];
        const moving = Math.min(k, maneuver.duration);
        const px = clamp(
          player.x + maneuver.dir.x * speed * moving,
          SHIP.minX,
          SHIP.maxX,
        );
        const py = clamp(
          player.y + maneuver.dir.y * speed * moving,
          SHIP.minY,
          SHIP.maxY,
        );
        if (k === 10) {
          endX = px;
          endY = py;
        }
        // Later predictions are less certain and less urgent.
        const discount = Math.pow(0.92, k);
        for (const threat of threats) {
          const dx = px - threat.xs[s];
          const dy = py - threat.ys[s];
          const reach = state.player.radius + threat.radius;
          const gap = Math.sqrt(dx * dx + dy * dy) - reach;
          if (gap < 2) danger += 100 * discount;
          else if (gap < 14) danger += (14 - gap) / 14 * 2 * discount;
        }
      }
      // Walls shrink the escape space, so prefer the middle.
      const wall = Math.max(0, 50 - (endX - SHIP.minX)) +
        Math.max(0, 50 - (SHIP.maxX - endX));
      const cost = danger +
        Math.abs(endX - goal.x) * goal.weightX +
        Math.abs(endY - goal.y) * goal.weightY +
        wall * 0.02 +
        (m === this.lastChoice ? 0 : 0.05);
      if (cost < bestCost) {
        bestCost = cost;
        best = m;
        bestDanger = danger;
      }
    }
    this.lastChoice = best;
    const choice = MANEUVERS[best];
    return { move: choice.dir, focus: choice.focus, danger: bestDanger };
  }

  /** Predicted paths of every enemy bullet, enemy body and the Warden. */
  private predictThreats(state: SimState): Threat[] {
    const player = state.player.pos;
    const threats: Threat[] = [];
    const reachable = (x: number, y: number, speed: number) =>
      Math.abs(x - player.x) + Math.abs(y - player.y) <
        (speed + SHIP.speed) * HORIZON * 1.42 + 60;

    for (const bullet of state.bullets) {
      if (bullet.kind === "shot") continue;
      const speed = Math.abs(bullet.vel.x) + Math.abs(bullet.vel.y);
      if (!reachable(bullet.pos.x, bullet.pos.y, speed)) continue;
      threats.push(linear(bullet.pos, bullet.vel, bullet.radius));
    }

    const seen = new Map<EntityId, Vec2>();
    for (const enemy of state.enemies) {
      seen.set(enemy.id, enemy.pos);
      if (!reachable(enemy.pos.x, enemy.pos.y, 6)) continue;
      const before = this.previous.get(enemy.id);
      const xs = new Float64Array(SAMPLES.length);
      const ys = new Float64Array(SAMPLES.length);
      for (let s = 0; s < SAMPLES.length; s++) {
        const k = SAMPLES[s];
        const p = predictEnemy(
          enemy.kind,
          enemy.pos,
          before,
          enemy.age,
          k,
          player,
        );
        xs[s] = p.x;
        ys[s] = p.y;
      }
      threats.push({ xs, ys, radius: enemy.radius });
    }
    this.previous = seen;

    const boss = state.boss;
    if (boss && !(boss.invulnerable && boss.hp <= 0)) {
      const before = this.previousBoss ?? boss.pos;
      const vel = { x: boss.pos.x - before.x, y: boss.pos.y - before.y };
      threats.push(linear(boss.pos, vel, boss.radius));
      this.previousBoss = boss.pos;
    } else {
      this.previousBoss = null;
    }
    return threats;
  }
}

function linear(pos: Vec2, vel: Vec2, radius: number): Threat {
  const xs = new Float64Array(SAMPLES.length);
  const ys = new Float64Array(SAMPLES.length);
  for (let s = 0; s < SAMPLES.length; s++) {
    xs[s] = pos.x + vel.x * SAMPLES[s];
    ys[s] = pos.y + vel.y * SAMPLES[s];
  }
  return { xs, ys, radius };
}

/**
 * Where an enemy will be `k` ticks from now. The autopilot has studied the
 * enemy patterns: drones weave on a known sine, darts drift then dive at a
 * known age. Everything else is extrapolated from last tick's motion.
 */
function predictEnemy(
  kind: string,
  pos: Vec2,
  before: Vec2 | undefined,
  age: number,
  k: number,
  player: Vec2,
): Vec2 {
  if (kind === "drone" && before) {
    // x = home + 46 * side * sin(0.045 * age): recover home and side from
    // the last step, then replay the weave.
    const now = Math.sin(age * DRONE_WEAVE.rate);
    const then = Math.sin((age - 1) * DRONE_WEAVE.rate);
    const swing = now - then;
    if (Math.abs(swing) > 1e-3) {
      const side = Math.sign((pos.x - before.x) / swing) || 1;
      const home = pos.x - DRONE_WEAVE.amplitude * side * now;
      return {
        x: home +
          DRONE_WEAVE.amplitude * side * Math.sin((age + k) * DRONE_WEAVE.rate),
        y: pos.y + DRONE_WEAVE.fall * k,
      };
    }
  }
  if (kind === "dart" && age < DART.commitAge) {
    // The dive starts on the tick its age reaches the commit age.
    const drift = Math.min(k, Math.max(0, DART.commitAge - 1 - age));
    const dive = k - drift;
    const slide = Math.sign(player.x - pos.x) * DART.slide;
    return {
      x: pos.x + slide * dive,
      y: pos.y + DART.drift * drift + DART.dive * dive,
    };
  }
  const vx = before ? pos.x - before.x : 0;
  const vy = before ? pos.y - before.y : 1.5;
  return { x: pos.x + vx * k, y: pos.y + vy * k };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
