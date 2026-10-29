/**
 * The fighting autopilot (attract mode, the kill route). It holds fire,
 * lines up under the most urgent target, grabs pickups when they are close,
 * and lets the shared lookahead planner veto any move that flies into a
 * bullet. Improves on the starter's AutoPilot, which summed repulsion pushes
 * and so froze between bullets in the Warden's spiral.
 *
 * Deterministic: same state history, same input.
 */

import type { InputFrame, Pilot, SimState, Vec2 } from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";
import { type Goal, Planner } from "./planner.ts";

/** Where the ship idles: low, so bullets take longest to arrive. */
const HOME = { x: 240, y: 560 };

export class FightingAutopilot implements Pilot {
  readonly kind = "fightingAutopilot" as const;
  private readonly planner = new Planner();

  next(state: SimState): InputFrame {
    const plan = this.planner.plan(state, chooseGoal(state));
    return { ...IDLE_INPUT, move: plan.move, focus: plan.focus, fire: true };
  }
}

function chooseGoal(state: SimState): Goal {
  const player = state.player.pos;

  // A pickup in reach beats everything: power is survival.
  const pickup = nearestBy(
    state.pickups.map((p) => p.pos).filter((p) =>
      p.y > 120 && p.y < player.y + 20 && Math.abs(p.x - player.x) < 220
    ),
    player,
  );
  if (pickup) {
    return { x: pickup.x, y: pickup.y + 20, weightX: 0.08, weightY: 0.03 };
  }

  // The Warden: stay under it, low, where its fans are widest apart.
  const boss = state.boss;
  if (boss && boss.hp > 0) {
    return { x: boss.pos.x, y: HOME.y, weightX: 0.05, weightY: 0.02 };
  }

  // Otherwise, line up under the lowest enemy that is above us and on
  // screen: it is the closest to becoming a problem.
  let target: Vec2 | null = null;
  for (const enemy of state.enemies) {
    const { x, y } = enemy.pos;
    if (y < 10 || y > player.y - 60 || x < 10 || x > 470) continue;
    if (!target || y > target.y) target = enemy.pos;
  }
  if (target) return { x: target.x, y: HOME.y, weightX: 0.05, weightY: 0.02 };
  return { x: HOME.x, y: HOME.y, weightX: 0.01, weightY: 0.02 };
}

function nearestBy(points: readonly Vec2[], from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDistance = Infinity;
  for (const p of points) {
    const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y) * 0.3;
    if (d < bestDistance) {
      bestDistance = d;
      best = p;
    }
  }
  return best;
}
