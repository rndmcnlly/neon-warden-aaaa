import { assert, assertEquals } from "@std/assert";
import * as THREE from "three";
import { sweptCircle } from "../src/sim/sweep.ts";
import { CameraRig } from "../src/render/cameraRig.ts";
import { ShotTrails } from "../src/render/shotTrails.ts";
import { SnapshotInterpolator } from "../src/render/interp.ts";
import { createSim } from "../src/sim/sim.ts";
import { IDLE_INPUT } from "../src/contracts/index.ts";

Deno.test("projectile speeds and muzzle-to-top transit are measured at fixed ticks", () => {
  for (
    const [kind, speed, transit] of [["aimed", 21, 26], ["stream", 16.5, 33], [
      "writ",
      18,
      31,
    ]] as const
  ) {
    const sim = createSim({
      seed: 121,
      start: { kind: "tutorial" },
      difficulty: "normal",
    });
    if (kind === "writ") { for (let i = 0; i < 40; i++) sim.step(IDLE_INPUT); }
    for (let i = 0; i < (kind === "stream" ? 9 : 1); i++) {
      sim.step({ ...IDLE_INPUT, fire: true });
    }
    const bullet = sim.snapshot().bullets.find((b) => b.vel.y === -speed)!;
    assert(bullet);
    assertEquals(bullet.pos.y, 542 - speed);
    let ticks = 1;
    while (sim.snapshot().bullets.find((b) => b.id === bullet.id)!.pos.y > 0) {
      sim.step(IDLE_INPUT);
      ticks++;
    }
    assertEquals(ticks, transit);
  }
});

Deno.test("sweep catches tiny parts and weakpoints between fast endpoints", () => {
  for (const vy of [-16.5, -18, -21, -100]) {
    for (const radius of [4, 5, 6, 14, 18]) {
      assert(
        sweptCircle({ x: 0, y: vy, vx: 0, vy, radius: 1 }, {
          x: 0,
          y: vy / 2,
          radius,
        }),
      );
      assert(
        !sweptCircle({ x: 0, y: vy, vx: 0, vy, radius: 1 }, {
          x: radius + 2,
          y: vy / 2,
          radius,
        }),
      );
    }
  }
});

const ctx = {
  player: new THREE.Vector3(),
  boss: new THREE.Vector3(),
  stagePoint: new THREE.Vector3(),
  hangarPoint: new THREE.Vector3(),
  timeSec: 1,
  aspect: 1,
};

Deno.test("fast tap crossing a narrow part chord disarms instead of killing hull", () => {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  // Gun center after drift is approximately (248, 531.5). At x=240 its intersection
  // chord is narrower than the 21-unit tick, with both endpoints outside.
  sim.spawnEnemy("drone", 250, 522.25, { passive: true });
  const events = sim.step({ ...IDLE_INPUT, fire: true });
  assert(events.some((e) => e.type === "partBreak"));
  assert(events.some((e) => e.type === "disarm"));
  assert(!events.some((e) => e.type === "kill"));
  assertEquals(sim.snapshot().player.pos, { x: 240, y: 560 });
});
Deno.test("fast piercing Writ resolves multiple crossed hulls in one tick", () => {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  for (let i = 0; i < 40; i++) sim.step(IDLE_INPUT);
  sim.spawnEnemy("drone", 262, 536, { passive: true });
  sim.spawnEnemy("drone", 262, 526, { passive: true });
  const events = sim.step({ ...IDLE_INPUT, fire: true });
  assertEquals(events.filter((e) => e.type === "kill").length, 2);
});

Deno.test("camera recoil: tap immediate, stream absent, settles; accessibility exact zero", () => {
  const base = new CameraRig();
  base.update(0, ctx);
  for (const mode of ["off", "motion", "stream", "tap"] as const) {
    const rig = new CameraRig();
    if (mode === "off") rig.shakeScale = 0;
    if (mode === "motion") rig.reduceMotion = true;
    rig.kickShot(mode === "stream" ? "stream" : "aimed");
    rig.update(0, ctx);
    if (mode === "tap") assert(rig.camera.position.z < base.camera.position.z);
    else {
      assertEquals(
        rig.camera.position.toArray(),
        base.camera.position.toArray(),
      );
      assertEquals(
        rig.camera.quaternion.toArray(),
        base.camera.quaternion.toArray(),
      );
    }
    rig.update(500, ctx);
    rig.update(0, ctx);
    assertEquals(rig.camera.position.toArray(), base.camera.position.toArray());
  }
});

Deno.test("shot chips bounded, low tier clears, seek does not streak", () => {
  const sim = createSim({
    seed: 121,
    start: { kind: "tutorial" },
    difficulty: "normal",
  });
  const interp = new SnapshotInterpolator();
  const trails = new ShotTrails();
  for (let i = 0; i < 600; i++) {
    sim.step({ ...IDLE_INPUT, fire: true });
    interp.observe(sim.snapshot());
    trails.update(sim.snapshot().bullets, interp, 1, 1 / 60, 48);
    assert(trails.mesh.count <= trails.capacity);
  }
  trails.update(sim.snapshot().bullets, interp, 1, 1 / 60, 0);
  assertEquals(trails.mesh.count, 0);
  for (let i = 0; i < 20; i++) sim.step(IDLE_INPUT);
  interp.observe(sim.snapshot());
  trails.update(sim.snapshot().bullets, interp, 1, 1 / 60, 48);
  assertEquals(trails.mesh.count, 0);
  trails.dispose();
});
