/**
 * Ambient chatter: barks that play between scripted moments. Each bank (one
 * per character or radio channel) waits `firstAtMs`, then speaks every
 * `intervalMs` (a random range); when several banks are due, the one that has
 * waited longest goes first. Lines are dealt from a shuffle bag ("deck") so a
 * bark never repeats until every other bark in its bank has played, and a new
 * round never opens with the line just heard.
 *
 * This module only decides *what* and *when*. The Director decides *whether*
 * (it holds chatter during scripted moments) and does the playing.
 */

import type { LineId } from "../contracts/index.ts";

export interface ChatterBank {
  readonly id: string;
  readonly lines: readonly LineId[];
  /** Delay before the bank's first bark, from `start()`. */
  readonly firstAtMs: number;
  /** Gap range between this bank's barks, `[min, max]` ms. */
  readonly intervalMs: readonly [number, number];
}

/** A shuffle bag. `random` returns [0, 1); inject a seeded one in tests. */
export class Deck<T> {
  private bag: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly random: () => number,
  ) {}

  deal(): T | undefined {
    if (this.items.length === 0) return undefined;
    if (this.bag.length === 0) {
      this.bag = shuffle([...this.items], this.random);
      // Never open a round with the card that closed the last one.
      if (this.bag.length > 1 && this.bag.at(-1) === this.last) {
        this.bag.unshift(this.bag.pop() as T);
      }
    }
    this.last = this.bag.pop();
    return this.last;
  }
}

function shuffle<T>(xs: T[], random: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

interface BankState {
  readonly bank: ChatterBank;
  readonly deck: Deck<LineId>;
  nextAt: number;
}

export class AmbientScheduler {
  private banks: BankState[] = [];

  constructor(private readonly random: () => number = Math.random) {}

  /** Replaces the active banks; their clocks start at `now`. */
  start(banks: readonly ChatterBank[], now: number): void {
    this.banks = banks.map((bank) => ({
      bank,
      deck: new Deck(bank.lines, this.random),
      nextAt: now + bank.firstAtMs,
    }));
  }

  stop(): void {
    this.banks = [];
  }

  /**
   * Returns the next bark due at `now`, or `undefined`. Only call when the
   * Director is free to play one: the chosen bank's timer restarts here.
   */
  next(now: number): LineId | undefined {
    let pick: BankState | undefined;
    for (const b of this.banks) {
      if (b.nextAt <= now && (!pick || b.nextAt < pick.nextAt)) pick = b;
    }
    if (!pick) return undefined;
    const [min, max] = pick.bank.intervalMs;
    pick.nextAt = now + min + this.random() * (max - min);
    return pick.deck.deal();
  }

  /** Pushes every due bank back by `ms`, so chatter waits out a scene. */
  postpone(now: number, ms: number): void {
    for (const b of this.banks) b.nextAt = Math.max(b.nextAt, now + ms);
  }
}
