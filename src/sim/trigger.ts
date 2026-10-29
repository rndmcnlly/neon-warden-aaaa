/**
 * Trigger discipline: one fire button, three expressions.
 *
 * - Press edge: one aimed round, or, if the trigger rested long enough, a
 *   Writ round that spends the whole charge.
 * - Held past `TRIGGER.tapThreshold` ticks: the stream.
 * - Released: the charge fills (levels at the weapon's `chargeTicks`).
 *
 * `Trigger.update` is a small state machine over the held flag. It decides
 * what to fire and reports it as a `Volley`; the sim turns volleys into
 * projectiles. It never reads positions, so it is easy to test alone.
 */

import type {
  ChargeLevel,
  ShotKind,
  TriggerState,
  WeaponStats,
} from "../contracts/index.ts";
import { TRIGGER } from "./tuning.ts";

export interface Volley {
  readonly shot: ShotKind;
  /** Writ level spent (1–3); 0 for aimed and stream. */
  readonly level: ChargeLevel;
}

export class Trigger {
  state: TriggerState = "rest";
  /** Ticks the button has been held (0 while released). */
  private heldTicks = 0;
  /** Ticks the button has been released; drives the charge. */
  idleTicks = 0;
  level: ChargeLevel = 0;
  private aimedCooldown = 0;
  private streamCooldown = 0;

  constructor(private readonly weapon: WeaponStats) {}

  /** 0–1 progress toward a full charge. */
  get charge(): number {
    return Math.min(1, this.idleTicks / this.weapon.chargeTicks[2]);
  }

  /** Clears charge and cooldowns (leaving the tutorial). */
  reset(): void {
    this.state = "rest";
    this.heldTicks = 0;
    this.idleTicks = 0;
    this.level = 0;
    this.aimedCooldown = 0;
    this.streamCooldown = 0;
  }

  /**
   * One tick. Returns the volley fired this tick, if any, and whether the
   * charge level changed (`levelChanged`), for the `chargeLevel` event.
   */
  update(held: boolean): { volley: Volley | null; levelChanged: boolean } {
    this.aimedCooldown = Math.max(0, this.aimedCooldown - 1);
    this.streamCooldown = Math.max(0, this.streamCooldown - 1);
    const before = this.level;

    if (!held) {
      this.state = "rest";
      this.heldTicks = 0;
      this.idleTicks++;
      this.level = levelFor(this.idleTicks, this.weapon.chargeTicks);
      return { volley: null, levelChanged: this.level !== before };
    }

    this.heldTicks++;
    let volley: Volley | null = null;
    if (this.heldTicks === 1) {
      // The press edge: spend the charge if there is any.
      this.state = "tap";
      if (this.level > 0) {
        volley = { shot: "writ", level: this.level };
        this.aimedCooldown = this.weapon.aimedCooldown;
      } else if (this.aimedCooldown === 0) {
        volley = { shot: "aimed", level: 0 };
        this.aimedCooldown = this.weapon.aimedCooldown;
      }
      this.idleTicks = 0;
      this.level = 0;
    } else if (this.heldTicks > TRIGGER.tapThreshold) {
      this.state = "stream";
      if (this.streamCooldown === 0) {
        volley = { shot: "stream", level: 0 };
        this.streamCooldown = this.weapon.streamInterval;
      }
    }
    return { volley, levelChanged: this.level !== before };
  }
}

function levelFor(
  idle: number,
  thresholds: readonly [number, number, number],
): ChargeLevel {
  if (idle >= thresholds[2]) return 3;
  if (idle >= thresholds[1]) return 2;
  if (idle >= thresholds[0]) return 1;
  return 0;
}
