import * as THREE from "three";
import type { SimState } from "../contracts/index.ts";
import { WorldArchive, type WorldLanguage } from "./lore.ts";
import { sectorBlocks, WORLD_BUDGET, WORLD_NAMES } from "./sectors.ts";

/** Bounded, render-only diorama. One active kit, three instanced materials. */
export class SectorWorld {
  readonly group = new THREE.Group();
  readonly archive = new WorldArchive();
  private sector = 0;
  private start = 0;
  private lastTick = -1;
  private elapsed = 0;
  private quiet = 0;
  private time = 0;
  private kit = new THREE.Group();
  private movers: THREE.Mesh[] = [];
  private readonly geometry = new THREE.BoxGeometry();
  private readonly materials = [
    new THREE.MeshStandardMaterial({
      color: 0x17232a,
      metalness: 0.72,
      roughness: 0.48,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x40565b,
      metalness: 0.55,
      roughness: 0.66,
    }),
    // Recessed long strips: restrained emission, never pickup-hot dots.
    new THREE.MeshStandardMaterial({
      color: 0x698679,
      metalness: 0.25,
      roughness: 0.8,
      emissive: 0x365b50,
      emissiveIntensity: 0.22,
    }),
  ];
  private readonly spill = new THREE.PointLight(0xffc596, 0, 24, 2);
  private spillAge = 1;
  private readonly canvas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private readonly sign: THREE.Sprite;
  private signKey = "";
  private shown = new Set<number>();
  private labelSeconds = 0;
  private active = false;
  private updateMs = 0;
  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sign = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    this.sign.position.set(-12, 0, 1);
    this.sign.scale.set(7, 3.5, 1);
    this.sign.visible = false;
    this.sign.renderOrder = 3;
    this.group.add(this.sign);
    this.group.add(this.spill);
  }
  /** One pooled local light, no shadows or new per-explosion objects. */
  flash(x: number, z: number): void {
    if (this.spillAge < 0.18) return;
    this.spill.position.set(x, 1.5, z);
    this.spillAge = 0;
  }
  observe(state: SimState, danger: boolean): void {
    if (state.tick < this.lastTick) {
      this.archive.clear();
      this.shown.clear();
      this.sector = 0;
    }
    this.lastTick = state.tick;
    const sector = Math.min(5, Math.max(1, state.sector));
    if (sector !== this.sector) {
      this.sector = sector;
      this.start = state.tick;
      this.build();
      this.labelSeconds = 0;
      this.quiet = 0;
    }
    this.elapsed = Math.max(0, state.tick - this.start);
    this.active = state.phase === "sector" || state.phase === "boss" ||
      state.phase === "bossWarning" || state.phase === "ended";
    if (this.active) this.archive.discover(sector, this.elapsed);
    // A lull must be real, not just a guessed gap between table entries.
    if (
      danger || state.phase !== "sector" || state.enemies.length > 0 ||
      state.bullets.some((b) => b.kind !== "shot")
    ) this.quiet = 0;
    else this.quiet++;
  }
  private build(): void {
    this.group.remove(this.kit);
    for (const child of this.kit.children) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
    }
    this.kit = new THREE.Group();
    this.group.add(this.kit);
    const blocks = sectorBlocks(this.sector);
    const transform = new THREE.Object3D();
    for (let material = 0; material < 3; material++) {
      const selected = blocks.filter((b) => b.material === material);
      const batch = new THREE.InstancedMesh(
        this.geometry,
        this.materials[material],
        selected.length,
      );
      selected.forEach((b, i) => {
        transform.position.set(b.x, b.y, b.z);
        transform.scale.set(b.w, b.h, b.d);
        transform.rotation.set(0, b.roll ?? 0, 0);
        transform.updateMatrix();
        batch.setMatrixAt(i, transform.matrix);
      });
      batch.computeBoundingSphere();
      this.kit.add(batch);
    }
    this.movers = [];
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.materials[1]);
      mesh.position.set((i % 2 === 0 ? 1 : -1) * 12, -1.5, -15 + i * 9);
      mesh.scale.set(
        this.sector === 4 ? 2.6 : 3,
        0.3,
        this.sector === 1 ? 4 : 0.7,
      );
      this.kit.add(mesh);
      this.movers.push(mesh);
    }
  }
  update(
    dt: number,
    camera: THREE.Camera,
    width: number,
    height: number,
    low: boolean,
    reduced: boolean,
    language: WorldLanguage,
    visible: boolean,
    reducedFlashing = false,
  ): void {
    const before = performance.now();
    this.group.visible = visible && this.active;
    if (!this.group.visible) return;
    this.spillAge += dt;
    this.spill.intensity = low || reducedFlashing
      ? 0
      : 90 * Math.exp(-this.spillAge * 16);
    this.spill.visible = this.spill.intensity > 0.2;
    if (!reduced) this.time += dt;
    // Progress comes from observed ticks, not wall time. Landmark approaches once.
    this.kit.position.z = reduced ? 0 : Math.min(5, this.elapsed / 360);
    this.movers.forEach((m, i) => {
      m.visible =
        i < (low ? WORLD_BUDGET.movingPropsLow : WORLD_BUDGET.movingPropsHigh);
      const t = reduced ? 0 : this.time;
      if (this.sector === 1 || this.sector === 4) {
        m.position.z = -19 +
          ((t * (this.sector === 4 ? 0.8 : 0.35) + i * 11) % 32);
      } else {m.rotation.y = Math.sin(t * 0.22 + i) *
          (this.sector === 5 ? 0.08 : 0.45);}
    });
    const entries = this.archive.entries(language).filter((e) =>
      e.sector === this.sector
    );
    if (
      !this.shown.has(this.sector) && this.quiet > 45 && this.elapsed > 360 &&
      entries.length
    ) {
      this.shown.add(this.sector);
      this.labelSeconds = 8;
    }
    this.labelSeconds = Math.max(0, this.labelSeconds - dt);
    const text = entries[0]?.text ?? "";
    if (text !== this.signKey) {
      this.signKey = text;
      const ctx = this.canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 1024, 512);
      ctx.fillStyle = "#a5bcb5";
      ctx.textAlign = "center";
      const lines = text.split("\n");
      let row = 0;
      for (const [i, line] of lines.entries()) {
        ctx.font = `500 ${i === 0 ? 76 : 72}px sans-serif`;
        let part = "";
        // Character wrapping also works without spaces in Simplified Chinese.
        for (const character of line) {
          if (ctx.measureText(part + character).width > 960) {
            ctx.fillText(part.trim(), 512, 130 + row++ * 86);
            part = "";
          }
          part += character;
        }
        ctx.fillText(part.trim(), 512, 130 + row++ * 86);
      }
      this.texture.needsUpdate = true;
    }
    // Reject signage rather than shrinking it or intruding into the lane.
    camera.updateMatrixWorld();
    const p = this.sign.position.clone().project(camera);
    const leftLane = new THREE.Vector3(-6.7, 0, 2).project(camera);
    const pixels = width * 0.5;
    const signWidth = 7 /
      Math.max(
        1,
        Math.abs(
          this.sign.position.clone().applyMatrix4(camera.matrixWorldInverse).z,
        ),
      ) * pixels * camera.projectionMatrix.elements[0];
    this.sign.visible = this.quiet > 45 && this.labelSeconds > 0 &&
      width / height > 1.35 && signWidth >= 240 &&
      (p.x + 1) * pixels - signWidth / 2 > 12 &&
      p.x * pixels + signWidth / 2 < leftLane.x * pixels - 20;
    this.updateMs = performance.now() - before;
  }
  stats() {
    return {
      sector: this.sector,
      name: WORLD_NAMES[this.sector - 1],
      blocks: this.sector ? sectorBlocks(this.sector).length : 0,
      maxDrawCalls: WORLD_BUDGET.drawCalls,
      updateMs: this.updateMs,
      signVisible: this.sign.visible,
      elapsedTicks: this.elapsed,
    };
  }
  dispose(): void {
    for (const child of this.kit.children) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
    }
    this.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
    this.texture.dispose();
    this.sign.material.dispose();
  }
}
