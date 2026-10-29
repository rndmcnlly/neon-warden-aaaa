/**
 * Story flags: the shared vocabulary between timelines, the Director, the
 * sim and the UI. Timelines read and write them; everything else listens.
 *
 * Who sets what:
 * - `run.*`: the Director, from sim events (see `runFlagsAfter`).
 * - `tut.*` progress: the Director, from input and sim events during the
 *   tutorial. `tut.complete` and `tut.skipped`: the tutorial timelines.
 * - `story.pilotSpeaks`: a build-time choice (default true). Off keeps Pilot
 *   silent for the whole game.
 * - everything else: timelines, as signals for UI and renderer.
 */

import type { FlagName, SimEvent } from "../contracts/index.ts";

export const FLAGS = {
  // Run state, maintained by the Director.
  /** True until the player destroys anything (shots or ramming). */
  runPacifist: "run.pacifist",
  /** True once the player has fired at least one shot. Its negation is the
   * sim's `neverFired`: the ghost run the Warden reacts to. */
  runHasFired: "run.hasFired",
  /** True once any scout has been disarmed (still pacifist). */
  runDisarmed: "run.disarmed",

  // Tutorial progress, set by the Director while the tutorial runs.
  tutMovedLeft: "tut.movedLeft",
  tutMovedRight: "tut.movedRight",
  tutMovedVertical: "tut.movedVertical",
  tutFocused: "tut.focused",
  tutFired: "tut.fired",
  /** Timeline asks for the practice hologram; the sim or renderer spawns it. */
  tutSpawnTarget: "tut.spawnTarget",
  tutTargetDestroyed: "tut.targetDestroyed",
  // Wave 3 tutorial modules: trigger discipline, scanning, parts, graze, rate.
  /** Three aimed rounds tapped. */
  tutTapped: "tut.tapped",
  /** The trigger held into a stream. */
  tutStreamed: "tut.streamed",
  /** Capacitor at charge level 3. */
  tutCharged: "tut.charged",
  /** The scanning beam locked the practice hologram. */
  tutLocked: "tut.locked",
  /** A Writ released. */
  tutWritFired: "tut.writFired",
  /** Timeline asks for a passive practice turret with one barrel part. */
  tutSpawnTurret: "tut.spawnTurret",
  /** The practice turret's barrel broke (it then leaves, disarmed). */
  tutPartBroken: "tut.partBroken",
  /** Timeline asks for slow practice rounds that pass near the ship. */
  tutGrazeDrill: "tut.grazeDrill",
  /** Five grazes during the drill. */
  tutGrazed: "tut.grazed",
  /** Contract Rate reached x2. */
  tutRateDoubled: "tut.rateDoubled",
  /** The threat briefing reel is on screen (renderer and UI letterbox it). */
  tutBriefingReel: "tut.briefingReel",
  tutSkipped: "tut.skipped",
  tutComplete: "tut.complete",

  // Flashback.
  /** Recorder playback: desaturate, subtitles tag speakers "(recording)". */
  flashbackRecording: "flashback.recording",
  /** HUD now shows "Pilot #0122". Hidden until the flashback reveals it. */
  hudSerialRevealed: "hud.serialRevealed",
  /** The flashback has played (by first powerup or by the recorder). */
  storyFlashbackSeen: "story.flashbackSeen",
  /** The derelict recorder is talking: UI shows its lines in the radio box. */
  recorderPlaying: "recorder.playing",

  // Boss.
  /** The Warden is talking: invulnerable and holding fire (needs sim support). */
  bossParley: "boss.parley",

  // Endings and credits.
  bannerWardenDown: "banner.wardenDown",
  bannerLanesKept: "banner.lanesKept",
  /** Kill ending: tollgates unfold across the open sky. */
  endingTollgates: "ending.tollgates",
  /** Pacifist ending: the Warden cuts the recall link. */
  endingLeashCut: "ending.leashCut",
  endingTally: "ending.tally",
  endingThankYou: "ending.thankYou",
  endingComplete: "ending.complete",
  creditsRoll: "credits.roll",
  /** Set by the UI when the credits crawl reaches the end (or is skipped). */
  creditsRollDone: "credits.rollDone",
  creditsComplete: "credits.complete",

  // Options.
  storyPilotSpeaks: "story.pilotSpeaks",
} as const satisfies Record<string, FlagName>;

/** Flag values at the start of every run. */
export const INITIAL_FLAGS: Readonly<Record<FlagName, boolean>> = {
  [FLAGS.runPacifist]: true,
  [FLAGS.runHasFired]: false,
  [FLAGS.runDisarmed]: false,
  [FLAGS.storyPilotSpeaks]: true,
};

/**
 * How one sim event changes the run flags. Pure, so the Director can call it
 * per event and tests can check it. A kill by ramming still ends pacifism.
 */
export function runFlagsAfter(
  event: SimEvent,
): Readonly<Record<FlagName, boolean>> {
  switch (event.type) {
    case "kill":
      return { [FLAGS.runPacifist]: false };
    case "playerFired":
      return { [FLAGS.runHasFired]: true };
    case "disarm":
      return { [FLAGS.runDisarmed]: true };
    default:
      return {};
  }
}
