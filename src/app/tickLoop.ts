/**
 * The inner tick loop, pulled out of `main.ts` so a test can drive it.
 *
 * The frame loop decides how many ticks wall-clock time has granted; this
 * function spends them. A tick frozen by hitstop is spent doing nothing:
 * the pilot is not asked for input and the sim does not step. Because the
 * sim never sees a frozen tick, a run with hitstop and a run without it
 * receive the same inputs in the same order and end identically.
 */

import type {
  InputFrame,
  Pilot,
  Sim,
  SimEvent,
  SimState,
} from "../contracts/index.ts";
import type { Hitstop } from "../render/hitstop.ts";

export interface TickContext {
  readonly before: SimState;
  readonly input: InputFrame;
  readonly events: readonly SimEvent[];
  readonly after: SimState;
}

export interface TickLoopResult {
  /** Ticks the sim actually stepped. */
  readonly stepped: number;
  /** Ticks swallowed by hitstop. */
  readonly frozen: number;
}

/**
 * Spends `ticks` loop ticks. `beforeStep` sees each input before the sim
 * does (the tutorial reads it there); `onTick` runs after every real step.
 */
export function runTicks(
  ticks: number,
  sim: Sim,
  pilot: Pilot,
  hitstop: Hitstop,
  onTick: (tick: TickContext) => void,
  beforeStep?: (before: SimState, input: InputFrame) => void,
): TickLoopResult {
  let stepped = 0;
  let frozen = 0;
  for (let i = 0; i < ticks; i++) {
    if (hitstop.hold()) {
      frozen++;
      continue;
    }
    const before = sim.snapshot();
    const input = pilot.next(before);
    beforeStep?.(before, input);
    const events = sim.step(input);
    hitstop.note(events);
    stepped++;
    onTick({ before, input, events, after: sim.snapshot() });
  }
  return { stepped, frozen };
}
