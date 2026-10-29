/**
 * Model registry: one place that hands out 3D models by id, starting with a
 * procedural placeholder and hot-swapping to the Blender-built glTF the
 * moment it loads.
 *
 * Pattern: every instance the stage asks for is a `ModelSlot`, an empty
 * Group that wraps the actual geometry. The stage positions and rotates the
 * slot; the registry may replace what is inside it at any time. That
 * indirection (a proxy, in design-pattern terms) is what lets art arrive
 * late, or never, without the renderer caring.
 *
 * Asset convention for public/models/*.glb (Workstream 4):
 * - +Y up, the nose or "front" points toward -Z (the top of the screen);
 * - origin on the hitbox center;
 * - any scale: the registry fits each model to its entity's footprint from
 *   the original sprite, so a ship is always as wide as the 48 px sprite was;
 * - nodes named `crown` (turret), `halo`, `core`, `armor*` (Warden),
 *   `thruster` (dart), `engine` (ship) get animated if present.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { simToWorldLength } from "./coords.ts";
import { type ModelId, PLACEHOLDERS } from "./placeholders.ts";

export type { ModelId } from "./placeholders.ts";

/**
 * Widest horizontal extent of each model, in sim px, from the original
 * sprites. Cutscene-only models use world units directly (`null` = keep the
 * glTF's own scale, normalized to a 2-unit height).
 */
const FOOTPRINT_PX: Record<ModelId, number | null> = {
  pilot_ship: 48,
  drone: 36,
  dart: 40,
  turret: 48,
  lancer: 52,
  warden: 200,
  pickup_spread: 28,
  pickup_shield: 28,
  pilot_figure: null,
  logo_adamsmith_systems: null,
  logo_cm121: null,
};

export type ModelSlot = THREE.Group & { userData: { modelId: ModelId } };

type Status = "placeholder" | "loading" | "gltf" | "missing";

/**
 * Blender's emissive strengths (6–12) are tuned for Cycles renders. Under our
 * bloom they turn whole surfaces white: the Warden's core erased its own
 * silhouette in the first boss screenshot. Gameplay readability wins, so
 * cap them here; `core` materials (big glowing areas) get the lowest cap.
 */
const EMISSIVE_CAP = 3;
const CORE_EMISSIVE_CAP = 1.6;

function tameEmissive(material: THREE.Material | THREE.Material[]): void {
  for (const m of Array.isArray(material) ? material : [material]) {
    const std = m as THREE.MeshStandardMaterial;
    if (std.emissiveIntensity === undefined) continue;
    const cap = m.name.includes("core") ? CORE_EMISSIVE_CAP : EMISSIVE_CAP;
    std.emissiveIntensity = Math.min(std.emissiveIntensity, cap);
  }
}

export class ModelRegistry {
  private readonly loaded = new Map<ModelId, THREE.Object3D>();
  private readonly status = new Map<ModelId, Status>();
  /** Live slots per model, so a late glTF can be swapped into each of them. */
  private readonly slots = new Map<ModelId, Set<ModelSlot>>();
  private readonly loader = new GLTFLoader();

  constructor(private readonly baseUrl = "models/") {}

  /** Starts loading every glTF in the contract. Missing files are fine. */
  preloadAll(): Promise<void> {
    const ids = Object.keys(PLACEHOLDERS) as ModelId[];
    return Promise.all(ids.map((id) => this.load(id))).then(() => {});
  }

  /** What each model is currently drawn with: handy for the dev harness. */
  report(): Record<string, Status> {
    const out: Record<string, Status> = {};
    for (const id of Object.keys(PLACEHOLDERS) as ModelId[]) {
      out[id] = this.status.get(id) ?? "placeholder";
    }
    return out;
  }

  /** A new instance of `id`, placeholder now, glTF when available. */
  create(id: ModelId): ModelSlot {
    const slot = new THREE.Group() as ModelSlot;
    slot.userData.modelId = id;
    slot.add(this.buildContent(id));
    let set = this.slots.get(id);
    if (!set) this.slots.set(id, set = new Set());
    set.add(slot);
    return slot;
  }

  /** Forget a slot (when the stage drops a pooled mesh for good). */
  release(slot: ModelSlot): void {
    this.slots.get(slot.userData.modelId)?.delete(slot);
  }

  private buildContent(id: ModelId): THREE.Object3D {
    const gltf = this.loaded.get(id);
    // glTF scenes are cloned per instance; geometry and materials are shared.
    return gltf ? gltf.clone(true) : PLACEHOLDERS[id]();
  }

  private async load(id: ModelId): Promise<void> {
    this.status.set(id, "loading");
    const url = `${this.baseUrl}${id}.glb`;
    try {
      // A HEAD check first: dev servers may answer a missing file with the
      // index.html fallback, which GLTFLoader would choke on noisily.
      const head = await fetch(url, { method: "HEAD" });
      const type = head.headers.get("content-type") ?? "";
      if (!head.ok || type.includes("text/html")) {
        this.status.set(id, "missing");
        return;
      }
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      fitToFootprint(root, FOOTPRINT_PX[id]);
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        tameEmissive(mesh.material);
      });
      this.loaded.set(id, root);
      this.status.set(id, "gltf");
      this.swapAll(id);
    } catch (err) {
      console.warn(`[render] ${url} failed to load; keeping placeholder`, err);
      this.status.set(id, "missing");
    }
  }

  private swapAll(id: ModelId): void {
    for (const slot of this.slots.get(id) ?? []) {
      slot.clear();
      slot.add(this.buildContent(id));
    }
  }
}

/** Uniformly scales `root` so its widest horizontal extent matches the sprite. */
function fitToFootprint(
  root: THREE.Object3D,
  footprintPx: number | null,
): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (footprintPx === null) {
    // Cutscene props: 1.8 units tall (a person), standing on y = 0, centered.
    const s = 1.8 / Math.max(size.y, 1e-6);
    root.scale.multiplyScalar(s);
    const center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    return;
  }
  const target = simToWorldLength(footprintPx);
  const widest = Math.max(size.x, size.z, 1e-6);
  root.scale.multiplyScalar(target / widest);
}

/** Finds a named node inside a slot, whichever content it holds right now. */
export function findPart(
  slot: THREE.Object3D,
  name: string,
): THREE.Object3D | undefined {
  return slot.getObjectByName(name);
}
