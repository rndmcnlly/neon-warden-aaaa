/**
 * Boot: studio and incubator logos after the press-any-key gate. No voice:
 * the logos carry the music cue alone. The UI draws the logos and reads the
 * flags; holding confirm skips this timeline (the Director jumps to its end).
 */

import type { Timeline } from "../contracts/index.ts";
import { music, pause, setFlag } from "./cues.ts";

/** Shared with the passive logo view; the Director remains the clock owner. */
export const BOOT_LOGO_HOLD_MS = 3200;

export const boot: Timeline = {
  id: "boot",
  cues: [
    music("logos"),
    setFlag("boot.studioLogo"),
    pause(BOOT_LOGO_HOLD_MS),
    setFlag("boot.studioLogo", false),
    setFlag("boot.publisherLogo"),
    pause(BOOT_LOGO_HOLD_MS),
    setFlag("boot.publisherLogo", false),
    music("silence", 1500),
    setFlag("boot.logosDone"),
  ],
};
