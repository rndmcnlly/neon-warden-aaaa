/**
 * All bullets, drawn with instancing: one draw call per bullet look, however
 * many bullets the Warden's phase-3 spiral throws. Every frame we rewrite the
 * instance matrices from the interpolated sim positions; there is no per-
 * bullet scene object at all.
 *
 * Looks on the value ladder in palette.ts (ROLE):
 * - player shots, cyan, additive, under the bloom threshold so they never
 *   compete with danger, in three shapes by trigger expression (shotLooks.ts):
 *   tap slugs (short, faceted, sharp head), stream needles (thin, long, dim)
 *   and Writ lances (sized by charge, bright core, a cyan sheath and rings
 *   shed as they fly);
 * - enemy `bullet` and `heavy`: billboarded rings with a dark core and a
 *   hot colored rim (see orb.glsl.ts), the brightest small things on screen.
 */

import * as THREE from "three";
import type { BulletView } from "../contracts/index.ts";
import { simToWorldLength, simToWorldX, simToWorldZ } from "./coords.ts";
import type { Pos, SnapshotInterpolator } from "./interp.ts";
import { ROLE, type RoleColor } from "./palette.ts";
import { orbFragment, orbVertex } from "./shaders/orb.glsl.ts";
import { ShotTagger, writScale } from "./shotLooks.ts";

const MAX_SHOTS = 512;
const MAX_WRITS = 16;
/** Each Writ sheds a ring every this many seconds; rings live this long. */
const WRIT_RING_PERIOD = 0.09;
const WRIT_RING_LIFE = 0.24;
const MAX_ORBS = 2048;
/** Height above the playfield plane, so bullets draw over hull tops. */
const BULLET_Y = 0.25;

export class BulletRenderer {
  readonly group = new THREE.Group();
  private readonly slugs: THREE.InstancedMesh;
  private readonly needles: THREE.InstancedMesh;
  private readonly lanceCores: THREE.InstancedMesh;
  private readonly lanceSheaths: THREE.InstancedMesh;
  private readonly writRings: THREE.InstancedMesh;
  private readonly orbs: THREE.InstancedMesh;
  private readonly orbRim: THREE.InstancedBufferAttribute;
  private readonly orbCore: THREE.InstancedBufferAttribute;
  private readonly orbMaterial: THREE.ShaderMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly pos: Pos = { x: 0, y: 0 };
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly dir = new THREE.Vector3();
  private readonly rim = color(ROLE.dangerRim);
  private readonly core = color(ROLE.dangerCore);
  private readonly heavyRim = color(ROLE.heavyRim);
  private readonly heavyCore = color(ROLE.heavyCore);
  private readonly ringColor = new THREE.Color();
  /** Writ rings in flight: world position, level, age. Renderer-only. */
  private readonly rings: { x: number; z: number; s: number; age: number }[] =
    [];
  private readonly ringClock = new Map<number, number>();
  private lastTime = -1;
  /** Live Writs this frame (world x, z, scale), for impact lookups. */
  private readonly writsNow: { x: number; z: number; level: number }[] = [];
  /** Tags each player round's look; stage.ts feeds it every sim step. */
  readonly tagger = new ShotTagger();
  /** Enemy bullets on screen last frame; post.ts damps bloom by it. */
  enemyCount = 0;

  constructor() {
    const shotMat = (
      gain: number,
      opacity: number,
      hex: number = ROLE.playerShot.hex,
    ) =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex).multiplyScalar(gain),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    const instanced = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      max: number,
    ) => {
      const mesh = new THREE.InstancedMesh(geo, mat, max);
      mesh.frustumCulled = false;
      mesh.count = 0;
      return mesh;
    };
    // Tap: a short faceted slug, sharp head forward (+Y), blunt tail. Pale
    // cyan and the most opaque player round, still under the threshold.
    this.slugs = instanced(
      slugGeometry(),
      shotMat(1.3, 0.85, 0xa8f8ff),
      MAX_SHOTS,
    );
    // Stream: thin, long, tapered needles at low opacity. Constant, never
    // flickering: a held trigger should not tire the eye.
    this.needles = instanced(
      new THREE.CylinderGeometry(0.012, 0.02, 0.78, 5, 1),
      shotMat(1.0, 0.38),
      MAX_SHOTS,
    );
    // Writ: a heavy lance. A pale core under the threshold inside a wider
    // cyan sheath; scaled per instance by charge level.
    this.lanceCores = instanced(
      lanceGeometry(0.07, 1.0),
      shotMat(1.25, 0.95, 0xe0fdff),
      MAX_WRITS,
    );
    this.lanceSheaths = instanced(
      lanceGeometry(0.16, 1.3),
      shotMat(1.1, 0.4),
      MAX_WRITS,
    );
    const ringGeo = new THREE.RingGeometry(0.82, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.writRings = instanced(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      MAX_WRITS * 4,
    );
    this.writRings.setColorAt(0, this.ringColor);

    const quad = new THREE.PlaneGeometry(2, 2);
    this.orbRim = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ORBS * 3),
      3,
    );
    this.orbCore = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_ORBS * 3),
      3,
    );
    quad.setAttribute("aRim", this.orbRim);
    quad.setAttribute("aCore", this.orbCore);
    this.orbMaterial = new THREE.ShaderMaterial({
      vertexShader: orbVertex,
      fragmentShader: orbFragment,
      uniforms: {
        uPulse: { value: 0 },
        uRimGain: { value: ROLE.dangerRim.gain },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.orbs = new THREE.InstancedMesh(quad, this.orbMaterial, MAX_ORBS);
    this.orbs.frustumCulled = false;
    this.orbs.count = 0;
    // Orbs draw after everything else so they are never buried.
    this.orbs.renderOrder = 10;

    this.group.add(
      this.needles,
      this.slugs,
      this.lanceSheaths,
      this.lanceCores,
      this.writRings,
      this.orbs,
    );
  }

  /**
   * The level of a live Writ within `reach` world units of (x, z), else 0.
   * stage.ts uses it to give hits a Writ an impact of their own.
   */
  writNear(x: number, z: number, reach: number): number {
    let best = 0;
    for (const w of this.writsNow) {
      if (Math.hypot(w.x - x, w.z - z) <= reach + 0.3 * w.level) {
        best = Math.max(best, w.level);
      }
    }
    return best;
  }

  update(
    bullets: readonly BulletView[],
    interp: SnapshotInterpolator,
    alpha: number,
    timeSec: number,
  ): void {
    let slugCount = 0;
    let needleCount = 0;
    let writCount = 0;
    let orbCount = 0;
    const dt = this.lastTime < 0
      ? 0
      : Math.min(0.1, Math.max(0, timeSec - this.lastTime));
    this.lastTime = timeSec;
    this.writsNow.length = 0;
    const clocks = new Set<number>();
    for (const b of bullets) {
      interp.position(b.id, alpha, this.pos);
      this.p.set(simToWorldX(this.pos.x), BULLET_Y, simToWorldZ(this.pos.y));
      if (b.kind === "shot") {
        // Shapes are built along +Y; point that axis along the velocity in
        // the XZ plane (sim +y down is world +Z).
        this.dir.set(b.vel.x, 0, b.vel.y).normalize();
        this.q.setFromUnitVectors(this.up, this.dir);
        const tag = this.tagger.get(b);
        if (tag.shot === "aimed") {
          if (slugCount >= MAX_SHOTS) continue;
          this.s.set(1, 1, 1);
          this.m.compose(this.p, this.q, this.s);
          this.slugs.setMatrixAt(slugCount++, this.m);
        } else if (tag.shot === "stream") {
          if (needleCount >= MAX_SHOTS) continue;
          // Two lengths alternate by id: a little rhythm in the hose.
          this.s.set(1, b.id % 2 ? 1 : 0.82, 1);
          this.m.compose(this.p, this.q, this.s);
          this.needles.setMatrixAt(needleCount++, this.m);
        } else {
          if (writCount >= MAX_WRITS) continue;
          const k = writScale(tag.level);
          this.s.set(k, k, k);
          this.m.compose(this.p, this.q, this.s);
          this.lanceCores.setMatrixAt(writCount, this.m);
          this.lanceSheaths.setMatrixAt(writCount, this.m);
          writCount++;
          this.writsNow.push({ x: this.p.x, z: this.p.z, level: tag.level });
          clocks.add(b.id);
          const clock = (this.ringClock.get(b.id) ?? WRIT_RING_PERIOD) + dt;
          if (clock >= WRIT_RING_PERIOD && this.rings.length < MAX_WRITS * 4) {
            this.rings.push({ x: this.p.x, z: this.p.z, s: k, age: 0 });
            this.ringClock.set(b.id, 0);
          } else this.ringClock.set(b.id, clock);
        }
      } else {
        if (orbCount >= MAX_ORBS) continue;
        // The ring's outer edge is about 1.7x the collision radius, like the
        // original 16 px sprite around a 5 px hitbox; the hitbox sits inside
        // the dark core, so "touching the ring" is honestly a graze.
        const r = simToWorldLength(b.radius * 1.7);
        this.m.makeScale(r, r, r).setPosition(this.p);
        this.orbs.setMatrixAt(orbCount, this.m);
        const heavy = b.kind === "heavy";
        const rim = heavy ? this.heavyRim : this.rim;
        const core = heavy ? this.heavyCore : this.core;
        this.orbRim.setXYZ(orbCount, rim.r, rim.g, rim.b);
        this.orbCore.setXYZ(orbCount, core.r, core.g, core.b);
        orbCount++;
      }
    }
    for (const id of this.ringClock.keys()) {
      if (!clocks.has(id)) this.ringClock.delete(id);
    }
    this.updateRings(dt);
    this.slugs.count = slugCount;
    this.needles.count = needleCount;
    this.lanceCores.count = writCount;
    this.lanceSheaths.count = writCount;
    this.orbs.count = orbCount;
    for (const mesh of [this.slugs, this.needles, this.lanceCores]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.lanceSheaths.instanceMatrix.needsUpdate = true;
    this.orbs.instanceMatrix.needsUpdate = true;
    this.orbRim.needsUpdate = true;
    this.orbCore.needsUpdate = true;
    this.enemyCount = orbCount;
    this.orbMaterial.uniforms.uPulse.value = Math.sin(timeSec * 10) * 0.5 + 0.5;
  }

  /** Shed rings widen and fade where they were dropped: a wake, not a halo. */
  private updateRings(dt: number): void {
    let n = 0;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= WRIT_RING_LIFE) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = r.age / WRIT_RING_LIFE;
      const radius = r.s * (0.16 + 0.34 * (1 - (1 - t) * (1 - t)));
      this.m.makeScale(radius, radius, radius * 0.55);
      this.m.setPosition(r.x, BULLET_Y, r.z);
      this.writRings.setMatrixAt(n, this.m);
      // Additive: fading the colour fades the ring.
      const fade = (1 - t) * (1 - t) * 0.9;
      this.ringColor.setHex(ROLE.playerShot.hex).multiplyScalar(fade);
      this.writRings.setColorAt(n, this.ringColor);
      n++;
    }
    this.writRings.count = n;
    this.writRings.instanceMatrix.needsUpdate = true;
    if (this.writRings.instanceColor) {
      this.writRings.instanceColor.needsUpdate = true;
    }
  }
}

/** Tap slug: an octahedron with a long sharp head and a short blunt tail. */
function slugGeometry(): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(1, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(
      i,
      pos.getX(i) * 0.065,
      y > 0 ? y * 0.2 : y * 0.09,
      pos.getZ(i) * 0.045,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/** Writ lance: a long diamond, head forward, `width` across, `length` long. */
function lanceGeometry(width: number, length: number): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(1, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(
      i,
      pos.getX(i) * width,
      y > 0 ? y * length * 0.55 : y * length * 0.45,
      pos.getZ(i) * width * 0.6,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function color(role: RoleColor): THREE.Color {
  return new THREE.Color(role.hex);
}
