/**
 * Tutorial progress: turns what the player's weapon and ship do (sim
 * events) into the `tut.*` flags the tutorial timeline waits on.
 *
 * The practice-target drill listens for the sim's `practiceTarget` event,
 * not for `kill`: any way the player removes the hologram counts (a kill, a
 * ram, a Writ, or a disarm that sends it flying off screen, which is the
 * trick shot that once stalled Adam's first playtest). If the hologram
 * escapes on its own, the sim re-issues it and the tutorial says so.
 *
 * Pure: flags and lines go out through ports, so tests drive it with a sim
 * and no browser.
 */

import { type LineId, lineId, type SimEvent } from "../contracts/index.ts";
import { FLAGS } from "../scenes/flags.ts";

export interface TutorialProgressPorts {
  setFlag(name: string): void;
  getFlag(name: string): boolean;
  /** Speak inside the waiting tutorial scene (`Director.interject`). */
  interject(line: LineId): boolean;
  /** A fresh "target re-issued" line from a bank, if one exists. */
  escapedLine?(): LineId | null;
}

/** Taps the trigger drill asks for. */
export const TUTORIAL_TAPS = 3;
/** Grazes the clearance drill asks for. */
export const TUTORIAL_GRAZES = 5;
/** Said when the target escapes and no bank line is available. */
export const ESCAPED_FALLBACK: LineId = lineId("tut_target_001");

export class TutorialProgress {
  private taps = 0;
  private grazes = 0;

  constructor(private readonly ports: TutorialProgressPorts) {}

  reset(): void {
    this.taps = 0;
    this.grazes = 0;
  }

  note(event: SimEvent): void {
    const set = (flag: string) => this.ports.setFlag(flag);
    switch (event.type) {
      case "playerFired":
        set(FLAGS.tutFired);
        if (event.shot === "aimed" && ++this.taps >= TUTORIAL_TAPS) {
          set(FLAGS.tutTapped);
        }
        if (event.shot === "stream") set(FLAGS.tutStreamed);
        if (event.shot === "writ") set(FLAGS.tutWritFired);
        break;
      case "chargeLevel":
        if (event.level === 3) set(FLAGS.tutCharged);
        break;
      case "scanLock":
        set(FLAGS.tutLocked);
        break;
      case "partBreak":
        set(FLAGS.tutPartBroken);
        break;
      case "graze":
        if (
          this.ports.getFlag(FLAGS.tutGrazeDrill) &&
          ++this.grazes >= TUTORIAL_GRAZES
        ) set(FLAGS.tutGrazed);
        break;
      case "payChanged":
        if (event.rate >= 2) set(FLAGS.tutRateDoubled);
        break;
      case "practiceTarget":
        if (event.result === "escaped") {
          if (event.respawned !== null) {
            this.ports.interject(
              this.ports.escapedLine?.() ?? ESCAPED_FALLBACK,
            );
          }
        } else {
          set(FLAGS.tutTargetDestroyed);
        }
        break;
    }
  }
}
