/** Bounded, matte chips, not additive fog. Cosmetic randomness stays here. */
import * as THREE from "three";
import type { BulletView } from "../contracts/index.ts";
import { simToWorldX, simToWorldZ } from "./coords.ts";
import type { SnapshotInterpolator } from "./interp.ts";

export class ShotTrails {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity = 384;
  private cursor = 0;
  private tick = -1;
  private readonly chips = Array.from({ length: 384 }, () => ({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    life: 0,
    total: 1,
    spin: 0,
  }));
  private readonly last = new Map<number, { x: number; y: number }>();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly pos = { x: 0, y: 0 };
  private readonly object = new THREE.Object3D();

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.035, 0.025, 0.075),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      this.capacity,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(
    bullets: readonly BulletView[],
    interp: SnapshotInterpolator,
    alpha: number,
    dt: number,
    budget: number,
  ): void {
    const tick = interp.tickAt(alpha);
    const jump = this.tick < 0 || tick < this.tick || tick - this.tick > 6;
    if (jump || budget === 0) {
      this.last.clear();
      for (const chip of this.chips) chip.life = 0;
    }
    const seen = new Set<number>();
    let emitted = 0;
    for (const b of bullets) {
      if (b.kind !== "shot") continue;
      seen.add(b.id);
      interp.position(b.id, alpha, this.pos);
      const prev = this.last.get(b.id);
      const start = prev ?? {
        x: this.pos.x - b.vel.x * Math.min(1, dt * 60),
        y: this.pos.y - b.vel.y * Math.min(1, dt * 60),
      };
      const distance = Math.hypot(this.pos.x - start.x, this.pos.y - start.y);
      // Even when several ticks were drawn together, fill the intervening
      // path, not just its endpoint. A seek never draws a playfield streak.
      const count = jump ? 0 : Math.min(12, Math.floor(distance / 5));
      for (let i = 0; i < count && emitted < budget; i++, emitted++) {
        const t = (i + 0.5) / count;
        const c = this.chips[this.cursor];
        this.cursor = (this.cursor + 1) % this.capacity;
        c.x = simToWorldX(start.x + (this.pos.x - start.x) * t);
        c.z = simToWorldZ(start.y + (this.pos.y - start.y) * t);
        c.vx = (Math.random() - 0.5) * 0.55;
        c.vz = -0.35 - Math.random() * 0.55;
        c.life = c.total = 0.12 + Math.random() * 0.1;
        c.spin = Math.random() * Math.PI;
      }
      this.last.set(b.id, { ...this.pos });
    }
    for (const id of this.last.keys()) if (!seen.has(id)) this.last.delete(id);
    this.tick = tick;
    let count = 0;
    for (const c of this.chips) {
      c.life -= dt;
      if (c.life <= 0) continue;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      const fade = c.life / c.total;
      this.object.position.set(c.x, 0.25, c.z);
      this.object.rotation.set(c.spin, c.spin + (1 - fade) * 2, c.spin);
      this.object.scale.setScalar(fade);
      this.object.updateMatrix();
      this.matrix.copy(this.object.matrix);
      this.mesh.setMatrixAt(count, this.matrix);
      this.color.setRGB(0.04 * fade, 0.42 * fade, 0.5 * fade);
      this.mesh.setColorAt(count++, this.color);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
