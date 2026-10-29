/** QA-only isolation fixture: real sim, input, renderer and audio, no story/UI. */
import { createSim } from "../../../src/sim/sim.ts";
import { createStage } from "../../../src/render/stage.ts";
import { createInputLayer } from "../../../src/input/inputLayer.ts";
import { createSettingsStore } from "../../../src/settings/store.ts";
import { AudioEngine } from "../../../src/audio/engine.ts";
import { parseUrlFlags } from "../../../src/contracts/flags.ts";
import { installQaProbe } from "../../../src/app/qaProbe.ts";

const settings = createSettingsStore();
const flags = parseUrlFlags(location.search);
const sim = createSim({ seed: 121, difficulty: "normal", movement: flags.movement,
  start: { kind: "tutorial" } });
document.querySelector("canvas")?.remove();
const stage = createStage(document.body, { settings });
const input = createInputLayer(settings);
const engine = await AudioEngine.create({ store: settings });
engine.setEar(() => ({ pos: sim.snapshot().player.pos, vel: sim.snapshot().player.vel }));
input.onAnyPress(() => { void engine.ctx.resume(); });
stage.observe(sim.snapshot());
stage.playShot("gameplay", 0);
const qa = installQaProbe({ scene: () => "isolated-movement", timeline: () => null,
  state: () => sim.snapshot(), frozen: () => false });
let last = performance.now();
let accumulator = 0;
function frame(now: number) {
  const dt = Math.min(100, now - last);
  last = now;
  accumulator += dt;
  while (accumulator >= 1000 / 60) {
    accumulator -= 1000 / 60;
    const events = sim.step(input.readFrame());
    const state = sim.snapshot();
    stage.observe(state, events);
    for (const event of events) { qa.simEvent(event); engine.gameplay.onEvent(event, state); }
    engine.gameplay.frame(state);
  }
  stage.render(dt, accumulator / (1000 / 60));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
