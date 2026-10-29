/**
 * Turns raw button state into the held actions gameplay sees, applying the
 * accessibility options: auto-fire, and hold versus toggle for fire and
 * focus. Pure and clock-free so it is testable without a browser.
 */

export interface HeldOptions {
  readonly autoFire: boolean;
  readonly holdToggle: "hold" | "toggle";
}

export interface HeldState {
  readonly fireLatched: boolean;
  readonly focusLatched: boolean;
}

export const INITIAL_HELD: HeldState = {
  fireLatched: false,
  focusLatched: false,
};

export interface RawHeld {
  readonly fireDown: boolean;
  readonly focusDown: boolean;
  /** Presses since the last read; toggle mode flips once per press. */
  readonly firePresses: number;
  readonly focusPresses: number;
}

export function resolveHeld(
  state: HeldState,
  raw: RawHeld,
  options: HeldOptions,
): { state: HeldState; fire: boolean; focus: boolean } {
  if (options.holdToggle === "hold") {
    return {
      state: INITIAL_HELD,
      // With auto-fire on, holding fire pauses firing (for dodging precisely).
      fire: options.autoFire ? !raw.fireDown : raw.fireDown,
      focus: raw.focusDown,
    };
  }
  const fireLatched = raw.firePresses % 2 === 1
    ? !state.fireLatched
    : state.fireLatched;
  const focusLatched = raw.focusPresses % 2 === 1
    ? !state.focusLatched
    : state.focusLatched;
  return {
    state: { fireLatched, focusLatched },
    fire: options.autoFire ? !fireLatched : fireLatched,
    focus: focusLatched,
  };
}

/**
 * Scales a stick reading so the dead zone maps to 0 and the rim to 1, keeping
 * direction. Radial rather than per-axis, so diagonals are not sticky.
 */
export function applyDeadZone(x: number, y: number, deadZone: number) {
  const length = Math.hypot(x, y);
  if (length <= deadZone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (length - deadZone) / (1 - deadZone));
  return { x: (x / length) * scaled, y: (y / length) * scaled };
}
