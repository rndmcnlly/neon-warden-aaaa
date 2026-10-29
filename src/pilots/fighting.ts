/**
 * The fighting autopilot (attract mode, the kill route). It flies the full
 * trigger verb the way the tutorial teaches it:
 *
 * - rest: hold fire, let the charge build and the scan beam lock, and line
 *   up a Writ on the target's weak point (a clean kill) or, on the Warden,
 *   on one of the two lower pods that guard its core;
 * - press: when aligned (or tired of waiting), spend the Writ;
 * - stream: keep holding to hose hulls, then rest again.
 *
 * Movement is the shared lookahead planner, which vetoes any maneuver that
 * flies into a bullet. Deterministic: same state history, same input.
 */

import type {
  EnemyView,
  InputFrame,
  Pilot,
  SimState,
  Vec2,
} from "../contracts/index.ts";
import { IDLE_INPUT } from "../contracts/index.ts";
import { type Goal, Planner } from "./planner.ts";
import { type Solution, Tracker, WRIT_SPEED } from "./aim.ts";

/** Where the ship idles: low, so bullets take longest to arrive. */
const HOME = { x: 240, y: 560 };
/** Stream this long after each Writ (scouts). */
const STREAM_TICKS = 90;
/** Give up waiting for a perfect Writ after this much rest. */
const REST_PATIENCE = 150;
/** Close enough to the firing solution to press. */
const ALIGN = 3;
/** The Warden's lower pods: break these first to open the core. */
const CORE_GUARDS = ["cannonPod", "spiralPod"];

type Mode = "rest" | "stream";

export class FightingAutopilot implements Pilot {
  readonly kind = "fightingAutopilot" as const;
  private readonly planner = new Planner();
  private readonly tracker = new Tracker();
  private mode: Mode = "rest";
  private modeTicks = 0;

  next(state: SimState): InputFrame {
    this.tracker.observe(state);
    this.modeTicks++;
    const aim = this.chooseAim(state);
    const fire = this.decideFire(state, aim);
    const goal = this.chooseGoal(state, aim);
    const plan = this.planner.plan(state, goal);
    return { ...IDLE_INPUT, move: plan.move, focus: plan.focus, fire };
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.modeTicks = 0;
  }

  /** Returns whether Fire is held this tick. */
  private decideFire(state: SimState, aim: Aim | null): boolean {
    const boss = state.boss;
    const podPhase = boss !== null && !boss.coreOpen && aim?.onPod === true;
    if (this.mode === "stream") {
      if (this.modeTicks < STREAM_TICKS && !podPhase) return true;
      this.setMode("rest");
      return false;
    }
    // Resting. On the Warden's pods, only full charge is worth a shot.
    const level = state.player.chargeLevel;
    const wanted = podPhase || (boss !== null && aim !== null) ? 3 : 2;
    const aligned = aim !== null &&
      Math.abs(state.player.pos.x - aim.solution.x) <= ALIGN;
    const ready = level >= wanted && aligned;
    const bored = this.modeTicks >= REST_PATIENCE && !podPhase;
    if (!ready && !bored) return false;
    // Press: the edge spends the Writ, and holding on becomes the stream.
    this.setMode("stream");
    // Against pods a tap is enough; release next tick and rest again.
    if (podPhase) this.modeTicks = STREAM_TICKS;
    return true;
  }

  private chooseAim(state: SimState): Aim | null {
    const boss = state.boss;
    if (boss && !boss.invulnerable && boss.hp > 0) {
      const guard = boss.pods.find((p) =>
        CORE_GUARDS.includes(p.id) && !p.broken
      );
      const offset: Vec2 = guard && !boss.coreOpen
        ? guard.offset
        : boss.weakPoint.offset;
      const solution = this.tracker.solveBoss(state, offset, WRIT_SPEED);
      return solution
        ? { solution, onPod: guard !== undefined && !boss.coreOpen }
        : null;
    }
    const target = urgentTarget(state);
    if (!target) return null;
    // Locked: aim for the weak point, a clean kill. Otherwise the hull.
    const offsetX = target.locked ? target.weakPoint.offset.x : 0;
    return {
      solution: this.tracker.solveEnemy(state, target, offsetX, WRIT_SPEED),
      onPod: false,
    };
  }

  private chooseGoal(state: SimState, aim: Aim | null): Goal {
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
    if (aim) {
      const x = Math.min(462, Math.max(18, aim.solution.x));
      const precise = this.mode === "rest";
      return {
        x,
        y: HOME.y,
        weightX: precise ? 0.12 : 0.05,
        weightY: 0.02,
      };
    }
    return { x: HOME.x, y: HOME.y, weightX: 0.01, weightY: 0.02 };
  }
}

interface Aim {
  readonly solution: Solution;
  /** Aiming at a Warden pod: tap Writs only, no stream. */
  readonly onPod: boolean;
}

/** The lowest scout above us and on screen: closest to becoming a problem. */
function urgentTarget(state: SimState): EnemyView | null {
  const player = state.player.pos;
  let target: EnemyView | null = null;
  for (const enemy of state.enemies) {
    const { x, y } = enemy.pos;
    if (enemy.disarmed) continue;
    if (y < 10 || y > player.y - 60 || x < 10 || x > 470) continue;
    if (!target || y > target.pos.y) target = enemy;
  }
  return target;
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
