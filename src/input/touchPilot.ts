/**
 * Touch gameplay as one more input source for the same `InputFrame`
 * (research/2026-10-28-mobile-touch, section 2). The deck's DOM
 * (`src/ui/touchDeck.ts`) reports fingers here; the input layer calls
 * `read()` once per sim tick. Pure and clock-injected, so every scheme is
 * pinned by `tests/input_touch_test.ts` without a browser.
 *
 * Movement is relative drag, the genre standard: the ship moves by the
 * finger's travel, not to the finger, so the finger never covers the ship
 * (no occlusion, no perceived-touch-point error) and a drag may start
 * anywhere. The sim wants a velocity in [-1, 1], so travel is banked as
 * "pending" playfield units and paid out at most one tick of top speed per
 * tick. Lifting the finger cancels what is left: the ship never drifts.
 *
 * Fire follows the scheme (see `TouchScheme` in the settings contract).
 * Every scheme reports the raw held state, as the contract asks, so the sim
 * alone decides tap, stream, rest and Writ. One-finger's single shot is the
 * contract's sanctioned "pulse": fire held for a few ticks, then released.
 */

import type { TouchScheme, Vec2 } from "../contracts/index.ts";
// The adapter converts finger travel to the sim's velocity units, so it
// must know the speed law; reading it here keeps one source of truth.
import { PLAYER } from "../sim/tuning.ts";

export interface TouchConfig {
  readonly scheme: TouchScheme;
  /** Player's drag gain multiplier, 0.5–2. */
  readonly sensitivity: number;
  /** Playfield units per CSS px near the ship (from the stage's projection). */
  readonly unitsPerPx: number;
  readonly autoFire: boolean;
  readonly holdToggle: "hold" | "toggle";
}

/** Starting numbers; tune on phones (see the research's risk list). */
export const TOUCH = Object.freeze({
  /** One finger: holding FIRE this long latches the stream on. */
  longPressMs: 400,
  /** One finger: a tap holds fire this many ticks (under the 8-tick tap threshold). */
  pulseTicks: 3,
  /**
   * Gain curve (pointer acceleration): slow, careful drags move the ship
   * less per px than fast flicks, so precision does not need a button.
   */
  slowPxPerMs: 0.15,
  fastPxPerMs: 1.2,
  slowGain: 0.6,
  fastGain: 1.4,
  /** Never bank more than this many ticks of travel (walls would store it). */
  maxPendingTicks: 3,
  /** Auto-fire on touch streams while the finger moved this recently. */
  movingWindowMs: 120,
});

export interface TouchRead {
  readonly move: Vec2;
  readonly fire: boolean;
  readonly focus: boolean;
}

/** What the deck draws (latched stream, focus lit). */
export interface TouchView {
  readonly flying: boolean;
  readonly fireHeld: boolean;
  readonly latched: boolean;
  readonly focus: boolean;
}

interface Finger {
  readonly id: number;
  x: number;
  y: number;
  t: number;
}

export function dragGain(pxPerMs: number): number {
  const { slowPxPerMs, fastPxPerMs, slowGain, fastGain } = TOUCH;
  const k = Math.min(
    1,
    Math.max(0, (pxPerMs - slowPxPerMs) / (fastPxPerMs - slowPxPerMs)),
  );
  return slowGain + (fastGain - slowGain) * k;
}

export class TouchPilot {
  #finger: Finger | null = null;
  #pending = { x: 0, y: 0 };
  #lastMovedAt = -Infinity;
  #fireDownAt: number | null = null;
  #firePresses = 0;
  /** Thumbs in toggle mode, or One finger's long-press stream. */
  #latched = false;
  /** One finger: this press already latched, so its release is not a tap. */
  #longPressed = false;
  #pulse = 0;
  #focus = false;

  /** True while touch is driving anything (so the frame should listen). */
  get active(): boolean {
    return this.#finger !== null || this.#fireDownAt !== null ||
      this.#latched || this.#pulse > 0 || this.#focus;
  }

  get view(): TouchView {
    return {
      flying: this.#finger !== null,
      fireHeld: this.#fireDownAt !== null,
      latched: this.#latched,
      focus: this.#focus,
    };
  }

  /** A flying finger lands. Only one flies; a second is ignored, not mixed in. */
  moveStart(id: number, x: number, y: number, t: number): boolean {
    if (this.#finger) return false;
    this.#finger = { id, x, y, t };
    return true;
  }

  moveTo(id: number, x: number, y: number, t: number, cfg: TouchConfig): void {
    const f = this.#finger;
    if (!f || f.id !== id) return;
    const dx = x - f.x;
    const dy = y - f.y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(1, t - f.t);
    const scale = cfg.unitsPerPx * cfg.sensitivity * dragGain(dist / dt);
    this.#pending.x += dx * scale;
    this.#pending.y += dy * scale;
    if (dist > 0.5) this.#lastMovedAt = t;
    f.x = x;
    f.y = y;
    f.t = t;
  }

  moveEnd(id: number): void {
    if (this.#finger?.id !== id) return;
    this.#finger = null;
    this.#pending = { x: 0, y: 0 };
  }

  fireStart(t: number): void {
    if (this.#fireDownAt !== null) return;
    this.#fireDownAt = t;
    this.#firePresses++;
    this.#longPressed = false;
  }

  fireEnd(cfg: Pick<TouchConfig, "scheme">): void {
    if (this.#fireDownAt === null) return;
    this.#fireDownAt = null;
    if (cfg.scheme !== "oneFinger" || this.#longPressed) return;
    if (this.#latched) this.#latched = false;
    else this.#pulse = TOUCH.pulseTicks;
  }

  /** Focus is a toggle on touch: holding a second button would need two fingers. */
  toggleFocus(): void {
    this.#focus = !this.#focus;
  }

  /** Pause, blur, a new run: drop every finger and latch. */
  reset(): void {
    this.#finger = null;
    this.#pending = { x: 0, y: 0 };
    this.#fireDownAt = null;
    this.#firePresses = 0;
    this.#latched = false;
    this.#longPressed = false;
    this.#pulse = 0;
    this.#focus = false;
  }

  /** Once per sim tick. `now` in the same clock as the pointer events. */
  read(now: number, cfg: TouchConfig): TouchRead {
    const speed = this.#focus ? PLAYER.focusSpeed : PLAYER.speed;
    const cap = speed * TOUCH.maxPendingTicks;
    const banked = Math.hypot(this.#pending.x, this.#pending.y);
    if (banked > cap) {
      this.#pending.x *= cap / banked;
      this.#pending.y *= cap / banked;
    }
    const dust = Math.hypot(this.#pending.x, this.#pending.y) < 1e-6;
    let mx = dust ? 0 : this.#pending.x / speed;
    let my = dust ? 0 : this.#pending.y / speed;
    // Same magnitude clamp as the sim's `normalizeMove`, so what we pay
    // out is exactly what the ship travels (classic movement profile).
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    this.#pending.x -= mx * speed;
    this.#pending.y -= my * speed;
    // Float dust after a payout must not read as a tiny, endless drift.
    if (Math.hypot(this.#pending.x, this.#pending.y) < 1e-6) {
      this.#pending = { x: 0, y: 0 };
    }
    const fire = this.#fire(now, cfg);
    this.#firePresses = 0;
    return { move: { x: mx, y: my }, fire, focus: this.#focus };
  }

  #fire(now: number, cfg: TouchConfig): boolean {
    // "Pulse auto": stream while the finger moves, rest while it is still,
    // so auto-fire players keep the Writ charge and the scan beam.
    if (cfg.autoFire) {
      return this.#finger !== null &&
        now - this.#lastMovedAt < TOUCH.movingWindowMs;
    }
    switch (cfg.scheme) {
      case "thumbs":
        if (cfg.holdToggle === "hold") return this.#fireDownAt !== null;
        if (this.#firePresses % 2 === 1) this.#latched = !this.#latched;
        return this.#latched;
      case "arcade":
        // Lifting is the verb: the flying finger is the trigger.
        return this.#finger !== null;
      case "oneFinger": {
        const held = this.#fireDownAt;
        if (
          held !== null && !this.#latched && !this.#longPressed &&
          now - held >= TOUCH.longPressMs
        ) {
          this.#latched = true;
          this.#longPressed = true;
        }
        if (this.#pulse > 0) {
          this.#pulse--;
          return true;
        }
        return this.#latched;
      }
    }
  }
}
