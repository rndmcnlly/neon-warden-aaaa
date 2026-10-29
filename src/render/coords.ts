/**
 * Mapping between the sim's flat playfield and the 3D world.
 *
 * The sim speaks in the original's pixels: 480 x 640, origin top-left, +y
 * down. The world is a right-handed three.js scene with +Y up, so the
 * playfield lies on the XZ plane (Y = 0): sim x goes to world X, and sim y
 * goes to world Z (+Z is toward the camera, the bottom of the screen). Keeping
 * this in one tiny pure module means every other file, and every test, agrees
 * on the same conversion.
 */

import { PLAYFIELD } from "../contracts/index.ts";

/** Sim pixels per world unit. 40 makes the playfield 12 x 16 world units. */
export const PX_PER_UNIT = 40;

/** Playfield size in world units. */
export const FIELD_W = PLAYFIELD.width / PX_PER_UNIT;
export const FIELD_D = PLAYFIELD.height / PX_PER_UNIT;

/** Sim x (pixels, origin left) to world X (units, origin center). */
export function simToWorldX(x: number): number {
  return (x - PLAYFIELD.width / 2) / PX_PER_UNIT;
}

/** Sim y (pixels, +y down) to world Z (units, +Z toward the camera). */
export function simToWorldZ(y: number): number {
  return (y - PLAYFIELD.height / 2) / PX_PER_UNIT;
}

/** Sim length (a radius, a sprite width) to world units. */
export function simToWorldLength(px: number): number {
  return px / PX_PER_UNIT;
}

/** Inverse of `simToWorldX`, for the harness and debugging. */
export function worldToSimX(x: number): number {
  return x * PX_PER_UNIT + PLAYFIELD.width / 2;
}

/** Inverse of `simToWorldZ`. */
export function worldToSimY(z: number): number {
  return z * PX_PER_UNIT + PLAYFIELD.height / 2;
}
