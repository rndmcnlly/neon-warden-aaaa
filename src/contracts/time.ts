/**
 * Simulation time. The sim advances in fixed ticks, never in wall-clock
 * milliseconds, so a run with the same seed and inputs replays exactly, and
 * auto-play can run many ticks per rendered frame.
 */

/** Ticks per simulated second. Matches the original's 60 Hz step. */
export const TICK_RATE = 60;

/** Length of one tick in milliseconds (about 16.67). */
export const TICK_MS = 1000 / TICK_RATE;

/**
 * A count of ticks since the sim started. A plain number alias rather than a
 * brand: arithmetic on ticks is common and a brand would add casts everywhere.
 */
export type Tick = number;

/** Converts seconds of game time to whole ticks, for readable tuning tables. */
export function secondsToTicks(seconds: number): Tick {
  return Math.round(seconds * TICK_RATE);
}
