/**
 * Ambient comms chatter during sectors 1–5. The shape matches the Director's
 * `ChatterBank` (src/director/ambient.ts) structurally, so the Director can
 * use these directly; it holds chatter during scripted scenes and ducks
 * music under it.
 *
 * Which bank plays depends on the run: a player who has not fired hears the
 * assistant grow uneasy about it, which is the game's quiet hint that the
 * pacifist route exists.
 */

import type { LineId } from "../contracts/index.ts";
import { id, type ScriptKey } from "../i18n/index.ts";

export interface ChatterBankData {
  readonly id: string;
  readonly lines: readonly LineId[];
  readonly firstAtMs: number;
  readonly intervalMs: readonly [number, number];
}

const ids = (...keys: ScriptKey[]): readonly LineId[] =>
  keys.map((key) => id(key));

/** The default run: praise, payroll and policy. */
export const fightChatter: ChatterBankData = {
  id: "chatter.fight",
  lines: ids(
    "amb_fight_001",
    "amb_fight_003",
    "amb_fight_004",
    "amb_fight_005",
  ),
  firstAtMs: 20000,
  intervalMs: [25000, 40000],
};

/** The player has not fired yet: concern, escalating politely. */
export const noFireChatter: ChatterBankData = {
  id: "chatter.nofire",
  lines: ids(
    "amb_nofire_001",
    "amb_nofire_002",
    "amb_nofire_003",
    "amb_nofire_004",
  ),
  firstAtMs: 12000,
  intervalMs: [20000, 30000],
};

/** The bank for the current run state (`run.hasFired`). */
export function chatterFor(hasFired: boolean): ChatterBankData {
  return hasFired ? fightChatter : noFireChatter;
}
