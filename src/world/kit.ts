/**
 * Loads the Blender-built world set pieces and draws many copies of each
 * with instancing, while still animating their moving parts per copy.
 *
 * Pattern: each glTF becomes a Template, a mesh-free "skeleton" of its nodes
 * plus a list of drawable parts (geometry hung on a skeleton node). An
 * InstancedRig owns one cloned skeleton per copy and one InstancedMesh per
 * part. Each frame it poses the skeletons (route position, pivots) and copies
 * each part node's matrix into that part's InstancedMesh: one draw call per
 * part no matter how many copies, and moving cranes or barrier arms still
 * move independently.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Layer } from "./sectors.ts";
import { canvasSize, paintSign, SIGNS } from "./signage.ts";
import type { WorldLanguage } from "./lore.ts";

/** The gameplay camera tilt (cameraRig.ts GAMEPLAY_TILT); tilted signs face it. */
const TILT = 0.47;

export interface ManifestEntry {
  file: string;
  bytes: number;
  triangles: number;
  meshes: number;
  nodes: string[];
  bounds: number[];
}
export type WorldManifest = Record<string, ManifestEntry>;

type PartKind = "body" | "lit" | "sign" | "beam" | "fan";

interface Part {
  /** Name of the skeleton node the geometry hangs on. */
  readonly node: string;
  readonly kind: PartKind;
  readonly geometry: THREE.BufferGeometry;
  readonly signId?: string;
}

export interface Template {
  readonly id: string;
  readonly skeleton: THREE.Object3D;
  readonly parts: readonly Part[];
}

const quad = new THREE.PlaneGeometry(1, 1);

/** A lighthouse beam: two thin flat wedges, lying in the lamp's plane. */
function beamGeometry(): THREE.BufferGeometry {
  const r = 46, half = 0.11;
  const v: number[] = [];
  for (const dir of [0, Math.PI]) {
    v.push(0, 0, 0);
    v.push(Math.cos(dir - half) * r, 0, Math.sin(dir - half) * r);
    v.push(Math.cos(dir + half) * r, 0, Math.sin(dir + half) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/** The scanner's light curtain, hanging from the head down to the road. */
function fanGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(9, 19);
  g.translate(0, -9.5, 0);
  return g;
}

/** Extra animated light geometry attached to named pivots. */
const EXTRAS: Record<string, { node: string; kind: PartKind }> = {
  od_beacon: { node: "od_beacon_lamp", kind: "beam" },
  gl_gantry: { node: "gl_gantry_scanner", kind: "fan" },
};

function toTemplate(id: string, scene: THREE.Object3D): Template {
  const parts: Part[] = [];
  const copy = (src: THREE.Object3D): THREE.Object3D => {
    const node = new THREE.Object3D();
    node.name = src.name;
    node.position.copy(src.position);
    node.quaternion.copy(src.quaternion);
    node.scale.copy(src.scale);
    if (src instanceof THREE.Mesh) {
      parts.push({
        node: src.name,
        kind: src.name.endsWith("_lit_emit") ? "lit" : "body",
        geometry: src.geometry,
      });
    }
    const sign = /^(sign|paint)__(.+)$/.exec(src.name);
    if (sign) {
      // glTF scale carries the panel size (x width, z height, meters).
      const w = src.scale.x, h = src.scale.z;
      node.quaternion.identity();
      node.scale.set(1, 1, 1);
      const face = new THREE.Object3D();
      face.name = src.name + "#face";
      const flat = sign[1] === "paint";
      face.rotation.x = flat ? -Math.PI / 2 : TILT - Math.PI / 2;
      face.position.set(
        0,
        flat ? 0.06 : 0.22 * Math.cos(TILT),
        flat ? 0 : 0.22 * Math.sin(TILT),
      );
      face.scale.set(w, h, 1);
      node.add(face);
      parts.push({
        node: face.name,
        kind: "sign",
        geometry: quad,
        signId: sign[2],
      });
    }
    for (const child of src.children) node.add(copy(child));
    return node;
  };
  const skeleton = copy(scene);
  const extra = EXTRAS[id];
  if (extra) {
    parts.push({
      node: extra.node,
      kind: extra.kind,
      geometry: extra.kind === "beam" ? beamGeometry() : fanGeometry(),
    });
  }
  return { id, skeleton, parts };
}

/** Fetches the manifest and glTFs once; templates are shared by all sectors. */
export class WorldLibrary {
  manifest: WorldManifest | null = null;
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<string, Promise<Template | null>>();
  constructor(private readonly baseUrl = "models/world/") {}

  async loadManifest(): Promise<WorldManifest | null> {
    if (this.manifest) return this.manifest;
    try {
      const res = await fetch(this.baseUrl + "manifest.json");
      if (!res.ok) return null;
      this.manifest = await res.json() as WorldManifest;
    } catch {
      return null;
    }
    return this.manifest;
  }

  template(id: string): Promise<Template | null> {
    let t = this.templates.get(id);
    if (!t) {
      t = this.loader.loadAsync(`${this.baseUrl}${id}.glb`).then(
        (gltf) => toTemplate(id.replace(/_lod$/, ""), gltf.scene),
        (err) => {
          console.warn(`[world] ${id}.glb failed to load`, err);
          return null;
        },
      );
      this.templates.set(id, t);
    }
    return t;
  }
}

/** Per-layer value targets: the world stays in mid values below combat. */
const LAYER_VALUE: Record<Layer, { body: number; lit: number }> = {
  near: { body: 0.1, lit: 0 },
  mid: { body: 1, lit: 0.68 },
  far: { body: 0.6, lit: 0.45 },
};

/** Sign canvases are shared by every copy and redrawn on language change. */
export class SignBoard {
  readonly textures = new Map<string, THREE.CanvasTexture>();
  private language: WorldLanguage | null = null;
  bytes = 0;
  texture(id: string, w: number, h: number): THREE.CanvasTexture {
    let tex = this.textures.get(id);
    if (!tex) {
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = canvasSize(w, h);
      this.bytes += canvas.width * canvas.height * 4 * 4 / 3;
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.textures.set(id, tex);
      if (this.language) this.paint(id, this.language);
    }
    return tex;
  }
  setLanguage(language: WorldLanguage): void {
    if (language === this.language) return;
    this.language = language;
    for (const id of this.textures.keys()) this.paint(id, language);
  }
  paint(id: string, language: WorldLanguage, scroll = -1): void {
    const tex = this.textures.get(id);
    const spec = SIGNS[id];
    if (!tex || !spec) return;
    paintSign(
      (tex.image as HTMLCanvasElement).getContext("2d")!,
      spec,
      language,
      scroll,
    );
    tex.needsUpdate = true;
  }
  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.bytes = 0;
  }
}

/** Many posed copies of one template, drawn with one InstancedMesh per part. */
export class InstancedRig {
  readonly group = new THREE.Group();
  readonly copies: THREE.Object3D[] = [];
  private readonly meshes: { part: Part; mesh: THREE.InstancedMesh }[] = [];
  private readonly nodes: Map<string, THREE.Object3D>[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(
    readonly template: Template,
    count: number,
    layer: Layer,
    tint: THREE.Color,
    signs: SignBoard,
    tints: readonly number[] = [],
  ) {
    for (let i = 0; i < count; i++) {
      const root = template.skeleton.clone(true);
      const byName = new Map<string, THREE.Object3D>();
      root.traverse((o) => byName.set(o.name, o));
      this.copies.push(root);
      this.nodes.push(byName);
    }
    const value = LAYER_VALUE[layer];
    for (const part of template.parts) {
      if (layer === "near" && part.kind !== "body") continue;
      const material = this.material(part, value, tint, signs);
      const mesh = new THREE.InstancedMesh(part.geometry, material, count);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.renderOrder = part.kind === "beam" || part.kind === "fan" ? 2 : 0;
      if (tints.length && part.kind === "body") {
        const c = new THREE.Color();
        for (let i = 0; i < count; i++) {
          mesh.setColorAt(i, c.setHex(tints[i] ?? 0xffffff));
        }
      }
      this.group.add(mesh);
      this.meshes.push({ part, mesh });
    }
  }

  private material(
    part: Part,
    value: { body: number; lit: number },
    tint: THREE.Color,
    signs: SignBoard,
  ): THREE.Material {
    let m: THREE.Material;
    if (part.kind === "body") {
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: tint.clone().multiplyScalar(value.body),
        // A small self-lit floor lifts the world into mid values without a
        // world-only light that would also brighten combat.
        emissive: tint.clone().multiplyScalar(value.body * 0.09),
        metalness: 0.3,
        roughness: 0.78,
      });
    } else if (part.kind === "lit") {
      m = new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: new THREE.Color(value.lit, value.lit, value.lit),
      });
    } else if (part.kind === "sign") {
      const node = this.nodes[0].get(part.node)!;
      const spec = SIGNS[part.signId!];
      const map = signs.texture(part.signId!, node.scale.x, node.scale.y);
      const lit = spec?.style === "lit";
      m = new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        roughness: 0.9,
        metalness: 0,
        color: new THREE.Color(
          value.body + 0.2,
          value.body + 0.2,
          value.body + 0.2,
        ),
        emissive: lit ? 0xffffff : 0x000000,
        emissiveMap: lit ? map : null,
        emissiveIntensity: lit ? value.lit * 0.9 : 0,
      });
    } else {
      m = new THREE.MeshBasicMaterial({
        color: part.kind === "beam" ? 0xffcf8a : 0xa6dcc8,
        transparent: true,
        opacity: part.kind === "beam" ? 0.09 : 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }
    this.materials.push(m);
    return m;
  }

  /** A named node of copy `i` (pivots, spark sockets). */
  node(i: number, name: string): THREE.Object3D | undefined {
    return this.nodes[i].get(name);
  }

  /** Lit-material brightness multiplier, e.g. the nursery's slow breathing. */
  setGlow(level: number, base: number): void {
    for (const { part, mesh } of this.meshes) {
      if (part.kind === "lit") {
        (mesh.material as THREE.MeshBasicMaterial).color.setScalar(
          base * level,
        );
      }
    }
  }

  /** Show or hide every part of one kind (the scan fan between scans). */
  setVisible(kind: PartKind, visible: boolean): void {
    for (const { part, mesh } of this.meshes) {
      if (part.kind === kind) mesh.visible = visible;
    }
  }

  /** Copy every posed copy's part matrices into the instanced buffers. */
  commit(): void {
    for (let i = 0; i < this.copies.length; i++) {
      this.copies[i].updateMatrixWorld(true);
    }
    for (const { part, mesh } of this.meshes) {
      for (let i = 0; i < this.copies.length; i++) {
        mesh.setMatrixAt(i, this.nodes[i].get(part.node)!.matrixWorld);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  stats(): { drawCalls: number; triangles: number } {
    let drawCalls = 0, triangles = 0;
    for (const { mesh } of this.meshes) {
      if (!mesh.visible || mesh.count === 0) continue;
      drawCalls++;
      const g = mesh.geometry;
      const n = g.index ? g.index.count : g.attributes.position.count;
      triangles += (n / 3) * mesh.count;
    }
    return { drawCalls, triangles };
  }

  dispose(): void {
    for (const { mesh } of this.meshes) mesh.dispose();
    for (const m of this.materials) m.dispose();
  }
}
