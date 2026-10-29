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
 * the boot logos with `showProp`; Pilot remains off-screen.
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
import { SectorWorld } from "../world/environment.ts";
import type { WorldLanguage } from "../world/lore.ts";
import { BulletRenderer } from "./bullets.ts";
import { ShotTrails } from "./shotTrails.ts";
import { CameraRig, type RigShotId } from "./cameraRig.ts";
import { simToWorldLength, simToWorldX, simToWorldZ } from "./coords.ts";
import { PLAYFIELD } from "../contracts/index.ts";
import { FlashGuard, REDUCED_LIMITS, STANDARD_LIMITS } from "./flashGuard.ts";
import { type Pos, SnapshotInterpolator } from "./interp.ts";
import {
  findPart,
  type ModelId,
  ModelRegistry,
  type ModelSlot,
} from "./models.ts";
import { applyShipLoadout } from "./loadout.ts";
import { PALETTE, ROLE, SCENE_LOOKS, type SceneLookId } from "./palette.ts";
import { ParticleSystem, ShockwavePool } from "./particles.ts";
import { PostChain } from "./post.ts";
import { MuzzleFlashes, PressureWave, ShipKnock } from "./shotLooks.ts";
import { DebrisField, RicochetPool } from "./debris.ts";
import { THRUSTER_TIERS, Thrusters } from "./thrusters.ts";
import {
  DEFERRED_FEEDBACK_S,
  deferredBy,
  isDeferrable,
} from "./feedbackLadder.ts";
import {
  applyInstanceLook,
  isolatePart,
  ownMaterials,
  restoreMaterials,
  ReticlePool,
  ScanBeam,
  WritGlow,
} from "./vfx.ts";

import { type QualityTier, tierFor } from "./quality.ts";
import { shieldFragment, shieldVertex } from "./shaders/shield.glsl.ts";
import { type FinaleBeat, WardenFinale } from "./wardenFinale.ts";

/** Character cutaways use the ship, never a figure prop. */
export type PropId = "logo_adamsmith_systems" | "logo_cm121";

export interface StageOptions {
  /** When given, the stage follows display and accessibility settings live. */
  readonly settings?: SettingsStore;
  /** Where the .glb files live; defaults to `models/` under the site root. */
  readonly modelBaseUrl?: string;
  /**
   * Plays a gameplay sound role. The Warden's finale times its own sounds
   * (pods, groans, the shockwave, tollgates) to the frames that show them.
   */
  readonly sound?: (role: string) => void;
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
  /** A story beat for the Warden's finale (tollgates, the leash, escort). */
  finaleBeat(beat: FinaleBeat): void;
  /** A skipped ending: the finale jumps to its aftermath. */
  finaleSkip(): void;
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
  /**
   * CSS px per playfield unit across the ship's starting row, as the
   * gameplay camera draws it now. Touch drags use it so one finger
   * centimeter is the same ship distance on a phone and a tablet.
   */
  playfieldPxPerUnit(): number | null;
  stats(): StageStats;
  /** Automatically archived environmental records, available to codex adapters. */
  worldArchive(
    language?: WorldLanguage,
  ): { id: string; sector: number; text: string }[];
  worldStats(): ReturnType<SectorWorld["stats"]>;
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
  // The drone fires from its eye: disarmed, the eye itself tears off.
  gun: "drone_eye",
};

/** A target flashes at most this often (stream fire must not strobe). */
const FLASH_INTERVAL_S = 0.1;
/** When a disarmed hull's slate power-down pulses fire, seconds after. */
const DISARM_PULSE_S = [0.45, 0.95, 1.55] as const;
/** Matte smoke for a disarmed hull's sputter: dark, never a bullet color. */
const SMOKE = 0x3d424b;
/** The deflect spark: muted slate white, neither player cyan nor enemy pink. */
const RICOCHET = 0xc9d4e6;

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
/** Shots that keep the sector world up behind them (not hangar or logos). */
const WORLD_SHOTS: ReadonlySet<RigShotId> = new Set([
  "gameplay",
  "bossIntro",
  "bossCloseup",
  "wardenFall",
  "shipCloseup",
  "endingWide",
]);
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
  backdrop.setDetail(tier.bloom);
  const sectorWorld = new SectorWorld();
  scene.add(sectorWorld.group);

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
  const shotTrails = new ShotTrails();
  scene.add(shotTrails.mesh);
  const motionQuery = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = settingsNow?.accessibility.reduceMotion ?? false;

  // Wave-3 scan language and charge.
  const beam = new ScanBeam();
  scene.add(beam.mesh);
  const reticles = new ReticlePool();
  scene.add(reticles.group);
  // Torn-off parts and deflect streaks (src/render/debris.ts).
  const debris = new DebrisField(tier.bloom ? 24 : 8);
  scene.add(debris.group);
  // Thruster puffs and banking (src/render/thrusters.ts); the low tier
  // keeps a handful of puffs.
  const thrusters = new Thrusters(
    tier.bloom ? THRUSTER_TIERS.full : THRUSTER_TIERS.cheap,
  );
  scene.add(thrusters.mesh);
  const ricochets = new RicochetPool();
  scene.add(ricochets.group);
  /**
   * Where each enemy was last drawn. A killed enemy leaves the state on the
   * tick it dies, so its slot is pooled before its kill event is handled;
   * the explosion goes here instead of to a fallback position.
   */
  const lastSeen = new Map<EntityId, THREE.Vector3>();
  /** Life-lost edge pulse, 1 at the loss, falling to 0. */
  let edge = 0;
  const writ = new WritGlow();

  // The player ship and its shield bubble.
  const ship = models.create("pilot_ship");
  world.add(ship);
  ship.add(writ.group);
  // Bolt identity (shotLooks.ts): per-kind muzzle, Writ knock and wave.
  const muzzle = new MuzzleFlashes();
  ship.add(muzzle.group);
  const knock = new ShipKnock();
  const wave = new PressureWave();
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
  // Precision is a collision outline plus sparse graze brackets, never a shield.
  // World-attached so banking cannot distort the actual collision footprint.
  const focusMarker = new THREE.Group();
  focusMarker.visible = false;
  const focusMaterials = [0x071018, 0xf2fcff].map((color) =>
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  const collisionRadius = simToWorldLength(6);
  // A dark interior prevents a hot hull/charge glow from swallowing the hitbox.
  const focusCore = new THREE.Mesh(
    new THREE.CircleGeometry(collisionRadius, 48),
    focusMaterials[0],
  );
  focusCore.rotation.x = -Math.PI / 2;
  focusCore.renderOrder = 99;
  focusMarker.add(focusCore);
  for (let i = 0; i < 2; i++) {
    const width = i === 0 ? 0.055 : 0.025;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        collisionRadius - width / 2,
        collisionRadius + width / 2,
        48,
      ),
      focusMaterials[i],
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 100 + i;
    focusMarker.add(ring);
  }
  const focusBrackets = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const backing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.08, 12, 1, i * Math.PI / 2 + 0.12, 0.58),
      focusMaterials[0],
    );
    backing.rotation.x = -Math.PI / 2;
    backing.renderOrder = 100;
    focusBrackets.add(backing);
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1.03, 12, 1, i * Math.PI / 2 + 0.16, 0.5),
      focusMaterials[1],
    );
    arc.rotation.x = -Math.PI / 2;
    arc.renderOrder = 101;
    focusBrackets.add(arc);
  }
  focusMarker.add(focusBrackets);
  // Safety geometry is composited after bloom: emissive hulls cannot wash it out.
  const precisionOverlay = new THREE.Scene();
  precisionOverlay.add(focusMarker);
  const trailColor = new THREE.Color(PALETTE.cyan);
  let loadout: Loadout = DEFAULT_LOADOUT;
  let loadoutKeyNow = loadoutKey(DEFAULT_LOADOUT);
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

  // The Warden's finale (src/render/wardenFinale.ts): it borrows the stage's
  // effect pools through these ports and owns the Warden's model until reset.
  const finale = new WardenFinale({
    blast: (at, color, count, scale) => blast(at.clone(), color, count, scale),
    ring: (at, color, scale, life) => rings.spawn(at, color, scale, life),
    flash: (strength, color) =>
      flash(reducedFlashing ? Math.min(strength, 0.35) : strength, color),
    trauma: (amount) => rig.addTrauma(amount),
    pressure(at, level) {
      if (!tier.bloom) return;
      tmpV.copy(at).project(rig.camera);
      wave.start((tmpV.x + 1) / 2, (tmpV.y + 1) / 2, level);
    },
    tearOff(node, at, outward) {
      debris.spawn({
        node,
        at,
        shotDir: outward,
        hitOffset: new THREE.Vector3(),
        size: 1,
        heavy: true,
      });
    },
    power(slot, level) {
      ownMaterials(slot);
      slot.userData.powerTarget = level;
    },
    sound: (role) => options.sound?.(role),
    scout: () => models.create(ENEMY_MODEL.drone),
  });
  scene.add(finale.group);
  /** One closure for the world, not a fresh one per frame. */
  const finalePower = (x: number, z: number, i: number) =>
    finale.power(x, z, i, reducedFlashing);
  let flashback = false;
  let shieldHit = 0;
  let hurt = 0;
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

  function pixelRatio(width: number, height: number): number {
    const capped = Math.min(
      globalThis.devicePixelRatio || 1,
      tier.maxPixelRatio,
    ) * renderScale;
    if (!tier.maxPixels) return capped;
    return Math.min(capped, Math.sqrt(tier.maxPixels / (width * height)));
  }

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pr = pixelRatio(width, height);
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
      backdrop.setDetail(tier.bloom);
      if (particles.capacity !== tier.maxParticles) {
        scene.remove(particles.points);
        particles = new ParticleSystem(tier.maxParticles);
        scene.add(particles.points);
      }
    }
    renderScale = s.display.renderScale;
    rig.shakeScale = s.accessibility.shake;
    knock.scale = s.accessibility.shake;
    reduceMotion = s.accessibility.reduceMotion;
    reducedFlashing = s.accessibility.reducedFlashing;
    muzzle.reducedFlashing = reducedFlashing;
    debris.setCapacity(tier.bloom ? 24 : 8);
    thrusters.setOptions(
      tier.bloom ? THRUSTER_TIERS.full : THRUSTER_TIERS.cheap,
    );
    flashes.limits = reducedFlashing ? REDUCED_LIMITS : STANDARD_LIMITS;
    resize();
  }

  const unsubscribe = options.settings?.subscribe(applySettings);
  if (settingsNow) applySettings(settingsNow);
  globalThis.addEventListener("resize", resize);
  // The touch deck resizes the stage's box without resizing the window
  // (src/ui/touchLayout.ts), so watch the container itself too.
  const boxWatch = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(() => resize());
  boxWatch?.observe(container);
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
      delete slot.userData.stub;
      delete slot.userData.disarmedAt;
      delete slot.userData.disarmPulses;
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
    const seen = lastSeen.get(id);
    if (seen) return out.copy(seen);
    return out.copy(ctx.player);
  }

  function simPoint(at: Vec2, out: THREE.Vector3, y = 0.3): THREE.Vector3 {
    return out.set(simToWorldX(at.x), y, simToWorldZ(at.y));
  }

  /**
   * Writ release: a shaped double ring (a tight cream snap, a wider cyan
   * shove), a burst of cream sparks out of the nose, the ship's knock, a
   * brief screen-space pressure wave and a rate-limited cream flash. All
   * scale with charge level 1–3. The flash goes through FlashGuard, so
   * reduced flashing caps it; motion settings remove knock and wave.
   */
  function writRelease(level: number): void {
    const nose = tmpV.copy(ctx.player).add(new THREE.Vector3(0, 0.25, -0.6));
    rings.spawn(nose, ROLE.writ.hex, 0.5 + level * 0.25, 0.16);
    rings.spawn(nose, ROLE.playerShot.hex, 1.0 + level * 0.6, 0.32);
    if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
      particles.burst({
        at: nose,
        color: ROLE.writ.hex,
        count: 4 + level * 4,
        speed: 2 + level,
        life: 0.18,
        size: 0.14,
      });
    }
    knock.kick(level);
    const still = rig.reduceMotion || rig.shakeScale === 0;
    if (!still && tier.bloom) {
      nose.project(rig.camera);
      wave.start((nose.x + 1) / 2, (nose.y + 1) / 2, level);
    }
    flash(0.08 + level * 0.05, ROLE.writ.hex);
  }

  /** A hit that a Writ delivered gets its own cyan-and-cream impact. */
  function writImpact(at: THREE.Vector3, level: number): void {
    if (level === 0) return;
    const p = at.clone();
    rings.spawn(p, ROLE.playerShot.hex, 0.9 + level * 0.45, 0.3);
    rings.spawn(p, ROLE.writ.hex, 0.4 + level * 0.2, 0.14);
    if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
      particles.burst({
        at: p,
        color: PALETTE.paleCyan,
        count: 6 + level * 5,
        speed: 4 + level,
        life: 0.3,
        size: 0.12,
      });
    }
    rig.addTrauma(0.06 * level);
  }

  /** A world direction (XZ) from a sim velocity; up-lane if it is zero. */
  function worldDir(v: Vec2): THREE.Vector3 {
    const d = new THREE.Vector3(v.x, 0, v.y);
    return d.lengthSq() > 1e-9 ? d.normalize() : d.set(0, 0, -1);
  }

  /**
   * Hits by rung (src/render/feedbackLadder.ts): a deflect bounces off and
   * leaves the target untouched; a stream hit is a light tick; a tap is a
   * crisp chevron; a Writ gets rings by level. Only the struck part flashes,
   * at most every 100 ms; reduced flashing swaps the flash for an outline.
   */
  function hitFeedback(e: Extract<SimEvent, { type: "hit" }>): void {
    const slot = e.target === "boss" ? boss : live.get(e.id) ?? null;
    const at = simPoint(e.pos, new THREE.Vector3());
    const nodeName = slot && e.part ? partNode(slot, e.part) : null;
    const node = slot && nodeName ? slot.getObjectByName(nodeName) : null;
    if (e.blocked) {
      if (burstsThisFrame++ >= MAX_BURSTS_PER_FRAME) return;
      const center = node
        ? node.getWorldPosition(new THREE.Vector3())
        : slot
        ? slot.position.clone()
        : at.clone().setZ(at.z - 1);
      ricochets.spawn(at, worldDir(e.shotVel), at.clone().sub(center));
      particles.burst({
        at,
        color: RICOCHET,
        count: 3,
        speed: 5,
        life: 0.1,
        size: 0.07,
      });
      return;
    }
    if (e.level > 0) writImpact(at, e.level);
    else if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
      const tap = e.by === "aimed";
      particles.burst({
        at,
        color: PALETTE.sparkCream,
        count: tap ? 6 : 2,
        speed: tap ? 4.5 : 2,
        life: tap ? 0.14 : 0.12,
        size: tap ? 0.11 : 0.07,
      });
    }
    if (!slot) return;
    // Seams glow hot for a moment, more for heavier rounds.
    const heat = e.level > 0 ? 1 : e.by === "aimed" ? 0.6 : 0.25;
    slot.userData.heat = Math.min(
      1,
      ((slot.userData.heat as number) ?? 0) + heat,
    );
    const last = (slot.userData.lastFlashAt as number | undefined) ?? -1;
    if (timeSec - last < FLASH_INTERVAL_S) return;
    slot.userData.lastFlashAt = timeSec;
    slot.userData.hitPunch = e.by === "stream" ? 0.4 : 1;
    ownMaterials(slot);
    if (reducedFlashing) {
      // An outline pulse instead of a luminance flash.
      const where = node
        ? node.getWorldPosition(new THREE.Vector3())
        : slot.position;
      rings.spawn(where, PALETTE.slate, node ? 0.7 : 1.1, 0.16);
      return;
    }
    if (node && nodeName) {
      isolatePart(slot, nodeName);
      const flashes = (slot.userData.partFlash as Record<string, number>) ??
        {};
      flashes[nodeName] = 1;
      slot.userData.partFlash = flashes;
    } else slot.userData.flash = e.by === "stream" ? 0.35 : 0.7;
  }

  /**
   * A part comes off: the real node (or a hull chunk) is flung along the
   * shot and spun by the hit offset, then darkens and sinks under the
   * bullets (src/render/debris.ts). A Warden pod is an event of its own:
   * heavier debris, torn plating, a gold ring and a bigger shake.
   */
  function partBreakFeedback(e: Extract<SimEvent, { type: "partBreak" }>) {
    const slot = e.target === "boss" ? boss : live.get(e.id) ?? null;
    const nodeName = slot ? partNode(slot, e.part) : null;
    const node = slot && nodeName
      ? slot.getObjectByName(nodeName) ?? null
      : null;
    const at = slot && nodeName
      ? breakPart(slot, nodeName)
      : simPoint(e.pos, new THREE.Vector3());
    const pod = e.target === "boss";
    const dir = worldDir(e.shotVel);
    const hitOffset = simPoint(e.hitPos, new THREE.Vector3()).sub(at).setY(0);
    debris.spawn({ node, at, shotDir: dir, hitOffset, size: 0.3, heavy: pod });
    // Where the part was: a disarmed hull sparks from this stub.
    if (slot && !pod) slot.userData.stub = at.clone().sub(slot.position);
    if (pod) {
      // Torn plating either side of the line of fire.
      for (const turn of [-0.7, 0.7]) {
        debris.spawn({
          node: null,
          at,
          shotDir: dir.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn),
          hitOffset,
          size: 0.28,
          heavy: false,
        });
      }
      blast(at, PALETTE.gold, 40, 1.4);
      rings.spawn(at, PALETTE.gold, 3.2, 0.45);
      rig.addTrauma(0.6);
      flash(0.22, PALETTE.gold);
      return;
    }
    if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
      particles.burst({
        at,
        color: PALETTE.sparkCream,
        count: 10,
        speed: 4,
        life: 0.3,
        size: 0.1,
      });
    }
    rings.spawn(at, PALETTE.gold, 0.8, 0.22);
    rig.addTrauma(0.1);
  }

  function handle(e: SimEvent): void {
    switch (e.type) {
      case "scanLock":
        // Lock confirm: a crisp ring snap at the target.
        rings.spawn(simPoint(e.pos, tmpV), ROLE.scan.hex, 0.9, 0.22);
        break;
      case "partBreak":
        partBreakFeedback(e);
        break;
      case "disarm": {
        const slot = live.get(e.id);
        simPoint(e.pos, tmpV);
        if (slot) {
          ownMaterials(slot);
          slot.userData.powerTarget = 0;
          slot.userData.disarmedAt = timeSec;
          slot.userData.disarmPulses = 0;
        }
        // Spared, not destroyed: no blast and no shake. A cool power-down
        // ring (sized by the bullets it cancelled) and a puff of dark smoke;
        // the hull then sags, sputters and leaves (see `updateEntities`).
        rings.spawn(tmpV, PALETTE.slate, 1.3 + e.cancelled * 0.05, 0.6);
        if (burstsThisFrame++ < MAX_BURSTS_PER_FRAME) {
          particles.burst({
            at: tmpV,
            color: SMOKE,
            count: 8,
            speed: 0.8,
            life: 1.0,
            size: 0.14,
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
        rig.kickShot(e.shot, e.level);
        muzzle.fire({ shot: e.shot, level: e.level });
        if (e.shot === "writ") writRelease(e.level);
        else if (
          e.shot === "aimed" && burstsThisFrame < MAX_BURSTS_PER_FRAME
        ) {
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
        } else hitFeedback(e);
        break;
      case "kill":
        whereIs(e.id, tmpV);
        sectorWorld.flash(tmpV.x, tmpV.z);
        blast(tmpV.clone(), ENEMY_COLOR[e.kind], ENEMY_BLAST[e.kind].count);
        rig.addTrauma(ENEMY_BLAST[e.kind].trauma);
        break;
      case "lifeLost":
        // The top rung: a red frame closes in from the screen edge (shape
        // and motion, not only color) on top of the hurt vignette.
        flash(0.4, PALETTE.crimson);
        edge = 1;
        hurt = 1;
        rig.addTrauma(0.6);
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
        // The staged defeat replaces the original's eight chained blasts:
        // the finale owns the Warden's model from here (wardenFinale.ts).
        if (boss) finale.begin("kill", boss, !tier.bloom);
        break;
      case "bossSurvived":
        // Intact and withdrawing: the finale holds the Warden in frame
        // instead of letting it vanish off the top edge with the sim's.
        if (boss) finale.begin("pacifist", boss, !tier.bloom);
        break;
      case "gameOver":
        blast(ctx.player, PALETTE.cyan, 80, 2);
        rig.addTrauma(0.8);
        break;
      case "sectorStarted":
      case "sectorCleared":
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
    const p = state.player;
    const quietMotion = reduceMotion || motionQuery.matches || reducedFlashing;
    // Banking follows the ship's actual lateral motion, not the stick: the
    // same lean for classic and hybrid, and it springs level when the ship
    // stops (render-only; the camera never rolls).
    ship.rotation.set(
      0,
      0,
      thrusters.bank(p.vel.x, p.focused, quietMotion, dt),
    );
    // Writ knock: the drawn ship only, after ctx.player, so the camera,
    // effects and the focus marker (the true hitbox) never move with it.
    knock.reduceMotion = rig.reduceMotion;
    knock.update(dt * 1000);
    ship.position.z += knock.offset;
    ship.rotation.x = knock.pitch;
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
    if (engine) {
      engine.scale.setScalar(
        p.focused
          ? 0.68
          : quietMotion
          ? 0.9
          : 0.9 + Math.sin(timeSec * 40) * 0.1,
      );
    }
    plume.scale.set(
      p.focused ? 0.10 : 0.22,
      p.focused
        ? 0.27
        : quietMotion
        ? 0.45
        : 0.45 + Math.sin(timeSec * 37) * 0.06,
      1,
    );
    focusMarker.position.copy(ctx.player);
    focusMarker.visible = p.focused && ship.visible && !flashback;
    focusBrackets.scale.setScalar(simToWorldLength(state.graze.radius));

    // The sim carries the loadout; follow it when it changes.
    const key = loadoutKey(state.loadout);
    if (key !== loadoutKeyNow) {
      loadoutKeyNow = key;
      loadout = state.loadout;
      applyLook(ship);
    }

    // Writ charge and the scan beam.
    writ.update(dt, p.charge, p.chargeLevel, timeSec);
    beam.setShape(p.scan.halfAngle, simToWorldLength(p.scan.range));
    beam.update(dt, ship.position, p.scan.active && ship.visible && !flashback);
    thrusters.update(
      dt,
      state.tick,
      p.vel,
      ctx.player,
      ship.visible && !flashback && state.phase !== "ended",
      p.focused,
      quietMotion,
    );
    // Engine trail: a few slow sparks per frame streaming down-screen, the
    // original's spark trail. Cheaper and more legible than full-frame blur.
    if (ship.visible && !flashback && !quietMotion) {
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
      if (e.disarmed) powerDown(slot, e.kind, e.id, quietMotion);
      else if (e.hp < e.maxHp) {
        ownMaterials(slot);
        slot.userData.damage = 1 - e.hp / e.maxHp;
      }
      lastSeen.set(e.id, slot.position.clone());
      syncBrokenParts(slot, e.parts);
      if (e.lock > 0 && !e.disarmed) {
        const size = simToWorldLength(e.radius) * 1.6 + 0.25;
        reticles.set(e.id, slot.position, size, e.lock, e.locked, timeSec, dt);
      }
      applyInstanceLook(slot, dt, { reducedFlashing });
    }
    // Forget enemies gone for a while (their kill events are long handled).
    if (lastSeen.size > 64) {
      for (const id of lastSeen.keys()) {
        if (!seen.has(id)) lastSeen.delete(id);
      }
    }

    // Pickups: spin 0.04 rad/tick and pulse ±12%, as in the original.
    for (const k of state.pickups) {
      seen.add(k.id);
      const slot = acquire(k.id, PICKUP_MODEL[k.kind]);
      place(slot, k.id, alpha, 0.3);
      slot.rotation.y = tickNow * 0.04;
      slot.scale.setScalar(1 + Math.sin(tickNow * 0.12) * 0.12);
    }

    // The Warden. After the outcome the finale draws it, not the sim.
    if (finale.active && boss) {
      boss.visible = true;
      ctx.boss.copy(finale.wardenAt);
      applyInstanceLook(boss, dt, { reducedFlashing });
    } else if (state.boss) {
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
      wardenDamage(boss, b);
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
      applyInstanceLook(boss, dt, { reducedFlashing });
    } else if (boss) {
      boss.visible = false;
    }

    reticles.end();
    releaseUnseen();
    bullets.update(state.bullets, interp, alpha, timeSec);
    shotTrails.update(
      state.bullets,
      interp,
      alpha,
      dt,
      flashback || tier.maxParticles <= 512
        ? 0
        : tier.maxParticles <= 1024
        ? 20
        : 48,
    );
  }

  /**
   * A disarmed hull powering down (its lights already drain in
   * `applyInstanceLook`): it sags below its flight height, noses down,
   * wobbles, and its engine coughs dark smoke as it leaves.
   */
  function powerDown(
    slot: ModelSlot,
    kind: EnemyKind,
    id: EntityId,
    quiet: boolean,
  ): void {
    const since = timeSec -
      ((slot.userData.disarmedAt as number | undefined) ?? timeSec - 2);
    const sag = Math.min(1, since / 0.6);
    slot.position.y -= 0.35 * sag;
    const baseX = kind === "dart" ? slot.rotation.x : 0;
    const baseZ = kind === "lancer" ? slot.rotation.z : 0;
    const wobble = quiet ? 0 : Math.sin(timeSec * 7 + id) * 0.08;
    slot.rotation.x = baseX + 0.3 * sag;
    slot.rotation.z = baseZ + wobble * sag;
    // A persistent, readable "spared" state for about 1.8 s (a glancing
    // player, or a 1 fps observer, must not take it for a kill or for
    // nothing): slate power-down pulses that slow and shrink, and the stub
    // where the part tore off spitting short cream sparks.
    const pulses = (slot.userData.disarmPulses as number | undefined) ?? 3;
    if (pulses < 3 && since >= DISARM_PULSE_S[pulses]) {
      slot.userData.disarmPulses = pulses + 1;
      rings.spawn(slot.position, PALETTE.slate, 1.1 - 0.2 * pulses, 0.5);
    }
    const stub = slot.userData.stub as THREE.Vector3 | undefined;
    if (
      stub && since < 1.8 && burstsThisFrame < MAX_BURSTS_PER_FRAME &&
      Math.sin(timeSec * (quiet ? 9 : 31) + id * 2.3) > 0.8
    ) {
      burstsThisFrame++;
      particles.burst({
        at: tmpV.copy(slot.position).add(stub),
        color: PALETTE.sparkCream,
        count: quiet ? 1 : 3,
        speed: 1.6,
        life: 0.18,
        size: 0.06,
      });
    }
    // Engine sputter: an irregular cough, about three a second.
    if (
      !quiet && burstsThisFrame < MAX_BURSTS_PER_FRAME &&
      Math.sin(timeSec * 23 + id * 1.7) > 0.93
    ) {
      burstsThisFrame++;
      particles.burst({
        at: slot.position,
        color: SMOKE,
        count: 2,
        speed: 0.5,
        life: 0.6,
        size: 0.12,
      });
    }
  }

  /** The Warden's scorch and seams: hull by hp, each pod by its own hp. */
  function wardenDamage(
    slot: ModelSlot,
    b: NonNullable<SimState["boss"]>,
  ): void {
    if (b.hp < b.maxHp) {
      ownMaterials(slot);
      slot.userData.damage = 1 - b.hp / b.maxHp;
    }
    for (const pod of b.pods) {
      if (pod.broken || pod.hp >= pod.maxHp) continue;
      const name = partNode(slot, pod.id);
      if (!name) continue;
      isolatePart(slot, name);
      const damage = (slot.userData.partDamage as Record<string, number>) ??
        {};
      damage[name] = 1 - pod.hp / pod.maxHp;
      slot.userData.partDamage = damage;
    }
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

  function buildHangar(): void {
    hangarShip = models.create("pilot_ship");
    hangarShip.position.copy(HANGAR_POINT).setY(0.35);
    hangarShip.scale.setScalar(0.9);
    scene.add(hangarShip);
    // A pad with a lit rim, two practicals and a cool back light.
    hangarPad = new THREE.Group();
    hangarPad.position.copy(HANGAR_POINT);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.18, 48),
      new THREE.MeshStandardMaterial({
        color: 0x2a2f38,
        metalness: 0.8,
        roughness: 0.35,
      }),
    );
    hangarPad.add(pad);
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.02, 8, 96),
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

  // Read-only diagnostics, installed only for explicit QA sessions.
  if (new URLSearchParams(globalThis.location.search).get("qa") === "1") {
    Object.assign(globalThis, {
      __nwWorld: {
        stats: () => ({ ...sectorWorld.stats(), render: stats() }),
        archive: (language?: WorldLanguage) =>
          sectorWorld.archive.entries(language),
      },
    });
  }

  return {
    models,

    observe(state, events = []) {
      // A new run (or a restart) puts the Warden's wreck away: the next
      // Warden is a fresh model with every pod and plate in place.
      if (finale.active && state.outcome === null) {
        finale.reset();
        sectorWorld.setPower(null);
        if (boss) {
          boss.removeFromParent();
          boss = null;
        }
      }
      interp.observe(state);
      const fired = events.find((e) => e.type === "playerFired");
      bullets.tagger.observe(
        state.bullets,
        fired?.type === "playerFired" ? fired : null,
      );
      sectorWorld.observe(
        state,
        events.some((e) =>
          e.type === "hit" || e.type === "partBreak" || e.type === "lifeLost"
        ),
      );
      // A lost life outranks a kill on the same tick: the kill's
      // explosion waits, positioned now, so the loss reads first.
      const defer = deferredBy(events);
      for (const e of events) {
        if (!defer || !isDeferrable(e)) {
          pending.push(e);
          continue;
        }
        const enemy = interp.latest?.enemies.find((x) =>
          e.type === "kill" && x.id === e.id
        );
        if (enemy) {
          lastSeen.set(enemy.id, simPoint(enemy.pos, new THREE.Vector3(), 0));
        }
        timers.push({
          at: timeSec + DEFERRED_FEEDBACK_S,
          run: () => handle(e),
        });
      }
      for (const e of events) {
        if (e.type === "partBreak") {
          sectorWorld.flash(simToWorldX(e.pos.x), simToWorldZ(e.pos.y));
        }
      }
    },

    render(dtMs, alpha = 1) {
      const t0 = performance.now();
      renderer.info.reset();
      const dt = Math.min(dtMs, 100) / 1000;
      rig.reduceMotion = reduceMotion || motionQuery.matches;
      timeSec += dt;
      ctx.timeSec = timeSec;
      burstsThisFrame = 0;
      avgFrameMs += (dtMs - avgFrameMs) * 0.05;

      const state = interp.latest;
      // The registry swaps glTF content into slots when it loads; a fresh
      // content node has fresh materials, so re-apply the loadout to it.
      for (const s of [ship, hangarShip]) {
        if (s && s.userData.content !== s.userData.lookedAt) {
          delete s.userData.owned;
          applyLook(s);
          s.userData.lookedAt = s.userData.content;
        }
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

      // Logo turntable. Logos sway rather than
      // spin: a full turn would show their lettering mirrored.
      if (activeProp) {
        const prop = props.get(activeProp);
        if (prop) prop.rotation.y = Math.sin(timeSec * 0.6) * 0.45;
      }

      particles.update(flashback ? dt * 0.15 : dt);
      rings.update(flashback ? dt * 0.15 : dt);
      debris.reduceMotion = rig.reduceMotion;
      debris.update(flashback ? dt * 0.15 : dt);
      ricochets.update(dt);
      // Reduced flashing: a slower, dimmer frame.
      edge = Math.max(0, edge - dt * (reducedFlashing ? 0.9 : 1.4));
      muzzle.update(dt);
      wave.update(dt);
      backdrop.update(rig.reduceMotion ? 0 : flashback ? dt * 0.1 : dt);
      finale.update({
        dt,
        low: !tier.bloom,
        reducedMotion: rig.reduceMotion,
        reducedFlashing,
      });
      for (const scout of finale.scoutSlots) {
        applyInstanceLook(scout, dt, { reducedFlashing });
      }
      sectorWorld.setPower(finale.active ? finalePower : null);
      rig.update(dtMs, ctx);
      const worldSettings = options.settings?.get();
      backdrop.setWorldActive(!!state && state.phase !== "tutorial");
      sectorWorld.update(
        dt,
        rig.camera,
        renderer.domElement.clientWidth,
        renderer.domElement.clientHeight,
        !tier.bloom,
        rig.reduceMotion,
        worldSettings?.textLang ?? "en",
        // The world stays up behind the story shots in the arena too: a
        // wide ending shot without it was most of a screen of starfield.
        !flashback && !activeProp && !hangarShip?.visible &&
          WORLD_SHOTS.has(rig.currentShot),
        reducedFlashing,
      );

      const flashNow = flashes.update(dtMs);
      post.render(timeSec, {
        flash: flashNow,
        flashColor: flashes.tint,
        desaturate: flashback ? 0.85 : 0,
        bloomScale: reducedFlashing ? 0.6 : 1,
        bulletDensity: bullets.enemyCount,
        hurt: reducedFlashing ? hurt * 0.4 : hurt,
        edge: reducedFlashing ? edge * 0.45 : edge,
        wave: {
          x: wave.center.x,
          y: wave.center.y,
          radius: wave.radius,
          strength: wave.strength,
        },
      });
      if (focusMarker.visible && !activeProp && !hangarShip?.visible) {
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(precisionOverlay, rig.camera);
        renderer.autoClear = autoClear;
      }
      avgRenderMs += (performance.now() - t0 - avgRenderMs) * 0.05;
    },

    playShot(shot, durationMs, ease) {
      rig.play(shot, durationMs, ease);
    },

    finaleBeat(beat) {
      finale.beat(beat);
    },

    finaleSkip() {
      finale.skipToEnd();
    },

    showProp(id) {
      if (activeProp) props.get(activeProp)!.visible = false;
      activeProp = id;
      if (!id) return;
      let prop = props.get(id);
      if (!prop) {
        prop = models.create(id);
        prop.position.copy(STAGE_POINT);
        // Logos face the camera upright.
        prop.position.y += 0.2;
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
      // glTF content may swap in late; re-apply on the next frames too.
      applyLook(ship);
      if (hangarShip) applyLook(hangarShip);
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

    playfieldPxPerUnit() {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width < 1) return null;
      const z = simToWorldZ(PLAYFIELD.height * 0.875);
      const a = tmpV.set(simToWorldX(0), 0, z).project(rig.camera).x;
      const b = tmpV.set(simToWorldX(PLAYFIELD.width), 0, z).project(rig.camera)
        .x;
      const px = Math.abs(b - a) * 0.5 * rect.width;
      return px > 0 ? px / PLAYFIELD.width : null;
    },

    stats,
    worldArchive: (language) => sectorWorld.archive.entries(language),
    worldStats: () => sectorWorld.stats(),

    dispose() {
      sectorWorld.dispose();
      focusMarker.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const material of focusMaterials) material.dispose();
      unsubscribe?.();
      globalThis.removeEventListener("resize", resize);
      boxWatch?.disconnect();
      post.dispose();
      shotTrails.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
