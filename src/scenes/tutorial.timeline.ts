/**
 * Tutorial: Lane Authority onboarding. Properly built (every step waits for
 * the player to actually do the thing), knowingly overlong (it explains
 * everything, then reviews it), with exactly one wink (`tut_wink_001`).
 * Wave 3 adds the core loop (tap, hold, rest-to-charge Writ, scanning and
 * locks, parts and disarming, graze, Contract Rate, the hangar), each step
 * gated on the player doing it, in dependency order. It
 * ends with the threat briefing reel, where the narrator builds up the
 * Warden's terror so the Warden can deflate it later.
 *
 * Skipping is handled by `tutorialSkip.timeline.ts`, at most three clicks
 * from anywhere in this scene.
 */

import type { Timeline } from "../contracts/index.ts";
import { FLAGS } from "./flags.ts";
import {
  camera,
  music,
  pause,
  say,
  sayAll,
  setFlag,
  waitFlag,
} from "./cues.ts";

const nudge = { nudge: "tut_idle_001" } as const;

export const tutorial: Timeline = {
  id: "tutorial",
  cues: [
    music("tutorial", 2000),
    camera("gameplay", 0),
    ...sayAll("tut_hello_001", "tut_contract_001"),

    // Module 1: movement.
    ...say("tut_move_000"),
    waitFlag(FLAGS.tutMovedLeft, nudge),
    ...say("tut_move_001"),
    waitFlag(FLAGS.tutMovedRight, nudge),
    ...say("tut_move_002"),
    waitFlag(FLAGS.tutMovedVertical, nudge),
    ...say("tut_hitbox_001"),

    // Module 2: focus.
    ...say("tut_focus_001"),
    waitFlag(FLAGS.tutFocused, nudge),

    // Module 3: firing.
    ...say("tut_fire_001"),
    waitFlag(FLAGS.tutFired, nudge),
    ...sayAll("tut_fire_002", "tut_autofire_001"),
    setFlag(FLAGS.tutSpawnTarget),
    ...say("tut_target_001"),
    waitFlag(FLAGS.tutTargetDestroyed, nudge),
    setFlag(FLAGS.tutSpawnTarget, false),
    ...say("tut_target_002"),

    // Module 4: trigger discipline. Tap, hold, and the rule that ties them.
    ...say("tut_tap_001"),
    waitFlag(FLAGS.tutTapped, nudge),
    ...say("tut_stream_001"),
    waitFlag(FLAGS.tutStreamed, nudge),
    ...say("tut_rule_001"),

    // Module 5: rest, scan, lock, Writ. Resting charges the gun and sweeps
    // the beam, so the lock and the Writ are taught on one hologram.
    ...say("tut_rest_001"),
    waitFlag(FLAGS.tutCharged, nudge),
    setFlag(FLAGS.tutSpawnTarget),
    ...say("tut_scan_001"),
    waitFlag(FLAGS.tutLocked, nudge),
    ...say("tut_intel_001"),
    ...say("tut_writ_001"),
    waitFlag(FLAGS.tutWritFired, nudge),
    setFlag(FLAGS.tutSpawnTarget, false),

    // Module 6: parts and disarming.
    setFlag(FLAGS.tutSpawnTurret),
    ...say("tut_parts_001"),
    waitFlag(FLAGS.tutPartBroken, nudge),
    // Off at once: the disarmed turret flies away under the next line, and
    // the sim would otherwise issue a fresh one (see Sim.practiceTurretLost).
    setFlag(FLAGS.tutSpawnTurret, false),
    ...say("tut_disarm_001"),

    // Module 7: clearance (graze).
    setFlag(FLAGS.tutGrazeDrill),
    ...say("tut_graze_001"),
    waitFlag(FLAGS.tutGrazed, nudge),
    setFlag(FLAGS.tutGrazeDrill, false),
    ...say("tut_graze_002"),

    // Module 8: the Contract Rate, which everything above feeds.
    // A real chance to earn it now, not a stale achievement from an earlier
    // drill. The target re-issues until the gate ends, as in the scan lesson.
    setFlag(FLAGS.tutSpawnTarget),
    ...say("tut_rate_001"),
    waitFlag(FLAGS.tutRateDoubled, nudge),
    setFlag(FLAGS.tutSpawnTarget, false),
    ...say("tut_ratebreak_001"),

    // Module 9: survival, salvage, the hangar, and the review nobody asked for.
    ...sayAll("tut_lives_001", "tut_continue_001", "tut_pickup_001"),
    ...say("tut_hangar_001"),
    pause(700),
    ...say("tut_wink_001"),
    pause(500),
    ...say("tut_review_001"),
    ...say("tut_review_002"),

    // Module 10: the route, and the Warden build-up.
    ...say("tut_route_001"),
    pause(900),
    ...say("tut_warden_001"),
    music("silence", 800),
    setFlag(FLAGS.tutBriefingReel),
    pause(1200),
    ...say("brief_warden_001"),
    pause(700),
    ...say("brief_warden_002"),
    pause(900),
    ...say("brief_warden_003"),
    pause(700),
    ...say("brief_warden_004"),
    pause(700),
    ...say("brief_warden_005"),
    pause(500),
    ...say("brief_warden_006"),
    pause(1200),
    setFlag(FLAGS.tutBriefingReel, false),
    music("tutorial", 1000),
    ...sayAll("tut_warden_002", "tut_done_001"),
    setFlag(FLAGS.tutComplete),
  ],
};
