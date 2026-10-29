/**
 * Kill ending (`bossDefeated`): "The lanes are open." The original game's
 * three epilogue lines stay, and tollgates unfold between them. The tally
 * (`ui.ending.tally.*`) is shown, not scolded: numbers, no judgment.
 *
 * It opens on the staged defeat (src/render/wardenFinale.ts): a hard cut to
 * a composed wide on the impact frame, then a held, unscored pause while the
 * renderer tears the Warden apart and the shockwave darkens Last Approach.
 * The dying line lands in the quiet after it. Before the tollgates the music
 * drops out again, so their mechanical arrival plays in silence.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { camera, music, pause, say, setFlag } from "./cues.ts";

/**
 * Covers `KILL_STAGING.settled` (4.4 s) plus the impact hold (0.14 s) in
 * src/render/wardenFinale.ts; a test keeps the two in step.
 */
export const DEFEAT_STAGING_MS = 4700;

export const endingKill: Timeline = {
  id: "ending-kill",
  cues: [
    music("silence", 400),
    // A cut, not a blend: the cut itself is part of the impact.
    camera("wardenFall", 0),
    pause(DEFEAT_STAGING_MS),
    camera("bossCloseup", 2600),
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
    // The quiet before the Authority arrives: no score under the machines.
    music("silence", 1500),
    pause(1200),
    setFlag(FLAGS.endingTollgates),
    pause(3200),
    ...say("kill_ai_002"),
    music("endingKill", 4000),
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
