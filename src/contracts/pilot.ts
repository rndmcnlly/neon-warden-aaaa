/**
 * Anything that can fly the ship. Carried over from the original's best idea:
 * a person and an autopilot are interchangeable behind one method.
 */

import type { InputFrame } from "./input.ts";
import type { SimState } from "./sim.ts";

export type PilotKind = "keyboard" | "fightingAutopilot" | "pacifistAutopilot";

export interface Pilot {
  readonly kind: PilotKind;
  /**
   * Chooses this tick's input from the latest state. Autopilots must be
   * deterministic (no `Math.random`, no clocks) so auto-play runs replay.
   * The keyboard pilot ignores `state` and reports the input layer instead.
   */
  next(state: SimState): InputFrame;
}
