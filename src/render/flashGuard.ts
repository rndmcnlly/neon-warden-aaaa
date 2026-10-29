/**
 * Photosensitivity guard for full-screen flashes.
 *
 * WCAG 2.2 success criterion 2.3.1 ("Three Flashes or Below Threshold") says
 * content should not flash more than three times in any one-second period,
 * and Ofcom/ITU-R BT.1702 broadcast guidance adds a luminance-contrast limit.
 * Every bright full-screen pulse (hit flash, boss death, phase change) goes
 * through this guard, so the rule lives in one testable place instead of in
 * each effect. Particles and bloom are local, not full-field, so they are not
 * limited here; reduced flashing also dims bloom in `stage.ts`.
 *
 * Pure logic, no three.js: tests drive it with fake timestamps.
 */

export interface FlashLimits {
  /** Minimum milliseconds between flash onsets. */
  readonly minIntervalMs: number;
  /** Largest allowed flash strength, 0–1 (fraction of white added). */
  readonly maxStrength: number;
  /** Fade time constant; slower fades lower the contrast of each transition. */
  readonly decayMs: number;
}

/** Default: at most three flashes a second, per WCAG 2.3.1. */
export const STANDARD_LIMITS: FlashLimits = Object.freeze({
  minIntervalMs: 334,
  maxStrength: 0.55,
  decayMs: 140,
});

/**
 * Reduced flashing: at most one onset a second, low contrast, and a slow fade
 * so there is never a sharp light-dark-light transition.
 */
export const REDUCED_LIMITS: FlashLimits = Object.freeze({
  minIntervalMs: 1000,
  maxStrength: 0.12,
  decayMs: 450,
});

export class FlashGuard {
  private lastOnset = -Infinity;
  private strength = 0;
  private color: [number, number, number] = [1, 1, 1];

  constructor(public limits: FlashLimits = STANDARD_LIMITS) {}

  /**
   * Asks for a flash. Returns whether it was granted. Requests inside the
   * minimum interval are dropped outright: brightening a fading flash would
   * itself be a new light-dark transition.
   */
  request(
    nowMs: number,
    strength: number,
    color: [number, number, number] = [1, 1, 1],
  ): boolean {
    const capped = Math.min(strength, this.limits.maxStrength);
    if (nowMs - this.lastOnset < this.limits.minIntervalMs) return false;
    this.lastOnset = nowMs;
    this.strength = Math.max(this.strength, capped);
    this.color = color;
    return true;
  }

  /** Advances the fade; returns the strength to draw this frame. */
  update(dtMs: number): number {
    this.strength *= Math.exp(-dtMs / this.limits.decayMs);
    if (this.strength < 0.002) this.strength = 0;
    return this.strength;
  }

  get current(): number {
    return this.strength;
  }

  get tint(): readonly [number, number, number] {
    return this.color;
  }
}
