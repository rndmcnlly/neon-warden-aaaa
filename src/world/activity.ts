/**
 * Micro-animation that shows work happening, as pure functions of time.
 *
 * Every pose is a function of `t` (seconds of unfrozen world time), so it is
 * deterministic, testable and trivially frozen for reduced motion (sample one
 * representative instant, REST_T). Units are those of the Blender asset
 * (meters, radians) unless noted. Nothing here forecasts a spawn.
 */

export type Activity =
  | "beacon"
  | "queue"
  | "outbound"
  | "spin"
  | "repair"
  | "tumble"
  | "toll"
  | "tollPods"
  | "crane"
  | "nursery";

/** The instant reduced motion shows: arms mid-lift, crane mid-travel. */
export const REST_T = 7.1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smoothstep ease, 0 to 1. */
export const ease = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const frac = (v: number) => v - Math.floor(v);

/** Beacon lamp shutters turn like a lighthouse. Radians about the up axis. */
export function lampYaw(t: number): number {
  return t * 0.8;
}

/**
 * A queue: each copy advances along the route (world units) and wraps within
 * `span`. The sinusoidal term bunches traffic near the berth, like waiting.
 */
export function queueOffset(
  t: number,
  base: number,
  speed: number,
  span: number,
): number {
  const u = (((base + t * speed) % span) + span) % span;
  return u - 0.9 * Math.sin((2 * Math.PI * u) / span);
}

/** Repair boom swings a plate in and out over the gap. */
export function boomYaw(t: number): number {
  return Math.sin(t * 0.45) * 0.55;
}

/**
 * Welding spark bursts. Returns 0 (off) to 1 (bright) for spark `i`. Bursts
 * are irregular but deterministic. Reduced flashing gets a steady low glow.
 */
export function sparkLevel(t: number, i: number, reducedFlashing: boolean) {
  if (reducedFlashing) return 0.35;
  const cycle = frac((t + i * 0.73) / (1.7 + i * 0.3));
  if (cycle > 0.5) return 0;
  const n = Math.sin(t * 91 + i * 17) * 43758.5453;
  return 0.55 + 0.45 * frac(n);
}

export interface TollPose {
  /** Barrier arm lift, radians (0 down). */
  arm: number;
  /** Scanner head offset along the road, meters. */
  scan: number;
  /** Scan fan visible. */
  scanning: boolean;
}

/** One inspection every TOLL_PERIOD seconds. */
export const TOLL_PERIOD = 10;

/** Pod position along the road (meters, +ahead) for pod k of 3 at time t. */
export function podY(t: number, k: number): number {
  const p = ((t / TOLL_PERIOD + k) % 3 + 3) % 3;
  if (p < 1) return -44 + 26 * p;
  if (p < 2) {
    const q = p - 1;
    if (q < 0.25) return -18 + 18 * ease(q / 0.25);
    if (q < 0.7) return 0;
    return 22 * ease((q - 0.7) / 0.3);
  }
  return 22 + 28 * (p - 2);
}

/** Pods are only drawn on the road deck; beyond it they are off the set. */
export function podVisible(y: number): boolean {
  return Math.abs(y) <= 30;
}

export function tollPose(t: number): TollPose {
  const q = frac(t / TOLL_PERIOD);
  const up = q < 0.62
    ? 0
    : q < 0.7
    ? ease((q - 0.62) / 0.08)
    : q < 0.9
    ? 1
    : 1 - ease((q - 0.9) / 0.08);
  const scanning = q >= 0.28 && q < 0.66;
  const scan = scanning ? -7 + 14 * ease((q - 0.28) / 0.38) : -7;
  return { arm: up * 1.25, scan, scanning };
}

export interface CranePose {
  /** Trolley travel along the crane girders, meters. */
  trolley: number;
  /** Hoist drop below the trolley, meters. */
  drop: number;
}

export const CRANE_PERIOD = 16;

/** Pick at stack A, lift, travel, set down at stack B, lift, return. */
export function cranePose(t: number): CranePose {
  const q = frac(t / CRANE_PERIOD) * CRANE_PERIOD;
  const A = -18, B = 22, HIGH = 14, LOW = 20;
  if (q < 3) return { trolley: A, drop: HIGH + (LOW - HIGH) * ease(q / 3) };
  if (q < 4.5) {
    return { trolley: A, drop: LOW - (LOW - HIGH) * ease((q - 3) / 1.5) };
  }
  if (q < 9) {
    return { trolley: A + (B - A) * ease((q - 4.5) / 4.5), drop: HIGH };
  }
  if (q < 11) {
    return { trolley: B, drop: HIGH + (LOW - 1 - HIGH) * ease((q - 9) / 2) };
  }
  if (q < 12.5) {
    return {
      trolley: B,
      drop: LOW - 1 - (LOW - 1 - HIGH) * ease((q - 11) / 1.5),
    };
  }
  return { trolley: B + (A - B) * ease((q - 12.5) / 3.5), drop: HIGH };
}

/** Nursery tender rides the rows; pods breathe slowly (not a flash). */
export function nurseryPose(t: number): { tender: number; glow: number } {
  return {
    tender: Math.sin(t * 0.32) * 8,
    glow: 0.82 + 0.18 * Math.sin(t * 0.9),
  };
}
