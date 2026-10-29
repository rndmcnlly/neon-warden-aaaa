/**
 * The distant route: scenery bends and sinks ahead of the ship, while the
 * combat patch stays a rigid plane (research/2026-10-29-route-ribbon).
 *
 * Scenery is authored in route coordinates: `s` along the route (world units,
 * from the sector start), lateral `x`, height `y`. `rel = s - progress` is how
 * far ahead of the ship a piece is. Inside |rel| <= RIGID nothing is warped;
 * a quintic ramp reaches the full distant bend at FULL. Pieces ahead converge
 * toward the route centerline and sink, so the route reads as a corridor
 * heading somewhere, and a narrow portrait screen sees what is coming above
 * the lane. Nothing collidable or aim-critical ever uses this mapping.
 */

/** Ribbon prototype's planar half-length, world units. */
export const RIGID = 8.5;
/** Where the distant bend reaches full strength. */
export const FULL = 24;
/** How far behind the ship a piece travels before it wraps to the far end. */
export const BEHIND = 16;

/** Quintic smootherstep from 0 at RIGID to 1 at FULL; C2 at both ends. */
export function routeWeight(rel: number): number {
  const t = Math.min(1, Math.max(0, (rel - RIGID) / (FULL - RIGID)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Wrap a route position into the visible window [-BEHIND, length - BEHIND). */
export function wrapRel(s: number, progress: number, length: number): number {
  const r = (((s - progress + BEHIND) % length) + length) % length;
  return r - BEHIND;
}

export interface RoutePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/**
 * Presentation pose of a scenery anchor. `bend` is the sector's signed
 * lateral swing of the distant route (world units at FULL).
 */
export function routePose(
  rel: number,
  x: number,
  y: number,
  bend: number,
  out: RoutePose = { x: 0, y: 0, z: 0, yaw: 0 },
): RoutePose {
  const w = routeWeight(rel);
  out.x = x * (1 - 0.72 * w) + bend * w;
  out.y = y - 3 * w;
  out.z = -rel;
  out.yaw = -0.18 * w * Math.sign(bend);
  return out;
}
