/**
 * STUB sim (Workstream 0). Just enough behavior to prove the contract: the
 * player moves and fires, drones fall from seeded positions, shots destroy
 * them. Workstream 1 replaces the internals with the full port of
 * `reference/e4-starter/` while keeping `createSim` and the `Sim` interface.
 *
 * Rule for everything under `src/sim/`: import only from `../contracts/` and
 * other sim files. No three.js, no DOM, no clocks, no `Math.random`.
 */

import {
  type EnemyView,
  type EntityId,
  type InputFrame,
  PLAYFIELD,
  type Sim,
  type SimEvent,
  type SimOptions,
  type SimState,
} from "../contracts/index.ts";
import { Rng } from "./rng.ts";

const PLAYER_SPEED = 4.2;
const FOCUS_SPEED = 2.0;
const FIRE_INTERVAL = 7;
const SHOT_SPEED = 11;
const DRONE_INTERVAL = 90;
const DRONE_FALL = 1.5;

interface Body {
  id: EntityId;
  x: number;
  y: number;
  age: number;
}

export function createSim(options: SimOptions): Sim {
  const rng = new Rng(options.seed);
  let nextId: EntityId = 1;
  let tick = 0;
  let score = 0;
  let kills = 0;
  let fireCooldown = 0;
  const player = { x: PLAYFIELD.width / 2, y: PLAYFIELD.height - 90 };
  let drones: Body[] = [];
  let shots: Body[] = [];
  const sector = options.start.kind === "sector" ? options.start.sector : 1;
  const phase = options.start.kind === "tutorial" ? "tutorial" : "sector";

  function step(input: InputFrame): readonly SimEvent[] {
    tick++;
    const events: SimEvent[] = [];

    const speed = input.focus ? FOCUS_SPEED : PLAYER_SPEED;
    player.x = clamp(player.x + input.move.x * speed, 0, PLAYFIELD.width);
    player.y = clamp(player.y + input.move.y * speed, 0, PLAYFIELD.height);

    fireCooldown = Math.max(0, fireCooldown - 1);
    if (input.fire && fireCooldown === 0) {
      shots.push({ id: nextId++, x: player.x, y: player.y - 20, age: 0 });
      fireCooldown = FIRE_INTERVAL;
      events.push({ type: "playerFired", tick, shots: 1 });
    }

    if (tick % DRONE_INTERVAL === 0) {
      const id = nextId++;
      drones.push({
        id,
        x: rng.range(30, PLAYFIELD.width - 30),
        y: -20,
        age: 0,
      });
      events.push({ type: "spawn", tick, id, kind: "drone" });
    }

    for (const shot of shots) {
      shot.y -= SHOT_SPEED;
      shot.age++;
    }
    for (const drone of drones) {
      drone.y += DRONE_FALL;
      drone.age++;
    }

    const destroyed = new Set<EntityId>();
    for (const shot of shots) {
      for (const drone of drones) {
        if (destroyed.has(drone.id)) continue;
        if (Math.hypot(shot.x - drone.x, shot.y - drone.y) < 13 + 6) {
          destroyed.add(drone.id);
          destroyed.add(shot.id);
          score += 100;
          kills++;
          events.push({
            type: "kill",
            tick,
            id: drone.id,
            kind: "drone",
            score: 100,
            byRam: false,
          });
          break;
        }
      }
    }

    shots = shots.filter((s) => !destroyed.has(s.id) && s.y > -30);
    drones = drones.filter((d) =>
      !destroyed.has(d.id) && d.y < PLAYFIELD.height + 30
    );
    return events;
  }

  function snapshot(): SimState {
    const enemies: EnemyView[] = drones.map((d) => ({
      id: d.id,
      kind: "drone",
      pos: { x: d.x, y: d.y },
      radius: 13,
      hp: 2,
      maxHp: 2,
      age: d.age,
    }));
    return {
      tick,
      seed: options.seed,
      phase,
      outcome: null,
      sector,
      player: {
        pos: { x: player.x, y: player.y },
        radius: 6,
        lives: 3,
        power: 1,
        shielded: false,
        graceTicks: 0,
        bank: 0,
      },
      enemies,
      bullets: shots.map((s) => ({
        id: s.id,
        kind: "shot",
        pos: { x: s.x, y: s.y },
        vel: { x: 0, y: -SHOT_SPEED },
        radius: 6,
      })),
      pickups: [],
      boss: null,
      score,
      kills,
      flags: { pacifistIntact: kills === 0, firstPowerupTaken: false },
    };
  }

  return { step, snapshot };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
