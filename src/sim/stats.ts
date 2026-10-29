/**
 * Player statistics for commentary: what the Pilot's gun and ship have been
 * doing, and the few moments worth a remark.
 *
 * The sim feeds this tracker three ways: `volley()` when the gun fires (with
 * whether anything was ahead of it), `roundResolved()` when a player round
 * leaves play (whether it ever touched something), and `note()` with every
 * event of the tick. Once per tick, `step()` checks the moments and returns
 * at most one `statsMoment` event.
 *
 * Moments are deliberately rare. Each one has a gate with hysteresis: it
 * fires when its condition crosses a threshold, then stays shut until the
 * condition clearly recovers (and a minimum gap passes). A global gap keeps
 * any two moments apart. The commentary scheduler adds its own cooldowns on
 * top, so the sim errs on the side of reporting and the Director on the
 * side of silence.
 *
 * Everything counts in ticks, so the tracker is as deterministic as the sim.
 */

import type {
  PlayerStatsView,
  ShotKind,
  SimEvent,
  StatsMomentKind,
  Tick,
} from "../contracts/index.ts";
import { secondsToTicks } from "../contracts/index.ts";

/** Thresholds, from `STATS_MOMENTS` in `src/scenes/banks/types.ts`, tuned. */
export const STATS = Object.freeze({
  /** Resolved rounds in the rolling accuracy window. */
  rollingRounds: 40,
  /** accuracyDrop: rolling below this, and this far below the run's mean. */
  accuracyDropBelow: 0.25,
  accuracyDropMargin: 0.15,
  /** ...and it re-arms once rolling accuracy recovers past this. */
  accuracyRearm: 0.4,
  /** intoTheMist: consecutive volleys with nothing ahead of the gun. */
  mistVolleys: 12,
  /** Half-angle of the "anything ahead?" cone, in radians from straight up. */
  mistConeHalfAngle: 0.35,
  /** hotStreak: kills or disarms inside the window, without being hit. */
  streakCount: 6,
  streakWindow: secondsToTicks(8),
  /** grazeStreak: grazes inside the window. */
  grazeCount: 5,
  grazeWindow: secondsToTicks(4),
  /** Disarm ratio moments, after enough enemies are resolved. */
  ratioHighAfter: 8,
  ratioHigh: 0.6,
  ratioHighRearm: 0.45,
  ratioLowAfter: 12,
  /** repeatedDeaths: a life lost this soon after the previous one. */
  deathWindow: secondsToTicks(60),
  /** longIdle: no fire and no movement in gameplay for this long. */
  idleTicks: secondsToTicks(8),
  /** writHoarding: a full charge held this long, or this many wasted. */
  hoardTicks: secondsToTicks(6),
  hoardWasted: 3,
  /** bossLull: the Warden fight with no player action for this long. */
  lullTicks: secondsToTicks(10),
  /** No two moments closer than this (perfectSector excepted). */
  globalGap: secondsToTicks(6),
  /** No one moment closer to itself than this. */
  selfGap: secondsToTicks(20),
});

/** What the sim knows each tick that events do not carry. */
export interface StatsTickContext {
  readonly tick: Tick;
  /** Sector play (not the tutorial, not the outro). */
  readonly gameplay: boolean;
  readonly firing: boolean;
  readonly moving: boolean;
  /** The trigger holds a full (level 3) charge. */
  readonly fullCharge: boolean;
  /** The Warden is on the field and fighting. */
  readonly bossFighting: boolean;
}

export type StatsMomentEvent = Extract<SimEvent, { type: "statsMoment" }>;

/** One moment's latch: fires on a crossing, re-arms on recovery. */
interface Gate {
  armed: boolean;
  lastAt: number;
}

const MOMENTS: readonly StatsMomentKind[] = [
  "accuracyDrop",
  "intoTheMist",
  "hotStreak",
  "perfectSector",
  "grazeStreak",
  "disarmRatioHigh",
  "disarmRatioLow",
  "repeatedDeaths",
  "longIdle",
  "writHoarding",
  "bossLull",
];

export class PlayerStats {
  private roundsFired = 0;
  private roundsHit = 0;
  private roundsResolved = 0;
  /** The last `rollingRounds` resolved rounds: true when one connected. */
  private recent: boolean[] = [];
  private volleysIntoMist = 0;
  private mistRun = 0;
  private energyWasted = 0;
  private wastedFullWrits = 0;
  private kills = 0;
  private disarms = 0;
  private grazes = 0;
  private deaths = 0;
  private streak = 0;
  private bestStreak = 0;
  /** Ticks of recent kills and disarms since the ship was last hit. */
  private resolveTicks: Tick[] = [];
  /** Ticks of recent grazes (a heavy graze counts twice). */
  private grazeTicks: Tick[] = [];
  private lastConnectTick: Tick | null = null;
  private lastDeathTick: Tick | null = null;
  private sectorHits = 0;
  private idleTicks = 0;
  private fullChargeTicks = 0;
  private lastBossAction: Tick = 0;
  private now: Tick = 0;
  private gates = new Map<StatsMomentKind, Gate>();
  private lastMomentAt = -Infinity;
  /** Edge-triggered moments raised by `note()`, checked in `step()`. */
  private raised: Array<{ moment: StatsMomentKind; value: number }> = [];

  constructor() {
    this.reset();
  }

  /** Forget everything (the tutorial's drills do not count). */
  reset(): void {
    this.roundsFired = this.roundsHit = this.roundsResolved = 0;
    this.recent = [];
    this.volleysIntoMist = this.mistRun = 0;
    this.energyWasted = this.wastedFullWrits = 0;
    this.kills =
      this.disarms =
      this.grazes =
      this.deaths =
        0;
    this.streak = this.bestStreak = 0;
    this.resolveTicks = [];
    this.grazeTicks = [];
    this.lastConnectTick = this.lastDeathTick = null;
    this.sectorHits = this.idleTicks = this.fullChargeTicks = 0;
    this.lastBossAction = this.now;
    this.lastMomentAt = -Infinity;
    this.raised = [];
    for (const moment of MOMENTS) {
      this.gates.set(moment, { armed: true, lastAt: -Infinity });
    }
  }

  // ------------------------------------------------------------- inputs

  /** The gun fired `rounds` rounds; `empty` when nothing was ahead of it. */
  volley(shot: ShotKind, rounds: number, level: number, empty: boolean): void {
    this.roundsFired += rounds;
    if (!empty) {
      this.mistRun = 0;
      return;
    }
    this.volleysIntoMist++;
    this.mistRun++;
    if (shot === "writ") {
      this.energyWasted += level;
      if (level === 3) this.wastedFullWrits++;
    }
  }

  /** A player round left play; `connected` if it ever touched a target. */
  roundResolved(connected: boolean): void {
    this.roundsResolved++;
    this.recent.push(connected);
    if (this.recent.length > STATS.rollingRounds) this.recent.shift();
    if (!connected) return;
    this.roundsHit++;
    this.lastConnectTick = this.now;
    this.mistRun = 0;
  }

  /** Every event of the tick, in order. */
  note(event: SimEvent): void {
    switch (event.type) {
      case "kill":
      case "disarm":
        if (event.type === "kill") this.kills++;
        else this.disarms++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.resolveTicks.push(event.tick);
        break;
      case "graze":
        this.grazes += event.count;
        for (let i = 0; i < event.count; i++) this.grazeTicks.push(event.tick);
        break;
      case "hit":
        if (event.target === "player") {
          this.streak = 0;
          this.resolveTicks = [];
          this.sectorHits++;
        } else if (event.target === "boss" && !event.blocked) {
          this.lastBossAction = event.tick;
        }
        break;
      case "partBreak":
        if (event.target === "boss") this.lastBossAction = event.tick;
        break;
      case "lifeLost":
        this.deaths++;
        if (
          this.lastDeathTick !== null &&
          event.tick - this.lastDeathTick <= STATS.deathWindow
        ) this.raise("repeatedDeaths", this.deaths);
        this.lastDeathTick = event.tick;
        break;
      case "sectorStarted":
        this.sectorHits = 0;
        break;
      case "sectorCleared":
        if (this.sectorHits === 0) this.raise("perfectSector", event.sector);
        break;
    }
  }

  // ------------------------------------------------------------ moments

  /** Once per tick, after `note()`: at most one moment. */
  step(ctx: StatsTickContext): StatsMomentEvent[] {
    this.now = ctx.tick;
    this.prune(ctx.tick);
    const out: StatsMomentEvent[] = [];
    const fire = (moment: StatsMomentKind, value: number) => {
      if (out.length === 0 && this.tryFire(moment, ctx.tick)) {
        out.push({ type: "statsMoment", tick: ctx.tick, moment, value });
      }
    };

    // Edge-triggered moments first: they happen once and cannot wait.
    for (const { moment, value } of this.raised) {
      this.rearm(moment);
      fire(moment, value);
    }
    this.raised = [];

    // Accuracy: a drop below the run's own mean.
    const rolling = this.rolling();
    if (rolling >= STATS.accuracyRearm) this.rearm("accuracyDrop");
    if (
      this.recent.length >= STATS.rollingRounds &&
      rolling < STATS.accuracyDropBelow &&
      rolling < this.accuracy() - STATS.accuracyDropMargin
    ) fire("accuracyDrop", Math.round(rolling * 100));

    // Into the mist: volley after volley at nothing.
    if (this.mistRun === 0) this.rearm("intoTheMist");
    if (this.mistRun >= STATS.mistVolleys) fire("intoTheMist", this.mistRun);

    // Streaks.
    if (this.resolveTicks.length === 0) this.rearm("hotStreak");
    if (this.resolveTicks.length >= STATS.streakCount) {
      fire("hotStreak", this.resolveTicks.length);
    }
    if (this.grazeTicks.length === 0) this.rearm("grazeStreak");
    if (this.grazeTicks.length >= STATS.grazeCount) {
      fire("grazeStreak", this.grazeTicks.length);
    }

    // The disarm ratio, once enough scouts have been resolved.
    const resolved = this.kills + this.disarms;
    const ratio = this.ratio();
    if (ratio < STATS.ratioHighRearm) this.rearm("disarmRatioHigh");
    if (resolved >= STATS.ratioHighAfter && ratio >= STATS.ratioHigh) {
      fire("disarmRatioHigh", Math.round(ratio * 100));
    }
    if (
      resolved >= STATS.ratioLowAfter && this.disarms === 0 &&
      this.roundsFired > 0
    ) fire("disarmRatioLow", resolved);

    // Idling and hoarding (resting to charge is idle too; banks say so kindly).
    const still = ctx.gameplay && !ctx.firing && !ctx.moving;
    this.idleTicks = still ? this.idleTicks + 1 : 0;
    if (this.idleTicks === 0) this.rearm("longIdle");
    if (this.idleTicks >= STATS.idleTicks) fire("longIdle", this.idleTicks);

    this.fullChargeTicks = ctx.fullCharge ? this.fullChargeTicks + 1 : 0;
    if (this.fullChargeTicks === 0 && this.wastedFullWrits === 0) {
      this.rearm("writHoarding");
    }
    if (
      this.fullChargeTicks >= STATS.hoardTicks ||
      this.wastedFullWrits >= STATS.hoardWasted
    ) {
      const value = Math.max(this.fullChargeTicks, this.wastedFullWrits);
      fire("writHoarding", value);
      if (out.length > 0) this.wastedFullWrits = 0;
    }

    // The Warden fight going quiet.
    if (!ctx.bossFighting) this.lastBossAction = ctx.tick;
    const lull = ctx.tick - this.lastBossAction;
    if (lull < STATS.lullTicks) this.rearm("bossLull");
    else fire("bossLull", lull);

    return out;
  }

  private raise(moment: StatsMomentKind, value: number): void {
    this.raised.push({ moment, value });
  }

  private tryFire(moment: StatsMomentKind, tick: Tick): boolean {
    const gate = this.gates.get(moment)!;
    if (!gate.armed || tick - gate.lastAt < STATS.selfGap) return false;
    const exempt = moment === "perfectSector";
    if (!exempt && tick - this.lastMomentAt < STATS.globalGap) return false;
    gate.armed = false;
    gate.lastAt = tick;
    this.lastMomentAt = tick;
    return true;
  }

  private rearm(moment: StatsMomentKind): void {
    this.gates.get(moment)!.armed = true;
  }

  private prune(tick: Tick): void {
    const keep = (window: number) => (t: Tick) => tick - t < window;
    this.resolveTicks = this.resolveTicks.filter(keep(STATS.streakWindow));
    this.grazeTicks = this.grazeTicks.filter(keep(STATS.grazeWindow));
  }

  // ---------------------------------------------------------------- view

  /** Hits over resolved rounds (rounds still in flight do not count yet). */
  private accuracy(): number {
    return this.roundsResolved === 0 ? 0 : this.roundsHit / this.roundsResolved;
  }

  private rolling(): number {
    if (this.recent.length === 0) return 0;
    return this.recent.filter(Boolean).length / this.recent.length;
  }

  private ratio(): number {
    const resolved = this.kills + this.disarms;
    return resolved === 0 ? 0 : this.disarms / resolved;
  }

  view(): PlayerStatsView {
    return {
      roundsFired: this.roundsFired,
      roundsHit: this.roundsHit,
      accuracy: this.accuracy(),
      rollingAccuracy: this.rolling(),
      volleysIntoMist: this.volleysIntoMist,
      energyWasted: this.energyWasted,
      kills: this.kills,
      disarms: this.disarms,
      disarmRatio: this.ratio(),
      grazes: this.grazes,
      deaths: this.deaths,
      streak: this.streak,
      bestStreak: this.bestStreak,
      ticksSinceHit: this.lastConnectTick === null
        ? 0
        : this.now - this.lastConnectTick,
    };
  }
}
