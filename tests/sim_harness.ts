/**
 * Shared helper for the sim tests: runs one autopilot from sector 1 to an
 * ending at full speed and reports what happened. Also runnable directly
 * for a survival-rate table:
 *
 *   deno run tests/sim_harness.ts 20
 */

import type {
  Difficulty,
  Loadout,
  Pilot,
  SimEvent,
  SimOutcome,
} from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";
import { GhostAutopilot, PacifistAutopilot } from "../src/pilots/pacifist.ts";

/** Generous cap: a full run is about 13,000 ticks. */
const MAX_TICKS = 40_000;

export interface RunReport {
  readonly seed: number;
  readonly outcome: SimOutcome | null;
  readonly ticks: number;
  readonly kills: number;
  readonly score: number;
  readonly hits: number;
  readonly continuesUsed: number;
  readonly livesLeft: number;
  readonly firstPowerupTick: number | null;
  readonly pacifistIntact: boolean;
  readonly neverFired: boolean;
  readonly credits: number;
  readonly scoutsSpared: number;
  readonly grazes: number;
  readonly locks: number;
  readonly partsBroken: number;
  readonly cleanKills: number;
  readonly writs: number;
  /** Boss phases in the order announced. */
  readonly bossPhases: readonly number[];
  readonly hash: string;
  readonly ms: number;
}

export function runToEnd(
  seed: number,
  makePilot: () => Pilot,
  difficulty: Difficulty = "normal",
  loadout?: Loadout,
  onEvent?: (event: SimEvent) => void,
): RunReport {
  // Continues are spent automatically, as in the starter's attract mode; a
  // run "survives" when it needs none.
  const sim = createSim({
    seed,
    start: { kind: "sector", sector: 1 },
    difficulty,
    autoContinue: true,
    loadout,
  });
  const pilot = makePilot();
  let firstPowerupTick: number | null = null;
  let cleanKills = 0;
  const bossPhases: number[] = [];
  const started = performance.now();
  while (sim.snapshot().phase !== "ended" && sim.snapshot().tick < MAX_TICKS) {
    for (const event of sim.step(pilot.next(sim.snapshot()))) {
      if (event.type === "pickup" && event.firstPowerup) {
        firstPowerupTick = event.tick;
      }
      if (event.type === "kill" && event.clean) cleanKills++;
      if (event.type === "bossPhase") bossPhases.push(event.phase);
      onEvent?.(event);
    }
  }
  const ms = performance.now() - started;
  const state = sim.snapshot();
  const stats = sim.stats();
  return {
    seed,
    outcome: state.outcome,
    ticks: state.tick,
    kills: state.kills,
    score: state.score,
    hits: stats.hits,
    continuesUsed: stats.continuesUsed,
    livesLeft: state.player.lives,
    firstPowerupTick,
    pacifistIntact: state.flags.pacifistIntact,
    neverFired: state.flags.neverFired,
    credits: state.pay.credits,
    scoutsSpared: state.scoutsSpared,
    grazes: state.graze.count,
    locks: stats.locks,
    partsBroken: stats.partsBroken,
    cleanKills,
    writs: stats.fired.writ,
    bossPhases,
    hash: hashSimState(state),
    ms,
  };
}

export const PILOTS = {
  fight: () => new FightingAutopilot(),
  pacifist: () => new PacifistAutopilot(),
  ghost: () => new GhostAutopilot(),
} as const;

if (import.meta.main) {
  const count = Number(Deno.args[0] ?? 10);
  const difficulty = (Deno.args[1] ?? "normal") as Difficulty;
  for (const [name, make] of Object.entries(PILOTS)) {
    let clean = 0;
    let ticks = 0;
    let ms = 0;
    const lines: string[] = [];
    for (let seed = 1; seed <= count; seed++) {
      const r = runToEnd(seed, make, difficulty);
      if (r.continuesUsed === 0 && r.outcome !== "gameOver") clean++;
      ticks += r.ticks;
      ms += r.ms;
      lines.push(
        `${r.seed}:${r.outcome}/h${r.hits}/c${r.continuesUsed}/k${r.kills}` +
          `/ck${r.cleanKills}/sp${r.scoutsSpared}/w${r.writs}/l${r.locks}` +
          `/g${r.grazes}/$${r.credits}/t${r.ticks}/ph${r.bossPhases.join("")}`,
      );
    }
    console.log(
      `${name} ${difficulty}: no-continue ${clean}/${count}, ` +
        `${Math.round(ticks / (ms / 1000))} ticks/s`,
    );
    console.log("  " + lines.join(" "));
  }
}
