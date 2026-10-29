/**
 * Wave-3 effects: the scan beam, lock reticles with dwell progress, the
 * Writ charge glow, and per-instance material control for hit flashes and
 * disarms.
 *
 * Intel tags (an enemy's FSM state as text) are split across two owners on
 * purpose. The renderer draws the in-world part: the reticle and, once
 * locked, a short leader tick pointing up and to the right, where the tag
 * goes. The UI draws the text in the DOM (src/ui/instruments.ts), pinned via
 * `stage.screenPositionOf(entityId)`, so the words go through the same
 * translation, font and CJK pipeline as every other string. A canvas-texture
 * sprite in 3D was tried first and dropped: it duplicated U's tags and
 * bypassed i18n.
 */

import * as THREE from "three";
import type { EntityId } from "../contracts/index.ts";
import { ROLE, type RoleColor } from "./palette.ts";

function hdr(role: RoleColor, extra = 1): THREE.Color {
  return new THREE.Color(role.hex).multiplyScalar(role.gain * extra);
}

// ---- scan beam ---------------------------------------------------------------

const beamVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Faint and saturated by design: the cone is a cue, not a light source. The
// wave-3 version summed a 10% fill, 50% sides and a 60% band of pale scan
// cyan additively, which read as a near-white wedge over the playfield. Now
// the body is a low-opacity deep cyan and only the sweep's leading edge is
// bright (HDR, so it alone blooms), with a short faint tail behind it.
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uBody;
uniform float uRange;
uniform float uHalf;
uniform float uSweep;
uniform float uOpacity;
varying vec2 vLocal;
void main() {
  float r = length(vLocal) / uRange;
  float a = abs(atan(vLocal.x, vLocal.y)) / uHalf;   // 0 center, 1 edge
  float sides = smoothstep(0.9, 0.99, a) * (1.0 - smoothstep(0.99, 1.0, a));
  float fill = 0.035 * (1.0 - r);
  float d = r - uSweep;
  float lead = exp(-pow(d * 45.0, 2.0));
  float tail = d < 0.0 ? exp(d * 9.0) * 0.12 : 0.0;
  float fadeOut = 1.0 - smoothstep(0.85, 1.0, r);
  vec3 body = uBody * (fill + sides * 0.12 + tail);
  vec3 c = (body + uColor * lead * (1.0 - r * 0.5)) * fadeOut;
  gl_FragColor = vec4(c * uOpacity, 1.0);
}
`;

/** The cone that sweeps ahead of the ship while the player rests. */
export class ScanBeam {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private opacity = 0;
  private sweep = 0;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      uniforms: {
        uColor: { value: hdr(ROLE.scan, 1.4) },
        uBody: { value: new THREE.Color(0x1aa6c8) },
        uRange: { value: 1 },
        uHalf: { value: 0.3 },
        uSweep: { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.setShape(0.32, 7.5);
  }

  private shapeKey = "";

  /** Rebuilds the fan for a half-angle (radians) and range (world units). */
  setShape(halfAngle: number, range: number): void {
    const key = `${halfAngle.toFixed(3)}:${range.toFixed(2)}`;
    if (key === this.shapeKey) return;
    this.shapeKey = key;
    this.mesh.geometry.dispose();
    // CircleGeometry lies in XY, angles from +X; after the -90 deg X
    // rotation, local +Y points up-screen (-Z), so center the fan on PI/2.
    this.mesh.geometry = new THREE.CircleGeometry(
      range,
      28,
      Math.PI / 2 - halfAngle,
      halfAngle * 2,
    );
    this.mat.uniforms.uRange.value = range;
    this.mat.uniforms.uHalf.value = halfAngle;
  }

  update(dt: number, at: THREE.Vector3, active: boolean): void {
    this.opacity += ((active ? 1 : 0) - this.opacity) * Math.min(1, dt * 10);
    this.sweep = (this.sweep + dt * 1.4) % 1;
    this.mesh.visible = this.opacity > 0.01;
    this.mesh.position.set(at.x, 0.2, at.z - 0.35);
    this.mat.uniforms.uOpacity.value = this.opacity;
    this.mat.uniforms.uSweep.value = this.sweep;
  }
}

// ---- lock reticles -----------------------------------------------------------

const reticleFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;  // dwell 0-1
uniform float uLocked;    // 0-1, snaps the brackets in
uniform float uSpin;
uniform float uFade;
varying vec2 vUv;
const float PI = 3.14159265;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  // Four corner brackets: arcs centered on the diagonals, closing in on lock.
  float rad = mix(0.9, 0.72, uLocked);
  float ring = 1.0 - smoothstep(0.0, 0.06, abs(r - rad));
  float seg = cos(4.0 * (ang - uSpin)) * 0.5 + 0.5;
  float brackets = ring * smoothstep(0.55, 0.75, seg);
  // Dwell progress: a thin inner arc filling clockwise from the top.
  float t = fract((PI * 0.5 - ang) / (2.0 * PI));
  float arc = (1.0 - smoothstep(0.0, 0.035, abs(r - 0.56))) * step(t, uProgress);
  float dot0 = (1.0 - smoothstep(0.05, 0.09, r)) * uLocked;
  // Leader tick toward the intel tag (up-right), once locked.
  vec2 q = p - vec2(0.62, 0.62);
  float lead = (1.0 - smoothstep(0.0, 0.03, abs(q.x - q.y) * 0.7071)) *
    step(0.0, q.x) * step(q.x, 0.3) * uLocked;
  float v = brackets + arc * 0.9 + dot0 + lead;
  if (v < 0.01) discard;
  gl_FragColor = vec4(uColor * v * uFade, 1.0);
}
`;

const reticleVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

interface Reticle {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  locked: number;
  seen: boolean;
}

/** One reticle per enemy the beam is dwelling on or has locked. */
export class ReticlePool {
  readonly group = new THREE.Group();
  private readonly live = new Map<EntityId, Reticle>();
  private readonly free: Reticle[] = [];
  private readonly geo = new THREE.PlaneGeometry(2, 2);

  begin(): void {
    for (const r of this.live.values()) r.seen = false;
  }

  /** Shows a reticle at `at` with radius `size` world units. */
  set(
    id: EntityId,
    at: THREE.Vector3,
    size: number,
    progress: number,
    locked: boolean,
    timeSec: number,
    dt: number,
  ): void {
    let r = this.live.get(id);
    if (!r) {
      r = this.free.pop() ?? this.make();
      r.locked = 0;
      this.live.set(id, r);
      this.group.add(r.mesh);
    }
    r.seen = true;
    r.locked += ((locked ? 1 : 0) - r.locked) * Math.min(1, dt * 14);
    r.mesh.position.set(at.x, 0.35, at.z);
    r.mesh.scale.setScalar(size * (1 + (1 - r.locked) * 0.25));
    const u = r.mat.uniforms;
    u.uProgress.value = progress;
    u.uLocked.value = r.locked;
    u.uSpin.value = Math.PI / 4 + (locked ? timeSec * 1.2 : 0);
    u.uFade.value = 0.6 + 0.4 * r.locked;
  }

  end(): void {
    for (const [id, r] of this.live) {
      if (r.seen) continue;
      this.group.remove(r.mesh);
      this.live.delete(id);
      this.free.push(r);
    }
  }

  private make(): Reticle {
    const mat = new THREE.ShaderMaterial({
      vertexShader: reticleVertex,
      fragmentShader: reticleFragment,
      uniforms: {
        uColor: { value: hdr(ROLE.scan) },
        uProgress: { value: 0 },
        uLocked: { value: 0 },
        uSpin: { value: 0 },
        uFade: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 12;
    return { mesh, mat, locked: 0, seen: false };
  }
}

// ---- Writ charge glow --------------------------------------------------------

/**
 * A soft glow at the ship's nose that grows with charge, plus one pip per
 * level ringing the ship. Level 3 pushes the glow over the bloom threshold:
 * a held, full Writ is meant to be the brightest thing the player owns.
 */
export class WritGlow {
  readonly group = new THREE.Group();
  private readonly glow: THREE.Sprite;
  private readonly glowMat: THREE.SpriteMaterial;
  private readonly pips: THREE.Mesh[] = [];
  private readonly pipMat: THREE.MeshBasicMaterial;
  private shown = 0;

  constructor() {
    this.glowMat = new THREE.SpriteMaterial({
      map: radialTexture(),
      color: hdr(ROLE.writ, 0.6),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.position.set(0, 0.25, -0.55);
    this.group.add(this.glow);
    this.pipMat = new THREE.MeshBasicMaterial({
      color: hdr(ROLE.writ, 0.7),
      toneMapped: false,
    });
    const pipGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 3; i++) {
      const pip = new THREE.Mesh(pipGeo, this.pipMat);
      this.pips.push(pip);
      this.group.add(pip);
    }
    this.group.visible = false;
  }

  update(dt: number, charge: number, level: number, timeSec: number): void {
    const target = Math.min(3, level + charge) / 3;
    this.shown += (target - this.shown) * Math.min(1, dt * 12);
    this.group.visible = this.shown > 0.02;
    if (!this.group.visible) return;
    const full = level >= 3;
    const pulse = full ? 0.85 + 0.15 * Math.sin(timeSec * 14) : 1;
    const s = (0.25 + this.shown * 0.9) * pulse;
    this.glow.scale.set(s, s, 1);
    this.glowMat.color.copy(
      hdr(ROLE.writ, 0.3 + this.shown * (full ? 1 : 0.5)),
    );
    for (let i = 0; i < 3; i++) {
      const pip = this.pips[i];
      pip.visible = i < level;
      const a = timeSec * 3 + (i * Math.PI * 2) / 3;
      pip.position.set(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62 - 0.1);
    }
  }
}

let radialCache: THREE.Texture | null = null;

function radialTexture(): THREE.Texture | null {
  if (radialCache) return radialCache;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  radialCache = new THREE.CanvasTexture(c);
  return radialCache;
}

// ---- per-instance materials: hit flash and power-down ------------------------

interface OwnedMaterial {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensity: number;
  color: THREE.Color;
}

/**
 * glTF clones share materials, so flashing one drone would flash them all.
 * The first time an instance needs its own look (hit flash, disarm), its
 * materials are cloned and the originals remembered; `restoreMaterials`
 * puts the instance back before it returns to the pool.
 */
export function ownMaterials(slot: THREE.Object3D): OwnedMaterial[] {
  const existing = slot.userData.owned as OwnedMaterial[] | undefined;
  if (existing) return existing;
  const owned: OwnedMaterial[] = [];
  const shared = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  slot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial) return;
    let copy = shared.get(m);
    if (!copy) {
      copy = m.clone();
      copy.userData.original = m;
      shared.set(m, copy);
      owned.push({
        mat: copy,
        emissive: m.emissive.clone(),
        intensity: m.emissiveIntensity,
        color: m.color.clone(),
      });
    }
    mesh.material = copy;
  });
  slot.userData.owned = owned;
  return owned;
}

export function restoreMaterials(slot: THREE.Object3D): void {
  if (!slot.userData.owned) return;
  slot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const original = (mesh.material as THREE.Material).userData.original as
      | THREE.Material
      | undefined;
    if (original) mesh.material = original;
  });
  delete slot.userData.owned;
  delete slot.userData.flash;
  delete slot.userData.power;
}

const WHITE = new THREE.Color(1, 1, 1);
const DEAD = new THREE.Color(0x30343c);

/**
 * Per-frame material look of an instance: `flash` 0–1 (a white hit flash,
 * critique item 6a), `power` 1 = armed, 0 = disarmed (emissives drain to a
 * dull grey and hulls darken: its weapons are visibly off).
 */
export function applyInstanceLook(slot: THREE.Object3D, dt: number): void {
  const owned = slot.userData.owned as OwnedMaterial[] | undefined;
  if (!owned) return;
  let flash = (slot.userData.flash as number | undefined) ?? 0;
  const powerTarget = (slot.userData.powerTarget as number | undefined) ?? 1;
  let power = (slot.userData.power as number | undefined) ?? 1;
  power += (powerTarget - power) * Math.min(1, dt * 2.5);
  flash = Math.max(0, flash - dt * 9);
  slot.userData.flash = flash;
  slot.userData.power = power;
  // A dying flicker while powering down.
  const flicker = powerTarget < 1 && power > 0.1
    ? (Math.sin(performance.now() * 0.06) > 0.2 ? 1 : 0.35)
    : 1;
  for (const o of owned) {
    o.mat.emissive.copy(o.emissive).lerp(DEAD, 1 - power).lerp(WHITE, flash);
    o.mat.emissiveIntensity = Math.max(
      o.intensity * (0.08 + 0.92 * power) * flicker,
      flash * 2,
    );
    o.mat.color.copy(o.color).multiplyScalar(0.55 + 0.45 * power);
  }
}
