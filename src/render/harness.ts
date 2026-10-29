/**
 * Renderer dev harness (render-harness.html at the repo root). Drives the
 * stage with a fake, scripted SimState so the renderer can be checked in a
 * browser without the real sim, and so it exercises the same contract the
 * game loop will: a fixed 60 Hz tick with an accumulator, `observe` after
 * every tick, `render(dt, alpha)` once per frame.
 *
 * URL flags:
 *   ?scene=sector|boss|logo|hangar     what to show (default sector)
 *   &turntable=1                    hangar: turntable instead of hero shot
 *   &speed=N                        ticks per frame, like auto-play
 *   &preset=low|medium|high|ultra   display preset
 *   &shot=<CameraShotId>            camera shot to blend to after 1 s
 *   &reduced=1                      reduced flashing
 *   &hold=N                         stop the fake sim at tick N (for stills)
 */

import type {
  BossPhase,
  BulletView,
  EnemyKind,
  EnemyView,
  PickupView,
  Settings,
  SettingsListener,
  SettingsStore,
  SimEvent,
  SimState,
} from "../contracts/index.ts";
import { DEFAULT_LOADOUT, PLAYFIELD, TICK_MS } from "../contracts/index.ts";
import { DEFAULT_SETTINGS } from "../settings/defaults.ts";
import type { RigShotId } from "./cameraRig.ts";
import { createStage } from "./stage.ts";

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? "sector";
const speed = Number(params.get("speed") ?? 0);
const hold = Number(params.get("hold") ?? Infinity);
const preset =
  (params.get("preset") ?? "high") as Settings["display"]["preset"];

/** A throwaway in-memory settings store; the real one lives in src/settings/. */
function memoryStore(initial: Settings): SettingsStore {
  let current = initial;
  const listeners = new Set<SettingsListener>();
  return {
    get: () => current,
    update(recipe) {
      current = recipe(current);
      for (const l of listeners) l(current);
    },
    reset() {
      current = initial;
      for (const l of listeners) l(current);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const settings = memoryStore({
  ...DEFAULT_SETTINGS,
  display: { ...DEFAULT_SETTINGS.display, preset },
  accessibility: {
    ...DEFAULT_SETTINGS.accessibility,
    reducedFlashing: params.get("reduced") === "1",
  },
});

const stage = createStage(document.getElementById("stage")!, { settings });
(globalThis as unknown as { __stage: unknown }).__stage = stage;

// ---- a fake sim: deterministic, scripted motion, no gameplay rules ---------

const W = PLAYFIELD.width;
const H = PLAYFIELD.height;
let tick = 0;
let nextId = 1;

interface FakeEnemy {
  id: number;
  kind: EnemyKind;
  born: number;
  x0: number;
  y0: number;
}
let enemies: FakeEnemy[] = [];
let bullets: (BulletView & { pos: { x: number; y: number } })[] = [];
let pickups: PickupView[] = [];
let shielded = false;

function spawnWave(): SimEvent[] {
  const events: SimEvent[] = [];
  const add = (kind: EnemyKind, x0: number, y0: number) => {
    const e = { id: nextId++, kind, born: tick, x0, y0 };
    enemies.push(e);
    events.push({ type: "spawn", tick, id: e.id, kind });
  };
  for (let i = 0; i < 5; i++) add("drone", 80 + i * 80, -20 - (i % 2) * 40);
  add("turret", 240, -30);
  add("dart", 120, -40);
  add("dart", 360, -40);
  add("lancer", -20, 160);
  add("lancer", W + 20, 160);
  return events;
}

function enemyPos(e: FakeEnemy): { x: number; y: number } {
  const age = tick - e.born;
  switch (e.kind) {
    case "drone":
      return {
        x: e.x0 + Math.sin(age * 0.05 + e.id) * 46,
        y: e.y0 + age * 1.5,
      };
    case "dart":
      return age < 50
        ? { x: e.x0, y: e.y0 + age * 1.2 }
        : { x: e.x0, y: e.y0 + 60 + (age - 50) * 5.2 };
    case "turret":
      return { x: e.x0, y: e.y0 + Math.min(age, 70) * 2.2 };
    case "lancer": {
      const dir = e.x0 < 0 ? 1 : -1;
      return { x: e.x0 + dir * age * 2.4, y: e.y0 + age * 0.35 };
    }
  }
}

function step(): SimEvent[] {
  tick++;
  const events: SimEvent[] = [];
  const bossScene = scene === "boss";
  if (!bossScene && (tick === 1 || tick % 360 === 0)) {
    events.push(...spawnWave());
  }

  // Player shots every 7 ticks, like the original; power 3 fan.
  const player = playerPos();
  if (tick % 7 === 0) {
    for (const vx of [-1.6, 0, 1.6]) {
      bullets.push({
        id: nextId++,
        kind: "shot",
        pos: { x: player.x, y: player.y - 20 },
        vel: { x: vx, y: -11 },
        radius: 6,
      });
    }
    events.push({
      type: "playerFired",
      tick,
      shots: 3,
      shot: "stream",
      level: 0,
      pos: playerPos(),
    });
  }
  // Enemy fire: a rotating fan from the top (or the Warden's spiral).
  const src = bossScene ? bossPos() : { x: 240, y: 120 };
  if (tick % (bossScene ? 6 : 14) === 0) {
    const arms = bossScene ? 4 : 7;
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + tick * 0.05;
      bullets.push({
        id: nextId++,
        kind: i % 3 === 0 && bossScene ? "heavy" : "bullet",
        pos: { x: src.x, y: src.y },
        vel: { x: Math.cos(a) * 2.6, y: Math.abs(Math.sin(a)) * 2.6 + 0.6 },
        radius: i % 3 === 0 && bossScene ? 8 : 5,
      });
    }
  }
  bullets = bullets
    .map((b) => ({ ...b, pos: { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y } }))
    .filter((b) =>
      b.pos.x > -20 && b.pos.x < W + 20 && b.pos.y > -20 && b.pos.y < H + 20
    );

  // Scripted kills so explosions show up.
  const doomed = enemies.filter((e) => tick - e.born === 140 + (e.id % 5) * 25);
  for (const e of doomed) {
    events.push({
      type: "hit",
      tick,
      target: "enemy",
      id: e.id,
      absorbedByShield: false,
      blocked: false,
    });
    events.push({
      type: "kill",
      tick,
      id: e.id,
      kind: e.kind,
      score: 100,
      byRam: false,
      clean: false,
    });
    if (e.kind === "turret") {
      pickups.push({ id: nextId++, kind: "spread", pos: enemyPos(e) });
    }
  }
  enemies = enemies.filter((e) =>
    !doomed.includes(e) && enemyPos(e).y < H + 40
  );
  pickups = pickups
    .map((p) => ({ ...p, pos: { x: p.pos.x, y: p.pos.y + 1.1 } }))
    .filter((p) => p.pos.y < H + 20);

  if (tick % 600 === 300) {
    shielded = !shielded;
    events.push({ type: "pickup", tick, kind: "shield", firstPowerup: false });
  }
  if (shielded && tick % 90 === 0) {
    events.push({
      type: "hit",
      tick,
      target: "player",
      id: 0,
      absorbedByShield: true,
      blocked: false,
    });
  }
  if (bossScene && tick % 240 === 0) {
    events.push({
      type: "bossPhase",
      tick,
      phase: (((tick / 240) % 3) + 1) as BossPhase,
    });
  }
  return events;
}

function playerPos(): { x: number; y: number } {
  return {
    x: 240 + Math.sin(tick * 0.02) * 170,
    y: 540 + Math.sin(tick * 0.031) * 40,
  };
}

function bossPos(): { x: number; y: number } {
  const descent = Math.min(tick, 150) * 1.4;
  return { x: 240 + Math.sin(tick * 0.012) * 140, y: -80 + descent };
}

function snapshot(): SimState {
  const p = playerPos();
  const vx = Math.cos(tick * 0.02) * 170 * 0.02;
  // Fake scan: the player rests for half of every 5 s; enemies in a cone
  // ahead dwell toward a lock (the real rule lives in src/sim/).
  const resting = tick % 300 < 160;
  const half = 0.32;
  const range = 300;
  const enemyViews: EnemyView[] = enemies.map((e) => {
    const pos = enemyPos(e);
    const dx = pos.x - p.x;
    const dy = p.y - pos.y;
    const inCone = resting && dy > 0 && dy < range &&
      Math.abs(Math.atan2(dx, dy)) < half;
    const dwell = inCone ? Math.min(1, (tick % 300) / 90) : 0;
    return {
      id: e.id,
      kind: e.kind,
      pos,
      radius: 13,
      hp: 2,
      maxHp: 2,
      age: tick - e.born,
      ai: dwell >= 1 ? "aim" : "patrol",
      aiTicks: 0,
      parts: [],
      weakPoint: { offset: { x: 0, y: 4 }, radius: 5 },
      lock: dwell,
      locked: dwell >= 1,
      disarmed: e.id % 7 === 0 && tick - e.born > 120,
    };
  });
  return {
    tick,
    seed: 121,
    phase: scene === "boss" ? "boss" : "sector",
    outcome: null,
    sector: scene === "boss" ? 6 : 3,
    player: {
      pos: p,
      radius: 6,
      lives: 3,
      power: 3,
      shielded,
      graceTicks: 0,
      bank: Math.max(-0.18, Math.min(0.18, vx * 0.06)),
      vel: { x: vx, y: 0 },
      trigger: resting ? "rest" : "stream",
      chargeLevel: resting
        ? Math.min(3, Math.floor((tick % 300) / 45)) as 0 | 1 | 2 | 3
        : 0,
      charge: resting ? ((tick % 300) % 45) / 45 : 0,
      scan: { active: resting, halfAngle: half, range, targetId: null },
    },
    enemies: enemyViews,
    bullets,
    pickups,
    boss: scene === "boss"
      ? {
        id: 999999,
        pos: bossPos(),
        radius: 46,
        hp: 600,
        maxHp: 900,
        phase: tick < 150 ? 0 : 2,
        invulnerable: tick < 150,
        ai: tick < 150 ? "descend" : "fan",
        pods: (["fanPodL", "fanPodR", "cannonPod", "spiralPod"] as const).map(
          (id, i) => ({
            id,
            kind: i < 2
              ? "fanPod" as const
              : i === 2
              ? "cannonPod" as const
              : "spiralPod" as const,
            offset: { x: 0, y: 0 },
            radius: 14,
            hp: 60,
            maxHp: 60,
            broken: i === 1 && tick > 400,
          }),
        ),
        coreOpen: false,
        weakPoint: { offset: { x: 0, y: 10 }, radius: 16 },
        lock: resting ? Math.min(1, (tick % 300) / 90) : 0,
        locked: resting && tick % 300 >= 90,
      }
      : null,
    score: tick * 10,
    kills: 0,
    pay: { credits: 0, rate: 1, chainTicks: 0, chainMax: 1 },
    graze: { meter: 0, count: 0, radius: 18 },
    scoutsSpared: 0,
    flags: {
      pacifistIntact: false,
      neverFired: false,
      recorderRecovered: false,
      firstPowerupTaken: true,
    },
    loadout: DEFAULT_LOADOUT,
  };
}

// ---- cutscene scenes ---------------------------------------------------------

if (scene === "hangar") {
  stage.showHangar(params.get("turntable") ? "turntable" : "hero");
} else if (scene === "logo") {
  stage.showProp("logo_adamsmith_systems");
  stage.playShot("logoTurntable", 0);
}
const shot = params.get("shot") as RigShotId | null;
if (shot) setTimeout(() => stage.playShot(shot, 1500, "inOut"), 1000);

// ---- the loop: same shape as src/main.ts ------------------------------------

const hud = document.getElementById("hud")!;
let last = performance.now();
let acc = 0;
let hudAt = 0;

function frame(now: number): void {
  const dt = now - last;
  last = now;
  let ticks: number;
  if (speed > 0) {
    ticks = speed;
    acc = 0;
  } else {
    acc += dt;
    ticks = Math.min(8, Math.floor(acc / TICK_MS));
    acc -= ticks * TICK_MS;
  }
  if (tick + ticks > hold) ticks = Math.max(0, hold - tick);
  for (let i = 0; i < ticks; i++) {
    const events = step();
    stage.observe(snapshot(), events);
  }
  if (tick === 0) stage.observe(snapshot());
  stage.render(dt, speed > 0 ? 1 : acc / TICK_MS);

  if (now - hudAt > 250) {
    hudAt = now;
    const s = stage.stats();
    hud.textContent = `scene ${scene}  tick ${tick}  ` +
      `frame ${s.frameMs.toFixed(2)} ms  render ${s.renderMs.toFixed(2)} ms  ` +
      `draws ${s.drawCalls}  tris ${s.triangles}  bullets ${bullets.length}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
