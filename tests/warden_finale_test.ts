/**
 * The Warden's finale: the kill timeline's opening pause covers the staged
 * defeat, and Last Approach's lights fail (or swell) by where they stand.
 */

import { assert, assertEquals } from "@std/assert";
import * as THREE from "three";
import {
  type FinalePorts,
  type FinaleSound,
  KILL_STAGING,
  WardenFinale,
} from "../src/render/wardenFinale.ts";
import { DEFEAT_STAGING_MS } from "../src/scenes/endingKill.timeline.ts";

function fakeWarden(): THREE.Group {
  const warden = new THREE.Group();
  for (const name of ["pod_0", "pod_1", "pod_2", "pod_3", "core", "halo"]) {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(name === "pod_0" ? -1 : 1, 0, name === "pod_2" ? 1 : 0);
    warden.add(node);
  }
  warden.position.set(0, 0, -4.75);
  return warden;
}

function fakePorts(sounds: FinaleSound[], torn: string[]): FinalePorts {
  return {
    blast() {},
    ring() {},
    flash() {},
    trauma() {},
    pressure() {},
    tearOff: (node) => void torn.push(node.name),
    power() {},
    sound: (role) => void sounds.push(role),
    scout: () => new THREE.Group(),
  };
}

const FRAME = {
  dt: 1 / 60,
  low: false,
  reducedMotion: false,
  reducedFlashing: false,
};

Deno.test("kill timeline pause covers the staged defeat", () => {
  assert(
    DEFEAT_STAGING_MS >= (KILL_STAGING.settled + KILL_STAGING.hold) * 1000,
  );
  const pods = [...KILL_STAGING.pods];
  assertEquals(pods, [...pods].sort((a, b) => a - b));
  assert(pods[pods.length - 1] < KILL_STAGING.collapse);
});

Deno.test("kill: pods tear off in order, then the collapse, then dark", () => {
  const sounds: FinaleSound[] = [];
  const torn: string[] = [];
  const finale = new WardenFinale(fakePorts(sounds, torn));
  finale.begin("kill", fakeWarden(), false);
  assertEquals(sounds[0], "finale_impact");
  // Before the collapse every light is on.
  assertEquals(finale.power(12, 0, 0, false), 1);
  for (let i = 0; i < 60 * 6; i++) finale.update(FRAME);
  assertEquals(torn, ["pod_2", "pod_0", "pod_1", "pod_3"]);
  assert(sounds.includes("boss_collapse"));
  assert(sounds.indexOf("pod_break") < sounds.indexOf("boss_collapse"));
  // Long after the front passed, a lamp across the lane is out.
  assert(finale.power(12, 0, 0, false) < 0.1);
  // Far beyond the shockwave's reach, still lit.
  assertEquals(finale.power(400, 0, 0, false), 1);
});

Deno.test("pacifist: lights swell from the Warden once the leash is cut", () => {
  const finale = new WardenFinale(fakePorts([], []));
  finale.begin("pacifist", fakeWarden(), true);
  for (let i = 0; i < 60; i++) finale.update(FRAME);
  assertEquals(finale.power(12, 0, 0, false), 1);
  finale.beat("leashCut");
  for (let i = 0; i < 60 * 4; i++) finale.update(FRAME);
  assert(finale.power(12, 0, 0, false) > 1.3);
});

Deno.test("a skip lands on the aftermath without replaying sounds", () => {
  const sounds: FinaleSound[] = [];
  const finale = new WardenFinale(fakePorts(sounds, []));
  finale.begin("kill", fakeWarden(), false);
  const before = sounds.length;
  finale.skipToEnd();
  finale.update(FRAME);
  assertEquals(sounds.length, before);
  assert(finale.power(12, 0, 0, true) < 0.1);
});
