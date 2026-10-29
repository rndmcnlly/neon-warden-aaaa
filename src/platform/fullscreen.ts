import { createSettingsStore } from "../settings/store.ts";

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

export async function setFullscreen(on: boolean): Promise<void> {
  try {
    if (on) {
      if (
        !document.documentElement.requestFullscreen ||
        !document.fullscreenEnabled
      ) {
        throw new Error(
          "Fullscreen unavailable. On iPhone/iPad, use Share → Add to Home Screen, then open the installed app.",
        );
      }
      await document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) await document.exitFullscreen();
  } catch (error) {
    globalThis.dispatchEvent(
      new CustomEvent("platform-notice", {
        detail: error instanceof Error
          ? error.message
          : "Fullscreen request denied by browser.",
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
