/**
 * Auto fullscreen on mobile: a phone browser's toolbars eat a vertical
 * shmup's height, so on a touch-primary device the first qualifying tap
 * asks for fullscreen, the way the F key or the Settings toggle would.
 *
 * Rules (decision logic is pure, below, and unit-tested):
 *
 * - Only on mobile/touch-primary devices. A Chromebook with its keyboard
 *   and trackpad attached is a laptop; in tablet mode (no fine pointer) it
 *   counts as a tablet.
 * - Never in an installed PWA (standalone already has no browser chrome).
 * - Only on a gesture that is not a mid-run control: menus, the gate, the
 *   pause menu. A tap on the touch deck during play never requests, so the
 *   Fullscreen API's resize can never land under a thumb.
 * - If the system leaves fullscreen (Android Back, a notification), the next
 *   qualifying tap asks again. If the player leaves through our toggle (F
 *   or Settings), auto stops for the session; the setting stops it for good.
 * - Unsupported (iPhone Safari has no element fullscreen): the honest
 *   Add to Home Screen hint, once per device. A denied request is silent:
 *   the player asked for nothing, so we never scold them for the browser.
 *
 * Keyboard Lock is deliberately not used: it would make Esc a press-and-hold
 * to leave fullscreen, and Esc is our Back. Orientation lock is attempted
 * (portrait), failing silently where unsupported, which is most places.
 */
import type { SettingsStore } from "../contracts/index.ts";
import { fullscreenUnsupported, noteFullscreenChoice } from "./fullscreen.ts";
import { UI_STRINGS } from "../i18n/ui.ts";

/** What the environment tells us about the device. */
export interface DeviceSignals {
  /** `(pointer: coarse)`: the primary pointer is a finger. */
  readonly coarse: boolean;
  /** `(any-pointer: fine)`: a mouse, trackpad or stylus is attached. */
  readonly anyFine: boolean;
  /** The input layer's last-used device is touch. */
  readonly touchActive: boolean;
  /** Phone or tablet user agent (`userAgentData.mobile`, Android, iPhone). */
  readonly mobileUa: boolean;
  /** `CrOS` in the user agent. */
  readonly chromeOs: boolean;
}

/**
 * Touch-primary: a finger is the primary pointer and nothing fine is
 * attached, or a phone/tablet browser is being driven by touch right now
 * (an iPad with a trackpad case still reports a fine pointer). A Chromebook
 * only qualifies in tablet mode: the user agent says nothing about whether
 * the keyboard is folded away, the pointers do.
 */
export function isTouchPrimary(d: DeviceSignals): boolean {
  const tablet = d.coarse && !d.anyFine;
  if (d.chromeOs) return tablet;
  return tablet || (d.touchActive && d.mobileUa);
}

export interface AutoState {
  /** Settings: "Auto fullscreen on mobile". */
  readonly enabled: boolean;
  readonly touchPrimary: boolean;
  /** Installed PWA (`display-mode` standalone/fullscreen, iOS `standalone`). */
  readonly standalone: boolean;
  readonly fullscreen: boolean;
  /** The tap is a gameplay control (a run is live, no menu open). */
  readonly inPlay: boolean;
  /** Player left fullscreen through our toggle this session. */
  readonly optedOut: boolean;
  /** The browser refused this session; asking again only nags. */
  readonly denied: boolean;
  readonly supported: boolean;
  /** The unsupported hint was already shown on this device. */
  readonly hintShown: boolean;
}

export type AutoAction = "request" | "hint" | "none";

export function autoFullscreenAction(s: AutoState): AutoAction {
  if (!s.enabled || !s.touchPrimary || s.standalone || s.fullscreen) {
    return "none";
  }
  if (s.inPlay || s.optedOut) return "none";
  if (!s.supported) return s.hintShown ? "none" : "hint";
  return s.denied ? "none" : "request";
}

const HINT_KEY = "nw.autoFullscreen.hintShown";

export interface AutoFullscreenPorts {
  readonly settings: SettingsStore;
  /** True while taps drive the ship: a live run with no menu on top. */
  readonly inPlay: () => boolean;
  readonly touchActive: () => boolean;
}

function media(query: string): boolean {
  return typeof matchMedia === "function" && matchMedia(query).matches;
}

export function readDeviceSignals(touchActive: boolean): DeviceSignals {
  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  const ua = nav.userAgent;
  return {
    coarse: media("(pointer: coarse)"),
    anyFine: media("(any-pointer: fine)"),
    touchActive,
    mobileUa: nav.userAgentData?.mobile === true ||
      /Android|iPhone|iPad|iPod|Mobile/.test(ua),
    chromeOs: /\bCrOS\b/.test(ua),
  };
}

export function isStandalone(): boolean {
  return media("(display-mode: standalone)") ||
    media("(display-mode: fullscreen)") ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Listens for qualifying taps (`click` and `touchend` both carry user
 * activation; iOS needs `touchend`). Returns a disposer.
 */
export function installAutoFullscreen(ports: AutoFullscreenPorts): () => void {
  let denied = false;
  let busy = false;
  const hintShown = () => {
    try {
      return localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return false;
    }
  };
  const onGesture = (event: Event) => {
    if (busy) return;
    // A real mouse click (Chromium reports `pointerType` on click) is a
    // desktop gesture, whatever the screen says.
    if ((event as Partial<PointerEvent>).pointerType === "mouse") return;
    const action = autoFullscreenAction({
      enabled: ports.settings.get().display.autoFullscreen,
      touchPrimary: isTouchPrimary(readDeviceSignals(ports.touchActive())),
      standalone: isStandalone(),
      fullscreen: !!document.fullscreenElement,
      inPlay: ports.inPlay(),
      optedOut: noteFullscreenChoice.optedOut,
      denied,
      supported: !fullscreenUnsupported(),
      hintShown: hintShown(),
    });
    if (action === "hint") {
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch { /* private mode: the hint may repeat next visit */ }
      const lang = ports.settings.get().textLang;
      // After this gesture's own handlers, so the gate's tap is not eaten.
      setTimeout(() =>
        globalThis.dispatchEvent(
          new CustomEvent("platform-notice", {
            detail: UI_STRINGS["ui.fullscreen.iosHint"][lang],
          }),
        ), 0);
      return;
    }
    if (action !== "request") return;
    busy = true;
    document.documentElement.requestFullscreen({ navigationUI: "hide" })
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        return orientation.lock?.("portrait").catch(() => {});
      })
      .catch(() => {
        denied = true;
      })
      .finally(() => {
        busy = false;
      });
  };
  const opts = { capture: true, passive: true } as const;
  addEventListener("touchend", onGesture, opts);
  addEventListener("click", onGesture, opts);
  return () => {
    removeEventListener("touchend", onGesture, opts);
    removeEventListener("click", onGesture, opts);
  };
}
