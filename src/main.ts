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
  type EnemyKind,
  parseUrlFlags,
  type Pilot,
  type Sim,
  type SimEvent,
  type SimStart,
  type SimState,
  type SkipTo,
  TICK_MS,
  type Timeline,
} from "./contracts/index.ts";
import { createSim } from "./sim/sim.ts";
import { FightingAutopilot } from "./pilots/fighting.ts";
import { PacifistAutopilot } from "./pilots/pacifist.ts";
import { createSettingsStore } from "./settings/store.ts";
import { createStage } from "./render/stage.ts";
import { createFrontEnd, type FrontEnd } from "./ui/frontEnd.ts";
import type { StartRequest } from "./ui/context.ts";
import { createDevOverlay } from "./ui/devOverlay.ts";
import { AudioEngine } from "./audio/engine.ts";
import { isGameplaySound } from "./audio/gameplaySounds.ts";
import { VariantRegistry } from "./audio/variants.ts";
import { mountVariantPanel } from "./audio/variantPanel.ts";
import { Director } from "./director/director.ts";
import type { MusicPort, SfxPort, VoicePort } from "./director/ports.ts";
import { id, lookup } from "./i18n/index.ts";
import { createFlatLogos } from "./presentation/flatLogos.ts";
import "./presentation/flatLogos.css";
import { BOOT_LOGO_HOLD_MS } from "./scenes/boot.timeline.ts";
import {
  chatterFor,
  FLAGS,
  INITIAL_FLAGS,
  runFlagsAfter,
  timelineById,
  timelineForEvent,
} from "./scenes/index.ts";
import { PausableClock } from "./app/clock.ts";
import { runTicks } from "./app/tickLoop.ts";
import { Hitstop } from "./render/hitstop.ts";
import {
  DEFERRED_FEEDBACK_S,
  deferredBy,
  isDeferrable,
} from "./render/feedbackLadder.ts";
import { createSubtitleLayer } from "./app/subtitleView.ts";
import { RadioDesk } from "./director/radioDesk.ts";
import { radioFor, type RadioSituation } from "./scenes/radio.ts";
import { place } from "./audio/spatial.ts";
import { setUiSoundSink } from "./ui/sound.ts";
import { installQaProbe, type QaRecorder } from "./app/qaProbe.ts";
import { withTutorialDemo } from "./app/tutorialDemo.ts";
import {
  type CommentaryContext,
  CommentaryScheduler,
  keyValueBagStore,
  memoryBagStore,
} from "./director/commentary.ts";
import { TutorialProgress } from "./director/tutorialProgress.ts";
import { ALL_BANKS } from "./scenes/banks/index.ts";
import "./style.css";

const DEFAULT_SEED = 121;
/** Never simulate more than this per frame, so a background tab cannot spiral. */
const MAX_TICKS_PER_FRAME = 8;
/** How long the warp streak lasts after a sector is cleared. */
const WARP_MS = 1400;

const flags = parseUrlFlags(location.search);
const settings = createSettingsStore();
const overlayRoot = document.getElementById("overlay")!;
const stage = createStage(document.getElementById("stage")!, {
  settings,
  // The Warden's finale times its own sounds (src/render/wardenFinale.ts).
  sound: (role) => {
    if (isGameplaySound(role)) engine?.playGameplay(role);
  },
});

// ------------------------------------------------------------------ audio

/** Silent stand-ins, so the game runs (subtitled) if Web Audio is missing. */
const SILENT_VOICE: VoicePort = {
  play: () => null,
  durationMs: () => undefined,
  speaker: () => undefined,
};
const SILENT_MUSIC: MusicPort = { play() {} };
const SILENT_SFX: SfxPort = { play() {} };

/** A/B variants (`?v.voice.tutorial_ai=a_captain`, see src/audio/variants.ts). */
const variants = new VariantRegistry(flags.variants);
const engine = await AudioEngine.create({ store: settings, variants }).catch(
  (error: unknown) => {
    console.warn("audio unavailable, running silent", error);
    return null;
  },
);
if (flags.dev) mountVariantPanel(document.body, variants);
for (const w of [...variants.warnings, ...variants.unknownAxes()]) {
  console.warn("variant ignored:", w);
}
if (engine) {
  // The ears ride the player's ship (see src/audio/spatial.ts).
  engine.setEar(() => {
    const p = sim?.snapshot().player;
    return p ? { pos: p.pos, vel: p.vel } : {
      pos: { x: 240, y: 560 },
      vel: { x: 0, y: 0 },
    };
  });
  // Boot sounds first, then the rest in the background while menus show.
  void engine.loadStage("boot").then(async () => {
    for (const stageName of ["menu", "gameplay", "ending"] as const) {
      await engine.loadStage(stageName);
    }
  });
}

// --------------------------------------------------------------- director

const clock = new PausableClock();
/**
 * Auto-play fast-forwards scenes too, so a QA reel reaches its beat in under
 * a minute; capped, so voice lines stay recognizable as they cut each other.
 */
const SCENE_RATE_CAP = 8;
if (flags.autoPlay) {
  clock.setRate(Math.min(SCENE_RATE_CAP, flags.autoPlay.speed));
}
const subtitles = createSubtitleLayer(overlayRoot, settings, {
  wordsFor: (line, lang) => engine?.words(line, lang),
  now: () => clock.now(),
});
if (engine) setUiSoundSink((role) => engine.playUi(role));

/**
 * Radio chatter (see `src/director/radioDesk.ts`): timeline `radio` cues
 * and the event-driven scout and Lane Control traffic below.
 */
const radio = new RadioDesk({
  clock,
  text: lookup,
  langs: () => settings.get(),
  status: (line, lang) => engine?.status(line, lang) ?? "missing",
  play: (line, lang, pan) => engine?.playRadio(line, lang, pan) ?? false,
  durationMs: (line, lang) => engine?.durationMs(line, lang),
  show: (line) => ui?.hud.radio(line),
});

/** Gameplay-side state the Director's ports reach into. */
let sim: Sim | null = null;
let warpUntil = 0;
/** True while a `freezeSim` cue holds the world (the probe reports it). */
let simFrozen = false;
/** Ambient chatter runs in sectors 1–5 only, never in the tutorial or arena. */
let chatterOn = false;
/** The descent scene has let the Warden fight; never hold it again this run. */
let parleyReleased = false;
/**
 * The front end's in-game pieces (HUD, credits crawl, tutorial skip). Null
 * until the front end mounts, which is after the first Director exists.
 */
let ui: Pick<FrontEnd, "hud" | "credits" | "tutorial"> | null = null;
/** Set with `?qa=1`: records scenes, lines and sim events for `qa/`. */
let qa: QaRecorder | null = null;

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
        stage.showProp(null);
        stage.playShot(shot, durationMs, ease);
      },
    },
    sim: {
      freeze() {
        simFrozen = true;
        sim?.freeze();
      },
      resume() {
        simFrozen = false;
        sim?.resume();
      },
    },
    onFlag(name, value) {
      qa?.flag(name, value);
      ui?.hud.flag(name, value);
      if (name === FLAGS.bossParley && !value) parleyReleased = true;
      sim?.setStoryFlag(name, value);
      // The first shot swaps the uneasy no-fire bank for the default one.
      if (name === FLAGS.runHasFired && chatterOn) {
        director.startChatter([chatterFor(value)]);
      }
      // Ending beats the Warden's finale draws (src/render/wardenFinale.ts).
      if (value && name === FLAGS.endingTollgates) {
        stage.finaleBeat("tollgates");
      }
      if (value && name === FLAGS.endingLeashCut) stage.finaleBeat("leashCut");
      if (value && name === FLAGS.bannerLanesKept) stage.finaleBeat("escort");
      if (name === FLAGS.flashbackRecording) {
        stage.setFlashback(value);
        engine?.setMuffled(value);
      }
      if (name === FLAGS.tutComplete || name === FLAGS.tutSkipped) {
        if (value && sim?.snapshot().phase === "tutorial") sim.beginSector(1);
      }
      // The crawl reports back through `credits.onDone` (set below), which
      // releases the credits timeline's wait on `credits.rollDone`.
      if (name === FLAGS.creditsRoll && value) void ui?.credits.roll();
    },
    text: lookup,
    settings: () => settings.get(),
    radio: (line, channel) => radio.say(line, channel),
  });
  for (const [name, value] of Object.entries(INITIAL_FLAGS)) {
    director.setFlag(name, value);
  }
  subtitles.attach(director.subtitles);
  let lastLine: string | null = null;
  director.subtitles.subscribe((view) => {
    if (view && view.line !== lastLine) qa?.line(view.line, view.lang);
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
    screenPositionOf: (id) => stage.screenPositionOf(Number(id)),
    applyLoadout: (loadout) => stage.applyLoadout(loadout),
    showHangar: (shot) => stage.showHangar(shot),
    onCodexUnlocked: () => engine?.playGameplay("intel_ping"),
    playBootLogos,
    onStartGame: (request) => startRun(request),
    onRestartCheckpoint: () => lastRequest && startRun(lastRequest),
    onQuitToTitle: endRun,
    onSkipScene: skipEnding,
  },
});
const devOverlay = createDevOverlay(overlayRoot, flags);
if (flags.qa) {
  qa = installQaProbe({
    scene: () =>
      director.timeline?.id ??
        (sim && frontEnd.isSimRunning() ? "play" : "menu"),
    timeline: () => director.timeline?.id ?? null,
    state: () => sim?.snapshot() ?? null,
    frozen: () => simFrozen,
    setSpeed(speed) {
      autoSpeed = speed;
      clock.setRate(Math.min(SCENE_RATE_CAP, speed));
      hitstop.setSpeed(speed);
    },
  });
}

ui = frontEnd;
frontEnd.credits.onDone(() => director.setFlag(FLAGS.creditsRollDone, true));
frontEnd.tutorial.onSkip(skipTutorial);

/** The player declined onboarding: the skip scene replaces the tutorial. */
function skipTutorial(): void {
  if (sim?.snapshot().phase !== "tutorial") return;
  director.skipScene();
  void playScene("tutorialSkip");
}

/** A passive DOM layer, driven only by the Director's flags and clock. */
let updateBootLogos: (() => void) | null = null;
let disposeBootLogos: (() => void) | null = null;

function playBootLogos(slot: HTMLElement, signal: AbortSignal): Promise<void> {
  disposeBootLogos?.();
  if (signal.aborted) return Promise.resolve();
  const owner = director;
  const startedAt = clock.now();
  const logos = createFlatLogos(slot);
  const update = () => {
    const current = settings.get();
    logos.setSettings({
      reducedMotion: current.accessibility.reduceMotion,
      reducedFlashing: current.accessibility.reducedFlashing,
    });
    const publisher = owner.getFlag("boot.publisherLogo");
    if (publisher || owner.getFlag("boot.studioLogo")) {
      logos.show(
        publisher ? "incubator" : "studio",
        lookup(
          id(publisher ? "ui.logo.publisherTag" : "ui.logo.studioTag"),
          current.textLang,
        ),
      );
      logos.update(
        clock.now() - startedAt - (publisher ? BOOT_LOGO_HOLD_MS : 0),
      );
    } else logos.hide();
  };
  const dispose = () => {
    logos.dispose();
    signal.removeEventListener("abort", abort);
    if (updateBootLogos === update) {
      updateBootLogos = null;
      disposeBootLogos = null;
    }
  };
  const abort = () => {
    dispose();
    // A stale screen must never skip a newer run's Director or scene.
    if (owner.timeline?.id === "boot") owner.skipScene();
  };
  updateBootLogos = update;
  disposeBootLogos = abort;
  signal.addEventListener("abort", abort, { once: true });
  const done = playScene("boot");
  update();
  return done.finally(() => {
    dispose();
    if (director === owner && !owner.timeline) engine?.playMusic("menu", 1500);
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
/**
 * Hitstop freezes whole sim ticks (src/render/hitstop.ts): off under
 * autoplay faster than real time, so QA reels keep their pacing.
 */
const hitstop = new Hitstop(flags.autoPlay?.speed ?? 1);
/**
 * Autoplay ticks per frame. Starts at the URL's `speed`; only the QA probe
 * changes it, so a reel can fast-forward a fight and record its end at 1x.
 */
let autoSpeed = flags.autoPlay?.speed ?? 1;

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

/** The loading stage holding a skip target's VO and music. */
function stageFor(at: SkipTo): "menu" | "gameplay" | "ending" {
  if (at === "tutorial") return "menu";
  return at.startsWith("ending") ? "ending" : "gameplay";
}

function startRun(request: StartRequest): void {
  lastRequest = request;
  // A skip-to run cannot wait for the background queue to reach its stage;
  // the Director also holds any line whose audio is still on its way.
  void engine?.loadStage(stageFor(request.at));
  engine?.sfxPlayer.stopAll();
  engine?.gameplay.reset();
  resetRunAudio();
  director.skipScene();
  director.stopChatter();
  qa?.runStarted();
  ui?.hud.reset();
  director = makeDirector();
  // The salvage cache sits in sector 3: a run that starts past it has
  // already seen the flashback, narratively.
  flashbackPlayed = /^(boss|ending-)/.test(request.at);
  parleyReleased = false;
  chatterOn = false;
  simFrozen = false;
  accumulator = 0;
  hitstop.reset();
  sim = createSim({
    movement: flags.movement,
    seed: flags.seed ?? DEFAULT_SEED,
    start: startFor(request.at),
    difficulty: request.difficulty,
    loadout: request.loadout,
    // Attract and QA runs spend continues silently; a human gets the
    // continue screen after `gameOver` (see `offerContinue`).
    autoContinue: flags.autoPlay !== null,
  });
  pilot = flags.autoPlay?.mode === "fight"
    ? withTutorialDemo(new FightingAutopilot())
    : flags.autoPlay?.mode === "pacifist"
    ? withTutorialDemo(new PacifistAutopilot())
    : keyboardPilot();

  stage.playShot("gameplay", 0);
  openingScene = null;
  switch (request.at) {
    case "tutorial":
      openingScene = () => void playScene("tutorial");
      break;
    case "boss":
      // Under the fight autopilot, a skip to the arena stands in for a run
      // that fought its way there; otherwise the Warden meets a pacifist.
      if (flags.autoPlay?.mode === "fight") {
        director.setFlag(FLAGS.runPacifist, false);
      }
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

/**
 * The ending's skip chip: the Director lands every remaining flag (so the
 * credits still follow) and the Warden's finale jumps to its aftermath.
 */
function skipEnding(): void {
  const id = director.timeline?.id;
  if (id !== "ending-kill" && id !== "ending-pacifist") return;
  stage.finaleSkip();
  director.skipScene();
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
  qa?.runStarted();
  ui?.hud.reset();
  director = makeDirector();
  chatterOn = false;
  simFrozen = false;
  sim = null;
  pilot = null;
  openingScene = null;
  engine?.sfxPlayer.stopAll();
  engine?.gameplay.reset();
  engine?.setMuffled(false);
  resetRunAudio();
  stage.setFlashback(false);
  stage.showProp(null);
  engine?.playMusic("menu", 1500);
}

/**
 * Human game over: the continue screen. A continue revives the run where it
 * fell; quitting has already sent the front end to the title.
 */
function offerContinue(): void {
  const run = sim;
  if (!run || flags.autoPlay) return;
  const stats = (run as { stats?: () => { continuesLeft: number } }).stats;
  void frontEnd.showContinue({
    continuesLeft: stats?.call(run).continuesLeft ?? 0,
    score: run.snapshot().score,
  }).then((choice) => {
    if (choice === "continue" && sim === run) run.continueRun();
  });
}

function onSimEvent(
  event: SimEvent,
  phase: string,
  state: SimState,
  deferred = false,
): void {
  qa?.simEvent(event);
  ui?.hud.event(event);
  // A kill on the tick a life is lost sounds after the loss, not over it.
  engine?.gameplay.onEvent(
    event,
    state,
    deferred ? { delayS: DEFERRED_FEEDBACK_S } : {},
  );
  if (event.type === "gameOver") offerContinue();
  for (const [name, value] of Object.entries(runFlagsAfter(event))) {
    director.setFlag(name, value);
  }
  if (event.type === "spawn" && event.kind !== "warden") {
    enemyKinds.set(event.id, event.kind);
  }
  const said = commentary.onEvent(event, commentaryContext(state));
  if (said) qa?.bark(said.line);
  if (phase === "tutorial") {
    tutorialProgress.note(event);
    return;
  }
  if (event.type === "sectorCleared") warpUntil = performance.now() + WARP_MS;
  updateChatter(event);
  radioFromEvent(event, state);
  // The Warden arrives on the sim's schedule, which can beat the descent
  // scene to its parley cue (the warnings run long, more so in other
  // languages). Hold the Warden from the moment it arrives; the scene's own
  // `boss.parley` release still ends the speech, and only once.
  if (
    event.type === "bossPhase" && event.phase === 1 &&
    director.timeline?.id === "boss" && !parleyReleased
  ) {
    director.setFlag(FLAGS.bossParley, true);
  }
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

/** Per-run radio and tutorial tallies start over. */
function resetRunAudio(): void {
  radio.reset();
  enemyKinds.clear();
  lastEnemies = [];
  tutorialProgress.reset();
  commentary.resetRun();
}

/** Tutorial progress flags from what the player's weapon and ship do. */
const tutorialProgress = new TutorialProgress({
  setFlag: (flag) => director.setFlag(flag, true),
  getFlag: (flag) => director.getFlag(flag),
  interject: (line) => director.interject(line),
  escapedLine: () => commentary.deal("tutTargetEscaped"),
  waitingFlag: () => director.waitingFlag,
  inputMode: () => {
    const a = settings.get().accessibility;
    return `${a.autoFire}:${a.holdToggle}`;
  },
  correction: (moment) => {
    if (sim) commentary.onApp(moment, commentaryContext(sim.snapshot()));
  },
  // Scolding the demo autopilot made the lockout line repeat on every lap.
  humanInput: () => pilot?.kind === "keyboard",
});

/** Commentary from the variant banks; bags persist in this browser. */
const commentary = new CommentaryScheduler(ALL_BANKS, {
  now: () => clock.now(),
  bark: (line) => director.bark(line),
  interject: (line) => director.interject(line),
  sceneId: () => director.timeline?.id ?? null,
  store: globalThis.localStorage
    ? keyValueBagStore(globalThis.localStorage)
    : memoryBagStore(),
});

function commentaryContext(state: SimState): CommentaryContext {
  return {
    phase: state.phase,
    sector: state.sector,
    bossPhase: state.boss?.phase ?? null,
    livesLeft: state.player.lives,
    hasFired: !state.flags.neverFired,
    neverFired: state.flags.neverFired,
  };
}

// ------------------------------------------------------------------ radio

/** Enemy kinds by id (spawn events), so a departing scout can be named. */
const enemyKinds = new Map<number, EnemyKind>();
let radioPick = 0;
/** Last tick's enemies, for events about an enemy that just left play. */
let lastEnemies: SimState["enemies"] = [];
let nextPatrolAt = 0;
/** Seconds between patrol-timer radio lines (a range). */
const PATROL_RADIO_MS: readonly [number, number] = [14_000, 24_000];
/** A kill within this distance of another scout makes it report the loss. */
const LOSS_RADIUS = 220;

function radioPan(pos: { x: number; y: number } | undefined): number {
  const ear = sim?.snapshot().player.pos;
  return pos && ear ? place(pos, ear, settings.get().audio.mono).pan : 0;
}

/** Scouts and Lane Control react on the radio, when the air is clear. */
function radioLine(
  source: EnemyKind | "authority",
  situation: RadioSituation,
  pos?: { x: number; y: number },
): void {
  if (!chatterOn || director.timeline || !radio.free) return;
  const line = radioFor(source, situation, radioPick++, {
    hasFired: director.getFlag(FLAGS.runHasFired),
  });
  if (line) radio.say(line.line, line.channel, radioPan(pos));
}

function radioFromEvent(event: SimEvent, state: SimState): void {
  switch (event.type) {
    case "scanLock":
      if (event.kind !== "warden") radioLine(event.kind, "locked", event.pos);
      break;
    case "disarm":
      radioLine(event.kind, "disarmed", event.pos);
      break;
    case "despawn": {
      const kind = enemyKinds.get(event.id);
      if (kind && event.reason !== "wiped") radioLine(kind, "retreat");
      break;
    }
    case "kill": {
      // A surviving scout nearby reports the loss (kill route only).
      // The dead scout left this tick's state; look in the tick before.
      const pos = lastEnemies.find((e) => e.id === event.id)?.pos;
      const witness = state.enemies.find((e) =>
        e.id !== event.id && pos &&
        Math.hypot(e.pos.x - pos.x, e.pos.y - pos.y) < LOSS_RADIUS
      );
      if (witness) radioLine(witness.kind, "lost", witness.pos);
      break;
    }
  }
}

/** Patrol chatter on a timer, from a random scout on screen (or Control). */
function radioPatrol(state: SimState): void {
  const now = clock.now();
  if (now < nextPatrolAt) return;
  const [min, max] = PATROL_RADIO_MS;
  nextPatrolAt = now + min + Math.random() * (max - min);
  const scout = state.enemies[Math.floor(Math.random() * state.enemies.length)];
  if (scout) radioLine(scout.kind, "patrol", scout.pos);
  else radioLine("authority", "patrol");
}

/** Chatter during sectors 1–5; the Warden's arrival ends it for the run. */
function updateChatter(event: SimEvent): void {
  if (event.type === "sectorStarted" && event.sector <= 5 && !chatterOn) {
    chatterOn = true;
    nextPatrolAt = clock.now() + PATROL_RADIO_MS[0];
    director.startChatter([chatterFor(director.getFlag(FLAGS.runHasFired))]);
  } else if (
    chatterOn &&
    (event.type === "bossWarning" ||
      (event.type === "sectorStarted" && event.sector > 5))
  ) {
    chatterOn = false;
    director.stopChatter();
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
    frontEnd.input.reset();
    sim?.resetMovement();
    hitstop.reset();
    wasPaused = paused;
    clock.setPaused(paused);
    if (engine) void (paused ? engine.ctx.suspend() : engine.ctx.resume());
  }

  let alpha = 1;
  if (running && sim && pilot) {
    let ticks: number;
    if (flags.autoPlay) {
      ticks = autoSpeed;
    } else {
      accumulator += dt * settings.get().accessibility.gameSpeed;
      ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(accumulator / TICK_MS));
      accumulator = Math.min(accumulator - ticks * TICK_MS, TICK_MS);
      alpha = accumulator / TICK_MS;
    }
    const run = sim;
    runTicks(ticks, run, pilot, hitstop, ({ before, events, after }) => {
      stage.observe(after, events);
      const defer = deferredBy(events);
      for (const event of events) {
        onSimEvent(event, before.phase, after, defer && isDeferrable(event));
      }
      engine?.gameplay.frame(after);
      if (chatterOn) radioPatrol(after);
      lastEnemies = after.enemies;
      if (openingScene) {
        openingScene();
        openingScene = null;
      }
    }, (before, input) => {
      if (before.phase === "tutorial") tutorialProgress.input(input, before);
    });
    // Frozen: hold the picture on the last tick instead of interpolating
    // toward a tick that has not happened.
    if (hitstop.pending > 0) alpha = 1;
    devOverlay.update(sim.snapshot());
    ui?.hud.update(sim.snapshot());
  }

  director.update();
  updateBootLogos?.();
  radio.update();
  stage.setWarp(Math.max(0, (warpUntil - now) / WARP_MS));
  stage.render(dt, alpha);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
