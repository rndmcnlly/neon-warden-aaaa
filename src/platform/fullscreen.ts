import { createSettingsStore } from "../settings/store.ts";
import { UI_STRINGS } from "../i18n/ui.ts";

export function acceptsFullscreenKey(
  event: Pick<
    KeyboardEvent,
    "code" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
  >,
  typing: boolean,
  capturing: boolean,
  bound: boolean,
): boolean {
  return event.code === "KeyF" && !event.repeat && !event.altKey &&
    !event.ctrlKey && !event.metaKey && !event.shiftKey && !typing &&
    !capturing && !bound;
}

/**
 * The player's last explicit choice through our toggle (F or Settings).
 * Leaving that way stops auto fullscreen on mobile for the session
 * (`autoFullscreen.ts`); a system exit (Android Back) does not.
 */
export const noteFullscreenChoice = { optedOut: false };

/**
 * No element fullscreen here. iPhone Safari (and every iPhone browser, all
 * WebKit) only fullscreens video, whatever `fullscreenEnabled` claims.
 */
export function fullscreenUnsupported(): boolean {
  return !document.documentElement.requestFullscreen ||
    !document.fullscreenEnabled ||
    /\b(iPhone|iPod)\b/.test(navigator.userAgent);
}

export async function setFullscreen(on: boolean): Promise<void> {
  noteFullscreenChoice.optedOut = !on;
  const lang = createSettingsStore().get().textLang;
  try {
    if (on) {
      if (fullscreenUnsupported()) {
        throw new Error(UI_STRINGS["ui.fullscreen.iosHint"][lang]);
      }
      await document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) await document.exitFullscreen();
  } catch (error) {
    globalThis.dispatchEvent(
      new CustomEvent("platform-notice", {
        detail: error instanceof Error && on && fullscreenUnsupported()
          ? error.message
          : UI_STRINGS["ui.fullscreen.denied"][lang],
      }),
    );
  } finally {
    syncFullscreen();
  }
}

export function syncFullscreen(): void {
  const store = createSettingsStore();
  const fullscreen = !!document.fullscreenElement;
  if (store.get().display.fullscreen !== fullscreen) {
    store.update((s) => ({ ...s, display: { ...s.display, fullscreen } }));
  }
}

export function installFullscreenShortcut(): void {
  document.addEventListener("fullscreenchange", syncFullscreen);
  globalThis.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const typing = !!target?.closest(
      "input,textarea,select,[contenteditable]:not([contenteditable=false])",
    );
    const capturing = !!document.querySelector(".is-capturing");
    const bound = Object.values(createSettingsStore().get().controls.bindings)
      .some((binding) => binding.keys.includes("KeyF"));
    if (!acceptsFullscreenKey(event, typing, capturing, bound)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void setFullscreen(!document.fullscreenElement);
  }, { capture: true });
}
