/**
 * Variant banks: the data format for lines that fire many times per run and
 * must almost never repeat verbatim (wave 4, from Adam's first playtest).
 *
 * A bank is one comic "moment" (the Pilot got hit; the Pilot has been
 * shooting at nothing) with a pool of interchangeable variants. The Director
 * owns *when* (agent P's commentary scheduler in `src/director/`); a bank
 * owns *what*, plus the hints the scheduler needs: trigger, conditions,
 * speaker, cooldown and priority.
 *
 * Selection is a shuffle bag per bank: deal every variant once, in random
 * order, before any repeats, and never deal the last variant of one bag as
 * the first of the next. With a 16-variant pool and a cooldown, a player
 * hears each line about once a run, which is the point: players should
 * wonder how much VO the game has.
 *
 * Voiced vs text-only. `vo: true` variants are also lines in
 * `vo/script.yaml` (ids `var_*` for event banks, `stat_*` for stats
 * commentary) with the same text, so agent T can render them; the Director
 * plays them like any VO line. `vo: false` variants are text only (ids
 * `bank.<bank>.<n>`, dotted like radio text so tooling never looks for
 * audio) and show as a subtitle with a comms blip. Promoting a variant to
 * voiced means giving it a `var_`/`stat_` id and running
 * `deno run --allow-read --allow-write src/scenes/banks/emit_yaml.ts`.
 *
 * Banks import nothing from `src/i18n/`: they are pure data, and i18n
 * imports them (`src/i18n/banks.ts`) so `t()` resolves the text-only ids.
 */

import type {
  BossPhase,
  EnemyKind,
  PickupKind,
  SectorIndex,
  SimEventType,
  Speaker,
} from "../../contracts/index.ts";

/**
 * Derived moments the commentary scheduler computes from run statistics
 * (not single sim events). Suggested thresholds are in `STATS_MOMENTS`.
 */
export type StatsMoment =
  | "accuracyDrop"
  | "intoTheMist"
  | "hotStreak"
  | "perfectSector"
  | "grazeStreak"
  | "disarmRatioHigh"
  | "disarmRatioLow"
  | "repeatedDeaths"
  | "longIdle"
  | "writHoarding"
  | "bossLull";

/** App moments outside the sim. */
export type AppMoment = "pause" | "resume";

export type BankTrigger =
  /** A sim event; `where` narrows it (all fields must match). */
  | {
    readonly on: "event";
    readonly type: SimEventType;
    readonly where?: EventFilter;
  }
  /** A derived stats moment (see `STATS_MOMENTS`). */
  | { readonly on: "stats"; readonly moment: StatsMoment }
  /** The pause menu opening or closing. */
  | { readonly on: "app"; readonly moment: AppMoment };

/** Field matches against the triggering event; absent means "any". */
export interface EventFilter {
  /** `hit`: who was hit. */
  readonly target?: "player" | "enemy" | "boss";
  /** `hit`: the shield took it (a shield break when it was the last). */
  readonly absorbedByShield?: boolean;
  /** `pickup`. */
  readonly pickup?: PickupKind;
  /** `kill`, `disarm`. */
  readonly enemy?: EnemyKind;
  /** `kill`: a ram kill. */
  readonly byRam?: boolean;
  /**
   * `graze`, `disarm`, `partBreak`: the run's first (usually scripted);
   * `pickup`: `firstPowerup` (the flashback trigger).
   */
  readonly first?: boolean;
}

/** Run state a bank needs before it may play. All present fields must hold. */
export interface BankConditions {
  /** `hasFired`: the Pilot has fired this run; `neverFired`: never. */
  readonly run?: "hasFired" | "neverFired";
  /** Only in these sectors (6 is the Warden). */
  readonly sectors?: readonly SectorIndex[];
  /** Only during these boss phases. */
  readonly bossPhases?: readonly BossPhase[];
  /** Lives left, inclusive bounds (near death is `{ max: 1 }`). */
  readonly livesLeft?: { readonly min?: number; readonly max?: number };
  /** Probability of speaking when triggered and off cooldown (default 1). */
  readonly chance?: number;
  /** Max plays per run (default unlimited). */
  readonly maxPerRun?: number;
}

/** One interchangeable line. */
export interface BankVariant {
  /** `var_*`/`stat_*` when voiced (a `vo/script.yaml` id), else `bank.*`. */
  readonly id: string;
  /** True if this variant is a VO line; false for text only. */
  readonly vo: boolean;
  readonly en: string;
  /** Latin American Spanish, tú to the Pilot. */
  readonly es: string;
  /** Simplified Chinese. */
  readonly zh: string;
  /** Acting note, copied to `direction` in the script for voiced lines. */
  readonly direction?: string;
  /** Only when the triggering moment matches this sub-case. */
  readonly when?: VariantWhen;
}

/**
 * Sub-cases inside one bank, so one pool can cover "hit", "shield gone",
 * "one life left" and "back in a new hull" without four tiny pools that
 * repeat. Absent means the variant fits every trigger of its bank.
 */
export type VariantWhen =
  | "hit"
  | "shieldBreak"
  | "nearDeath"
  | "respawn"
  | "ram"
  | "spread"
  | "shield"
  /** In a bank with several stats triggers, the moment this line answers. */
  | StatsMoment;

export interface Bank {
  /** Stable id, `bank.<name>` style without the prefix: `shipFine`. */
  readonly id: string;
  /** What this moment is, for the scheduler author and students. */
  readonly note: string;
  readonly triggers: readonly BankTrigger[];
  readonly conditions?: BankConditions;
  readonly speaker: Speaker;
  /** Minimum gap between two lines from this bank, in ms. */
  readonly cooldownMs: number;
  /**
   * Higher wins when two banks want the same slot (0–100). Scripted
   * timelines always win over every bank; banks sit on the ambient layer.
   * Rough scale: 80 safety (ship hit), 60 event reactions, 40 stats, 20 idle.
   */
  readonly priority: number;
  readonly variants: readonly BankVariant[];
}

/**
 * How the scheduler might detect each stats moment. Thresholds are
 * suggestions from writing; agent P tunes them against play. Every stats
 * bank also has a long cooldown, so commentary stays a seasoning.
 */
export const STATS_MOMENTS: Readonly<
  Record<StatsMoment, { readonly detect: string }>
> = {
  accuracyDrop: {
    detect:
      "Rolling accuracy over the last 40 shots falls below 25% and below the run average by 15 points.",
  },
  intoTheMist: {
    detect:
      "12+ consecutive shots that leave the top of the screen with no target in their column.",
  },
  hotStreak: {
    detect: "6+ kills or disarms in 8 s with no damage taken.",
  },
  perfectSector: {
    detect: "sectorCleared with no hits taken in that sector.",
  },
  grazeStreak: {
    detect: "5+ grazes within 4 s (the graze meter's combo).",
  },
  disarmRatioHigh: {
    detect:
      "After 8+ resolved enemies in a run, disarms are 60%+ of disarms plus kills.",
  },
  disarmRatioLow: {
    detect:
      "After 12+ resolved enemies, zero disarms, on a run that has fired. Advice, not scolding.",
  },
  repeatedDeaths: {
    detect: "Second or later lifeLost within 60 s of the previous one.",
  },
  longIdle: {
    detect:
      "No fire input and almost no movement for 8+ s in gameplay (resting to charge counts; say so kindly).",
  },
  writHoarding: {
    detect:
      "A full Writ charge held for 6+ s, or three full charges released into empty space.",
  },
  bossLull: {
    detect:
      "During the Warden fight, 10+ s with no player hit, kill or part break: the Warden fills the air.",
  },
};
