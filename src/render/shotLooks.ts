/**
 * Bolt identity: which look each player round wears, and the release
 * effects (muzzle, ship knock, pressure wave) that go with it.
 *
 * The sim's `BulletView` says only `kind: "shot"`. Rather than widen the
 * contract, the renderer tags each new round from the `playerFired` event
 * of the same step (one volley per tick, so the new ids are that volley's).
 * A round seen without its event (a late join, a seek) falls back to
 * `classifyShot`, which reads speed and radius from the tuning.
 *
 * Three looks, one per expression of the fire verb:
 * - aimed (tap): a short, faceted, bright slug: one deliberate round;
 * - stream (hold): thin, long, dim needles: texture, not events;
 * - writ (rest, then press): a lance scaled by charge level, with travelling
 *   rings, a big muzzle bloom, a pressure wave and real knock.
 *
 * Everything here is render-only. Nothing feeds back into the sim.
 */

import * as THREE from "three";
import type {
  BulletView,
  ChargeLevel,
  EntityId,
  ShotKind,
} from "../contracts/index.ts";
import { TRIGGER } from "../sim/tuning.ts";
import { ROLE } from "./palette.ts";

export interface ShotTag {
  readonly shot: ShotKind;
  /** Writ charge level 1–3; 0 for aimed and stream. */
  readonly level: ChargeLevel;
}

/**
 * Knock budget per shot, in world units (40 sim px each) and milliseconds.
 * `camera`: up-lane truck of camera and target (the image recoils down-lane).
 * `ship`: down-lane displacement of the drawn ship only; the sim's hitbox
 * never moves. `pitch`: nose-up radians. Index 0 is the tap; 1–3 the Writ.
 */
export const KNOCK = Object.freeze({
  tap: Object.freeze({ camera: 0.035, tauMs: 38, ship: 0, pitch: 0 }),
  writ: Object.freeze([
    Object.freeze({ camera: 0.15, tauMs: 60, ship: 0.05, pitch: 0.12 }),
    Object.freeze({ camera: 0.2, tauMs: 60, ship: 0.09, pitch: 0.18 }),
    Object.freeze({ camera: 0.25, tauMs: 60, ship: 0.13, pitch: 0.25 }),
  ]),
  /** The ship's knock settles with this time constant. */
  shipTauMs: 90,
});

/** Writ size multiplier by level (1–3), applied to the collision radius. */
export function writScale(level: number): number {
  return level >= 3 ? 1.8 : level === 2 ? 1.35 : 1;
}

/** Best guess for an untagged round, from tuning speeds and radii. */
export function classifyShot(b: BulletView): ShotTag {
  const speed = Math.hypot(b.vel.x, b.vel.y);
  if (Math.abs(speed - TRIGGER.aimedSpeed) < 0.5) {
    return { shot: "aimed", level: 0 };
  }
  if (Math.abs(speed - TRIGGER.writSpeed) < 0.5 && b.vel.x === 0) {
    const level = b.radius >= 14 ? 3 : b.radius >= 10 ? 2 : 1;
    return { shot: "writ", level };
  }
  return { shot: "stream", level: 0 };
}

const STREAM: ShotTag = Object.freeze({ shot: "stream", level: 0 });

/** Remembers which look each live player round wears. */
export class ShotTagger {
  private readonly tags = new Map<EntityId, ShotTag>();

  /**
   * Call once per sim step with the step's snapshot bullets and events.
   * New player rounds take the tag of the step's `playerFired` volley.
   */
  observe(
    bullets: readonly BulletView[],
    fired: { shot: ShotKind; level: ChargeLevel } | null,
  ): void {
    const alive = new Set<EntityId>();
    for (const b of bullets) {
      if (b.kind !== "shot") continue;
      alive.add(b.id);
      if (this.tags.has(b.id)) continue;
      this.tags.set(
        b.id,
        fired ? { shot: fired.shot, level: fired.level } : classifyShot(b),
      );
    }
    for (const id of this.tags.keys()) if (!alive.has(id)) this.tags.delete(id);
  }

  get(b: BulletView): ShotTag {
    if (b.kind !== "shot") return STREAM;
    return this.tags.get(b.id) ?? classifyShot(b);
  }

  clear(): void {
    this.tags.clear();
  }
}

/**
 * The drawn ship's knock: a down-lane shove and nose-up pitch that settle
 * monotonically, like the camera recoil. Writs only; taps knock the camera.
 */
export class ShipKnock {
  offset = 0;
  pitch = 0;
  /** Settings shake slider (0–1); 0 or reduced motion means no knock. */
  scale = 1;
  reduceMotion = false;

  kick(level: number): void {
    if (this.scale === 0 || this.reduceMotion || level < 1) return;
    const k = KNOCK.writ[Math.min(3, level) - 1];
    this.offset = Math.max(this.offset, k.ship * this.scale);
    this.pitch = Math.max(this.pitch, k.pitch * this.scale);
  }

  update(dtMs: number): void {
    const decay = Math.exp(-Math.max(0, dtMs) / KNOCK.shipTauMs);
    this.offset *= decay;
    this.pitch *= decay;
    if (this.offset < 0.0001 || this.scale === 0 || this.reduceMotion) {
      this.offset = 0;
      this.pitch = 0;
    }
  }
}

/**
 * A screen-space pressure wave from the Writ's muzzle: a thin refracting
 * ring in the finish pass. Pure state; post.ts draws it.
 */
export class PressureWave {
  /** Screen UV of the centre. */
  readonly center = new THREE.Vector2(0.5, 0.5);
  radius = 0;
  strength = 0;
  private age = 1;
  private life = 0.3;
  private peak = 0;
  enabled = true;

  start(uvX: number, uvY: number, level: number): void {
    if (!this.enabled) return;
    this.center.set(uvX, uvY);
    this.age = 0;
    this.life = 0.22 + level * 0.05;
    this.peak = 0.006 + level * 0.004;
  }

  update(dt: number): void {
    this.age += dt;
    const t = this.age / this.life;
    if (t >= 1 || !this.enabled) {
      this.strength = 0;
      this.radius = 0;
      return;
    }
    this.radius = 0.04 + 0.32 * (1 - (1 - t) * (1 - t));
    this.strength = this.peak * (1 - t) * (1 - t);
  }
}

// ---- muzzle flashes ----------------------------------------------------------

interface Flare {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  age: number;
  life: number;
  hold: number;
  size: number;
  gain: number;
  grow: number;
}

/**
 * Muzzle sprites parented to the ship's nose. A tap is a crisp four-point
 * star; the stream a faint shimmer; the Writ a big cream bloom that holds
 * at full for a moment (`hold`) before falling off. Reduced flashing caps
 * the Writ bloom's gain and slows its fall, so the transition is soft.
 */
export class MuzzleFlashes {
  readonly group = new THREE.Group();
  private readonly flares: Flare[] = [];
  private next = 0;
  private readonly softMap: THREE.Texture | null;
  private readonly starMap: THREE.Texture | null;
  reducedFlashing = false;

  constructor(size = 6) {
    const star = starTexture();
    const soft = softTexture();
    for (let i = 0; i < size; i++) {
      const material = new THREE.SpriteMaterial({
        map: i === 0 ? soft : star,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.position.set(0, 0.3, -0.6);
      this.group.add(sprite);
      this.flares.push({
        sprite,
        material,
        age: 1,
        life: 1,
        hold: 0,
        size: 1,
        gain: 1,
        grow: 0,
      });
    }
    this.softMap = soft;
    this.starMap = star;
  }

  fire(tag: ShotTag): void {
    const f = this.flares[this.next];
    this.next = (this.next + 1) % this.flares.length;
    f.age = 0;
    if (tag.shot === "aimed") {
      f.material.map = this.starMap;
      f.material.color.set(ROLE.playerShot.hex).lerp(
        new THREE.Color(0xffffff),
        0.35,
      );
      f.life = 0.07;
      f.hold = 0;
      f.size = 0.75;
      f.gain = 1.4;
      f.grow = 0.2;
      f.sprite.material.rotation = Math.PI / 4;
    } else if (tag.shot === "stream") {
      f.material.map = this.softMap;
      f.material.color.set(ROLE.playerShot.hex);
      f.life = 0.09;
      f.hold = 0;
      f.size = 0.45;
      f.gain = 0.35;
      f.grow = 0.3;
      f.sprite.material.rotation = 0;
    } else {
      f.material.map = this.softMap;
      f.material.color.set(ROLE.writ.hex);
      f.life = 0.16 + tag.level * 0.04;
      f.hold = this.reducedFlashing ? 0 : 0.035;
      f.size = 1.1 + tag.level * 0.55;
      f.gain = this.reducedFlashing ? 0.6 : 1.2 + tag.level * 0.45;
      f.grow = 0.6;
      if (this.reducedFlashing) f.life *= 2.2;
    }
    // Additive HDR: a gain over 1 lifts the colour itself, which is how the
    // Writ bloom (and only it) crosses the bloom threshold.
    if (f.gain > 1) f.material.color.multiplyScalar(f.gain);
    f.material.needsUpdate = true;
    f.sprite.visible = true;
  }

  update(dt: number): void {
    for (const f of this.flares) {
      if (!f.sprite.visible) continue;
      f.age += dt;
      const t = Math.max(0, f.age - f.hold) / f.life;
      if (t >= 1) {
        f.sprite.visible = false;
        continue;
      }
      const s = f.size * (1 + f.grow * t);
      f.sprite.scale.set(s, s, 1);
      f.material.opacity = Math.min(1, f.gain) * (1 - t) * (1 - t);
    }
  }
}

function canvasTexture(
  draw: (g: CanvasRenderingContext2D) => void,
): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  draw(c.getContext("2d")!);
  return new THREE.CanvasTexture(c);
}

let starCache: THREE.Texture | null = null;
let softCache: THREE.Texture | null = null;

/** A crisp four-point star: the tap's muzzle flash. */
function starTexture(): THREE.Texture | null {
  if (starCache) return starCache;
  starCache = canvasTexture((g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 10);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(35, 29);
    g.lineTo(64, 32);
    g.lineTo(35, 35);
    g.lineTo(32, 64);
    g.lineTo(29, 35);
    g.lineTo(0, 32);
    g.lineTo(29, 29);
    g.closePath();
    g.fill();
  });
  return starCache;
}

/** A soft radial bloom: the stream shimmer and the Writ release. */
function softTexture(): THREE.Texture | null {
  if (softCache) return softCache;
  softCache = canvasTexture((g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  return softCache;
}
