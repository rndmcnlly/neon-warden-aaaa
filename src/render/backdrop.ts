/**
 * Scenery: a noise nebula far below, three parallax star layers, and the
 * "lanes" themselves: faint glowing rails on either side of the playfield
 * plus distant megastructure pylons, so the space reads as a regulated
 * corridor rather than open sky (the Enclosure theme, made visible).
 *
 * Everything scrolls toward +Z (down-screen) to sell forward flight, and
 * `warp` (0–1) stretches stars and speeds everything up for warp moments.
 */

import * as THREE from "three";
import { FIELD_D, FIELD_W } from "./coords.ts";
import { PALETTE, SCENE_LOOKS, type SceneLook } from "./palette.ts";
import { neonMaterial } from "./placeholders.ts";
import { floorFragment, floorVertex } from "./shaders/floor.glsl.ts";
import { nebulaFragment, nebulaVertex } from "./shaders/nebula.glsl.ts";

/** Floor plane height: under hulls, above the nebula. */
const FLOOR_Y = -0.9;

/** Scrolling volume the stars live in, world units. */
const STAR_SPAN_Z = 80;

interface StarLayer {
  points: THREE.Points;
  speed: number;
}

export class Backdrop {
  readonly group = new THREE.Group();
  private readonly nebula: THREE.ShaderMaterial;
  private layers: StarLayer[] = [];
  private readonly pylons = new THREE.Group();
  private readonly floor: THREE.ShaderMaterial;
  private readonly railMats: THREE.MeshBasicMaterial[] = [];
  private readonly bandMats: THREE.MeshBasicMaterial[] = [];
  private scroll = 0;
  warp = 0;

  constructor(starCount: number) {
    this.nebula = new THREE.ShaderMaterial({
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      depthWrite: false,
      uniforms: {
        uScroll: { value: 0 },
        uWarp: { value: 0 },
        uViolet: { value: new THREE.Color(PALETTE.violet) },
        uPink: { value: new THREE.Color(PALETTE.pink) },
        uCyan: { value: new THREE.Color(PALETTE.cyan) },
        uVoid: { value: new THREE.Color(PALETTE.void) },
        uCap: { value: 0.35 },
      },
    });
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 160),
      this.nebula,
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, -30, -20);
    plane.renderOrder = -10;
    this.group.add(plane);

    this.floor = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      depthWrite: true,
      uniforms: {
        uBase: { value: new THREE.Color() },
        uLine: { value: new THREE.Color() },
        uBright: { value: 1 },
        uScroll: { value: 0 },
        uPlayer: { value: new THREE.Vector2(0, 6) },
        uBoss: { value: new THREE.Vector2(0, -5) },
        uBossOn: { value: 0 },
        uDensity: { value: 0 },
        uHalf: { value: new THREE.Vector2(FIELD_W / 2 + 0.5, FIELD_D / 2) },
      },
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), this.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, -18);
    floor.renderOrder = -5;
    this.group.add(floor);

    this.setStarCount(starCount);
    this.buildLanes();
    this.setLook(SCENE_LOOKS.sector);
  }

  /**
   * Applies a scene color budget: floor, nebula, rails and pylon bands all
   * take the world hues; danger colors are never used here.
   */
  setLook(look: SceneLook): void {
    const u = this.floor.uniforms;
    // Floor values are tuned in display terms; the shader works in linear.
    (u.uBase.value as THREE.Color).set(look.worldA).multiplyScalar(0.45);
    (u.uLine.value as THREE.Color).set(look.worldB).multiplyScalar(0.5);
    u.uBright.value = look.floor;
    const n = this.nebula.uniforms;
    (n.uViolet.value as THREE.Color).set(look.worldB);
    (n.uPink.value as THREE.Color).set(look.worldA);
    (n.uCyan.value as THREE.Color).set(look.accent);
    n.uCap.value = look.nebulaCap;
    for (const m of this.railMats) {
      m.color.set(look.worldB).multiplyScalar(0.9);
    }
    for (const m of this.bandMats) m.color.set(look.accent).multiplyScalar(1.2);
  }

  /** Per-frame subjects for the floor's ground glows and density column. */
  setSubjects(
    player: THREE.Vector3,
    boss: THREE.Vector3 | null,
    density: number,
  ): void {
    const u = this.floor.uniforms;
    (u.uPlayer.value as THREE.Vector2).set(player.x, player.z);
    if (boss) (u.uBoss.value as THREE.Vector2).set(boss.x, boss.z);
    u.uBossOn.value = boss ? 1 : 0;
    u.uDensity.value = Math.min(1, density / 150);
  }

  /** Rebuilds the star layers; called when the quality tier changes. */
  setStarCount(total: number): void {
    for (const l of this.layers) {
      this.group.remove(l.points);
      l.points.geometry.dispose();
    }
    // Far, mid and near layers, like the original's parallax 0.25 / 0.6 / 1.6.
    this.layers = [
      makeStars(Math.floor(total * 0.55), -24, 0.05, 2.5),
      makeStars(Math.floor(total * 0.3), -10, 0.07, 6),
      makeStars(Math.floor(total * 0.15), -3, 0.09, 14),
    ];
    for (const l of this.layers) this.group.add(l.points);
  }

  private buildLanes(): void {
    // Lane rails: the corridor edges, just outside the playfield.
    const railMat = neonMaterial(PALETTE.cyan, 0.9);
    this.railMats.push(railMat);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 120),
        railMat,
      );
      rail.position.set(side * (FIELD_W / 2 + 0.6), -0.4, -30);
      this.group.add(rail);
      const rail2 = rail.clone();
      rail2.position.x = side * (FIELD_W / 2 + 2.2);
      rail2.position.y = -1.6;
      this.group.add(rail2);
    }
    // Distant pylons: tall dark slabs with a neon band, repeating down the lane.
    const slab = new THREE.BoxGeometry(1.2, 14, 1.2);
    const dark = new THREE.MeshStandardMaterial({
      color: 0x0b0a18,
      metalness: 0.7,
      roughness: 0.5,
    });
    const band = new THREE.BoxGeometry(1.25, 0.12, 1.25);
    for (let i = 0; i < 12; i++) {
      for (const side of [-1, 1]) {
        const p = new THREE.Group();
        p.add(new THREE.Mesh(slab, dark));
        const bandMat = neonMaterial(PALETTE.violet, 1.2);
        this.bandMats.push(bandMat);
        const b = new THREE.Mesh(band, bandMat);
        b.position.y = 4 + (i % 4);
        p.add(b);
        p.position.set(side * (FIELD_W / 2 + 9 + (i % 3) * 3), -14, -i * 8);
        this.pylons.add(p);
      }
    }
    this.group.add(this.pylons);
  }

  update(dtSec: number): void {
    const speed = 1 + this.warp * 17;
    this.scroll += dtSec * speed;
    this.nebula.uniforms.uScroll.value = -this.scroll * 0.02;
    this.nebula.uniforms.uWarp.value = this.warp;
    this.floor.uniforms.uScroll.value = this.scroll * 4;
    for (const l of this.layers) {
      l.points.position.z = (this.scroll * l.speed) % STAR_SPAN_Z;
      l.points.scale.z = 1 + this.warp * 6;
    }
    // Pylons march toward the camera and wrap around.
    for (const p of this.pylons.children) {
      p.position.z += dtSec * 4 * speed;
      if (p.position.z > FIELD_D) p.position.z -= 96;
    }
  }
}

function makeStars(
  count: number,
  y: number,
  size: number,
  speed: number,
): StarLayer {
  const pos = new Float32Array(count * 3 * 2);
  const col = new Float32Array(count * 3 * 2);
  const tint = new THREE.Color();
  // Two copies of the field, one span apart, so the wrap is seamless.
  for (let copy = 0; copy < 2; copy++) {
    for (let i = 0; i < count; i++) {
      const k = (copy * count + i) * 3;
      // Seeded by index so stars do not reshuffle on a quality change.
      const r1 = fract(Math.sin(i * 12.9898) * 43758.5453);
      const r2 = fract(Math.sin(i * 78.233) * 12345.678);
      const r3 = fract(Math.sin(i * 39.425) * 24634.6345);
      pos[k] = (r1 - 0.5) * 70;
      pos[k + 1] = y + (r3 - 0.5) * 4;
      pos[k + 2] = (r2 - 0.5) * STAR_SPAN_Z - copy * STAR_SPAN_Z;
      tint.setHSL(0.55 + r3 * 0.35, 0.6, 0.75 + r1 * 0.25);
      col[k] = tint.r;
      col[k + 1] = tint.g;
      col[k + 2] = tint.b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  return { points, speed };
}

function fract(v: number): number {
  return v - Math.floor(v);
}
