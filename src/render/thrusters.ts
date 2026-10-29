/**
 * Thruster puffs and banking: the picture half of MOVE (the sound half is
 * `src/audio/engineBed.ts`). Render-only; nothing here reads input or
 * touches the sim.
 *
 * Puffs come out of the hull edge *opposite* the ship's acceleration, the
 * way attitude jets push a craft: start right and the left nozzles fire,
 * reverse and the leading side kicks. They show the change of motion right
 * at the ship, where the eye already is (research/2026-10-29-av-core-loop/,
 * idea 2; Argon idea 4).
 *
 * Readability rules: puffs are short-lived (0.12–0.2 s), pale and dim (a
 * desaturated cyan-white at low additive strength, well under any bullet
 * core), stretched slivers rather than dots, and drawn before every bullet
 * so enemy fire is always on top. One instanced mesh, a fixed pool and a
 * per-second cap: a twitchy autopilot cannot fill the lane with exhaust.
 */

import * as THREE from "three";

/** Pale, desaturated cyan-white; the instance color scales it down further. */
const PUFF_COLOR = new THREE.Color(0x9fc3cc);
/** Additive strength at birth: low, so a puff never out-values a bullet. */
const PUFF_STRENGTH = 0.75;
/** Acceleration (sim units per tick, per tick) below which nothing fires. */
const ACCEL_THRESHOLD = 0.12;
/** Full speed, sim units per tick (`PLAYER.speed`). */
const FULL_SPEED = 4.2;

export interface ThrusterOptions {
  /** Pool size; the low tier keeps a handful. */
  readonly capacity: number;
  /** Most puffs per second, whatever the input does. */
  readonly perSecond: number;
  /** Puffs per strong burst (a start, a reversal, a stop). */
  readonly burst: number;
}

/** Normal and low (school Chromebook) budgets. */
export const THRUSTER_TIERS: Readonly<
  Record<"full" | "cheap", ThrusterOptions>
> = {
  full: { capacity: 40, perSecond: 48, burst: 4 },
  cheap: { capacity: 10, perSecond: 16, burst: 1 },
};

interface Puff {
  readonly pos: THREE.Vector3;
  readonly vel: THREE.Vector3;
  age: number;
  life: number;
  width: number;
  length: number;
}

export class Thrusters {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private options: ThrusterOptions;
  private budget = 0;
  private lastTick = -1;
  private prevVel = { x: 0, y: 0 };
  private roll = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private readonly dir = new THREE.Vector3();
  private static readonly ALONG = new THREE.Vector3(0, 0, 1);

  constructor(options: ThrusterOptions = THRUSTER_TIERS.full) {
    this.options = options;
    // A flat sliver along +Z with its wide end at the origin: placed at the
    // nozzle, it tapers away along the puff's travel.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([
        -0.5,
        0,
        0,
        0.5,
        0,
        0,
        0,
        0,
        1,
      ], 3),
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, 64);
    this.mesh.name = "thrusters";
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    // Bullets draw at renderOrder 10: exhaust always goes underneath.
    this.mesh.renderOrder = 2;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(64 * 3),
      3,
    );
  }

  setOptions(options: ThrusterOptions): void {
    this.options = options;
    if (this.puffs.length > options.capacity) {
      this.puffs = this.puffs.slice(-options.capacity);
    }
  }

  get count(): number {
    return this.puffs.length;
  }

  /**
   * Bank angle (radians, for `ship.rotation.z`) from lateral motion: the
   * ship leans into a sideways move and springs level in about 90 ms when
   * it stops. Render-only and camera-free; focus and reduced motion lean
   * less.
   */
  bank(velX: number, focused: boolean, reduceMotion: boolean, dt: number) {
    const lean = Math.max(-1, Math.min(1, velX / FULL_SPEED));
    const max = 0.3 * (focused ? 0.45 : 1) * (reduceMotion ? 0.5 : 1);
    const target = -lean * max;
    // Three 30 ms time constants: about 90 ms to settle.
    this.roll += (target - this.roll) * (1 - Math.exp(-dt / 0.03));
    return this.roll;
  }

  /**
   * One frame. `tick` and `vel` are the sim's (the ship's movement over its
   * last tick, sim units); acceleration is the change between ticks, so the
   * puffs follow what the controller actually did, classic or hybrid.
   */
  update(
    dt: number,
    tick: number,
    vel: { readonly x: number; readonly y: number },
    ship: THREE.Vector3,
    emit: boolean,
    focused: boolean,
    reduceMotion: boolean,
  ): void {
    this.budget = Math.min(
      this.options.burst * 2,
      this.budget + dt * this.options.perSecond,
    );
    if (tick !== this.lastTick) {
      const ax = vel.x - this.prevVel.x;
      const ay = vel.y - this.prevVel.y;
      // A respawn or a skipped stretch of ticks is not a thrust.
      const fresh = this.lastTick >= 0 && tick - this.lastTick <= 4;
      this.prevVel = { x: vel.x, y: vel.y };
      this.lastTick = tick;
      const a = Math.hypot(ax, ay);
      if (emit && fresh && a >= ACCEL_THRESHOLD) {
        const strength = Math.min(1, a / FULL_SPEED);
        let n = Math.max(1, Math.round(this.options.burst * strength));
        if (focused) n = Math.max(1, Math.floor(n / 2));
        if (reduceMotion) n = Math.max(1, Math.floor(n / 2));
        for (let i = 0; i < n && this.budget >= 1; i++) {
          this.budget -= 1;
          this.spawn(ship, -ax / a, -ay / a, strength, focused, reduceMotion);
        }
      }
    }
    this.advance(dt);
  }

  clear(): void {
    this.puffs = [];
    this.mesh.count = 0;
  }

  private spawn(
    ship: THREE.Vector3,
    dx: number,
    dz: number,
    strength: number,
    focused: boolean,
    reduceMotion: boolean,
  ): void {
    if (this.puffs.length >= this.options.capacity) this.puffs.shift();
    // Sim y grows down-screen, as world z does.
    const spread = (Math.random() - 0.5) * (focused ? 0.25 : 0.7);
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const ux = dx * cos - dz * sin;
    const uz = dx * sin + dz * cos;
    // Past the hull's edge on the puff's side (and past the ship's own
    // glow, which would swallow anything closer), a little below the ship,
    // so the exhaust sits between the hull and the lane.
    const edge = 0.55;
    const pos = new THREE.Vector3(
      ship.x + ux * edge + (Math.random() - 0.5) * 0.12,
      ship.y - 0.06,
      ship.z + uz * edge * 1.3 + (Math.random() - 0.5) * 0.12,
    );
    const speed = 3.5 + 4 * strength;
    this.puffs.push({
      pos,
      vel: new THREE.Vector3(ux * speed, 0, uz * speed),
      age: 0,
      life: (0.14 + 0.06 * Math.random()) * (reduceMotion ? 0.6 : 1),
      width: (focused ? 0.08 : 0.2) * (0.8 + 0.4 * strength),
      length: (focused ? 0.3 : 0.55) * (0.7 + 0.6 * strength),
    });
  }

  private advance(dt: number): void {
    this.puffs = this.puffs.filter((p) => (p.age += dt) < p.life);
    let i = 0;
    for (const p of this.puffs) {
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-dt * 6));
      const t = p.age / p.life;
      // Opens fast, thins and fades: a breath, not a flame.
      this.dir.copy(p.vel).normalize();
      if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1);
      this.q.setFromUnitVectors(Thrusters.ALONG, this.dir);
      this.s.set(p.width * (1 - 0.5 * t), 1, p.length * (0.6 + 0.8 * t));
      this.m.compose(p.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      const fade = PUFF_STRENGTH * (1 - t) * (1 - t);
      this.mesh.setColorAt(i, this.c.copy(PUFF_COLOR).multiplyScalar(fade));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
