/**
 * Kill ending (`bossDefeated`): "The lanes are open." The original game's
 * three epilogue lines stay, and tollgates unfold between them. The tally
 * (`ui.ending.tally.*`) is shown, not scolded: numbers, no judgment.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { camera, music, pause, say, setFlag } from "./cues.ts";

export const endingKill: Timeline = {
  id: "ending-kill",
  cues: [
    music("silence", 600),
    camera("bossCloseup", 1500),
    ...say("kill_warden_001"),
    pause(700),
    setFlag(FLAGS.bannerWardenDown),
    ...say("kill_ai_001"),
    music("endingKill", 3000),
    camera("endingWide", 4000),
    pause(800),
    ...say("end_epi_001"),
    pause(1200),
    ...say("end_epi_002"),
    setFlag(FLAGS.endingTollgates),
    pause(1800),
    ...say("kill_ai_002"),
    pause(1500),
    ...say("end_epi_003"),
    pause(2000),
    ...say("kill_ai_003"),
    pause(900),
    ...say("kill_ai_004"),
    pause(1500),
    setFlag(FLAGS.endingTally),
    pause(6000),
    setFlag(FLAGS.endingThankYou),
    pause(4000),
    setFlag(FLAGS.endingComplete),
  ],
};
