/**
 * Boot: studio and incubator logos after the press-any-key gate. No voice:
 * the logos carry the music cue alone. The UI draws the logos and reads the
 * flags; holding confirm skips this timeline (the Director jumps to its end).
 */

import type { Timeline } from "../contracts/index.ts";
import { music, pause, setFlag } from "./cues.ts";

export const boot: Timeline = {
  id: "boot",
  cues: [
    music("logos"),
    setFlag("boot.studioLogo"),
    pause(3200),
    setFlag("boot.studioLogo", false),
    setFlag("boot.publisherLogo"),
    pause(3200),
    setFlag("boot.publisherLogo", false),
    music("silence", 1500),
    setFlag("boot.logosDone"),
  ],
};
