/**
 * The Director's clock in the shipped game: wall time that stops while the
 * game is paused, so a cutscene waits on the pause menu instead of playing
 * on behind it.
 *
 * Why not the audio clock (`AudioContext.currentTime`)? It does not advance
 * until the first user gesture unlocks audio, which would freeze every
 * scene in auto-play and in headless playtests. Voice lines still line up,
 * because the Director times lines from their rendered durations, and
 * pausing suspends the AudioContext at the same moment this clock stops.
 *
 * Auto-play (`?autoplay=...&speed=N`) may also run the clock fast, so scenes
 * keep pace with a fast-forwarded sim; lines then cut each other short.
 */

import type { Clock } from "../director/ports.ts";

export class PausableClock implements Clock {
  private elapsed = 0;
  private last: number;
  private paused = false;
  private rate = 1;

  constructor(private readonly source: () => number = () => performance.now()) {
    this.last = source();
  }

  now(): number {
    const t = this.source();
    if (!this.paused) this.elapsed += (t - this.last) * this.rate;
    this.last = t;
    return this.elapsed;
  }

  setPaused(paused: boolean): void {
    this.now(); // bank the time that passed before the switch
    this.paused = paused;
  }

  /** Scene time per wall millisecond (1 in normal play). */
  setRate(rate: number): void {
    this.now(); // bank the time that passed at the old rate
    this.rate = rate;
  }
}

/**
 * What a front-end pause stops during a run. A menu over play (pause,
 * continue, settings) stops the sim, this clock and the sound together. The
 * end credits crawl is also a screen over play, so it stops the sim and the
 * clock (the credits timeline waits on a flag, not on time), but not the
 * sound: the crawl has a score. Suspending the AudioContext there silenced
 * the credits music on every route until the crawl ended.
 */
export function pauseScope(o: {
  readonly inRun: boolean;
  readonly simRunning: boolean;
  readonly creditsRolling: boolean;
}): { readonly clock: boolean; readonly audio: boolean } {
  const paused = o.inRun && !o.simRunning;
  return { clock: paused, audio: paused && !o.creditsRolling };
}
