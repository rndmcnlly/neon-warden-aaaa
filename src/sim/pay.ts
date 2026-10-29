/**
 * Contract Rate: the pay multiplier (research: gameplay micro-systems, D).
 *
 * Every payout is credits x rate. Events raise the rate and refresh a chain
 * timer; when the timer runs out the rate decays in steps rather than
 * resetting; a hit halves it (the rate break). The economy pays killing
 * best on purpose: the HUD measures what the Authority wants.
 */

import type { PayReason, PayView, SimEvent, Tick } from "../contracts/index.ts";
import { PAY } from "./tuning.ts";

export class ContractRate {
  credits = 0;
  rate: number = PAY.minRate;
  chain = 0;
  private decayClock = 0;

  constructor(readonly chainMax: number) {}

  view(): PayView {
    return {
      credits: this.credits,
      rate: this.rate,
      chainTicks: this.chain,
      chainMax: this.chainMax,
    };
  }

  reset(): void {
    this.credits = 0;
    this.rate = PAY.minRate;
    this.chain = 0;
    this.decayClock = 0;
  }

  /** Pays `base` credits at the current rate, then raises the rate. */
  earn(
    tick: Tick,
    reason: PayReason,
    base: number,
    rateGain: number,
  ): SimEvent {
    const delta = Math.round(base * this.rate);
    this.credits += delta;
    this.rate = round2(Math.min(PAY.maxRate, this.rate + rateGain));
    this.chain = this.chainMax;
    this.decayClock = 0;
    return this.event(tick, reason, delta);
  }

  /** Keeps the chain alive without paying (sustained contact on the Warden). */
  refresh(): void {
    this.chain = this.chainMax;
  }

  /** A hit on the ship: halve the rate, or a small cut if a shield took it. */
  rateBreak(tick: Tick, absorbed: boolean): SimEvent {
    this.rate = round2(
      Math.max(
        PAY.minRate,
        absorbed ? this.rate - PAY.shieldBreak : this.rate / 2,
      ),
    );
    return this.event(tick, "rateBreak", 0);
  }

  /** One tick of the chain timer; returns a `decay` event when the rate drops. */
  step(tick: Tick): SimEvent | null {
    if (this.chain > 0) {
      this.chain--;
      return null;
    }
    if (this.rate <= PAY.minRate) return null;
    this.decayClock++;
    if (this.decayClock < PAY.decayEvery) return null;
    this.decayClock = 0;
    this.rate = round2(Math.max(PAY.minRate, this.rate - PAY.decayStep));
    return this.event(tick, "decay", 0);
  }

  private event(tick: Tick, reason: PayReason, delta: number): SimEvent {
    return {
      type: "payChanged",
      tick,
      credits: this.credits,
      rate: this.rate,
      delta,
      reason,
    };
  }
}

/** Rates are shown to two decimals; rounding keeps replays exact and tidy. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
