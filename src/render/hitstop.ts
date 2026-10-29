/**
 * Hitstop: a short freeze-frame on big hits, the oldest trick in action
 * games for making an impact land (the world holds its breath for a few
 * frames, then snaps back).
 *
 * The renderer cannot do this alone: freezing only the picture while the sim
 * runs on would desync what the player sees from what is happening. So this
 * module is pure policy, and the main loop applies it by skipping sim steps:
 *
 *   for each tick:
 *     if (hitstop.hold()) continue;   // the frozen tick is dropped, not owed
 *     const events = sim.step(input);
 *     hitstop.note(events);
 *
 * Dropped ticks are not caught up later, so the run is 3 ticks "longer" in
 * wall time per hit, which is the point. Under fast autoplay (QA reels) it
 * stays off, or a 4x run would stutter for nothing.
 */

import type { SimEvent } from "../contracts/index.ts";

/** Ticks held per big hit; about 50 ms at 60 Hz. */
export const HITSTOP_TICKS = 3;
/** Autoplay at this speed or faster skips hitstop entirely. */
export const HITSTOP_MAX_SPEED = 4;

/** How many ticks `event` should freeze the sim for (0 for most). */
export function hitstopFor(event: SimEvent): number {
  switch (event.type) {
    case "kill":
      return event.kind === "turret" || event.kind === "lancer"
        ? HITSTOP_TICKS
        : 0;
    case "partBreak":
      return event.target === "boss" ? HITSTOP_TICKS : 0;
    default:
      return 0;
  }
}

export class Hitstop {
  private remaining = 0;

  /** `speed`: autoplay ticks per frame (1 for human play). */
  constructor(private readonly speed = 1) {}

  get enabled(): boolean {
    return this.speed < HITSTOP_MAX_SPEED;
  }

  /** Feed one tick's events; overlapping hits do not stack. */
  note(events: readonly SimEvent[]): void {
    if (!this.enabled) return;
    for (const event of events) {
      this.remaining = Math.max(this.remaining, hitstopFor(event));
    }
  }

  /** True if this tick is frozen (and uses it up). */
  hold(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining--;
    return true;
  }

  /** A new run, a skip or a pause menu clears any pending hold. */
  reset(): void {
    this.remaining = 0;
  }
}
