/**
 * Developer and demo URL switches, available from day one so any beat can be
 * reached in seconds:
 *
 * - `?skipto=tutorial|sector1..sector5|flashback|boss|ending-kill|ending-pacifist`
 * - `?autoplay=fight|pacifist&speed=N` (N ticks per frame, 1–32)
 * - `?seed=N` (gameplay RNG seed)
 * - `?ui=menu|title|settings|credits|pause` (front-end entry screen)
 * - `?qa=1` (exposes the read-only QA probe, `globalThis.__nwqa`)
 * - `?dev=1` (developer panels: the flag overlay and the variant switcher)
 * - `?v.<axis>=<choice>` (an A/B variant, e.g. `v.voice.tutorial_ai=original`
 *   or `v.music.gameplay=cand1`; axes are listed in `src/audio/variants.ts`)
 *
 * The parser is pure (takes a query string) so it is testable headless.
 */

export const SKIP_TARGETS = [
  "tutorial",
  "sector1",
  "sector2",
  "sector3",
  "sector4",
  "sector5",
  "flashback",
  "boss",
  "ending-kill",
  "ending-pacifist",
] as const;

export type SkipTo = typeof SKIP_TARGETS[number];

export const UI_ENTRIES = [
  "menu",
  "title",
  "settings",
  "credits",
  "pause",
] as const;

export type UiEntry = typeof UI_ENTRIES[number];

export interface AutoPlay {
  readonly mode: "fight" | "pacifist";
  /** Sim ticks per rendered frame. */
  readonly speed: number;
}

export interface UrlFlags {
  readonly movement: "classic" | "hybrid";
  readonly skipTo: SkipTo | null;
  readonly autoPlay: AutoPlay | null;
  readonly seed: number | null;
  /** Front-end screen to open instead of the boot gate (development). */
  readonly ui: UiEntry | null;
  /** QA tooling is watching: expose the read-only probe (see `src/app/qaProbe.ts`). */
  readonly qa: boolean;
  /** Developer panels requested (`?dev=1`). */
  readonly dev: boolean;
  /**
   * A/B variant choices from `v.<axis>=<choice>` parameters, unvalidated:
   * the variant registry knows which axes and choices exist and ignores the
   * rest (see `src/audio/variants.ts`).
   */
  readonly variants: Readonly<Record<string, string>>;
  /** Human-readable notes about ignored or clamped values, for the dev overlay. */
  readonly warnings: readonly string[];
}

export const MAX_AUTOPLAY_SPEED = 32;

/** URL parameters naming an A/B variant start with this. */
export const VARIANT_PREFIX = "v.";

function isSkipTo(value: string): value is SkipTo {
  return (SKIP_TARGETS as readonly string[]).includes(value);
}

export function parseUrlFlags(search: string): UrlFlags {
  const params = new URLSearchParams(search);
  const warnings: string[] = [];

  let skipTo: SkipTo | null = null;
  const rawSkip = params.get("skipto");
  if (rawSkip !== null) {
    if (isSkipTo(rawSkip)) skipTo = rawSkip;
    else warnings.push(`unknown skipto "${rawSkip}"`);
  }

  let autoPlay: AutoPlay | null = null;
  const rawMode = params.get("autoplay");
  if (rawMode !== null) {
    if (rawMode === "fight" || rawMode === "pacifist") {
      const rawSpeed = Number(params.get("speed") ?? "1");
      let speed = Number.isFinite(rawSpeed) ? Math.round(rawSpeed) : 1;
      const clamped = Math.min(MAX_AUTOPLAY_SPEED, Math.max(1, speed));
      if (clamped !== speed) {
        warnings.push(`speed clamped to ${clamped}`);
        speed = clamped;
      }
      autoPlay = { mode: rawMode, speed };
    } else {
      warnings.push(`unknown autoplay "${rawMode}"`);
    }
  } else if (params.has("speed")) {
    warnings.push("speed ignored without autoplay");
  }

  let seed: number | null = null;
  const rawSeed = params.get("seed");
  if (rawSeed !== null) {
    const parsed = Number(rawSeed);
    if (Number.isInteger(parsed)) seed = parsed >>> 0;
    else warnings.push(`seed "${rawSeed}" is not an integer`);
  }

  let ui: UiEntry | null = null;
  const rawUi = params.get("ui");
  if (rawUi !== null) {
    if ((UI_ENTRIES as readonly string[]).includes(rawUi)) {
      ui = rawUi as UiEntry;
    } else warnings.push(`unknown ui "${rawUi}"`);
  }

  const qa = params.get("qa") === "1";
  const dev = params.get("dev") === "1";

  const variants: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!key.startsWith(VARIANT_PREFIX)) continue;
    const axis = key.slice(VARIANT_PREFIX.length);
    if (
      /^[a-z]+\.[a-zA-Z0-9_]+$/.test(axis) && /^[a-zA-Z0-9_-]+$/.test(value)
    ) {
      variants[axis] = value;
    } else warnings.push(`malformed variant "${key}=${value}"`);
  }

  const rawMovement = params.get("movement");
  const movement = rawMovement === "hybrid" ? "hybrid" : "classic";
  if (
    rawMovement !== null && rawMovement !== "classic" &&
    rawMovement !== "hybrid"
  ) {
    warnings.push(`unknown movement "${rawMovement}"`);
  }
  return { movement, skipTo, autoPlay, seed, ui, qa, dev, variants, warnings };
}
