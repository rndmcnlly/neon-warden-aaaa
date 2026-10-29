/**
 * Smooth motion between fixed sim ticks.
 *
 * The sim advances in whole 60 Hz ticks, but the display might refresh at 30,
 * 120 or 144 Hz. Drawing the raw latest tick would stutter, so the renderer
 * keeps the two most recent ticks and blends between them by `alpha`, the
 * fraction of a tick the game loop's accumulator has banked (0 = previous
 * tick, 1 = current tick). This is the classic "fix your timestep"
 * interpolation; it adds at most one tick (about 17 ms) of visual latency.
 *
 * During high-speed auto-play the loop runs many ticks per frame. Only the
 * last two matter for drawing, so `observe` is cheap: it copies positions
 * into two flip-flopped maps rather than keeping history. Snapshots may share
 * structure with the live sim, so we copy numbers instead of keeping
 * references (CONTRACTS.md: treat snapshots as immutable, copy what you keep).
 */

import type { EntityId, SimState } from "../contracts/index.ts";

export interface Pos {
  x: number;
  y: number;
}

/** Player position lives in its own slot: it has no entity id. */
const PLAYER_KEY = -1;

export class SnapshotInterpolator {
  private prev = new Map<EntityId, Pos>();
  private curr = new Map<EntityId, Pos>();
  private prevTick = -1;
  private currTick = -1;
  private prevBank = 0;
  private currBank = 0;

  /** The most recent state observed; read it for non-positional fields. */
  latest: SimState | null = null;

  /** Records one tick. Call after every `sim.step`, or at least once a frame. */
  observe(state: SimState): void {
    if (state.tick === this.currTick) {
      this.latest = state;
      return;
    }
    // Flip the maps rather than allocating: the old `prev` becomes scratch.
    const scratch = this.prev;
    this.prev = this.curr;
    this.curr = scratch;
    this.curr.clear();
    this.prevTick = this.currTick;
    this.currTick = state.tick;
    this.prevBank = this.currBank;
    this.currBank = state.player.bank;

    this.curr.set(PLAYER_KEY, { x: state.player.pos.x, y: state.player.pos.y });
    for (const e of state.enemies) this.curr.set(e.id, copy(e.pos));
    for (const b of state.bullets) this.curr.set(b.id, copy(b.pos));
    for (const p of state.pickups) this.curr.set(p.id, copy(p.pos));
    if (state.boss) this.curr.set(state.boss.id, copy(state.boss.pos));
    this.latest = state;
  }

  /**
   * Blended position of `id` at `alpha`. New entities (no previous tick) sit
   * at their current position. If the sim skipped ticks between observations
   * (we were not called every step), we still blend the last two we saw.
   */
  position(id: EntityId, alpha: number, out: Pos): Pos {
    const b = this.curr.get(id);
    if (!b) return out;
    const a = this.prev.get(id) ?? b;
    const t = clamp01(alpha);
    // A teleport (respawn, wrap) should snap rather than smear across the field.
    const jump = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 120;
    out.x = jump ? b.x : a.x + (b.x - a.x) * t;
    out.y = jump ? b.y : a.y + (b.y - a.y) * t;
    return out;
  }

  playerPosition(alpha: number, out: Pos): Pos {
    return this.position(PLAYER_KEY, alpha, out);
  }

  playerBank(alpha: number): number {
    return this.prevBank + (this.currBank - this.prevBank) * clamp01(alpha);
  }

  /** Fractional tick for cosmetic animation (spins, pulses) that should not stutter. */
  tickAt(alpha: number): number {
    if (this.prevTick < 0) return this.currTick;
    return this.prevTick + (this.currTick - this.prevTick) * clamp01(alpha);
  }
}

function copy(p: { readonly x: number; readonly y: number }): Pos {
  return { x: p.x, y: p.y };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
