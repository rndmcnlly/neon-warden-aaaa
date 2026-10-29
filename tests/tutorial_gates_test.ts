import { assert, assertEquals } from "@std/assert";
import {
  IDLE_INPUT,
  type InputFrame,
  type SimEvent,
} from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { TutorialProgress } from "../src/director/tutorialProgress.ts";
import { FLAGS as F } from "../src/scenes/flags.ts";
import { ALL_BANKS } from "../src/scenes/banks/index.ts";
import { CommentaryScheduler } from "../src/director/commentary.ts";

const left = { ...IDLE_INPUT, move: { x: -1, y: 0 } };
const right = { ...IDLE_INPUT, move: { x: 1, y: 0 } };
const fire = { ...IDLE_INPUT, fire: true };
const focus = { ...IDLE_INPUT, focus: true };
function rig() {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const flags = new Set<string>();
  let gate: string | null = null;
  let mode = "hold";
  const corrections: string[] = [];
  const progress = new TutorialProgress({
    waitingFlag: () => gate,
    inputMode: () => mode,
    setFlag: (f) => flags.add(f),
    getFlag: (f) => flags.has(f),
    interject: () => true,
    correction: (m) => corrections.push(m),
  });
  const tick = (input: InputFrame = IDLE_INPUT, count = 1) => {
    for (let i = 0; i < count; i++) {
      progress.input(input, sim.snapshot());
      for (const event of sim.step(input)) progress.note(event);
    }
  };
  return {
    sim,
    progress,
    flags,
    corrections,
    tick,
    activate: (f: string | null) => {
      gate = f;
    },
    mode: (value: string) => {
      mode = value;
    },
  };
}

Deno.test("gates: no input, browser focus and passive charge never complete a lesson", () => {
  const r = rig();
  for (
    const gate of [
      F.tutMovedLeft,
      F.tutFocused,
      F.tutFired,
      F.tutCharged,
      F.tutLocked,
      F.tutRateDoubled,
    ]
  ) {
    r.activate(gate);
    r.tick(IDLE_INPUT, 240);
  }
  assertEquals([...r.flags], []);
});

Deno.test("gates: too-early keyboard actions do not pre-credit future instructions", () => {
  const r = rig();
  for (const input of [left, right, focus, fire, IDLE_INPUT]) {
    r.tick(input, 100);
  }
  assertEquals([...r.flags], []);
  r.activate(F.tutFocused);
  r.tick();
  r.tick();
  assert(!r.flags.has(F.tutFocused));
  r.tick(focus);
  assertEquals([...r.flags], [F.tutFocused]);
});

Deno.test("gates: held movement and focus require a new press after activation", () => {
  for (
    const [flag, input] of [[F.tutMovedLeft, left], [
      F.tutFocused,
      focus,
    ]] as const
  ) {
    const r = rig();
    r.tick(input);
    r.activate(flag);
    r.tick(input, 120);
    assert(!r.flags.has(flag));
    r.tick();
    r.tick(input);
    assert(r.flags.has(flag));
  }
});

Deno.test("gates: wrong action cannot complete the gate or pre-credit another", () => {
  const r = rig();
  r.activate(F.tutMovedLeft);
  r.tick();
  r.tick(right);
  r.tick(focus);
  r.tick(fire);
  assertEquals([...r.flags], []);
  assertEquals(r.corrections, ["tutorialOtherLeft"]);
  r.tick(left);
  assertEquals([...r.flags], [F.tutMovedLeft]);
});

Deno.test("gates: a stale fire stream is not a fresh demonstration", () => {
  const r = rig();
  r.tick(fire, 30);
  r.activate(F.tutStreamed);
  r.tick(fire, 100);
  assert(!r.flags.has(F.tutStreamed));
  r.tick();
  r.tick(fire, 40);
  assertEquals([...r.flags], [F.tutStreamed]);
});

Deno.test("gates: changing accessibility mode is neither a press nor a mistake", () => {
  const r = rig();
  r.activate(F.tutFired);
  r.tick();
  r.mode("autofire");
  r.tick(fire, 40);
  assert(!r.flags.has(F.tutFired));
  assertEquals(r.corrections, []);
  // Auto-fire users pause and resume with their one button. That resolved
  // false-to-true action is a valid fresh demonstration, as on touch.
  r.tick();
  r.tick(fire, 20);
  assert(r.flags.has(F.tutFired));
});

Deno.test("gates: fresh first-tick press is accepted, toggle focus is action-level", () => {
  const r = rig();
  r.tick();
  r.activate(F.tutFocused);
  r.tick(focus);
  assert(r.flags.has(F.tutFocused));
  assertEquals(r.corrections, []);
});

Deno.test("gates: active target drill still counts the disarming trick shot", () => {
  const r = rig();
  r.sim.setStoryFlag(F.tutSpawnTarget, true);
  r.activate(F.tutTargetDestroyed);
  r.tick();
  for (let t = 0; t < 500 && !r.flags.has(F.tutTargetDestroyed); t++) {
    r.tick(t % 19 < 2 ? fire : IDLE_INPUT);
  }
  assert(r.flags.has(F.tutTargetDestroyed));
});

Deno.test("gates: tap count from initial fire lesson does not leak into tap lesson", () => {
  const r = rig();
  r.activate(F.tutFired);
  r.tick();
  r.tick(fire);
  r.tick(IDLE_INPUT, 18);
  r.activate(F.tutTapped);
  r.tick();
  for (let i = 0; i < 2; i++) {
    r.tick(fire);
    r.tick(IDLE_INPUT, 18);
  }
  assert(!r.flags.has(F.tutTapped));
  r.tick(fire);
  assert(r.flags.has(F.tutTapped));
});

Deno.test("gates: three fresh taps, not old shots, demonstrate trigger discipline", () => {
  const r = rig();
  for (let i = 0; i < 4; i++) {
    r.tick(fire);
    r.tick(IDLE_INPUT, 18);
  }
  r.activate(F.tutTapped);
  r.tick();
  for (let i = 0; i < 2; i++) {
    r.tick(fire);
    r.tick(IDLE_INPUT, 18);
  }
  assert(!r.flags.has(F.tutTapped));
  r.tick(fire);
  assert(r.flags.has(F.tutTapped));
  assert(!r.flags.has(F.tutWritFired));
});

Deno.test("gates: deliberate release and rest charge; precharged idle does not", () => {
  const r = rig();
  r.tick(IDLE_INPUT, 300);
  r.activate(F.tutCharged);
  r.tick(IDLE_INPUT, 100);
  assert(!r.flags.has(F.tutCharged));
  r.tick(fire, 15);
  r.tick(IDLE_INPUT, 300);
  assert(r.flags.has(F.tutCharged));
});

Deno.test("gates: old projectile results cannot pre-credit target or part drills", () => {
  const r = rig();
  r.activate(F.tutPartBroken);
  r.tick();
  const event = {
    type: "partBreak",
    tick: 1,
    id: 1,
    target: "enemy",
    part: "gun",
    partKind: "gun",
    pos: { x: 0, y: 0 },
    by: "aimed",
    first: true,
  } as SimEvent;
  r.progress.note(event);
  assert(!r.flags.has(F.tutPartBroken));
  r.tick(fire);
  r.progress.note(event);
  assert(r.flags.has(F.tutPartBroken));
});

Deno.test("corrections: scheduler yields to teaching, cools down, exhausts its bag", () => {
  let now = 0;
  let teaching = true;
  const lines: string[] = [];
  const scheduler = new CommentaryScheduler(ALL_BANKS, {
    now: () => now,
    sceneId: () => "tutorial",
    bark: () => false,
    interject: (line) => {
      if (teaching) return false;
      lines.push(line);
      return true;
    },
    random: () => 0,
  });
  const ctx = {
    phase: "tutorial",
    sector: 1,
    bossPhase: null,
    livesLeft: 3,
    hasFired: false,
    neverFired: true,
  } as const;
  assertEquals(scheduler.onApp("tutorialOtherLeft", ctx), null);
  teaching = false;
  assert(scheduler.onApp("tutorialOtherLeft", ctx));
  assertEquals(scheduler.onApp("tutorialOtherLeft", ctx), null);
  for (let i = 0; i < 3; i++) {
    now += 17000;
    assert(scheduler.onApp("tutorialOtherLeft", ctx));
  }
  assertEquals(new Set(lines).size, 4);
});
