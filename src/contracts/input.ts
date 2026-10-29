/**
 * One tick's worth of player intent. Every input source (keyboard, gamepad,
 * mouse, both autopilots, a replay) reduces to this shape, so the sim and the
 * menus never know who is flying.
 */

/** A 2D vector in playfield units; see `PLAYFIELD` in `./sim.ts`. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface InputFrame {
  /**
   * Desired movement, each axis in [-1, 1], with +y pointing down the
   * playfield (toward the player's end), as in the original. Menus read it as
   * focus navigation.
   */
  readonly move: Vec2;
  /** Fire is held this tick (after auto-fire and hold/toggle are applied). */
  readonly fire: boolean;
  /** Focus (slow, precise movement) is held this tick. */
  readonly focus: boolean;
  /** Pause was pressed this tick (an edge, not a held state). */
  readonly pause: boolean;
  /** Menu confirm was pressed this tick (an edge). */
  readonly confirm: boolean;
  /** Menu back or cancel was pressed this tick (an edge). */
  readonly back: boolean;
}

/** No movement, nothing pressed. Handy for frozen scenes and tests. */
export const IDLE_INPUT: InputFrame = Object.freeze({
  move: Object.freeze({ x: 0, y: 0 }),
  fire: false,
  focus: false,
  pause: false,
  confirm: false,
  back: false,
});
