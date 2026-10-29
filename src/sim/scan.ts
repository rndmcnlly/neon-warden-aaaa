/**
 * The scanning beam. While the trigger rests, a cone sweeps ahead of the
 * ship (straight up the playfield). Each tick the beam paints exactly one
 * unlocked target: the one closest to the cone's axis (ties: the nearer,
 * then the lower id). A painted target gains one tick of dwell; everything
 * else loses dwell. At the sensor's `lockTicks` it locks for good, and the
 * lock reveals its AI state, parts and weak point.
 *
 * Pure geometry over a list of candidates; the sim owns what a lock means.
 */

import type { EntityId, SensorStats, Vec2 } from "../contracts/index.ts";

export interface Scannable {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
  lockDwell: number;
  locked: boolean;
}

/** Angle off the beam's axis (radians), or null if outside the cone. */
export function coneAngle(
  from: Vec2,
  target: Vec2,
  sensor: SensorStats,
): number | null {
  const ahead = from.y - target.y;
  if (ahead <= 0) return null;
  const dx = target.x - from.x;
  if (dx * dx + ahead * ahead > sensor.range * sensor.range) return null;
  const angle = Math.atan2(Math.abs(dx), ahead);
  return angle <= sensor.coneHalfAngle ? angle : null;
}

/** Picks this tick's painted target among unlocked candidates. */
export function pickTarget(
  from: Vec2,
  candidates: readonly Scannable[],
  sensor: SensorStats,
): Scannable | null {
  let best: Scannable | null = null;
  let bestAngle = Infinity;
  let bestDistance = Infinity;
  for (const c of candidates) {
    if (c.locked) continue;
    const angle = coneAngle(from, c, sensor);
    if (angle === null) continue;
    const distance = from.y - c.y;
    const better = angle < bestAngle - 1e-9 ||
      (Math.abs(angle - bestAngle) <= 1e-9 &&
        (distance < bestDistance ||
          (distance === bestDistance && best !== null && c.id < best.id)));
    if (better) {
      best = c;
      bestAngle = angle;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * One tick of the beam. `active` is false while firing. Returns the target
 * that locked this tick, if any, and the painted target's id.
 */
export function stepScan(
  from: Vec2,
  candidates: readonly Scannable[],
  sensor: SensorStats,
  active: boolean,
  decay: number,
): { painted: EntityId | null; locked: Scannable | null } {
  const target = active ? pickTarget(from, candidates, sensor) : null;
  let locked: Scannable | null = null;
  for (const c of candidates) {
    if (c.locked) continue;
    if (c === target) {
      c.lockDwell++;
      if (c.lockDwell >= sensor.lockTicks) {
        c.locked = true;
        locked = c;
      }
    } else {
      c.lockDwell = Math.max(0, c.lockDwell - decay);
    }
  }
  return { painted: target?.id ?? null, locked };
}
