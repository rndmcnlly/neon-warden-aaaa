/**
 * Pacifist ending, "Lanes Kept" (`bossSurvived`). The Authority recalls
 * Pilot #0122 for non-performance exactly as it recalled #0121; this time
 * the Warden cuts the leash. Pilot's single line of the game is here and is
 * optional (`story.pilotSpeaks`); with it off, the silence is the answer.
 *
 * The finale draws the turn: the tether snaps on `ending.leashCut` and Last
 * Approach's lights swell outward from the Warden; on `banner.lanesKept`
 * its scouts form up and escort it home up the open lane.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, camera, music, pause, say, sayAll, setFlag } from "./cues.ts";

export const endingPacifist: Timeline = {
  id: "ending-pacifist",
  cues: [
    music("silence", 600),
    // A composed wide first: the Warden lowering its guard, intact, with
    // the red recall tether still running from it into the sky
    // (src/render/wardenFinale.ts), and both side regions in frame.
    camera("wardenFall", 1800),
    pause(2200),
    camera("bossCloseup", 3000),
    ...sayAll("pac_end_001", "pac_end_002"),
    ...say("pac_end_003"),
    setFlag(FLAGS.endingLeashCut),
    pause(800),
    ...say("pac_end_004"),
    branch(
      FLAGS.storyPilotSpeaks,
      [
        pause(1200),
        camera("shipCloseup", 800),
        ...say("pilot_keep_001"),
        pause(900),
        ...sayAll("pac_end_005", "pac_end_006"),
      ],
      [
        camera("shipCloseup", 800),
        pause(2800),
        ...sayAll("pac_end_005", "pac_end_007"),
      ],
    ),
    setFlag(FLAGS.bannerLanesKept),
    music("endingPacifist", 3000),
    camera("endingWide", 4000),
    pause(1000),
    ...say("pac_epi_001"),
    pause(1200),
    ...say("pac_epi_002"),
    pause(1500),
    ...say("end_epi_003"),
    pause(2000),
    setFlag(FLAGS.endingTally),
    pause(6000),
    setFlag(FLAGS.endingThankYou),
    pause(4000),
    setFlag(FLAGS.endingComplete),
  ],
};
