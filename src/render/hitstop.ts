/**
 * Hitstop: a short freeze-frame on big hits, the oldest trick in action
 * games for making an impact land (the world holds its breath for a few
 * frames, then snaps back).
 *
 * The renderer cannot do this alone: freezing only the picture while the sim
 * runs on would desync what the player sees from what is happening. So this
 * module is pure policy, and the tick loop (`src/app/tickLoop.ts`) applies it
 * in the TICK domain:
 *
 *   for each tick the clock grants:
 *     if (hitstop.hold()) continue;   // no input read, no sim step
 *     const events = sim.step(pilot.next(state));
 *     hitstop.note(events);
 *
 * Why this keeps replays deterministic: a frozen tick neither reads input
 * nor steps the sim, so the sim sees exactly the same sequence of inputs it
 * would have seen without the freeze; only wall time stretches. Dropped
 * ticks are never caught up later (that would undo the freeze).
 *
 * The ladder (`feedbackLadder.ts`) says how long each event freezes. A crowd
 * rule caps the total, so a dense wave cannot turn into a slideshow; a lost
 * life ignores the cap, since nothing must bury it.
 */

import type { SimEvent } from "../contracts/index.ts";
import { hitstopTicksFor } from "./feedbackLadder.ts";

/** Ticks held on a big kill; about 50 ms at 60 Hz. */
export const HITSTOP_TICKS = 3;
/** Autoplay faster than real time skips hitstop: QA reels keep their pace. */
export const HITSTOP_MAX_SPEED = 2;
/** The crowd rule: at most this many frozen ticks... */
export const HITSTOP_BUDGET_TICKS = 10;
/** ...in any window of this many loop ticks (one second). */
export const HITSTOP_WINDOW_TICKS = 60;

/** How many ticks `event` should freeze the sim for (0 for most). */
export function hitstopFor(event: SimEvent): number {
  return hitstopTicksFor(event);
}

export class Hitstop {
  private remaining = 0;
  /** Loop ticks seen, frozen or not: the crowd window's clock. */
  private loopTick = 0;
  /** Loop ticks at which a frozen tick was spent, newest last. */
  private spent: number[] = [];

  /**
   * `speed`: autoplay ticks per frame (1 for human play). `enabled` is the
   * player's choice (and tests); both must allow it.
   */
  constructor(
    private readonly speed = 1,
    private readonly allowed = true,
  ) {}

  get enabled(): boolean {
    return this.allowed && this.speed < HITSTOP_MAX_SPEED;
  }

  /** Ticks still frozen. */
  get pending(): number {
    return this.remaining;
  }

  /** Feed one tick's events; overlapping hits do not stack. */
  note(events: readonly SimEvent[]): void {
    if (!this.enabled) return;
    for (const event of events) {
      const want = hitstopFor(event);
      if (want <= this.remaining) continue;
      // A lost life always gets its full freeze; everything else fits the
      // crowd budget that is left this second.
      const room = event.type === "lifeLost"
        ? want
        : Math.max(0, HITSTOP_BUDGET_TICKS - this.spent.length);
      this.remaining = Math.max(this.remaining, Math.min(want, room));
    }
  }

  /** Call once per loop tick: true if this tick is frozen (and uses it up). */
  hold(): boolean {
    this.loopTick++;
    const oldest = this.loopTick - HITSTOP_WINDOW_TICKS;
    while (this.spent.length > 0 && this.spent[0] <= oldest) this.spent.shift();
    if (this.remaining <= 0) return false;
    this.remaining--;
    this.spent.push(this.loopTick);
    return true;
  }

  /** A new run, a skip or a pause menu clears any pending hold. */
  reset(): void {
    this.remaining = 0;
    this.spent = [];
  }
}
