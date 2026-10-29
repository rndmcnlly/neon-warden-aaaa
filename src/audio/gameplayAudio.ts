/**
 * Gameplay audio: turns sim events and state into sound cues. It decides
 * *what* plays and *where*; a `SoundSink` (the engine's `SfxPlayer`)
 * decides how. No Web Audio here, so a test can feed it events and read
 * back the cues.
 *
 * Two inputs per tick, in this order:
 * - `onEvent(event, state)` for each event (positions of entities that just
 *   died come from the previous tick, which this class remembers);
 * - `frame(state)` once, for continuous things: the scan beam's loop, lock
 *   progress ticks, and enemies flying past the ship (doppler fly-bys).
 */

import {
  type EnemyKind,
  type EntityId,
  type SimEvent,
  type SimState,
  type Vec2,
} from "../contracts/index.ts";
import { closestApproach } from "./spatial.ts";
import type { GameplaySoundId, Pitch } from "./gameplaySounds.ts";

export interface SoundCue {
  readonly role: GameplaySoundId;
  /** Where the sound is, in sim units; heard from the player's ship. */
  readonly pos?: Vec2;
  /** The source's velocity (sim units per tick), for doppler. */
  readonly vel?: Vec2;
  /** Overrides the role's default pitch. */
  readonly pitch?: Pitch;
  readonly octave?: number;
}

export interface SoundSink {
  play(cue: SoundCue): void;
  /** Starts or stops a looping role (the scan beam). */
  loop(role: GameplaySoundId, on: boolean, cue?: Omit<SoundCue, "role">): void;
}

export const GAMEPLAY_AUDIO_TUNING = {
  /** An enemy faster than this (units per tick) can make a fly-by. */
  flybyMinSpeed: 2.5,
  /** ...if it will pass within this distance of the ship... */
  flybyDistance: 80,
  /** ...within this many ticks. */
  flybyLeadTicks: 10,
  /** Grazes closer together than this (ticks) form one rising streak. */
  grazeStreakTicks: 72,
  /** Lock progress ticks per full lock. */
  lockSteps: 4,
};

/** Scale degree of each enemy's kill note: small to large climbs the scale. */
const KILL_DEGREE: Record<EnemyKind, number> = {
  drone: 0,
  dart: 2,
  turret: 4,
  lancer: 7,
};

/**
 * In a no-kill run, grazes play this tune instead of a rising streak:
 * restraint gets a melody (critique-audio top 10, item 10).
 */
export const PACIFIST_MELODY: readonly number[] = [
  0,
  2,
  4,
  2,
  5,
  4,
  2,
  1,
  0,
  4,
  7,
  6,
  4,
  2,
  4,
  0,
];

export class GameplayAudio {
  private positions = new Map<EntityId, Vec2>();
  private velocities = new Map<EntityId, Vec2>();
  private flown = new Set<EntityId>();
  private lockStep = new Map<EntityId, number>();
  private scanning = false;
  private grazeStreak = 0;
  private lastGrazeTick = -Infinity;
  private melodyStep = 0;

  constructor(private readonly sink: SoundSink) {}

  /** A new run: forget every entity and streak. */
  reset(): void {
    this.positions.clear();
    this.velocities.clear();
    this.flown.clear();
    this.lockStep.clear();
    this.grazeStreak = 0;
    this.lastGrazeTick = -Infinity;
    this.melodyStep = 0;
    this.setScanning(false);
  }

  onEvent(e: SimEvent, state: SimState): void {
    const at = (id: EntityId) => this.positions.get(id) ?? this.find(state, id);
    const play = (role: GameplaySoundId, cue: Omit<SoundCue, "role"> = {}) =>
      this.sink.play({ role, ...cue });
    switch (e.type) {
      case "playerFired":
        if (e.shot === "stream") play("shot_stream");
        else if (e.shot === "aimed") play("shot_aimed");
        else {
          const level = Math.max(1, e.level) as 1 | 2 | 3;
          play(`writ_release_${level}`);
          play("writ_chord", { octave: level - 2 });
        }
        break;
      case "chargeLevel":
        if (e.level > 0) {
          play("charge_pip", { pitch: [0, 2, 4, 7][e.level] });
        }
        break;
      case "enemyFired": {
        const heavy = e.weapon === "wardenCannon" ||
          e.weapon === "lancerEmitter";
        play(heavy ? "enemy_fire_heavy" : "enemy_fire", { pos: e.pos });
        break;
      }
      case "nearMiss":
        play("near_miss", { pos: e.pos, vel: e.relVel });
        break;
      case "graze":
        play("graze", { pos: e.pos, pitch: this.grazePitch(e.tick, state) });
        break;
      case "scanLock":
        this.lockStep.delete(e.id);
        play("lock_confirm", { pos: e.pos });
        break;
      case "intel":
        play("intel_ping");
        break;
      case "payChanged":
        if (e.delta > 0 && e.reason !== "decay") {
          // The rate climbs the scale: x1 tonic, x2 third, x4 fifth...
          const degree = Math.round(Math.log2(Math.max(1, e.rate)) * 2);
          play("pay_tick", { pitch: Math.min(degree, 9) });
        }
        break;
      case "partBreak":
        play("part_break", { pos: e.pos });
        play("part_stab", { pitch: e.target === "boss" ? 2 : 4 });
        break;
      case "disarm":
        play("disarm", { pos: e.pos });
        play("disarm_glide");
        break;
      case "coreExposed":
        play("core_exposed", { pos: at(e.id) });
        break;
      case "hit":
        if (e.target === "player") {
          play(e.absorbedByShield ? "shield_bloom" : "hit_player");
        } else if (e.blocked) play("hit_deflect", { pos: at(e.id) });
        else {play(e.target === "boss" ? "hit_boss" : "hit_enemy", {
            pos: at(e.id),
          });}
        break;
      case "kill": {
        const pos = at(e.id);
        const big = e.kind === "turret" || e.kind === "lancer";
        play(e.byRam ? "kill_ram" : big ? "kill_large" : "kill_small", {
          pos,
        });
        play("kill_note", { pitch: KILL_DEGREE[e.kind] });
        break;
      }
      case "lifeLost":
        play("life_lost");
        break;
      case "pickup":
        play("pickup", { pitch: e.kind === "recorder" ? 4 : 0 });
        break;
      case "spawn":
        if (e.kind !== "warden") play("spawn", { pos: at(e.id) });
        break;
      case "despawn":
        if (e.reason !== "wiped") play("retreat", { pos: at(e.id) });
        break;
      case "sectorCleared":
        play("sector_clear");
        break;
      case "bossPhase":
        if (e.phase >= 1) play("boss_roar", { octave: e.phase - 1 });
        break;
      case "bossDefeated":
        play("boss_collapse");
        break;
      case "gameOver":
        play("game_over");
        break;
    }
  }

  /** Once per tick, after that tick's events. */
  frame(state: SimState): void {
    // Optional chains: tolerate a sim snapshot from before the scan, lock
    // and velocity fields existed (wave 3 landed in steps).
    this.setScanning(state.player.scan?.active ?? false);
    const ear = state.player.pos;
    const seen = new Set<EntityId>();
    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const prev = this.positions.get(enemy.id);
      const vel = prev
        ? { x: enemy.pos.x - prev.x, y: enemy.pos.y - prev.y }
        : { x: 0, y: 0 };
      this.positions.set(enemy.id, enemy.pos);
      this.velocities.set(enemy.id, vel);
      this.maybeFlyby(enemy.id, enemy.pos, vel, ear);
      this.lockProgress(enemy.id, enemy.lock ?? 0, enemy.locked, enemy.pos);
    }
    const boss = state.boss;
    if (boss) {
      seen.add(boss.id);
      this.positions.set(boss.id, boss.pos);
      this.lockProgress(boss.id, boss.lock ?? 0, boss.locked, boss.pos);
    }
    for (const id of this.positions.keys()) {
      if (!seen.has(id)) {
        this.positions.delete(id);
        this.velocities.delete(id);
        this.lockStep.delete(id);
      }
    }
  }

  private setScanning(on: boolean): void {
    if (on === this.scanning) return;
    this.scanning = on;
    this.sink.loop("scan_sweep", on);
  }

  private maybeFlyby(id: EntityId, pos: Vec2, vel: Vec2, ear: Vec2): void {
    const t = GAMEPLAY_AUDIO_TUNING;
    if (this.flown.has(id) || Math.hypot(vel.x, vel.y) < t.flybyMinSpeed) {
      return;
    }
    const pass = closestApproach(pos, vel, ear);
    if (pass.distance < t.flybyDistance && pass.ticks < t.flybyLeadTicks) {
      this.flown.add(id);
      this.sink.play({ role: "flyby", pos, vel });
    }
  }

  /** A tick per quarter of lock progress, rising toward the confirm. */
  private lockProgress(
    id: EntityId,
    lock: number,
    locked: boolean,
    pos: Vec2,
  ): void {
    if (locked || lock <= 0) {
      this.lockStep.delete(id);
      return;
    }
    const step = Math.floor(lock * GAMEPLAY_AUDIO_TUNING.lockSteps);
    if (step > (this.lockStep.get(id) ?? 0)) {
      this.lockStep.set(id, step);
      this.sink.play({ role: "lock_tick", pos, pitch: step * 2 });
    }
  }

  private grazePitch(tick: number, state: SimState): number {
    if (state.flags.pacifistIntact) {
      const degree = PACIFIST_MELODY[this.melodyStep % PACIFIST_MELODY.length];
      this.melodyStep++;
      return degree;
    }
    const gap = tick - this.lastGrazeTick;
    this.lastGrazeTick = tick;
    this.grazeStreak = gap <= GAMEPLAY_AUDIO_TUNING.grazeStreakTicks
      ? this.grazeStreak + 1
      : 0;
    return Math.min(this.grazeStreak, 9);
  }

  private find(state: SimState, id: EntityId): Vec2 | undefined {
    if (state.boss?.id === id) return state.boss.pos;
    return state.enemies.find((e) => e.id === id)?.pos;
  }
}
