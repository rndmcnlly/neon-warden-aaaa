/**
 * Every scene, plus the rule for which sim event starts which scene. The
 * Director owns playback; this file only says what exists and when.
 */

import type { SimEvent, Timeline } from "../contracts/index.ts";
import { boot } from "./boot.timeline.ts";
import { tutorial } from "./tutorial.timeline.ts";
import { tutorialSkip } from "./tutorialSkip.timeline.ts";
import { sector1 } from "./sector1.timeline.ts";
import { sector2 } from "./sector2.timeline.ts";
import { sector3 } from "./sector3.timeline.ts";
import { sector4 } from "./sector4.timeline.ts";
import { sector5 } from "./sector5.timeline.ts";
import { flashback } from "./flashback.timeline.ts";
import { wardenDescent } from "./wardenDescent.timeline.ts";
import { bossPhase2 } from "./bossPhase2.timeline.ts";
import { bossPhase3 } from "./bossPhase3.timeline.ts";
import { endingKill } from "./endingKill.timeline.ts";
import { endingPacifist } from "./endingPacifist.timeline.ts";
import { credits } from "./credits.timeline.ts";

export { BARK_LINES, barkFor } from "./barks.ts";
export { chatterFor, fightChatter, noFireChatter } from "./chatter.ts";
export { FLAGS, INITIAL_FLAGS, runFlagsAfter } from "./flags.ts";
export { spokenLines } from "./cues.ts";

/** In play order. Ids match `?skipto=` targets where one exists. */
export const TIMELINES: readonly Timeline[] = [
  boot,
  tutorial,
  tutorialSkip,
  sector1,
  sector2,
  sector3,
  sector4,
  sector5,
  flashback,
  wardenDescent,
  bossPhase2,
  bossPhase3,
  endingKill,
  endingPacifist,
  credits,
];

export function timelineById(timelineId: string): Timeline | undefined {
  return TIMELINES.find((timeline) => timeline.id === timelineId);
}

/**
 * The scene a sim event starts, or `null`. Boot, tutorial, tutorial skip and
 * credits are started by the front end instead (menu choices, not events).
 */
export function timelineForEvent(event: SimEvent): Timeline | null {
  switch (event.type) {
    case "sectorStarted":
      return event.sector <= 5
        ? timelineById(`sector${event.sector}`) ?? null
        : null;
    case "pickup":
      return event.firstPowerup ? flashback : null;
    case "bossWarning":
      return wardenDescent;
    case "bossPhase":
      return event.phase === 2
        ? bossPhase2
        : event.phase === 3
        ? bossPhase3
        : null;
    case "bossDefeated":
      return endingKill;
    case "bossSurvived":
      return endingPacifist;
    default:
      return null;
  }
}
