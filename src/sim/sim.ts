/**
 * The deterministic Neon Warden simulation: a port of the gameplay in
 * `reference/e4-starter/src/game.ts` (the `tick()` half of `GameScene`)
 * with rendering, sound and the HUD stripped out, plus the wave 3 core loop
 * (trigger discipline, scanning, parts and disarming, grazing, Contract
 * Rate). One `step()` is one 60 Hz tick; nothing here reads a clock or
 * `Math.random`, so a seed plus an input sequence always replays the same
 * run.
 *
 * Tick order: route and spawns, player (move, trigger), enemies and boss,
 * projectiles and pickups, collisions, grazes, the scan beam, pay, cleanup.
 *
 * Rule for everything under `src/sim/`: import only from `../contracts/` and
 * other sim files. No three.js, no DOM, no clocks, no `Math.random`.
 */

import {
  type BulletKind,
  type ChargeLevel,
  DEFAULT_LOADOUT,
  type EnemyAiState,
  type EnemyKind,
  type EnemyWeaponKind,
  type EntityId,
  type InputFrame,
  type Loadout,
  NEAR_MISS_RADIUS,
  type PartView,
  type PickupKind,
  type PlayerStatsView,
  type ScriptedSpawn,
  type SectorIndex,
  type SensorStats,
  sensorStats,
  type ShotKind,
  type Sim,
  type SimEvent,
  type SimOptions,
  type SimOutcome,
  type SimPhase,
  type SimState,
  type Tick,
  TICK_RATE,
  type Vec2,
  type WardenAiState,
  type WeaponStats,
  weaponStats,
} from "../contracts/index.ts";
import { Rng } from "./rng.ts";
import { sweptCircle } from "./sweep.ts";
import {
  type Arena,
  type Enemy,
  makeEnemy,
  type Part,
  startEvade,
  stepEnemy,
} from "./enemies.ts";
import {
  type Boss,
  bossArrived,
  coreOpen,
  holdForParley,
  makeBoss,
  stepBoss,
  survivalComplete,
} from "./boss.ts";
import { SECTORS, sectorSchedule, type Spawn } from "./waves.ts";
import {
  BOSS,
  BULLET_RADIUS,
  DIFFICULTY,
  type DifficultyTuning,
  GRAZE,
  PAY,
  PICKUP,
  PLAYER,
  SALVAGE_CACHE,
  SCAN_DECAY,
  TRIGGER,
  WARDEN_CORE,
  WRIT_ALIGN_SLACK,
  WRIT_ASSIST_SLACK,
} from "./tuning.ts";
import { Trigger, type Volley } from "./trigger.ts";
import { ContractRate } from "./pay.ts";
import { type Scannable, stepScan } from "./scan.ts";
import { PlayerStats, STATS } from "./stats.ts";
import { initialMovement, stepMovement } from "./movement.ts";

/** Where the tutorial's practice targets appear. */
const PRACTICE_TARGET = Object.freeze({ x: 240, y: 160 });
/**
 * After the player removes the practice target, how long before the sim
 * re-issues one if `tut.spawnTarget` still asks (a lesson that needs it).
 */
const PRACTICE_RESPAWN_TICKS = 90;

/** Run statistics that are not part of `SimState` (for credits and tests). */
export interface RunStats {
  readonly hits: number;
  readonly continuesUsed: number;
  readonly continuesLeft: number;
  /** Player rounds fired, by kind. */
  readonly fired: Readonly<Record<ShotKind, number>>;
  readonly locks: number;
  readonly partsBroken: number;
}

interface Projectile {
  readonly id: EntityId;
  readonly kind: BulletKind;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  alive: boolean;
  /** Enemy bullets: who fired it (0 for drills), so a disarm can cancel it. */
  readonly owner: EntityId;
  /** Player rounds only. */
  readonly shot: ShotKind | null;
  /** Writ charge of a player round (1–3); 0 for everything else. */
  readonly level: ChargeLevel;
  readonly damage: number;
  /** A Writ pierces: it remembers whom it already struck. */
  readonly struck: EntityId[];
  /** Enemy bullets: graze and near-miss bookkeeping. */
  grazed: boolean;
  closest: number;
  nearMissed: boolean;
  /** Player rounds: touched an enemy, a part or the Warden (for accuracy). */
  connected: boolean;
}

interface Pickup {
  readonly id: EntityId;
  readonly kind: PickupKind;
  x: number;
  y: number;
  alive: boolean;
  /** Tutorial pickups do not count as the run's first powerup. */
  readonly practice: boolean;
}

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lives: number;
  power: number;
  shielded: boolean;
  grace: number;
  bank: number;
}

interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function touches(a: Circle, b: Circle): boolean {
  const reach = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < reach * reach;
}

/** The starter's `isOffscreen`: generous above, where enemies enter. */
function offscreen(x: number, y: number, margin = 60): boolean {
  return x < -margin || x > 480 + margin || y < -margin * 3 ||
    y > 640 + margin;
}

/** A part's circle in playfield coordinates. */
function partCircle(owner: Vec2, part: Part): Circle {
  return {
    x: owner.x + part.offset.x,
    y: owner.y + part.offset.y,
    radius: part.spec.radius,
  };
}

function partView(part: Part): PartView {
  return {
    id: part.spec.id,
    kind: part.spec.kind,
    offset: part.offset,
    radius: part.spec.radius,
    hp: part.hp,
    maxHp: part.spec.hp,
    broken: part.broken,
  };
}

export class NeonWardenSim implements Sim {
  private readonly rng: Rng;
  private readonly tuning: DifficultyTuning;
  private readonly autoContinue: boolean;
  private readonly scripted: readonly ScriptedSpawn[];
  private readonly loadout: Loadout;
  private readonly weapon: WeaponStats;
  private readonly sensor: SensorStats;
  private readonly grazeRadius: number;
  private scriptedCursor = 0;

  private tick: Tick = 0;
  private nextId: EntityId = 1;
  private phase: SimPhase;
  private outcome: SimOutcome | null = null;
  /** The phase to return to if a continue revives a game over. */
  private phaseBeforeGameOver: SimPhase = "sector";
  private sector: SectorIndex;
  private sectorStart: Tick = 0;
  private schedule: Spawn[] = [];
  private scheduleCursor = 0;
  private bossDueAt: Tick | null = null;
  /** When the ending outro finishes and the run becomes `ended`. */
  private outroEndsAt: Tick | null = null;
  private lastBossPhase: number | null = null;

  private readonly player: PlayerState;
  private movement = initialMovement();
  private readonly trigger: Trigger;
  private readonly pay: ContractRate;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private shots: Projectile[] = [];
  private bullets: Projectile[] = [];
  private pickups: Pickup[] = [];

  private score = 0;
  private kills = 0;
  private hits = 0;
  private continuesUsed = 0;
  private pacifistIntact = true;
  private neverFired = true;
  private firstPowerupTaken = false;
  private recorderRecovered = false;
  private scoutsSpared = 0;
  private grazeMeter = 0;
  private grazeCount = 0;
  private ticksSinceGraze = 0;
  private scanTarget: EntityId | null = null;
  /** Codex ids and "firsts" already announced this run. */
  private readonly announced = new Set<string>();
  private fired: Record<ShotKind, number> = { aimed: 0, stream: 0, writ: 0 };
  private locks = 0;
  private partsBroken = 0;

  private isFrozen = false;
  /** `boss.parley`: the Warden is talking, so it neither moves nor fires. */
  private parley = false;
  /** Live practice targets, so tutorial flags never stack two. */
  private practiceTarget: EntityId | null = null;
  /** `tut.spawnTarget` is on: keep a practice target in play. */
  private practiceWanted = false;
  private practiceRespawnAt: Tick | null = null;
  private grazeDrillWanted = false;
  private readonly statsTracker = new PlayerStats();
  private practiceTurret: EntityId | null = null;
  private events: SimEvent[] = [];
  /** Enemy bullets fired this tick, grouped into `enemyFired` volleys. */
  private volleys = new Map<
    string,
    { id: EntityId; weapon: EnemyWeaponKind; pos: Vec2; bullets: number }
  >();
  private cachedSnapshot: SimState | null = null;

  constructor(private readonly options: SimOptions) {
    this.movement = initialMovement(options.movement);
    this.rng = new Rng(options.seed);
    this.tuning = DIFFICULTY[options.difficulty];
    this.autoContinue = options.autoContinue ?? false;
    this.scripted = [...(options.scriptedSpawns ?? [])].sort((a, b) =>
      a.at - b.at
    );
    this.loadout = options.loadout ?? DEFAULT_LOADOUT;
    this.weapon = weaponStats(this.loadout.weapon);
    this.sensor = sensorStats(this.loadout.sensor);
    const story = options.difficulty === "story";
    this.grazeRadius = story ? GRAZE.storyRadius : GRAZE.radius;
    this.trigger = new Trigger(this.weapon);
    this.pay = new ContractRate(story ? PAY.storyChainTicks : PAY.chainTicks);
    this.player = {
      x: PLAYER.startX,
      y: PLAYER.startY,
      vx: 0,
      vy: 0,
      lives: this.tuning.lives,
      power: 1,
      shielded: false,
      grace: 0,
      bank: 0,
    };
    if (options.start.kind === "tutorial") {
      this.phase = "tutorial";
      this.sector = 1;
    } else {
      this.phase = "sector";
      this.sector = options.start.sector;
      this.enterSector(options.start.sector);
    }
  }

  // ---------------------------------------------------------------------
  // Controls: freezing, skipping, continues, story flags.

  /** Freezes the world (the flashback): `step()` does nothing until resumed. */
  freeze(): void {
    this.resetMovement();
    this.isFrozen = true;
  }

  resetMovement(): void {
    this.movement = {
      ...initialMovement(this.movement.profile),
      focused: this.movement.focused,
    };
    this.player.vx = this.player.vy = this.player.bank = 0;
    this.cachedSnapshot = null;
  }

  resume(): void {
    this.isFrozen = false;
  }

  get frozen(): boolean {
    return this.isFrozen;
  }

  setStoryFlag(name: string, value: boolean): void {
    if (name === "boss.parley") {
      this.parley = value;
      return;
    }
    if (this.phase !== "tutorial") return;
    if (name === "tut.spawnTarget") {
      this.practiceWanted = value;
      this.practiceRespawnAt = null;
      if (value) this.issuePracticeTarget();
      return;
    }
    if (name === "tut.grazeDrill") {
      this.grazeDrillWanted = value;
      if (value) this.grazeDrill();
      return;
    }
    if (!value) return;
    if (name === "tut.spawnTurret" && !this.isAlive(this.practiceTurret)) {
      this.practiceTurret = this.spawnEnemy("turret", PRACTICE_TARGET.x, -30, {
        passive: true,
      });
    }
  }

  /**
   * Six slow practice rounds fall just beside the ship, alternating sides:
   * close enough to graze, far enough to miss a ship that holds still.
   */
  private grazeDrill(): void {
    const p = this.player;
    for (let k = 0; k < 6; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      this.spawnBullet(0, p.x + side * 17, p.y - 240 - k * 70, 0, 2.2, false);
    }
    this.cachedSnapshot = null;
  }

  private isAlive(id: EntityId | null): boolean {
    return this.enemies.some((e) => e.alive && e.id === id);
  }

  /** Puts the practice hologram in play unless one already is. */
  private issuePracticeTarget(): EntityId | null {
    if (this.isAlive(this.practiceTarget)) return null;
    this.practiceTarget = this.spawnEnemy(
      "drone",
      PRACTICE_TARGET.x,
      PRACTICE_TARGET.y,
      { passive: true },
    );
    return this.practiceTarget;
  }

  /**
   * The practice target left play. Whatever the player did to it counts;
   * an escape is re-issued at once, a player removal after a beat (and only
   * if the flag still asks, which a finished lesson will have cleared).
   */
  private resolvePractice(
    result: "destroyed" | "disarmed" | "escaped",
  ): void {
    const id = this.practiceTarget;
    if (id === null) return;
    this.practiceTarget = null;
    let respawned: EntityId | null = null;
    if (this.practiceWanted) {
      if (result === "escaped") respawned = this.issuePracticeTarget();
      else this.practiceRespawnAt = this.tick + PRACTICE_RESPAWN_TICKS;
    }
    this.events.push({
      type: "practiceTarget",
      tick: this.tick,
      id,
      result,
      respawned,
    });
  }

  /**
   * Leaves the tutorial (or skips ahead) into a sector. Clears the field;
   * coming from the tutorial it also wipes score, pay, kills and flags,
   * because the Lane Authority's drills are simulations and do not count.
   */
  beginSector(sector: SectorIndex): void {
    this.resetMovement();
    if (this.phase === "tutorial") {
      this.score = 0;
      this.kills = 0;
      this.pacifistIntact = true;
      this.neverFired = true;
      this.firstPowerupTaken = false;
      this.recorderRecovered = false;
      this.scoutsSpared = 0;
      this.grazeMeter = 0;
      this.grazeCount = 0;
      this.pay.reset();
      this.trigger.reset();
      this.fired = { aimed: 0, stream: 0, writ: 0 };
      this.statsTracker.reset();
      this.practiceWanted = false;
      this.practiceRespawnAt = null;
      this.grazeDrillWanted = false;
      this.player.power = 1;
      this.player.shielded = false;
    }
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.pickups = [];
    this.boss = null;
    this.phase = "sector";
    this.enterSector(sector);
    this.cachedSnapshot = null;
  }

  /** Spawns one enemy now (tutorial targets, debug). Returns its id. */
  spawnEnemy(
    kind: EnemyKind,
    x: number,
    y = -30,
    options: { side?: 1 | -1; passive?: boolean } = {},
  ): EntityId {
    const enemy = makeEnemy(
      this.nextId++,
      kind,
      x,
      y,
      options.side ?? (x < 240 ? 1 : -1),
      options.passive ?? false,
    );
    this.enemies.push(enemy);
    this.events.push({ type: "spawn", tick: this.tick, id: enemy.id, kind });
    this.cachedSnapshot = null;
    return enemy.id;
  }

  /** Drops one pickup now. Returns its id. */
  spawnPickup(kind: PickupKind, x: number, y = -30): EntityId {
    const id = this.nextId++;
    this.pickups.push({
      id,
      kind,
      x,
      y,
      alive: true,
      practice: this.phase === "tutorial",
    });
    this.cachedSnapshot = null;
    return id;
  }

  /** After a `gameOver`, spends a continue if one is left. */
  continueRun(): boolean {
    if (this.outcome !== "gameOver") return false;
    if (this.continuesLeft() <= 0) return false;
    this.continuesUsed++;
    this.outcome = null;
    this.phase = this.phaseBeforeGameOver;
    this.player.lives = this.tuning.lives;
    this.player.grace = this.tuning.graceTicks;
    this.cachedSnapshot = null;
    return true;
  }

  stats(): RunStats {
    return {
      hits: this.hits,
      continuesUsed: this.continuesUsed,
      continuesLeft: this.continuesLeft(),
      fired: { ...this.fired },
      locks: this.locks,
      partsBroken: this.partsBroken,
    };
  }

  private continuesLeft(): number {
    return this.tuning.continues - this.continuesUsed;
  }

  // ---------------------------------------------------------------------
  // The Sim contract.

  step(input: InputFrame): readonly SimEvent[] {
    if (this.isFrozen || this.phase === "ended") {
      // Events queued by controls (spawnEnemy) still go out.
      return this.flushEvents();
    }
    this.tick++;
    this.cachedSnapshot = null;

    this.advanceRoute();
    this.spawnScheduled();
    if (
      this.practiceRespawnAt !== null && this.tick >= this.practiceRespawnAt
    ) {
      this.practiceRespawnAt = null;
      if (this.practiceWanted) this.issuePracticeTarget();
    }
    this.flyPlayer(input);

    const arena = this.arena();
    const survivalOpen = this.pacifistIntact;
    for (const enemy of this.enemies) stepEnemy(enemy, arena);
    // While it talks the Warden holds still, so the survival clock (which
    // counts its age) also waits: a speech never costs a pacifist time.
    if (this.boss && this.parley) holdForParley(this.boss);
    else if (this.boss) {
      stepBoss(this.boss, arena, survivalOpen);
      this.reportBossPhase();
    }
    this.flushVolleys();
    for (const shot of this.shots) {
      shot.x += shot.vx;
      shot.y += shot.vy;
    }
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
    }
    for (const pickup of this.pickups) pickup.y += PICKUP.fallSpeed;

    this.resolveHits();
    this.checkGrazes();
    this.sweepScan(input.fire);
    const decay = this.pay.step(this.tick);
    if (decay) this.events.push(decay);
    this.checkSurvival(survivalOpen);
    this.cull();
    // A missed practice volley must not permanently stall the lesson.
    if (
      this.grazeDrillWanted &&
      !this.bullets.some((bullet) => bullet.owner === 0)
    ) this.grazeDrill();
    this.updateStats(input);
    return this.flushEvents();
  }

  playerStats(): PlayerStatsView {
    return this.statsTracker.view();
  }

  /** Feeds this tick's events to the stats tracker; adds any moment. */
  private updateStats(input: InputFrame): void {
    for (const event of this.events) this.statsTracker.note(event);
    const boss = this.boss;
    this.events.push(...this.statsTracker.step({
      tick: this.tick,
      gameplay: this.phase === "sector" && this.outcome === null,
      firing: input.fire,
      moving: input.move.x !== 0 || input.move.y !== 0,
      fullCharge: this.trigger.level === 3,
      bossFighting: boss !== null && boss.state === "fighting" &&
        bossArrived(boss),
    }));
  }

  snapshot(): SimState {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const { player } = this;
    const boss = this.boss;
    const lockOf = (t: Scannable) =>
      t.locked ? 1 : Math.min(1, t.lockDwell / this.sensor.lockTicks);
    this.cachedSnapshot = {
      tick: this.tick,
      seed: this.options.seed,
      phase: this.phase,
      outcome: this.outcome,
      sector: this.sector,
      player: {
        focused: this.movement.focused,
        movement: { ...this.movement },
        pos: { x: player.x, y: player.y },
        radius: PLAYER.radius,
        lives: player.lives,
        power: player.power,
        shielded: player.shielded,
        graceTicks: player.grace,
        bank: player.bank,
        vel: { x: player.vx, y: player.vy },
        trigger: this.trigger.state,
        chargeLevel: this.trigger.level,
        charge: this.trigger.charge,
        scan: {
          active: this.trigger.state === "rest",
          halfAngle: this.sensor.coneHalfAngle,
          range: this.sensor.range,
          targetId: this.scanTarget,
        },
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        pos: { x: e.x, y: e.y },
        radius: e.radius,
        hp: e.hp,
        maxHp: e.maxHp,
        age: e.age,
        ai: e.ai,
        aiTicks: e.aiTicks,
        parts: e.parts.map(partView),
        weakPoint: e.weakPoint,
        lock: lockOf(e),
        locked: e.locked,
        disarmed: e.disarmed,
      })),
      bullets: [...this.shots, ...this.bullets].map((b) => ({
        id: b.id,
        kind: b.kind,
        pos: { x: b.x, y: b.y },
        vel: { x: b.vx, y: b.vy },
        radius: b.radius,
      })),
      pickups: this.pickups.map((p) => ({
        id: p.id,
        kind: p.kind,
        pos: { x: p.x, y: p.y },
      })),
      boss: boss
        ? {
          id: boss.id,
          pos: { x: boss.x, y: boss.y },
          radius: BOSS.radius,
          hp: boss.hp,
          maxHp: BOSS.hp,
          phase: boss.phase,
          invulnerable: !bossArrived(boss) || boss.state !== "fighting" ||
            this.parley,
          ai: boss.ai,
          pods: boss.pods.map(partView),
          coreOpen: coreOpen(boss),
          weakPoint: { offset: WARDEN_CORE.offset, radius: WARDEN_CORE.radius },
          lock: lockOf(boss),
          locked: boss.locked,
        }
        : null,
      score: this.score,
      kills: this.kills,
      pay: this.pay.view(),
      graze: {
        meter: this.grazeMeter,
        count: this.grazeCount,
        radius: this.grazeRadius,
      },
      scoutsSpared: this.scoutsSpared,
      flags: {
        pacifistIntact: this.pacifistIntact,
        neverFired: this.neverFired,
        firstPowerupTaken: this.firstPowerupTaken,
        recorderRecovered: this.recorderRecovered,
      },
      loadout: this.loadout,
    };
    return this.cachedSnapshot;
  }

  // ---------------------------------------------------------------------
  // Route: sectors, the warning, the Warden, the outro.

  private enterSector(sector: SectorIndex): void {
    this.sector = sector;
    this.sectorStart = this.tick;
    this.events.push({ type: "sectorStarted", tick: this.tick, sector });
    if (sector === 6) {
      this.phase = "bossWarning";
      this.schedule = [];
      this.bossDueAt = this.tick + BOSS.warningTicks;
      this.events.push({ type: "bossWarning", tick: this.tick });
    } else {
      this.schedule = sectorSchedule(SECTORS[sector - 1]);
      this.bossDueAt = null;
    }
    this.scheduleCursor = 0;
  }

  private advanceRoute(): void {
    if (this.outroEndsAt !== null) {
      if (this.tick >= this.outroEndsAt) this.phase = "ended";
      return;
    }
    if (this.bossDueAt !== null) {
      if (this.tick >= this.bossDueAt) {
        this.bossDueAt = null;
        this.boss = makeBoss(this.nextId++);
        this.phase = "boss";
        this.events.push({
          type: "spawn",
          tick: this.tick,
          id: this.boss.id,
          kind: "warden",
        });
      }
      return;
    }
    if (this.phase !== "sector" || this.sector === 6) return;
    const plan = SECTORS[this.sector - 1];
    const t = this.tick - this.sectorStart;
    const clear = this.enemies.length === 0;
    if (t >= plan.minTicks && (clear || t >= plan.capTicks)) {
      this.events.push({
        type: "sectorCleared",
        tick: this.tick,
        sector: this.sector,
      });
      this.enterSector((this.sector + 1) as SectorIndex);
    }
  }

  private spawnScheduled(): void {
    if (this.phase === "sector") {
      const t = this.tick - this.sectorStart;
      while (
        this.scheduleCursor < this.schedule.length &&
        this.schedule[this.scheduleCursor].at <= t
      ) {
        const spawn = this.schedule[this.scheduleCursor++];
        this.spawnEnemy(spawn.kind, spawn.x, spawn.y, { side: spawn.side });
      }
      if (
        this.sector === SALVAGE_CACHE.sector &&
        t === SALVAGE_CACHE.atSectorTick && !this.recorderRecovered
      ) {
        this.spawnPickup("recorder", SALVAGE_CACHE.x, SALVAGE_CACHE.y);
      }
    }
    while (
      this.scriptedCursor < this.scripted.length &&
      this.scripted[this.scriptedCursor].at <= this.tick
    ) {
      const spawn = this.scripted[this.scriptedCursor++];
      if (
        spawn.kind === "spread" || spawn.kind === "shield" ||
        spawn.kind === "recorder"
      ) {
        this.spawnPickup(spawn.kind, spawn.x, spawn.y);
      } else {
        this.spawnEnemy(spawn.kind, spawn.x, spawn.y, {
          passive: spawn.passive,
        });
      }
    }
  }

  /** Phases only rise (see `boss.ts`), so each is announced exactly once. */
  private reportBossPhase(): void {
    if (!this.boss || this.boss.state !== "fighting") return;
    const phase = this.boss.phase;
    if (phase !== this.lastBossPhase) {
      this.lastBossPhase = phase;
      this.events.push({ type: "bossPhase", tick: this.tick, phase });
    }
  }

  /** The pacifist ending: the Warden's whole pattern ran and you are alive. */
  private checkSurvival(survivalOpen: boolean): void {
    const boss = this.boss;
    if (!boss || boss.state !== "fighting" || this.outcome) return;
    if (!survivalOpen || !this.pacifistIntact) return;
    if (!survivalComplete(boss)) return;
    boss.state = "withdrawing";
    // Nobody the player spared is left behind: the escorts go with it.
    for (const escort of this.enemies) {
      if (escort.disarmed) continue;
      escort.retreating = true;
      this.events.push({
        type: "despawn",
        tick: this.tick,
        id: escort.id,
        reason: "retreat",
      });
    }
    this.endWith("bossSurvived");
  }

  private endWith(outcome: "bossDefeated" | "bossSurvived"): void {
    this.outcome = outcome;
    this.outroEndsAt = this.tick + BOSS.outroTicks;
    this.events.push({ type: outcome, tick: this.tick });
  }

  // ---------------------------------------------------------------------
  // Player: movement and the trigger.

  private flyPlayer(input: InputFrame): void {
    const p = this.player;
    p.grace = Math.max(0, p.grace - 1);
    const next = stepMovement(
      { x: p.x, y: p.y },
      this.movement,
      input.move,
      input.focus,
    );
    if (this.movement.focused !== input.focus) {
      this.events.push({
        type: "focusChanged",
        tick: this.tick,
        active: input.focus,
        pos: { ...next.pos },
      });
    }
    this.movement = next.movement;
    p.x = next.pos.x;
    p.y = next.pos.y;
    p.vx = next.vel.x;
    p.vy = next.vel.y;
    p.bank = next.intent.x * PLAYER.bankPerInput * (input.focus ? 0.35 : 1);

    const { volley, levelChanged } = this.trigger.update(input.fire);
    if (levelChanged) {
      this.events.push({
        type: "chargeLevel",
        tick: this.tick,
        level: this.trigger.level,
      });
    }
    if (volley) this.fireVolley(volley);
  }

  private fireVolley(volley: Volley): void {
    const p = this.player;
    if (this.phase !== "tutorial") this.neverFired = false;
    this.fired[volley.shot]++;
    const muzzleY = p.y - 18;
    const round = (
      x: number,
      vx: number,
      speed: number,
      radius: number,
      damage: number,
    ) =>
      this.shots.push({
        id: this.nextId++,
        kind: "shot",
        x,
        y: muzzleY,
        vx,
        vy: -speed,
        radius,
        alive: true,
        owner: 0,
        shot: volley.shot,
        level: volley.shot === "writ" ? volley.level : 0,
        damage,
        struck: [],
        grazed: false,
        closest: Infinity,
        nearMissed: false,
        connected: false,
      });
    let count = 1;
    if (volley.shot === "aimed") {
      round(
        p.x,
        0,
        TRIGGER.aimedSpeed,
        TRIGGER.aimedRadius,
        this.weapon.aimedDamage,
      );
    } else if (volley.shot === "writ") {
      const i = volley.level - 1;
      round(
        p.x,
        0,
        TRIGGER.writSpeed,
        this.weapon.writRadius[i],
        this.weapon.writDamage[i],
      );
    } else {
      const spreads = PLAYER.spreads[p.power - 1];
      count = spreads.length;
      spreads.forEach((vx, i) => {
        const x = p.x + (i - (spreads.length - 1) / 2) * PLAYER.shotSpacing;
        round(x, vx, PLAYER.shotSpeed, PLAYER.shotRadius, 1);
      });
    }
    this.statsTracker.volley(
      volley.shot,
      count,
      volley.level,
      !this.anythingAhead(p.x, muzzleY),
    );
    this.events.push({
      type: "playerFired",
      tick: this.tick,
      shots: count,
      shot: volley.shot,
      level: volley.level,
      pos: { x: p.x, y: muzzleY },
    });
  }

  /** Any scout or the Warden inside the gun's forward cone from (x, y). */
  private anythingAhead(x: number, y: number): boolean {
    const slope = Math.tan(STATS.mistConeHalfAngle);
    const ahead = (tx: number, ty: number, radius: number) =>
      ty < y && ty > -radius && Math.abs(tx - x) <= (y - ty) * slope + radius;
    const boss = this.boss;
    return this.enemies.some((e) => e.alive && ahead(e.x, e.y, e.radius)) ||
      (boss !== null && ahead(boss.x, boss.y, BOSS.radius));
  }

  private hurtPlayer(): void {
    const p = this.player;
    // Restored: nothing can hurt the ship once the ending has begun.
    if (this.outcome !== null || p.grace > 0) return;
    this.hits++;
    p.grace = this.tuning.graceTicks;
    const absorbed = p.shielded;
    this.events.push({
      type: "hit",
      tick: this.tick,
      target: "player",
      id: 0,
      absorbedByShield: absorbed,
      blocked: false,
      pos: { x: p.x, y: p.y },
      shotVel: { x: 0, y: 0 },
      by: null,
      level: 0,
      part: null,
    });
    this.events.push(this.pay.rateBreak(this.tick, absorbed));
    if (absorbed) {
      p.shielded = false;
      return;
    }
    p.power = Math.max(1, p.power - 1);
    // The tutorial teaches getting hit; it never costs a life.
    if (this.phase === "tutorial") return;
    p.lives--;
    this.resetMovement();
    this.events.push({
      type: "lifeLost",
      tick: this.tick,
      livesLeft: p.lives,
    });
    if (p.lives > 0) return;
    if (this.autoContinue && this.continuesLeft() > 0) {
      this.continuesUsed++;
      p.lives = this.tuning.lives;
      return;
    }
    this.phaseBeforeGameOver = this.phase;
    this.phase = "ended";
    this.outcome = "gameOver";
    this.events.push({ type: "gameOver", tick: this.tick });
  }

  private collect(pickup: Pickup): void {
    const p = this.player;
    if (pickup.kind === "spread") {
      p.power = Math.min(PLAYER.maxPower, p.power + 1);
    } else if (pickup.kind === "shield") {
      p.shielded = true;
    } else {
      this.recorderRecovered = true;
      this.announceIntel(pickup.id, "codex.recorder.0121", null);
    }
    const first = !pickup.practice && !this.firstPowerupTaken;
    if (first) this.firstPowerupTaken = true;
    this.events.push({
      type: "pickup",
      tick: this.tick,
      kind: pickup.kind,
      firstPowerup: first,
    });
  }

  // ---------------------------------------------------------------------
  // Collisions: player rounds against parts, weak points and hulls.

  private resolveHits(): void {
    for (const shot of this.shots) {
      if (!shot.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive || shot.struck.includes(enemy.id)) continue;
        if (this.strikeEnemy(enemy, shot)) {
          this.statsTracker.roundConnected(this.tick);
          shot.connected = true;
          // Piercing Writs may cross more than one hull in a fast tick.
          // Their struck ids prevent repeat damage on subsequent ticks.
          if (!shot.alive) break;
        }
      }
      if (shot.alive) this.strikeBoss(shot);
    }
    const playerBody = {
      x: this.player.x,
      y: this.player.y,
      radius: PLAYER.radius,
    };
    for (const bullet of this.bullets) {
      if (bullet.alive && touches(bullet, playerBody)) {
        bullet.alive = false;
        this.hurtPlayer();
      }
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive || !touches(enemy, playerBody)) continue;
      this.hurtPlayer();
      // Ramming hurts both, every tick of contact, even during grace.
      if (this.outcome === null) {
        this.damageEnemy(enemy, PLAYER.ramDamage, "ram", null);
      }
    }
    const boss = this.boss;
    if (
      boss && boss.state === "fighting" &&
      touches({ x: boss.x, y: boss.y, radius: BOSS.radius }, playerBody)
    ) this.hurtPlayer();
    for (const pickup of this.pickups) {
      if (
        pickup.alive &&
        touches({ ...pickup, radius: PICKUP.radius }, playerBody)
      ) {
        pickup.alive = false;
        this.collect(pickup);
      }
    }
  }

  /**
   * One player round against one scout. Returns true on contact.
   *
   * 1. A Writ into a locked scout picks the component it is aligned with:
   *    the weak point (a clean kill) or a weapon part (a clean disarm).
   * 2. Aimed and Writ rounds that touch a weapon part break or wear it.
   * 3. Anything else that touches the hull damages it; a Writ pierces on.
   */
  private strikeEnemy(enemy: Enemy, shot: Projectile): boolean {
    const hull = sweptCircle(shot, enemy);
    const precise = shot.shot === "aimed" || shot.shot === "writ";
    const part = precise
      ? enemy.parts.find((p) =>
        !p.broken && sweptCircle(shot, partCircle(enemy, p))
      )
      : undefined;
    if (!hull && !part) return false;

    if (shot.shot === "writ" && enemy.locked) {
      const choice = this.alignedComponent(enemy, shot.x);
      if (choice === "weakPoint") {
        shot.alive = false;
        this.hitEvent(enemy, shot, null);
        this.killEnemy(enemy, "writ", true);
        return true;
      }
      if (choice) {
        shot.alive = false;
        this.hitEvent(enemy, shot, choice);
        this.breakEnemyPart(enemy, choice, "writ", shot);
        return true;
      }
    }
    if (part) {
      shot.alive = false;
      this.hitEvent(enemy, shot, part);
      part.hp = shot.shot === "writ" ? 0 : part.hp - shot.damage;
      if (part.hp <= 0) {
        this.breakEnemyPart(enemy, part, shot.shot ?? "aimed", shot);
      }
      return true;
    }
    if (shot.shot === "writ") shot.struck.push(enemy.id);
    else shot.alive = false;
    this.damageEnemy(enemy, shot.damage, shot.shot ?? "stream", shot);
    return true;
  }

  /** For a locked Writ: the weak point or part it lines up with, if any. */
  private alignedComponent(
    enemy: Enemy,
    x: number,
  ): "weakPoint" | Part | null {
    let best: "weakPoint" | Part | null = null;
    let bestGap = Infinity;
    const slack = this.options.aimAssist ? WRIT_ASSIST_SLACK : WRIT_ALIGN_SLACK;
    // Parts first, so an exact tie spares the scout.
    for (const part of enemy.parts) {
      if (part.broken) continue;
      const gap = Math.abs(x - (enemy.x + part.offset.x));
      if (gap <= part.spec.radius + slack && gap < bestGap) {
        best = part;
        bestGap = gap;
      }
    }
    const wp = enemy.weakPoint;
    const gap = Math.abs(x - (enemy.x + wp.offset.x));
    if (gap <= wp.radius + slack && gap < bestGap) {
      best = "weakPoint";
    }
    return best;
  }

  /** `shot` is null for a ram: the impact is then the ship itself. */
  private hitEvent(
    enemy: Enemy,
    shot: Projectile | null,
    part: Part | null,
  ): void {
    const at = shot ?? this.player;
    this.events.push({
      type: "hit",
      tick: this.tick,
      target: "enemy",
      id: enemy.id,
      absorbedByShield: false,
      blocked: false,
      pos: { x: at.x, y: at.y },
      shotVel: shot ? { x: shot.vx, y: shot.vy } : { x: 0, y: 0 },
      by: shot ? shot.shot : "ram",
      level: shot ? shot.level : 0,
      part: part ? part.spec.id : null,
    });
  }

  private damageEnemy(
    enemy: Enemy,
    amount: number,
    by: ShotKind | "ram",
    shot: Projectile | null,
  ): void {
    enemy.hp -= amount;
    this.hitEvent(enemy, shot, null);
    if (enemy.hp > 0) {
      startEvade(enemy, this.player);
      return;
    }
    this.killEnemy(enemy, by, false);
  }

  private killEnemy(enemy: Enemy, by: ShotKind | "ram", clean: boolean): void {
    enemy.alive = false;
    enemy.hp = 0;
    this.score += enemy.score;
    this.kills++;
    if (this.phase !== "tutorial") this.pacifistIntact = false;
    const practice = enemy.id === this.practiceTarget;
    this.events.push({
      type: "kill",
      tick: this.tick,
      id: enemy.id,
      kind: enemy.kind,
      score: enemy.score,
      byRam: by === "ram",
      clean,
    });
    if (practice) this.resolvePractice("destroyed");
    this.events.push(
      this.pay.earn(
        this.tick,
        clean ? "cleanKill" : "kill",
        enemy.score,
        clean ? PAY.gain.cleanKill : PAY.gain.kill,
      ),
    );
    // Two draws, in the starter's order: drop at all, then which kind.
    if (this.rng.chance(enemy.dropChance)) {
      const spread = this.player.power < PLAYER.maxPower &&
        this.rng.chance(0.5);
      this.spawnPickup(spread ? "spread" : "shield", enemy.x, enemy.y);
    }
  }

  private breakEnemyPart(
    enemy: Enemy,
    part: Part,
    by: ShotKind,
    shot: Projectile,
  ): void {
    part.broken = true;
    part.hp = 0;
    this.partsBroken++;
    this.events.push({
      type: "partBreak",
      tick: this.tick,
      id: enemy.id,
      target: "enemy",
      part: part.spec.id,
      partKind: part.spec.kind,
      pos: { x: enemy.x + part.offset.x, y: enemy.y + part.offset.y },
      by,
      hitPos: { x: shot.x, y: shot.y },
      shotVel: { x: shot.vx, y: shot.vy },
      first: this.firstTime("partBreak.enemy"),
    });
    this.events.push(
      this.pay.earn(
        this.tick,
        "partBreak",
        PAY.partBreakCredits,
        PAY.gain.partBreak,
      ),
    );
    if (enemy.parts.every((p) => p.broken)) this.disarm(enemy);
  }

  /** Every gun gone: the scout cancels its bullets and leaves, spared. */
  private disarm(enemy: Enemy): void {
    enemy.disarmed = true;
    enemy.retreating = true;
    let cancelled = 0;
    for (const bullet of this.bullets) {
      if (bullet.alive && bullet.owner === enemy.id) {
        bullet.alive = false;
        cancelled++;
      }
    }
    this.scoutsSpared++;
    this.events.push({
      type: "disarm",
      tick: this.tick,
      id: enemy.id,
      kind: enemy.kind,
      pos: { x: enemy.x, y: enemy.y },
      cancelled,
      first: this.firstTime("disarm"),
    });
    if (enemy.id === this.practiceTarget) this.resolvePractice("disarmed");
    this.events.push(
      this.pay.earn(
        this.tick,
        "disarm",
        enemy.score * PAY.disarmFraction,
        PAY.gain.disarm,
      ),
    );
  }

  /**
   * One player round against the Warden: pods first (they ring the hull),
   * then the core. Shots during the descent or a speech are swallowed.
   */
  private strikeBoss(shot: Projectile): void {
    const boss = this.boss;
    if (!boss || boss.state !== "fighting") return;
    const pod = boss.pods.find((p) =>
      !p.broken && sweptCircle(shot, partCircle(boss, p))
    );
    const hull = sweptCircle(shot, {
      x: boss.x,
      y: boss.y,
      radius: BOSS.radius,
    });
    if (!pod && !hull) return;
    this.statsTracker.roundConnected(this.tick);
    shot.alive = false;
    shot.connected = true;
    const open = bossArrived(boss) && !this.parley;
    // The stream pings off armored pods.
    const blocked = !open || (pod !== undefined && shot.shot === "stream");
    this.events.push({
      type: "hit",
      tick: this.tick,
      target: "boss",
      id: boss.id,
      absorbedByShield: false,
      blocked,
      pos: { x: shot.x, y: shot.y },
      shotVel: { x: shot.vx, y: shot.vy },
      by: shot.shot,
      level: shot.level,
      part: pod ? pod.spec.id : null,
    });
    if (blocked) return;
    this.pay.refresh();
    if (pod) {
      const mult = shot.shot === "writ"
        ? boss.locked
          ? TRIGGER.lockedWritPodMultiplier
          : TRIGGER.writPodMultiplier
        : 1;
      pod.hp -= shot.damage * mult;
      if (pod.hp <= 0) this.breakPod(boss, pod, shot.shot ?? "aimed", shot);
      return;
    }
    // The core: striking it at all ends a pacifist run.
    this.pacifistIntact = false;
    let amount = shot.damage;
    if (coreOpen(boss)) {
      amount *= WARDEN_CORE.openMultiplier;
      if (shot.shot === "writ" && boss.locked) {
        amount *= WARDEN_CORE.lockedWritMultiplier;
      }
    }
    boss.hp -= amount;
    if (boss.hp <= 0) this.defeatBoss(boss, shot.shot === "writ");
  }

  private breakPod(
    boss: Boss,
    pod: Part,
    by: ShotKind,
    shot: Projectile,
  ): void {
    const wasOpen = coreOpen(boss);
    pod.broken = true;
    pod.hp = 0;
    this.partsBroken++;
    this.events.push({
      type: "partBreak",
      tick: this.tick,
      id: boss.id,
      target: "boss",
      part: pod.spec.id,
      partKind: pod.spec.kind,
      pos: { x: boss.x + pod.offset.x, y: boss.y + pod.offset.y },
      by,
      hitPos: { x: shot.x, y: shot.y },
      shotVel: { x: shot.vx, y: shot.vy },
      first: this.firstTime("partBreak.boss"),
    });
    this.events.push(
      this.pay.earn(
        this.tick,
        "partBreak",
        PAY.partBreakCredits,
        PAY.gain.partBreak,
      ),
    );
    if (!wasOpen && coreOpen(boss)) {
      this.events.push({ type: "coreExposed", tick: this.tick, id: boss.id });
      this.announceIntel(boss.id, "codex.warden.core", boss.ai);
    }
  }

  private defeatBoss(boss: Boss, clean: boolean): void {
    boss.hp = 0;
    boss.state = "defeated";
    boss.ai = "fallen";
    this.score += BOSS.score;
    this.kills++;
    this.pacifistIntact = false;
    this.events.push(
      this.pay.earn(
        this.tick,
        clean ? "cleanKill" : "kill",
        BOSS.score,
        clean ? PAY.gain.cleanKill : PAY.gain.kill,
      ),
    );
    // The Warden's fall takes its bullets and escorts with it (no score).
    for (const bullet of this.bullets) bullet.alive = false;
    for (const escort of this.enemies) {
      if (!escort.alive) continue;
      escort.alive = false;
      this.events.push({
        type: "despawn",
        tick: this.tick,
        id: escort.id,
        reason: "wiped",
      });
    }
    this.endWith("bossDefeated");
  }

  // ---------------------------------------------------------------------
  // Grazes, near misses, the scan beam.

  /**
   * Enemy bullets that survived collisions: a graze once inside the graze
   * radius (not during post-hit grace), a near miss at closest approach.
   */
  private checkGrazes(): void {
    const p = this.player;
    this.ticksSinceGraze++;
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      const dx = bullet.x - p.x;
      const dy = bullet.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (
        !bullet.grazed && distance < this.grazeRadius && p.grace === 0 &&
        this.outcome === null
      ) {
        bullet.grazed = true;
        this.graze(bullet);
      }
      if (bullet.nearMissed || distance >= NEAR_MISS_RADIUS) continue;
      if (distance < bullet.closest) {
        bullet.closest = distance;
        continue;
      }
      bullet.nearMissed = true;
      this.events.push({
        type: "nearMiss",
        tick: this.tick,
        bulletId: bullet.id,
        pos: { x: bullet.x, y: bullet.y },
        relVel: { x: bullet.vx - p.vx, y: bullet.vy - p.vy },
        distance: bullet.closest,
        heavy: bullet.kind === "heavy",
      });
    }
    if (this.ticksSinceGraze > GRAZE.drainDelay) {
      this.grazeMeter = Math.max(0, this.grazeMeter - GRAZE.drainPerTick);
    }
  }

  private graze(bullet: Projectile): void {
    const count = bullet.kind === "heavy" ? 2 : 1;
    this.grazeCount += count;
    this.ticksSinceGraze = 0;
    this.grazeMeter = Math.min(
      1,
      this.grazeMeter + GRAZE.meterPerGraze * count,
    );
    this.events.push({
      type: "graze",
      tick: this.tick,
      bulletId: bullet.id,
      pos: { x: bullet.x, y: bullet.y },
      count,
      meter: this.grazeMeter,
      first: this.firstTime("graze"),
    });
    this.events.push(
      this.pay.earn(
        this.tick,
        "graze",
        PAY.grazeCredits * count,
        PAY.gain.graze * count,
      ),
    );
    if (this.grazeMeter >= 1) {
      // Clearance: a full meter pays out and empties.
      this.grazeMeter = 0;
      this.events.push(
        this.pay.earn(
          this.tick,
          "clearance",
          PAY.clearanceCredits,
          PAY.gain.clearance,
        ),
      );
    }
  }

  private sweepScan(fireHeld: boolean): void {
    const candidates: Scannable[] = this.enemies.filter((e) =>
      e.alive && e.y > 0
    );
    const boss = this.boss;
    if (boss && boss.state === "fighting" && boss.y > 0) candidates.push(boss);
    const active = !fireHeld && this.outcome === null;
    const { painted, locked } = stepScan(
      this.player,
      candidates,
      this.sensor,
      active,
      SCAN_DECAY,
    );
    this.scanTarget = painted;
    if (!locked) return;
    this.locks++;
    const isBoss = boss !== null && locked === boss;
    const enemy = isBoss ? null : this.enemies.find((e) => e.id === locked.id);
    const kind = enemy ? enemy.kind : "warden";
    const ai = enemy ? enemy.ai : boss!.ai;
    this.events.push({
      type: "scanLock",
      tick: this.tick,
      id: locked.id,
      target: isBoss ? "boss" : "enemy",
      kind,
      pos: { x: locked.x, y: locked.y },
      ai,
      first: this.firstTime("scanLock"),
    });
    this.events.push(
      this.pay.earn(this.tick, "scan", PAY.scanCredits, PAY.gain.scan),
    );
    this.announceIntel(
      locked.id,
      isBoss ? "codex.warden" : `codex.enemy.${kind}`,
      ai,
    );
  }

  private announceIntel(
    id: EntityId,
    codexId: string,
    ai: EnemyAiState | WardenAiState | null,
  ): void {
    this.events.push({
      type: "intel",
      tick: this.tick,
      id,
      codexId,
      ai,
      first: this.firstTime(codexId),
    });
  }

  /** True the first time `key` is asked about this run. */
  private firstTime(key: string): boolean {
    if (this.announced.has(key)) return false;
    this.announced.add(key);
    return true;
  }

  // ---------------------------------------------------------------------
  // Bookkeeping.

  private cull(): void {
    this.shots = this.shots.filter((s) => {
      if (s.alive && !offscreen(s.x, s.y)) return true;
      this.statsTracker.roundResolved(s.connected);
      // Only a Writ gets a miss cue: it is the one round worth hearing fail.
      if (s.alive && s.shot === "writ" && !s.connected) {
        this.events.push({
          type: "writMissed",
          tick: this.tick,
          pos: { x: s.x, y: s.y },
          level: s.level,
        });
      }
      return false;
    });
    this.bullets = this.bullets.filter((b) => b.alive && !offscreen(b.x, b.y));
    this.pickups = this.pickups.filter((p) => p.alive && !offscreen(p.x, p.y));
    // Enemies get 30 ticks of grace: lancers are born outside the walls.
    let practiceEscaped = false;
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive) return false;
      if (!(e.age > 30 && offscreen(e.x, e.y))) return true;
      if (e.id === this.practiceTarget) practiceEscaped = true;
      if (e.disarmed) {
        this.events.push({
          type: "despawn",
          tick: this.tick,
          id: e.id,
          reason: "spared",
        });
      }
      return false;
    });
    // After the filter, so a re-issued target lands in the new list.
    if (practiceEscaped) this.resolvePractice("escaped");
    // The withdrawing Warden is gone once it clears the top edge.
    if (this.boss?.state === "withdrawing" && this.boss.y < -BOSS.radius * 3) {
      this.boss = null;
    }
  }

  private spawnBullet(
    owner: EntityId,
    x: number,
    y: number,
    vx: number,
    vy: number,
    heavy: boolean,
  ): void {
    const kind: BulletKind = heavy ? "heavy" : "bullet";
    this.bullets.push({
      id: this.nextId++,
      kind,
      x,
      y,
      vx,
      vy,
      radius: BULLET_RADIUS[kind],
      alive: true,
      owner,
      shot: null,
      level: 0,
      damage: 0,
      struck: [],
      grazed: false,
      closest: Infinity,
      nearMissed: false,
      connected: false,
    });
  }

  private arena(): Arena {
    return {
      rng: this.rng,
      player: { x: this.player.x, y: this.player.y },
      bulletSpeed: this.tuning.bulletSpeed,
      droneFireChance: this.tuning.droneFireChance,
      dartsArmed: this.tuning.dartsArmed,
      fire: (owner, weapon, x, y, angle, speed, heavy = false) => {
        this.spawnBullet(
          owner,
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          heavy,
        );
        const key = `${owner}:${weapon}`;
        const volley = this.volleys.get(key);
        if (volley) volley.bullets++;
        else {this.volleys.set(key, {
            id: owner,
            weapon,
            pos: { x, y },
            bullets: 1,
          });}
      },
      // Restored: the starter's summon ignored `kind` and always made drones.
      summon: (kind, x, y) => {
        this.spawnEnemy(kind, x, y, { side: x < 240 ? 1 : -1 });
      },
    };
  }

  private flushVolleys(): void {
    for (const v of this.volleys.values()) {
      this.events.push({ type: "enemyFired", tick: this.tick, ...v });
    }
    this.volleys.clear();
  }

  private flushEvents(): readonly SimEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

/** Builds a sim. Callers that only need the contract can type it as `Sim`. */
export function createSim(options: SimOptions): NeonWardenSim {
  return new NeonWardenSim(options);
}

/** Seconds of game time a run took, for reports. */
export function ticksToSeconds(ticks: Tick): number {
  return ticks / TICK_RATE;
}
