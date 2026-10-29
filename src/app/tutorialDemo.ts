/**
 * Auto-play cannot pass the tutorial by fighting alone: its modules wait for
 * deliberate moves (left, right, vertical, focus) with nothing on screen to
 * fight. This wrapper plays those prompts the way an attentive player would,
 * a slow figure-eight with a focus tap every few seconds, and hands control
 * back to the wrapped autopilot whenever an enemy (the practice target) is
 * up, and for the whole run after the tutorial. Deterministic: it reads only
 * the tick, so auto-play runs still replay.
 */

import type { Pilot } from "../contracts/index.ts";

/** Seconds per figure-eight lap; slow enough that every axis passes ±0.5. */
const LAP_S = 3;
/** Focus is held for one second out of every `FOCUS_EVERY_S`. */
const FOCUS_EVERY_S = 4;

export function withTutorialDemo(pilot: Pilot): Pilot {
  return {
    kind: pilot.kind,
    next(state) {
      const frame = pilot.next(state);
      if (
        state.phase !== "tutorial" || state.enemies.length > 0 ||
        state.bullets.some((bullet) => bullet.kind !== "shot")
      ) return frame;
      const t = state.tick / 60;
      const angle = (2 * Math.PI * t) / LAP_S;
      return {
        ...frame,
        move: { x: Math.sin(angle), y: Math.sin(2 * angle) },
        focus: Math.floor(t) % FOCUS_EVERY_S === 0,
      };
    },
  };
}
