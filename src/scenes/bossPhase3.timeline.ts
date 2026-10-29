/**
 * Boss phase 3 (`bossPhase` 3): the Warden turns red and spends everything,
 * and the third move of its arc lands: it is a guardian of free sky, not a
 * monster. On the kill route the assistant cheers over the turn without
 * hearing it; that juxtaposition is the point.
 *
 * The turn is a parley, like the descent (`boss.parley`): the Warden stops
 * firing and shrugs off hits while it pleads, so the third move of its arc
 * is heard by anyone still fighting it when the line comes. A Pilot who
 * finishes it faster never hears it, which is also a choice.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, pause, say, sayAll, setFlag } from "./cues.ts";

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
        setFlag(FLAGS.bossParley),
        ...sayAll("boss_turn_001", "boss_turn_002"),
        setFlag(FLAGS.bossParley, false),
        ...say("boss_ai_001"),
        pause(2500),
        ...say("boss_turn_003"),
      ],
    ),
  ],
};
