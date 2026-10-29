/** One authoritative fixed-tick movement law, shared by sim and autopilot search.
 * Units are original pixels/tick. Steering changes direction, never authority.
 */
import type {
  MovementProfile,
  MovementState,
  Vec2,
} from "../contracts/index.ts";
import { PLAYER } from "./tuning.ts";

export function initialMovement(
  profile: MovementProfile = "classic",
): MovementState {
  return {
    version: 1,
    profile,
    focused: false,
    envelope: 0,
    neutralTicks: 7,
    coastX: 0,
    coastY: 0,
    brake: 0,
  };
}

/** Clamp magnitude, not axes: fixes keyboard diagonal boost without flattening sticks. */
export function normalizeMove(move: Vec2): Vec2 {
  const x = Number.isFinite(move.x) ? move.x : 0;
  const y = Number.isFinite(move.y) ? move.y : 0;
  const divisor = Math.max(1, Math.hypot(x, y));
  return { x: x / divisor, y: y / divisor };
}

export function stepMovement(
  pos: Vec2,
  before: MovementState,
  move: Vec2,
  focused: boolean,
) {
  const intent = normalizeMove(move);
  const magnitude = Math.hypot(intent.x, intent.y);
  const hybrid = before.profile === "hybrid";
  let envelope = before.envelope;
  let neutralTicks = magnitude > 0 ? 0 : before.neutralTicks + 1;
  let brake = before.brake;
  let vx = 0;
  let vy = 0;
  if (focused) {
    envelope = 0;
    vx = intent.x * PLAYER.focusSpeed;
    vy = intent.y * PLAYER.focusSpeed;
    brake = 0;
    neutralTicks = 7;
  } else if (magnitude > 0) {
    // First sample is half speed; fifteen subsequent intervals reach cruise.
    envelope = !hybrid
      ? PLAYER.speed
      : before.focused || before.neutralTicks > 6 || envelope === 0
      ? PLAYER.speed / 2
      : Math.min(PLAYER.speed, envelope + PLAYER.speed / 30);
    vx = intent.x * envelope;
    vy = intent.y * envelope;
    brake = 0;
  } else if (hybrid && !before.focused) {
    const speed = Math.hypot(before.coastX, before.coastY);
    if (before.neutralTicks === 0) brake = speed / 3;
    const remaining = Math.max(0, speed - brake);
    if (speed > 0 && neutralTicks < 3) {
      vx = before.coastX * remaining / speed;
      vy = before.coastY * remaining / speed;
    }
    if (neutralTicks > 6) envelope = 0;
  } else envelope = 0;
  const x = Math.min(PLAYER.maxX, Math.max(PLAYER.minX, pos.x + vx));
  const y = Math.min(PLAYER.maxY, Math.max(PLAYER.minY, pos.y + vy));
  // Measured displacement removes blocked components, including outward coast.
  vx = x - pos.x;
  vy = y - pos.y;
  const movement: MovementState = {
    version: 1,
    profile: before.profile,
    focused,
    envelope,
    neutralTicks: Math.min(7, neutralTicks),
    coastX: vx,
    coastY: vy,
    brake,
  };
  return { pos: { x, y }, vel: { x: vx, y: vy }, movement, intent };
}
