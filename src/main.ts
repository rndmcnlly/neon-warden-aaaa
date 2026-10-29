/**
 * Entry point: wires every workstream together and runs the game loop.
 *
 * Who owns what at runtime:
 * - The front end (DOM menus) decides whether gameplay runs at all.
 * - The loop below owns wall-clock time and decides how many sim ticks to
 *   run per frame (fixed timestep with an accumulator for human play, a
 *   fixed `speed` for auto-play, zero while paused or frozen).
 * - The sim is the only writer of game state; the stage only reads it.
 * - The Director plays scenes (timelines) in reaction to sim events, and
 *   talks back only through narrow ports: camera, music, sfx, voice, the
 *   sim's freeze switch and story flags.
 */

import {
  type InputFrame,
  parseUrlFlags,
  type Pilot,
  type Sim,
  type SimEvent,
  type SimStart,
  type SkipTo,
  TICK_MS,
  type Timeline,
} from "./contracts/index.ts";
import { createSim } from "./sim/sim.ts";
import { FightingAutopilot } from "./pilots/fighting.ts";
import { PacifistAutopilot } from "./pilots/pacifist.ts";
import { createSettingsStore } from "./settings/store.ts";
import { createStage, type PropId } from "./render/stage.ts";
import { createFrontEnd } from "./ui/frontEnd.ts";
import type { StartRequest } from "./ui/context.ts";
import { createDevOverlay } from "./ui/devOverlay.ts";
import { AudioEngine } from "./audio/engine.ts";
import { Director } from "./director/director.ts";
import type { MusicPort, SfxPort, VoicePort } from "./director/ports.ts";
import { lookup } from "./i18n/index.ts";
import {
  FLAGS,
  INITIAL_FLAGS,
  runFlagsAfter,
  timelineById,
  timelineForEvent,
} from "./scenes/index.ts";
import { PausableClock } from "./app/clock.ts";
import { createSubtitleLayer } from "./app/subtitleView.ts";
import { installQaProbe, type QaRecorder } from "./app/qaProbe.ts";
import "./style.css";

const DEFAULT_SEED = 121;
/** Never simulate more than this per frame, so a background tab cannot spiral. */
const MAX_TICKS_PER_FRAME = 8;
/** How long the warp streak lasts after a sector is cleared. */
const WARP_MS = 1400;
/** Analog sticks drift; a tutorial movement step needs a deliberate push. */
const TUTORIAL_MOVE_THRESHOLD = 0.5;

const flags = parseUrlFlags(location.search);
const settings = createSettingsStore();
const overlayRoot = document.getElementById("overlay")!;
const stage = createStage(document.getElementById("stage")!, { settings });

// ------------------------------------------------------------------ audio

/** Silent stand-ins, so the game runs (subtitled) if Web Audio is missing. */
const SILENT_VOICE: VoicePort = {
  play: () => null,
  durationMs: () => undefined,
  speaker: () => undefined,
};
const SILENT_MUSIC: MusicPort = { play() {} };
const SILENT_SFX: SfxPort = { play() {} };

const engine = await AudioEngine.create({ store: settings }).catch(
  (error: unknown) => {
    console.warn("audio unavailable, running silent", error);
    return null;
  },
);
if (engine) {
  // Boot sounds first, then the rest in the background while menus show.
  void engine.loadStage("boot").then(async () => {
    for (const stageName of ["menu", "gameplay", "ending"] as const) {
      await engine.loadStage(stageName);
    }
  });
}

// --------------------------------------------------------------- director

const clock = new PausableClock();
const subtitles = createSubtitleLayer(overlayRoot, settings);

/** Gameplay-side state the Director's ports reach into. */
let sim: Sim | null = null;
let warpUntil = 0;
/** Set with `?qa=1`: records scenes, lines and sim events for `qa/`. */
let qa: QaRecorder | null = null;

const CLOSEUP_PROPS: Partial<Record<string, PropId>> = {
  pilotCloseup: "pilot_figure",
};

/**
 * Each run gets a fresh Director, so story flags (and any half-played scene)
 * never leak from one run into the next.
 */
function makeDirector(): Director {
  const director = new Director({
    clock,
    voice: engine ?? SILENT_VOICE,
    music: engine?.musicPort ?? SILENT_MUSIC,
    sfx: engine?.sfxPort ?? SILENT_SFX,
    camera: {
      shot(shot, durationMs, ease) {
        if (shot !== "logoTurntable") {
          stage.showProp(CLOSEUP_PROPS[shot] ?? null);
        }
        stage.playShot(shot, durationMs, ease);
      },
    },
    sim: {
      freeze: () => sim?.freeze(),
      resume: () => sim?.resume(),
    },
    onFlag(name, value) {
      sim?.setStoryFlag(name, value);
      if (name === FLAGS.flashbackRecording) stage.setFlashback(value);
      if (name === FLAGS.tutComplete || name === FLAGS.tutSkipped) {
        if (value && sim?.snapshot().phase === "tutorial") sim.beginSector(1);
      }
      // No in-game credits crawl exists yet, so the roll is "done" at once;
      // otherwise the credits timeline would wait on it forever.
      if (name === FLAGS.creditsRoll && value) {
        queueMicrotask(() => director.setFlag(FLAGS.creditsRollDone, true));
      }
    },
    text: lookup,
    settings: () => settings.get(),
  });
  for (const [name, value] of Object.entries(INITIAL_FLAGS)) {
    director.setFlag(name, value);
  }
  subtitles.attach(director.subtitles);
  let lastLine: string | null = null;
  director.subtitles.subscribe((view) => {
    if (view && view.line !== lastLine) qa?.line(view.line);
    lastLine = view?.line ?? null;
  });
  return director;
}

let director = makeDirector();

/** Resolves when the timeline ends; a skip by a newer scene also resolves. */
function playScene(timeline: Timeline | string): Promise<void> {
  const found = typeof timeline === "string"
    ? timelineById(timeline)
    : timeline;
  if (!found) {
    console.warn(`no timeline "${timeline}"`);
    return Promise.resolve();
  }
  qa?.scene(found.id);
  return director.play(found);
}

// -------------------------------------------------------------- front end

const frontEnd = createFrontEnd(overlayRoot, {
  settings,
  flags,
  uiEntry: flags.ui,
  hooks: {
    onAudioUnlock: () => void engine?.resume(),
    playBootLogos,
    onStartGame: (request) => startRun(request),
    onRestartCheckpoint: () => lastRequest && startRun(lastRequest),
    onQuitToTitle: endRun,
  },
});
const devOverlay = createDevOverlay(overlayRoot, flags);
if (flags.qa) {
  qa = installQaProbe({
    scene: () =>
      director.timeline?.id ??
        (sim && frontEnd.isSimRunning() ? "play" : "menu"),
    state: () => sim?.snapshot() ?? null,
  });
}

/**
 * The logo sequence: the boot timeline flips `boot.*` flags on a clock; the
 * stage turns each 3D logo on its plinth while the flag is up.
 */
function playBootLogos(slot: HTMLElement, signal: AbortSignal): Promise<void> {
  // The 3D logos render on the canvas, so the logo screen goes see-through.
  slot.closest(".nw-screen-logos")?.classList.add("is-3d");
  stage.showProp("logo_adamsmith_systems");
  stage.playShot("logoTurntable", 0);
  const watch = setInterval(() => {
    if (director.getFlag("boot.publisherLogo")) stage.showProp("logo_cm121");
  }, 100);
  const done = playScene("boot");
  signal.addEventListener("abort", () => director.skipScene(), { once: true });
  return done.finally(() => {
    clearInterval(watch);
    stage.showProp(null);
    stage.playShot("gameplay", 0);
    engine?.playMusic("menu", 1500);
  });
}

// ------------------------------------------------------------------- runs

let lastRequest: StartRequest | null = null;
let pilot: Pilot | null = null;
/** The flashback plays once per run, however the run started. */
let flashbackPlayed = false;
/**
 * A skip-to scene waits for the run's first tick: the sim announces its
 * starting sector (and the Warden's warning) then, and those events start
 * their own scenes, which would cut a scene started any earlier.
 */
let openingScene: (() => void) | null = null;
let accumulator = 0;

function startFor(at: SkipTo): SimStart {
  const match = at.match(/^sector([1-5])$/);
  if (match) {
    return { kind: "sector", sector: Number(match[1]) as 1 | 2 | 3 | 4 | 5 };
  }
  switch (at) {
    case "tutorial":
      return { kind: "tutorial" };
    // The flashback's own sector: the salvage cache waits there.
    case "flashback":
      return { kind: "sector", sector: 3 };
    case "boss":
    case "ending-kill":
    case "ending-pacifist":
      return { kind: "sector", sector: 6 };
    default:
      return { kind: "sector", sector: 1 };
  }
}

function keyboardPilot(): Pilot {
  return { kind: "keyboard", next: () => frontEnd.input.readFrame() };
}

function startRun(request: StartRequest): void {
  lastRequest = request;
  director.skipScene();
  director = makeDirector();
  flashbackPlayed = false;
  accumulator = 0;
  qa?.runStarted();
  sim = createSim({
    seed: flags.seed ?? DEFAULT_SEED,
    start: startFor(request.at),
    difficulty: request.difficulty,
    // No continue screen exists yet, so every run spends continues silently
    // (see the integration playtest notes).
    autoContinue: true,
  });
  pilot = flags.autoPlay?.mode === "fight"
    ? new FightingAutopilot()
    : flags.autoPlay?.mode === "pacifist"
    ? new PacifistAutopilot()
    : keyboardPilot();

  stage.playShot("gameplay", 0);
  openingScene = null;
  switch (request.at) {
    case "tutorial":
      openingScene = () => void playScene("tutorial");
      break;
    case "flashback":
      flashbackPlayed = true;
      openingScene = () => void playScene("flashback");
      break;
    case "ending-kill":
    case "ending-pacifist": {
      const pacifist = request.at === "ending-pacifist";
      director.setFlag(FLAGS.runPacifist, pacifist);
      openingScene = () => {
        sim?.freeze();
        void playEnding(pacifist ? "ending-pacifist" : "ending-kill");
      };
      break;
    }
  }
}

/** An ending, then the credits, then back to the title (not in auto-play). */
async function playEnding(timelineId: string): Promise<void> {
  const owner = director;
  await playScene(timelineId);
  if (director !== owner || !director.getFlag(FLAGS.endingComplete)) return;
  const credits = playScene("credits");
  await credits;
  if (director === owner && !flags.autoPlay) frontEnd.quitToTitle();
}

function endRun(): void {
  director.skipScene();
  director.stopChatter();
  director = makeDirector();
  sim = null;
  pilot = null;
  openingScene = null;
  stage.setFlashback(false);
  stage.showProp(null);
  engine?.playMusic("menu", 1500);
}

/** Tutorial progress flags come from what the player actually does. */
function noteTutorialInput(input: InputFrame): void {
  if (input.move.x <= -TUTORIAL_MOVE_THRESHOLD) {
    director.setFlag(FLAGS.tutMovedLeft, true);
  }
  if (input.move.x >= TUTORIAL_MOVE_THRESHOLD) {
    director.setFlag(FLAGS.tutMovedRight, true);
  }
  if (Math.abs(input.move.y) >= TUTORIAL_MOVE_THRESHOLD) {
    director.setFlag(FLAGS.tutMovedVertical, true);
  }
  if (input.focus) director.setFlag(FLAGS.tutFocused, true);
}

function onSimEvent(event: SimEvent, phase: string): void {
  qa?.simEvent(event);
  for (const [name, value] of Object.entries(runFlagsAfter(event))) {
    director.setFlag(name, value);
  }
  if (phase === "tutorial") {
    if (event.type === "playerFired") director.setFlag(FLAGS.tutFired, true);
    if (event.type === "kill") director.setFlag(FLAGS.tutTargetDestroyed, true);
    return;
  }
  if (event.type === "sectorCleared") warpUntil = performance.now() + WARP_MS;
  if (event.type === "pickup" && event.firstPowerup) {
    if (flashbackPlayed) return;
    flashbackPlayed = true;
  }
  const scene = timelineForEvent(event);
  if (!scene) return;
  if (event.type === "bossDefeated" || event.type === "bossSurvived") {
    void playEnding(scene.id);
  } else {
    void playScene(scene);
  }
}

// URL flags jump straight into play (the front end skips its menus too).
if (flags.skipTo || flags.autoPlay) {
  startRun({
    at: flags.skipTo ?? "sector1",
    difficulty: settings.get().accessibility.difficulty,
  });
}

// ------------------------------------------------------------------- loop

let last = performance.now();
let wasPaused = false;

function frame(now: number): void {
  const dt = now - last;
  last = now;

  // Gameplay runs only while the front end says so; pausing also stops the
  // Director's clock and the audio, so scenes wait for the player.
  const running = sim !== null && frontEnd.isSimRunning();
  const paused = sim !== null && !running;
  if (paused !== wasPaused) {
    wasPaused = paused;
    clock.setPaused(paused);
    if (engine) void (paused ? engine.ctx.suspend() : engine.ctx.resume());
  }

  let alpha = 1;
  if (running && sim && pilot) {
    let ticks: number;
    if (flags.autoPlay) {
      ticks = flags.autoPlay.speed;
    } else {
      accumulator += dt * settings.get().accessibility.gameSpeed;
      ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(accumulator / TICK_MS));
      accumulator = Math.min(accumulator - ticks * TICK_MS, TICK_MS);
      alpha = accumulator / TICK_MS;
    }
    for (let i = 0; i < ticks; i++) {
      const before = sim.snapshot();
      const input = pilot.next(before);
      if (before.phase === "tutorial") noteTutorialInput(input);
      const events = sim.step(input);
      const after = sim.snapshot();
      stage.observe(after, events);
      for (const event of events) onSimEvent(event, before.phase);
      if (openingScene) {
        openingScene();
        openingScene = null;
      }
    }
    devOverlay.update(sim.snapshot());
  }

  director.update();
  stage.setWarp(Math.max(0, (warpUntil - now) / WARP_MS));
  stage.render(dt, alpha);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
