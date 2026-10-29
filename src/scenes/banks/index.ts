/**
 * The variant and commentary bank registry. See `types.ts` for the format
 * and the shuffle-bag rule; the Director's commentary scheduler deals from
 * `ALL_BANKS`.
 */

import type { Bank, BankVariant } from "./types.ts";
import { shipFine } from "./shipFine.ts";
import { tutorialLockout, tutorialOtherLeft } from "./onboarding.ts";
import {
  disarm,
  graze,
  kill,
  pause,
  pickup,
  resume,
  sectorClear,
  sectorStart,
} from "./events.ts";
import {
  wardenPacifist,
  wardenPhase1,
  wardenPhase2,
  wardenPhase3,
} from "./warden.ts";
import {
  accuracyDrop,
  disarmRatioHigh,
  disarmRatioLow,
  grazeStreak,
  hotStreak,
  intoTheMist,
  longIdle,
  perfectSector,
  repeatedDeaths,
  scoutStats,
  wardenStats,
  writHoarding,
} from "./stats.ts";

export type * from "./types.ts";
export { STATS_MOMENTS } from "./types.ts";

export const ALL_BANKS: readonly Bank[] = [
  shipFine,
  tutorialLockout,
  tutorialOtherLeft,
  kill,
  disarm,
  graze,
  pickup,
  sectorStart,
  sectorClear,
  pause,
  resume,
  wardenPhase1,
  wardenPhase2,
  wardenPhase3,
  wardenPacifist,
  accuracyDrop,
  intoTheMist,
  hotStreak,
  perfectSector,
  grazeStreak,
  disarmRatioHigh,
  disarmRatioLow,
  repeatedDeaths,
  longIdle,
  writHoarding,
  wardenStats,
  scoutStats,
];

/** Every variant of every bank, flattened, for tests and tooling. */
export function allVariants(): readonly (BankVariant & { bank: Bank })[] {
  return ALL_BANKS.flatMap((bank) =>
    bank.variants.map((variant) => ({ ...variant, bank }))
  );
}
