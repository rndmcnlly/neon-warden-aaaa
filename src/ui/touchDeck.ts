/**
 * The touch controls' DOM: a drag surface behind everything, and a deck
 * with FIRE, FOCUS and Pause. It only reports fingers to the input layer's
 * `TouchPilot`; what a finger means (tap, stream, Writ) is decided there and
 * in the sim, never here. Layout comes from the pure `touchLayout()`, written
 * to CSS variables that `#stage`, the HUD and subtitles all read, so the
 * canvas, its HUD and the controls never overlap in deck mode.
 *
 * Shown only on touch, during a run. The stage keeps its deck-mode box
 * under the pause menu too, so pausing never makes the playfield jump.
 */

import type { SettingsStore } from "../contracts/index.ts";
import type { InputLayer } from "../input/inputLayer.ts";
import { type Insets, type TouchLayout, touchLayout } from "./touchLayout.ts";
import { h } from "./widgets.ts";

export interface TouchDeck {
  readonly el: HTMLElement;
  /**
   * In a run on a touchscreen (`inRun`), and whether the sim is live
   * (`live`: no menu open). Call on any change of either.
   */
  setState(inRun: boolean, live: boolean): void;
  relabel(
    t: (key: "fire" | "focus" | "drag" | "latched" | "pause") => string,
  ): void;
  dispose(): void;
}

export interface TouchDeckOptions {
  readonly input: InputLayer;
  readonly settings: SettingsStore;
  readonly onPause: () => void;
}

/** Capture can fail for a pointer the browser no longer tracks; ignore it. */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // Synthetic test pointers and already-lifted fingers land here.
  }
}

/** Reads `env(safe-area-inset-*)` through a hidden probe element. */
function readInsets(probe: HTMLElement): Insets {
  const cs = getComputedStyle(probe);
  const px = (v: string) => Number.parseFloat(v) || 0;
  return {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
}

export function createTouchDeck(options: TouchDeckOptions): TouchDeck {
  const { input } = options;
  const pilot = input.touch.pilot;
  const probe = h("div", { class: "nw-safe-probe", "aria-hidden": "true" });
  const drag = h("div", { class: "nw-touch-drag", "data-qa": "touch-drag" });
  const hint = h("p", { class: "nw-touch-hint" });
  const fire = h(
    "button",
    {
      type: "button",
      class: "nw-touch-fire",
      "data-qa": "touch-fire",
    },
    h("span", { class: "nw-touch-fire-label" }),
    h("small", {}),
  );
  const focus = h("button", {
    type: "button",
    class: "nw-touch-focus",
    "data-qa": "touch-focus",
    "aria-pressed": "false",
  });
  const pauseBtn = h("button", {
    type: "button",
    class: "nw-touch-pause",
    "data-qa": "touch-pause",
  }, h("span", { class: "nw-pause-glyph", "aria-hidden": "true" }));
  const controls = h(
    "div",
    { class: "nw-touch-controls" },
    hint,
    focus,
    fire,
  );
  const el = h(
    "div",
    { class: "nw-touch", hidden: true },
    probe,
    drag,
    controls,
    pauseBtn,
  );

  let inRun = false;
  let live = false;
  let raf = 0;

  // ---- fingers -----------------------------------------------------------
  // Pointer capture keeps a finger's events here even when it slides over a
  // button or off the deck; `pointercancel` (an OS gesture) is a release.
  drag.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    if (pilot.moveStart(e.pointerId, e.clientX, e.clientY, e.timeStamp)) {
      capture(drag, e.pointerId);
    }
  });
  drag.addEventListener("pointermove", (e) => {
    pilot.moveTo(
      e.pointerId,
      e.clientX,
      e.clientY,
      e.timeStamp,
      input.touch.config(),
    );
  });
  const lift = (e: PointerEvent) => pilot.moveEnd(e.pointerId);
  drag.addEventListener("pointerup", lift);
  drag.addEventListener("pointercancel", lift);

  fire.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    capture(fire, e.pointerId);
    pilot.fireStart(e.timeStamp);
    // A felt click where the platform allows it (Android); iOS has none.
    navigator.vibrate?.(8);
  });
  const fireUp = () => pilot.fireEnd(input.touch.config());
  fire.addEventListener("pointerup", fireUp);
  fire.addEventListener("pointercancel", fireUp);
  // Keyboard activation of a focused FIRE does nothing: keys have Space.
  fire.addEventListener("click", (e) => e.preventDefault());

  focus.addEventListener("click", () => pilot.toggleFocus());
  pauseBtn.addEventListener("click", () => options.onPause());

  // ---- layout ------------------------------------------------------------
  function layout(): void {
    const root = document.documentElement;
    const on = inRun;
    root.classList.toggle("nw-touch-run", on);
    if (!on) return;
    const next: TouchLayout = touchLayout(
      innerWidth,
      innerHeight,
      readInsets(probe),
    );
    const set = (name: string, px: number) =>
      root.style.setProperty(name, `${Math.round(px)}px`);
    set("--nw-stage-x", next.stage.x);
    set("--nw-stage-y", next.stage.y);
    set("--nw-stage-w", next.stage.width);
    set("--nw-stage-h", next.stage.height);
    set("--nw-controls-x", next.controls.x);
    set("--nw-controls-y", next.controls.y);
    set("--nw-controls-w", next.controls.width);
    set("--nw-controls-h", next.controls.height);
    root.dataset.touchMode = next.mode;
    el.dataset.mode = next.mode;
  }

  /** Settings that change the deck's look: scheme and FIRE side. */
  function applyScheme(): void {
    const c = options.settings.get().controls;
    el.dataset.scheme = c.touchScheme;
    el.dataset.fireSide = c.fireSide;
  }
  const offSettings = options.settings.subscribe(applyScheme);
  applyScheme();

  function frame(): void {
    raf = requestAnimationFrame(frame);
    const v = pilot.view;
    fire.classList.toggle("is-held", v.fireHeld);
    fire.classList.toggle("is-latched", v.latched);
    focus.classList.toggle("is-on", v.focus);
    focus.setAttribute("aria-pressed", String(v.focus));
    el.classList.toggle("is-flying", v.flying);
  }

  addEventListener("resize", layout);
  // Rotation on iOS settles its insets a frame after `resize`.
  const onRotate = () => setTimeout(layout, 120);
  addEventListener("orientationchange", onRotate);

  return {
    el,
    setState(nextInRun, nextLive) {
      inRun = nextInRun;
      live = nextLive;
      el.hidden = !(inRun && live);
      if (!inRun || !live) pilot.reset();
      layout();
      cancelAnimationFrame(raf);
      if (inRun && live) raf = requestAnimationFrame(frame);
    },
    relabel(t) {
      fire.querySelector(".nw-touch-fire-label")!.textContent = t("fire");
      fire.querySelector("small")!.textContent = t("latched");
      focus.textContent = t("focus");
      hint.textContent = t("drag");
      pauseBtn.setAttribute("aria-label", t("pause"));
    },
    dispose() {
      cancelAnimationFrame(raf);
      offSettings();
      removeEventListener("resize", layout);
      removeEventListener("orientationchange", onRotate);
      document.documentElement.classList.remove("nw-touch-run");
      el.remove();
    },
  };
}
