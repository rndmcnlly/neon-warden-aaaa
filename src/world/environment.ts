import * as THREE from "three";
import type { SimState } from "../contracts/index.ts";
import { WorldArchive, type WorldLanguage } from "./lore.ts";
import {
  assetFor,
  BUDGET_CAPS,
  instancesOf,
  METERS,
  piecesFor,
  type Placement,
  SCROLL,
  type SectorLayout,
  sectorLayout,
  WORLD_NAMES,
} from "./sectors.ts";
import { type RoutePose, routePose, wrapRel } from "./route.ts";
import {
  boomYaw,
  cranePose,
  lampYaw,
  nurseryPose,
  podVisible,
  podY,
  queueOffset,
  REST_T,
  sparkLevel,
  tollPose,
} from "./activity.ts";
import { InstancedRig, SignBoard, WorldLibrary } from "./kit.ts";

interface Piece {
  readonly placement: Placement;
  readonly rig: InstancedRig;
  readonly copies: ReturnType<typeof instancesOf>;
}

const SPARKS_PER_SOCKET = 6;

/**
 * Render-only sector worlds: Blender-built set pieces along a curved distant
 * route, animated to show work happening, with a rigid combat plane left
 * untouched. Never collides, never forecasts a spawn.
 */
export class SectorWorld {
  readonly group = new THREE.Group();
  readonly archive = new WorldArchive();
  private readonly library: WorldLibrary;
  private readonly signs = new SignBoard();
  private sector = 0;
  private start = 0;
  private lastTick = -1;
  private elapsed = 0;
  private quiet = 0;
  private time = 0;
  private layout: SectorLayout = sectorLayout(1);
  private pieces: Piece[] = [];
  private builtFor = "";
  private buildToken = 0;
  private lowTier = false;
  private tickerClock = 0;
  private readonly pose: RoutePose = { x: 0, y: 0, z: 0, yaw: 0 };
  private readonly sparks: THREE.InstancedMesh;
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
  /** Per-copy light level from the Warden's finale; null is normal power. */
  private power: ((x: number, z: number, i: number) => number) | null = null;
  /** True while lights may be off-normal, so clearing restores them once. */
  private powered = false;
  constructor(baseUrl = "models/world/") {
    this.library = new WorldLibrary(baseUrl);
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
    // Welding sparks: tiny additive bars, warm and small, never bullet-like rings.
    this.sparks = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.05),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a8,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      3 * SPARKS_PER_SOCKET,
    );
    this.sparks.frustumCulled = false;
    this.sparks.visible = false;
    this.group.add(this.sparks);
    void this.library.loadManifest();
  }
  /**
   * Lets the Warden's finale fail (or swell) set-piece lights by position:
   * a shockwave front passing buttress lamps, one by one. Null restores.
   */
  setPower(fn: ((x: number, z: number, i: number) => number) | null): void {
    if (fn) this.powered = true;
    this.power = fn;
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
      this.layout = sectorLayout(sector);
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
  /** (Re)build the active sector's rigs; stale async results are discarded. */
  private async build(low: boolean): Promise<void> {
    const token = ++this.buildToken;
    this.clearPieces();
    const manifest = await this.library.loadManifest();
    if (!manifest || token !== this.buildToken) return;
    const lods = new Set(Object.keys(manifest));
    const tint = new THREE.Color(this.layout.tint);
    const built: Piece[] = [];
    for (const placement of piecesFor(this.layout, low)) {
      const template = await this.library.template(
        assetFor(placement, low, lods),
      );
      if (token !== this.buildToken) {
        built.forEach((p) => p.rig.dispose());
        return;
      }
      if (!template) continue;
      const copies = instancesOf(placement);
      const rig = new InstancedRig(
        template,
        copies.length,
        placement.layer,
        tint,
        this.signs,
        copies.map((c) => c.tint),
      );
      this.group.add(rig.group);
      built.push({ placement, rig, copies });
    }
    this.pieces = built;
  }
  private clearPieces(): void {
    for (const p of this.pieces) {
      this.group.remove(p.rig.group);
      p.rig.dispose();
    }
    this.pieces = [];
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
    const key = `${this.sector}:${low}`;
    if (key !== this.builtFor) {
      this.builtFor = key;
      this.lowTier = low;
      void this.build(low);
    }
    this.signs.setLanguage(language);
    this.spillAge += dt;
    this.spill.intensity = low || reducedFlashing
      ? 0
      : 90 * Math.exp(-this.spillAge * 16);
    this.spill.visible = this.spill.intensity > 0.2;
    if (!reduced) this.time += dt;
    // Progress comes from observed ticks, not wall time; reduced motion holds
    // one composed frame (hero alongside, every activity mid-gesture).
    const progress = reduced ? 0 : (this.elapsed / 60) * SCROLL;
    const t = reduced ? REST_T : this.time;
    this.posePieces(progress, t, reducedFlashing, camera);
    if (!reduced) {
      this.tickerClock += dt;
      if (this.tickerClock > 0.2) {
        this.tickerClock = 0;
        this.signs.paint("gl_ticker", language, (t * 0.04) % 1);
      }
    }
    this.updateLabel(dt, camera, width, height, language);
    this.updateMs = performance.now() - before;
  }
  private posePieces(
    progress: number,
    t: number,
    reducedFlashing: boolean,
    camera: THREE.Camera,
  ): void {
    const { bend, length } = this.layout;
    const toll = tollPose(t);
    const crane = cranePose(t);
    const nursery = nurseryPose(t);
    this.sparks.visible = false;
    for (const { placement: p, rig, copies } of this.pieces) {
      const spacing = copies.length > 1
        ? Math.abs(copies[1].ds - copies[0].ds) || 9
        : 9;
      copies.forEach((c, i) => {
        const root = rig.copies[i];
        let s = p.s + c.ds;
        let shown = true;
        const unit = METERS * (p.scale ?? 1) * c.scale;
        if (p.activity === "queue" || p.activity === "outbound") {
          const speed = p.activity === "queue" ? 0.35 : -0.3;
          s = p.s + queueOffset(t, c.ds, speed, spacing * copies.length);
        } else if (p.activity === "tollPods") {
          const y = podY(t, i);
          s += y * unit;
          shown = podVisible(y);
        }
        const rel = wrapRel(s, progress, length);
        routePose(rel, p.x + c.dx, p.y + c.dy, bend, this.pose);
        root.position.set(this.pose.x, this.pose.y, this.pose.z);
        root.rotation.set(0, (p.yaw ?? 0) + c.yaw + this.pose.yaw, 0);
        if (p.activity === "spin") root.rotation.y += t * 0.03;
        if (p.activity === "tumble") {
          root.rotation.y += t * 0.04 * (i + 1);
          root.rotation.x = Math.sin(t * 0.07 + i) * 0.2;
        }
        root.scale.setScalar(shown ? unit : 0);
        this.animate(p, rig, i, t, toll, crane, nursery);
        if (this.power) {
          rig.setCopyGlow(i, this.power(root.position.x, root.position.z, i));
        } else if (this.powered) rig.setCopyGlow(i, 1);
      });
      rig.commit();
      if (p.activity === "repair" && p.layer === "mid") {
        this.poseSparks(rig, t, reducedFlashing, camera);
      }
    }
  }
  private animate(
    p: Placement,
    rig: InstancedRig,
    i: number,
    t: number,
    toll: ReturnType<typeof tollPose>,
    crane: ReturnType<typeof cranePose>,
    nursery: ReturnType<typeof nurseryPose>,
  ): void {
    switch (p.activity) {
      case "beacon":
        rig.node(i, "od_beacon_lamp")?.rotation.set(0, lampYaw(t), 0);
        break;
      case "repair":
        rig.node(i, "sb_repair_boom")?.rotation.set(0, boomYaw(t), 0);
        break;
      case "toll": {
        // Blender's road axis (+Y) is three's -Z; arms lift about it.
        rig.node(i, "gl_gantry_arm_0")?.rotation.set(0, 0, toll.arm);
        rig.node(i, "gl_gantry_arm_1")?.rotation.set(0, 0, -toll.arm);
        const head = rig.node(i, "gl_gantry_scanner");
        if (head) head.position.z = -toll.scan;
        rig.setVisible("fan", toll.scanning);
        break;
      }
      case "crane": {
        const trolley = rig.node(i, "lg_crane_trolley");
        if (trolley) trolley.position.x = crane.trolley;
        const hoist = rig.node(i, "lg_crane_hoist");
        if (hoist) hoist.position.y = -crane.drop;
        rig.node(i, "lg_crane_cable")?.scale.set(1, crane.drop, 1);
        break;
      }
      case "nursery": {
        const tender = rig.node(i, "la_nursery_tender");
        if (tender) tender.position.x = nursery.tender * 1.5;
        rig.setGlow(nursery.glow, 0.62);
        break;
      }
    }
  }
  private readonly tmp = new THREE.Object3D();
  private readonly socket = new THREE.Vector3();
  private poseSparks(
    rig: InstancedRig,
    t: number,
    reducedFlashing: boolean,
    camera: THREE.Camera,
  ): void {
    this.sparks.visible = true;
    for (let j = 0; j < 3; j++) {
      const node = rig.node(0, `spark__${j}`);
      const level = sparkLevel(t, j, reducedFlashing);
      if (node) node.getWorldPosition(this.socket);
      for (let k = 0; k < SPARKS_PER_SOCKET; k++) {
        const a = k * 2.4 + t * (reducedFlashing ? 0 : 9) + j;
        const r = level > 0 ? 0.05 + ((k * 0.37 + t * 3.1) % 0.3) : 0;
        this.tmp.position.set(
          this.socket.x + Math.cos(a) * r,
          this.socket.y + 0.05 + r * 0.6,
          this.socket.z + Math.sin(a) * r,
        );
        this.tmp.quaternion.copy(camera.quaternion);
        this.tmp.rotateZ(a);
        this.tmp.scale.setScalar(level > 0 && node ? level : 0);
        this.tmp.updateMatrix();
        this.sparks.setMatrixAt(j * SPARKS_PER_SOCKET + k, this.tmp.matrix);
      }
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }
  private updateLabel(
    dt: number,
    camera: THREE.Camera,
    width: number,
    height: number,
    language: WorldLanguage,
  ): void {
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
      ) * pixels * (camera as THREE.PerspectiveCamera).projectionMatrix
      .elements[0];
    this.sign.visible = this.quiet > 45 && this.labelSeconds > 0 &&
      width / height > 1.35 && signWidth >= 240 &&
      (p.x + 1) * pixels - signWidth / 2 > 12 &&
      p.x * pixels + signWidth / 2 < leftLane.x * pixels - 20;
  }
  stats() {
    let drawCalls = this.sparks.visible ? 1 : 0, triangles = 0;
    for (const { rig } of this.pieces) {
      const s = rig.stats();
      drawCalls += s.drawCalls;
      triangles += s.triangles;
    }
    const caps = this.lowTier ? BUDGET_CAPS.low : BUDGET_CAPS.high;
    return {
      sector: this.sector,
      name: WORLD_NAMES[this.sector - 1],
      tier: this.lowTier ? "low" : "high",
      pieces: this.pieces.map((p) => p.placement.asset),
      drawCalls,
      triangles: Math.round(triangles),
      textureBytes: Math.round(this.signs.bytes),
      maxDrawCalls: caps.drawCalls,
      updateMs: this.updateMs,
      signVisible: this.sign.visible,
      elapsedTicks: this.elapsed,
    };
  }
  dispose(): void {
    this.buildToken++;
    this.clearPieces();
    this.signs.dispose();
    this.sparks.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    this.sparks.dispose();
    this.texture.dispose();
    this.sign.material.dispose();
  }
}
