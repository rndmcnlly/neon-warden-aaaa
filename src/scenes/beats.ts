/**
 * First-time beats during play: tiny timelines that mark a new system the
 * first time the Pilot uses it in a real sector. Each is one comms line, at
 * most one radio line, and no camera or music change, so they can interrupt
 * nothing important. Started by `timelineForEvent` on the event's `first`.
 *
 * The assistant reacts to what pays (locks, grazes) with delight and to what
 * spares (disarms) with kindness that is a little too careful. Lane Control
 * logs both in the same voice.
 */

import type { Timeline } from "../contracts/index.ts";
import { pause, radio, say } from "./cues.ts";

/** First live scan lock: intel and the codex. */
export const firstLock: Timeline = {
  id: "beat-first-lock",
  cues: [
    ...say("lock_ai_001"),
    pause(600),
    radio("rad_auth_locked_001", "authority"),
  ],
};

/** First disarmed scout: forty percent, and a scout that lives. */
export const firstDisarm: Timeline = {
  id: "beat-first-disarm",
  cues: [
    pause(900),
    ...say("disarm_ai_001"),
    pause(500),
    radio("rad_auth_disarmed_001", "authority"),
  ],
};

/** First graze: near misses are billable. */
export const firstGraze: Timeline = {
  id: "beat-first-graze",
  cues: [...say("graze_ai_001")],
};

/** The first Warden pod breaks. Any route that can reach it hears it. */
export const wardenPod: Timeline = {
  id: "beat-warden-pod",
  cues: [...say("boss_pod_001")],
};
