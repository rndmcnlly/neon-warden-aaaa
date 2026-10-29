/**
 * Every gameplay number in one place, so a designer (or a student) can tune
 * the game without reading the update loop. Values come from
 * `reference/e4-starter/src/` unless a comment says otherwise. Units: sim
 * units (the original's pixels) and ticks (1/60 s).
 */

import type { Difficulty, EnemyKind } from "../contracts/index.ts";

export const PLAYER = Object.freeze({
  startX: 240,
  startY: 560,
  speed: 4.2,
  /** Not in the original: a slow, precise mode for the remake's focus button. */
  focusSpeed: 2.0,
  /** Tiny on purpose, inside a 48-unit ship. */
  radius: 6,
  /** Movement clamp: keeps the ship inside the visible playfield. */
  minX: 18,
  maxX: 480 - 18,
  minY: 60,
  maxY: 640 - 24,
  fireInterval: 7,
  shotSpeed: 11,
  shotRadius: 6,
  /** Horizontal shot speeds per cannon level 1–3. */
  spreads: [[0], [-0.8, 0.8], [-1.6, 0, 1.6]] as const,
  /** Spacing between parallel shots at the muzzle. */
  shotSpacing: 9,
  maxPower: 3,
  bankPerInput: 0.18,
  /** Damage a ram deals to a (non-boss) enemy each tick of contact. */
  ramDamage: 3,
});

export interface EnemyStats {
  readonly hp: number;
  readonly score: number;
  readonly radius: number;
  /** Chance of a pickup when the player destroys it. */
  readonly dropChance: number;
}

export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = Object
  .freeze({
    drone: { hp: 2, score: 100, radius: 13, dropChance: 0.015 },
    dart: { hp: 1, score: 150, radius: 12, dropChance: 0.015 },
    turret: { hp: 12, score: 400, radius: 19, dropChance: 0.3 },
    lancer: { hp: 4, score: 250, radius: 15, dropChance: 0.06 },
  });

export const BULLET_RADIUS = Object.freeze({ bullet: 5, heavy: 8 });

export const PICKUP = Object.freeze({ radius: 14, fallSpeed: 1.1 });

export const BOSS = Object.freeze({
  hp: 900,
  score: 10_000,
  radius: 46,
  spawnY: -90,
  descentSpeed: 1.4,
  /** Ticks of invulnerable descent: the Warden's speech. */
  descentTicks: 150,
  swayAmplitude: 140,
  swayRate: 0.008,
  swayRatePhase3: 0.012,
  /** Ticks between the bossWarning siren and the Warden's arrival. */
  warningTicks: 200,
  /** Ticks of finale after the decisive moment, before the run ends. */
  outroTicks: 180,
  /** How fast the surviving Warden withdraws off the top of the screen. */
  withdrawSpeed: 2.5,
});

/**
 * The pacifist Warden fight: instead of losing HP, the Warden runs its full
 * pattern sequence on a clock, one block per phase, and the run ends in
 * `bossSurvived` when the last block finishes. Thirty seconds after the
 * descent: long enough to see every attack, short enough to stay a set piece.
 */
export const SURVIVAL_PHASE_TICKS = Object.freeze([600, 600, 600] as const);
export const SURVIVAL_TOTAL_TICKS = SURVIVAL_PHASE_TICKS.reduce(
  (sum, ticks) => sum + ticks,
  0,
);

/**
 * Difficulty only scales numbers; it never changes how many random draws
 * happen, so the same seed lays out the same waves on every difficulty.
 */
export interface DifficultyTuning {
  readonly lives: number;
  /** Continues offered after the last life; `Infinity` means unlimited. */
  readonly continues: number;
  /** Multiplier on every enemy bullet speed. */
  readonly bulletSpeed: number;
  /** A drone's chance to fire at each opportunity (original: 0.35). */
  readonly droneFireChance: number;
  /** Post-hit invulnerability in ticks (original: 120). */
  readonly graceTicks: number;
  /** Whether darts use their restored dive shot (see RESTORED_CUT_CONTENT). */
  readonly dartsArmed: boolean;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyTuning>> = Object
  .freeze({
    story: {
      lives: 5,
      continues: Infinity,
      bulletSpeed: 0.8,
      droneFireChance: 0.25,
      graceTicks: 180,
      dartsArmed: false,
    },
    normal: {
      lives: 3,
      continues: 3,
      bulletSpeed: 1,
      droneFireChance: 0.35,
      graceTicks: 120,
      dartsArmed: true,
    },
    hard: {
      lives: 3,
      continues: 1,
      bulletSpeed: 1.15,
      droneFireChance: 0.45,
      graceTicks: 100,
      dartsArmed: true,
    },
  });

/**
 * Not in the original: if no powerup has appeared by this many ticks into
 * sector 3, a salvage cache drifts down. It makes the flashback (which keys
 * off the first powerup) reliable, and it is the only way a pacifist run,
 * which destroys nothing and so earns no drops, ever reaches the flashback.
 */
export const SALVAGE_CACHE = Object.freeze({
  sector: 3,
  atSectorTick: 30,
  x: 240,
  y: -30,
});

/**
 * For the narrative team: messes in the starter that this port resolves in
 * favor of what the code was evidently trying to do. Each is fair game for
 * "restored cut content" copy.
 */
export const RESTORED_CUT_CONTENT = Object.freeze([
  "Darts shoot again: the starter's dart gun (one aimed shot at the moment it commits to its dive) was commented out under a comment saying darts fire as they dive. Restored on normal and hard.",
  "The victory lap is protected: a `bossDefeted` typo meant the ship stayed hittable after the Warden fell. The ship is now untouchable during every ending outro.",
  "`summon(kind)` honors its kind: the starter ignored it and always made drones. The Warden still only calls drones, but the arena could call anything.",
  'Turret and lancer counts follow the code, not the comments ("pair of turrets" spawns three; "six lancers" spawns four). The wave tables say what actually flies.',
  "The salvage cache in sector 3 is new, not restored: it guarantees the first powerup (and the flashback) even in a run that earns no drops.",
]);
