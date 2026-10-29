/**
 * A read-only window for QA tooling (`qa/`), installed only with `?qa=1`.
 * Reels poll it instead of guessing from pixels: which scene is playing,
 * where the run is, which story flags are up, and append-only logs of sim
 * events, scenes and voice lines. The game writes; QA only reads. Without
 * `?qa=1` none of this runs.
 */

import type { LineId, SimEvent, SimState } from "../contracts/index.ts";

export interface QaProbe {
  /** Timeline id now playing, `play` during plain gameplay, `menu` in menus. */
  scene(): string;
  /** The Director's timeline id, or null between scenes. */
  timeline(): string | null;
  sim(): {
    tick: number;
    /** 1–5, null in the boss arena or menus. */
    sector: number | null;
    phase: string | null;
    outcome: "none" | "kill" | "pacifist" | "gameover";
    kills: number;
    /** The pacifist reel asserts this stays 0. */
    shotsFired: number;
    /** True while a `freezeSim` cue holds the world still. */
    frozen: boolean;
    /** The Warden's hp as a fraction of max, null with no Warden on screen. */
    bossHp: number | null;
    /** Ticks the Warden has lived (the survival clock reads this). */
    bossAge: number | null;
  };
  /**
   * The one control, not a state write: autoplay ticks per frame. A reel
   * fast-forwards a fight, then drops to 1 to record its end at real time.
   * Returns true so an `until` step can call it.
   */
  setSpeed(speed: number): boolean;
  /** Story flags as the Director last set them this run. */
  flags(): Readonly<Record<string, boolean>>;
  /**
   * Last 500 entries: `sim:<type>`, `scene:<id>`, `line:<LineId>`,
   * `bark:<LineId>`. Per-shot events (`playerFired`, `hit`) are left out
   * here and in `events`: at high speed they would flush everything else.
   */
  readonly log: readonly string[];
  /** Last 200 sim events with their fields. */
  readonly events: readonly SimEvent[];
  /**
   * Last 400 per-shot events (`playerFired`, `hit`) with their fields, kept
   * apart so they never flush `events`. Feedback evidence reads these.
   */
  readonly impacts: readonly SimEvent[];
}

declare global {
  var __nwqa: QaProbe | undefined;
}

const LOG_LIMIT = 500;
const EVENT_LIMIT = 200;
const IMPACT_LIMIT = 400;
const NOISY: ReadonlySet<SimEvent["type"]> = new Set(["playerFired", "hit"]);

/** The game-side handle: record into the probe as things happen. */
export interface QaRecorder {
  simEvent(event: SimEvent): void;
  scene(id: string): void;
  line(line: LineId): void;
  bark(line: LineId): void;
  flag(name: string, value: boolean): void;
  runStarted(): void;
}

export function installQaProbe(source: {
  scene(): string;
  timeline(): string | null;
  state(): SimState | null;
  frozen(): boolean;
  setSpeed(speed: number): void;
}): QaRecorder {
  const log: string[] = [];
  const events: SimEvent[] = [];
  const impacts: SimEvent[] = [];
  let flags: Record<string, boolean> = {};
  let shotsFired = 0;
  /** The view carries no age, so the probe dates the Warden by its spawn. */
  let wardenSpawnTick: number | null = null;
  const push = <T>(list: T[], entry: T, limit: number) => {
    list.push(entry);
    if (list.length > limit) list.splice(0, list.length - limit);
  };
  globalThis.__nwqa = {
    scene: source.scene,
    timeline: source.timeline,
    sim() {
      const s = source.state();
      const outcome = s?.outcome === "bossDefeated"
        ? "kill"
        : s?.outcome === "bossSurvived"
        ? "pacifist"
        : s?.outcome === "gameOver"
        ? "gameover"
        : "none";
      return {
        tick: s?.tick ?? 0,
        sector: s && s.sector <= 5 && s.phase !== "tutorial" ? s.sector : null,
        phase: s?.phase ?? null,
        outcome,
        kills: s?.kills ?? 0,
        shotsFired,
        frozen: source.frozen(),
        bossHp: s?.boss ? s.boss.hp / s.boss.maxHp : null,
        bossAge: s?.boss && wardenSpawnTick !== null
          ? s.tick - wardenSpawnTick
          : null,
      };
    },
    setSpeed(speed) {
      source.setSpeed(Math.max(1, Math.round(speed)));
      return true;
    },
    flags: () => flags,
    log,
    events,
    impacts,
  };
  return {
    simEvent(event) {
      if (event.type === "playerFired") shotsFired += event.shots;
      if (event.type === "spawn" && event.kind === "warden") {
        wardenSpawnTick = event.tick;
      }
      if (NOISY.has(event.type)) {
        push(impacts, { ...event }, IMPACT_LIMIT);
        return;
      }
      push(log, `sim:${event.type}`, LOG_LIMIT);
      push(events, { ...event }, EVENT_LIMIT);
    },
    scene: (id) => push(log, `scene:${id}`, LOG_LIMIT),
    line: (line) => push(log, `line:${line}`, LOG_LIMIT),
    bark: (line) => push(log, `bark:${line}`, LOG_LIMIT),
    flag(name, value) {
      flags = { ...flags, [name]: value };
    },
    runStarted() {
      shotsFired = 0;
      wardenSpawnTick = null;
      flags = {};
    },
  };
}
