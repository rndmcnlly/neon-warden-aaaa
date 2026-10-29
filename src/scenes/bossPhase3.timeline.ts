/**
 * Boss phase 3 (`bossPhase` 3): the Warden turns red and spends everything,
 * and the third move of its arc lands: it is a guardian of free sky, not a
 * monster. On the kill route the assistant cheers over the turn without
 * hearing it; that juxtaposition is the point.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, pause, say, sayAll } from "./cues.ts";

export const bossPhase3: Timeline = {
  id: "boss-phase3",
  cues: [
    branch(
      FLAGS.runPacifist,
      say("boss_pac_ai_002"),
      [
        ...say("boss_p3_001"),
        pause(5000),
        ...say("boss_p3_002"),
        pause(6000),
        ...sayAll("boss_turn_001", "boss_turn_002"),
        ...say("boss_ai_001"),
        pause(2500),
        ...say("boss_turn_003"),
      ],
    ),
  ],
};
