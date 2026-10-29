/**
 * The history bridge: system Back (Android back gesture or button, the
 * browser's Back button, mouse button 4, Alt+Left, iOS edge swipe, a
 * trackpad history swipe) becomes the game's own Back, never a page exit,
 * while a Back means something. It keeps exactly one "guard" history entry
 * on top of the page while `wanted()` is true; popping that entry is the
 * signal. When Back stops meaning anything (the title screen, no run), the
 * bridge unwinds its guard so system Back leaves the site as players expect
 * (never trap a player).
 *
 * Declined: `CloseWatcher`. It also fires on Esc, which the input layer
 * already turns into Back, so every Esc would act twice, and Chrome limits
 * how many watchers a page may create without fresh user activation. One
 * guard entry works in every browser and is easy to test with
 * `page.goBack()`.
 *
 * Chrome may skip history entries pushed without user activation (its
 * "history manipulation intervention"). Re-arming right after a pop is still
 * the best we can do: the entry stops being skippable as soon as the player
 * touches the page again.
 */

/** The slice of `window` the bridge needs, so tests can pass a fake. */
export interface HistoryHost {
  readonly history: Pick<History, "pushState" | "back" | "state">;
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

export interface HistoryBridgeOptions {
  /** True while system Back should act inside the game. */
  wanted(): boolean;
  /** System Back happened while wanted (Back in menus, Pause in a run). */
  onBack(): void;
  host?: HistoryHost;
}

export interface HistoryBridge {
  /** Call after anything that may change `wanted()` (router, run state). */
  sync(): void;
  /** True while our guard entry is the current history entry. */
  readonly armed: boolean;
  dispose(): void;
}

/** Marks our entries, so a foreign `popstate` is never mistaken for ours. */
const GUARD_KEY = "nwBackGuard";

export function createHistoryBridge(
  options: HistoryBridgeOptions,
): HistoryBridge {
  const host: HistoryHost = options.host ?? globalThis;
  // A reload keeps the current entry, guard included: adopt it rather than
  // stacking a second one that would take two Backs to leave.
  const restored = host.history.state as Record<string, unknown> | null;
  let armed = typeof restored === "object" && restored?.[GUARD_KEY] === true;
  /** We called `history.back()` ourselves; swallow the pop it causes. */
  let unwinding = false;

  function sync(): void {
    if (unwinding) return;
    const wanted = options.wanted();
    if (wanted && !armed) {
      // Keep any state the page already had, so other code is undisturbed.
      const prior = host.history.state;
      const base = typeof prior === "object" && prior !== null ? prior : {};
      host.history.pushState({ ...base, [GUARD_KEY]: true }, "");
      armed = true;
    } else if (!wanted && armed) {
      armed = false;
      unwinding = true;
      host.history.back();
    }
  }

  function onPopState(): void {
    if (unwinding) {
      unwinding = false;
      sync();
      return;
    }
    if (!armed) return;
    // The player's Back removed our guard entry.
    armed = false;
    if (options.wanted()) options.onBack();
    sync();
  }

  host.addEventListener("popstate", onPopState);
  return {
    sync,
    get armed() {
      return armed;
    },
    dispose() {
      host.removeEventListener("popstate", onPopState);
    },
  };
}
