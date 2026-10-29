/**
 * Sector intros: one comms line over each sector banner (the banner text is
 * `ui.sector.N.name` and `ui.sector.N.subtitle`, from the original game).
 * Each is a tiny timeline; the files `sector1.timeline.ts` to
 * `sector5.timeline.ts` export them so `?skipto=sectorN` finds them by id.
 */

import type { Timeline } from "../contracts/index.ts";
import type { ScriptKey } from "../i18n/index.ts";
import { camera, music, pause, say } from "./cues.ts";

export function sectorIntro(
  sector: 1 | 2 | 3 | 4 | 5,
  line: ScriptKey,
): Timeline {
  return {
    id: `sector${sector}`,
    cues: [
      // Sector 1 starts the gameplay music; later sectors keep it running.
      ...(sector === 1
        ? [music("gameplay", 2000), camera("gameplay", 800)]
        : []),
      // Let the banner flip down (2.6 s in the original) before speaking.
      pause(1400),
      ...say(line),
    ],
  };
}
