/**
 * The front end: DOM menus layered over the three.js canvas. This file wires
 * the pieces together and owns the one dispatch rule for menu input:
 *
 *   playing:  only "pause" matters (opens the pause menu)
 *   in menus: the top screen gets first refusal, then the focused widget
 *             (sliders and cyclers use left/right), then spatial focus
 *             navigation, confirm, and back
 *
 * The game loop asks `isSimRunning()` each frame; while any screen is open
 * (title, settings, pause) the sim should not step.
 */

import type {
  Lang,
  SettingsStore,
  UiEntry,
  UrlFlags,
} from "../contracts/index.ts";
import { createInputLayer, type InputLayer } from "../input/inputLayer.ts";
import { createSaveStore, type SaveStore } from "../settings/saveGame.ts";
import type { FrontEndHooks, UiContext } from "./context.ts";
import { type Direction, focusInitial, moveFocus } from "./focus.ts";
import { refreshPrompts } from "./prompts.ts";
import { Router, type ScreenFactory } from "./router.ts";
import { gateScreen, titleScreen } from "./screens/boot.ts";
import { creditsScreen, mainMenuScreen } from "./screens/menus.ts";
import { type PauseReason, pauseScreen } from "./screens/pause.ts";
import { settingsScreen } from "./screens/settings.ts";
import { uiSound } from "./sound.ts";
import { id, t } from "../i18n/index.ts";
import { h, widgetIntent } from "./widgets.ts";
import "./frontend.css";

export interface FrontEndOptions {
  readonly settings: SettingsStore;
  readonly flags: UrlFlags;
  readonly hooks?: FrontEndHooks;
  readonly saves?: SaveStore;
  /**
   * Front-end entry point for development and screenshots (`flags.ui`,
   * from `?ui=`): `menu`, `title`, `settings`,
   * `credits`, `pause`. Ignored when `flags.skipTo` already jumps into play.
   */
  readonly uiEntry?: UiEntry | null;
}

export interface FrontEnd {
  readonly input: InputLayer;
  /** False while any menu is open: the loop should not step the sim. */
  isSimRunning(): boolean;
  /** Leaves play for the title screen (after the credits, for example). */
  quitToTitle(): void;
  pause(reason?: PauseReason): void;
  /** Flashes the "Checkpoint saved" chip (also fires on every save). */
  showSaveIndicator(): void;
  dispose(): void;
}

const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];
const TOAST_MS = 3200;
const SAVE_CHIP_MS = 2400;

export function createFrontEnd(
  root: HTMLElement,
  options: FrontEndOptions,
): FrontEnd {
  const { settings, flags } = options;
  const hooks = options.hooks ?? {};
  const saves = options.saves ?? createSaveStore();
  const input = createInputLayer(settings);

  const layer = h("div", { class: "nw-frontend" });
  const backdrop = h("div", { class: "nw-backdrop", "aria-hidden": "true" });
  const screens = h("div", { class: "nw-screens" });
  const toasts = h("div", {
    class: "nw-toasts",
    role: "status",
    "aria-live": "polite",
  });
  const saveChip = h("div", {
    class: "nw-save-chip",
    role: "status",
    hidden: true,
  });
  const buildLabel = h("div", { class: "nw-build-label" });
  layer.append(backdrop, screens, toasts, saveChip, buildLabel);
  root.appendChild(layer);

  let playing = false;
  let audioUnlocked = false;

  const lang = (): Lang => settings.get().textLang;

  const router = new Router(screens, () => {
    layer.classList.toggle("is-playing", router.depth === 0);
    updatePrompts();
  });

  const ctx: UiContext = {
    settings,
    saves,
    input,
    router,
    hooks,
    lang,
    t: (key, vars) => t(id(key), lang(), vars),
    startGame(request) {
      uiSound("confirm");
      router.reset();
      playing = true;
      hooks.onStartGame?.(request);
    },
    resume() {
      uiSound("pause_out");
      router.reset();
      playing = true;
      hooks.onResume?.();
    },
    quitToTitle() {
      playing = false;
      hooks.onQuitToTitle?.();
      router.reset(titleScreen(ctx));
    },
    restartCheckpoint() {
      router.reset();
      playing = true;
      hooks.onRestartCheckpoint?.();
    },
    toast(message) {
      const item = h("p", { class: "nw-toast" }, message);
      toasts.append(item);
      setTimeout(() => item.remove(), TOAST_MS);
    },
  };

  function pause(reason: PauseReason = "player"): void {
    if (!playing || router.depth > 0) return;
    uiSound("pause_in");
    hooks.onPause?.();
    router.push(pauseScreen(ctx, reason));
  }

  function updatePrompts(): void {
    refreshPrompts(layer, settings.get(), input.device(), input.padFamily());
  }

  function applyDocumentState(): void {
    document.documentElement.lang = lang() === "zh" ? "zh-Hans" : lang();
    layer.dataset.device = input.device();
    buildLabel.replaceChildren(
      h("strong", {}, ctx.t("ui.build.label")),
      h("span", {}, ctx.t("ui.build.detail")),
    );
  }

  // Menu input dispatch (see the header comment for the rule).
  const offIntent = input.onIntent((event) => {
    if (router.depth === 0) {
      if (playing && event.intents.has("pause")) pause("player");
      return;
    }
    const top = router.top()!;
    if (top.onIntent?.(event)) return;
    const focused = document.activeElement;
    const inTop = focused instanceof HTMLElement && top.el.contains(focused);
    if (inTop && widgetIntent(focused, event)) {
      updatePrompts();
      return;
    }
    for (const direction of DIRECTIONS) {
      if (event.intents.has(direction)) {
        if (!inTop) focusInitial(top.el);
        else moveFocus(top.el, direction);
        return;
      }
    }
    if (event.intents.has("confirm")) {
      if (inTop) (focused as HTMLElement).click();
      else focusInitial(top.el);
      return;
    }
    if (event.intents.has("back")) {
      uiSound("back");
      if (top.onBack) top.onBack();
      else router.pop();
    }
  });

  const offDevice = input.onDeviceChange(() => {
    layer.dataset.device = input.device();
    updatePrompts();
  });

  // Auto-pause: any first press also unlocks audio when boot was skipped.
  const offAnyPress = input.onAnyPress(() => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    hooks.onAudioUnlock?.();
  });
  const offPad = input.onGamepadConnection((connected) => {
    if (!connected) pause("gamepad");
    updatePrompts();
  });
  const onBlur = () => pause("blur");
  const onVisibility = () => {
    if (document.hidden) pause("blur");
  };
  const onFullscreen = () => {
    const isFull = document.fullscreenElement !== null;
    if (settings.get().display.fullscreen !== isFull) {
      settings.update((c) => ({
        ...c,
        display: { ...c.display, fullscreen: isFull },
      }));
    }
    if (!isFull) pause("fullscreen");
  };
  addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreen);

  // Settings changes: re-sync widgets; a text language change rebuilds.
  let lastLang = lang();
  const offSettings = settings.subscribe(() => {
    if (lang() !== lastLang) {
      lastLang = lang();
      applyDocumentState();
      router.rebuild();
    } else {
      router.syncAll();
    }
    updatePrompts();
  });

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function showSaveIndicator(): void {
    uiSound("save");
    saveChip.replaceChildren(
      h("i", { class: "nw-save-icon" }),
      ctx.t("ui.save.saved"),
    );
    saveChip.hidden = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => (saveChip.hidden = true), SAVE_CHIP_MS);
  }
  const offSaves = saves.subscribe((checkpoint) => {
    if (checkpoint) showSaveIndicator();
  });

  // A saved fullscreen preference cannot be honored without a gesture.
  if (settings.get().display.fullscreen && !document.fullscreenElement) {
    settings.update((c) => ({
      ...c,
      display: { ...c.display, fullscreen: false },
    }));
  }

  applyDocumentState();
  const entries: Record<UiEntry, () => void> = {
    menu: () => router.push(mainMenuScreen(ctx)),
    title: () => router.push(titleScreen(ctx)),
    settings: () => {
      router.push(mainMenuScreen(ctx));
      router.push(settingsScreen(ctx));
    },
    credits: () => {
      router.push(mainMenuScreen(ctx));
      router.push(creditsScreen(ctx));
    },
    pause: () => {
      playing = true;
      pause("player");
    },
  };
  // Skip-to and auto-play jump straight into play; main.ts starts the run.
  const jumpsIn = flags.skipTo !== null || flags.autoPlay !== null;
  const startAt: ScreenFactory | null = jumpsIn ? null : gateScreen(ctx);
  if (jumpsIn) {
    playing = true;
  } else if (options.uiEntry) {
    entries[options.uiEntry]();
  } else if (startAt) {
    router.push(startAt);
  }
  updatePrompts();

  return {
    input,
    isSimRunning: () => playing && router.depth === 0,
    quitToTitle: () => ctx.quitToTitle(),
    pause,
    showSaveIndicator,
    dispose() {
      offIntent();
      offDevice();
      offAnyPress();
      offPad();
      offSettings();
      offSaves();
      removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      input.dispose();
      layer.remove();
    },
  };
}
