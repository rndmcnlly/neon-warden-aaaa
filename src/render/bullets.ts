/**
 * All bullets, drawn with instancing: one draw call per bullet look, however
 * many bullets the Warden's phase-3 spiral throws. Every frame we rewrite the
 * instance matrices from the interpolated sim positions; there is no per-
 * bullet scene object at all.
 *
 * Two looks:
 * - player shots: stretched saturated-cyan capsules aligned with their
 *   velocity, which doubles as a cheap motion streak (cyan, never white, so
 *   they cannot be confused with enemy fire);
 * - enemy `bullet` and `heavy`: billboarded glowing orbs (see orb.glsl.ts).
 */

import * as THREE from "three";
import type { BulletView } from "../contracts/index.ts";
import { simToWorldLength, simToWorldX, simToWorldZ } from "./coords.ts";
import type { Pos, SnapshotInterpolator } from "./interp.ts";
import { PALETTE } from "./palette.ts";
import { orbFragment, orbVertex } from "./shaders/orb.glsl.ts";

const MAX_SHOTS = 512;
const MAX_ORBS = 2048;
/** Height above the playfield plane, so bullets draw over hull tops. */
const BULLET_Y = 0.25;

export class BulletRenderer {
  readonly group = new THREE.Group();
  private readonly shots: THREE.InstancedMesh;
  private readonly orbs: THREE.InstancedMesh;
  private readonly orbTint: THREE.InstancedBufferAttribute;
  private readonly orbMaterial: THREE.ShaderMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly pos: Pos = { x: 0, y: 0 };
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly dir = new THREE.Vector3();
  private readonly pink = new THREE.Color(PALETTE.enemyShot);
  private readonly gold = new THREE.Color(PALETTE.heavyGold);

  constructor() {
    const capsule = new THREE.CapsuleGeometry(0.06, 0.4, 4, 8);
    this.shots = new THREE.InstancedMesh(
      capsule,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.6),
        toneMapped: false,
      }),
      MAX_SHOTS,
    );
    this.shots.frustumCulled = false;
    this.shots.count = 0;

    const quad = new THREE.PlaneGeometry(2, 2);
    this.orbTint = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ORBS * 3),
      3,
    );
    quad.setAttribute("aTint", this.orbTint);
    this.orbMaterial = new THREE.ShaderMaterial({
      vertexShader: orbVertex,
      fragmentShader: orbFragment,
      uniforms: { uPulse: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.orbs = new THREE.InstancedMesh(quad, this.orbMaterial, MAX_ORBS);
    this.orbs.frustumCulled = false;
    this.orbs.count = 0;
    // Orbs draw after everything else so they are never buried.
    this.orbs.renderOrder = 10;

    this.group.add(this.shots, this.orbs);
  }

  update(
    bullets: readonly BulletView[],
    interp: SnapshotInterpolator,
    alpha: number,
    timeSec: number,
  ): void {
    let shotCount = 0;
    let orbCount = 0;
    for (const b of bullets) {
      interp.position(b.id, alpha, this.pos);
      this.p.set(simToWorldX(this.pos.x), BULLET_Y, simToWorldZ(this.pos.y));
      if (b.kind === "shot") {
        if (shotCount >= MAX_SHOTS) continue;
        // Capsules are built along +Y; point that axis along the velocity
        // in the XZ plane (sim +y down is world +Z).
        this.dir.set(b.vel.x, 0, b.vel.y).normalize();
        this.q.setFromUnitVectors(this.up, this.dir);
        this.s.set(1, 1, 1);
        this.m.compose(this.p, this.q, this.s);
        this.shots.setMatrixAt(shotCount++, this.m);
      } else {
        if (orbCount >= MAX_ORBS) continue;
        // The orb's visible glow is about 1.6x its collision radius, like the
        // original 16 px sprite around a 5 px hitbox.
        const r = simToWorldLength(b.radius * 1.6);
        this.m.makeScale(r, r, r).setPosition(this.p);
        this.orbs.setMatrixAt(orbCount, this.m);
        const c = b.kind === "heavy" ? this.gold : this.pink;
        this.orbTint.setXYZ(orbCount, c.r, c.g, c.b);
        orbCount++;
      }
    }
    this.shots.count = shotCount;
    this.orbs.count = orbCount;
    this.shots.instanceMatrix.needsUpdate = true;
    this.orbs.instanceMatrix.needsUpdate = true;
    this.orbTint.needsUpdate = true;
    this.orbMaterial.uniforms.uPulse.value = Math.sin(timeSec * 10) * 0.5 + 0.5;
  }
}
