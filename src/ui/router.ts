/**
 * A stack of screens. Pushing a screen hides the page beneath it (or, for a
 * modal, dims it and makes it inert); popping restores the page and returns
 * focus to the element that opened the child. Screens are rebuilt from their
 * factories when the text language changes, so no screen has to know how to
 * re-translate itself.
 */

import type { IntentEvent } from "../input/inputLayer.ts";
import { focusInitial } from "./focus.ts";

export interface Screen {
  readonly el: HTMLElement;
  /** Modals draw over the page beneath instead of replacing it. */
  readonly modal?: boolean;
  /** Return true to consume an intent before default focus handling. */
  onIntent?(event: IntentEvent): boolean;
  /** Back or cancel. Defaults to popping this screen. */
  onBack?(): void;
  /**
   * Back means nothing here (the press-start gate, the title, a choice
   * that must be made), so the visible Back chip hides and system Back is
   * left to the browser. Screens with their own visible Skip set it too,
   * so one screen never shows two buttons that do the same thing.
   */
  readonly noBack?: boolean;
  /** Re-read settings into widgets after any settings change. */
  sync?(): void;
  dispose?(): void;
}

export type ScreenFactory = () => Screen;

interface Entry {
  readonly factory: ScreenFactory;
  screen: Screen;
  /** `data-key` of the last focused element, restored on return. */
  focusKey: string | null;
}

export class Router {
  readonly #root: HTMLElement;
  readonly #stack: Entry[] = [];
  readonly #onChange: () => void;

  constructor(root: HTMLElement, onChange: () => void) {
    this.#root = root;
    this.#onChange = onChange;
  }

  get depth(): number {
    return this.#stack.length;
  }

  top(): Screen | null {
    return this.#stack.at(-1)?.screen ?? null;
  }

  /**
   * Motion direction for CSS: going deeper slides in from the right, going
   * back from the left (Persona 5 and Destiny 2 encode depth this way).
   */
  #direction(nav: "forward" | "back" | "none"): void {
    this.#root.dataset.nav = nav;
  }

  push(factory: ScreenFactory): void {
    this.#direction("forward");
    this.#rememberFocus();
    const screen = factory();
    this.#stack.push({ factory, screen, focusKey: null });
    this.#root.appendChild(screen.el);
    this.#layout();
    focusInitial(screen.el);
    this.#onChange();
  }

  pop(): void {
    const entry = this.#stack.pop();
    if (!entry) return;
    this.#direction("back");
    entry.screen.dispose?.();
    entry.screen.el.remove();
    this.#layout();
    const top = this.#stack.at(-1);
    if (top) focusInitial(top.screen.el, top.focusKey);
    this.#onChange();
  }

  /** Swaps the top screen, e.g. a boot step leading to the next one. */
  replace(factory: ScreenFactory): void {
    const entry = this.#stack.pop();
    entry?.screen.dispose?.();
    entry?.screen.el.remove();
    this.push(factory);
  }

  /** Clears the stack, then pushes `factory` (or leaves it empty for play). */
  reset(factory?: ScreenFactory): void {
    while (this.#stack.length > 0) {
      const entry = this.#stack.pop()!;
      entry.screen.dispose?.();
      entry.screen.el.remove();
    }
    if (factory) this.push(factory);
    else {
      this.#layout();
      this.#onChange();
    }
  }

  /** Re-creates every screen from its factory, keeping focus positions. */
  rebuild(): void {
    this.#direction("none");
    this.#rememberFocus();
    for (const entry of this.#stack) {
      entry.screen.dispose?.();
      const fresh = entry.factory();
      entry.screen.el.replaceWith(fresh.el);
      entry.screen = fresh;
    }
    this.#layout();
    const top = this.#stack.at(-1);
    if (top) focusInitial(top.screen.el, top.focusKey);
  }

  syncAll(): void {
    for (const entry of this.#stack) entry.screen.sync?.();
  }

  #rememberFocus(): void {
    const top = this.#stack.at(-1);
    const active = document.activeElement as HTMLElement | null;
    if (top && active && top.screen.el.contains(active)) {
      top.focusKey = active.dataset.key ?? null;
    }
  }

  /**
   * Only the top screen is interactive. A page stays visible under modals
   * stacked on it; everything further down is hidden.
   */
  #layout(): void {
    let visibleFrom = this.#stack.length - 1;
    while (visibleFrom > 0 && this.#stack[visibleFrom].screen.modal) {
      visibleFrom--;
    }
    this.#stack.forEach((entry, i) => {
      const el = entry.screen.el;
      const isTop = i === this.#stack.length - 1;
      el.hidden = i < visibleFrom;
      el.inert = !isTop;
      el.classList.toggle("is-under-modal", !isTop && i >= visibleFrom);
    });
  }
}
