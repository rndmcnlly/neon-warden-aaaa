/**
 * The checkpoint slot behind Continue. One slot, written at story beats
 * (tutorial done, flashback, boss). Kept beside the settings store because it
 * follows the same rules: versioned, validated on load, storage injected so
 * tests can pass a fake.
 */

import {
  type Difficulty,
  SKIP_TARGETS,
  type SkipTo,
} from "../contracts/index.ts";
import type { KeyValueStorage } from "./store.ts";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "neon-warden.checkpoint";

export interface Checkpoint {
  /** Where Continue resumes, in the same vocabulary as `?skipto=`. */
  readonly at: SkipTo;
  readonly difficulty: Difficulty;
  /** ISO date string, shown on the Continue button. */
  readonly savedAt: string;
}

export interface SaveStore {
  load(): Checkpoint | null;
  save(checkpoint: Checkpoint): void;
  clear(): void;
  /** Called after every save, so the front end can flash its indicator. */
  subscribe(listener: (checkpoint: Checkpoint | null) => void): () => void;
}

export function createSaveStore(
  storage: (KeyValueStorage & Pick<Storage, "removeItem">) | null =
    globalThis.localStorage ?? null,
): SaveStore {
  const listeners = new Set<(checkpoint: Checkpoint | null) => void>();
  const notify = (value: Checkpoint | null) => {
    for (const listener of listeners) listener(value);
  };
  return {
    load: () => parseCheckpoint(storage?.getItem(SAVE_KEY) ?? null),
    save(checkpoint) {
      storage?.setItem(
        SAVE_KEY,
        JSON.stringify({ version: SAVE_VERSION, checkpoint }),
      );
      notify(checkpoint);
    },
    clear() {
      storage?.removeItem(SAVE_KEY);
      notify(null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function parseCheckpoint(raw: string | null): Checkpoint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const c = parsed?.checkpoint;
    if (parsed?.version !== SAVE_VERSION || !c) return null;
    if (!(SKIP_TARGETS as readonly string[]).includes(c.at)) return null;
    if (!["story", "normal", "hard"].includes(c.difficulty)) return null;
    if (typeof c.savedAt !== "string") return null;
    return { at: c.at, difficulty: c.difficulty, savedAt: c.savedAt };
  } catch {
    return null;
  }
}
