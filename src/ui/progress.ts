/**
 * Meta progress that outlives a run: the hangar loadout, codex unlocks and
 * career pay (for mastery rank). Kept apart from `Settings` on purpose:
 * settings are how you like to play, this is what you have done, and
 * "Reset all settings" must never wipe it.
 *
 * Stored as one JSON record; anything malformed falls back to defaults,
 * field by field, so an old or hand-edited save never breaks the hangar.
 */

import {
  DEFAULT_LOADOUT,
  type Loadout,
  SENSOR_PACKAGES,
  WEAPON_PACKAGES,
} from "../contracts/index.ts";

export const PROGRESS_KEY = "neon-warden.progress";

export interface Progress {
  readonly loadout: Loadout;
  readonly codex: readonly string[];
  readonly careerPay: number;
}

export type ProgressListener = (progress: Progress) => void;

export interface ProgressStore {
  get(): Progress;
  setLoadout(loadout: Loadout): void;
  /** Returns true if the entry was newly unlocked. */
  unlockCodex(id: string): boolean;
  bankPay(credits: number): void;
  subscribe(listener: ProgressListener): () => void;
}

/** Field-by-field repair of a stored record. Pure, for tests. */
export function sanitizeProgress(raw: unknown): Progress {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const l = (r.loadout && typeof r.loadout === "object" ? r.loadout : {}) as
    & Partial<Loadout>
    & Record<string, unknown>;
  const c = (l.cosmetics ?? {}) as Partial<Loadout["cosmetics"]>;
  const d = DEFAULT_LOADOUT;
  const str = <T extends string>(
    v: unknown,
    ok: (v: string) => boolean,
    f: T,
  ) => typeof v === "string" && ok(v) ? v as T : f;
  const loadout: Loadout = {
    weapon: str(l.weapon, (v) => v in WEAPON_PACKAGES, d.weapon),
    sensor: str(l.sensor, (v) => v in SENSOR_PACKAGES, d.sensor),
    cosmetics: {
      paint: str(c.paint, () => true, d.cosmetics.paint),
      trimColor: str(
        c.trimColor,
        (v) => /^#[0-9a-f]{6}$/i.test(v),
        d.cosmetics.trimColor,
      ),
      decal: str(c.decal, () => true, d.cosmetics.decal),
      trail: str(c.trail, () => true, d.cosmetics.trail),
      helmetLivery: str(c.helmetLivery, () => true, d.cosmetics.helmetLivery),
    },
  };
  return {
    loadout,
    codex: Array.isArray(r.codex)
      ? r.codex.filter((x): x is string => typeof x === "string")
      : [],
    careerPay: typeof r.careerPay === "number" && r.careerPay >= 0
      ? r.careerPay
      : 0,
  };
}

export function createProgressStore(
  storage: Pick<Storage, "getItem" | "setItem"> | null = globalThis
    .localStorage ?? null,
): ProgressStore {
  let current = sanitizeProgress(read());
  const listeners = new Set<ProgressListener>();

  function read(): unknown {
    try {
      return JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "null");
    } catch {
      return null;
    }
  }
  function write(next: Progress): void {
    current = next;
    try {
      storage?.setItem(PROGRESS_KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: progress lives for this session only.
    }
    for (const listener of listeners) listener(next);
  }

  return {
    get: () => current,
    setLoadout: (loadout) => write({ ...current, loadout }),
    unlockCodex(id) {
      if (current.codex.includes(id)) return false;
      write({ ...current, codex: [...current.codex, id] });
      return true;
    },
    bankPay(credits) {
      if (credits > 0) {
        write({ ...current, careerPay: current.careerPay + credits });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
