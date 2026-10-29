/**
 * The feedback ladder: every moment of contact ranked, as data.
 *
 *   graze < hull hit < armor deflect < weak-point hit < part break < disarm
 *         < kill < pod break < life lost
 *
 * The rule a student can check by reading the table: each rung differs from
 * its neighbors in at least two of sound, shape and motion, never in color
 * alone (color-blind and grayscale players still read the ladder). Higher
 * rungs also win arguments: when a life is lost on the same tick as a kill,
 * the kill's feedback waits (see `deferredBy`).
 *
 * Renderers and the audio layer look up a rung with `rungOf` and then act
 * in their own terms; the hitstop policy (`hitstop.ts`) reads `hitstopTicks`.
 */

import type { SimEvent } from "../contracts/index.ts";

export type Rung =
  | "graze"
  | "hullHit"
  | "deflect"
  | "weakPointHit"
  | "partBreak"
  | "disarm"
  | "kill"
  | "podBreak"
  | "lifeLost";

export interface RungSpec {
  /** Position on the ladder, 0 at the bottom. */
  readonly rank: number;
  /** What it sounds like (role names live in `gameplaySounds.ts`). */
  readonly sound: string;
  /** What shape appears on screen. */
  readonly shape: string;
  /** How things move. */
  readonly motion: string;
  /** Sim ticks frozen (a tick-domain hitstop; 0 for most). */
  readonly hitstopTicks: number;
}

export const LADDER: Readonly<Record<Rung, RungSpec>> = {
  graze: {
    rank: 0,
    sound: "graze: a tiny crackle on the beat",
    shape: "sparks at the ship's rim",
    motion: "none on the target",
    hitstopTicks: 0,
  },
  hullHit: {
    rank: 1,
    sound: "hit_enemy: a light tick, stream hits capped and merged",
    shape: "a small chevron of sparks at the impact point",
    motion: "a tiny punch on the hull",
    hitstopTicks: 0,
  },
  deflect: {
    rank: 2,
    sound: "hit_deflect plus ricochet_tink: a bright metallic tink",
    shape: "two thin streaks reflected off the armor",
    motion: "the round glances away; the target does not flinch",
    hitstopTicks: 0,
  },
  weakPointHit: {
    rank: 3,
    sound: "tap_impact or writ_impact_N: a crisp crack, louder per tier",
    shape: "the struck part flashes (outline under reduced flashing)",
    motion: "the hull punches back along the shot",
    hitstopTicks: 0,
  },
  partBreak: {
    rank: 4,
    sound: "part_break: a metallic clank",
    shape: "the part detaches as a dark, tumbling body",
    motion: "flung along the shot, spun by the hit offset, sinks below bullets",
    hitstopTicks: 0,
  },
  disarm: {
    rank: 5,
    sound: "disarm_unlatch then power_down: mechanical, falling, no boom",
    shape: "no explosion; the hull's lights and ports go dark",
    motion: "the hull sags, sputters and drifts away",
    hitstopTicks: 2,
  },
  kill: {
    rank: 6,
    sound: "kill_small or kill_large: an explosion",
    shape: "a fireball and hull-colored burst",
    motion: "outward burst; the hull is gone",
    hitstopTicks: 0,
  },
  podBreak: {
    rank: 7,
    sound: "pod_break: a loud tearing boom, unique to the Warden",
    shape: "the pod tears free with its own debris and a gold ring",
    motion: "the pod is flung and spins away; a short world freeze",
    hitstopTicks: 5,
  },
  lifeLost: {
    rank: 8,
    sound: "life_lost: a glass-and-sub alarm that ducks everything",
    shape: "a red pulse around the screen edge",
    motion: "the longest freeze; other feedback waits until after",
    hitstopTicks: 7,
  },
};

/** Feedback deferred behind a higher rung waits this long, in seconds. */
export const DEFERRED_FEEDBACK_S = 0.35;

/** Big hulls get an explosion with a freeze; small ones just burst. */
const LARGE_KILL_TICKS = 3;

/** The rung an event sits on, or null when it is not contact feedback. */
export function rungOf(event: SimEvent): Rung | null {
  switch (event.type) {
    case "graze":
      return "graze";
    case "hit":
      if (event.target === "player") return null;
      if (event.blocked) return "deflect";
      // A round on a part, or any Writ, is precision: the weak-point rung.
      return event.part !== null || event.level > 0
        ? "weakPointHit"
        : "hullHit";
    case "partBreak":
      return event.target === "boss" ? "podBreak" : "partBreak";
    case "disarm":
      return "disarm";
    case "kill":
      return "kill";
    case "lifeLost":
      return "lifeLost";
    default:
      return null;
  }
}

/** Ticks of hitstop an event asks for (the ladder plus a few refinements). */
export function hitstopTicksFor(event: SimEvent): number {
  const rung = rungOf(event);
  if (rung === null) return 0;
  if (event.type === "kill") {
    // Only big hulls and clean (locked Writ) kills earn a freeze; a drone
    // popping in a dense wave would make the game stutter.
    const big = event.kind === "turret" || event.kind === "lancer";
    return big || event.clean ? LARGE_KILL_TICKS : 0;
  }
  return LADDER[rung].hitstopTicks;
}

/**
 * Events on a lower rung that must wait for a higher one on the same tick.
 * Today: a life lost holds back the same tick's kill (a ram kill otherwise
 * buries the player's own loss under an explosion).
 */
export function deferredBy(events: readonly SimEvent[]): boolean {
  return events.some((e) => e.type === "lifeLost");
}

/** True for feedback that waits when `deferredBy` holds. */
export function isDeferrable(event: SimEvent): boolean {
  return event.type === "kill";
}
