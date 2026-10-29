/**
 * Developer and demo URL switches, available from day one so any beat can be
 * reached in seconds:
 *
 * - `?skipto=tutorial|sector1..sector5|flashback|boss|ending-kill|ending-pacifist`
 * - `?autoplay=fight|pacifist&speed=N` (N ticks per frame, 1–32)
 * - `?seed=N` (gameplay RNG seed)
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

export interface AutoPlay {
  readonly mode: "fight" | "pacifist";
  /** Sim ticks per rendered frame. */
  readonly speed: number;
}

export interface UrlFlags {
  readonly skipTo: SkipTo | null;
  readonly autoPlay: AutoPlay | null;
  readonly seed: number | null;
  /** Human-readable notes about ignored or clamped values, for the dev overlay. */
  readonly warnings: readonly string[];
}

export const MAX_AUTOPLAY_SPEED = 32;

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

  return { skipTo, autoPlay, seed, warnings };
}
