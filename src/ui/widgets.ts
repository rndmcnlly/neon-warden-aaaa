/**
 * Menu building blocks. Each settings row is ONE focusable element (console
 * style): up and down move between rows, left and right adjust the focused
 * row, confirm toggles or cycles it. Mouse users click, drag or use the
 * arrow buttons on the same row, so every input method reaches every control.
 *
 * Each widget returns `{ el, sync }`; `sync()` re-reads the settings store so
 * a change made anywhere (reset, another screen) shows up immediately.
 */

import type { IntentEvent, MenuIntent } from "../input/inputLayer.ts";
import { focusElement } from "./focus.ts";
import { uiSound, type UiSoundRole } from "./sound.ts";

export interface Widget {
  readonly el: HTMLElement;
  sync(): void;
}

/** Per-element intent handlers, consulted before spatial navigation. */
const handlers = new WeakMap<HTMLElement, (intent: MenuIntent) => boolean>();

export function widgetIntent(el: Element | null, event: IntentEvent): boolean {
  const handler = el instanceof HTMLElement ? handlers.get(el) : undefined;
  if (!handler) return false;
  for (const intent of event.intents) if (handler(intent)) return true;
  return false;
}

type Child = Node | string | null | undefined | false;

/** Tiny element builder: `h("div", { class: "x" }, child, "text")`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** A device-following prompt glyph; see `prompts.ts`. */
export function glyph(action: string): HTMLElement {
  return h("kbd", { class: "nw-glyph", "data-action": action });
}

/**
 * Bottom bar of prompts, e.g. [[confirm, "Select"], [back, "Back"]]. A
 * "back" entry is dropped: the front end's one Back chip (a real button,
 * glyph included) stands in for it on every screen, so Back never appears
 * twice or as an unclickable label.
 */
export function promptBar(entries: readonly [string, string][]): HTMLElement {
  return h(
    "div",
    { class: "nw-prompts", "aria-hidden": "true" },
    ...entries.filter(([action]) => action !== "back").map(([action, label]) =>
      h("span", { class: "nw-prompt" }, glyph(action), label)
    ),
  );
}

/** Mouse hover moves focus, so hover and focus never disagree. */
function hoverFocuses(el: HTMLElement): void {
  el.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && document.activeElement !== el) {
      focusElement(el);
    }
  });
}

/** Plays the focus sound whenever focus lands here, from any device. */
function focusSound(el: HTMLElement): void {
  el.addEventListener("focus", () => uiSound("focus"));
}

function navigable(el: HTMLElement, key: string): void {
  el.dataset.nav = "";
  el.dataset.key = key;
  if (!(el instanceof HTMLButtonElement)) el.tabIndex = 0;
  hoverFocuses(el);
  focusSound(el);
}

export interface ButtonOptions {
  readonly key: string;
  readonly label: string;
  readonly onActivate: () => void;
  readonly hint?: string;
  readonly badge?: string;
  readonly sound?: UiSoundRole;
  /** Focusable but inert, with `hint` explaining why (better than hiding). */
  readonly unavailable?: boolean;
  readonly autofocus?: boolean;
  readonly className?: string;
}

export function button(options: ButtonOptions): HTMLButtonElement {
  const el = h(
    "button",
    {
      type: "button",
      class: `nw-button ${options.className ?? ""}`.trim(),
      "data-autofocus": options.autofocus,
      "aria-disabled": options.unavailable ? "true" : undefined,
    },
    h("span", { class: "nw-button-label" }, options.label),
    options.badge ? h("span", { class: "nw-badge" }, options.badge) : null,
    options.hint ? h("span", { class: "nw-button-hint" }, options.hint) : null,
  );
  navigable(el, options.key);
  el.addEventListener("click", () => {
    if (options.unavailable) {
      uiSound("locked");
      return;
    }
    uiSound(options.sound ?? "confirm");
    options.onActivate();
  });
  return el;
}

function row(key: string, label: string, role: string, hint?: string) {
  const value = h("span", { class: "nw-row-value" });
  const control = h("span", { class: "nw-row-control" }, value);
  const el = h(
    "div",
    { class: "nw-row", role, "aria-label": label },
    h(
      "span",
      { class: "nw-row-text" },
      h("span", { class: "nw-row-label" }, label),
      hint ? h("span", { class: "nw-row-hint" }, hint) : null,
    ),
    control,
  );
  navigable(el, key);
  return { el, control, value };
}

export interface ToggleOptions {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly onText: string;
  readonly offText: string;
  readonly get: () => boolean;
  readonly set: (value: boolean) => void;
}

export function toggleRow(options: ToggleOptions): Widget {
  const { el, value } = row(options.key, options.label, "switch", options.hint);
  const pill = h(
    "span",
    { class: "nw-switch" },
    h("span", { class: "nw-switch-knob" }),
  );
  value.before(pill);
  const flip = (next: boolean) => {
    if (next === options.get()) return;
    uiSound(next ? "toggle_on" : "toggle_off");
    options.set(next);
  };
  el.addEventListener("click", () => flip(!options.get()));
  handlers.set(el, (intent) => {
    if (intent === "confirm") flip(!options.get());
    else if (intent === "left") flip(false);
    else if (intent === "right") flip(true);
    else return false;
    return true;
  });
  const sync = () => {
    const on = options.get();
    el.setAttribute("aria-checked", String(on));
    el.classList.toggle("is-on", on);
    value.textContent = on ? options.onText : options.offText;
  };
  sync();
  return { el, sync };
}

export interface ChoiceOptions<T> {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly get: () => T;
  readonly set: (value: T) => void;
}

/** A left/right cycler, the console stand-in for a dropdown. */
export function choiceRow<T>(options: ChoiceOptions<T>): Widget {
  const { el, control, value } = row(
    options.key,
    options.label,
    "group",
    options.hint,
  );
  const prev = h("span", { class: "nw-arrow", "aria-hidden": "true" }, "◂");
  const next = h("span", { class: "nw-arrow", "aria-hidden": "true" }, "▸");
  const dots = h("span", { class: "nw-dots", "aria-hidden": "true" });
  control.prepend(prev);
  control.append(next, dots);
  for (let i = 0; i < options.options.length; i++) dots.append(h("i"));

  const step = (delta: number, wrap: boolean) => {
    const index = options.options.findIndex((o) => o.value === options.get());
    let target = index + delta;
    if (wrap) {
      target = (target + options.options.length) % options.options.length;
    }
    if (target < 0 || target >= options.options.length) {
      uiSound("slider_end");
      return;
    }
    uiSound("slider_tick");
    options.set(options.options[target].value);
  };
  prev.addEventListener("click", (e) => {
    e.stopPropagation();
    step(-1, false);
  });
  next.addEventListener("click", (e) => {
    e.stopPropagation();
    step(1, false);
  });
  el.addEventListener("click", () => step(1, true));
  handlers.set(el, (intent) => {
    if (intent === "left") step(-1, false);
    else if (intent === "right") step(1, false);
    else if (intent === "confirm") step(1, true);
    else return false;
    return true;
  });
  const sync = () => {
    const index = options.options.findIndex((o) => o.value === options.get());
    value.textContent = options.options[index]?.label ?? "";
    [...dots.children].forEach((dot, i) =>
      dot.classList.toggle("is-on", i === index)
    );
  };
  sync();
  return { el, sync };
}

export interface SliderOptions {
  readonly key: string;
  readonly label: string;
  readonly hint?: () => string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly get: () => number;
  readonly set: (value: number) => void;
}

export function sliderRow(options: SliderOptions): Widget {
  const { el, control, value } = row(options.key, options.label, "slider");
  const hint = options.hint ? h("span", { class: "nw-row-hint" }) : null;
  if (hint) el.querySelector(".nw-row-text")!.append(hint);
  const fill = h("span", { class: "nw-track-fill" });
  const track = h("span", { class: "nw-track" }, fill);
  control.prepend(track);
  el.setAttribute("aria-valuemin", String(options.min));
  el.setAttribute("aria-valuemax", String(options.max));

  const snap = (raw: number) => {
    const stepped = Math.round((raw - options.min) / options.step) *
        options.step + options.min;
    return Math.min(options.max, Math.max(options.min, +stepped.toFixed(4)));
  };
  const apply = (raw: number) => {
    const next = snap(raw);
    if (next === options.get()) {
      if (raw < options.min || raw > options.max) uiSound("slider_end");
      return;
    }
    uiSound(
      next === options.min || next === options.max
        ? "slider_end"
        : "slider_tick",
    );
    options.set(next);
  };
  handlers.set(el, (intent) => {
    if (intent === "left") apply(options.get() - options.step);
    else if (intent === "right") apply(options.get() + options.step);
    else return false;
    return true;
  });

  // Pointer drag on the track; capture keeps the drag alive off the track.
  const fromPointer = (event: PointerEvent) => {
    const rect = track.getBoundingClientRect();
    const t = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    apply(options.min + t * (options.max - options.min));
  };
  track.addEventListener("pointerdown", (event) => {
    track.setPointerCapture(event.pointerId);
    fromPointer(event);
  });
  track.addEventListener("pointermove", (event) => {
    if (track.hasPointerCapture(event.pointerId)) fromPointer(event);
  });

  const sync = () => {
    const current = options.get();
    const t = (current - options.min) / (options.max - options.min);
    fill.style.width = `${t * 100}%`;
    value.textContent = options.format(current);
    el.setAttribute("aria-valuenow", String(current));
    el.setAttribute("aria-valuetext", options.format(current));
    if (hint && options.hint) hint.textContent = options.hint();
  };
  sync();
  return { el, sync };
}

/**
 * Numbers the children of `list` (`--i`) so CSS can stagger their entrance
 * by 25 ms each, capped at eight rows (200 ms) so long lists never lag.
 */
export function stagger(list: HTMLElement): HTMLElement {
  [...list.children].forEach((child, i) => {
    if (child instanceof HTMLElement) {
      child.style.setProperty("--i", String(Math.min(i, 8)));
    }
  });
  return list;
}

/** Builds the common screen frame: a glassy panel with title and prompts. */
export function panel(options: {
  readonly id: string;
  readonly title?: string;
  readonly className?: string;
  readonly wrap?: boolean;
  readonly body: Child[];
  readonly prompts?: readonly [string, string][];
}): HTMLElement {
  const screen = h("section", {
    class: `nw-screen nw-screen-${options.id} ${options.className ?? ""}`
      .trim(),
    "data-wrap": options.wrap ? "vertical" : undefined,
    "aria-label": options.title,
  });
  const box = h(
    "div",
    { class: "nw-panel" },
    options.title ? h("h2", { class: "nw-title" }, options.title) : null,
    ...options.body,
  );
  box.querySelectorAll<HTMLElement>(".nw-menu, .nw-grid, .nw-tiles, .nw-beats")
    .forEach(stagger);
  screen.append(box);
  if (options.prompts) screen.append(promptBar(options.prompts));
  return screen;
}
