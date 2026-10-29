import { assert, assertEquals } from "@std/assert";
import type { InputFrame, MovementProfile } from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import {
  type EngineMove,
  GameplayAudio,
  type SoundCue,
} from "../src/audio/gameplayAudio.ts";
import { ENGINE_BED_TUNING, engineTarget } from "../src/audio/engineBed.ts";
import { GAMEPLAY_SOUNDS } from "../src/audio/gameplaySounds.ts";

const still = { x: 0, y: 0 };
const full = { x: ENGINE_BED_TUNING.fullSpeed, y: 0 };

Deno.test("engine bed: speed lifts the hum, acceleration drives the thrust", () => {
  const rest = engineTarget(still, still, false, 240, false);
  const cruise = engineTarget(full, full, false, 240, false);
  const kick = engineTarget(full, still, false, 240, false);
  assert(cruise.humGain > rest.humGain);
  assert(cruise.detune > rest.detune && cruise.detune <= 300);
  assert(cruise.humCutoff > rest.humCutoff);
  assert(
    kick.thrustGain > cruise.thrustGain,
    "a start hisses more than a cruise",
  );
  assertEquals(rest.thrustGain, 0);
});

Deno.test("engine bed: focus is quieter, darker and narrower; mono centers it", () => {
  const open = engineTarget(full, full, false, 470, false);
  const focus = engineTarget(full, full, true, 470, false);
  assert(focus.bedGain < open.bedGain);
  assert(focus.humCutoff < open.humCutoff);
  assert(focus.thrustQ > open.thrustQ);
  assert(Math.abs(focus.pan) < Math.abs(open.pan));
  assert(open.pan > 0, "right of center pans right");
  assertEquals(engineTarget(full, full, false, 470, true).pan, 0);
});

for (const profile of ["classic", "hybrid"] as MovementProfile[]) {
  Deno.test(`${profile}: engine follows every tick; reverse and stop make one transient each`, () => {
    const sim = createSim({
      seed: 121,
      difficulty: "normal",
      start: { kind: "tutorial" },
      movement: profile,
    });
    const cues: SoundCue[] = [];
    const moves: (EngineMove | null)[] = [];
    const audio = new GameplayAudio({
      play: (cue) => cues.push(cue),
      loop() {},
      engine: (m) => moves.push(m),
    });
    const at: Record<string, number[]> = {};
    let reverseSide = 0;
    for (let tick = 0; tick < 160; tick++) {
      const x = tick < 40 ? 1 : tick < 80 ? -1 : tick < 110 ? 0 : 1;
      const input: InputFrame = {
        move: { x, y: 0 },
        focus: tick >= 110,
        fire: false,
        pause: false,
        confirm: false,
        back: false,
      };
      const before = cues.length;
      for (const e of sim.step(input)) audio.onEvent(e, sim.snapshot());
      audio.frame(sim.snapshot());
      for (const c of cues.slice(before)) {
        (at[c.role] ??= []).push(tick);
        if (c.role === "move_reverse") {
          reverseSide = c.pos!.x - sim.snapshot().player.pos.x;
        }
      }
    }
    assertEquals(moves.length, 160);
    assert(moves.every((m) => m !== null));
    // One reversal at tick 40, one stop shortly after tick 80 (hybrid brakes
    // over three ticks), and nothing from cruising in a straight line.
    assertEquals(at.move_reverse?.length, 1);
    assert(at.move_reverse[0] >= 40 && at.move_reverse[0] <= 43);
    assertEquals(at.move_stop?.length, 1);
    assert(at.move_stop[0] >= 80 && at.move_stop[0] <= 85);
    // Focus reaches the engine bed.
    assert(moves[150]?.focused);
    // The transient pans toward the nozzle that fired: reversing to the
    // left pushes from the right-hand side.
    assert(reverseSide > 0);
  });
}

Deno.test("movement transients: quiet, single-voice, rate-limited feel cues", () => {
  for (
    const role of [GAMEPLAY_SOUNDS.move_reverse, GAMEPLAY_SOUNDS.move_stop]
  ) {
    assertEquals(role.layer, "feel");
    assertEquals(role.cap, 1);
    assert(role.gainDb <= -18);
    assert((role.minGapMs ?? 0) >= 100);
    assert(role.priority < GAMEPLAY_SOUNDS.enemy_fire.priority);
  }
});

Deno.test("engine bed stops when the run ends or resets", () => {
  const moves: (EngineMove | null)[] = [];
  const audio = new GameplayAudio({
    play() {},
    loop() {},
    engine: (m) => moves.push(m),
  });
  audio.reset();
  assertEquals(moves, [null]);
});
