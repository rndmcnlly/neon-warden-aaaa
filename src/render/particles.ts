/**
 * Explosions and sparks: a fixed-size ring buffer of GPU particles plus a
 * small pool of expanding shockwave rings.
 *
 * Ring buffer, not a free list: when the budget is full the oldest particle
 * is overwritten. That makes the cost of a burst constant and bounded, which
 * matters when high-speed auto-play delivers 30 ticks' worth of kills in one
 * frame. The quality tier sets the budget.
 */

import * as THREE from "three";
import { particleFragment, particleVertex } from "./shaders/particles.glsl.ts";

export interface BurstSpec {
  readonly at: THREE.Vector3;
  readonly color: number;
  readonly count: number;
  /** Initial speed, world units per second. */
  readonly speed: number;
  /** Lifetime in seconds. */
  readonly life: number;
  /** Sprite size in world units. */
  readonly size: number;
}

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly start: THREE.BufferAttribute;
  private readonly velocity: THREE.BufferAttribute;
  private readonly color: THREE.BufferAttribute;
  private readonly birth: THREE.BufferAttribute;
  private next = 0;
  private time = 0;
  private readonly tmpColor = new THREE.Color();

  constructor(readonly capacity: number) {
    const geo = new THREE.BufferGeometry();
    this.start = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    this.velocity = new THREE.BufferAttribute(
      new Float32Array(capacity * 3),
      3,
    );
    this.color = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    // Born in the far past with zero life: invisible until first written.
    const birth = new Float32Array(capacity * 3).fill(-1e6);
    this.birth = new THREE.BufferAttribute(birth, 3);
    for (const a of [this.start, this.velocity, this.color, this.birth]) {
      a.setUsage(THREE.DynamicDrawUsage);
    }
    geo.setAttribute("position", this.start);
    geo.setAttribute("aVelocity", this.velocity);
    geo.setAttribute("aColor", this.color);
    geo.setAttribute("aBirthLifeSize", this.birth);

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.material);
    // The vertex shader moves particles; bounding-sphere culling would be wrong.
    this.points.frustumCulled = false;
  }

  setPixelRatio(ratio: number): void {
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  burst(spec: BurstSpec): void {
    const count = Math.min(spec.count, this.capacity);
    this.tmpColor.set(spec.color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      // Mostly flat sprays: the camera looks down, so XZ spread reads best.
      const theta = Math.random() * Math.PI * 2;
      const lift = (Math.random() - 0.3) * 0.6;
      const speed = spec.speed * (0.35 + Math.random() * 0.9);
      this.start.setXYZ(i, spec.at.x, spec.at.y, spec.at.z);
      this.velocity.setXYZ(
        i,
        Math.cos(theta) * speed,
        lift * speed,
        Math.sin(theta) * speed,
      );
      const jitter = 0.75 + Math.random() * 0.5;
      this.color.setXYZ(
        i,
        this.tmpColor.r * jitter,
        this.tmpColor.g * jitter,
        this.tmpColor.b * jitter,
      );
      this.birth.setXYZ(
        i,
        this.time,
        spec.life * (0.6 + Math.random() * 0.6),
        spec.size * (0.6 + Math.random() * 0.8),
      );
    }
    for (const a of [this.start, this.velocity, this.color, this.birth]) {
      a.needsUpdate = true;
    }
  }

  /** Adds a shared velocity to the last `count` particles written (a trail). */
  drift(count: number, velocity: THREE.Vector3): void {
    for (let n = 1; n <= Math.min(count, this.capacity); n++) {
      const i = (this.next - n + this.capacity) % this.capacity;
      this.velocity.setXYZ(
        i,
        this.velocity.getX(i) + velocity.x,
        this.velocity.getY(i) + velocity.y,
        this.velocity.getZ(i) + velocity.z,
      );
    }
  }

  update(dtSec: number): void {
    this.time += dtSec;
    this.material.uniforms.uTime.value = this.time;
  }
}

/** Expanding, fading rings: the original's 64 px "ring" sprite in 3D. */
export class ShockwavePool {
  readonly group = new THREE.Group();
  private readonly rings: {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    age: number;
    life: number;
    maxScale: number;
  }[] = [];
  private next = 0;

  constructor(size = 24) {
    const geo = new THREE.RingGeometry(0.85, 1, 64);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < size; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, material, age: 0, life: 1, maxScale: 1 });
    }
  }

  spawn(at: THREE.Vector3, color: number, radius: number, life = 0.45): void {
    const r = this.rings[this.next];
    this.next = (this.next + 1) % this.rings.length;
    r.mesh.position.copy(at);
    r.material.color.set(color).multiplyScalar(2);
    r.age = 0;
    r.life = life;
    r.maxScale = radius;
    r.mesh.visible = true;
  }

  update(dtSec: number): void {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dtSec;
      const t = r.age / r.life;
      if (t >= 1) {
        r.mesh.visible = false;
        continue;
      }
      // Ease-out growth: fast punch, slow settle.
      const s = r.maxScale * (1 - (1 - t) * (1 - t) * (1 - t));
      r.mesh.scale.setScalar(Math.max(0.01, s));
      r.material.opacity = (1 - t) * (1 - t);
    }
  }
}
