/**
 * The sector 3 salvage: #0121's derelict flight recorder, still running.
 * The flashback was its last approach; this is what it recorded after the
 * recall: the Warden towing the empty ship out of the crossfire and talking
 * to it for three hundred twelve days.
 *
 * If the Pilot reaches the recorder before any powerup, the flashback plays
 * first (it is the same recorder), then the coda. The coda does not freeze
 * the world: it plays over the Gun Lanes, shown in the radio box while
 * `recorder.playing` is set, so the player flies through it.
 */

import type { Timeline } from "../contracts/index.ts";
import { flashback } from "./flashback.timeline.ts";
import { FLAGS } from "./flags.ts";
import { pause, say, sayAll, setFlag } from "./cues.ts";

const coda = [
  ...say("rec_ai_001"),
  setFlag(FLAGS.recorderPlaying),
  pause(600),
  ...say("rec_log_001"),
  pause(400),
  ...sayAll("rec_log_002", "rec_log_003"),
  pause(900),
  ...say("rec_log_004"),
  pause(1200),
  setFlag(FLAGS.recorderPlaying, false),
  ...say("rec_ai_002"),
];

export const recorder: Timeline = {
  id: "recorder",
  // The flashback skips itself if it has already played.
  cues: [...flashback.cues, ...coda],
};
