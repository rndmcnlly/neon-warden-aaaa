/**
 * The deterministic simulation's public surface. Renderers, UI, audio and the
 * Director read `SimState` and react to `SimEvent`s; only the sim writes
 * state. Nothing in here mentions three.js or the DOM, and nothing in
 * `src/sim/` may import them.
 *
 * Units follow the original game so the port stays checkable against
 * `reference/e4-starter/`: a 480 x 640 playfield, origin top-left, +y down,
 * speeds in units per tick. The renderer maps this plane into 3D.
 */

import type { InputFrame, Vec2 } from "./input.ts";
import type { Tick } from "./time.ts";

/** Playfield size in sim units (the original's pixels). */
export const PLAYFIELD = Object.freeze({ width: 480, height: 640 });

/** Stable per-entity id, unique within one run, so renderers can pool meshes. */
export type EntityId = number;

/** The six route stops: five sectors, then the Warden. */
export type SectorIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type EnemyKind = "drone" | "dart" | "turret" | "lancer";
export type PickupKind = "spread" | "shield";
/** `shot` is the player's; `bullet` and `heavy` are enemy fire. */
export type BulletKind = "shot" | "bullet" | "heavy";

/**
 * Where the run is. `tutorial` is the Lane Authority's sandbox; `ended` is
 * terminal, and `SimState.outcome` says how it ended.
 */
export type SimPhase = "tutorial" | "sector" | "bossWarning" | "boss" | "ended";

/** How a run ended. Kill and pacifist endings are different scenes. */
export type SimOutcome = "bossDefeated" | "bossSurvived" | "gameOver";

/** 0 is the invulnerable descent (the Warden's speech); 1–3 are fight phases. */
export type BossPhase = 0 | 1 | 2 | 3;

export type Difficulty = "story" | "normal" | "hard";

export interface PlayerView {
  readonly pos: Vec2;
  /** Collision radius: tiny on purpose, inside a big visible ship. */
  readonly radius: number;
  readonly lives: number;
  /** Cannon level, 1–3. */
  readonly power: number;
  readonly shielded: boolean;
  /** Ticks of post-hit invulnerability left; renderers blink while > 0. */
  readonly graceTicks: number;
  /** Bank angle in radians, for the renderer's roll. */
  readonly bank: number;
}

export interface EnemyView {
  readonly id: EntityId;
  readonly kind: EnemyKind;
  readonly pos: Vec2;
  readonly radius: number;
  readonly hp: number;
  readonly maxHp: number;
  /** Ticks since spawn; drives telegraphs such as the dart's commit flare. */
  readonly age: Tick;
}

export interface BulletView {
  readonly id: EntityId;
  readonly kind: BulletKind;
  readonly pos: Vec2;
  readonly vel: Vec2;
  readonly radius: number;
}

export interface PickupView {
  readonly id: EntityId;
  readonly kind: PickupKind;
  readonly pos: Vec2;
}

export interface BossView {
  readonly id: EntityId;
  readonly pos: Vec2;
  readonly radius: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly phase: BossPhase;
  /** True during the descent, when damage is ignored. */
  readonly invulnerable: boolean;
}

/** Run-wide facts the Director branches on. */
export interface SimFlags {
  /** No enemy has been destroyed by the player this run (shots or rams). */
  readonly pacifistIntact: boolean;
  /** At least one powerup has been collected; the flashback keys off this. */
  readonly firstPowerupTaken: boolean;
}

/**
 * A read-only view of one tick. Treat it as immutable; a snapshot may share
 * structure with the live sim, so copy anything you need to keep.
 */
export interface SimState {
  readonly tick: Tick;
  readonly seed: number;
  readonly phase: SimPhase;
  readonly outcome: SimOutcome | null;
  readonly sector: SectorIndex;
  readonly player: PlayerView;
  readonly enemies: readonly EnemyView[];
  readonly bullets: readonly BulletView[];
  readonly pickups: readonly PickupView[];
  /** Present only once the Warden has spawned. */
  readonly boss: BossView | null;
  readonly score: number;
  readonly kills: number;
  readonly flags: SimFlags;
}

/**
 * Things that happened during one `step`. Audio, VFX, achievements and the
 * Director listen to these instead of diffing state. Every event carries the
 * tick it happened on.
 */
export type SimEvent =
  | {
    readonly type: "sectorStarted";
    readonly tick: Tick;
    readonly sector: SectorIndex;
  }
  | {
    readonly type: "sectorCleared";
    readonly tick: Tick;
    readonly sector: SectorIndex;
  }
  | {
    readonly type: "spawn";
    readonly tick: Tick;
    readonly id: EntityId;
    /** `warden` is the boss arriving (its descent begins this tick). */
    readonly kind: EnemyKind | "warden";
  }
  | {
    /**
     * An enemy left play without being killed: escorts wiped when the Warden
     * falls, or retreating with it in the pacifist ending. Never scores.
     */
    readonly type: "despawn";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly reason: "wiped" | "retreat";
  }
  | {
    readonly type: "playerFired";
    readonly tick: Tick;
    readonly shots: number;
  }
  | {
    readonly type: "hit";
    readonly tick: Tick;
    /** Who took the hit. `player` hits may be absorbed by the shield. */
    readonly target: "player" | "enemy" | "boss";
    readonly id: EntityId;
    readonly absorbedByShield: boolean;
    /**
     * The shot connected but did no damage (the Warden during its descent or
     * while it talks). Renderers show a deflection instead of a wound.
     */
    readonly blocked: boolean;
  }
  | {
    readonly type: "kill";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly kind: EnemyKind;
    readonly score: number;
    /** Destroyed by ramming rather than by shots. Still breaks pacifism. */
    readonly byRam: boolean;
  }
  | {
    readonly type: "lifeLost";
    readonly tick: Tick;
    readonly livesLeft: number;
  }
  | {
    readonly type: "pickup";
    readonly tick: Tick;
    readonly kind: PickupKind;
    /** True only for the run's first powerup: the flashback trigger. */
    readonly firstPowerup: boolean;
  }
  | { readonly type: "bossWarning"; readonly tick: Tick }
  | {
    readonly type: "bossPhase";
    readonly tick: Tick;
    readonly phase: BossPhase;
  }
  | { readonly type: "bossDefeated"; readonly tick: Tick }
  | { readonly type: "bossSurvived"; readonly tick: Tick }
  | { readonly type: "gameOver"; readonly tick: Tick };

export type SimEventType = SimEvent["type"];

/** Where a run begins; skip-to flags map onto these. */
export type SimStart =
  | { readonly kind: "tutorial" }
  | { readonly kind: "sector"; readonly sector: SectorIndex };

export interface SimOptions {
  /** Seeds every gameplay random draw. Same seed + same inputs = same run. */
  readonly seed: number;
  readonly start: SimStart;
  readonly difficulty: Difficulty;
  /** Spawns played in addition to (or, in the tutorial, instead of) waves. */
  readonly scriptedSpawns?: readonly ScriptedSpawn[];
  /**
   * Attract mode: on the last life, silently spend a continue and keep
   * flying. Off for human play, where the UI offers `continueRun()` after
   * the `gameOver` event.
   */
  readonly autoContinue?: boolean;
}

/** A spawn a timeline asks for, at an absolute sim tick. */
export interface ScriptedSpawn {
  readonly at: Tick;
  readonly kind: EnemyKind | PickupKind;
  readonly x: number;
  readonly y?: number;
  /** Enemies only: never fires (a practice target). */
  readonly passive?: boolean;
}

/**
 * The deterministic core. It has no clock: callers decide how many ticks to
 * run per frame (zero while a scene freezes the world, many during fast
 * auto-play).
 */
export interface Sim {
  /** Advances exactly one tick and returns what happened during it. */
  step(input: InputFrame): readonly SimEvent[];
  /** The state after the most recent step. */
  snapshot(): SimState;
  /** Freezes the world (the flashback): `step()` does nothing until resumed. */
  freeze(): void;
  resume(): void;
  /** After a `gameOver`, spends a continue if one is left. */
  continueRun(): boolean;
  /**
   * Leaves the tutorial (or skips ahead) into a sector. Coming from the
   * tutorial it also wipes score, kills and flags: the drills do not count.
   */
  beginSector(sector: SectorIndex): void;
  /**
   * Story flags the sim honors, set by the Director: `boss.parley` (the
   * Warden holds fire and ignores damage while it talks) and
   * `tut.spawnTarget` (a passive practice drone appears). Unknown names are
   * ignored, so timelines can add flags without touching the sim.
   */
  setStoryFlag(name: string, value: boolean): void;
}
