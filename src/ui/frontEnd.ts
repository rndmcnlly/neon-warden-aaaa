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
 *
 * Run-time API for main.ts (all read-only toward the sim):
 *   hud.update(state), hud.event(e), hud.flag(name, value), hud.reset()
 *   showContinue({ continuesLeft, score }) -> "continue" | "quit"
 *   credits.roll() and credits.onDone(cb)   (set credits.rollDone in cb)
 *   tutorial.onSkip(cb)                     (play the tutorial-skip scene)
 */

import type {
  Lang,
  SettingsStore,
  SimEvent,
  SimState,
  UiEntry,
  UrlFlags,
} from "../contracts/index.ts";
import { createInputLayer, type InputLayer } from "../input/inputLayer.ts";
import { createSaveStore, type SaveStore } from "../settings/saveGame.ts";
import { createProgressStore, type ProgressStore } from "./progress.ts";
import type { FrontEndHooks, UiContext } from "./context.ts";
import { decideMenuIntent } from "./dispatch.ts";
import { focusInitial, moveFocus } from "./focus.ts";
import { createHud } from "./hud.ts";
import type { LooseEvent, RadioLine } from "./instruments.ts";
import { refreshPrompts } from "./prompts.ts";
import { Router, type ScreenFactory } from "./router.ts";
import { gateScreen, titleScreen } from "./screens/boot.ts";
import { creditsScreen, mainMenuScreen } from "./screens/menus.ts";
import { type PauseReason, pauseScreen } from "./screens/pause.ts";
import { hangarScreen } from "./screens/hangar.ts";
import { settingsScreen } from "./screens/settings.ts";
import {
  type ContinueChoice,
  type ContinueInfo,
  continueScreen,
  creditsCrawlScreen,
  tutorialSkipDialog,
} from "./screens/run.ts";
import { uiSound } from "./sound.ts";
import { hasText, id, t } from "../i18n/index.ts";
import { lineId } from "../contracts/index.ts";
import { h, widgetIntent } from "./widgets.ts";
import "./frontend.css";

export interface FrontEndOptions {
  readonly settings: SettingsStore;
  readonly flags: UrlFlags;
  readonly hooks?: FrontEndHooks;
  readonly saves?: SaveStore;
  /** Loadout, codex and career pay (defaults to localStorage). */
  readonly progress?: ProgressStore;
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
  /** Loadout, codex unlocks, career pay (the hangar's store). */
  readonly progress: ProgressStore;
  /** The in-game HUD and banners. Feed it; it never writes back. */
  readonly hud: {
    /** After each sim step (cheap: it redraws only what changed). */
    update(state: SimState): void;
    /**
     * Every SimEvent: sector and Warden banners, spared tally, and the wave 3
     * instruments (payChanged, writCharge, graze, scanLock, intel, disarm),
     * read by `type` so new sim events need no change here.
     */
    event(event: SimEvent | LooseEvent): void;
    /** Radio chatter text with its source and stereo side (from A). */
    radio(line: RadioLine): void;
    /** Every story flag change: serial reveal, ending banners. */
    flag(name: string, value: boolean): void;
    /** Start of each run. */
    reset(): void;
  };
  /**
   * After `gameOver` (human play): shows the continue screen and resolves
   * with the choice. On "continue" play resumes (call `sim.continueRun()`);
   * on "quit" the front end has already gone to the title.
   */
  showContinue(info: ContinueInfo): Promise<ContinueChoice>;
  readonly credits: {
    /** Plays the end credits crawl; resolves when it ends or is skipped. */
    roll(): Promise<void>;
    /** Called each time a roll finishes: set `credits.rollDone` here. */
    onDone(listener: () => void): () => void;
  };
  readonly tutorial: {
    /** The player confirmed "Skip onboarding": play `tutorial-skip`. */
    onSkip(listener: () => void): () => void;
  };
  dispose(): void;
}

/** Tiny listener set, returning an unsubscribe function. */
function listeners() {
  const set = new Set<() => void>();
  return {
    on(listener: () => void) {
      set.add(listener);
      return () => void set.delete(listener);
    },
    emit: () => set.forEach((listener) => listener()),
  };
}
const TOAST_MS = 3200;
const SAVE_CHIP_MS = 2400;

export function createFrontEnd(
  root: HTMLElement,
  options: FrontEndOptions,
): FrontEnd {
  const { settings, flags } = options;
  const hooks = options.hooks ?? {};
  const saves = options.saves ?? createSaveStore();
  const progress = options.progress ?? createProgressStore();
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
  const skipListeners = listeners();
  const creditsListeners = listeners();

  const lang = (): Lang => settings.get().textLang;

  const router = new Router(screens, () => {
    layer.classList.toggle("is-playing", router.depth === 0);
    updatePrompts();
  });

  const hud = createHud({
    t: (key, vars) => t(id(key), lang(), vars),
    lang,
    onSkipClick: () => requestTutorialSkip(),
    hasText,
    screenPositionOf: (entityId) => hooks.screenPositionOf?.(entityId) ?? null,
  });
  screens.before(hud.el);

  const ctx: UiContext = {
    settings,
    saves,
    progress,
    input,
    router,
    hooks,
    lang,
    t: (key, vars) => t(id(key), lang(), vars),
    inTutorial: () => playing && hud.inTutorial(),
    requestTutorialSkip: () => requestTutorialSkip(),
    startGame(request) {
      uiSound("confirm");
      playing = true;
      router.reset();
      hooks.onStartGame?.({ ...request, loadout: progress.get().loadout });
    },
    resume() {
      uiSound("pause_out");
      playing = true;
      router.reset();
      hooks.onResume?.();
    },
    quitToTitle() {
      playing = false;
      hud.reset();
      hooks.onQuitToTitle?.();
      router.reset(titleScreen(ctx));
    },
    restartCheckpoint() {
      playing = true;
      router.reset();
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

  /** Opens "Skip onboarding?" over the frozen tutorial (pause menu or HUD). */
  function requestTutorialSkip(): void {
    if (!playing || !hud.inTutorial()) return;
    if (router.depth === 0) hooks.onPause?.();
    router.push(tutorialSkipDialog(ctx, () => {
      playing = true;
      router.reset();
      hooks.onResume?.();
      skipListeners.emit();
    }, () => {
      // Back to wherever the skip was asked from (pause menu or play).
      if (router.depth === 0) hooks.onResume?.();
    }));
  }

  function updatePrompts(): void {
    layer.classList.toggle("is-in-run", playing);
    refreshPrompts(layer, settings.get(), input.device(), input.padFamily());
  }

  function applyDocumentState(): void {
    document.documentElement.lang = lang() === "zh" ? "zh-Hans" : lang();
    layer.dataset.device = input.device();
    const s = settings.get();
    layer.classList.toggle("is-calm", calm());
    // Layers outside the front end (subtitles) read calm from the root.
    document.documentElement.classList.toggle("nw-calm", calm());
    // HUD text grows with the subtitle size preference, at half the rate.
    layer.style.setProperty(
      "--nw-hud-scale",
      String(1 + (s.subtitles.scale - 1) * 0.5),
    );
    hud.relabel();
    buildLabel.replaceChildren(
      h("strong", {}, ctx.t("ui.build.label")),
      h("span", {}, ctx.t("ui.build.detail")),
    );
  }

  // Menu input dispatch (see the header comment and dispatch.ts).
  const offIntent = input.onIntent((event) => {
    const top = router.top();
    if (top?.onIntent?.(event)) return;
    const focused = document.activeElement;
    const inTop = top !== null && focused instanceof HTMLElement &&
      top.el.contains(focused);
    if (inTop && widgetIntent(focused, event)) {
      updatePrompts();
      return;
    }
    const decision = decideMenuIntent(event.intents, {
      inMenu: top !== null,
      playing,
      inTutorial: hud.inTutorial(),
      focusInTop: inTop,
    });
    switch (decision.kind) {
      case "ignore":
        return;
      case "pause":
        return pause("player");
      case "skipTutorial":
        return requestTutorialSkip();
      case "move":
        // An edge press (Left on a dialog's Cancel) bumps instead of silence.
        if (!moveFocus(top!.el, decision.direction)) uiSound("slider_end");
        return;
      case "focusDefault":
        return focusInitial(top!.el);
      case "activateFocused":
        return (focused as HTMLElement).click();
      case "back":
        uiSound("back");
        if (top!.onBack) top!.onBack();
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

  // Reduced motion: the setting, or the OS preference, either one is enough.
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () =>
    settings.get().accessibility.reduceMotion || motionQuery.matches;
  const onMotionQuery = () => layer.classList.toggle("is-calm", calm());
  motionQuery.addEventListener("change", onMotionQuery);

  // Settings changes: re-sync widgets; a text language change rebuilds.
  let lastLang = lang();
  const offSettings = settings.subscribe(() => {
    applyDocumentState();
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
  // `hangar` is listed explicitly until B adds it to `UiEntry` (wave 4 queue).
  const entries: Record<UiEntry | "hangar", () => void> = {
    menu: () => router.push(mainMenuScreen(ctx)),
    hangar: () => {
      router.push(mainMenuScreen(ctx));
      router.push(hangarScreen(ctx, ctx.progress, "browse"));
    },
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

  /**
   * Meta progress from run events: a first `intel` unlocks its codex entry
   * (with a toast), and a run's pay is banked toward mastery when it ends.
   */
  let runCredits = 0;
  function metaEvent(event: { readonly type: string }): void {
    const e = event as { type: string; codexId?: unknown; credits?: unknown };
    if (e.type === "payChanged" && typeof e.credits === "number") {
      runCredits = e.credits;
    }
    if (e.type === "intel" && typeof e.codexId === "string") {
      if (progress.unlockCodex(e.codexId)) {
        const titleId = `${e.codexId}.title`;
        ctx.toast(t(id("ui.codex.unlocked"), lang(), {
          title: hasText(titleId) ? t(lineId(titleId), lang()) : e.codexId,
        }));
        hooks.onCodexUnlocked?.(e.codexId);
      }
    }
    if (["gameOver", "bossDefeated", "bossSurvived"].includes(e.type)) {
      progress.bankPay(runCredits);
      runCredits = 0;
    }
  }

  function showContinue(info: ContinueInfo): Promise<ContinueChoice> {
    return new Promise((resolve) => {
      router.push(continueScreen(ctx, info, (choice) => {
        if (choice === "continue") {
          playing = true;
          router.reset();
        } else {
          ctx.quitToTitle();
        }
        resolve(choice);
      }));
    });
  }

  function rollCredits(): Promise<void> {
    return new Promise((resolve) => {
      router.push(creditsCrawlScreen(ctx, calm, () => {
        router.reset();
        creditsListeners.emit();
        resolve();
      }));
    });
  }

  return {
    input,
    isSimRunning: () => playing && router.depth === 0,
    quitToTitle: () => ctx.quitToTitle(),
    pause,
    showSaveIndicator,
    progress,
    hud: {
      update: (state) => hud.update(state),
      event: (event) => {
        hud.event(event);
        metaEvent(event);
      },
      radio: (line) => hud.radio(line),
      flag: (name, value) => hud.flag(name, value),
      reset: () => hud.reset(),
    },
    showContinue,
    credits: { roll: rollCredits, onDone: creditsListeners.on },
    tutorial: { onSkip: skipListeners.on },
    dispose() {
      motionQuery.removeEventListener("change", onMotionQuery);
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
