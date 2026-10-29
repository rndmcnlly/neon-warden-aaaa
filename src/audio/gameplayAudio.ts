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
  /** Extra gain in dB on top of the role's (merged hit clusters). */
  readonly gainDb?: number;
  /** Start this much later, in seconds (feedback deferred behind a loss). */
  readonly delayS?: number;
}

/** Per-event options from the caller. */
export interface EventCueOptions {
  /** Deferred feedback: play every cue of this event this much later. */
  readonly delayS?: number;
}

/** Hits merged within one tick: one voice per role, louder per extra hit. */
interface HitCluster {
  count: number;
  pos: Vec2 | undefined;
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
  /** A merged cluster grows by this many dB per doubling of its hits... */
  clusterDbPerDoubling: 2,
  /** ...up to this much. */
  clusterMaxDb: 6,
};

/** Light per-round hit roles that are merged per tick instead of stacked. */
type ClusterRole = "hit_enemy" | "hit_boss" | "hit_deflect" | "ricochet_tink";

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
  /** This tick's light hits, flushed as one voice per role in `frame`. */
  private clusters = new Map<ClusterRole, HitCluster>();

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
    this.clusters.clear();
    this.setScanning(false);
  }

  onEvent(e: SimEvent, state: SimState, options: EventCueOptions = {}): void {
    const at = (id: EntityId) => this.positions.get(id) ?? this.find(state, id);
    const delay = options.delayS ? { delayS: options.delayS } : {};
    const play = (role: GameplaySoundId, cue: Omit<SoundCue, "role"> = {}) =>
      this.sink.play({ role, ...delay, ...cue });
    switch (e.type) {
      case "focusChanged":
        play(e.active ? "focus_enter" : "focus_exit");
        break;
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
        // A Warden pod is an event; a scout's part is a clank.
        play(e.target === "boss" ? "pod_break" : "part_break", { pos: e.pos });
        play("part_stab", { pitch: e.target === "boss" ? 2 : 4 });
        break;
      case "disarm":
        // Mechanical, then failing power: nothing here sounds like a kill.
        play("disarm_unlatch", { pos: e.pos });
        play("power_down", { pos: e.pos, delayS: 0.12 });
        break;
      case "writMissed":
        play("writ_miss", { pos: e.pos });
        break;
      case "coreExposed":
        play("core_exposed", { pos: at(e.id) });
        break;
      case "hit":
        this.hit(e, play);
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
        play("life_alarm");
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

  /** Hits by ladder rung (src/render/feedbackLadder.ts). */
  private hit(
    e: Extract<SimEvent, { type: "hit" }>,
    play: (role: GameplaySoundId, cue?: Omit<SoundCue, "role">) => void,
  ): void {
    if (e.target === "player") {
      play(e.absorbedByShield ? "shield_bloom" : "hit_player");
      return;
    }
    const writ = e.level === 0 ? null : (`writ_impact_${e.level}` as const);
    if (e.blocked) {
      // Armor: a tink you can hear through the stream. A Writ glancing off
      // still lands its tier's crack, a little under a true hit.
      if (writ) play(writ, { pos: e.pos, gainDb: -4 });
      this.cluster("hit_deflect", e.pos);
      this.cluster("ricochet_tink", e.pos);
      return;
    }
    if (writ) play(writ, { pos: e.pos });
    else if (e.by === "aimed") play("tap_impact", { pos: e.pos });
    else this.cluster(e.target === "boss" ? "hit_boss" : "hit_enemy", e.pos);
  }

  private cluster(role: ClusterRole, pos: Vec2): void {
    const c = this.clusters.get(role);
    if (c) c.count++;
    else this.clusters.set(role, { count: 1, pos });
  }

  /** One voice per merged role, a little louder for every doubling. */
  private flushClusters(): void {
    const t = GAMEPLAY_AUDIO_TUNING;
    for (const [role, c] of this.clusters) {
      const gainDb = Math.min(
        t.clusterMaxDb,
        Math.log2(c.count) * t.clusterDbPerDoubling,
      );
      this.sink.play({ role, pos: c.pos, gainDb });
    }
    this.clusters.clear();
  }

  /** Once per tick, after that tick's events. */
  frame(state: SimState): void {
    this.flushClusters();
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
