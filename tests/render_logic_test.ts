/**
 * Headless tests for the renderer's pure logic: coordinate mapping, tick
 * interpolation (including many ticks per frame), and the photosensitivity
 * flash guard. Nothing here needs WebGL.
 */

import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { SimState } from "../src/contracts/index.ts";
import { DEFAULT_LOADOUT, PAINT_IDS_FOR_TEST } from "./render_fixtures.ts";
import { bloomDamping } from "../src/render/post.ts";
import { PAINT, TRAIL } from "../src/render/loadout.ts";
import { BLOOM_THRESHOLD, ROLE, SCENE_LOOKS } from "../src/render/palette.ts";
import {
  FIELD_D,
  FIELD_W,
  simToWorldX,
  simToWorldZ,
  worldToSimX,
  worldToSimY,
} from "../src/render/coords.ts";
import { SnapshotInterpolator } from "../src/render/interp.ts";
import {
  FlashGuard,
  REDUCED_LIMITS,
  STANDARD_LIMITS,
} from "../src/render/flashGuard.ts";

Deno.test("playfield maps to a centered 12 x 16 plane, +y down to +Z", () => {
  assertEquals(FIELD_W, 12);
  assertEquals(FIELD_D, 16);
  assertEquals(simToWorldX(240), 0);
  assertEquals(simToWorldZ(0), -8); // top of the screen is far from camera
  assertEquals(simToWorldZ(640), 8);
  assertEquals(worldToSimX(simToWorldX(123)), 123);
  assertEquals(worldToSimY(simToWorldZ(456)), 456);
});

function fakeState(tick: number, x: number, enemyX: number): SimState {
  return {
    tick,
    seed: 1,
    phase: "sector",
    outcome: null,
    sector: 1,
    player: {
      focused: false,
      movement: {
        version: 1,
        profile: "classic",
        focused: false,
        envelope: 0,
        neutralTicks: 7,
        coastX: 0,
        coastY: 0,
        brake: 0,
      },
      pos: { x, y: 500 },
      radius: 6,
      lives: 3,
      power: 1,
      shielded: false,
      graceTicks: 0,
      bank: x / 1000,
      vel: { x: 0, y: 0 },
      trigger: "rest",
      chargeLevel: 0,
      charge: 0,
      scan: { active: false, halfAngle: 0.3, range: 300, targetId: null },
    },
    enemies: [{
      id: 7,
      kind: "drone",
      pos: { x: enemyX, y: 100 },
      radius: 13,
      hp: 2,
      maxHp: 2,
      age: tick,
      ai: "patrol",
      aiTicks: 0,
      parts: [],
      weakPoint: { offset: { x: 0, y: 0 }, radius: 4 },
      lock: 0,
      locked: false,
      disarmed: false,
    }],
    bullets: [],
    pickups: [],
    boss: null,
    score: 0,
    kills: 0,
    pay: { credits: 0, rate: 1, chainTicks: 0, chainMax: 1 },
    graze: { meter: 0, count: 0, radius: 18 },
    scoutsSpared: 0,
    flags: {
      pacifistIntact: true,
      neverFired: true,
      recorderRecovered: false,
      firstPowerupTaken: false,
    },
    loadout: DEFAULT_LOADOUT,
  };
}

Deno.test("interpolator blends the last two ticks by alpha", () => {
  const interp = new SnapshotInterpolator();
  interp.observe(fakeState(1, 100, 200));
  interp.observe(fakeState(2, 110, 210));
  const out = { x: 0, y: 0 };
  assertEquals(interp.playerPosition(0, out).x, 100);
  assertEquals(interp.playerPosition(0.5, out).x, 105);
  assertEquals(interp.playerPosition(1, out).x, 110);
  assertEquals(interp.position(7, 0.25, out).x, 202.5);
  assertAlmostEquals(interp.tickAt(0.5), 1.5);
});

Deno.test("many ticks per frame: only the last two matter", () => {
  const interp = new SnapshotInterpolator();
  for (let t = 1; t <= 32; t++) interp.observe(fakeState(t, t * 3, 0));
  const out = { x: 0, y: 0 };
  assertEquals(interp.playerPosition(0, out).x, 31 * 3);
  assertEquals(interp.playerPosition(1, out).x, 32 * 3);
});

Deno.test("observing the same tick twice does not collapse the blend", () => {
  const interp = new SnapshotInterpolator();
  interp.observe(fakeState(1, 100, 0));
  interp.observe(fakeState(2, 120, 0));
  interp.observe(fakeState(2, 120, 0)); // e.g. a frozen sim re-observed
  assertEquals(interp.playerPosition(0.5, { x: 0, y: 0 }).x, 110);
});

Deno.test("a teleport snaps instead of smearing", () => {
  const interp = new SnapshotInterpolator();
  interp.observe(fakeState(1, 20, 0));
  interp.observe(fakeState(2, 460, 0));
  assertEquals(interp.playerPosition(0.5, { x: 0, y: 0 }).x, 460);
});

Deno.test("flash guard: at most three onsets per second by default", () => {
  const g = new FlashGuard(STANDARD_LIMITS);
  let granted = 0;
  for (let t = 0; t < 1000; t += 16) if (g.request(t, 1)) granted++;
  assertEquals(granted, 3);
  assertEquals(g.current <= STANDARD_LIMITS.maxStrength, true);
});

Deno.test("flash guard: reduced flashing caps rate and strength", () => {
  const g = new FlashGuard(REDUCED_LIMITS);
  let granted = 0;
  for (let t = 0; t < 3000; t += 16) if (g.request(t, 1)) granted++;
  assertEquals(granted, 3); // one per second over three seconds
  assertEquals(g.current <= REDUCED_LIMITS.maxStrength, true);
  g.update(5000);
  assertEquals(g.current, 0);
});

Deno.test("value ladder: only chosen roles exceed the bloom threshold", () => {
  // Linear-light luma of a role color times its gain, as the bloom pass sees.
  const luma = (hex: number, gain: number) => {
    const lin = (c: number) => Math.pow(c / 255, 2.2);
    const r = lin((hex >> 16) & 255), g = lin((hex >> 8) & 255);
    const b = lin(hex & 255);
    return (0.299 * r + 0.587 * g + 0.114 * b) * gain;
  };
  const glows = (k: keyof typeof ROLE) =>
    luma(ROLE[k].hex, ROLE[k].gain) > BLOOM_THRESHOLD;
  assertEquals(glows("playerEngine"), true);
  assertEquals(glows("heavyRim"), true);
  assertEquals(glows("playerShot"), false);
  assertEquals(glows("enemyTrim"), false);
  assertEquals(glows("world"), false);
  // Enemy fire outranks player fire.
  assertEquals(ROLE.dangerRim.gain > ROLE.playerShot.gain, true);
});

Deno.test("bloom damps under bullet density, within 0.5–1", () => {
  assertEquals(bloomDamping(0), 1);
  assertEquals(bloomDamping(40), 1);
  assertAlmostEquals(bloomDamping(140), 0.5);
  assertEquals(bloomDamping(2000), 0.5);
});

Deno.test("scene looks never use the danger hue for the world", () => {
  for (const look of Object.values(SCENE_LOOKS)) {
    assertEquals(look.worldA === ROLE.dangerRim.hex, false);
    assertEquals(look.worldB === ROLE.dangerRim.hex, false);
  }
});

Deno.test("loadout tables cover every cosmetic id", () => {
  for (const id of PAINT_IDS_FOR_TEST) {
    assertEquals(typeof PAINT[id], "number");
  }
  assertEquals(Object.keys(TRAIL).length, 4);
});
