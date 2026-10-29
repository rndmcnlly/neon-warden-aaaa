/**
 * The camera rig: named shots, blends between them, and screen shake.
 *
 * Shots are functions, not fixed transforms, because their subjects move:
 * `bossCloseup` follows the Warden wherever it sways. A blend therefore
 * evaluates both the outgoing and incoming shot every frame and mixes the
 * results, so a cut toward a moving target never lands on stale framing.
 *
 * The Director calls `play(shot, durationMs, ease)` from a `camera` cue;
 * the renderer owns what each shot actually looks like (CONTRACTS.md).
 * `logoTurntable` frames the boot logos on their plinth at the stage point.
 *
 * Shake uses the "trauma" model (Squirrel Eiserloh, GDC 2016): events add
 * trauma 0–1, the visible shake is trauma squared, so small hits barely move
 * the camera and big ones really land; then it decays. The player's shake
 * slider scales the result, and 0 turns it off completely.
 */

import * as THREE from "three";
import { KNOCK } from "./shotLooks.ts";
import type { CameraShotId } from "../contracts/index.ts";
import { FIELD_D, FIELD_W } from "./coords.ts";

/**
 * The Director's shots plus the renderer-only hangar shots (the hangar is a
 * UI screen, not a timeline beat, so it is driven by `stage.showHangar`).
 * `hangar` is a three-quarter hero framing of the ship on its pad;
 * `hangarTurntable` circles it slowly for the presentation.
 */
export type RigShotId = CameraShotId | "hangar" | "hangarTurntable";

/** Shots in which the camera may roll and drift: never during live play. */
const INTERACTIVE_SHOTS: ReadonlySet<RigShotId> = new Set(["gameplay"]);

export interface ShotContext {
  /** World positions of the shot subjects (the stage keeps these current). */
  readonly player: THREE.Vector3;
  readonly boss: THREE.Vector3;
  /** A spot off to the side where cutscene props (pilot figure, logos) stand. */
  readonly stagePoint: THREE.Vector3;
  /** Where the hangar pad sits (the ship on display). */
  readonly hangarPoint: THREE.Vector3;
  readonly timeSec: number;
  readonly aspect: number;
}

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

type ShotFn = (ctx: ShotContext, out: Pose) => void;

/**
 * Gameplay camera tilt from straight-down, radians (about 27 degrees):
 * enough to read as 3D, little enough that lanes stay vertical and bullet
 * spacing reads true (critique item 3).
 */
const GAMEPLAY_TILT = 0.47;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private from: RigShotId = "gameplay";
  private to: RigShotId = "gameplay";
  private blendMs = 0;
  private blendTotal = 0;
  private ease: "linear" | "inOut" = "inOut";
  /** Time since the current shot was called, for slow push-ins. */
  private shotAgeMs = 0;
  private trauma = 0;
  private recoil = 0;
  reduceMotion = false;

  private recoilTauMs: number = KNOCK.tap.tauMs;

  /**
   * One directional kick, never additive oscillation from held stream fire.
   * Sizes and settling times live in shotLooks.ts (KNOCK): a Writ knocks
   * several times harder than a tap and settles a little slower.
   */
  kickShot(kind: "aimed" | "stream" | "writ", level = 0): void {
    if (kind === "stream" || this.reduceMotion || this.shakeScale === 0) return;
    const k = kind === "writ"
      ? KNOCK.writ[Math.max(1, Math.min(3, level)) - 1]
      : KNOCK.tap;
    if (k.camera >= this.recoil) this.recoilTauMs = k.tauMs;
    this.recoil = Math.max(this.recoil, k.camera);
  }
  /** Settings shake slider, 0–1. */
  shakeScale = 1;
  private gameplayDistance = 20;
  private readonly a: Pose = newPose();
  private readonly b: Pose = newPose();
  private readonly recoilTarget = new THREE.Vector3();
  /** The pose shown last frame, and a frozen copy when a blend is interrupted. */
  private readonly last: Pose = newPose();
  private frozenFrom: Pose | null = null;
  private readonly shots: Record<RigShotId, ShotFn>;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    this.shots = {
      gameplay: (ctx, out) => {
        // Locked: one fixed tilt, no roll, no orbit. A small sideways truck
        // toward the player (position and target move together, so lanes
        // stay vertical) is the only motion.
        const lean = ctx.player.x * 0.05;
        const d = this.gameplayDistance;
        out.target.set(lean, 0, 0.4);
        out.position.set(
          lean,
          Math.cos(GAMEPLAY_TILT) * d,
          0.4 + Math.sin(GAMEPLAY_TILT) * d,
        );
        out.fov = 38;
      },
      bossIntro: (ctx, out) => {
        // Low and behind the player, looking up the lane at the descent.
        out.target.copy(ctx.boss).setY(1.5);
        out.position.set(0, 2.2, FIELD_D / 2 + 4);
        out.fov = 44;
      },
      bossCloseup: (ctx, out) => {
        // Composed, not centred: the Warden on the left third, Last
        // Approach's set pieces filling the right and the lane behind. (The
        // old centred close-up left a disc of Warden in a black frame.)
        const orbit = this.reduceMotion ? 0 : Math.sin(ctx.timeSec * 0.3) * 0.8;
        // A slow push-in over 20 s carries long speeches.
        const push = this.reduceMotion
          ? 0
          : Math.min(1, this.shotAgeMs / 20000) * 2.2;
        out.target.set(ctx.boss.x + 1.8, 0, ctx.boss.z - 2);
        out.position.set(
          ctx.boss.x - 4.2 + orbit + push * 0.4,
          3.4 - push * 0.25,
          ctx.boss.z + 8.5 - push,
        );
        out.fov = 40;
      },
      wardenFall: (ctx, out) => {
        // Low three-quarter wide from the front left: the lane runs away
        // under the Warden and both side regions stay in frame, so the
        // shockwave can be seen leaving the lane and reaching the world.
        // A slow push-in carries the beat (none under reduced motion).
        const push = this.reduceMotion
          ? 0
          : Math.min(1, this.shotAgeMs / 7000) * 2.4;
        out.target.set(ctx.boss.x * 0.6 + 0.8, -0.6, ctx.boss.z + 0.2);
        out.position.set(
          ctx.boss.x * 0.6 - 5 + push,
          7.4 - push * 0.4,
          ctx.boss.z + 8.6 - push,
        );
        out.fov = 50;
      },
      shipCloseup: (ctx, out) => {
        // Pilot remains off-screen: his ship carries the silent reply. Over
        // the ship's shoulder toward the Warden, so the frame holds both.
        out.target.lerpVectors(ctx.player, ctx.boss, 0.4);
        // Far enough back that the engine glow does not bloom over the frame.
        out.position.copy(ctx.player).add(new THREE.Vector3(2.6, 2.2, 4.8));
        out.fov = 40;
      },
      flashback: (ctx, out) => {
        // Slow drift around the frozen world, from above and to one side,
        // like a flight recorder replaying the moment.
        const a = ctx.timeSec * 0.12;
        out.target.copy(ctx.player);
        out.position.set(
          ctx.player.x + Math.sin(a) * 9,
          7,
          ctx.player.z + Math.cos(a) * 9,
        );
        out.fov = 40;
      },
      endingWide: (_ctx, out) => {
        // Pull back and up: the lanes go on, the corridor is the point. Close
        // enough that Last Approach and the tollgates fill the side regions.
        // A slow dolly up the lane over half a minute ("the long way home"),
        // so the payroll lines are not read over a frozen frame.
        const dolly = this.reduceMotion
          ? 0
          : Math.min(1, this.shotAgeMs / 30000) * 7;
        out.target.set(0.5, -2, -9 - dolly);
        out.position.set(3.5, 9 - dolly * 0.3, 13 - dolly);
        out.fov = 58;
      },
      hangar: (ctx, out) => {
        // Three-quarter hero shot from the front left, slightly above.
        out.target.copy(ctx.hangarPoint).add(new THREE.Vector3(0.15, 0.3, 0));
        out.position.copy(ctx.hangarPoint).add(
          new THREE.Vector3(-2.3, 1.7, -2.6),
        );
        out.fov = 28;
      },
      hangarTurntable: (ctx, out) => {
        const a = ctx.timeSec * 0.35;
        out.target.copy(ctx.hangarPoint).add(new THREE.Vector3(0, 0.1, 0));
        out.position.copy(ctx.hangarPoint).add(
          new THREE.Vector3(Math.sin(a) * 3.4, 1.5, Math.cos(a) * 3.4),
        );
        out.fov = 30;
      },
      logoTurntable: (ctx, out) => {
        // Aim above the plinth and stand back: the studio mark is tall, and
        // the first framing cropped its top.
        out.target.copy(ctx.stagePoint).add(new THREE.Vector3(0, 0.9, 0));
        out.position.copy(ctx.stagePoint).add(new THREE.Vector3(0, 1.1, 6.4));
        out.fov = 35;
      },
    };
  }

  /** Starts a blend to `shot`. A zero duration cuts. */
  play(
    shot: RigShotId,
    durationMs: number,
    ease: "linear" | "inOut" = "inOut",
  ): void {
    // Interrupting a blend: freeze the pose we are showing right now and
    // blend from that, so the camera never jumps.
    this.frozenFrom = this.blendMs > 0 ? copyPose(this.last) : null;
    this.from = this.to;
    this.to = shot;
    this.shotAgeMs = 0;
    this.blendTotal = Math.max(0, durationMs);
    this.blendMs = this.blendTotal;
    this.ease = ease;
  }

  get currentShot(): RigShotId {
    return this.to;
  }

  /** Adds screen-shake trauma, 0–1. Stacks, capped at 1. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.fitGameplay();
    this.camera.updateProjectionMatrix();
  }

  /**
   * Finds the gameplay camera distance that keeps the whole playfield (plus a
   * margin) inside the frame for the current aspect ratio. Projecting the
   * corners is simpler to trust than trigonometry with a tilted camera.
   */
  private fitGameplay(): void {
    const cam = new THREE.PerspectiveCamera(38, this.camera.aspect, 0.1, 400);
    const corners = [
      new THREE.Vector3(-FIELD_W / 2 - 0.4, 0, -FIELD_D / 2 - 0.4),
      new THREE.Vector3(FIELD_W / 2 + 0.4, 0, -FIELD_D / 2 - 0.4),
      new THREE.Vector3(-FIELD_W / 2 - 0.4, 0, FIELD_D / 2 + 0.6),
      new THREE.Vector3(FIELD_W / 2 + 0.4, 0, FIELD_D / 2 + 0.6),
    ];
    const v = new THREE.Vector3();
    for (let d = 8; d < 80; d += 0.25) {
      cam.position.set(
        0,
        Math.cos(GAMEPLAY_TILT) * d,
        0.4 + Math.sin(GAMEPLAY_TILT) * d,
      );
      cam.lookAt(0, 0, 0.4);
      cam.updateMatrixWorld();
      const fits = corners.every((c) => {
        v.copy(c).project(cam);
        return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.94;
      });
      if (fits) {
        this.gameplayDistance = d;
        return;
      }
    }
  }

  update(dtMs: number, ctx: ShotContext): void {
    this.shotAgeMs += dtMs;
    this.shots[this.to](ctx, this.b);
    let pose = this.b;
    if (this.blendMs > 0) {
      this.blendMs = Math.max(0, this.blendMs - dtMs);
      if (this.frozenFrom) copyPoseInto(this.frozenFrom, this.a);
      else this.shots[this.from](ctx, this.a);
      let t = 1 - this.blendMs / this.blendTotal;
      if (this.ease === "inOut") t = t * t * (3 - 2 * t);
      this.a.position.lerp(this.b.position, t);
      this.a.target.lerp(this.b.target, t);
      this.a.fov += (this.b.fov - this.a.fov) * t;
      pose = this.a;
    }
    copyPoseInto(pose, this.last);

    // Shake: smooth pseudo-noise from summed sines, scaled by trauma squared.
    this.trauma = Math.max(0, this.trauma - dtMs / 900);
    const scale = this.reduceMotion ? 0 : this.shakeScale;
    const amount = this.trauma * this.trauma * scale;
    const t = ctx.timeSec * 34;
    const sx = (Math.sin(t * 1.1) + Math.sin(t * 2.3 + 1.7)) * 0.5;
    const sy = (Math.sin(t * 1.7 + 0.4) + Math.sin(t * 2.9 + 2.1)) * 0.5;
    const roll = (Math.sin(t * 1.3 + 3.1) + Math.sin(t * 3.1)) * 0.5;

    this.camera.position.copy(pose.position);
    // Camera trucks up-lane, so the image recoils down-lane. Target trucks
    // with it: no zoom, roll, or change to the player's collision position.
    const kick = this.recoil * scale;
    this.camera.position.z -= kick;
    this.camera.position.x += sx * amount * 0.6;
    this.camera.position.y += sy * amount * 0.4;
    this.recoilTarget.copy(pose.target);
    this.recoilTarget.z -= kick;
    this.camera.lookAt(this.recoilTarget);
    this.recoil *= Math.exp(-Math.max(0, dtMs) / this.recoilTauMs);
    if (this.recoil < 0.00001 || scale === 0) this.recoil = 0;
    // Roll only outside live play: in gameplay, shake is translation only,
    // so the playfield never tilts under the player's hands.
    const cinematic = !INTERACTIVE_SHOTS.has(this.to) || this.blendMs > 0;
    if (cinematic) this.camera.rotateZ(roll * amount * 0.05);
    if (this.camera.fov !== pose.fov) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

function newPose(): Pose {
  return {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 40,
  };
}

function copyPose(p: Pose): Pose {
  return copyPoseInto(p, newPose());
}

function copyPoseInto(src: Pose, dst: Pose): Pose {
  dst.position.copy(src.position);
  dst.target.copy(src.target);
  dst.fov = src.fov;
  return dst;
}
