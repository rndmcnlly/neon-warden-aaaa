import type { SimState } from "../contracts/index.ts";

/**
 * A short fingerprint of a snapshot (FNV-1a over its JSON). Two runs with the
 * same seed and inputs must produce the same hash at the same tick; the
 * determinism tests compare these instead of whole states.
 */
export function hashSimState(state: SimState): string {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
