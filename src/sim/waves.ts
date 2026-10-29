/**
 * The five sectors as data. The starter spelled every wave out as a
 * hand-copied `for` loop inside one giant `if` chain; here each wave is one
 * row, and four formation rules expand rows into individual spawns. Counts,
 * times and positions match the starter exactly (see `game.ts`,
 * `updateProgression`).
 */

import type { EnemyKind, Tick } from "../contracts/index.ts";

/**
 * - `line`: everyone at once, 64 apart, centered on `x`.
 * - `vee`: 44 apart, the outer ships 10 ticks later per step from the middle.
 * - `column`: one after another at `x`, 24 ticks apart.
 * - `pincer`: mirrored pairs from both side walls, a pair every 30 ticks,
 *   each pair 50 lower than the last.
 */
export type Formation = "line" | "vee" | "column" | "pincer";

export interface Wave {
  /** Ticks after the sector starts. */
  readonly at: Tick;
  readonly kind: EnemyKind;
  readonly count: number;
  readonly formation: Formation;
  /** Formation center (ignored by `pincer`). Defaults to mid-screen. */
  readonly x?: number;
}

export interface SectorPlan {
  /** Earliest tick the sector may end, once the screen is clear. */
  readonly minTicks: Tick;
  /** The sector ends here even if enemies remain. */
  readonly capTicks: Tick;
  readonly waves: readonly Wave[];
}

/** Sectors 1–5. The sixth stop (the Warden) is scripted in `boss.ts`. */
export const SECTORS: readonly SectorPlan[] = [
  // 1. Outer Drift: "Scouts ahead"
  {
    minTicks: 1560,
    capTicks: 1800,
    waves: [
      { at: 60, kind: "drone", count: 4, formation: "line" },
      { at: 360, kind: "drone", count: 5, formation: "vee", x: 168 },
      { at: 660, kind: "drone", count: 5, formation: "vee", x: 312 },
      { at: 960, kind: "drone", count: 6, formation: "line" },
      { at: 1200, kind: "drone", count: 4, formation: "column", x: 120 },
      { at: 1260, kind: "drone", count: 4, formation: "column", x: 360 },
    ],
  },
  // 2. Shatter Belt: "Divers incoming"
  {
    minTicks: 1800,
    capTicks: 2040,
    waves: [
      { at: 60, kind: "drone", count: 6, formation: "vee" },
      { at: 300, kind: "dart", count: 4, formation: "line" },
      { at: 600, kind: "dart", count: 5, formation: "column", x: 144 },
      { at: 720, kind: "dart", count: 5, formation: "column", x: 336 },
      { at: 1020, kind: "drone", count: 7, formation: "line" },
      { at: 1140, kind: "dart", count: 5, formation: "vee" },
      { at: 1440, kind: "dart", count: 6, formation: "line" },
    ],
  },
  // 3. Gun Lanes: "Turrets online"
  {
    minTicks: 1920,
    capTicks: 2160,
    waves: [
      { at: 60, kind: "turret", count: 1, formation: "line" },
      { at: 240, kind: "drone", count: 6, formation: "vee" },
      { at: 540, kind: "turret", count: 2, formation: "line" },
      { at: 840, kind: "dart", count: 6, formation: "column" },
      { at: 1080, kind: "turret", count: 2, formation: "line" },
      { at: 1140, kind: "drone", count: 6, formation: "line" },
      // The starter's comment says "pair"; its loop spawns three.
      { at: 1500, kind: "turret", count: 3, formation: "line" },
    ],
  },
  // 4. Lancer Gate: "Crossfire"
  {
    minTicks: 1920,
    capTicks: 2160,
    waves: [
      // The starter's comment says "six lancers"; its loop spawns four.
      { at: 60, kind: "lancer", count: 4, formation: "pincer" },
      { at: 360, kind: "dart", count: 6, formation: "vee" },
      { at: 600, kind: "lancer", count: 6, formation: "pincer" },
      { at: 780, kind: "turret", count: 2, formation: "line" },
      { at: 1140, kind: "lancer", count: 6, formation: "pincer" },
      { at: 1260, kind: "drone", count: 8, formation: "vee" },
      { at: 1560, kind: "dart", count: 8, formation: "line" },
    ],
  },
  // 5. Last Approach: "Everything they have"
  {
    minTicks: 2040,
    capTicks: 2280,
    waves: [
      { at: 60, kind: "turret", count: 3, formation: "line" },
      { at: 180, kind: "lancer", count: 6, formation: "pincer" },
      { at: 540, kind: "dart", count: 6, formation: "column", x: 120 },
      { at: 540, kind: "dart", count: 6, formation: "column", x: 360 },
      { at: 900, kind: "drone", count: 9, formation: "vee" },
      { at: 1020, kind: "turret", count: 2, formation: "line" },
      { at: 1320, kind: "lancer", count: 8, formation: "pincer" },
      { at: 1560, kind: "dart", count: 8, formation: "vee" },
    ],
  },
];

/** One ship of one wave, ready to spawn. */
export interface Spawn {
  readonly at: Tick;
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  /** +1 or -1: weave direction for drones, travel direction for lancers. */
  readonly side: 1 | -1;
}

const LINE_SPACING = 64;
const VEE_SPACING = 44;
const VEE_STAGGER = 10;
const COLUMN_STAGGER = 24;
const PINCER_STAGGER = 30;
const PINCER_TOP = 70;
const PINCER_STEP = 50;
const ENTRY_Y = -30;
const WALL_ENTRY_LEFT = -30;
const WALL_ENTRY_RIGHT = 510;

/** Expands one wave row into spawns, using the starter's formation math. */
export function expandWave(wave: Wave): Spawn[] {
  const center = wave.x ?? 240;
  const middle = (wave.count - 1) / 2;
  const spawns: Spawn[] = [];
  for (let i = 0; i < wave.count; i++) {
    // Alternating sides makes neighboring drones weave in opposite directions.
    const side = i % 2 === 0 ? 1 : -1;
    switch (wave.formation) {
      case "line":
        spawns.push({
          at: wave.at,
          kind: wave.kind,
          x: center + (i - middle) * LINE_SPACING,
          y: ENTRY_Y,
          side,
        });
        break;
      case "vee":
        spawns.push({
          at: wave.at + Math.abs(i - middle) * VEE_STAGGER,
          kind: wave.kind,
          x: center + (i - middle) * VEE_SPACING,
          y: ENTRY_Y,
          side,
        });
        break;
      case "column":
        spawns.push({
          at: wave.at + i * COLUMN_STAGGER,
          kind: wave.kind,
          x: center,
          y: ENTRY_Y,
          side,
        });
        break;
      case "pincer": {
        const pair = Math.floor(i / 2);
        spawns.push({
          at: wave.at + pair * PINCER_STAGGER,
          kind: wave.kind,
          x: side === 1 ? WALL_ENTRY_LEFT : WALL_ENTRY_RIGHT,
          y: PINCER_TOP + pair * PINCER_STEP,
          side,
        });
        break;
      }
    }
  }
  return spawns;
}

/** Every spawn of a sector, sorted by time (stable, so table order breaks ties). */
export function sectorSchedule(plan: SectorPlan): Spawn[] {
  return plan.waves.flatMap(expandWave).sort((a, b) => a.at - b.at);
}
