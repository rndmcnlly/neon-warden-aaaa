/**
 * The two no-kill autopilots. Both fly the same lookahead planner as the
 * fighting autopilot (enemy bodies count as threats, which also keeps them
 * from ramming anything to death), stay low and away from whatever is
 * above, rest the trigger (so the scan beam sweeps and grazes come
 * naturally), and pick up powerups, since collecting is not killing. The
 * sector 3 flight recorder is how a pacifist run reaches the flashback.
 *
 * - `PacifistAutopilot` (the disarmer) also spends Writs, but only where a
 *   miss cannot kill: on a full-health turret's barrel (a level 1 Writ that
 *   strays does 6 damage to a 12 HP hull) and on the Warden's two side fan
 *   pods, which sit outside its hull. It never touches the core.
 * - `GhostAutopilot` never presses Fire at all, so `neverFired` survives:
 *   #0121's run, the one the Warden reacts to.
 *
 * Deterministic: same state history, same input.
 */

import type {
  EnemyView,
  InputFrame,
  Pilot,
  SimState,
} from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";
import { type Goal, Planner } from "./planner.ts";
import { pathBlocked, type Solution, Tracker, WRIT_SPEED } from "./aim.ts";

const HOME = { x: 240, y: 580 };
/** Level 1 Writ radius, mirrored from the standard weapon package. */
const WRIT_RADIUS = 8;
const ALIGN = 2;
/** The Warden's side pods: reachable without touching its core. */
const SIDE_PODS = ["fanPodL", "fanPodR"];
/** The Warden's hull radius plus the Writ's, plus a safety margin. */
const CORE_CLEARANCE = 46 + WRIT_RADIUS + 6;

export class GhostAutopilot implements Pilot {
  readonly kind: "ghostAutopilot" | "pacifistAutopilot" = "ghostAutopilot";
  protected readonly planner = new Planner();

  next(state: SimState): InputFrame {
    const plan = this.planner.plan(state, driftGoal(state));
    return { ...IDLE_INPUT, move: plan.move, focus: plan.focus, fire: false };
  }
}

export class PacifistAutopilot extends GhostAutopilot {
  override readonly kind = "pacifistAutopilot" as const;
  private readonly tracker = new Tracker();

  override next(state: SimState): InputFrame {
    this.tracker.observe(state);
    const aim = this.chooseAim(state);
    const goal = aim && !pickupInReach(state)
      ? { x: clampX(aim.x), y: HOME.y, weightX: 0.1, weightY: 0.02 }
      : driftGoal(state);
    const plan = this.planner.plan(state, goal);
    const fire = aim !== null && state.player.chargeLevel >= 1 &&
      Math.abs(state.player.pos.x - aim.x) <= ALIGN &&
      state.player.trigger === "rest";
    return { ...IDLE_INPUT, move: plan.move, focus: plan.focus, fire };
  }

  /** A safe disarm, if one is on offer. */
  private chooseAim(state: SimState): Solution | null {
    const boss = state.boss;
    if (boss) {
      if (boss.invulnerable || boss.hp <= 0 || boss.ai === "withdraw") {
        return null;
      }
      for (const id of SIDE_PODS) {
        const pod = boss.pods.find((p) => p.id === id && !p.broken);
        if (!pod) continue;
        const solution = this.tracker.solveBoss(state, pod.offset, WRIT_SPEED);
        if (!solution) continue;
        // Never a shot whose line could clip the core.
        const center = solution.x - pod.offset.x;
        if (Math.abs(solution.x - center) < CORE_CLEARANCE) continue;
        if (pathBlocked(state, solution.x, WRIT_RADIUS, null)) continue;
        return solution;
      }
      return null;
    }
    const turret = safeTurret(state);
    if (!turret) return null;
    const barrel = turret.parts[0];
    const solution = this.tracker.solveEnemy(
      state,
      turret,
      barrel.offset.x,
      WRIT_SPEED,
    );
    if (pathBlocked(state, solution.x, WRIT_RADIUS, turret.id)) return null;
    return solution;
  }
}

/** A planted, full-health, still-armed turret: the only scout safe to disarm. */
function safeTurret(state: SimState): EnemyView | null {
  const player = state.player.pos;
  for (const e of state.enemies) {
    if (e.kind !== "turret" || e.disarmed || e.hp < e.maxHp) continue;
    if (e.ai !== "aim" && e.ai !== "fire" && e.ai !== "reload") continue;
    if (e.pos.y < 20 || e.pos.y > player.y - 120) continue;
    if (e.parts.every((p) => p.broken)) continue;
    return e;
  }
  return null;
}

function pickupInReach(state: SimState): boolean {
  const player = state.player.pos;
  return state.pickups.some((p) => p.pos.y > 120 && p.pos.y < player.y + 20);
}

function clampX(x: number): number {
  return Math.min(462, Math.max(18, x));
}

function driftGoal(state: SimState): Goal {
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
