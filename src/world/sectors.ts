/**
 * Pure scene recipes for the five sector worlds: which Blender-built set
 * pieces stand where along the route, what they are doing, and what survives
 * the low quality tier. Nothing here is a collision body or a spawn forecast.
 *
 * Coordinates are route coordinates (see route.ts): `s` world units along the
 * route from the sector start, `x` lateral, `y` height (the combat plane is
 * y = 0; negative is below it). Asset geometry is in meters and scaled by
 * METERS * scale. Each sector answers "what is this place, what is happening,
 * who works here" with one hero set piece that stays alongside the lane for
 * the whole sector, supporting pieces that arrive from ahead, a far landmark
 * that a portrait screen sees above the lane, and dark near silhouettes.
 */
import type { Activity } from "./activity.ts";

export const WORLD_NAMES = [
  "Outer Drift",
  "Shatter Belt",
  "Gun Lanes",
  "Lancer Gate",
  "Last Approach",
] as const;

/** World units per Blender meter. A 40 m hauler is 4 units; the lane is 12. */
export const METERS = 0.1;
/** Route scroll speed, world units per observed sim second (60 ticks). */
export const SCROLL = 0.5;

export type Layer = "near" | "mid" | "far";

/** One more instance of the same asset, relative to its placement. */
export interface Copy {
  readonly ds: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly yaw?: number;
  readonly scale?: number;
  /** Instance tint (multiplies vertex color), e.g. container liveries. */
  readonly tint?: number;
}

export interface Placement {
  /** public/models/world/<asset>.glb */
  readonly asset: string;
  readonly layer: Layer;
  readonly s: number;
  readonly x: number;
  readonly y: number;
  readonly yaw?: number;
  readonly scale?: number;
  readonly activity?: Activity;
  /** Kept on the low tier: every sector keeps at least one recognizable piece. */
  readonly hero?: boolean;
  /** Always draw the decimated `_lod` file (dense far skyline fills). */
  readonly lod?: boolean;
  readonly copies?: readonly Copy[];
}

export interface SectorLayout {
  readonly sector: number;
  /** What a glance should tell a viewer, used by tests, docs and the viewer. */
  readonly intent: string;
  /** Body tint for this sector's world band (mid values, low saturation). */
  readonly tint: number;
  /** Signed lateral swing of the distant route ahead (route.ts). */
  readonly bend: number;
  /** Route length before scenery wraps (world units). */
  readonly length: number;
  readonly pieces: readonly Placement[];
}

const row = (n: number, step: number, from = 0, extra: Partial<Copy> = {}) =>
  Array.from({ length: n }, (_, i) => ({ ds: from + i * step, ...extra }));

const LIVERIES = [0xb0683a, 0xcfc4a6, 0x4f7a78, 0xb0683a, 0x46506a, 0x9a5a3a];

/** Two container stacks either side of the crane's travel (crane yawed 90°). */
function stacks(scale: number): Copy[] {
  const out: Copy[] = [];
  let k = 0;
  for (const [ds, tiers] of [[-1.8, 2], [2.2, 1]] as const) {
    // Stack offsets are in crane meters, so they scale with the crane.
    for (let lane = -2; lane <= 2; lane++) {
      for (let tier = 0; tier < (lane % 2 ? tiers : 1); tier++) {
        out.push({
          ds: ds * scale,
          dx: -lane * 0.28 * scale,
          dy: tier * 0.26 * scale,
          yaw: Math.PI / 2,
          scale,
          tint: LIVERIES[k++ % LIVERIES.length],
        });
      }
    }
  }
  return out;
}

export const SECTOR_LAYOUTS: readonly SectorLayout[] = [
  {
    sector: 1,
    intent:
      "A public beacon buoy where small civilian haulers queue with running lights on; a free waystation ahead.",
    tint: 0xb4c4d2,
    bend: 3,
    length: 64,
    pieces: [
      {
        asset: "od_beacon",
        layer: "mid",
        s: 7,
        x: 13,
        y: -3.2,
        scale: 1.6,
        activity: "beacon",
        hero: true,
      },
      {
        asset: "od_hauler_a",
        layer: "mid",
        s: -6,
        x: 8.6,
        y: -2.6,
        scale: 1.3,
        activity: "queue",
        hero: true,
        copies: row(3, 8.8),
      },
      {
        asset: "od_hauler_b",
        layer: "mid",
        s: -1.6,
        x: 8.6,
        y: -2.6,
        scale: 1.3,
        activity: "queue",
        copies: row(3, 8.8),
      },
      {
        asset: "od_hauler_b",
        layer: "mid",
        s: 0,
        x: -9.6,
        y: -3.4,
        yaw: Math.PI,
        scale: 1.3,
        activity: "outbound",
        copies: row(3, 9.5),
      },
      {
        asset: "od_hauler_a",
        layer: "mid",
        s: 4,
        x: -13.4,
        y: -5.6,
        yaw: Math.PI,
        scale: 1.2,
        activity: "outbound",
        copies: row(3, 10),
      },
      {
        asset: "od_waystation",
        layer: "far",
        s: 30,
        x: -8,
        y: -18,
        scale: 1.3,
        activity: "spin",
        hero: true,
      },
      {
        asset: "od_waystation",
        layer: "far",
        s: 8,
        x: 22,
        y: -26,
        scale: 0.6,
        lod: true,
        activity: "spin",
        copies: [{ ds: 0 }, { ds: 20, dx: -46 }],
      },
      {
        asset: "od_hauler_a",
        layer: "near",
        s: 14,
        x: -15,
        y: 1.8,
        scale: 1.4,
        activity: "queue",
      },
    ],
  },
  {
    sector: 2,
    intent:
      "A snapped bridge truss where a Commons repair crew welds mismatched patch plates; drifting rock.",
    tint: 0xc4bcb0,
    bend: -3,
    length: 64,
    pieces: [
      {
        asset: "sb_truss",
        layer: "mid",
        s: 6,
        x: 11.5,
        y: -3.2,
        scale: 1.5,
        hero: true,
      },
      {
        asset: "sb_repair",
        layer: "mid",
        s: 7.5,
        x: 11.5,
        y: -3.2,
        scale: 1.5,
        activity: "repair",
        hero: true,
      },
      {
        asset: "sb_rock",
        layer: "mid",
        s: 2,
        x: -11,
        y: -4.4,
        scale: 1.3,
        activity: "tumble",
        copies: [
          { ds: 0 },
          { ds: 6, dx: 2.2, scale: 0.5 },
          {
            ds: 11,
            dx: -1.5,
            scale: 0.8,
          },
          { ds: 17, dx: 1, scale: 0.6 },
          { ds: 23, dx: -2, scale: 1.1 },
        ],
      },
      {
        asset: "sb_truss",
        layer: "far",
        s: 30,
        x: -2,
        y: -12,
        yaw: 0.35,
        scale: 1.5,
      },
      {
        asset: "sb_rock",
        layer: "far",
        s: 20,
        x: 4,
        y: -20,
        scale: 2.2,
        activity: "tumble",
        hero: true,
        copies: [{ ds: 0 }, { ds: 12, dx: -14, scale: 0.7 }, {
          ds: -10,
          dx: 12,
          scale: 0.8,
        }],
      },
      {
        asset: "sb_rock",
        layer: "far",
        s: 0,
        x: 17,
        y: -12,
        scale: 1.4,
        lod: true,
        activity: "tumble",
        copies: [0, 7, 13, 21, 27, 33].map((ds, i) => ({
          ds,
          dx: i % 2 ? -34 : (i % 3) * 2,
          scale: 0.6 + (i % 3) * 0.3,
        })),
      },
      {
        asset: "sb_rock",
        layer: "near",
        s: 10,
        x: -15.5,
        y: 1.4,
        activity: "tumble",
        copies: [{ ds: 0 }, { ds: 14, dx: 31, scale: 0.8 }],
      },
    ],
  },
  {
    sector: 3,
    intent:
      "A Lane Authority toll gantry over a side freight lane: pods stop, get scanned, barrier arms lift, a ticker bills them.",
    tint: 0xb0b8cc,
    bend: 4,
    length: 64,
    pieces: [
      {
        asset: "gl_gantry",
        layer: "mid",
        s: 7,
        x: 12.5,
        y: -3.6,
        scale: 1.6,
        activity: "toll",
        hero: true,
      },
      {
        asset: "gl_pod",
        layer: "mid",
        s: 7,
        x: 12.5,
        y: -3.6,
        scale: 1.6,
        activity: "tollPods",
        hero: true,
        copies: row(3, 0),
      },
      {
        asset: "gl_tower",
        layer: "mid",
        s: 9,
        x: -12.5,
        y: -6.6,
        scale: 1.2,
      },
      {
        asset: "gl_tower",
        layer: "far",
        s: 32,
        x: 0,
        y: -14,
        scale: 1.2,
        hero: true,
      },
      {
        asset: "gl_tower",
        layer: "far",
        s: 2,
        x: -19,
        y: -16,
        lod: true,
        copies: [0, 9, 18, 27].flatMap((ds, i) => [
          { ds, dx: (i % 2) * -3 },
          { ds: ds + 4, dx: 38 + (i % 2) * 3, scale: 0.8 },
        ]),
      },
      {
        asset: "gl_pod",
        layer: "near",
        s: 4,
        x: 15.5,
        y: 1.2,
        scale: 1.2,
        copies: row(2, 13),
      },
    ],
  },
  {
    sector: 4,
    intent:
      "A Saltline Haulers container interchange: a gantry crane shuttles a container between stacks; side bays kept clear.",
    tint: 0xc8bca8,
    bend: -3,
    length: 64,
    pieces: [
      {
        asset: "lg_crane",
        layer: "mid",
        s: 8,
        x: 12.5,
        y: -3.6,
        yaw: Math.PI / 2,
        scale: 1.5,
        activity: "crane",
        hero: true,
      },
      {
        asset: "lg_container",
        layer: "mid",
        s: 8,
        x: 12.5,
        y: -3.6,
        hero: true,
        copies: stacks(1.5),
      },
      {
        asset: "lg_bay",
        layer: "mid",
        s: 1,
        x: 8.2,
        y: -2.4,
        scale: 1.2,
        copies: row(3, 8.5),
      },
      {
        asset: "lg_bay",
        layer: "mid",
        s: 5,
        x: -8.2,
        y: -2.4,
        yaw: Math.PI,
        scale: 1.2,
        copies: row(3, 8.5),
      },
      {
        asset: "od_hauler_a",
        layer: "mid",
        s: 6,
        x: -13,
        y: -5,
        scale: 1.3,
        activity: "queue",
        copies: row(2, 9),
      },
      {
        asset: "lg_crane",
        layer: "far",
        s: 30,
        x: 0,
        y: -12,
        scale: 1.2,
        activity: "crane",
      },
      {
        asset: "lg_container",
        layer: "far",
        s: 0,
        x: -16,
        y: -10,
        scale: 1.6,
        copies: Array.from({ length: 14 }, (_, i) => ({
          ds: Math.floor(i / 2) * 4.5,
          dx: (i % 2) * 0.5 + (i % 4 > 1 ? 33 : 0),
          dy: (i % 3) * 0.42,
          tint: LIVERIES[i % LIVERIES.length],
        })),
      },
      {
        asset: "lg_container",
        layer: "near",
        s: 8,
        x: -15.5,
        y: 1.6,
        scale: 1.5,
        copies: [{ ds: 0, tint: 0x3a3a3a }, { ds: 12, dx: 31, tint: 0x3a3a3a }],
      },
    ],
  },
  {
    sector: 5,
    intent:
      "The Warden's home: monumental buttresses with a heart motif, terraced nursery beds of growing scouts, a heart gate ahead.",
    tint: 0xbcb0c8,
    bend: 0,
    length: 64,
    pieces: [
      {
        asset: "la_buttress",
        layer: "mid",
        s: 3,
        x: 12.5,
        y: -3,
        scale: 1.3,
        hero: true,
      },
      {
        asset: "la_buttress",
        layer: "mid",
        s: 14,
        x: -12.5,
        y: -3,
        yaw: Math.PI,
        scale: 1.3,
        copies: [{ ds: 0 }, { ds: 12, dx: 25 }],
      },
      {
        asset: "la_nursery",
        layer: "mid",
        s: 11,
        x: 12.6,
        y: -3.2,
        scale: 1.8,
        activity: "nursery",
        hero: true,
      },
      {
        asset: "la_heartgate",
        layer: "far",
        s: 30,
        x: 0,
        y: -16,
        scale: 0.9,
        hero: true,
      },
      {
        asset: "la_buttress",
        layer: "far",
        s: 0,
        x: 19,
        y: -14,
        lod: true,
        copies: [0, 8, 16, 24, 32].flatMap((ds) => [
          { ds },
          { ds: ds + 4, dx: -38, yaw: Math.PI },
        ]),
      },
      {
        asset: "la_buttress",
        layer: "near",
        s: 8,
        x: -16.5,
        y: 1.6,
        scale: 0.7,
      },
    ],
  },
];

export function sectorLayout(sector: number): SectorLayout {
  return SECTOR_LAYOUTS[Math.min(5, Math.max(1, sector)) - 1];
}

/** Every placement instance, flattened (copies resolved), for budgets and tests. */
export function instancesOf(p: Placement): Required<Copy>[] {
  const copies = p.copies ?? [{ ds: 0 }];
  return copies.map((c) => ({
    ds: c.ds,
    dx: c.dx ?? 0,
    dy: c.dy ?? 0,
    yaw: c.yaw ?? 0,
    scale: c.scale ?? 1,
    tint: c.tint ?? 0xffffff,
  }));
}

/** Pieces drawn on a tier: low keeps heroes only, with far heroes as LODs. */
export function piecesFor(layout: SectorLayout, low: boolean): Placement[] {
  return layout.pieces.filter((p) => !low || p.hero);
}

/** Asset file actually loaded for a placement on a tier. */
export function assetFor(
  p: Placement,
  low: boolean,
  lods: ReadonlySet<string>,
) {
  return (p.lod || (p.layer === "far" && low)) && lods.has(p.asset + "_lod")
    ? p.asset + "_lod"
    : p.asset;
}

export interface AssetStats {
  readonly triangles: number;
  readonly meshes: number;
  readonly nodes: readonly string[];
  readonly bounds: readonly number[];
}

/** Bytes of one sign canvas with mipmaps (see signage.ts canvasSize). */
export type SignBytes = (asset: string, node: string) => number;

export interface WorldBudget {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textureBytes: number;
  readonly pieces: number;
}

/** Hard caps the test suite enforces. Low is the school-Chromebook tier. */
export const BUDGET_CAPS = {
  high: { drawCalls: 48, triangles: 90_000, textureBytes: 4_000_000 },
  low: { drawCalls: 16, triangles: 20_000, textureBytes: 1_500_000 },
} as const;

/** Extra draw calls a running activity adds (sparks, lamp beam, scan fan). */
export const ACTIVITY_DRAWS: Partial<Record<Activity, number>> = {
  beacon: 1,
  repair: 1,
  toll: 1,
};

/**
 * Static budget for one sector on one tier, from the Blender manifest. This
 * mirrors what SectorWorld builds: one InstancedMesh per mesh per placement,
 * one per sign, near silhouettes without their lights.
 */
export function estimateBudget(
  layout: SectorLayout,
  low: boolean,
  manifest: Readonly<Record<string, AssetStats>>,
  signBytes: SignBytes,
): WorldBudget {
  const lods = new Set(Object.keys(manifest));
  let drawCalls = 0, triangles = 0, textureBytes = 0;
  const seenSigns = new Set<string>();
  const pieces = piecesFor(layout, low);
  for (const p of pieces) {
    const id = assetFor(p, low, lods);
    const a = manifest[id];
    const n = instancesOf(p).length;
    const litNodes = a.nodes.filter((name) => name.endsWith("_lit_emit"));
    const signs = p.layer === "near"
      ? []
      : a.nodes.filter((name) =>
        name.startsWith("sign__") || name.startsWith("paint__")
      );
    drawCalls += a.meshes - (p.layer === "near" ? litNodes.length : 0) +
      signs.length;
    drawCalls += p.activity && p.layer !== "near"
      ? ACTIVITY_DRAWS[p.activity] ?? 0
      : 0;
    triangles += a.triangles * n + signs.length * 2 * n;
    for (const sign of signs) {
      if (seenSigns.has(sign)) continue;
      seenSigns.add(sign);
      textureBytes += signBytes(id, sign);
    }
  }
  return { drawCalls, triangles, textureBytes, pieces: pieces.length };
}
