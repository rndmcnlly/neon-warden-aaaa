/** Pure scene recipes: boxes are batched by material, never collision bodies. */
export interface Block {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  roll?: number;
  material: 0 | 1 | 2;
}
export const WORLD_NAMES = [
  "Outer Drift",
  "Shatter Belt",
  "Gun Lanes",
  "Lancer Gate",
  "Last Approach",
] as const;
export const WORLD_BUDGET = {
  blocks: 230,
  drawCalls: 7,
  movingPropsLow: 1,
  movingPropsHigh: 3,
} as const;

export function sectorBlocks(sector: number): Block[] {
  const b: Block[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: 0 | 1 | 2 = 0,
    roll = 0,
  ) => b.push({ x, y, z, w, h, d, material, roll });
  // Survey ruler: long bars, not isolated luminous dots that resemble bullets.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      box(
        side * 7.6,
        -1.1,
        -26 + i * 2.6,
        i % 5 === 0 ? 0.9 : 0.35,
        0.08,
        0.06,
        1,
      );
    }
  }
  if (sector === 1) {
    // Public route mast with a broad, incomplete signal crown.
    box(-11, -3, -4, 1.1, 7, 1.4);
    box(-11, -0.6, -4, 5, 0.35, 3, 1);
    box(-11, -0.1, -4, 3.5, 0.22, 2, 2);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side * (12 + (i % 2) * 3), z = -20 + i * 9;
        box(x, -4, z, 1.7, 0.7, 4.2, 1);
        box(x, -3.6, z, 1, 0.5, 2.8);
        box(x, -3.2, z + 1.7, 2.3, 0.18, 0.7, 2);
        // Cargo spine, paired nacelles and an unlit bridge window.
        box(x, -3.15, z - 1.2, 0.75, 0.45, 0.65, 1);
        for (const wing of [-1, 1]) {
          box(x + wing * 1.1, -3.8, z + 1, 0.38, 0.5, 1.5);
          box(x + wing * 0.55, -3.25, z, 0.05, 0.1, 1.9, 2);
        }
      }
    }
  } else if (sector === 2) {
    // A broken orbital truss, visibly spliced with pale Commons braces.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const x = side * (10 + (i % 3) * 2), z = -25 + i * 4.5;
        box(x, -3 - i % 3, z, 2.6, 1.5, 3.5, 0, i * 0.21);
        box(x, -1.8 - i % 3, z, 3.2, 0.16, 0.5, 1, -0.5);
        if (i % 3 === 0) box(x, -1.55, z, 2.5, 0.08, 0.18, 2, 0.6);
        // Crossed-out plates and repair straps, not bright sparks.
        box(x, -1.42 - i % 3, z, 1.1, 0.05, 0.65, 1);
        box(x, -1.35 - i % 3, z, 1.4, 0.05, 0.12, 0, -0.55);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = i / 18 * Math.PI * 2;
      box(
        -14 + Math.cos(a) * 5,
        -4,
        -4 + Math.sin(a) * 7,
        2.8,
        1.2,
        1.2,
        i % 4 === 0 ? 1 : 0,
        -a,
      );
    }
  } else if (sector === 3) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side * 11, z = -24 + i * 8;
        box(x, -3, z, 5, 2, 5);
        box(x, -1.9, z, 4.4, 0.14, 3.7, 1);
        box(side * 8, -0.9, z, 0.45, 0.4, 4, 2);
        box(side * 13, -0.2, z, 0.7, 4, 0.8);
        box(side * 11, 1.6, z, 4.6, 0.4, 0.8, 1);
        // Opaque stowed accounting rollers, no sweeping combat-like beam.
        for (let n = 0; n < 3; n++) {
          box(side * 12, -1.3, z - 1 + n, 1.4, 0.5, 0.5, 1);
        }
        box(side * 10, -1.65, z, 2.7, 0.1, 0.16, 2);
        for (const brace of [-1, 1]) {
          box(side * 11 + brace * 1.5, -1.6, z, 0.12, 0.4, 2.5, 1, brace * 0.5);
        }
      }
    }
  } else if (sector === 4) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        // Side bays follow the actual pincer heights, but never claim a forecast.
        const z = (70 + i * 50 - 320) / 40;
        box(side * 10, -2.4, z, 4.8, 2, 0.9);
        box(side * 8, -1.25, z, 1.2, 0.15, 0.7, 2);
        box(side * 13, -0.5, z, 0.6, 4, 0.7, 1);
        box(side * 11, 0.5, z, 2.5, 0.3, 0.6);
        box(side * 9.5, -1.25, z + 0.5, 2.8, 0.12, 0.15, 1);
        box(side * 9.5, -1.25, z - 0.5, 2.8, 0.12, 0.15, 1);
      }
    }
    for (const side of [-1, 1]) {
      box(side * 16, -4, -2, 0.6, 0.5, 42, 1);
      box(side * 9, -1, -15, 2, 5, 2);
      box(side * 9, 1.6, -15, 2.6, 0.2, 2.6, 2);
    }
  } else {
    // Guardian buttresses protect a nursery arch below the play plane.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        box(side * (9 + i * 1.3), -5, -22 + i * 7, 1.3, 7, 3.6, 1, side * 0.25);
        box(side * (9 + i * 1.3), -1.3, -22 + i * 7, 2.2, 0.2, 3.8, 2);
        box(side * 12, -3, -22 + i * 7, 4, 0.8, 4);
        for (let n = 0; n < 3; n++) {
          box(side * (11.2 + n * 0.7), -2.45, -22 + i * 7, 0.35, 0.2, 2.8, 2);
        }
      }
    }
    // Heart/gate motif remains distant, never another boss target.
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      box(Math.cos(a) * 8, -6, -18 + Math.sin(a) * 5, 2.1, 0.65, 1.3, 1, -a);
    }
    for (const side of [-1, 1]) {
      box(side * 1.4, -5.5, -18, 1, 0.2, 3.2, 2, side * 0.65);
      box(side * 1.9, -5.5, -19.4, 1.6, 0.2, 1.4, 2, side * 0.55);
      // Stowed toll cabinets, deliberately dark until an explicit ending cue.
      box(side * 10, -2, 9, 2, 1.6, 3);
    }
  }
  return b;
}
