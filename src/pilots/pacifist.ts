/**
 * The pacifist autopilot: never fires, never rams, and outlasts the Warden.
 * It flies the same lookahead planner as the fighting autopilot (enemy
 * bodies count as threats, which also keeps it from ramming anything to
 * death) with a quieter goal: stay low and away from whatever is above. It
 * does pick up powerups, since collecting is not killing, and the salvage
 * cache in sector 3 is how a pacifist run reaches the flashback.
 *
 * Deterministic: same state history, same input.
 */

import type { InputFrame, Pilot, SimState } from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";
import { type Goal, Planner } from "./planner.ts";

const HOME = { x: 240, y: 580 };

export class PacifistAutopilot implements Pilot {
  readonly kind = "pacifistAutopilot" as const;
  private readonly planner = new Planner();

  next(state: SimState): InputFrame {
    const plan = this.planner.plan(state, chooseGoal(state));
    return { ...IDLE_INPUT, move: plan.move, focus: plan.focus, fire: false };
  }
}

function chooseGoal(state: SimState): Goal {
  const player = state.player.pos;
  const pickup = state.pickups.find((p) =>
    p.pos.y > 120 && p.pos.y < player.y + 20
  );
  if (pickup) {
    return {
      x: pickup.pos.x,
      y: pickup.pos.y + 20,
      weightX: 0.06,
      weightY: 0.03,
    };
  }
  // Under the Warden its fans are densest; drift to the side it is not on.
  const boss = state.boss;
  if (boss) {
    const away = boss.pos.x < 240 ? 330 : 150;
    return { x: away, y: HOME.y, weightX: 0.01, weightY: 0.02 };
  }
  return { x: HOME.x, y: HOME.y, weightX: 0.01, weightY: 0.02 };
}
