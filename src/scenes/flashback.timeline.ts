/**
 * Flashback, triggered by the run's first powerup (`pickup.firstPowerup`).
 * The spread crystal is Pilot #0121's flight recorder. The world freezes, so
 * the scene costs the player nothing; we hear #0121's last approach, the
 * Warden begging him to stay, and the recall. The cut back reveals the HUD
 * serial: you are Pilot #0122.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import {
  camera,
  freezeSim,
  music,
  pause,
  resumeSim,
  say,
  sayAll,
  setFlag,
  sfx,
} from "./cues.ts";

export const flashback: Timeline = {
  id: "flashback",
  cues: [
    freezeSim(),
    sfx("notify"),
    ...say("flash_ai_001"),
    music("flashback", 800),
    camera("flashback", 1200),
    setFlag(FLAGS.flashbackRecording),
    pause(800),
    ...say("flash_rec_001"),
    pause(400),
    ...sayAll("flash_rec_002", "flash_rec_003"),
    pause(300),
    ...say("flash_rec_004"),
    pause(900),
    ...say("flash_rec_005"),
    ...say("flash_rec_006"),
    // Signal cut: a hard beat of silence before returning.
    music("silence", 0),
    pause(1500),
    setFlag(FLAGS.flashbackRecording, false),
    camera("gameplay", 600),
    setFlag(FLAGS.hudSerialRevealed),
    ...say("flash_ai_002"),
    music("gameplay", 1500),
    resumeSim(),
    ...say("flash_ai_003"),
  ],
};
