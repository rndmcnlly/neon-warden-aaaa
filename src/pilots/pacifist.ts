/**
 * STUB pacifist autopilot (Workstream 0): never fires, sidesteps away from the
 * nearest enemy above it. Workstream 1 replaces it with a real no-fire dodger
 * that can survive the Warden at high speed.
 */

import type { InputFrame, Pilot, SimState } from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";

export class PacifistAutopilot implements Pilot {
  readonly kind = "pacifistAutopilot" as const;

  next(state: SimState): InputFrame {
    const { player, enemies } = state;
    let nearestDx = 0;
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      const distance = Math.hypot(
        enemy.pos.x - player.pos.x,
        enemy.pos.y - player.pos.y,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDx = enemy.pos.x - player.pos.x;
      }
    }
    const away = nearestDistance < 120 ? -Math.sign(nearestDx || 1) : 0;
    return { ...IDLE_INPUT, move: { x: away, y: 0 } };
  }
}
