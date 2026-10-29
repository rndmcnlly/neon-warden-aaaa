/** Lesson-local evidence, not lifetime achievements. Reads resolved actions,
 * so remaps, touch, gamepads and toggle controls share exactly one policy.
 * Browser/window focus is deliberately not an input here.
 */
import {
  IDLE_INPUT,
  type InputFrame,
  type SimEvent,
  type SimState,
} from "../contracts/index.ts";
import { FLAGS as F } from "./flags.ts";

export type TutorialCorrection = "tutorialOtherLeft" | "tutorialLockout";

const EVENT_GATES: Readonly<Record<string, readonly SimEvent["type"][]>> = {
  [F.tutFired]: ["playerFired"],
  [F.tutTargetDestroyed]: ["practiceTarget"],
  [F.tutTapped]: ["playerFired"],
  [F.tutStreamed]: ["playerFired"],
  [F.tutCharged]: ["chargeLevel"],
  [F.tutLocked]: ["scanLock"],
  [F.tutWritFired]: ["playerFired"],
  [F.tutPartBroken]: ["partBreak"],
  [F.tutGrazed]: ["graze"],
  [F.tutRateDoubled]: ["payChanged"],
};

export class TutorialGates {
  private previous: InputFrame = IDLE_INPUT;
  private gate: string | null = null;
  private armed = false;
  private restedTicks = 0;

  constructor(
    private readonly ports: {
      setFlag(flag: string): void;
      correction?(moment: TutorialCorrection): void;
    },
  ) {}

  reset(): void {
    this.previous = IDLE_INPUT;
    this.gate = null;
    this.armed = false;
    this.restedTicks = 0;
  }

  /** Settings changes are not fresh gameplay actions or mistakes. */
  rebase(input: InputFrame): void {
    this.previous = structuredClone(input);
    this.armed = false;
    this.restedTicks = 0;
  }

  input(gate: string | null, input: InputFrame, state: SimState): void {
    // Keep the pre-cue sample: a key held across activation must return to
    // neutral, but a genuinely fresh first-tick press must not be lost.
    const changed = gate !== this.gate;
    if (changed) {
      this.gate = gate;
      this.armed = false;
      this.restedTicks = 0;
    }
    const p = this.previous;
    const left = input.move.x <= -0.5 && p.move.x > -0.5;
    const right = input.move.x >= 0.5 && p.move.x < 0.5;
    const vertical = Math.abs(input.move.y) >= 0.5 && Math.abs(p.move.y) < 0.5;
    const focus = input.focus && !p.focus;
    const fire = input.fire && !p.fire;
    const rest = !input.fire && p.fire;
    this.previous = structuredClone(input);
    if (!gate) return;

    const set = () => this.ports.setFlag(gate);
    if (gate === F.tutMovedLeft && left) set();
    else if (gate === F.tutMovedRight && right) set();
    else if (gate === F.tutMovedVertical && vertical) set();
    else if (gate === F.tutFocused && focus) set();

    const interruptedRest = this.restedTicks > 0;
    if (gate === F.tutCharged) {
      // Even a gun already charged during the explanation needs a deliberate
      // new release, then a short rest. Auto-fire's pause button does this too.
      if (rest) this.armed = true;
      if (input.fire) {
        this.armed = false;
        this.restedTicks = 0;
      }
      if (
        this.armed && ++this.restedTicks >= 30 && state.player.chargeLevel === 3
      ) set();
    } else if (
      gate === F.tutLocked || gate === F.tutGrazed || gate === F.tutRateDoubled
    ) {
      if (
        left || right || vertical || focus || rest ||
        (gate === F.tutRateDoubled && fire)
      ) this.armed = true;
      if (
        this.armed && gate === F.tutLocked && !input.fire &&
        state.enemies.some((e) => e.locked)
      ) set();
      if (this.armed && gate === F.tutRateDoubled && state.pay.rate >= 2) set();
    } else if (fire) this.armed = true;

    // Only unmistakably reversed directions during an explicit horizontal
    // drill. Vertical movement, focus toggles and unrelated exploration are
    // never treated as mistakes. Actions, never physical key codes.
    if (
      (gate === F.tutMovedLeft && right && Math.abs(input.move.y) < 0.5) ||
      (gate === F.tutMovedRight && left && Math.abs(input.move.y) < 0.5)
    ) {
      this.ports.correction?.("tutorialOtherLeft");
    } else if (gate === F.tutCharged && fire && interruptedRest) {
      this.ports.correction?.("tutorialLockout");
    }
  }

  accepts(event: SimEvent): boolean {
    if (!this.gate || !EVENT_GATES[this.gate]?.includes(event.type)) {
      return false;
    }
    // Escapes remain reportable/retryable without granting completion.
    if (event.type === "practiceTarget" && event.result === "escaped") {
      return true;
    }
    if (!this.armed) return false;
    // Rest has its own dwell check above, so ambient full-charge events cannot
    // satisfy it. Tap count must come from fresh uncharged aimed shots.
    if (this.gate === F.tutCharged) return false;
    if (event.type === "playerFired") {
      if (this.gate === F.tutTapped) return event.shot === "aimed";
      if (this.gate === F.tutStreamed) return event.shot === "stream";
      if (this.gate === F.tutWritFired) return event.shot === "writ";
    }
    return true;
  }
}
