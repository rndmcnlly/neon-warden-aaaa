/**
 * Tutorial skip: runs after the player confirms twice in the UI (skip button,
 * then `ui.tut.skipConfirm2`). The assistant takes it gracefully and logs it.
 * The skip is real: three clicks, no penalty, no guilt beyond one sigh.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import { sayAll, setFlag } from "./cues.ts";

export const tutorialSkip: Timeline = {
  id: "tutorial-skip",
  cues: [
    ...sayAll("tut_skip_001", "tut_skip_002"),
    setFlag(FLAGS.tutSkipped),
    setFlag(FLAGS.tutComplete),
  ],
};
