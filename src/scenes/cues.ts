/**
 * Authoring helpers for timelines, so a scene reads like a script:
 *
 *   cues: [
 *     music("tutorial"),
 *     ...say("tut_move_000"),
 *     waitFlag(FLAGS.tutMovedLeft, { nudge: "tut_idle_001" }),
 *   ]
 *
 * `say()` takes a literal script id, so a typo is a compile error. It starts
 * the line and then waits until the line ends, which means pacing comes from
 * the rendered audio: rewrite a line, re-render it, and the scene re-times
 * itself. Fixed `pause()`s are only for breaths and drama between lines.
 */

import type {
  CameraShotId,
  Cue,
  FlagName,
  LineId,
  MusicCueId,
} from "../contracts/index.ts";
import { sfxRole } from "../contracts/index.ts";
import { id, type ScriptKey } from "../i18n/index.ts";

/** Speak a line and wait for it to finish. Spread it: `...say("id")`. */
export function say(key: ScriptKey): readonly Cue[] {
  return [{ type: "say", line: id(key) }, { type: "wait", until: "lineEnds" }];
}

/** Several lines in a row, each waiting for the last. */
export function sayAll(...keys: ScriptKey[]): readonly Cue[] {
  return keys.flatMap((key) => say(key));
}

/** A fixed beat of silence, in milliseconds. */
export function pause(ms: number): Cue {
  return { type: "wait", ms };
}

export function music(cue: MusicCueId, fadeMs?: number): Cue {
  return fadeMs === undefined
    ? { type: "music", cue }
    : { type: "music", cue, fadeMs };
}

export function sfx(role: string): Cue {
  return { type: "sfx", role: sfxRole(role) };
}

export function camera(
  shot: CameraShotId,
  durationMs: number,
  ease: "linear" | "inOut" = "inOut",
): Cue {
  return { type: "camera", shot, durationMs, ease };
}

export function setFlag(flag: FlagName, value = true): Cue {
  return { type: "setFlag", flag, value };
}

/** Plays `then` if the flag is set, otherwise `otherwise`. */
export function branch(
  flag: FlagName,
  then: readonly Cue[],
  otherwise: readonly Cue[] = [],
): Cue {
  return { type: "branch", flag, then, else: otherwise };
}

export function freezeSim(): Cue {
  return { type: "freezeSim" };
}

export function resumeSim(): Cue {
  return { type: "resumeSim" };
}

/** Block until `flag` is `value` (default true); optionally nudge after a while. */
export function waitFlag(
  flag: FlagName,
  options: { value?: boolean; nudge?: ScriptKey; nudgeAfterMs?: number } = {},
): Cue {
  const { value = true, nudge, nudgeAfterMs = 15000 } = options;
  return nudge === undefined ? { type: "waitFlag", flag, value } : {
    type: "waitFlag",
    flag,
    value,
    nudge: { line: id(nudge), afterMs: nudgeAfterMs },
  };
}

/** Every line id a list of cues can speak, including inside branches. */
export function spokenLines(cues: readonly Cue[]): LineId[] {
  const found: LineId[] = [];
  for (const cue of cues) {
    if (cue.type === "say") found.push(cue.line);
    if (cue.type === "waitFlag" && cue.nudge) found.push(cue.nudge.line);
    if (cue.type === "branch") {
      found.push(...spokenLines(cue.then), ...spokenLines(cue.else ?? []));
    }
  }
  return found;
}
