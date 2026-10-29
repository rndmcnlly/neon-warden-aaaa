/**
 * Bolt identity (src/render/shotLooks.ts): every player round wears the look
 * of the trigger expression that fired it, and the Writ's knock scales with
 * charge while accessibility settings remove it exactly.
 */
import { assert, assertEquals } from "@std/assert";
import * as THREE from "three";
import { type BulletView, IDLE_INPUT } from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { TRIGGER } from "../src/sim/tuning.ts";
import { CameraRig } from "../src/render/cameraRig.ts";
import {
  classifyShot,
  KNOCK,
  PressureWave,
  ShipKnock,
  ShotTagger,
} from "../src/render/shotLooks.ts";

const shot = (id: number, vx: number, vy: number, radius: number) =>
  ({
    id,
    kind: "shot",
    pos: { x: 0, y: 0 },
    vel: { x: vx, y: vy },
    radius,
  }) as BulletView;

const ctx = {
  player: new THREE.Vector3(),
  boss: new THREE.Vector3(0, 0, -8),
  stagePoint: new THREE.Vector3(),
  hangarPoint: new THREE.Vector3(),
  timeSec: 0,
  aspect: 16 / 9,
};

Deno.test("bolt identity: fallback classification reads tuning", () => {
  assertEquals(classifyShot(shot(1, 0, -TRIGGER.aimedSpeed, 5)).shot, "aimed");
  assertEquals(classifyShot(shot(2, 1.5, -16.5, 6)).shot, "stream");
  assertEquals(classifyShot(shot(3, 0, -TRIGGER.writSpeed, 8)), {
    shot: "writ",
    level: 1,
  });
  assertEquals(classifyShot(shot(4, 0, -TRIGGER.writSpeed, 14)).level, 3);
});

Deno.test("bolt identity: new rounds take the step's volley tag", () => {
  const tagger = new ShotTagger();
  const a = shot(10, 0, -TRIGGER.writSpeed, 18); // heavy Writ radius
  tagger.observe([a], { shot: "writ", level: 2 });
  assertEquals(tagger.get(a), { shot: "writ", level: 2 });
  // Old rounds keep their tag when a later volley arrives.
  const b = shot(11, 0, -16.5, 6);
  tagger.observe([a, b], { shot: "stream", level: 0 });
  assertEquals(tagger.get(a).shot, "writ");
  assertEquals(tagger.get(b).shot, "stream");
  // Gone rounds are forgotten.
  tagger.observe([b], null);
  // A forgotten id falls back to classification (radius 18 reads as level 3).
  assertEquals(tagger.get(a).level, 3);
});

Deno.test("bolt identity: tags agree with the sim across a tap, a hold and a Writ", () => {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const tagger = new ShotTagger();
  const seen = new Map<number, string>();
  const run = (fire: boolean, ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      const events = sim.step({ ...IDLE_INPUT, fire });
      const fired = events.find((e) => e.type === "playerFired");
      const state = sim.snapshot();
      tagger.observe(
        state.bullets,
        fired?.type === "playerFired" ? fired : null,
      );
      if (fired?.type === "playerFired") {
        for (const b of state.bullets) {
          if (b.kind === "shot" && !seen.has(b.id)) {
            seen.set(b.id, fired.shot);
            assertEquals(tagger.get(b).shot, fired.shot);
          }
        }
      }
    }
  };
  run(false, 130); // rest to full charge
  run(true, 3); // press edge: Writ
  run(false, 20);
  run(true, 3); // tap
  run(false, 20);
  run(true, 40); // hold: stream
  const kinds = new Set(seen.values());
  assert(kinds.has("writ") && kinds.has("aimed") && kinds.has("stream"));
});

Deno.test("bolt identity: Writ knock scales by level and beats the tap", () => {
  const base = new CameraRig();
  base.update(0, ctx);
  const z = (kind: "aimed" | "writ", level: number) => {
    const rig = new CameraRig();
    rig.kickShot(kind, level);
    rig.update(0, ctx);
    return base.camera.position.z - rig.camera.position.z;
  };
  const tap = z("aimed", 0);
  const w = [1, 2, 3].map((l) => z("writ", l));
  assert(Math.abs(tap - KNOCK.tap.camera) < 1e-9);
  assert(tap < w[0] && w[0] < w[1] && w[1] < w[2]);
  assert(Math.abs(w[2] - KNOCK.writ[2].camera) < 1e-9);
  // Settles to exactly zero.
  const rig = new CameraRig();
  rig.kickShot("writ", 3);
  rig.update(0, ctx);
  rig.update(1000, ctx);
  rig.update(0, ctx);
  assertEquals(rig.camera.position.toArray(), base.camera.position.toArray());
});

Deno.test("bolt identity: shake zero and reduced motion remove every knock", () => {
  for (const mode of ["off", "motion"] as const) {
    const rig = new CameraRig();
    const base = new CameraRig();
    base.update(0, ctx);
    if (mode === "off") rig.shakeScale = 0;
    else rig.reduceMotion = true;
    rig.kickShot("writ", 3);
    rig.update(0, ctx);
    assertEquals(rig.camera.position.toArray(), base.camera.position.toArray());
    const knock = new ShipKnock();
    if (mode === "off") knock.scale = 0;
    else knock.reduceMotion = true;
    knock.kick(3);
    knock.update(0);
    assertEquals([knock.offset, knock.pitch], [0, 0]);
  }
  const knock = new ShipKnock();
  knock.kick(3);
  assertEquals(knock.offset, KNOCK.writ[2].ship);
  knock.update(2000);
  assertEquals(knock.offset, 0);
  const wave = new PressureWave();
  wave.enabled = false;
  wave.start(0.5, 0.5, 3);
  wave.update(0.01);
  assertEquals(wave.strength, 0);
});
