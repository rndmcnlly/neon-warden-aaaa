/**
 * Credits: the crawl is UI; this timeline holds the music and the sting.
 * Kill route: onboarding begins again for Pilot #0123. Pacifist route: the
 * Warden shouts after the departing ship, still proud of its reputation.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, music, pause, say, setFlag, waitFlag } from "./cues.ts";

export const credits: Timeline = {
  id: "credits",
  cues: [
    // A looping cue (`MUSIC_FALLBACK.credits`): the ending takes are 45 s
    // one-shots and would run out under the crawl.
    music("credits", 2500),
    setFlag(FLAGS.creditsRoll),
    waitFlag(FLAGS.creditsRollDone),
    music("silence", 2000),
    pause(1500),
    branch(FLAGS.runPacifist, say("credits_pac_001"), say("credits_kill_001")),
    pause(1500),
    setFlag(FLAGS.creditsComplete),
  ],
};
