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
 */

import type { Clock } from "../director/ports.ts";

export class PausableClock implements Clock {
  private elapsed = 0;
  private last: number;
  private paused = false;

  constructor(private readonly source: () => number = () => performance.now()) {
    this.last = source();
  }

  now(): number {
    const t = this.source();
    if (!this.paused) this.elapsed += t - this.last;
    this.last = t;
    return this.elapsed;
  }

  setPaused(paused: boolean): void {
    this.now(); // bank the time that passed before the switch
    this.paused = paused;
  }
}
