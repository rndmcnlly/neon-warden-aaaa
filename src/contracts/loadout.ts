/**
 * The hangar: what the Pilot bolts onto the ship before a contract. A loadout
 * is one weapon package, one sensor package, and a set of cosmetic choices.
 *
 * Packages change play, so their numbers live here as data: the sim reads
 * them, and the hangar UI shows them as stat bars without duplicating any
 * tuning. Cosmetics are pure expression: the sim carries them through
 * untouched (so a replay remembers what the ship looked like) and never
 * reads them.
 *
 * Packages with `inSlice: false` are the honest walls of the vertical slice:
 * the hangar lists them, locked, under "not included in this vertical slice".
 * The sim treats an out-of-slice package like `standard` so a stale save can
 * never crash a run.
 */

/** Weapon packages: how the one fire verb (tap, hold, rest) is tuned. */
export type WeaponPackageId =
  | "standard"
  | "magistrate"
  | "courier"
  | "notary"
  | "injunction";

/** Sensor packages: the shape and patience of the scanning beam. */
export type SensorPackageId =
  | "standard"
  | "surveyor"
  | "auditor"
  | "archivist"
  | "witness";

export interface WeaponStats {
  /** Ticks between stream volleys while Fire is held (lower is faster). */
  readonly streamInterval: number;
  /** Damage of the press-edge aimed round. */
  readonly aimedDamage: number;
  /** Ticks before another aimed round can fire. */
  readonly aimedCooldown: number;
  /** Idle ticks to reach Writ charge levels 1, 2 and 3. */
  readonly chargeTicks: readonly [number, number, number];
  /** Writ damage at levels 1, 2 and 3 (to hulls; parts always break). */
  readonly writDamage: readonly [number, number, number];
  /** Writ collision radius at levels 1, 2 and 3. */
  readonly writRadius: readonly [number, number, number];
}

export interface SensorStats {
  /** Half-angle of the scanning cone, radians, centered straight ahead. */
  readonly coneHalfAngle: number;
  /** How far ahead the beam reaches, sim units. */
  readonly range: number;
  /** Ticks of continuous dwell to lock one target. */
  readonly lockTicks: number;
}

export interface WeaponPackage {
  readonly id: WeaponPackageId;
  /** False: shown in the hangar, locked, as content beyond the slice. */
  readonly inSlice: boolean;
  readonly stats: WeaponStats;
}

export interface SensorPackage {
  readonly id: SensorPackageId;
  readonly inSlice: boolean;
  readonly stats: SensorStats;
}

const STANDARD_WEAPON: WeaponStats = Object.freeze({
  streamInterval: 7,
  aimedDamage: 3,
  aimedCooldown: 14,
  chargeTicks: Object.freeze([40, 80, 120] as const),
  writDamage: Object.freeze([6, 12, 24] as const),
  writRadius: Object.freeze([8, 10, 14] as const),
});

/**
 * Weapon packages. Text ids for the hangar follow
 * `hangar.weapon.<id>.name` and `hangar.weapon.<id>.blurb`.
 */
export const WEAPON_PACKAGES: Readonly<
  Record<WeaponPackageId, WeaponPackage>
> = Object.freeze({
  /** Lane Authority standard issue: the research tuning table. */
  standard: { id: "standard", inSlice: true, stats: STANDARD_WEAPON },
  /** Heavy Writ: slower to charge and stream, hits like a court order. */
  magistrate: {
    id: "magistrate",
    inSlice: true,
    stats: {
      ...STANDARD_WEAPON,
      streamInterval: 9,
      chargeTicks: [50, 100, 150],
      writDamage: [10, 20, 40],
      writRadius: [10, 13, 18],
    },
  },
  /** Rapid stream: a fast hose with a thin Writ. */
  courier: {
    id: "courier",
    inSlice: true,
    stats: {
      ...STANDARD_WEAPON,
      streamInterval: 5,
      chargeTicks: [40, 80, 120],
      writDamage: [4, 7, 14],
    },
  },
  /** Precision taps: harder, quicker aimed rounds for part work. */
  notary: {
    id: "notary",
    inSlice: true,
    stats: {
      ...STANDARD_WEAPON,
      streamInterval: 8,
      aimedDamage: 5,
      aimedCooldown: 9,
    },
  },
  /** Beyond the slice. */
  injunction: { id: "injunction", inSlice: false, stats: STANDARD_WEAPON },
});

const STANDARD_SENSOR: SensorStats = Object.freeze({
  coneHalfAngle: 0.35,
  range: 380,
  lockTicks: 45,
});

/**
 * Sensor packages. Text ids follow `hangar.sensor.<id>.name` and
 * `hangar.sensor.<id>.blurb`.
 */
export const SENSOR_PACKAGES: Readonly<
  Record<SensorPackageId, SensorPackage>
> = Object.freeze({
  standard: { id: "standard", inSlice: true, stats: STANDARD_SENSOR },
  /** Wide cone, patient lock: sees everything, commits slowly. */
  surveyor: {
    id: "surveyor",
    inSlice: true,
    stats: { coneHalfAngle: 0.62, range: 340, lockTicks: 70 },
  },
  /** Narrow cone, fast lock: a sniper's sensor. */
  auditor: {
    id: "auditor",
    inSlice: true,
    stats: { coneHalfAngle: 0.2, range: 420, lockTicks: 22 },
  },
  /** Long reach: locks the Warden from the bottom of the lane. */
  archivist: {
    id: "archivist",
    inSlice: true,
    stats: { coneHalfAngle: 0.3, range: 600, lockTicks: 55 },
  },
  /** Beyond the slice. */
  witness: { id: "witness", inSlice: false, stats: STANDARD_SENSOR },
});

export type PaintId =
  | "authorityWhite"
  | "contractorGrey"
  | "matteBlack"
  | "rustRed"
  | "laneBlue";
export type DecalId =
  | "none"
  | "authorityNumber"
  | "tallyMarks"
  | "wardenCrest"
  | "payGrade";
export type TrailId = "standard" | "ion" | "ember" | "ghost";
/** The helmet is corporate issue early and worn by the end (AGENTS.md). */
export type HelmetLiveryId = "corporateIssue" | "worn" | "repainted";

/** Ignored by the sim; read by the renderer and the hangar. */
export interface Cosmetics {
  readonly paint: PaintId;
  /** Trim emissive color, `#rrggbb`. */
  readonly trimColor: string;
  readonly decal: DecalId;
  readonly trail: TrailId;
  readonly helmetLivery: HelmetLiveryId;
}

export interface Loadout {
  readonly weapon: WeaponPackageId;
  readonly sensor: SensorPackageId;
  readonly cosmetics: Cosmetics;
}

export const DEFAULT_LOADOUT: Loadout = Object.freeze({
  weapon: "standard",
  sensor: "standard",
  cosmetics: Object.freeze({
    paint: "authorityWhite",
    trimColor: "#35e0ff",
    decal: "authorityNumber",
    trail: "standard",
    helmetLivery: "corporateIssue",
  }),
});

/** The stats a run actually uses (out-of-slice packages fall back). */
export function weaponStats(id: WeaponPackageId): WeaponStats {
  const pack = WEAPON_PACKAGES[id] ?? WEAPON_PACKAGES.standard;
  return pack.inSlice ? pack.stats : WEAPON_PACKAGES.standard.stats;
}

export function sensorStats(id: SensorPackageId): SensorStats {
  const pack = SENSOR_PACKAGES[id] ?? SENSOR_PACKAGES.standard;
  return pack.inSlice ? pack.stats : SENSOR_PACKAGES.standard.stats;
}
