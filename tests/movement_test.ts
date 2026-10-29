import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import type { InputFrame, MovementProfile } from "../src/contracts/index.ts";
import { initialMovement, stepMovement } from "../src/sim/movement.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { parseUrlFlags } from "../src/contracts/flags.ts";
import { GameplayAudio, type SoundCue } from "../src/audio/gameplayAudio.ts";
import { GAMEPLAY_SOUNDS } from "../src/audio/gameplaySounds.ts";

const origin = { x: 240, y: 300 };
const right = { x: 1, y: 0 };
const neutral = { x: 0, y: 0 };
function controller(profile: MovementProfile) {
  let current = {
    pos: origin,
    movement: initialMovement(profile),
    vel: neutral,
  };
  return (move = right, focus = false) =>
    current = stepMovement(current.pos, current.movement, move, focus);
}

Deno.test("movement flags are typed opt-in, invalid values remain classic", () => {
  assertEquals(parseUrlFlags("").movement, "classic");
  assertEquals(parseUrlFlags("?movement=hybrid").movement, "hybrid");
  assertEquals(parseUrlFlags("?movement=classic").movement, "classic");
  assertEquals(parseUrlFlags("?movement=inertia").movement, "classic");
  assertEquals(parseUrlFlags("?movement=inertia").warnings.length, 1);
});

Deno.test("hybrid first tick126, tick16 252px/s, cruise release168/84/0", () => {
  const step = controller("hybrid");
  for (let tick = 0; tick < 16; tick++) {
    assertAlmostEquals(step().vel.x * 60, Math.min(252, 126 + tick * 8.4));
  }
  const released = [step(neutral), step(neutral), step(neutral)];
  [168, 84, 0].forEach((speed, i) =>
    assertAlmostEquals(released[i].vel.x * 60, speed)
  );
  assertAlmostEquals(
    released.reduce((sum, value) => sum + value.vel.x, 0),
    4.2,
  );
});

for (const profile of ["classic", "hybrid"] as const) {
  Deno.test(`${profile}: normalize diagonals, preserve partial analogue, instant reverse/corner`, () => {
    const cardinal = controller(profile);
    const diagonal = controller(profile);
    const partial = controller(profile);
    for (let tick = 0; tick < 16; tick++) {
      const a = cardinal();
      const b = diagonal({ x: 1, y: 1 });
      const c = partial({ x: 0.3, y: 0.4 });
      assertAlmostEquals(Math.hypot(b.vel.x, b.vel.y), a.vel.x);
      assertAlmostEquals(Math.hypot(c.vel.x, c.vel.y), a.vel.x / 2);
    }
    const corner = cardinal({ x: 0, y: -1 });
    assertAlmostEquals(corner.vel.x, 0);
    assertAlmostEquals(corner.vel.y, -4.2);
    const reverse = cardinal({ x: 0, y: 1 });
    assertAlmostEquals(reverse.vel.y, 4.2);
    assertAlmostEquals(cardinal(right, true).vel.x, 2);
    assertAlmostEquals(cardinal({ x: 0.5, y: 0 }, true).vel.x, 1);
    assertEquals(cardinal(neutral, true).vel, neutral);
    assertAlmostEquals(cardinal().vel.x, profile === "hybrid" ? 2.1 : 4.2);
  });

  Deno.test(`${profile}: fixed input replay includes response state and focus transitions only`, () => {
    const make = () =>
      createSim({
        seed: 121,
        difficulty: "normal",
        start: { kind: "tutorial" },
        movement: profile,
      });
    const a = make();
    const b = make();
    const cues: SoundCue[] = [];
    const audio = new GameplayAudio({
      play: (cue) => cues.push(cue),
      loop() {},
    });
    let transitions = 0;
    for (let tick = 0; tick < 180; tick++) {
      const input: InputFrame = {
        move: tick < 30 ? right : tick < 70 ? { x: -1, y: -1 } : neutral,
        focus: tick >= 50 && tick < 100,
        fire: false,
        pause: false,
        confirm: false,
        back: false,
      };
      const events = a.step(input);
      assertEquals(events, b.step(input));
      const snapshot = a.snapshot();
      for (const event of events) {
        if (event.type === "focusChanged") {
          transitions++;
          assertEquals(event.active, snapshot.player.focused);
          audio.onEvent(event, snapshot);
        }
      }
      assertEquals(hashSimState(snapshot), hashSimState(b.snapshot()));
      assertEquals(snapshot.player.movement.profile, profile);
    }
    assertEquals(transitions, 2);
    assertEquals(cues.map((c) => c.role), ["focus_enter", "focus_exit"]);
    for (
      const role of [GAMEPLAY_SOUNDS.focus_enter, GAMEPLAY_SOUNDS.focus_exit]
    ) {
      assertEquals(role.layer, "feel");
      assertEquals(role.sample, false);
      assert(!("quantize" in role));
      assert(!("nudgeS" in role));
    }
    a.resetMovement();
    assertEquals(a.snapshot().player.vel, neutral);
    assertEquals(a.snapshot().player.movement.envelope, 0);
  });
}

Deno.test("hybrid neutral-gap memory, precision release, wall coast do not store a launch", () => {
  for (const gap of [1, 6, 7]) {
    const step = controller("hybrid");
    for (let tick = 0; tick < 16; tick++) step();
    for (let tick = 0; tick < gap; tick++) step(neutral);
    assertAlmostEquals(step({ x: 0, y: -1 }).vel.y, gap > 6 ? -2.1 : -4.2);
  }
  const step = controller("hybrid");
  for (let tick = 0; tick < 16; tick++) step();
  step(neutral);
  assertEquals(step(neutral, true).vel, neutral);
  const wall = stepMovement(
    { x: 462, y: 300 },
    { ...initialMovement("hybrid"), envelope: 4.2, neutralTicks: 0 },
    right,
    false,
  );
  assertEquals(wall.vel, neutral);
  assertEquals(
    stepMovement(wall.pos, wall.movement, neutral, false).vel,
    neutral,
  );
  assertAlmostEquals(
    stepMovement(wall.pos, wall.movement, { x: -1, y: 0 }, false).vel.x,
    -4.2,
  );
});
