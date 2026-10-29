/**
 * Barks: single comms lines fired by sim events outside any timeline. The
 * Director plays them on the ambient layer, so a scripted scene always wins.
 */

import type { LineId, SimEvent } from "../contracts/index.ts";
import { id } from "../i18n/index.ts";

/** The bark for an event, or `null` if the event has none. */
export function barkFor(event: SimEvent): LineId | null {
  switch (event.type) {
    case "lifeLost":
      return event.livesLeft > 0 ? id("bark_lifelost_001") : null;
    case "pickup":
      return event.kind === "shield" ? id("bark_shield_001") : null;
    case "gameOver":
      return id("bark_gameover_001");
    default:
      return null;
  }
}

/** Every line a bark can play, for tests. */
export const BARK_LINES: readonly LineId[] = [
  id("bark_lifelost_001"),
  id("bark_shield_001"),
  id("bark_gameover_001"),
];
