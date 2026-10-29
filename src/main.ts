/**
 * Entry point and game loop. The loop owns wall-clock time: it converts
 * elapsed milliseconds into whole sim ticks (fixed timestep with an
 * accumulator), so frame rate never changes gameplay. Auto-play runs a fixed
 * number of ticks per frame instead, for fast deterministic demos.
 */

import {
  IDLE_INPUT,
  parseUrlFlags,
  type Pilot,
  type SimStart,
  type SkipTo,
  TICK_MS,
} from "./contracts/index.ts";
import { createSim } from "./sim/sim.ts";
import { FightingAutopilot } from "./pilots/fighting.ts";
import { PacifistAutopilot } from "./pilots/pacifist.ts";
import { createSettingsStore } from "./settings/store.ts";
import { createStage } from "./render/stage.ts";
import { createDevOverlay } from "./ui/devOverlay.ts";
import "./style.css";

const DEFAULT_SEED = 121;
/** Never simulate more than this per frame, so a background tab cannot spiral. */
const MAX_TICKS_PER_FRAME = 8;

const flags = parseUrlFlags(location.search);
const settings = createSettingsStore();

function startFor(skipTo: SkipTo | null): SimStart {
  const match = skipTo?.match(/^sector([1-5])$/);
  if (match) {
    return { kind: "sector", sector: Number(match[1]) as 1 | 2 | 3 | 4 | 5 };
  }
  if (skipTo === "tutorial") return { kind: "tutorial" };
  return { kind: "sector", sector: 1 };
}

const sim = createSim({
  seed: flags.seed ?? DEFAULT_SEED,
  start: startFor(flags.skipTo),
  difficulty: settings.get().accessibility.difficulty,
});

const pilot: Pilot | null = flags.autoPlay?.mode === "fight"
  ? new FightingAutopilot()
  : flags.autoPlay?.mode === "pacifist"
  ? new PacifistAutopilot()
  : null;

const stage = createStage(document.getElementById("stage")!);
const overlay = createDevOverlay(document.getElementById("overlay")!, flags);

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const dt = now - last;
  last = now;

  let ticks: number;
  if (flags.autoPlay) {
    ticks = flags.autoPlay.speed;
  } else {
    accumulator += dt * settings.get().accessibility.gameSpeed;
    ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(accumulator / TICK_MS));
    accumulator = Math.min(accumulator - ticks * TICK_MS, TICK_MS);
  }
  for (let i = 0; i < ticks; i++) {
    sim.step(pilot ? pilot.next(sim.snapshot()) : IDLE_INPUT);
  }

  overlay.update(sim.snapshot());
  stage.render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
