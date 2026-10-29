/**
 * Boss phase 2 (`bossPhase` 2): the Warden sheds armor and summons its own
 * scouts. On the kill route it orders them to surround, not attack; on the
 * pacifist route (time-based phases) the assistant escalates instead.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, pause, say } from "./cues.ts";

export const bossPhase2: Timeline = {
  id: "boss-phase2",
  cues: [
    branch(
      FLAGS.runPacifist,
      [...say("boss_pac_ai_001"), pause(6000), ...say("boss_pac_003")],
      [...say("boss_p2_001"), pause(8000), ...say("boss_p2_002")],
    ),
  ],
};
