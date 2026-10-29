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
import type { Loadout } from "./loadout.ts";
import type { Tick } from "./time.ts";

/** Playfield size in sim units (the original's pixels). */
export const PLAYFIELD = Object.freeze({ width: 480, height: 640 });

/** Stable per-entity id, unique within one run, so renderers can pool meshes. */
export type EntityId = number;

/** The six route stops: five sectors, then the Warden. */
export type SectorIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type EnemyKind = "drone" | "dart" | "turret" | "lancer";
/**
 * `recorder` is not a powerup: it is #0121's derelict flight recorder, the
 * sector 3 salvage cache. Collecting it grants nothing mechanical, but it
 * counts as the run's first powerup if nothing came before (the flashback
 * trigger) and its `intel` event unlocks `codex.recorder.0121`.
 */
export type PickupKind = "spread" | "shield" | "recorder";
/** `shot` is the player's; `bullet` and `heavy` are enemy fire. */
export type BulletKind = "shot" | "bullet" | "heavy";

/**
 * The one fire verb, three expressions. `aimed`: the press edge fires one
 * aimed round (breaks parts). `stream`: holding past the tap threshold.
 * `writ`: the press edge after a rest, spending the charge (pierces, breaks
 * parts; on a locked weak point it is a kill shot).
 */
export type ShotKind = "aimed" | "stream" | "writ";

/** What the trigger is doing this tick; `rest` charges and scans. */
export type TriggerState = "rest" | "tap" | "stream";

/** Writ charge: 0 is empty, 3 is full. */
export type ChargeLevel = 0 | 1 | 2 | 3;

/**
 * Named states of the enemy AI. Each kind runs an explicit state machine
 * (see `src/sim/enemies.ts`) and these names are its real states, so scan
 * intel never lies.
 *
 * - drone: `patrol` (weave), `aim` (tracking before a shot), `fire`,
 *   `evade` (after being hit, slides away from the ship).
 * - dart: `drift`, `aim` (choosing a dive side), `dive` (fires once on entry).
 * - turret: `descend`, `aim`, `fire` (burst), `reload`, `withdraw`.
 * - lancer: `strafe`, `aim`, `fire`.
 * - any: `idle` (a passive practice target), `retreat` (disarmed or
 *   following the Warden out: holds fire and leaves).
 */
export type EnemyAiState =
  | "idle"
  | "patrol"
  | "aim"
  | "fire"
  | "evade"
  | "drift"
  | "dive"
  | "descend"
  | "reload"
  | "withdraw"
  | "strafe"
  | "retreat";

/**
 * The Warden's named states. `descend` and `parley` are invulnerable;
 * `sweep` is moving between volleys; `fan`, `cannon`, `summon` and `spiral`
 * are its four attacks (each owned by a pod, except `summon`); `fallen` and
 * `withdraw` are the two endings.
 */
export type WardenAiState =
  | "descend"
  | "parley"
  | "sweep"
  | "fan"
  | "cannon"
  | "summon"
  | "spiral"
  | "fallen"
  | "withdraw";

/** Every enemy weapon, for `enemyFired` (audio picks a voice per kind). */
export type EnemyWeaponKind =
  | "droneGun"
  | "dartGun"
  | "turretBarrel"
  | "lancerEmitter"
  | "wardenFan"
  | "wardenCannon"
  | "wardenSpiral";

/**
 * Breakable weapon parts. Scouts: `gun` (drone), `nose` (dart), `barrel`
 * (turret), `emitter` (lancer, two). The Warden's four pods: `fanPod` (two,
 * left and right halves of its fan), `cannonPod`, `spiralPod`.
 */
export type PartKind =
  | "gun"
  | "nose"
  | "barrel"
  | "emitter"
  | "fanPod"
  | "cannonPod"
  | "spiralPod";

/** Unique within its owner, such as `"gun"`, `"emitterL"`, `"fanPodR"`. */
export type PartId = string;

export interface PartView {
  readonly id: PartId;
  readonly kind: PartKind;
  /** From the owner's center, in sim units (+y down, toward the player). */
  readonly offset: Vec2;
  readonly radius: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly broken: boolean;
}

/** Where a locked Writ kills outright (scouts) or the open core (Warden). */
export interface WeakPointView {
  readonly offset: Vec2;
  readonly radius: number;
}

/** The scanning beam, live while the trigger rests. */
export interface ScanView {
  readonly active: boolean;
  /** Cone half-angle (radians) and reach, from the loadout's sensor. */
  readonly halfAngle: number;
  readonly range: number;
  /** The one target the beam is painting this tick, if any. */
  readonly targetId: EntityId | null;
}

/** The Contract Rate economy (research: gameplay micro-systems, D). */
export interface PayView {
  /** Credits earned this contract. */
  readonly credits: number;
  /** Multiplier on every payout, 1.0–8.0. */
  readonly rate: number;
  /** Ticks left before the rate starts to decay. */
  readonly chainTicks: number;
  /** Full chain length, for drawing the drain bar. */
  readonly chainMax: number;
}

/** Near misses ("Clearance"). */
export interface GrazeView {
  /** 0–1; a full meter pays a clearance bonus and empties. */
  readonly meter: number;
  /** Grazes this run (heavy bullets count two). */
  readonly count: number;
  /** Center-to-center distance that counts as a graze, for the focus ring. */
  readonly radius: number;
}

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
  /** Movement during the last tick (doppler, trails). */
  readonly vel: Vec2;
  readonly trigger: TriggerState;
  readonly chargeLevel: ChargeLevel;
  /** 0–1 progress toward a full (level 3) charge, for the pip ring. */
  readonly charge: number;
  readonly scan: ScanView;
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
  /** The AI's current state: truthful, but only show it as intel once locked. */
  readonly ai: EnemyAiState;
  /** Ticks spent in the current AI state. */
  readonly aiTicks: Tick;
  readonly parts: readonly PartView[];
  readonly weakPoint: WeakPointView;
  /** Scan dwell, 0–1; 1 means locked. */
  readonly lock: number;
  readonly locked: boolean;
  /** Every weapon part broken: holds fire and leaves, spared. */
  readonly disarmed: boolean;
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
  readonly ai: WardenAiState;
  /** The four weapon pods; each strips its part of the pattern when broken. */
  readonly pods: readonly PartView[];
  /** Two pods broken: core hits deal double, and a locked Writ, more. */
  readonly coreOpen: boolean;
  readonly weakPoint: WeakPointView;
  readonly lock: number;
  readonly locked: boolean;
}

/** Run-wide facts the Director branches on. */
export interface SimFlags {
  /**
   * No enemy destroyed by the player this run (shots or rams), and the
   * Warden's core never struck. Disarming (breaking weapon parts, Warden
   * pods included) is allowed.
   */
  readonly pacifistIntact: boolean;
  /** The trigger was never pressed outside the tutorial: the purest run. */
  readonly neverFired: boolean;
  /** #0121's flight recorder was collected. */
  readonly recorderRecovered: boolean;
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
  /** Classic arcade points (unmultiplied); PAY is `pay.credits`. */
  readonly score: number;
  readonly kills: number;
  readonly pay: PayView;
  readonly graze: GrazeView;
  /** Scouts disarmed this run (they leave alive). */
  readonly scoutsSpared: number;
  readonly flags: SimFlags;
  /** Carried through for replays and the renderer; cosmetics are unread. */
  readonly loadout: Loadout;
}

/** Why the pay rate or credits moved. */
export type PayReason =
  | "kill"
  | "cleanKill"
  | "partBreak"
  | "disarm"
  | "graze"
  | "clearance"
  | "scan"
  | "rateBreak"
  | "decay";

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
     * falls, retreating with it in the pacifist ending, or a disarmed scout
     * leaving the screen (`spared`). Never scores.
     */
    readonly type: "despawn";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly reason: "wiped" | "retreat" | "spared";
  }
  | {
    readonly type: "playerFired";
    readonly tick: Tick;
    /** Rounds in this volley (stream spreads fire several). */
    readonly shots: number;
    readonly shot: ShotKind;
    /** Writ charge spent (1–3); 0 for aimed and stream. */
    readonly level: ChargeLevel;
    readonly pos: Vec2;
  }
  | {
    /** The Writ charge crossed a level (up while resting, 0 when spent). */
    readonly type: "chargeLevel";
    readonly tick: Tick;
    readonly level: ChargeLevel;
  }
  | {
    /** One enemy volley: positional audio for enemy weapons. */
    readonly type: "enemyFired";
    readonly tick: Tick;
    /** The scout's or the Warden's id. */
    readonly id: EntityId;
    readonly weapon: EnemyWeaponKind;
    readonly pos: Vec2;
    readonly bullets: number;
  }
  | {
    /**
     * An enemy bullet at its closest approach, within `NEAR_MISS_RADIUS`,
     * that did not hit: for whooshes. Once per bullet.
     */
    readonly type: "nearMiss";
    readonly tick: Tick;
    readonly bulletId: EntityId;
    readonly pos: Vec2;
    /** Bullet velocity minus ship velocity, units per tick. */
    readonly relVel: Vec2;
    /** Closest center-to-center distance. */
    readonly distance: number;
    readonly heavy: boolean;
  }
  | {
    /** A bullet came inside the graze radius without hitting. Once each. */
    readonly type: "graze";
    readonly tick: Tick;
    readonly bulletId: EntityId;
    readonly pos: Vec2;
    /** 1, or 2 for heavy bullets. */
    readonly count: number;
    /** The meter after this graze, 0–1. */
    readonly meter: number;
    /** The run's first graze (tutorials and barks key off it). */
    readonly first: boolean;
  }
  | {
    readonly type: "partBreak";
    readonly tick: Tick;
    /** The owner (a scout or the Warden). */
    readonly id: EntityId;
    readonly target: "enemy" | "boss";
    readonly part: PartId;
    readonly partKind: PartKind;
    readonly pos: Vec2;
    readonly by: ShotKind;
    /** The run's first part break of this target class. */
    readonly first: boolean;
  }
  | {
    /** A scout lost its last weapon part: it stops firing and leaves. */
    readonly type: "disarm";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly kind: EnemyKind;
    readonly pos: Vec2;
    /** Its live bullets cancelled with it. */
    readonly cancelled: number;
    /** The run's first disarm. */
    readonly first: boolean;
  }
  | {
    /** Two Warden pods are broken: the core is open. */
    readonly type: "coreExposed";
    readonly tick: Tick;
    readonly id: EntityId;
  }
  | {
    readonly type: "scanLock";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly target: "enemy" | "boss";
    readonly kind: EnemyKind | "warden";
    readonly pos: Vec2;
    /** The target's AI state at the moment of lock: the intel. */
    readonly ai: EnemyAiState | WardenAiState;
    /** The run's first lock. */
    readonly first: boolean;
  }
  | {
    /**
     * Intel learned, from a scan lock or the flight recorder. `codexId`
     * names a codex entry to unlock; `first` is true the first time this
     * run (UI toasts only those).
     */
    readonly type: "intel";
    readonly tick: Tick;
    readonly id: EntityId;
    readonly codexId: string;
    readonly ai: EnemyAiState | WardenAiState | null;
    readonly first: boolean;
  }
  | {
    readonly type: "payChanged";
    readonly tick: Tick;
    readonly credits: number;
    readonly rate: number;
    /** Credits added by this event (0 for rate-only changes). */
    readonly delta: number;
    readonly reason: PayReason;
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
    /** A locked Writ on the weak point: the clean kill. */
    readonly clean: boolean;
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
  /** Weapon, sensor and cosmetics; defaults to `DEFAULT_LOADOUT`. */
  readonly loadout?: Loadout;
  /**
   * Attract mode: on the last life, silently spend a continue and keep
   * flying. Off for human play, where the UI offers `continueRun()` after
   * the `gameOver` event.
   */
  readonly autoContinue?: boolean;
}

/** Enemy bullets passing this close (center to center) emit `nearMiss`. */
export const NEAR_MISS_RADIUS = 48;

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
   * `tut.spawnTarget` (a passive practice drone appears), `tut.spawnTurret`
   * (a passive practice turret with one barrel part) and `tut.grazeDrill`
   * (slow practice rounds fall just beside the ship). Unknown names are
   * ignored, so timelines can add flags without touching the sim.
   */
  setStoryFlag(name: string, value: boolean): void;
}
