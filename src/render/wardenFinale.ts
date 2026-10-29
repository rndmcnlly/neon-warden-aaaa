/**
 * The Warden's finale: what the screen does after the fight is decided.
 *
 * Playtest note (Adam, October 29): after the Warden's health reached zero,
 * the old sequence was eight blasts and a flash, then seven seconds of an
 * intact, shielded Warden in close-up and a wide shot of empty starfield
 * (`research/2026-10-29-warden-defeat/`). This module stages the defeat as a
 * sequence of physical causes and consequences, and gives the pacifist path
 * an equally rich, different one.
 *
 * Kill (`bossDefeated`), seconds from the decisive hit (`KILL_STAGING`):
 *   impact frame, then the four pods tear off in turn and fly outward along
 *   their own sockets; the seams overload; the heart crest cracks apart; the
 *   core surges and collapses; a shockwave sweeps across the lane and out
 *   into Last Approach, where buttress and nursery lights fail one by one as
 *   it passes and the scouts drop powerless. The wreck sags and settles. Its
 *   halo rings go dark one at a time under the Warden's dying line. Later
 *   the Authority's tollgates unfold along both lane edges, across the sky
 *   and out in the side regions (`beat("tollgates")`).
 *
 * Pacifist (`bossSurvived`): no impact. The Warden lowers its shield and
 * folds its pods in, intact; a red recall tether runs from it into the sky
 * until it cuts the leash (`beat("leashCut")`), when Last Approach's lights
 * swell outward from it; then its scouts fly in from the sides to escort it
 * home up the open lane (`beat("escort")`).
 *
 * The module is render-only. It never reads or writes sim state: the sim
 * decided the outcome, and this is the picture of that decision. It owns
 * the Warden's model from `begin` until `reset`, so the camera keeps a
 * composed subject even after the sim withdraws or removes its Warden.
 *
 * Accessibility and budget: reduced motion keeps every cause and effect but
 * removes the flinging, swinging and tumbling (parts fade and settle, gates
 * appear in place and light in sequence); reduced flashing caps flashes and
 * removes flicker; the low tier halves scouts and tollgates and drops
 * particle trails. Everything is built from shared geometry and merged
 * meshes, a few dozen draw calls at most.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FIELD_W } from "./coords.ts";
import { PALETTE } from "./palette.ts";

export type FinaleKind = "kill" | "pacifist";
/** Story beats the Director's flags hand to the finale (wired in main.ts). */
export type FinaleBeat = "tollgates" | "leashCut" | "escort";

/** Synth roles in `src/audio/gameplaySounds.ts` the finale times itself. */
export type FinaleSound =
  | "finale_impact"
  | "pod_break"
  | "finale_groan"
  | "finale_crack"
  | "boss_collapse"
  | "finale_shock"
  | "finale_light_out"
  | "finale_toll_arrive"
  | "finale_toll_clank"
  | "finale_leash_snap"
  | "finale_escort";

/** The stage's effects, handed in so this module never owns a pool. */
export interface FinalePorts {
  blast(at: THREE.Vector3, color: number, count: number, scale: number): void;
  ring(at: THREE.Vector3, color: number, scale: number, life: number): void;
  flash(strength: number, color: number): void;
  trauma(amount: number): void;
  /** Screen-space pressure wave centred on a world point. */
  pressure(at: THREE.Vector3, level: number): void;
  /** Hands a model node to the debris field, flung along `outward`. */
  tearOff(
    node: THREE.Object3D,
    at: THREE.Vector3,
    outward: THREE.Vector3,
  ): void;
  /** Darkens (0) or restores (1) a model's emissives over time. */
  power(slot: THREE.Object3D, level: number): void;
  sound(role: FinaleSound): void;
  /** A fresh scout model (the drone), parented by the finale. */
  scout(): THREE.Object3D;
}

export interface FinaleFrame {
  readonly dt: number;
  readonly low: boolean;
  readonly reducedMotion: boolean;
  readonly reducedFlashing: boolean;
}

/**
 * Seconds from `bossDefeated`. The kill timeline's opening pause
 * (`DEFEAT_STAGING_MS` in `src/scenes/endingKill.timeline.ts`) must cover
 * `settled`, so the Warden's dying line lands in the quiet after it.
 */
export const KILL_STAGING = Object.freeze({
  /** Render-side hold on the impact frame (the sim has its own hitstop). */
  hold: 0.14,
  pods: [0.32, 0.64, 0.94, 1.2] as const,
  groan: 0.9,
  seamsFrom: 0.5,
  seamsPeak: 2.4,
  cracks: [1.7, 2.15] as const,
  surge: 2.35,
  collapse: 2.75,
  /** World units per second: the shockwave crosses Last Approach in ~1.7 s. */
  shockSpeed: 28,
  shockReach: 48,
  settled: 4.4,
  /** Halo rings go dark under "there goes another ring" (line starts ~4.6). */
  rings: [5.9, 8.6] as const,
});

/** Pod sockets, in the order they tear off: the cannon first, the spiral last. */
const POD_ORDER = ["pod_2", "pod_0", "pod_1", "pod_3"] as const;
const PLATES = [
  "warden_plate_ul",
  "warden_plate_ur",
  "warden_plate_ll",
  "warden_plate_lr",
] as const;
const RINGS = ["warden_ring_outer", "warden_ring_inner"] as const;

/** Authority livery: gunmetal frames, amber lamps, a white service strip. */
const TOLL_FRAME = 0x2a2f38;
const TOLL_LAMP = 0xffb84d;
const TOLL_STRIP = 0xf2efe6;

interface Gate {
  readonly root: THREE.Group;
  /** Rises from below the lane, then the arm or span swings into place. */
  readonly body: THREE.Object3D;
  readonly arm: THREE.Object3D | null;
  readonly lamps: THREE.Mesh;
  readonly start: number;
  /** Arm rotation when closed; arms start upright. */
  readonly armClosed: number;
  arrived: boolean;
  locked: boolean;
}

interface Scout {
  readonly slot: THREE.Object3D;
  readonly home: THREE.Vector3;
  /** Formation offset around the Warden (pacifist escort). */
  readonly slotOffset: THREE.Vector3;
  readonly phase: number;
  /** Kill: when the shockwave reached it and it lost power. */
  poweredOffAt: number | null;
}

/** A per-copy hash in [0, 1), so lights fail in a scattered order. */
function hash(x: number, z: number, i: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + i * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
/** Overshoots a little before settling: steel arriving with weight. */
const backOut = (t: number) => {
  const c = Math.min(1, Math.max(0, t)) - 1;
  return 1 + 2.2 * c * c * c + 1.2 * c * c;
};

/** After a skip the aftermath is drawn silently: no replayed bursts or sounds. */
const QUIET: Omit<FinalePorts, "power" | "scout" | "tearOff"> = {
  blast() {},
  ring() {},
  flash() {},
  trauma() {},
  pressure() {},
  sound() {},
};

export class WardenFinale {
  /** Tollgates, the shock ring, the leash and the scouts live here. */
  readonly group = new THREE.Group();
  kind: FinaleKind | null = null;
  /** Where the Warden is drawn: the camera's `ctx.boss` while active. */
  readonly wardenAt = new THREE.Vector3();

  private warden: THREE.Object3D | null = null;
  private t = 0;
  private holdLeft = 0;
  private readonly origin = new THREE.Vector3();
  private readonly fired = new Set<string>();
  private readonly plateHome = new Map<THREE.Object3D, THREE.Vector3>();
  private readonly seamBase = new Map<THREE.MeshStandardMaterial, number>();
  private readonly dimmed = new Map<
    THREE.MeshStandardMaterial,
    number
  >();
  private scouts: Scout[] = [];
  private gates: Gate[] = [];
  private gatesAt: number | null = null;
  private leashCutAt: number | null = null;
  private escortAt: number | null = null;
  private readonly shock: THREE.Mesh;
  private readonly shockMat: THREE.MeshBasicMaterial;
  private readonly leash: THREE.Group;
  private readonly leashUpper: THREE.Mesh;
  private readonly leashLower: THREE.Mesh;
  private readonly leashMat: THREE.MeshBasicMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private low = false;
  private skipped = false;

  constructor(private readonly ports: FinalePorts) {
    this.shockMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.gold).multiplyScalar(1.6),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 1, 128),
      this.shockMat,
    );
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.visible = false;
    this.shock.renderOrder = 4;
    this.group.add(this.shock);

    // The recall link: Authority red, hair-thin, running into the sky.
    this.leashMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.crimson).multiplyScalar(1.4),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const strand = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    strand.translate(0, 0.5, 0);
    this.leash = new THREE.Group();
    this.leashLower = new THREE.Mesh(strand, this.leashMat);
    this.leashUpper = new THREE.Mesh(strand, this.leashMat);
    this.leash.add(this.leashLower, this.leashUpper);
    this.leash.visible = false;
    this.group.add(this.leash);
  }

  get active(): boolean {
    return this.kind !== null;
  }

  /** Scout models, so the stage can drain their lights with its own look. */
  get scoutSlots(): readonly THREE.Object3D[] {
    return this.scouts.map((s) => s.slot);
  }

  /** Moment effects: the stage's, or nothing once a skip has landed. */
  private get fx(): Omit<FinalePorts, "power" | "scout" | "tearOff"> {
    return this.skipped ? QUIET : this.ports;
  }

  /** Seconds since the outcome. */
  get elapsed(): number {
    return this.t;
  }

  /** Takes over the Warden's model at the moment the outcome is decided. */
  begin(kind: FinaleKind, warden: THREE.Object3D, low: boolean): void {
    this.reset();
    this.kind = kind;
    this.low = low;
    this.warden = warden;
    this.origin.copy(warden.position);
    this.wardenAt.copy(warden.position);
    this.t = 0;
    this.holdLeft = kind === "kill" ? KILL_STAGING.hold : 0;
    warden.traverse((o) => {
      if (PLATES.includes(o.name as typeof PLATES[number])) {
        this.plateHome.set(o, o.position.clone());
      }
    });
    const shell = warden.getObjectByName("warden_shield");
    if (kind === "kill") {
      // The impact frame: one white frame, a hard ring, the shell gone.
      if (shell) shell.visible = false;
      this.fx.flash(0.9, PALETTE.iceWhite);
      this.fx.ring(warden.position, PALETTE.iceWhite, 4.5, 0.4);
      this.fx.trauma(0.7);
      this.fx.sound("finale_impact");
    }
    this.spawnScouts();
  }

  /** A story beat from the Director (a flag it set). */
  beat(beat: FinaleBeat): void {
    if (beat === "tollgates" && this.kind === "kill" && this.gatesAt === null) {
      this.gatesAt = this.t;
      this.buildGates();
    }
    if (beat === "leashCut" && this.kind === "pacifist") {
      this.leashCutAt ??= this.t;
    }
    if (beat === "escort" && this.kind === "pacifist") {
      this.escortAt ??= this.t;
      this.leashCutAt ??= this.t;
    }
  }

  /**
   * A skipped scene lands on the end state: jump the clock past every
   * staged beat so the next frame draws the aftermath, not the middle.
   */
  skipToEnd(): void {
    if (!this.kind) return;
    this.holdLeft = 0;
    this.t = Math.max(this.t, KILL_STAGING.rings[1] + 1, 40);
    if (this.gatesAt !== null) this.gatesAt = -100;
    if (this.leashCutAt !== null) this.leashCutAt = -100;
    if (this.escortAt !== null) this.escortAt = -100;
    // Sounds and bursts belong to the moment; a skip does not replay them.
    this.skipped = true;
  }

  reset(): void {
    for (const s of this.scouts) s.slot.removeFromParent();
    this.scouts = [];
    for (const g of this.gates) g.root.removeFromParent();
    this.gates = [];
    this.gatesAt = null;
    this.leashCutAt = null;
    this.escortAt = null;
    this.fired.clear();
    this.skipped = false;
    this.plateHome.clear();
    this.seamBase.clear();
    this.dimmed.clear();
    this.shock.visible = false;
    this.leash.visible = false;
    this.kind = null;
    this.warden = null;
  }

  /**
   * World light level for one set piece copy at (x, z), 0 dark to about 1.5
   * bright; `SectorWorld.setPower` asks this every frame while active.
   */
  power(x: number, z: number, i: number, reducedFlashing: boolean): number {
    if (this.kind === "kill") {
      const since = this.t - KILL_STAGING.collapse;
      if (since < 0) return 1;
      const d = Math.hypot(x - this.origin.x, z - this.origin.z);
      // When this copy fails: the front reaches it, then a scattered delay,
      // so the lights go one by one rather than as a single wipe.
      const local = since - d / KILL_STAGING.shockSpeed - hash(x, z, i) * 0.9;
      if (local < 0) return 1;
      if (local < 0.35 && !reducedFlashing) {
        return Math.sin(local * 90) > 0 ? 1.1 : 0.15;
      }
      return Math.max(0.05, 1 - local / 0.35);
    }
    if (this.kind === "pacifist" && this.leashCutAt !== null) {
      const since = this.t - this.leashCutAt;
      const d = Math.hypot(x - this.wardenAt.x, z - this.wardenAt.z);
      const local = since - d / 14 - hash(x, z, i) * 0.4;
      return 1 + 0.5 * smooth(local / 0.8);
    }
    return 1;
  }

  update(frame: FinaleFrame): void {
    if (!this.kind || !this.warden) return;
    this.low = frame.low;
    // The impact frame holds before anything moves.
    if (this.holdLeft > 0) {
      this.holdLeft -= frame.dt;
      return;
    }
    this.t += frame.dt;
    if (this.kind === "kill") this.updateKill(frame);
    else this.updatePacifist(frame);
    this.updateScouts(frame);
    this.updateGates(frame);
  }

  // ------------------------------------------------------------------ kill

  private updateKill(f: FinaleFrame): void {
    const w = this.warden!;
    const k = KILL_STAGING;
    const t = this.t;

    // Pods tear off in sequence, each along its own outward direction.
    k.pods.forEach((at, i) => {
      const name = POD_ORDER[i];
      if (t < at || !this.once(`pod:${name}`)) return;
      const pod = w.getObjectByName(name);
      if (!pod || !pod.visible) return;
      pod.getWorldPosition(this.tmp);
      const outward = this.tmp2.copy(this.tmp).sub(w.position).setY(0);
      if (outward.lengthSq() < 1e-4) outward.set(i % 2 ? 1 : -1, 0, 0);
      outward.normalize();
      // Reduced motion: the pod still leaves, but drifts instead of flying.
      if (f.reducedMotion) outward.multiplyScalar(0.35);
      if (!this.skipped) {
        this.ports.tearOff(pod, this.tmp.clone(), outward.clone());
      }
      pod.visible = false;
      this.fx.blast(
        this.tmp.clone(),
        i % 2 ? PALETTE.gold : PALETTE.crimson,
        50,
        1.4,
      );
      this.fx.ring(this.tmp, PALETTE.gold, 1.6, 0.35);
      this.fx.trauma(0.32);
      this.fx.sound("pod_break");
    });
    if (t >= k.groan && this.once("groan")) this.fx.sound("finale_groan");

    // Seams overload: a ramp to white heat, flickering unless asked not to.
    const over = t < k.collapse
      ? smooth((t - k.seamsFrom) / (k.seamsPeak - k.seamsFrom))
      : 0;
    const flicker = f.reducedFlashing ? 1 : 0.75 + 0.25 * Math.sin(t * 61);
    this.driveSeams(w, t < k.collapse ? (1 + over * 2.2) * flicker : 0.02);

    // The heart crest cracks: plates part along their own diagonals.
    k.cracks.forEach((at, i) => {
      if (t >= at && this.once(`crack:${i}`)) {
        this.fx.sound("finale_crack");
        this.fx.blast(
          w.position.clone().setY(0.8),
          PALETTE.sparkCream,
          30,
          0.8,
        );
        this.fx.trauma(0.25);
      }
    });
    const part = t < k.cracks[0]
      ? 0
      : t < k.cracks[1]
      ? 0.12
      : 0.12 + 0.3 * smooth((t - k.cracks[1]) / 1.4);
    for (const [plate, home] of this.plateHome) {
      this.tmp.copy(home).setY(0);
      if (this.tmp.lengthSq() > 1e-6) this.tmp.normalize();
      plate.position.copy(home).addScaledVector(this.tmp, part);
      plate.rotation.z = (home.x >= 0 ? -1 : 1) * part * 0.4;
    }

    // Core: surge, then collapse to nothing.
    const core = w.getObjectByName("core");
    if (core) {
      const surge = smooth((t - k.surge) / (k.collapse - k.surge));
      const fall = smooth((t - k.collapse) / 0.18);
      core.scale.setScalar(Math.max(0.001, (1 + surge * 0.9) * (1 - fall)));
    }
    if (t >= k.surge && this.once("surge")) {
      this.fx.ring(w.position, PALETTE.gold, 2.2, 0.4);
    }
    if (t >= k.collapse && this.once("collapse")) {
      const at = w.position.clone().setY(0.6);
      this.fx.flash(f.reducedFlashing ? 0.35 : 0.85, PALETTE.gold);
      this.fx.blast(at, PALETTE.iceWhite, 160, 3.2);
      this.fx.blast(at, PALETTE.crimson, 60, 2);
      this.fx.trauma(0.9);
      if (!f.reducedMotion) this.fx.pressure(at, 3);
      this.fx.sound("boss_collapse");
      this.fx.sound("finale_shock");
      this.ports.power(w, 0);
    }
    // Lights failing out in the world: a scattered click track that follows
    // the front (the world's own lights obey `power()`).
    for (let i = 0; i < (this.low ? 5 : 9); i++) {
      const at = k.collapse + 0.25 + i * 0.17 + hash(i, 1, 2) * 0.1;
      if (t >= at && this.once(`out:${i}`)) this.fx.sound("finale_light_out");
    }

    // The shockwave: one flat ring sweeping out across the lane and beyond.
    const since = t - k.collapse;
    const radius = since * k.shockSpeed;
    this.shock.visible = since >= 0 && radius < k.shockReach;
    if (this.shock.visible) {
      this.shock.position.set(this.origin.x, -0.4, this.origin.z);
      this.shock.scale.setScalar(Math.max(0.01, radius));
      this.shockMat.opacity = (1 - radius / k.shockReach) *
        (f.reducedFlashing ? 0.45 : 0.9);
    }

    // The wreck sags, tilts and settles: dead weight, not an explosion.
    const sag = smooth((t - k.collapse) / (k.settled - k.collapse));
    w.position.set(this.origin.x, -0.7 * sag, this.origin.z);
    w.rotation.set(0.28 * sag, 0, (f.reducedMotion ? 0 : 0.12) * sag);
    this.wardenAt.copy(w.position);

    // Halo rings go dark one at a time, under the dying line.
    k.rings.forEach((at, i) => {
      const ring = w.getObjectByName(RINGS[i]) ??
        (i === 0 ? w.getObjectByName("halo") : undefined);
      if (!ring) return;
      const level = t < at ? 1 : 1 - smooth((t - at) / 0.6);
      this.dim(ring, level);
      if (t >= at && this.once(`ring:${i}`)) {
        this.fx.sound("finale_light_out");
        ring.getWorldPosition(this.tmp);
        this.fx.ring(this.tmp, PALETTE.slate, 2.6, 0.7);
      }
    });
    const halo = w.getObjectByName("halo");
    if (halo && !f.reducedMotion) {
      // The halo winds down instead of stopping dead.
      halo.rotation.z += f.dt * 0.4 * Math.max(0, 1 - since / 3);
    }
  }

  // -------------------------------------------------------------- pacifist

  private updatePacifist(f: FinaleFrame): void {
    const w = this.warden!;
    const t = this.t;
    // Lowering its guard: the shell shrinks away, pods fold toward the core.
    const calm = smooth(t / 1.6);
    const shell = w.getObjectByName("warden_shield");
    if (shell) {
      shell.visible = calm < 0.98;
      shell.scale.setScalar(1 + calm * 0.15);
    }
    for (const name of POD_ORDER) {
      const pod = w.getObjectByName(name);
      if (pod) pod.scale.setScalar(1 - 0.18 * calm);
    }
    this.driveSeams(w, 0.55 + 0.1 * Math.sin(t * 1.2));
    const core = w.getObjectByName("core");
    if (core) core.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
    const halo = w.getObjectByName("halo");
    if (halo && !f.reducedMotion) halo.rotation.z += f.dt * 0.15;

    // Where it goes: holds and listens, then climbs home up the open lane.
    const bob = f.reducedMotion ? 0 : Math.sin(t * 0.9) * 0.18;
    const climb = this.escortAt === null
      ? 0
      : smooth((t - this.escortAt - 1.5) / 16);
    w.position.set(
      this.origin.x * (1 - climb),
      0.4 + bob + climb * 2.2,
      this.origin.z - climb * 24,
    );
    // Turns its back on the player only once it is leaving.
    w.rotation.set(0, Math.PI * smooth((t - (this.escortAt ?? 1e9)) / 4), 0);
    this.wardenAt.copy(w.position);

    // The recall tether: intact until the leash is cut, then it whips apart.
    this.leash.visible = true;
    const anchor = this.tmp.set(this.origin.x + 7, 18, this.origin.z - 34);
    const from = this.tmp2.copy(w.position).setY(w.position.y + 0.6);
    const length = from.distanceTo(anchor);
    this.leash.position.copy(from);
    this.leash.lookAt(anchor);
    this.leash.rotateX(Math.PI / 2);
    const cut = this.leashCutAt === null ? 0 : (t - this.leashCutAt) / 0.9;
    if (this.leashCutAt !== null && this.once("leash")) {
      this.fx.sound("finale_leash_snap");
      this.fx.blast(from.clone(), PALETTE.crimson, 40, 1.2);
      this.fx.ring(from, PALETTE.cyan, 2.4, 0.5);
      this.fx.flash(f.reducedFlashing ? 0.15 : 0.35, PALETTE.paleCyan);
    }
    if (cut <= 0) {
      this.leashLower.scale.set(1, length * 0.5, 1);
      this.leashUpper.position.set(0, length * 0.5, 0);
      this.leashUpper.scale.set(1, length * 0.5, 1);
      this.leashMat.opacity = f.reducedFlashing
        ? 0.7
        : 0.65 + 0.25 * Math.sin(t * 7);
    } else {
      // The lower half drops from the Warden; the upper reels into the sky.
      const c = Math.min(1, cut);
      this.leashLower.scale.set(1, Math.max(0.01, length * 0.5 * (1 - c)), 1);
      this.leashUpper.position.set(0, length * (0.5 + 0.5 * c), 0);
      this.leashUpper.scale.set(1, Math.max(0.01, length * 0.5 * (1 - c)), 1);
      this.leashMat.opacity = 0.85 * (1 - c);
      this.leash.visible = c < 1;
    }
    if (this.escortAt !== null && this.once("escort")) {
      this.fx.sound("finale_escort");
    }
  }

  // ---------------------------------------------------------------- scouts

  private spawnScouts(): void {
    const half = FIELD_W / 2;
    const count = this.low ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      // Kill: hovering beside the arena, in the fall shot's foreground.
      // Pacifist: further out and behind the Warden, clear of the close-up
      // camera (a near pink hull bloomed over half the frame).
      const home = this.kind === "kill"
        ? new THREE.Vector3(
          side * (half + 2.6 + row * 1.4),
          0.6 + row * 0.7,
          this.origin.z + 1.5 + row * 3.2,
        )
        : new THREE.Vector3(
          side * (half + 4.5 + row * 1.6),
          0.8 + row * 0.6,
          this.origin.z - 2 - row * 3,
        );
      const slot = this.ports.scout();
      slot.position.copy(home);
      // Large enough to read as scouts in a wide shot, not as specks.
      slot.scale.setScalar(2.2);
      this.group.add(slot);
      const angle = (i / count) * Math.PI * 2;
      this.scouts.push({
        slot,
        home,
        slotOffset: new THREE.Vector3(
          Math.cos(angle) * 2.6,
          Math.sin(angle * 2) * 0.4,
          Math.sin(angle) * 1.8,
        ),
        phase: i * 1.7,
        poweredOffAt: null,
      });
    }
  }

  private updateScouts(f: FinaleFrame): void {
    const t = this.t;
    for (const s of this.scouts) {
      const p = s.slot.position;
      if (this.kind === "kill") {
        const since = t - KILL_STAGING.collapse;
        const d = Math.hypot(
          s.home.x - this.origin.x,
          s.home.z - this.origin.z,
        );
        const hit = since - d / KILL_STAGING.shockSpeed;
        if (hit >= 0 && s.poweredOffAt === null) {
          s.poweredOffAt = t;
          this.ports.power(s.slot, 0);
          this.fx.blast(p.clone(), PALETTE.slate, 10, 0.5);
        }
        if (s.poweredOffAt === null) {
          // Hovering in the nursery, lit, watching the fight.
          p.set(
            s.home.x,
            s.home.y + (f.reducedMotion ? 0 : Math.sin(t * 2 + s.phase) * 0.12),
            s.home.z,
          );
          s.slot.rotation.y = t * 0.5 + s.phase;
        } else {
          // Powerless: drifting outward and down, slowly tumbling. Gone
          // from the draw list once it has sunk out of every ending shot.
          const dead = t - s.poweredOffAt;
          s.slot.visible = dead < 5;
          const drift = f.reducedMotion ? 0.15 : 0.45;
          p.set(
            s.home.x + Math.sign(s.home.x) * dead * drift,
            s.home.y - Math.min(3.5, dead * dead * 0.12 + dead * 0.2),
            s.home.z + dead * drift * 0.4,
          );
          if (!f.reducedMotion) {
            s.slot.rotation.x = dead * 0.35 + s.phase;
            s.slot.rotation.z = dead * 0.22;
          }
        }
      } else {
        // Pacifist: waiting at the edges, then forming up as an escort.
        const join = this.escortAt === null
          ? 0
          : smooth((t - this.escortAt - this.scouts.indexOf(s) * 0.25) / 2.5);
        this.tmp.copy(this.wardenAt).add(s.slotOffset);
        p.lerpVectors(s.home, this.tmp, join);
        if (!f.reducedMotion) {
          p.y += Math.sin(t * 2.2 + s.phase) * 0.1;
          s.slot.rotation.y = t * 0.8 + s.phase;
        }
      }
    }
  }

  // ------------------------------------------------------------- tollgates

  /** Shared geometry: one merged frame per gate kind, one arm, one lamp bar. */
  private buildGates(): void {
    const half = FIELD_W / 2;
    const frame = new THREE.MeshStandardMaterial({
      color: TOLL_FRAME,
      metalness: 0.75,
      roughness: 0.4,
      emissive: new THREE.Color(TOLL_STRIP).multiplyScalar(0.03),
    });
    const lampOff = new THREE.Color(TOLL_LAMP).multiplyScalar(0.12);
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z = 0,
    ) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

    // Lane-edge gantry: a portal straddling the edge, its barrier arm
    // hinged at the inner post, swinging down across the lane.
    const edgeFrame = mergeGeometries([
      box(0.22, 3.4, 0.22, -1, 1.7),
      box(0.22, 3.4, 0.22, 1, 1.7),
      box(2.5, 0.3, 0.32, 0, 3.45),
      box(2.3, 0.08, 0.34, 0, 3.15),
    ])!;
    const edgeLamps = mergeGeometries([
      box(0.22, 0.14, 0.36, -0.7, 3.45),
      box(0.22, 0.14, 0.36, 0, 3.45),
      box(0.22, 0.14, 0.36, 0.7, 3.45),
    ])!;
    const armGeo = mergeGeometries([
      box(0.12, 3.6, 0.12, 0, 1.8),
      box(0.16, 0.5, 0.14, 0, 0.9),
      box(0.16, 0.5, 0.14, 0, 2.3),
    ])!;
    // Sky arch: two pylons and a span, a dozen lamps along it.
    const archFrame = mergeGeometries([
      box(0.7, 12, 0.7, -16, 3),
      box(0.7, 12, 0.7, 16, 3),
      box(33, 0.8, 0.9, 0, 9.2),
      box(31, 0.12, 0.95, 0, 8.7),
    ])!;
    const archLamps = mergeGeometries(
      Array.from(
        { length: 12 },
        (_, i) => box(0.6, 0.3, 1, -13.75 + i * 2.5, 9.2),
      ),
    )!;
    // Side pylon: a telescoping mast with beacons, out in the side regions.
    const pylonFrame = mergeGeometries([
      box(0.4, 9, 0.4, 0, 1.5),
      box(2.2, 0.25, 0.3, 0, 5.6),
      box(1.4, 0.25, 0.3, 0, 4.4),
    ])!;
    const pylonLamps = mergeGeometries([
      box(0.4, 0.4, 0.4, 0, 6.2),
      box(0.25, 0.25, 0.35, -1, 5.6),
      box(0.25, 0.25, 0.35, 1, 5.6),
    ])!;

    const edgeCount = this.low ? 2 : 3;
    let order = 0;
    const add = (
      geo: THREE.BufferGeometry,
      lamps: THREE.BufferGeometry,
      at: THREE.Vector3,
      arm: { closed: number } | null,
      yaw = 0,
    ) => {
      const root = new THREE.Group();
      root.position.copy(at);
      root.rotation.y = yaw;
      const body = new THREE.Group();
      body.add(new THREE.Mesh(geo, frame));
      const lampMat = new THREE.MeshBasicMaterial({
        color: lampOff.clone(),
        toneMapped: false,
      });
      const lampMesh = new THREE.Mesh(lamps, lampMat);
      body.add(lampMesh);
      let armObj: THREE.Object3D | null = null;
      if (arm) {
        armObj = new THREE.Mesh(armGeo, frame);
        armObj.position.set(-Math.sign(at.x) * 1, 0.6, 0.25);
        body.add(armObj);
      }
      root.add(body);
      this.group.add(root);
      this.gates.push({
        root,
        body,
        arm: armObj,
        lamps: lampMesh,
        start: order++ * 0.34,
        armClosed: arm?.closed ?? 0,
        arrived: false,
        locked: false,
      });
    };
    // Along both lane edges, nearest first: the ones the player passes.
    for (let k = 0; k < edgeCount; k++) {
      for (const side of [-1, 1]) {
        add(
          edgeFrame,
          edgeLamps,
          new THREE.Vector3(side * (half + 1), -0.2, 4 - k * 7),
          // The arm swings in toward the lane centre.
          { closed: side * (Math.PI / 2) },
        );
      }
    }
    // Across the sky, beyond the wreck.
    for (let k = 0; k < (this.low ? 1 : 3); k++) {
      add(archFrame, archLamps, new THREE.Vector3(0, -3, -16 - k * 11), null);
    }
    // Out in the side regions, where the nursery and buttresses were lit.
    if (!this.low) {
      for (const [x, z] of [[-14, -2], [14, -6], [-17, -12], [17, 2]]) {
        add(pylonFrame, pylonLamps, new THREE.Vector3(x, -3, z), null);
      }
    }
  }

  private updateGates(f: FinaleFrame): void {
    if (this.gatesAt === null) return;
    const since = this.t - this.gatesAt;
    for (const g of this.gates) {
      const local = since - g.start;
      if (local < 0) {
        g.root.visible = false;
        continue;
      }
      g.root.visible = true;
      // Rise from below the lane (reduced motion: already standing).
      const rise = f.reducedMotion ? 1 : backOut(local / 0.45);
      g.body.position.y = -7 * (1 - rise);
      g.body.scale.y = f.reducedMotion ? 1 : 0.3 + 0.7 * Math.min(1, rise);
      if (local >= 0 && !g.arrived) {
        g.arrived = true;
        this.fx.sound("finale_toll_arrive");
      }
      // Then the arm swings down across the lane, and the lamps come on.
      const swing = f.reducedMotion ? 1 : backOut((local - 0.45) / 0.5);
      if (g.arm) g.arm.rotation.z = g.armClosed * Math.min(1.05, swing);
      const lit = local >= (f.reducedMotion ? 0.2 : 0.95);
      if (lit && !g.locked) {
        g.locked = true;
        this.fx.sound("finale_toll_clank");
        g.root.getWorldPosition(this.tmp);
        this.tmp.y += 3;
        if (!this.low) this.fx.ring(this.tmp, PALETTE.amber, 1.4, 0.3);
      }
      const lampMat = g.lamps.material as THREE.MeshBasicMaterial;
      const blink = f.reducedFlashing
        ? 1
        : 0.8 + 0.2 * Math.sin(this.t * 5 + g.start * 7);
      lampMat.color.setHex(TOLL_LAMP).multiplyScalar(lit ? 1.8 * blink : 0.12);
    }
  }

  // --------------------------------------------------------------- helpers

  /** True the first time `key` is asked for this finale (one-shot beats). */
  private once(key: string): boolean {
    if (this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }

  private driveSeams(w: THREE.Object3D, level: number): void {
    const seams = w.getObjectByName("warden_seams");
    seams?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!mesh.isMesh || !m?.isMeshStandardMaterial) return;
      if (!this.seamBase.has(m)) {
        this.seamBase.set(
          m,
          (m.userData.seamBase as number | undefined) ?? m.emissiveIntensity,
        );
      }
      m.emissiveIntensity = this.seamBase.get(m)! * level;
    });
  }

  /** Scales a node's emissives (cloned once, so other instances keep theirs). */
  private dim(node: THREE.Object3D, level: number): void {
    node.traverse((o) => {
      const mesh = o as THREE.Mesh;
      let m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!mesh.isMesh || !m?.isMeshStandardMaterial) return;
      if (!this.dimmed.has(m)) {
        m = m.clone();
        mesh.material = m;
        this.dimmed.set(m, m.emissiveIntensity);
      }
      m.emissiveIntensity = (this.dimmed.get(m) ?? 1) * level;
    });
  }
}
