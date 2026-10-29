/**
 * Where a sound is, heard from the ship. The listener rides the player's
 * ship (the ears are in the cockpit), so a round passing just left of you
 * whooshes past your left ear wherever you are on screen.
 *
 * Panning is equal-power (`StereoPannerNode`), not HRTF: this is a
 * top-down game with no front or back to resolve, HRTF costs a convolution
 * per voice, and a busy sector has dozens of voices. Distance is a gentle
 * gain roll-off plus a low-pass, so far sounds also get duller.
 *
 * Web Audio has no doppler (it was removed from `PannerNode`), so it is
 * computed here from radial velocity, with a slow, made-up speed of sound
 * so passes are audible at shmup speeds. Pure math, unit-tested.
 */

import type { Vec2 } from "../contracts/index.ts";

export const SPATIAL = {
  /** Sim units from the listener to a full left or right pan. */
  panSpan: 260,
  /** Never hard-pan: a fully one-sided sound reads as a broken speaker. */
  maxPan: 0.85,
  /** Distance (sim units) at which gain falls to half. */
  halfGainDistance: 320,
  /** Low-pass cutoff at the listener, and at `halfGainDistance`. */
  nearCutoffHz: 18000,
  farCutoffHz: 4500,
  /**
   * The speed of sound, in sim units per tick. Real air would make every
   * shift inaudible; this one makes a passing dart drop a couple of
   * semitones.
   */
  speedOfSound: 36,
  /** Doppler clamp, in playback-rate terms. */
  minRate: 0.8,
  maxRate: 1.25,
};

export interface Placement {
  /** -1 (left) to 1 (right); 0 when mono. */
  readonly pan: number;
  /** 0–1 distance attenuation. */
  readonly gain: number;
  readonly cutoffHz: number;
}

/** Pan, gain and dullness of a sound at `pos`, for a listener at `ear`. */
export function place(pos: Vec2, ear: Vec2, mono = false): Placement {
  const dx = pos.x - ear.x;
  const dy = pos.y - ear.y;
  const d = Math.hypot(dx, dy);
  const s = SPATIAL;
  const pan = mono
    ? 0
    : Math.max(-s.maxPan, Math.min(s.maxPan, (dx / s.panSpan) * s.maxPan));
  const gain = 1 / (1 + d / s.halfGainDistance);
  const near = 1 - Math.min(1, d / s.halfGainDistance);
  const cutoffHz = s.farCutoffHz + (s.nearCutoffHz - s.farCutoffHz) * near;
  return { pan, gain, cutoffHz };
}

/**
 * Doppler playback-rate multiplier for a source at `pos` moving at `vel`
 * (sim units per tick), heard by a listener moving at `earVel`. Approaching
 * sounds rise, receding ones fall.
 */
export function dopplerRate(
  pos: Vec2,
  vel: Vec2,
  ear: Vec2,
  earVel: Vec2 = { x: 0, y: 0 },
): number {
  const dx = pos.x - ear.x;
  const dy = pos.y - ear.y;
  const d = Math.hypot(dx, dy) || 1;
  // Radial speed: positive when the source moves away from the listener.
  const vr = ((vel.x - earVel.x) * dx + (vel.y - earVel.y) * dy) / d;
  const rate = SPATIAL.speedOfSound / (SPATIAL.speedOfSound + vr);
  return Math.max(SPATIAL.minRate, Math.min(SPATIAL.maxRate, rate));
}

/**
 * Closest approach of a straight-moving source to a fixed listener:
 * how near it will pass and in how many ticks. Near-miss whooshes are
 * scheduled to peak at that moment, so they swell *before* the pass.
 */
export function closestApproach(
  pos: Vec2,
  vel: Vec2,
  ear: Vec2,
): { readonly distance: number; readonly ticks: number } {
  const dx = pos.x - ear.x;
  const dy = pos.y - ear.y;
  const v2 = vel.x * vel.x + vel.y * vel.y;
  const t = v2 === 0 ? 0 : Math.max(0, -(dx * vel.x + dy * vel.y) / v2);
  return {
    distance: Math.hypot(dx + vel.x * t, dy + vel.y * t),
    ticks: t,
  };
}
