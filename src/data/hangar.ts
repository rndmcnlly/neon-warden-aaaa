/**
 * Hangar data the UI owns: cosmetic swatches, the walled content beyond the
 * slice, the mastery track, the campaign map and the codex index. Package
 * stats are NOT here: they live in `contracts/loadout.ts`, read by the sim
 * and shown by the hangar, so tuning has one source of truth.
 *
 * Teaching note: an 80-hour game is mostly a 2-hour game plus data like
 * this. The walls are listed honestly ("not included in this vertical
 * slice") rather than hidden, so the slice shows its intended scope.
 */

import type {
  DecalId,
  HelmetLiveryId,
  PaintId,
  TrailId,
} from "../contracts/index.ts";

/** Paint ids to display swatches (and the color the renderer receives). */
export const PAINTS: Readonly<Record<PaintId, string>> = {
  authorityWhite: "#e9eef5",
  contractorGrey: "#7d8794",
  matteBlack: "#1d1e26",
  rustRed: "#8f3b2e",
  laneBlue: "#2d5fa8",
};

/** Trim emissive colors offered, keyed by their name id. */
export const TRIMS = {
  cyan: "#35e0ff",
  pink: "#ff5ea8",
  violet: "#9d7bff",
  gold: "#ffe066",
  red: "#ff4d6d",
  white: "#f2f7ff",
} as const;
export type TrimName = keyof typeof TRIMS;

export const DECALS: readonly DecalId[] = [
  "none",
  "authorityNumber",
  "tallyMarks",
  "wardenCrest",
  "payGrade",
];
export const TRAILS: readonly TrailId[] = ["standard", "ion", "ember", "ghost"];
export const HELMETS: readonly HelmetLiveryId[] = [
  "corporateIssue",
  "worn",
  "repainted",
];

/** Slots and options that exist in the full game, walled in this slice. */
export const WALLED_SLOTS = [
  "utility",
  "reactor",
  "droneBay",
  "hullPlating",
  "secondSensor",
] as const;

/** Mastery: 50 ranks; the slice can reach the first three. */
export const MASTERY_RANKS = 50;
export const MASTERY_IN_SLICE = 3;
/** Career pay needed for `rank` (rank 1 is free). */
export function payForRank(rank: number): number {
  return rank <= 1 ? 0 : Math.round(1500 * Math.pow(rank - 1, 1.5));
}
export function rankForPay(pay: number): number {
  let rank = 1;
  while (rank < MASTERY_RANKS && pay >= payForRank(rank + 1)) rank++;
  return rank;
}
/** What each rank would grant, cycling through kinds (text ids by kind). */
export const RANK_REWARDS = [
  "paint",
  "decal",
  "trail",
  "package",
  "slot",
  "codex",
] as const;

/** The campaign: eight chapters of five sectors; chapter 1 is this slice. */
export const CHAPTERS = 8;
export const SECTORS_PER_CHAPTER = 5;

/**
 * Codex entries and how each is earned. Ids match G's `intel.codexId` and
 * N's `CODEX_ENTRIES`; text ids are `<id>.title` and `<id>.body`.
 */
export const CODEX_INDEX: readonly {
  readonly id: string;
  /** How to unlock, as a UI text id. */
  readonly hint: string;
}[] = [
  { id: "codex.enemy.drone", hint: "ui.codex.hint.drone" },
  { id: "codex.enemy.dart", hint: "ui.codex.hint.dart" },
  { id: "codex.enemy.turret", hint: "ui.codex.hint.turret" },
  { id: "codex.enemy.lancer", hint: "ui.codex.hint.lancer" },
  { id: "codex.warden", hint: "ui.codex.hint.warden" },
  { id: "codex.warden.core", hint: "ui.codex.hint.wardenCore" },
  { id: "codex.recorder.0121", hint: "ui.codex.hint.recorder" },
];

/** Codex shelves beyond the slice, listed and walled. */
export const WALLED_CODEX = [
  "factions",
  "pilots",
  "lanes",
  "authority",
] as const;
