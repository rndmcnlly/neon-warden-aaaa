/** Borrowed-registry presentation port. The caller owns rendering and time. */
import * as THREE from "three";
import { ModelRegistry, type ModelSlot } from "../render/models.ts";
import type { ModelId } from "../render/models.ts";

export interface PresentationOptions {
  reduceMotion: boolean;
  reduceFlashing: boolean;
}

export class InspectionScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(39, 1, 0.1, 120);
  private slots: ModelSlot[] = [];
  private owned: THREE.Mesh[] = [];

  constructor(readonly registry: ModelRegistry) {
    this.scene.background = new THREE.Color(0x07121d);
    this.scene.add(new THREE.HemisphereLight(0xb3daf3, 0x132135, 2));
    const key = new THREE.DirectionalLight(0xffe0b2, 4.5);
    key.position.set(-10, 7, 4);
    const rim = new THREE.DirectionalLight(0x6bcaff, 3);
    rim.position.set(8, 3, -10);
    this.scene.add(key, rim);
  }

  model(id: ModelId, width: number): THREE.Group {
    const root = new THREE.Group();
    const slot = this.registry.create(id);
    root.add(slot);
    this.scene.add(root);
    this.slots.push(slot);
    // Refit on each update: glTF can replace a placeholder asynchronously.
    root.userData.fit = () => {
      root.scale.setScalar(1);
      root.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(slot).getSize(
        new THREE.Vector3(),
      );
      root.scale.setScalar(width / Math.max(size.x, size.z, 0.01));
    };
    return root;
  }

  box(size: [number, number, number], color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
    );
    this.owned.push(mesh);
    this.scene.add(mesh);
    return mesh;
  }

  fit(): void {
    for (const o of this.scene.children) o.userData.fit?.();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    for (const slot of this.slots) this.registry.release(slot);
    this.slots = [];
    for (const mesh of this.owned) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.owned = [];
    this.scene.clear();
  }
}
