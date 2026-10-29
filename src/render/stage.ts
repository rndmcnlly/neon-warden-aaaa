/**
 * The renderer's front door. The game loop (src/main.ts) talks only to this
 * interface:
 *
 *   for each sim step:  stage.observe(sim.snapshot(), events)
 *   once per frame:     stage.render(dtMs, alpha)
 *
 * `observe` copies what it needs and queues the step's events; it never
 * writes sim state (CONTRACTS.md rule 2). `render` blends the last two ticks
 * by `alpha` (see interp.ts), reconciles a pool of 3D models against the
 * entities in the latest snapshot, turns queued events into effects, and
 * draws through the post chain.
 *
 * The Director drives cutscene framing with `playShot`, and props such as
 * the helmeted pilot or the boot logos with `showProp`.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DEFAULT_LOADOUT } from "../contracts/index.ts";
import type {
  EnemyKind,
  EntityId,
  Loadout,
  PickupKind,
  Settings,
  SettingsStore,
  SimEvent,
  SimState,
  Vec2,
} from "../contracts/index.ts";
import { Backdrop } from "./backdrop.ts";
import { BulletRenderer } from "./bullets.ts";
import { CameraRig, type RigShotId } from "./cameraRig.ts";
import { simToWorldLength, simToWorldX, simToWorldZ } from "./coords.ts";
import { FlashGuard, REDUCED_LIMITS, STANDARD_LIMITS } from "./flashGuard.ts";
import { type Pos, SnapshotInterpolator } from "./interp.ts";
import {
  findPart,
  type ModelId,
  ModelRegistry,
  type ModelSlot,
} from "./models.ts";
import { applyShipLoadout, helmetFor, type HelmetVariant } from "./loadout.ts";
import { PALETTE, ROLE, SCENE_LOOKS, type SceneLookId } from "./palette.ts";
import { ParticleSystem, ShockwavePool } from "./particles.ts";
import { PostChain } from "./post.ts";
import {
  applyInstanceLook,
  ownMaterials,
  restoreMaterials,
  ReticlePool,
  ScanBeam,
  WritGlow,
} from "./vfx.ts";

import { type QualityTier, tierFor } from "./quality.ts";
import { shieldFragment, shieldVertex } from "./shaders/shield.glsl.ts";

/**
 * `pilot_figure` shows the helmet variant chosen by `setHelmet` (or the
 * loadout's `helmet`): corporate-issue early, worn by the end.
 */
export type PropId = "pilot_figure" | "logo_adamsmith_systems" | "logo_cm121";
export type { HelmetVariant } from "./loadout.ts";

export interface StageOptions {
  /** When given, the stage follows display and accessibility settings live. */
  readonly settings?: SettingsStore;
  /** Where the .glb files live; defaults to `models/` under the site root. */
  readonly modelBaseUrl?: string;
}

export interface StageStats {
  /** Rolling average CPU time spent inside `render`, milliseconds. */
  readonly renderMs: number;
  /** Rolling average wall time between frames, milliseconds. */
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly models: Record<string, string>;
}

export interface Stage {
  /** Records one sim tick and its events. Cheap; call after every step. */
  observe(state: SimState, events?: readonly SimEvent[]): void;
  /**
   * Draws one frame. `dtMs` is wall time since the last frame; `alpha` is the
   * accumulator's leftover fraction of a tick (0–1), default 1 (no blending).
   */
  render(dtMs: number, alpha?: number): void;
  /** Camera cue from the Director. A zero duration cuts. */
  playShot(
    shot: RigShotId,
    durationMs: number,
    ease?: "linear" | "inOut",
  ): void;
  /** Shows a cutscene prop at the stage point (null hides it). */
  showProp(id: PropId | null): void;
  /** Flight-recorder look for the flashback: desaturated, cool, slowed FX. */
  setFlashback(on: boolean): void;
  /** Warp-jump intensity, 0–1 (backdrop stretch and speed). */
  setWarp(amount: number): void;
  /**
   * Ship customization: package meshes and paint, trim, decal and trail.
   * Applies to the gameplay ship and the hangar display ship alike.
   */
  applyLoadout(loadout: Loadout): void;
  /** Which helmet the pilot figure wears in cutscenes. */
  setHelmet(variant: HelmetVariant): void;
  /**
   * The hangar: the ship on a lit pad, framed by a hero shot ("hero") or a
   * slow turntable ("turntable"); null returns to the game camera.
   */
  showHangar(shot: "hero" | "turntable" | null): void;
  /** Forces a scene color budget; null returns to automatic (by sim phase). */
  setSceneLook(id: SceneLookId | null): void;
  /**
   * Where an entity is on screen, in CSS pixels from the canvas's top-left,
   * or null if it is not drawn. The UI pins intel tags with it (the id may
   * arrive as a string from DOM code).
   */
  screenPositionOf(id: EntityId | string): { x: number; y: number } | null;
  stats(): StageStats;
  readonly models: ModelRegistry;
  dispose(): void;
}

/** What each sim entity kind looks like. */
const ENEMY_MODEL: Record<EnemyKind, ModelId> = {
  drone: "drone",
  dart: "dart",
  turret: "turret",
  lancer: "lancer",
};
const ENEMY_COLOR: Record<EnemyKind, number> = {
  drone: PALETTE.pink,
  dart: PALETTE.amber,
  turret: PALETTE.violet,
  lancer: PALETTE.mint,
};
/** Explosion size per kind: bigger, tougher enemies die louder. */
const ENEMY_BLAST: Record<EnemyKind, { count: number; trauma: number }> = {
  drone: { count: 26, trauma: 0.14 },
  dart: { count: 20, trauma: 0.12 },
  turret: { count: 70, trauma: 0.32 },
  lancer: { count: 40, trauma: 0.2 },
};
const PICKUP_MODEL: Record<PickupKind, ModelId> = {
  spread: "pickup_spread",
  shield: "pickup_shield",
  // #0121's flight recorder: the spread pickup already carries a recorder
  // sleeve; a dedicated derelict-recorder model is a follow-up.
  recorder: "pickup_spread",
};

/**
 * Sim part ids (src/sim/tuning.ts) to model node names. The Warden's four
 * pods are `pod_0`..`pod_3` in art/blender/warden.py; the turret's barrel
 * is its spinning `crown`. Parts without a node still get break effects.
 */
const PART_NODES: Readonly<Record<string, string>> = {
  fanPodL: "pod_0",
  fanPodR: "pod_1",
  cannonPod: "pod_2",
  spiralPod: "pod_3",
  barrel: "crown",
};

function loadoutKey(l: Loadout): string {
  const c = l.cosmetics;
  return [l.weapon, l.sensor, c.paint, c.trimColor, c.decal, c.trail].join();
}

function partNode(slot: THREE.Object3D, part: string): string | null {
  const name = PART_NODES[part];
  return name && slot.getObjectByName(name) ? name : null;
}

/** Hard cap on effect bursts per frame, so 30x auto-play stays smooth. */
const MAX_BURSTS_PER_FRAME = 24;
/** Ship hovers just above the playfield plane, over bullets' shadows. */
const SHIP_Y = 0.15;
const TRAIL_OFFSET = new THREE.Vector3(0, 0, 0.45);
/** Trail sparks fall behind the ship at this velocity, world units per second. */
const TRAIL_DRIFT = new THREE.Vector3(0, 0, 7);
/** Where cutscene props stand: far up-lane, among the pylons. */
const STAGE_POINT = new THREE.Vector3(0, 0, -40);
/** The hangar pad: off to one side, out of every gameplay framing. */
const HANGAR_POINT = new THREE.Vector3(60, 0, -20);

export function createStage(
  container: HTMLElement,
  options: StageOptions = {},
): Stage {
  const renderer = new THREE.WebGLRenderer({
    antialias: false, // MSAA happens in the post chain's render target.
    powerPreference: "high-performance",
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The post chain renders several passes; count the whole frame, not the last pass.
  renderer.info.autoReset = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.void);
  scene.fog = new THREE.FogExp2(PALETTE.void, 0.012);

  // Image-based lighting gives the metal hulls something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  // Key and rim lights in the palette: cyan from the player's side, magenta
  // from up-lane where the threats come from.
  scene.add(new THREE.HemisphereLight(0x6f86a8, 0x04020c, 0.6));
  const key = new THREE.DirectionalLight(PALETTE.cyan, 1.4);
  key.position.set(-6, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(PALETTE.pink, 1.6);
  rim.position.set(5, 4, -12);
  scene.add(rim);

  const rig = new CameraRig();
  const settingsNow: Settings | null = options.settings?.get() ?? null;
  let tier: QualityTier = tierFor(settingsNow?.display.preset ?? "high");

  const backdrop = new Backdrop(tier.starCount);
  scene.add(backdrop.group);

  const models = new ModelRegistry(options.modelBaseUrl ?? "models/");
  void models.preloadAll();

  const world = new THREE.Group();
  scene.add(world);

  let particles = new ParticleSystem(tier.maxParticles);
  scene.add(particles.points);
  const rings = new ShockwavePool();
  scene.add(rings.group);
  const bullets = new BulletRenderer();
  scene.add(bullets.group);

  // Wave-3 scan language and charge.
  const beam = new ScanBeam();
  scene.add(beam.mesh);
  const reticles = new ReticlePool();
  scene.add(reticles.group);
  const writ = new WritGlow();

  // The player ship and its shield bubble.
  const ship = models.create("pilot_ship");
  world.add(ship);
  ship.add(writ.group);
  // Engine plume: the hottest point on the player, so the eye finds the
  // ship first (critique item 8). A stretched additive sprite behind it.
  const plumeMat = new THREE.SpriteMaterial({
    color: new THREE.Color(ROLE.playerEngine.hex).multiplyScalar(
      ROLE.playerEngine.gain,
    ),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const plume = new THREE.Sprite(plumeMat);
  plume.position.set(0, 0.1, 0.62);
  plume.scale.set(0.22, 0.5, 1);
  ship.add(plume);
  const trailColor = new THREE.Color(PALETTE.cyan);
  let loadout: Loadout = DEFAULT_LOADOUT;
  let loadoutKeyNow = loadoutKey(DEFAULT_LOADOUT);
  let helmet: HelmetVariant = "issued";
  const shieldMat = new THREE.ShaderMaterial({
    vertexShader: shieldVertex,
    fragmentShader: shieldFragment,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.cyan).multiplyScalar(1.5) },
      uTime: { value: 0 },
      uHit: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 40, 24),
    shieldMat,
  );
  shield.scale.y = 0.55;
  shield.visible = false;
  ship.add(shield);

  // The Warden's shield shell uses the same fresnel shader, in Warden red.
  const wardenShieldMat = shieldMat.clone();
  wardenShieldMat.uniforms.uColor.value = new THREE.Color(PALETTE.crimson)
    .multiplyScalar(1.1);

  // A soft point light that rides with the ship, tinting nearby hulls cyan.
  const shipLight = new THREE.PointLight(PALETTE.cyan, 6, 5, 2);
  shipLight.position.y = 0.6;
  ship.add(shipLight);

  // Pools of model slots keyed by entity id, with free lists per model.
  const live = new Map<EntityId, ModelSlot>();
  const free = new Map<ModelId, ModelSlot[]>();
  let boss: ModelSlot | null = null;
  const seen = new Set<EntityId>();

  const props = new Map<PropId, ModelSlot>();
  let activeProp: PropId | null = null;

  const post = new PostChain(renderer, scene, rig.camera, tier);
  const flashes = new FlashGuard(STANDARD_LIMITS);
  const interp = new SnapshotInterpolator();
  const pending: SimEvent[] = [];
  /** Scheduled effects (the Warden's chained death blasts), in wall seconds. */
  const timers: { at: number; run: () => void }[] = [];

  let timeSec = 0;
  let renderScale = settingsNow?.display.renderScale ?? 1;
  let reducedFlashing = settingsNow?.accessibility.reducedFlashing ?? false;
  let flashback = false;
  let shieldHit = 0;
  let hurt = 0;
  let lookDirty = 0;
  let lookOverride: SceneLookId | null = null;
  let lookNow: SceneLookId | null = null;
  let hangarShip: ModelSlot | null = null;
  let hangarPad: THREE.Group | null = null;
  let avgRenderMs = 0;
  let avgFrameMs = 16.7;

  const tmpPos: Pos = { x: 0, y: 0 };
  const tmpV = new THREE.Vector3();
  const ctx = {
    player: new THREE.Vector3(),
    boss: new THREE.Vector3(0, 0, -8),
    stagePoint: STAGE_POINT,
    hangarPoint: HANGAR_POINT,
    timeSec: 0,
    aspect: 1,
  };

  function pixelRatio(): number {
    return Math.min(globalThis.devicePixelRatio || 1, tier.maxPixelRatio) *
      renderScale;
  }

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height);
    post.setSize(width, height, pr);
    particles.setPixelRatio(pr);
    ctx.aspect = width / height;
    rig.resize(ctx.aspect);
  }

  function applySettings(s: Settings): void {
    const nextTier = tierFor(s.display.preset);
    if (nextTier !== tier) {
      tier = nextTier;
      post.setTier(tier);
      backdrop.setStarCount(tier.starCount);
      if (particles.capacity !== tier.maxParticles) {
        scene.remove(particles.points);
        particles = new ParticleSystem(tier.maxParticles);
        scene.add(particles.points);
      }
    }
    renderScale = s.display.renderScale;
    rig.shakeScale = s.accessibility.shake;
    reducedFlashing = s.accessibility.reducedFlashing;
    flashes.limits = reducedFlashing ? REDUCED_LIMITS : STANDARD_LIMITS;
    resize();
  }

  const unsubscribe = options.settings?.subscribe(applySettings);
  if (settingsNow) applySettings(settingsNow);
  globalThis.addEventListener("resize", resize);
  resize();

  // ---- entity pooling ------------------------------------------------------

  function acquire(id: EntityId, model: ModelId): ModelSlot {
    let slot = live.get(id);
    if (slot && slot.userData.modelId === model) return slot;
    slot = free.get(model)?.pop() ?? models.create(model);
    slot.visible = true;
    slot.scale.setScalar(1);
    slot.rotation.set(0, 0, 0);
    world.add(slot);
    live.set(id, slot);
    return slot;
  }

  function releaseUnseen(): void {
    for (const [id, slot] of live) {
      if (seen.has(id)) continue;
      world.remove(slot);
      live.delete(id);
      restoreMaterials(slot);
      unbreak(slot);
      const list = free.get(slot.userData.modelId) ?? [];
      list.push(slot);
      free.set(slot.userData.modelId, list);
    }
  }

  function place(
    slot: THREE.Object3D,
    id: EntityId,
    alpha: number,
    y = 0,
  ): void {
    interp.position(id, alpha, tmpPos);
    slot.position.set(simToWorldX(tmpPos.x), y, simToWorldZ(tmpPos.y));
  }

  /** Undoes part breaks before a slot is reused. */
  function unbreak(slot: THREE.Object3D): void {
    const broken = slot.userData.broken as Set<string> | undefined;
    if (!broken) return;
    for (const name of broken) {
      const part = slot.getObjectByName(name);
      if (part) part.visible = true;
    }
    delete slot.userData.broken;
    delete slot.userData.powerTarget;
  }

  /** Hides a broken part node and remembers it (pooling undoes it). */
  function breakPart(slot: THREE.Object3D, name: string): THREE.Vector3 {
    const at = slot.position.clone();
    const part = name ? slot.getObjectByName(name) : undefined;
    if (part) {
      part.getWorldPosition(at);
      part.visible = false;
      const broken = (slot.userData.broken as Set<string> | undefined) ??
        new Set<string>();
      broken.add(name);
      slot.userData.broken = broken;
    }
    return at;
  }

  /** Hides model nodes for parts the sim reports broken (late joiners too). */
  function syncBrokenParts(
    slot: ModelSlot,
    parts: readonly { id: string; broken: boolean }[],
  ): void {
    for (const part of parts) {
      if (!part.broken) continue;
      const node = partNode(slot, part.id);
      const broken = slot.userData.broken as Set<string> | undefined;
      if (node && !broken?.has(node)) breakPart(slot, node);
    }
  }

  // ---- effects ---------------------------------------------------------------

  let burstsThisFrame = 0;

  function blast(
    at: THREE.Vector3,
    color: number,
    count: number,
    scale = 1,
  ): void {
    if (burstsThisFrame++ >= MAX_BURSTS_PER_FRAME) return;
    particles.burst({
      at,
      color,
      count,
      speed: 6 * scale,
      life: 0.7 * Math.sqrt(scale),
      size: 0.16 * Math.sqrt(scale),
    });
    rings.spawn(at, color, 1.4 * scale);
  }

  function flash(strength: number, color: number): void {
    const c = new THREE.Color(color);
    flashes.request(performance.now(), strength, [c.r, c.g, c.b]);
  }

  /** Last known world position of an entity (it may already be gone from state). */
  function whereIs(id: EntityId, out: THREE.Vector3): THREE.Vector3 {
    const slot = live.get(id);
    if (slot) return out.copy(slot.position);
    if (boss && interp.latest?.boss?.id === id) return out.copy(boss.position);
    return out.copy(ctx.player);
  }

  function simPoint(at: Vec2, out: THREE.Vector3, y = 0.3): THREE.Vector3 {
    return out.set(simToWorldX(at.x), y, simToWorldZ(at.y));
  }

  function handle(e: SimEvent): void {
    switch (e.type) {
      case "scanLock":
        // Lock confirm: a crisp ring snap at the target.
        rings.spawn(simPoint(e.pos, tmpV), ROLE.scan.hex, 0.9, 0.22);
        break;
      case "partBreak": {
        const slot = e.target === "boss" ? boss : live.get(e.id);
        const node = slot ? partNode(slot, e.part) : null;
        const at = slot && node
          ? breakPart(slot, node)
          : simPoint(e.pos, new THREE.Vector3());
        const big = e.target === "boss";
        // Debris and a hard white-gold crack: a break must read as a win.
        blast(at, PALETTE.sparkCream, big ? 50 : 30, big ? 1.6 : 0.9);
        rings.spawn(at, PALETTE.gold, big ? 2.4 : 1.1, 0.3);
        rig.addTrauma(big ? 0.4 : 0.15);
        break;
      }
      case "disarm": {
        const slot = live.get(e.id);
        simPoint(e.pos, tmpV);
        if (slot) {
          ownMaterials(slot);
          slot.userData.powerTarget = 0;
        }
        // A cool, soft power-down ring and a few falling embers: spared,
        // not destroyed, so no blast and no shake. Cancelled bullets get a
        // shimmer ring of their own size.
        rings.spawn(tmpV, PALETTE.slate, 1.3 + e.cancelled * 0.05, 0.6);
        if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
          particles.burst({
            at: tmpV,
            color: PALETTE.slate,
            count: 10,
            speed: 1.2,
            life: 0.9,
            size: 0.1,
          });
        }
        break;
      }
      case "coreExposed":
        if (boss) {
          rings.spawn(boss.position, PALETTE.gold, 3, 0.5);
          rig.addTrauma(0.3);
        }
        break;
      case "graze":
      case "nearMiss": {
        if (burstsThisFrame++ >= MAX_BURSTS_PER_FRAME) break;
        // Sparks skate off the ship's edge toward the bullet.
        simPoint(e.pos, tmpV).lerp(ctx.player, e.type === "graze" ? 0.5 : 0.2);
        particles.burst({
          at: tmpV,
          color: ROLE.graze.hex,
          count: e.type === "graze" ? 6 * e.count : 2,
          speed: 3.5,
          life: 0.18,
          size: 0.09,
        });
        break;
      }
      case "enemyFired":
        if (burstsThisFrame++ >= MAX_BURSTS_PER_FRAME) break;
        particles.burst({
          at: simPoint(e.pos, tmpV),
          color: PALETTE.enemyShot,
          count: 3,
          speed: 1.5,
          life: 0.12,
          size: 0.14,
        });
        break;
      case "chargeLevel":
        if (e.level > 0) rings.spawn(ctx.player, ROLE.writ.hex, 0.5, 0.18);
        break;
      case "intel":
      case "payChanged":
      case "despawn":
        break;
      case "spawn":
        // Spawn shimmer: drawn next frame once the slot exists, at its position.
        timers.push({
          at: timeSec,
          run: () => {
            const slot = live.get(e.id);
            const color = e.kind === "warden"
              ? PALETTE.pink
              : ENEMY_COLOR[e.kind];
            if (slot) rings.spawn(slot.position, color, 0.8, 0.3);
          },
        });
        break;
      case "playerFired":
        if (e.shot === "writ") {
          rings.spawn(ctx.player, ROLE.writ.hex, 0.8 + e.level * 0.5, 0.25);
          rig.addTrauma(0.08 * e.level);
        }
        if (burstsThisFrame < MAX_BURSTS_PER_FRAME) {
          tmpV.copy(ctx.player).add(new THREE.Vector3(0, 0.2, -0.55));
          particles.burst({
            at: tmpV,
            color: PALETTE.paleCyan,
            count: 2,
            speed: 1.2,
            life: 0.12,
            size: 0.22,
          });
        }
        break;
      case "hit":
        if (e.target === "player") {
          if (e.absorbedByShield) {
            shieldHit = 1;
            rings.spawn(ctx.player, PALETTE.cyan, 1.6, 0.35);
            rig.addTrauma(0.2);
          } else {
            blast(ctx.player, PALETTE.pink, 24);
            rig.addTrauma(0.55);
            flash(0.35, PALETTE.crimson);
            hurt = 1;
          }
        } else {
          whereIs(e.id, tmpV);
          if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
            particles.burst({
              at: tmpV,
              color: PALETTE.sparkCream,
              count: 3,
              speed: 3,
              life: 0.25,
              size: 0.12,
            });
          }
          const slot = e.target === "boss" ? boss : live.get(e.id);
          if (slot) {
            slot.userData.hitPunch = 1;
            // A two-frame white flash on the instance's own materials.
            ownMaterials(slot);
            slot.userData.flash = reducedFlashing ? 0.4 : 1;
          }
        }
        break;
      case "kill":
        whereIs(e.id, tmpV);
        blast(tmpV.clone(), ENEMY_COLOR[e.kind], ENEMY_BLAST[e.kind].count);
        rig.addTrauma(ENEMY_BLAST[e.kind].trauma);
        break;
      case "lifeLost":
        flash(0.4, PALETTE.crimson);
        break;
      case "pickup":
        blast(
          ctx.player,
          e.kind === "spread" ? PALETTE.mint : PALETTE.cyan,
          14,
          0.8,
        );
        break;
      case "bossWarning":
        rig.addTrauma(0.3);
        flash(0.18, PALETTE.crimson);
        break;
      case "bossPhase":
        if (boss && e.phase > 0) {
          blast(boss.position.clone(), PALETTE.crimson, 90, 2.4);
          blast(boss.position.clone(), PALETTE.gold, 40, 1.6);
          rig.addTrauma(0.7);
          flash(0.45, PALETTE.gold);
          boss.userData.armorShed = (e.phase as number) - 1;
        }
        break;
      case "bossDefeated":
        // The original's 8 chained blasts over 1.1 s, then one big flash.
        for (let i = 0; i < 8; i++) {
          timers.push({
            at: timeSec + (i / 7) * 1.1,
            run: () => {
              if (!boss) return;
              tmpV.copy(boss.position).add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * 4,
                  0.5,
                  (Math.random() - 0.5) * 2.5,
                ),
              );
              blast(
                tmpV.clone(),
                i % 2 ? PALETTE.gold : PALETTE.crimson,
                60,
                1.8,
              );
              rig.addTrauma(0.35);
            },
          });
        }
        timers.push({
          at: timeSec + 1.2,
          run: () => {
            if (boss) blast(boss.position.clone(), PALETTE.iceWhite, 200, 4);
            rig.addTrauma(1);
            flash(1, PALETTE.iceWhite);
          },
        });
        break;
      case "gameOver":
        blast(ctx.player, PALETTE.cyan, 80, 2);
        rig.addTrauma(0.8);
        break;
      case "sectorStarted":
      case "sectorCleared":
      case "bossSurvived":
        break;
    }
  }

  // ---- per-frame update ------------------------------------------------------

  function updateEntities(state: SimState, alpha: number, dt: number): void {
    const tickNow = interp.tickAt(alpha);
    const tickFrac = tickNow - state.tick; // in [-1, 0]: how far behind "now" we draw
    seen.clear();

    // Player.
    interp.playerPosition(alpha, tmpPos);
    ship.position.set(simToWorldX(tmpPos.x), SHIP_Y, simToWorldZ(tmpPos.y));
    ctx.player.copy(ship.position);
    const bank = interp.playerBank(alpha);
    ship.rotation.set(0, 0, -bank * 1.6);
    const p = state.player;
    // Grace blink: slower under reduced flashing.
    const blinkPeriod = reducedFlashing ? 20 : 8;
    ship.visible = state.phase !== "ended" || state.outcome !== "gameOver";
    if (p.graceTicks > 0) {
      ship.visible &&= Math.floor(state.tick / (blinkPeriod / 2)) % 2 === 0;
    }
    shield.visible = p.shielded;
    shieldHit = Math.max(0, shieldHit - 0.05);
    shieldMat.uniforms.uHit.value = reducedFlashing
      ? shieldHit * 0.3
      : shieldHit;
    shieldMat.uniforms.uTime.value = timeSec;
    const engine = findPart(ship, "engine");
    if (engine) engine.scale.setScalar(0.9 + Math.sin(timeSec * 40) * 0.1);
    plume.scale.set(0.22, 0.45 + Math.sin(timeSec * 37) * 0.06, 1);

    // The sim carries the loadout; follow it when it changes.
    const key = loadoutKey(state.loadout);
    if (key !== loadoutKeyNow) {
      loadoutKeyNow = key;
      loadout = state.loadout;
      applyLook(ship);
      lookDirty = 30;
    }

    // Writ charge and the scan beam.
    writ.update(dt, p.charge, p.chargeLevel, timeSec);
    beam.setShape(p.scan.halfAngle, simToWorldLength(p.scan.range));
    beam.update(dt, ship.position, p.scan.active && ship.visible && !flashback);
    // Engine trail: a few slow sparks per frame streaming down-screen, the
    // original's spark trail. Cheaper and more legible than full-frame blur.
    if (ship.visible && !flashback) {
      tmpV.copy(ship.position).add(TRAIL_OFFSET);
      particles.burst({
        at: tmpV,
        color: trailColor.getHex(),
        count: 2,
        speed: 0.6,
        life: 0.35,
        size: 0.1,
      });
      particles.drift(2, TRAIL_DRIFT);
    }

    // Enemies, with their scan state.
    reticles.begin();
    for (const e of state.enemies) {
      seen.add(e.id);
      const slot = acquire(e.id, ENEMY_MODEL[e.kind]);
      place(slot, e.id, alpha, 0);
      const age = e.age + tickFrac;
      animateEnemy(slot, e.kind, age);
      if (e.disarmed && slot.userData.powerTarget !== 0) {
        ownMaterials(slot);
        slot.userData.powerTarget = 0;
      }
      syncBrokenParts(slot, e.parts);
      if (e.lock > 0 && !e.disarmed) {
        const size = simToWorldLength(e.radius) * 1.6 + 0.25;
        reticles.set(e.id, slot.position, size, e.lock, e.locked, timeSec, dt);
      }
      applyInstanceLook(slot, dt);
    }

    // Pickups: spin 0.04 rad/tick and pulse ±12%, as in the original.
    for (const k of state.pickups) {
      seen.add(k.id);
      const slot = acquire(k.id, PICKUP_MODEL[k.kind]);
      place(slot, k.id, alpha, 0.3);
      slot.rotation.y = tickNow * 0.04;
      slot.scale.setScalar(1 + Math.sin(tickNow * 0.12) * 0.12);
    }

    // The Warden.
    if (state.boss) {
      if (!boss) {
        boss = models.create("warden");
        world.add(boss);
      }
      boss.visible = true;
      place(boss, state.boss.id, alpha, 0);
      ctx.boss.copy(boss.position);
      animateWarden(boss, state.boss.phase, state.boss.invulnerable, tickNow);
      syncBrokenParts(boss, state.boss.pods);
      const b = state.boss;
      if (b.lock > 0) {
        // The reticle goes on the weak point, not the hull center.
        tmpV.set(
          boss.position.x + simToWorldLength(b.weakPoint.offset.x),
          0,
          boss.position.z + simToWorldLength(b.weakPoint.offset.y),
        );
        reticles.set(
          b.id,
          tmpV,
          simToWorldLength(b.weakPoint.radius) * 2 + 0.3,
          b.lock,
          b.locked,
          timeSec,
          dt,
        );
      }
      applyInstanceLook(boss, dt);
    } else if (boss) {
      boss.visible = false;
    }

    reticles.end();
    releaseUnseen();
    bullets.update(state.bullets, interp, alpha, timeSec);
  }

  function animateEnemy(slot: ModelSlot, kind: EnemyKind, age: number): void {
    const punch = (slot.userData.hitPunch as number | undefined) ?? 0;
    slot.userData.hitPunch = Math.max(0, punch - 0.15);
    slot.scale.setScalar(1 + punch * 0.15);
    switch (kind) {
      case "drone":
        slot.position.y = Math.sin(age * 0.08) * 0.08;
        slot.rotation.y = age * 0.03;
        break;
      case "dart": {
        // Commit telegraph: the thruster flares at tick 50, when it dives.
        const thruster = findPart(slot, "thruster");
        const committed = age >= 50;
        if (thruster) {
          thruster.scale.setScalar(committed ? 1.8 + Math.sin(age) * 0.3 : 0.7);
        }
        slot.rotation.x = committed ? -0.25 : 0;
        break;
      }
      case "turret": {
        const crown = findPart(slot, "crown");
        if (crown) crown.rotation.y = age * 0.02;
        break;
      }
      case "lancer":
        slot.rotation.z = Math.sin(age * 0.05) * 0.12;
        break;
    }
  }

  function animateWarden(
    slot: ModelSlot,
    phase: number,
    invulnerable: boolean,
    tick: number,
  ): void {
    const halo = findPart(slot, "halo");
    if (halo) halo.rotation.z = tick * (0.01 + phase * 0.008);
    const core = findPart(slot, "core");
    // Core pulse rate scales with phase, like the original.
    if (core) {
      core.scale.setScalar(1 + Math.sin(tick * (0.06 + phase * 0.04)) * 0.12);
    }
    const armor = findPart(slot, "armor");
    const shed = (slot.userData.armorShed as number | undefined) ?? 0;
    if (armor) armor.scale.setScalar(1 - shed * 0.08);
    // Seams light up a tier per phase: dark in the descent, full in phase 3.
    const seams = findPart(slot, "warden_seams");
    if (seams) {
      seams.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const m = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (!mesh.isMesh || !m?.isMeshStandardMaterial) return;
        if (!m.userData.seamBase) {
          // One boss instance at a time: clone once, then drive per phase.
          mesh.material = m.clone();
          (mesh.material as THREE.Material).userData.seamBase =
            m.emissiveIntensity;
        }
        const own = mesh.material as THREE.MeshStandardMaterial;
        const base = own.userData.seamBase as number;
        const tier = Number(/_(\d)$/.exec(mesh.name)?.[1] ?? 1);
        const lit = phase >= tier ? 1 : 0.06;
        own.emissiveIntensity = base * lit *
          (0.85 + 0.15 * Math.sin(tick * 0.2 + tier));
      });
    }
    // The shield shell: present (and shimmering) only while invulnerable.
    const shell = findPart(slot, "warden_shield");
    if (shell) {
      shell.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material !== wardenShieldMat) {
          mesh.material = wardenShieldMat;
          mesh.renderOrder = 6;
        }
      });
      shell.visible = invulnerable;
      wardenShieldMat.uniforms.uTime.value = timeSec;
    }
    const punch = (slot.userData.hitPunch as number | undefined) ?? 0;
    slot.userData.hitPunch = Math.max(0, punch - 0.2);
    // Invulnerable descent: a slow menacing bob; otherwise a hit recoil.
    slot.position.y = invulnerable
      ? 0.5 + Math.sin(tick * 0.05) * 0.2
      : punch * 0.1;
    slot.rotation.x = invulnerable ? 0.15 : 0;
  }

  /** Scene color budget: explicit override, else by flashback and sim phase. */
  function chooseLook(state: SimState | null): void {
    let id: SceneLookId = "sector";
    if (lookOverride) id = lookOverride;
    else if (flashback) id = "flashback";
    else if (state?.phase === "ended") id = "ending";
    else if (state?.phase === "boss" || state?.phase === "bossWarning") {
      id = "boss";
    }
    if (id === lookNow) return;
    lookNow = id;
    backdrop.setLook(SCENE_LOOKS[id]);
  }

  function applyLook(target: THREE.Object3D): void {
    const c = applyShipLoadout(target, loadout);
    if (target === ship) {
      trailColor.copy(c);
      plumeMat.color.copy(c).multiplyScalar(ROLE.playerEngine.gain);
    }
  }

  function helmetModel(): ModelId {
    return helmet === "worn" ? "pilot_figure_worn" : "pilot_figure_issued";
  }

  function buildHangar(): void {
    hangarShip = models.create("pilot_ship");
    hangarShip.position.copy(HANGAR_POINT).setY(0.35);
    hangarShip.scale.setScalar(0.9);
    scene.add(hangarShip);
    // A pad with a lit rim, two practicals and a cool back light.
    hangarPad = new THREE.Group();
    hangarPad.position.copy(HANGAR_POINT);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.75, 0.18, 48),
      new THREE.MeshStandardMaterial({
        color: 0x2a2f38,
        metalness: 0.8,
        roughness: 0.35,
      }),
    );
    hangarPad.add(pad);
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.02, 8, 96),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.3),
        toneMapped: false,
      }),
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.1;
    hangarPad.add(rimRing);
    const keyL = new THREE.SpotLight(0xfff2e0, 40, 12, 0.6, 0.5);
    keyL.position.set(-2.5, 4, -2.5);
    keyL.target = pad;
    hangarPad.add(keyL);
    const back = new THREE.PointLight(PALETTE.cyan, 12, 8);
    back.position.set(1.5, 1.2, 2.5);
    hangarPad.add(back);
    scene.add(hangarPad);
  }

  function stats(): StageStats {
    return {
      renderMs: avgRenderMs,
      frameMs: avgFrameMs,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      models: models.report(),
    };
  }

  return {
    models,

    observe(state, events = []) {
      interp.observe(state);
      for (const e of events) pending.push(e);
    },

    render(dtMs, alpha = 1) {
      const t0 = performance.now();
      renderer.info.reset();
      const dt = Math.min(dtMs, 100) / 1000;
      timeSec += dt;
      ctx.timeSec = timeSec;
      burstsThisFrame = 0;
      avgFrameMs += (dtMs - avgFrameMs) * 0.05;

      const state = interp.latest;
      if (lookDirty > 0 && --lookDirty % 10 === 0) {
        applyLook(ship);
        if (hangarShip) applyLook(hangarShip);
      }
      if (state) updateEntities(state, alpha, dt);
      chooseLook(state);
      backdrop.setSubjects(
        ctx.player,
        state?.boss && boss ? boss.position : null,
        bullets.enemyCount,
      );
      hurt = Math.max(0, hurt - dt * 2.2);

      // Events after entities, so kills find their last drawn position.
      for (const e of pending) handle(e);
      pending.length = 0;
      for (let i = timers.length - 1; i >= 0; i--) {
        if (timers[i].at <= timeSec) {
          timers[i].run();
          timers.splice(i, 1);
        }
      }

      // Logo turntable; the pilot stands still. Logos sway rather than
      // spin: a full turn would show their lettering mirrored.
      if (activeProp && activeProp !== "pilot_figure") {
        const prop = props.get(activeProp);
        if (prop) prop.rotation.y = Math.sin(timeSec * 0.6) * 0.45;
      }

      particles.update(flashback ? dt * 0.15 : dt);
      rings.update(flashback ? dt * 0.15 : dt);
      backdrop.update(flashback ? dt * 0.1 : dt);
      rig.update(dtMs, ctx);

      const flashNow = flashes.update(dtMs);
      post.render(timeSec, {
        flash: flashNow,
        flashColor: flashes.tint,
        desaturate: flashback ? 0.85 : 0,
        bloomScale: reducedFlashing ? 0.6 : 1,
        bulletDensity: bullets.enemyCount,
        hurt: reducedFlashing ? hurt * 0.4 : hurt,
      });
      avgRenderMs += (performance.now() - t0 - avgRenderMs) * 0.05;
    },

    playShot(shot, durationMs, ease) {
      rig.play(shot, durationMs, ease);
    },

    showProp(id) {
      if (activeProp) props.get(activeProp)!.visible = false;
      activeProp = id;
      if (!id) return;
      let prop = props.get(id);
      if (!prop) {
        prop = models.create(id === "pilot_figure" ? helmetModel() : id);
        prop.position.copy(STAGE_POINT);
        // Logos face the camera upright; the pilot stands on the deck.
        if (id !== "pilot_figure") prop.position.y += 0.2;
        scene.add(prop);
        props.set(id, prop);
      }
      prop.visible = true;
    },

    setFlashback(on) {
      flashback = on;
    },

    setWarp(amount) {
      backdrop.warp = Math.max(0, Math.min(1, amount));
    },

    applyLoadout(next) {
      loadout = next;
      loadoutKeyNow = loadoutKey(next);
      this.setHelmet(helmetFor(next.cosmetics.helmetLivery));
      // glTF content may swap in late; re-apply on the next frames too.
      applyLook(ship);
      if (hangarShip) applyLook(hangarShip);
      lookDirty = 30;
    },

    setHelmet(variant) {
      if (variant === helmet) return;
      helmet = variant;
      if (activeProp === "pilot_figure") {
        const old = props.get("pilot_figure");
        if (old) scene.remove(old);
        props.delete("pilot_figure");
        activeProp = null;
        this.showProp("pilot_figure");
      }
    },

    showHangar(shot) {
      if (!shot) {
        if (hangarShip) hangarShip.visible = false;
        if (hangarPad) hangarPad.visible = false;
        lookOverride = null;
        rig.play("gameplay", 600);
        return;
      }
      if (!hangarShip) buildHangar();
      hangarShip!.visible = true;
      hangarPad!.visible = true;
      applyLook(hangarShip!);
      lookOverride = "hangar";
      rig.play(shot === "hero" ? "hangar" : "hangarTurntable", 700);
    },

    setSceneLook(id) {
      lookOverride = id;
    },

    screenPositionOf(rawId) {
      const id = Number(rawId);
      const slot = interp.latest?.boss?.id === id ? boss : live.get(id);
      if (!slot || !slot.visible) return null;
      tmpV.copy(slot.position).project(rig.camera);
      if (tmpV.z > 1) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: (tmpV.x * 0.5 + 0.5) * rect.width,
        y: (-tmpV.y * 0.5 + 0.5) * rect.height,
      };
    },

    stats,

    dispose() {
      unsubscribe?.();
      globalThis.removeEventListener("resize", resize);
      post.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
