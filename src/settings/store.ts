/**
 * The one settings store. Persists to `localStorage` under a versioned key so
 * a future shape change can migrate (or safely discard) old saves instead of
 * crashing on them. Workstream 2 owns this folder and may add validation and
 * migrations, but must keep the `SettingsStore` interface.
 */

import type {
  Settings,
  SettingsListener,
  SettingsStore,
} from "../contracts/index.ts";
import { DEFAULT_SETTINGS } from "./defaults.ts";

/** Bump when `Settings` changes shape; add a migration in `load` if needed. */
export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = "neon-warden.settings";

interface SavedSettings {
  version: number;
  settings: Settings;
}

/** The subset of the Web Storage API we use, so tests can pass a fake. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function createSettingsStore(
  storage: KeyValueStorage | null = globalThis.localStorage ?? null,
): SettingsStore {
  let current = load(storage);
  const listeners = new Set<SettingsListener>();

  function commit(next: Settings): void {
    current = next;
    const saved: SavedSettings = { version: SETTINGS_VERSION, settings: next };
    storage?.setItem(SETTINGS_KEY, JSON.stringify(saved));
    for (const listener of listeners) listener(current);
  }

  return {
    get: () => current,
    update: (recipe) => commit(recipe(current)),
    reset: () => commit(DEFAULT_SETTINGS),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function load(storage: KeyValueStorage | null): Settings {
  const raw = storage?.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(raw) as Partial<SavedSettings>;
    if (saved.version !== SETTINGS_VERSION || !saved.settings) {
      return DEFAULT_SETTINGS;
    }
    return mergeDefaults(DEFAULT_SETTINGS, saved.settings);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Fills keys missing from a saved object with defaults, recursively, so adding
 * a new option does not require a version bump.
 */
function mergeDefaults<T>(defaults: T, saved: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(saved)) {
    return saved === undefined || typeof saved !== typeof defaults
      ? defaults
      : saved as T;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(defaults)) {
    result[key] = mergeDefaults(defaults[key], saved[key]);
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
