/**
 * Radio chatter: the Warden's scouts talking among themselves and Lane
 * Control's traffic, overheard. It is the slice's main lore leak, so it is
 * written to be skimmed: short lines, shown in the radio box (not as
 * subtitles), voiced only where a voice earns its place. Voiced lines are
 * `rad_*` in `vo/script.yaml` and play at the speaker's position; text-only
 * lines are `radio.*` in `src/i18n/radio.ts`.
 *
 * The bank is keyed by source and situation. The Director asks on events:
 *
 *   scanLock (enemy)  -> radioFor(kind, "locked", ...)
 *   disarm            -> radioFor(kind, "disarmed", ...), then Lane Control
 *   enemy leaves      -> radioFor(kind, "retreat", ...)
 *   kill nearby       -> radioFor(kind, "lost", ...)    (only kills say lost)
 *   patrol timer      -> radioFor(kind or "authority", "patrol", ...)
 */

import type { EnemyKind, LineId, RadioChannel } from "../contracts/index.ts";
import { id, type RadioKey, type ScriptKey } from "../i18n/index.ts";

export type RadioSource = EnemyKind | "authority";
export type RadioSituation =
  | "patrol"
  | "locked"
  | "disarmed"
  | "retreat"
  | "lost";

export interface RadioLine {
  readonly line: LineId;
  readonly channel: RadioChannel;
  /** True for a VO line (`rad_*`), false for text only (`radio.*`). */
  readonly voiced: boolean;
  /** Only on a run where the Pilot has (or has not) fired yet. */
  readonly requires?: "hasFired" | "neverFired";
}

export interface RadioRunState {
  readonly hasFired: boolean;
}

type Entry = ScriptKey | RadioKey | readonly [ScriptKey, "neverFired"];

function bank(
  channel: RadioChannel,
  entries: readonly Entry[],
): readonly RadioLine[] {
  return entries.map((entry) => {
    const [key, requires] = typeof entry === "string"
      ? [entry, undefined]
      : entry;
    return {
      line: id(key),
      channel,
      voiced: !key.startsWith("radio."),
      ...(requires ? { requires } : {}),
    };
  });
}

const scout = (...entries: Entry[]) => bank("scout", entries);
const control = (...entries: Entry[]) => bank("authority", entries);

export const RADIO_BANK: Readonly<
  Record<RadioSource, Partial<Record<RadioSituation, readonly RadioLine[]>>>
> = {
  drone: {
    patrol: scout(
      "rad_drone_patrol_001",
      ["rad_drone_patrol_002", "neverFired"],
      "radio.drone.patrol.1",
      "radio.drone.patrol.2",
      "radio.drone.patrol.3",
    ),
    locked: scout(
      "rad_drone_locked_001",
      "radio.drone.locked.1",
      "radio.drone.locked.2",
    ),
    disarmed: scout(
      "rad_drone_disarmed_001",
      "radio.drone.disarmed.1",
      "radio.drone.disarmed.2",
    ),
    retreat: scout("rad_drone_retreat_001", "radio.drone.retreat.1"),
    lost: scout(
      "rad_drone_lost_001",
      "radio.drone.lost.1",
      "radio.drone.lost.2",
    ),
  },
  dart: {
    patrol: scout(
      "rad_dart_patrol_001",
      "radio.dart.patrol.1",
      "radio.dart.patrol.2",
    ),
    locked: scout("rad_dart_locked_001", "radio.dart.locked.1"),
    disarmed: scout("radio.dart.disarmed.1"),
    retreat: scout("radio.dart.retreat.1"),
    lost: scout("rad_dart_lost_001", "radio.dart.lost.1"),
  },
  turret: {
    patrol: scout(
      "rad_turret_patrol_001",
      "rad_turret_patrol_002",
      "radio.turret.patrol.1",
      "radio.turret.patrol.2",
    ),
    locked: scout("rad_turret_locked_001", "radio.turret.locked.1"),
    disarmed: scout("rad_turret_disarmed_001", "radio.turret.disarmed.1"),
    retreat: scout("radio.turret.retreat.1"),
    lost: scout("radio.turret.lost.1"),
  },
  lancer: {
    patrol: scout(
      "rad_lancer_patrol_001",
      "radio.lancer.patrol.1",
      "radio.lancer.patrol.2",
    ),
    locked: scout("rad_lancer_locked_001"),
    disarmed: scout("rad_lancer_disarmed_001", "radio.lancer.disarmed.1"),
    retreat: scout("radio.lancer.retreat.1"),
    lost: scout("rad_lancer_lost_001"),
  },
  authority: {
    patrol: control(
      "rad_auth_patrol_001",
      "rad_auth_patrol_002",
      "radio.authority.patrol.1",
      "radio.authority.patrol.2",
      "radio.authority.patrol.3",
      "radio.authority.patrol.4",
    ),
    locked: control("rad_auth_locked_001", "radio.authority.locked.1"),
    disarmed: control("rad_auth_disarmed_001", "radio.authority.disarmed.1"),
    retreat: control("radio.authority.retreat.1"),
    lost: control("rad_auth_lost_001", "radio.authority.lost.1"),
  },
};

/** Lines a run in this state may hear for a source and situation. */
export function radioLines(
  source: RadioSource,
  situation: RadioSituation,
  run: RadioRunState,
): readonly RadioLine[] {
  return (RADIO_BANK[source][situation] ?? []).filter((line) =>
    line.requires === undefined ||
    (line.requires === "hasFired") === run.hasFired
  );
}

/**
 * One line for the moment, or `null`. `pick` is any integer (the Director's
 * deck or a seeded draw); it wraps, so a counter works.
 */
export function radioFor(
  source: RadioSource,
  situation: RadioSituation,
  pick: number,
  run: RadioRunState,
): RadioLine | null {
  const lines = radioLines(source, situation, run);
  if (lines.length === 0) return null;
  return lines[((pick % lines.length) + lines.length) % lines.length];
}

/** Every line the bank holds, for tests. */
export const RADIO_LINES: readonly LineId[] = Object.values(RADIO_BANK)
  .flatMap((situations) => Object.values(situations))
  .flatMap((lines) => (lines ?? []).map((line) => line.line));
