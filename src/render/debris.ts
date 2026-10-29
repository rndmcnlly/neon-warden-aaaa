/**
 * Debris and ricochets: render-side physics for things that come OFF a
 * target. Nothing here touches the sim; a detached part is a picture of an
 * event (`partBreak`) that already happened.
 *
 * Kinematic, not simulated: each body has a position, a velocity, an angular
 * velocity and a life. Per frame: `pos += vel * dt`, `rot += spin * dt`, a
 * little drag, a sink toward the floor. No collisions, no lights, a hard cap
 * on bodies, so a dense wave cannot cost more than `capacity` small meshes.
 *
 * Readability rules (research/2026-10-29-argon-core-ideation/, "do not"):
 * debris is dark and matte, angular and tumbling, and sinks below the bullet
 * plane within half a second. It must never be mistaken for a bullet: no
 * glow (past a brief cooling ember at the torn seam), no small round shapes,
 * no cyan or pink.
 *
 * Seen at the gameplay camera's distance, that first version was too
 * subtle (research/2026-10-29-core-feedback/, `after-debris-frames.jpg`:
 * "small dark tumbling bodies"). So, without breaking the rules: bodies are
 * bigger, a steel-grey rim light outlines their silhouette against the lane
 * (a fresnel term, brightest on edges, so it reads as shape, not as a glowing
 * dot), and a short dark smoke streak trails each one along its flight, which
 * shows direction and spin-off at a glance. Bullets are round, saturated and
 * glowing; debris is angular, grey, matte and smoking.
 */

import * as THREE from "three";

/** Bullets fly at this height; debris must end up below it. */
const BULLET_PLANE_Y = 0.25;
/**
 * Where debris settles: under the bullets but still above the lane's opaque
 * floor slab (y = 0), or it would vanish into the floor at once.
 */
const FLOOR_Y = 0.03;
const DEBRIS_COLOR = new THREE.Color(0x3a3f47);
/** Rim light: neutral steel, neither player cyan nor enemy pink. */
const RIM = new THREE.Color(0xaab3bd);
/** Smoke streak: a grey under everything bright. */
const SMOKE = new THREE.Color(0x5b636d);
/** Bodies read at camera distance only above this size, world units. */
const MIN_CHUNK = 0.3;
/** Torn-off model parts are drawn this much larger than in the model. */
const NODE_SCALE = 1.8;
/** The torn seam's heat: a dull ember, cooling within a quarter second. */
const EMBER = new THREE.Color(0xb8641e);

export interface DebrisSpawn {
  /** Model node to tear off (cloned); null spawns a generic hull chunk. */
  readonly node: THREE.Object3D | null;
  /** World position of the part. */
  readonly at: THREE.Vector3;
  /** World-space direction the breaking round travelled (XZ). */
  readonly shotDir: THREE.Vector3;
  /** World-space offset from the part's center to the impact point. */
  readonly hitOffset: THREE.Vector3;
  /** Chunk size in world units when `node` is null. */
  readonly size: number;
  /** Warden pods: heavier, slower, longer-lived. */
  readonly heavy: boolean;
}

interface Body {
  readonly root: THREE.Object3D;
  readonly materials: THREE.MeshStandardMaterial[];
  readonly rims: { value: number }[];
  readonly streak: THREE.Mesh;
  readonly streakMat: THREE.MeshBasicMaterial;
  readonly vel: THREE.Vector3;
  readonly spin: THREE.Vector3;
  readonly startY: number;
  age: number;
  life: number;
}

/** A flat taper, wide end at the origin, pointing along +Z. */
const STREAK_TAPER = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 0, 1], 3),
  );
  return g;
})();

/**
 * The rim light, patched into the standard material: emissive gains a
 * fresnel term, so the silhouette's edges catch light whichever way the
 * body tumbles. `uRim` fades it with the body.
 */
function addRim(m: THREE.MeshStandardMaterial): { value: number } {
  const uniform = { value: 1 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = uniform;
    shader.uniforms.uRimColor = { value: RIM };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimEdge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += uRimColor * pow(rimEdge, 2.0) * uRim;`,
      );
  };
  // One program for every debris body, whatever its uniforms.
  m.customProgramCacheKey = () => "debris-rim";
  return uniform;
}

const CHUNK_GEOMETRIES = [
  new THREE.TetrahedronGeometry(1, 0),
  new THREE.OctahedronGeometry(1, 0),
  new THREE.BoxGeometry(1.4, 0.5, 0.8),
];

export class DebrisField {
  readonly group = new THREE.Group();
  private bodies: Body[] = [];
  private chunkIndex = 0;
  /** Reduced motion: shorter flights, gentler spin. */
  reduceMotion = false;

  constructor(private capacity: number) {
    this.group.name = "debris";
  }

  /** Low tier keeps fewer bodies alive at once. */
  setCapacity(capacity: number): void {
    this.capacity = capacity;
    while (this.bodies.length > capacity) this.remove(this.bodies[0]);
  }

  get count(): number {
    return this.bodies.length;
  }

  spawn(s: DebrisSpawn): void {
    if (this.capacity <= 0) return;
    if (this.bodies.length >= this.capacity) this.remove(this.bodies[0]);
    const root = s.node ? cloneNode(s.node) : this.chunk(s.size);
    root.position.copy(s.at);
    if (s.node) s.node.getWorldQuaternion(root.quaternion);
    if (s.node) root.scale.multiplyScalar(NODE_SCALE);
    const materials: THREE.MeshStandardMaterial[] = [];
    const rims: { value: number }[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // One matte material per body, so each can darken and fade alone.
      const m = new THREE.MeshStandardMaterial({
        color: DEBRIS_COLOR,
        roughness: 0.95,
        metalness: 0.2,
        emissive: EMBER,
        emissiveIntensity: 0.9,
        transparent: true,
      });
      rims.push(addRim(m));
      mesh.material = m;
      mesh.renderOrder = -1;
      materials.push(m);
    });
    const streakMat = new THREE.MeshBasicMaterial({
      color: SMOKE,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const streak = new THREE.Mesh(STREAK_TAPER, streakMat);
    streak.renderOrder = -2;
    this.group.add(streak);

    // Fling: mostly along the shot, a little away from the hit, plus the
    // lane's scroll (+Z is down-screen). Speeds in world units per second.
    const dir = s.shotDir.clone().setY(0).normalize();
    const away = s.hitOffset.clone().setY(0).multiplyScalar(-1);
    if (away.lengthSq() > 1e-6) away.normalize();
    const speed = s.heavy ? 6 : 11;
    const vel = dir.multiplyScalar(speed * 0.8).addScaledVector(
      away,
      speed * 0.35,
    );
    vel.z += s.heavy ? 1.5 : 2.5;
    // Spin from the hit offset: a blow off-center twists the part, like
    // `cross(offset, dir)` in 2D. A tumble about the travel axis is added
    // so a top-down camera sees it turn over.
    const twist = new THREE.Vector3().crossVectors(s.hitOffset, s.shotDir);
    const turn = (s.heavy ? 5 : 11) * (this.reduceMotion ? 0.35 : 1);
    const spin = new THREE.Vector3(
      3 + Math.abs(twist.y) * 2,
      twist.y >= 0 ? turn : -turn,
      2,
    ).multiplyScalar(this.reduceMotion ? 0.4 : 1);
    if (this.reduceMotion) vel.multiplyScalar(0.6);

    this.group.add(root);
    this.bodies.push({
      root,
      materials,
      rims,
      streak,
      streakMat,
      vel,
      spin,
      startY: Math.max(s.at.y, BULLET_PLANE_Y + 0.2),
      age: 0,
      life: (s.heavy ? 1.9 : 1.4) * (this.reduceMotion ? 0.6 : 1),
    });
  }

  update(dt: number): void {
    for (const b of [...this.bodies]) {
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        this.remove(b);
        continue;
      }
      b.root.position.addScaledVector(b.vel, dt);
      b.vel.multiplyScalar(Math.exp(-dt * 1.6));
      // Sink below the bullet plane over the first 0.5 s.
      const sink = Math.min(1, b.age / 0.5);
      b.root.position.y = b.startY + (FLOOR_Y - b.startY) * sink * (2 - sink);
      b.root.rotation.x += b.spin.x * dt;
      b.root.rotation.y += b.spin.y * dt;
      b.root.rotation.z += b.spin.z * dt;
      const ember = Math.max(0, 1 - b.age / 0.25);
      const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      for (const m of b.materials) {
        m.emissiveIntensity = 0.9 * ember;
        m.opacity = fade;
        m.color.copy(DEBRIS_COLOR).multiplyScalar(1 - 0.4 * sink);
      }
      // The rim holds while the body flies, then cools with it.
      for (const r of b.rims) r.value = 1.4 * fade * (1 - 0.4 * sink);
      // Smoke streak: from the body back along its flight, as long as the
      // body is fast, thinning as it slows. Lies just under the body.
      const speed = Math.hypot(b.vel.x, b.vel.z);
      b.streak.visible = speed > 0.4;
      if (b.streak.visible) {
        const size = b.root.scale.x;
        b.streak.position.copy(b.root.position);
        b.streak.position.y -= 0.02;
        b.streak.rotation.set(0, Math.atan2(-b.vel.x, -b.vel.z), 0);
        b.streak.scale.set(
          Math.max(0.12, size * 0.9),
          1,
          Math.min(1.6, speed * 0.16),
        );
        b.streakMat.opacity = 0.7 * fade * Math.min(1, speed / 4);
      }
    }
  }

  clear(): void {
    for (const b of [...this.bodies]) this.remove(b);
  }

  private chunk(size: number): THREE.Object3D {
    const geometry = CHUNK_GEOMETRIES[this.chunkIndex++ % 3];
    const mesh = new THREE.Mesh(geometry);
    mesh.scale.setScalar(Math.max(MIN_CHUNK, size));
    return mesh;
  }

  private remove(b: Body): void {
    this.group.remove(b.root);
    this.group.remove(b.streak);
    b.streakMat.dispose();
    for (const m of b.materials) m.dispose();
    this.bodies = this.bodies.filter((x) => x !== b);
  }
}

/** A world-space copy of a model node (geometry shared, not copied). */
function cloneNode(node: THREE.Object3D): THREE.Object3D {
  const copy = node.clone(true);
  copy.visible = true;
  copy.traverse((o) => (o.visible = true));
  const scale = new THREE.Vector3();
  node.getWorldScale(scale);
  copy.scale.copy(scale);
  return copy;
}

// ---- ricochet streaks --------------------------------------------------------

interface Streak {
  readonly mesh: THREE.Mesh;
  readonly vel: THREE.Vector3;
  age: number;
}

const STREAK_LIFE = 0.14;
const STREAK_GEOMETRY = new THREE.BoxGeometry(0.035, 0.035, 0.55);

/**
 * Glancing sparks for an armored deflect: thin streaks reflected about the
 * surface normal. A deflect does no damage, so it gets no flash and no
 * punch, only a line that visibly bounces off. Muted slate-white: not a
 * player bolt (cyan) and not enemy fire (pink).
 */
export class RicochetPool {
  readonly group = new THREE.Group();
  private readonly streaks: Streak[] = [];
  private next = 0;
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0xc9d4e6,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  constructor(size = 16) {
    this.group.name = "ricochets";
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(STREAK_GEOMETRY, this.material);
      mesh.visible = false;
      this.group.add(mesh);
      this.streaks.push({ mesh, vel: new THREE.Vector3(), age: STREAK_LIFE });
    }
  }

  /**
   * Two streaks off `at`: the incoming direction `dir` reflected about
   * `normal` (both world XZ), fanned by about ±20 degrees.
   */
  spawn(at: THREE.Vector3, dir: THREE.Vector3, normal: THREE.Vector3): void {
    const d = dir.clone().setY(0).normalize();
    const n = normal.clone().setY(0);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    n.normalize();
    const r = d.sub(n.clone().multiplyScalar(2 * d.dot(n)));
    for (const angle of [-0.35, 0.3]) {
      const s = this.streaks[this.next++ % this.streaks.length];
      s.vel.copy(r).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle)
        .multiplyScalar(14);
      s.age = 0;
      s.mesh.position.copy(at).setY(BULLET_PLANE_Y + 0.1);
      s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
      s.mesh.visible = true;
    }
  }

  update(dt: number): void {
    for (const s of this.streaks) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      if (s.age >= STREAK_LIFE) {
        s.mesh.visible = false;
        continue;
      }
      s.mesh.position.addScaledVector(s.vel, dt);
    }
    this.material.opacity = 0.9;
  }
}
