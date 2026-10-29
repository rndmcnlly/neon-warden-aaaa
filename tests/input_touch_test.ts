/**
 * Touch schemes over one InputFrame (src/input/touchPilot.ts). Each test
 * drives fingers with explicit timestamps and reads once per 60 Hz tick,
 * exactly as the input layer does.
 */
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  dragGain,
  TOUCH,
  type TouchConfig,
  TouchPilot,
} from "../src/input/touchPilot.ts";
import { PLAYER } from "../src/sim/tuning.ts";

const TICK = 1000 / 60;

function cfg(patch: Partial<TouchConfig> = {}): TouchConfig {
  return {
    scheme: "thumbs",
    sensitivity: 1,
    unitsPerPx: 1,
    autoFire: false,
    holdToggle: "hold",
    ...patch,
  };
}

/** Reads `n` ticks starting at `t0`, returning the fire states. */
function fires(p: TouchPilot, c: TouchConfig, t0: number, n: number) {
  const out: boolean[] = [];
  for (let i = 0; i < n; i++) out.push(p.read(t0 + i * TICK, c).fire);
  return out;
}

Deno.test("touch: relative drag pays out travel at most top speed per tick", () => {
  const p = new TouchPilot();
  const c = cfg();
  p.moveStart(1, 100, 500, 0);
  // A slow 6 px drag over 100 ms: slow gain applies.
  p.moveTo(1, 106, 500, 100, c);
  const expected = 6 * dragGain(0.06);
  const first = p.read(100, c);
  assertAlmostEquals(first.move.x, expected / PLAYER.speed, 1e-9);
  assertEquals(first.move.y, 0);
  // Nothing more banked: the next tick is still.
  assertEquals(p.read(117, c).move.x, 0);
});

Deno.test("touch: a fast flick is banked over ticks but capped, and lifting stops", () => {
  const p = new TouchPilot();
  const c = cfg();
  p.moveStart(1, 0, 0, 0);
  p.moveTo(1, 200, 0, 16, c); // 12.5 px/ms: full fast gain.
  const a = p.read(16, c);
  assertEquals(a.move.x, 1, "full speed, never above 1");
  const b = p.read(32, c);
  assertEquals(b.move.x, 1);
  const cTick = p.read(48, c);
  assertEquals(cTick.move.x, 1);
  // The bank was capped at three ticks of travel: now it is empty.
  assertEquals(p.read(64, c).move.x, 0);
  // Lift mid-flight: no drift afterwards.
  p.moveStart(2, 0, 0, 100);
  p.moveTo(2, 200, 0, 116, c);
  p.moveEnd(2);
  assertEquals(p.read(116, c).move.x, 0);
});

Deno.test("touch: diagonals are clamped by magnitude like the sim", () => {
  const p = new TouchPilot();
  const c = cfg();
  p.moveStart(1, 0, 0, 0);
  p.moveTo(1, 100, 100, 10, c);
  const r = p.read(10, c);
  assertAlmostEquals(Math.hypot(r.move.x, r.move.y), 1, 1e-9);
});

Deno.test("touch: a second finger never steers (no required multi-touch)", () => {
  const p = new TouchPilot();
  assert(p.moveStart(1, 0, 0, 0));
  assert(!p.moveStart(2, 50, 50, 0), "second flying finger refused");
  p.moveTo(2, 300, 300, 10, cfg());
  assertEquals(p.read(10, cfg()).move.x, 0);
});

Deno.test("touch thumbs: tap, hold and rest are the raw held state", () => {
  const p = new TouchPilot();
  const c = cfg();
  p.fireStart(0);
  const held = fires(p, c, 0, 12);
  assert(held.every(Boolean), "held FIRE is fire for every tick");
  p.fireEnd(c);
  assert(!fires(p, c, 200, 30).some(Boolean), "released FIRE rests");
  // Writ release is just the next press edge; the sim spends the charge.
  p.fireStart(800);
  assertEquals(p.read(800, c).fire, true);
});

Deno.test("touch thumbs, toggle setting: each FIRE press flips the stream", () => {
  const p = new TouchPilot();
  const c = cfg({ holdToggle: "toggle" });
  p.fireStart(0);
  p.fireEnd(c);
  assert(fires(p, c, 0, 20).every(Boolean), "latched on");
  p.fireStart(500);
  p.fireEnd(c);
  assert(!fires(p, c, 500, 20).some(Boolean), "latched off");
});

Deno.test("touch one finger: tap pulses under the tap threshold", () => {
  const p = new TouchPilot();
  const c = cfg({ scheme: "oneFinger" });
  p.fireStart(0);
  p.read(0, c);
  p.fireEnd(c);
  const after = fires(p, c, 50, 12);
  const on = after.filter(Boolean).length;
  assertEquals(on, TOUCH.pulseTicks, "a pulse, then rest");
  assert(on < 8, "under TRIGGER.tapThreshold: a tap, never a stream");
  assertEquals(after.slice(on).some(Boolean), false);
});

Deno.test("touch one finger: long-press latches the stream, a tap stops it", () => {
  const p = new TouchPilot();
  const c = cfg({ scheme: "oneFinger" });
  p.fireStart(0);
  assert(!p.read(100, c).fire, "nothing before the long-press");
  assert(p.read(TOUCH.longPressMs + 1, c).fire, "latched at 400 ms");
  p.fireEnd(c);
  assert(fires(p, c, 600, 30).every(Boolean), "keeps streaming, finger up");
  assert(p.view.latched);
  // Now the same finger may fly while streaming: never two touches.
  p.moveStart(1, 0, 0, 1200);
  p.fireStart(1300);
  p.fireEnd(c);
  assert(!fires(p, c, 1300, 20).some(Boolean), "a tap ends the stream");
});

Deno.test("touch arcade: the flying finger is the trigger", () => {
  const p = new TouchPilot();
  const c = cfg({ scheme: "arcade" });
  assertEquals(p.read(0, c).fire, false);
  p.moveStart(1, 0, 0, 0);
  assert(fires(p, c, 0, 10).every(Boolean));
  p.moveEnd(1);
  assert(!fires(p, c, 200, 10).some(Boolean), "lift to rest and charge");
});

Deno.test("touch auto-fire: pulse auto streams only while moving", () => {
  const p = new TouchPilot();
  const c = cfg({ autoFire: true });
  p.moveStart(1, 0, 0, 0);
  p.moveTo(1, 10, 0, 16, c);
  assertEquals(p.read(20, c).fire, true);
  assertEquals(p.read(16 + TOUCH.movingWindowMs + 1, c).fire, false);
});

Deno.test("touch focus toggles and switches the payout speed", () => {
  const p = new TouchPilot();
  const c = cfg();
  p.toggleFocus();
  p.moveStart(1, 0, 0, 0);
  p.moveTo(1, 1, 0, 100, c);
  const r = p.read(100, c);
  assert(r.focus);
  assertAlmostEquals(r.move.x, dragGain(0.01) / PLAYER.focusSpeed, 1e-9);
  p.reset();
  assertEquals(p.read(200, c).focus, false, "reset drops focus too");
});
