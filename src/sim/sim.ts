/**
 * The deterministic Neon Warden simulation: a port of the gameplay in
 * `reference/e4-starter/src/game.ts` (the `tick()` half of `GameScene`)
 * with rendering, sound and the HUD stripped out. One `step()` is one 60 Hz
 * tick; nothing here reads a clock or `Math.random`, so a seed plus an input
 * sequence always replays the same run.
 *
 * Tick order, as in the starter: route and spawns, player, enemies and boss,
 * projectiles and pickups, collisions, cleanup.
 *
 * Rule for everything under `src/sim/`: import only from `../contracts/` and
 * other sim files. No three.js, no DOM, no clocks, no `Math.random`.
 */

import {
  type BossPhase,
  type BulletKind,
  type EnemyKind,
  type EntityId,
  type InputFrame,
  type PickupKind,
  type ScriptedSpawn,
  type SectorIndex,
  type Sim,
  type SimEvent,
  type SimOptions,
  type SimOutcome,
  type SimPhase,
  type SimState,
  type Tick,
  TICK_RATE,
} from "../contracts/index.ts";
import { Rng } from "./rng.ts";
import { type Arena, type Enemy, makeEnemy, stepEnemy } from "./enemies.ts";
import {
  type Boss,
  bossArrived,
  bossPhase,
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
  PICKUP,
  PLAYER,
  SALVAGE_CACHE,
} from "./tuning.ts";

/** Where the tutorial's practice drone appears (`tut.spawnTarget`). */
const PRACTICE_TARGET = Object.freeze({ x: 240, y: 160 });

/** Run statistics that are not part of `SimState` (for credits and tests). */
export interface RunStats {
  readonly hits: number;
  readonly continuesUsed: number;
  readonly continuesLeft: number;
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
  lives: number;
  power: number;
  shielded: boolean;
  grace: number;
  cooldown: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class NeonWardenSim implements Sim {
  private readonly rng: Rng;
  private readonly tuning: DifficultyTuning;
  private readonly autoContinue: boolean;
  private readonly scripted: readonly ScriptedSpawn[];
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
  private lastBossPhase: BossPhase | null = null;

  private readonly player: PlayerState;
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
  private firstPowerupTaken = false;
  /** Whether any powerup has entered play; the salvage cache checks it. */
  private powerupSeen = false;

  private isFrozen = false;
  /** `boss.parley`: the Warden is talking, so it neither moves nor fires. */
  private parley = false;
  /** The live practice drone, so `tut.spawnTarget` never stacks two. */
  private practiceTarget: EntityId | null = null;
  private events: SimEvent[] = [];
  private cachedSnapshot: SimState | null = null;

  constructor(private readonly options: SimOptions) {
    this.rng = new Rng(options.seed);
    this.tuning = DIFFICULTY[options.difficulty];
    this.autoContinue = options.autoContinue ?? false;
    this.scripted = [...(options.scriptedSpawns ?? [])].sort((a, b) =>
      a.at - b.at
    );
    this.player = {
      x: PLAYER.startX,
      y: PLAYER.startY,
      lives: this.tuning.lives,
      power: 1,
      shielded: false,
      grace: 0,
      cooldown: 0,
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
    this.isFrozen = true;
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
    } else if (name === "tut.spawnTarget" && value) {
      const alive = this.enemies.some((e) =>
        e.alive && e.id === this.practiceTarget
      );
      if (this.phase === "tutorial" && !alive) {
        this.practiceTarget = this.spawnEnemy(
          "drone",
          PRACTICE_TARGET.x,
          PRACTICE_TARGET.y,
          { passive: true },
        );
      }
    }
  }

  /**
   * Leaves the tutorial (or skips ahead) into a sector. Clears the field;
   * coming from the tutorial it also wipes score, kills and flags, because
   * the Lane Authority's drills are simulations and do not count.
   */
  beginSector(sector: SectorIndex): void {
    if (this.phase === "tutorial") {
      this.score = 0;
      this.kills = 0;
      this.pacifistIntact = true;
      this.firstPowerupTaken = false;
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
    if (this.phase !== "tutorial") this.powerupSeen = true;
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
    this.flyPlayer(input);

    const arena = this.arena();
    const survivalOpen = this.pacifistIntact;
    for (const enemy of this.enemies) stepEnemy(enemy, arena);
    // While it talks the Warden holds still, so the survival clock (which
    // counts its age) also waits: a speech never costs a pacifist time.
    if (this.boss && !this.parley) {
      stepBoss(this.boss, arena, survivalOpen);
      this.reportBossPhase(survivalOpen);
    }
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
    this.checkSurvival(survivalOpen);
    this.cull();
    return this.flushEvents();
  }

  snapshot(): SimState {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const { player } = this;
    const boss = this.boss;
    this.cachedSnapshot = {
      tick: this.tick,
      seed: this.options.seed,
      phase: this.phase,
      outcome: this.outcome,
      sector: this.sector,
      player: {
        pos: { x: player.x, y: player.y },
        radius: PLAYER.radius,
        lives: player.lives,
        power: player.power,
        shielded: player.shielded,
        graceTicks: player.grace,
        bank: player.bank,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        pos: { x: e.x, y: e.y },
        radius: e.radius,
        hp: e.hp,
        maxHp: e.maxHp,
        age: e.age,
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
          phase: bossPhase(boss, this.pacifistIntact),
          invulnerable: !bossArrived(boss) || boss.state !== "fighting" ||
            this.parley,
        }
        : null,
      score: this.score,
      kills: this.kills,
      flags: {
        pacifistIntact: this.pacifistIntact,
        firstPowerupTaken: this.firstPowerupTaken,
      },
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
        t === SALVAGE_CACHE.atSectorTick && !this.powerupSeen
      ) {
        const kind = this.player.power < PLAYER.maxPower ? "spread" : "shield";
        this.spawnPickup(kind, SALVAGE_CACHE.x, SALVAGE_CACHE.y);
      }
    }
    while (
      this.scriptedCursor < this.scripted.length &&
      this.scripted[this.scriptedCursor].at <= this.tick
    ) {
      const spawn = this.scripted[this.scriptedCursor++];
      if (spawn.kind === "spread" || spawn.kind === "shield") {
        this.spawnPickup(spawn.kind, spawn.x, spawn.y);
      } else {
        this.spawnEnemy(spawn.kind, spawn.x, spawn.y, {
          passive: spawn.passive,
        });
      }
    }
  }

  private reportBossPhase(survivalOpen: boolean): void {
    if (!this.boss || this.boss.state !== "fighting") return;
    const phase = bossPhase(this.boss, survivalOpen);
    if (phase !== this.lastBossPhase) {
      this.lastBossPhase = phase;
      this.events.push({ type: "bossPhase", tick: this.tick, phase });
    }
  }

  /** The pacifist ending: the Warden's whole pattern ran and you are alive. */
  private checkSurvival(survivalOpen: boolean): void {
    const boss = this.boss;
    if (!boss || boss.state !== "fighting" || this.outcome) return;
    if (!survivalOpen || !survivalComplete(boss)) return;
    boss.state = "withdrawing";
    // Nobody the player spared is left behind: the escorts go with it.
    for (const escort of this.enemies) {
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
  // Player.

  private flyPlayer(input: InputFrame): void {
    const p = this.player;
    p.grace = Math.max(0, p.grace - 1);
    const dx = clamp(input.move.x, -1, 1);
    const dy = clamp(input.move.y, -1, 1);
    const speed = input.focus ? PLAYER.focusSpeed : PLAYER.speed;
    p.x = clamp(p.x + dx * speed, PLAYER.minX, PLAYER.maxX);
    p.y = clamp(p.y + dy * speed, PLAYER.minY, PLAYER.maxY);
    p.bank = dx * PLAYER.bankPerInput;

    p.cooldown = Math.max(0, p.cooldown - 1);
    if (!input.fire || p.cooldown > 0) return;
    p.cooldown = PLAYER.fireInterval;
    const spreads = PLAYER.spreads[p.power - 1];
    spreads.forEach((vx, i) => {
      this.shots.push({
        id: this.nextId++,
        kind: "shot",
        x: p.x + (i - (spreads.length - 1) / 2) * PLAYER.shotSpacing,
        y: p.y - 18,
        vx,
        vy: -PLAYER.shotSpeed,
        radius: PLAYER.shotRadius,
        alive: true,
      });
    });
    this.events.push({
      type: "playerFired",
      tick: this.tick,
      shots: spreads.length,
    });
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
    });
    if (absorbed) {
      p.shielded = false;
      return;
    }
    p.power = Math.max(1, p.power - 1);
    // The tutorial teaches getting hit; it never costs a life.
    if (this.phase === "tutorial") return;
    p.lives--;
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
    } else {
      p.shielded = true;
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
  // Collisions and their consequences.

  private resolveHits(): void {
    const boss = this.boss;
    const bossTarget = boss && boss.state === "fighting"
      ? { x: boss.x, y: boss.y, radius: BOSS.radius }
      : null;

    for (const shot of this.shots) {
      const enemy = this.enemies.find((e) => e.alive && touches(e, shot));
      if (enemy) {
        shot.alive = false;
        this.damageEnemy(enemy, 1, false);
      } else if (boss && bossTarget && touches(bossTarget, shot)) {
        // Shots during the descent or a speech are swallowed without effect.
        shot.alive = false;
        if (bossArrived(boss) && !this.parley) this.damageBoss(boss);
        else {
          this.events.push({
            type: "hit",
            tick: this.tick,
            target: "boss",
            id: boss.id,
            absorbedByShield: false,
            blocked: true,
          });
        }
      }
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
        this.damageEnemy(enemy, PLAYER.ramDamage, true);
      }
    }
    if (bossTarget && touches(bossTarget, playerBody)) this.hurtPlayer();
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

  private damageEnemy(enemy: Enemy, amount: number, byRam: boolean): void {
    enemy.hp -= amount;
    this.events.push({
      type: "hit",
      tick: this.tick,
      target: "enemy",
      id: enemy.id,
      absorbedByShield: false,
      blocked: false,
    });
    if (enemy.hp > 0) return;
    enemy.alive = false;
    this.score += enemy.score;
    this.kills++;
    if (this.phase !== "tutorial") this.pacifistIntact = false;
    this.events.push({
      type: "kill",
      tick: this.tick,
      id: enemy.id,
      kind: enemy.kind,
      score: enemy.score,
      byRam,
    });
    // Two draws, in the starter's order: drop at all, then which kind.
    if (this.rng.chance(enemy.dropChance)) {
      const spread = this.player.power < PLAYER.maxPower &&
        this.rng.chance(0.5);
      this.spawnPickup(spread ? "spread" : "shield", enemy.x, enemy.y);
    }
  }

  private damageBoss(boss: Boss): void {
    boss.hp -= 1;
    this.events.push({
      type: "hit",
      tick: this.tick,
      target: "boss",
      id: boss.id,
      absorbedByShield: false,
      blocked: false,
    });
    if (boss.hp > 0) return;
    boss.hp = 0;
    boss.state = "defeated";
    this.score += BOSS.score;
    this.kills++;
    this.pacifistIntact = false;
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

  private cull(): void {
    this.shots = this.shots.filter((s) => s.alive && !offscreen(s.x, s.y));
    this.bullets = this.bullets.filter((b) => b.alive && !offscreen(b.x, b.y));
    this.pickups = this.pickups.filter((p) => p.alive && !offscreen(p.x, p.y));
    // Enemies get 30 ticks of grace: lancers are born outside the walls.
    this.enemies = this.enemies.filter((e) =>
      e.alive && !(e.age > 30 && offscreen(e.x, e.y))
    );
    // The withdrawing Warden is gone once it clears the top edge.
    if (this.boss?.state === "withdrawing" && this.boss.y < -BOSS.radius * 3) {
      this.boss = null;
    }
  }

  private arena(): Arena {
    return {
      rng: this.rng,
      player: { x: this.player.x, y: this.player.y },
      bulletSpeed: this.tuning.bulletSpeed,
      droneFireChance: this.tuning.droneFireChance,
      dartsArmed: this.tuning.dartsArmed,
      fire: (x, y, angle, speed, heavy = false) => {
        const kind: BulletKind = heavy ? "heavy" : "bullet";
        this.bullets.push({
          id: this.nextId++,
          kind,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: BULLET_RADIUS[kind],
          alive: true,
        });
      },
      // Restored: the starter's summon ignored `kind` and always made drones.
      summon: (kind, x, y) => {
        this.spawnEnemy(kind, x, y, { side: x < 240 ? 1 : -1 });
      },
    };
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
