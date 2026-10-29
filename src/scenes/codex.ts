/**
 * The codex: what each entry is and what unlocks it. Text lives in
 * `src/i18n/codex.ts`; the UI renders the list and remembers unlocks.
 *
 * Scan intel is the main key: locking a kind of target files its entry, so
 * a Pilot who scans before shooting learns, entry by entry, what the
 * Authority's files leave out. Contract paperwork (the Authority, the lanes,
 * the Writ, issued packages) is unlocked from the start.
 */

import type { FlagName, LineId, SimEvent } from "../contracts/index.ts";
import { type CodexKey, id } from "../i18n/index.ts";
import { FLAGS } from "./flags.ts";

export type CodexUnlock =
  | "start"
  /** The sim's `intel` event `codexId` (scan locks, the recorder). */
  | { readonly intel: string }
  | { readonly flag: FlagName };

export interface CodexEntry {
  readonly id: string;
  readonly title: LineId;
  readonly body: LineId;
  readonly unlock: CodexUnlock;
  /** False: listed, locked, as content beyond the vertical slice. */
  readonly inSlice: boolean;
}

function entry(
  key: string,
  unlock: CodexUnlock,
  inSlice = true,
): CodexEntry {
  return {
    id: key,
    title: id(`codex.${key}.title` as CodexKey),
    body: id(`codex.${key}.body` as CodexKey),
    unlock,
    inSlice,
  };
}

/** In codex display order. */
export const CODEX_ENTRIES: readonly CodexEntry[] = [
  entry("authority", "start"),
  entry("lanes", "start"),
  entry("pilots", "start"),
  entry("writ", "start"),
  entry("drone", { intel: "codex.enemy.drone" }),
  entry("dart", { intel: "codex.enemy.dart" }),
  entry("turret", { intel: "codex.enemy.turret" }),
  entry("lancer", { intel: "codex.enemy.lancer" }),
  entry("warden", { intel: "codex.warden" }),
  entry("wardencore", { intel: "codex.warden.core" }),
  entry("pilot0121", { flag: FLAGS.hudSerialRevealed }),
  entry("recorder", { intel: "codex.recorder.0121" }),
  // Glimpses of the larger game, unlocked by the scouts that know them.
  entry("haulers", { intel: "codex.enemy.dart" }),
  entry("commons", { intel: "codex.enemy.lancer" }),
  entry("weapon.standard", "start"),
  entry("weapon.magistrate", "start"),
  entry("weapon.courier", "start"),
  entry("weapon.notary", "start"),
  entry("weapon.injunction", "start", false),
  entry("sensor.standard", "start"),
  entry("sensor.surveyor", "start"),
  entry("sensor.auditor", "start"),
  entry("sensor.archivist", "start", false),
  entry("sensor.witness", "start", false),
];

/**
 * Entries an event unlocks: the sim's `intel` event, from a scan lock or
 * the recorder, names a `codexId`; one id can open more than one entry.
 */
export function codexUnlockedBy(event: SimEvent): readonly CodexEntry[] {
  if (event.type !== "intel") return [];
  return CODEX_ENTRIES.filter((e) =>
    typeof e.unlock === "object" && "intel" in e.unlock &&
    e.unlock.intel === event.codexId
  );
}

/** Entries a story flag unlocks when it turns true. */
export function codexUnlockedByFlag(flag: FlagName): readonly CodexEntry[] {
  return CODEX_ENTRIES.filter((e) =>
    typeof e.unlock === "object" && "flag" in e.unlock && e.unlock.flag === flag
  );
}
