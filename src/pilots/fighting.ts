/**
 * STUB fighting autopilot (Workstream 0): chases the lowest-on-screen enemy's
 * x position and holds fire. Workstream 1 replaces it with the original's
 * threat-predicting AutoPilot. Deterministic: same state, same input.
 */

import type { InputFrame, Pilot, SimState } from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";

export class FightingAutopilot implements Pilot {
  readonly kind = "fightingAutopilot" as const;

  next(state: SimState): InputFrame {
    const { player, enemies } = state;
    let targetX = player.pos.x;
    let lowest = -Infinity;
    for (const enemy of enemies) {
      if (enemy.pos.y > lowest && enemy.pos.y < player.pos.y) {
        lowest = enemy.pos.y;
        targetX = enemy.pos.x;
      }
    }
    const dx = targetX - player.pos.x;
    return {
      ...IDLE_INPUT,
      move: { x: Math.abs(dx) < 4 ? 0 : Math.sign(dx), y: 0 },
      fire: true,
    };
  }
}
