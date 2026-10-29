/**
 * A read-only window for QA tooling (`qa/`), installed only with `?qa=1`.
 * Reels poll it instead of guessing from pixels: which scene is playing,
 * where the run is, and an append-only log of sim events, scenes and voice
 * lines. The game writes; QA only reads. Without `?qa=1` none of this runs.
 */

import type { LineId, SimEvent, SimState } from "../contracts/index.ts";

export interface QaProbe {
  /** Timeline id now playing, `play` during plain gameplay, `menu` in menus. */
  scene(): string;
  sim(): {
    tick: number;
    /** 1–5, null in the boss arena or menus. */
    sector: number | null;
    outcome: "none" | "kill" | "pacifist" | "gameover";
    /** The pacifist reel asserts this stays 0. */
    shotsFired: number;
  };
  /** Last 500 entries: `sim:<type>`, `scene:<id>`, `line:<LineId>`. */
  readonly log: readonly string[];
}

declare global {
  var __nwqa: QaProbe | undefined;
}

const LOG_LIMIT = 500;

/** The game-side handle: record into the probe as things happen. */
export interface QaRecorder {
  simEvent(event: SimEvent): void;
  scene(id: string): void;
  line(line: LineId): void;
  runStarted(): void;
}

export function installQaProbe(source: {
  scene(): string;
  state(): SimState | null;
}): QaRecorder {
  const log: string[] = [];
  let shotsFired = 0;
  const push = (entry: string) => {
    log.push(entry);
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  };
  globalThis.__nwqa = {
    scene: source.scene,
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
        outcome,
        shotsFired,
      };
    },
    log,
  };
  return {
    simEvent(event) {
      if (event.type === "playerFired") shotsFired += event.shots;
      push(`sim:${event.type}`);
    },
    scene: (id) => push(`scene:${id}`),
    line: (line) => push(`line:${line}`),
    runStarted() {
      shotsFired = 0;
    },
  };
}
