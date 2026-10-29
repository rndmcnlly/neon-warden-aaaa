/**
 * Procedural stand-ins for every model in the asset contract.
 *
 * Workstream 4 builds the real models in Blender; until a .glb lands in
 * public/models/, these keep the game playable and readable. Each one copies
 * the original 2D sprite's silhouette and color (see the entity bible in
 * research/2026-10-28-original-reference/), then adds just enough 3D: a dark
 * metallic hull that catches the environment light, and bright "neon" trim
 * that the bloom pass turns into glow.
 *
 * Conventions shared with the glTF assets (and documented in the registry):
 * +Y up, the nose points toward world -Z (the top of the screen), the origin
 * sits on the hitbox center, and sizes are in world units (40 sim px each).
 */

import * as THREE from "three";
import { simToWorldLength as px } from "./coords.ts";
import { PALETTE } from "./palette.ts";

/** Bright, unlit, not tone-mapped: values above 1 feed the bloom pass. */
export function neonMaterial(
  color: number,
  intensity = 2.2,
): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
}

/** Dark metallic hull tinted toward the entity color. */
export function hullMaterial(
  color: number,
  tint = 0.18,
): THREE.MeshStandardMaterial {
  const base = new THREE.Color(PALETTE.gunmetal).lerp(
    new THREE.Color(color),
    tint,
  );
  return new THREE.MeshStandardMaterial({
    color: base,
    metalness: 0.85,
    roughness: 0.32,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.12,
  });
}

/** A flat 2D outline (sim px, +y = toward screen top) extruded into a slab. */
function slab(
  points: readonly [number, number][],
  depthPx: number,
  material: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape(
    points.map(([x, y]) => new THREE.Vector2(px(x), px(y))),
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: px(depthPx),
    bevelEnabled: true,
    bevelThickness: px(1.5),
    bevelSize: px(1.2),
    bevelSegments: 2,
  });
  // Shape space is XY with +Y = nose; turn it onto the XZ playfield.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -px(depthPx) / 2, 0);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** A glowing tube traced around a closed 2D outline: the original's neon line. */
function neonOutline(
  points: readonly [number, number][],
  heightPx: number,
  color: number,
  radiusPx = 1.1,
): THREE.Mesh {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(px(ax), px(heightPx), -px(ay)),
        new THREE.Vector3(px(bx), px(heightPx), -px(by)),
      ),
    );
  }
  const geo = new THREE.TubeGeometry(
    path,
    points.length * 8,
    px(radiusPx),
    6,
    true,
  );
  return new THREE.Mesh(geo, neonMaterial(color));
}

function glowSphere(
  radiusPx: number,
  color: number,
  intensity = 3,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(px(radiusPx), 20, 14),
    neonMaterial(color, intensity),
  );
}

// Outlines in sim px, +y toward the top of the screen.
const KITE: [number, number][] = [[0, 24], [20, -14], [0, -6], [-20, -14]];
const CHEVRON: [number, number][] = [
  [0, -20],
  [18, 20],
  [0, 8],
  [-18, 20],
];
const LANCER: [number, number][] = [[26, 0], [0, 14], [-26, 0], [0, -14]];
const CREST: [number, number][] = [
  [-100, 50],
  [-30, 70],
  [30, 70],
  [100, 50],
  [80, -10],
  [0, -70],
  [-80, -10],
];
const DIAMOND: [number, number][] = [[0, 14], [14, 0], [0, -14], [-14, 0]];

function hexagon(r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

export function makePilotShip(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(slab(KITE, 6, hullMaterial(PALETTE.cyan, 0.25)));
  g.add(neonOutline(KITE, 4, PALETTE.cyan));
  // Canopy: a squashed glass dome over the cockpit.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(px(6), 20, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0x0a1a2a,
      metalness: 0,
      roughness: 0.05,
      transmission: 0,
      clearcoat: 1,
      emissive: new THREE.Color(PALETTE.cyan),
      emissiveIntensity: 0.25,
    }),
  );
  canopy.scale.set(0.8, 0.6, 1.4);
  canopy.position.set(0, px(4), -px(4));
  g.add(canopy);
  // The hitbox core gem, shown as in modern bullet-hell games.
  const core = glowSphere(3, PALETTE.iceWhite, 4);
  core.position.y = px(6);
  core.name = "hitboxGem";
  g.add(core);
  // Engine nozzle glow at the tail.
  const engine = glowSphere(3.5, PALETTE.cyan, 3);
  engine.scale.set(1.6, 0.6, 1);
  engine.position.set(0, 0, px(8));
  engine.name = "engine";
  g.add(engine);
  return g;
}

export function makeDrone(): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(px(13), px(2.4), 12, 40),
    hullMaterial(PALETTE.pink, 0.3),
  );
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1.25, 0.75, 1);
  g.add(ring);
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(px(13), px(0.9), 6, 40),
    neonMaterial(PALETTE.pink),
  );
  trim.rotation.x = Math.PI / 2;
  trim.scale.set(1.25, 0.75, 1);
  trim.position.y = px(2);
  g.add(trim);
  g.add(glowSphere(5, PALETTE.pink, 3));
  return g;
}

export function makeDart(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(slab(CHEVRON, 5, hullMaterial(PALETTE.amber, 0.35)));
  g.add(neonOutline(CHEVRON, 3, PALETTE.amber));
  const thruster = glowSphere(3, PALETTE.amber, 3);
  thruster.position.set(0, px(1), -px(10));
  thruster.name = "thruster";
  g.add(thruster);
  return g;
}

export function makeTurret(): THREE.Object3D {
  const g = new THREE.Group();
  const hex = hexagon(24);
  g.add(slab(hex, 10, hullMaterial(PALETTE.violet, 0.3)));
  g.add(neonOutline(hex, 6, PALETTE.violet));
  // The crown spins; the stage finds it by name.
  const crown = new THREE.Group();
  crown.name = "crown";
  for (let i = 0; i < 6; i++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(px(1.6), px(1.6), px(12), 8),
      hullMaterial(PALETTE.violet, 0.15),
    );
    const a = (i / 6) * Math.PI * 2;
    barrel.rotation.z = Math.PI / 2;
    barrel.rotation.y = -a;
    barrel.position.set(Math.cos(a) * px(14), px(8), Math.sin(a) * px(14));
    crown.add(barrel);
  }
  g.add(crown);
  const core = glowSphere(6, 0xffffff, 3);
  core.position.y = px(8);
  g.add(core);
  return g;
}

export function makeLancer(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(slab(LANCER, 6, hullMaterial(PALETTE.mint, 0.3)));
  g.add(neonOutline(LANCER, 4, PALETTE.mint));
  // The ventral lance: a short emissive spike pointing down-screen.
  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(px(2.2), px(14), 8),
    neonMaterial(PALETTE.mint, 2.6),
  );
  spike.rotation.x = Math.PI / 2;
  spike.position.set(0, 0, px(18));
  g.add(spike);
  return g;
}

export function makeWarden(): THREE.Object3D {
  const g = new THREE.Group();
  const plates = slab(CREST, 18, hullMaterial(PALETTE.crimson, 0.45));
  plates.name = "armor";
  g.add(plates);
  g.add(neonOutline(CREST, 11, PALETTE.crimson, 2));
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(px(34), px(2.2), 10, 64),
    neonMaterial(PALETTE.crimson, 2),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = px(14);
  halo.name = "halo";
  g.add(halo);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(px(150), px(6), px(8)),
    hullMaterial(PALETTE.crimson, 0.6),
  );
  bar.position.set(0, px(12), -px(2));
  g.add(bar);
  const core = glowSphere(18, PALETTE.gold, 3.2);
  core.position.y = px(16);
  core.name = "core";
  g.add(core);
  return g;
}

function makePickup(color: number, inner: "dots" | "ring"): THREE.Object3D {
  const g = new THREE.Group();
  const cage = new THREE.Mesh(
    new THREE.OctahedronGeometry(px(15), 0),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2),
      wireframe: true,
      toneMapped: false,
    }),
  );
  cage.name = "cage";
  g.add(cage);
  g.add(neonOutline(DIAMOND, 0, color, 1.2));
  if (inner === "dots") {
    for (const x of [-6, 0, 6]) {
      const d = glowSphere(2.4, color, 3);
      d.position.x = px(x);
      g.add(d);
    }
  } else {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(px(5), px(1.2), 8, 24),
      neonMaterial(color, 3),
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  return g;
}

export function makePilotFigure(): THREE.Object3D {
  // Our own helmet silhouette: a rounded dome with a swept crest fin and a
  // horizontal visor slit, faceless. Deliberately not a T-visor.
  const g = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({
    color: 0x3a4052,
    metalness: 0.9,
    roughness: 0.28,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.7, 6, 16),
    armor,
  );
  body.position.y = 0.7;
  g.add(body);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 20), armor);
  helmet.scale.set(1, 1.1, 1.08);
  helmet.position.y = 1.42;
  g.add(helmet);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.42), armor);
  fin.position.set(0, 1.7, 0.02);
  g.add(fin);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.05, 0.1),
    neonMaterial(PALETTE.cyan, 1.8),
  );
  visor.position.set(0, 1.44, 0.25);
  g.add(visor);
  return g;
}

function makeLogo(color: number, accent: number): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 16, 96),
    neonMaterial(color, 2.4),
  );
  g.add(ring);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.16, 0.16),
    hullMaterial(accent, 0.5),
  );
  g.add(bar);
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.42, 0.06, 160, 12, 2, 5),
    neonMaterial(accent, 2.2),
  );
  g.add(knot);
  return g;
}

/** Every model the asset contract names, with its placeholder builder. */
export const PLACEHOLDERS = {
  pilot_ship: makePilotShip,
  drone: makeDrone,
  dart: makeDart,
  turret: makeTurret,
  lancer: makeLancer,
  warden: makeWarden,
  pickup_spread: () => makePickup(PALETTE.mint, "dots"),
  pickup_shield: () => makePickup(PALETTE.cyan, "ring"),
  pilot_figure: makePilotFigure,
  logo_adamsmith_systems: () => makeLogo(PALETTE.cyan, PALETTE.pink),
  logo_cm121: () => makeLogo(PALETTE.gold, PALETTE.violet),
} as const satisfies Record<string, () => THREE.Object3D>;

export type ModelId = keyof typeof PLACEHOLDERS;
