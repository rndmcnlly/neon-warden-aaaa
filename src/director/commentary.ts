/**
 * The commentary scheduler: decides *when* a variant bank speaks. The banks
 * (`src/scenes/banks/`, agent W's data) decide *what*.
 *
 * For each sim event (including the sim's `statsMoment`s) and app moment:
 *
 * 1. Find the banks with a matching trigger whose conditions hold now.
 * 2. Drop banks on cooldown or past `maxPerRun`; roll each bank's `chance`.
 * 3. Take the highest priority. A short global gap keeps commentary a
 *    seasoning; safety lines (priority 80 and up) may cut through it.
 * 4. Deal a variant from the bank's shuffle bag, filtered by the moment's
 *    sub-case (`when`). The bag never repeats a line until every eligible
 *    line has played, and never deals one bag's last line first in the next.
 *    Bags persist per profile (the `BagStore` port), so a second run picks up
 *    where the first left off.
 * 5. Speak it. Scripted scenes always win: during a scene the line is only
 *    offered as an interjection while the scene waits for the player (the
 *    tutorial's drills), and only for the scene's own speaker. A line that
 *    cannot be spoken is put back in the bag and starts no cooldown.
 *
 * Text-only variants (`vo: false`) need nothing special here: the Director
 * shows a subtitle for any line id `t()` resolves and plays audio only when
 * the voice port has some.
 *
 * Pure TypeScript with injected ports: no DOM, no storage, testable headless.
 */

import {
  type BossPhase,
  type LineId,
  lineId,
  type SectorIndex,
  type SimEvent,
  type SimPhase,
  type Speaker,
} from "../contracts/index.ts";
import type {
  AppMoment,
  Bank,
  BankConditions,
  BankTrigger,
  BankVariant,
  EventFilter,
  VariantWhen,
} from "../scenes/banks/types.ts";

/**
 * Who may interject inside which scene, while it waits for the player.
 * Every other scene is never interrupted.
 */
export const INTERJECTORS: Readonly<Record<string, Speaker>> = {
  tutorial: "tutorial_ai",
};

export const COMMENTARY_TUNING = Object.freeze({
  /** No two commentary lines closer than this... */
  globalGapMs: 7000,
  /** ...unless the new one is at least this urgent (safety lines). */
  urgentPriority: 80,
});

/** Run state the scheduler checks conditions against. */
export interface CommentaryContext {
  readonly phase: SimPhase;
  readonly sector: SectorIndex;
  readonly bossPhase: BossPhase | null;
  readonly livesLeft: number;
  /** The Pilot has fired this run (`run: hasFired`). */
  readonly hasFired: boolean;
  /** The Pilot has never fired this run (`run: neverFired`). */
  readonly neverFired: boolean;
}

/** One bank's shuffle bag: what has been dealt since the last refill. */
export interface BagState {
  readonly dealt: readonly string[];
  readonly last: string | null;
}

/** Where bags persist between runs (one profile). */
export interface BagStore {
  load(): Readonly<Record<string, BagState>>;
  save(bags: Readonly<Record<string, BagState>>): void;
}

export interface CommentaryPorts {
  /** Wall-clock milliseconds that stop on pause (the Director's clock). */
  now(): number;
  /** An ambient bark; false when a scripted moment holds the floor. */
  bark(line: LineId): boolean;
  /** Speak inside a waiting scene; false unless it is waiting. */
  interject(line: LineId): boolean;
  /** The id of the timeline now playing, or null with none. */
  sceneId(): string | null;
  readonly store?: BagStore;
  /** For bags and `chance`; defaults to `Math.random`. */
  readonly random?: () => number;
}

/** A spoken commentary line, for QA logs and tests. */
export interface CommentaryPick {
  readonly bank: string;
  readonly line: LineId;
  readonly how: "bark" | "interject";
}

export type CommentaryTrigger =
  | { readonly on: "event"; readonly event: SimEvent }
  | { readonly on: "app"; readonly moment: AppMoment };

export class CommentaryScheduler {
  private bags: Record<string, BagState>;
  private readonly lastAt = new Map<string, number>();
  private readonly playsThisRun = new Map<string, number>();
  private lastLineAt = -Infinity;
  private readonly random: () => number;

  constructor(
    private readonly banks: readonly Bank[],
    private readonly ports: CommentaryPorts,
  ) {
    this.random = ports.random ?? Math.random;
    this.bags = { ...(ports.store?.load() ?? {}) };
  }

  /** A new run: per-run caps start over (bags and cooldowns carry on). */
  resetRun(): void {
    this.playsThisRun.clear();
  }

  /** Reacts to one sim event. Returns what was spoken, if anything. */
  onEvent(event: SimEvent, ctx: CommentaryContext): CommentaryPick | null {
    return this.offer({ on: "event", event }, ctx);
  }

  /** Reacts to the pause menu opening or closing. */
  onApp(moment: AppMoment, ctx: CommentaryContext): CommentaryPick | null {
    return this.offer({ on: "app", moment }, ctx);
  }

  /**
   * Deals one line from `bankId` regardless of triggers, cooldowns and
   * speaking (for callers that speak it themselves, such as the tutorial
   * re-issuing its target). Null if the bank does not exist or is empty.
   */
  deal(bankId: string, when?: VariantWhen): LineId | null {
    const bank = this.banks.find((b) => b.id === bankId);
    if (!bank) return null;
    const variant = this.dealVariant(bank, when ?? null);
    if (!variant) return null;
    this.persist();
    return lineId(variant.id);
  }

  // ----------------------------------------------------------- the choice

  private offer(
    trigger: CommentaryTrigger,
    ctx: CommentaryContext,
  ): CommentaryPick | null {
    const now = this.ports.now();
    const when = trigger.on === "event" ? whenFor(trigger.event) : null;
    const candidates = this.banks
      .filter((bank) => bank.triggers.some((t) => matches(t, trigger)))
      .filter((bank) => conditionsHold(bank.conditions, ctx))
      .filter((bank) => this.ready(bank, now))
      .filter((bank) => this.random() < (bank.conditions?.chance ?? 1))
      .sort((a, b) => b.priority - a.priority);
    const bank = candidates[0];
    if (!bank) return null;
    const gapOpen = now - this.lastLineAt >= COMMENTARY_TUNING.globalGapMs;
    if (!gapOpen && bank.priority < COMMENTARY_TUNING.urgentPriority) {
      return null;
    }

    const before = this.bags[bank.id];
    const variant = this.dealVariant(bank, when);
    if (!variant) return null;
    const line = lineId(variant.id);
    const how = this.speak(bank, line);
    if (!how) {
      // Not spoken: the line goes back in the bag, no cooldown starts.
      if (before) this.bags[bank.id] = before;
      else delete this.bags[bank.id];
      return null;
    }
    this.lastAt.set(bank.id, now);
    this.lastLineAt = now;
    this.playsThisRun.set(bank.id, (this.playsThisRun.get(bank.id) ?? 0) + 1);
    this.persist();
    return { bank: bank.id, line, how };
  }

  private ready(bank: Bank, now: number): boolean {
    const last = this.lastAt.get(bank.id);
    if (last !== undefined && now - last < bank.cooldownMs) return false;
    const cap = bank.conditions?.maxPerRun;
    return cap === undefined || (this.playsThisRun.get(bank.id) ?? 0) < cap;
  }

  /** Scenes win; inside one, only its own speaker may interject. */
  private speak(bank: Bank, line: LineId): CommentaryPick["how"] | null {
    const scene = this.ports.sceneId();
    if (scene === null) return this.ports.bark(line) ? "bark" : null;
    if (INTERJECTORS[scene] !== bank.speaker) return null;
    return this.ports.interject(line) ? "interject" : null;
  }

  // ----------------------------------------------------------- the bag

  /**
   * Deals the next variant of `bank` that fits `when` (or, if none of its
   * variants name that sub-case, one that fits every sub-case).
   */
  private dealVariant(
    bank: Bank,
    when: VariantWhen | null,
  ): BankVariant | null {
    const eligible = eligibleVariants(bank.variants, when);
    if (eligible.length === 0) return null;
    const ids = new Set(bank.variants.map((v) => v.id));
    const bag = this.bags[bank.id] ?? { dealt: [], last: null };
    // Ids that left the bank (rewrites) no longer count as dealt.
    let dealt = bag.dealt.filter((id) => ids.has(id));
    let fresh: readonly BankVariant[] = eligible.filter((v) =>
      !dealt.includes(v.id)
    );
    if (fresh.length === 0) {
      // Refill: everything eligible is back, except the line just heard.
      dealt = dealt.filter((id) => !eligible.some((v) => v.id === id));
      fresh = eligible.filter((v) => v.id !== bag.last);
      if (fresh.length === 0) fresh = eligible;
    }
    const variant = fresh[Math.floor(this.random() * fresh.length)];
    this.bags[bank.id] = { dealt: [...dealt, variant.id], last: variant.id };
    return variant;
  }

  private persist(): void {
    this.ports.store?.save(this.bags);
  }
}

// ------------------------------------------------------------- matching

function matches(trigger: BankTrigger, offer: CommentaryTrigger): boolean {
  if (offer.on === "app") {
    return trigger.on === "app" && trigger.moment === offer.moment;
  }
  const event = offer.event;
  if (trigger.on === "stats") {
    return event.type === "statsMoment" && event.moment === trigger.moment;
  }
  if (trigger.on !== "event" || trigger.type !== event.type) return false;
  return !trigger.where || filterHolds(trigger.where, event);
}

/** Every field the filter names must match the event's own. */
function filterHolds(where: EventFilter, event: SimEvent): boolean {
  const fields = event as unknown as Readonly<Record<string, unknown>>;
  const actual: Readonly<Record<keyof EventFilter, unknown>> = {
    target: fields.target,
    absorbedByShield: fields.absorbedByShield,
    pickup: event.type === "pickup" ? event.kind : undefined,
    enemy: event.type === "kill" || event.type === "disarm"
      ? event.kind
      : undefined,
    byRam: fields.byRam,
    first: fields.first,
  };
  return (Object.keys(where) as (keyof EventFilter)[]).every((key) =>
    where[key] === undefined || where[key] === actual[key]
  );
}

function conditionsHold(
  c: BankConditions | undefined,
  ctx: CommentaryContext,
): boolean {
  if (!c) return true;
  if (c.run === "hasFired" && !ctx.hasFired) return false;
  if (c.run === "neverFired" && !ctx.neverFired) return false;
  if (c.sectors && !c.sectors.includes(ctx.sector)) return false;
  if (
    c.bossPhases &&
    (ctx.bossPhase === null || !c.bossPhases.includes(ctx.bossPhase))
  ) return false;
  const lives = c.livesLeft;
  if (lives?.min !== undefined && ctx.livesLeft < lives.min) return false;
  if (lives?.max !== undefined && ctx.livesLeft > lives.max) return false;
  return true;
}

/** The sub-case a moment belongs to, for variants that name one. */
export function whenFor(event: SimEvent): VariantWhen | null {
  switch (event.type) {
    case "lifeLost":
      return event.livesLeft <= 1 ? "nearDeath" : "hit";
    case "hit":
      if (event.target !== "player") return null;
      return event.absorbedByShield ? "shieldBreak" : "hit";
    case "pickup":
      return event.kind === "spread" || event.kind === "shield"
        ? event.kind
        : null;
    case "kill":
      return event.byRam ? "ram" : null;
    case "statsMoment":
      return event.moment;
    default:
      return null;
  }
}

/** Variants for `when`; if none name it, the ones that fit any moment. */
function eligibleVariants(
  variants: readonly BankVariant[],
  when: VariantWhen | null,
): readonly BankVariant[] {
  const general = variants.filter((v) => v.when === undefined);
  if (when === null) return general.length > 0 ? general : variants;
  const specific = variants.filter((v) => v.when === when);
  return specific.length > 0 ? specific : general;
}

// ---------------------------------------------------------------- stores

/** A bag store that forgets on reload (tests, and when storage is absent). */
export function memoryBagStore(): BagStore {
  let bags: Readonly<Record<string, BagState>> = {};
  return {
    load: () => bags,
    save: (next) => (bags = structuredClone(next)),
  };
}

export const BAGS_KEY = "neon-warden.commentary";
export const BAGS_VERSION = 1;

/**
 * A bag store over key-value storage (the browser passes `localStorage`).
 * Corrupt or old data loads as empty bags: the worst case is a repeat.
 */
export function keyValueBagStore(
  storage: Pick<Storage, "getItem" | "setItem">,
): BagStore {
  return {
    load() {
      try {
        const raw = JSON.parse(storage.getItem(BAGS_KEY) ?? "null");
        if (
          raw?.version !== BAGS_VERSION || raw.bags === null ||
          typeof raw.bags !== "object" || Array.isArray(raw.bags)
        ) {
          return {};
        }
        const valid: Record<string, BagState> = {};
        for (const [key, value] of Object.entries(raw.bags)) {
          if (!value || typeof value !== "object") continue;
          const bag = value as Record<string, unknown>;
          if (
            !Array.isArray(bag.dealt) ||
            !bag.dealt.every((id) => typeof id === "string") ||
            !(bag.last === null || typeof bag.last === "string")
          ) continue;
          Object.defineProperty(valid, key, {
            value: { dealt: bag.dealt, last: bag.last },
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
        return valid;
      } catch {
        return {};
      }
    },
    save(bags) {
      try {
        storage.setItem(
          BAGS_KEY,
          JSON.stringify({ version: BAGS_VERSION, bags }),
        );
      } catch {
        // Storage full or blocked (school Chromebooks): commentary still works.
      }
    },
  };
}
