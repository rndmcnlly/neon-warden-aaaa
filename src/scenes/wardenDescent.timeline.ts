/**
 * The Warden arrives (`bossWarning`). The first two moves of the Warden's arc
 * meet here: the assistant braces, the narrator gives the scariest two words in the game,
 * and then the Warden opens its mouth: high, furious, a little ridiculous.
 *
 * The descent is the Warden's invulnerable window, played as a parley: it
 * will not be harmed, and will not fire, while it talks (`boss.parley`).
 * Phase 1 barks follow once the fight starts. On the pacifist route the
 * Warden tells a disarmer from a Pilot who never fired (`run.hasFired`).
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { branch, camera, music, pause, say, sayAll, setFlag } from "./cues.ts";

export const wardenDescent: Timeline = {
  id: "boss",
  cues: [
    music("silence", 600),
    ...say("warn_ai_001"),
    pause(500),
    camera("bossIntro", 2600),
    ...say("warn_narr_001"),
    pause(1000),
    setFlag(FLAGS.bossParley),
    // The deflation: the boss music and the real voice arrive together.
    music("boss", 200),
    ...say("desc_001"),
    ...say("desc_ai_001"),
    branch(
      FLAGS.runPacifist,
      [
        // Pacifist: did the Pilot disarm scouts (fired, never killed) or,
        // like #0121, never fire at all? The ghost run hears the full Writ.
        branch(
          FLAGS.runHasFired,
          sayAll("desc_disarm_001", "desc_disarm_002"),
          [
            ...sayAll("desc_pac_001", "desc_pac_002"),
            pause(400),
            ...say("desc_ghost_001"),
          ],
        ),
        pause(600),
        ...say("desc_003"),
      ],
      sayAll("desc_002", "desc_003", "desc_004"),
    ),
    ...say("desc_ai_002"),
    camera("gameplay", 1200),
    setFlag(FLAGS.bossParley, false),

    // Phase 1 barks, spaced out over the opening of the fight.
    branch(
      FLAGS.runPacifist,
      [
        pause(4000),
        ...say("boss_pac_001"),
        pause(7000),
        ...say("boss_pac_002"),
      ],
      [
        pause(6000),
        ...say("boss_taunt_001"),
        pause(9000),
        ...say("boss_p1_002"),
      ],
    ),
  ],
};
