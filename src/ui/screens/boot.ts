/**
 * The boot sequence, in the order the web requires:
 *
 * 1. Press-any-key gate. Browsers block audio until a user gesture, so this
 *    screen is functional, not nostalgia. Nothing plays before it.
 * 2. Photosensitivity notice, with the first-sound choices (text language,
 *    subtitles, reduce flashing) so they can be set before any voice plays.
 * 3. Logo slot. The renderer or Director fills it through
 *    `hooks.playBootLogos`; a CSS placeholder runs until then. Skippable.
 * 4. Title, then the main menu (see `menus.ts`).
 */

import { type Lang, LANGS } from "../../contracts/index.ts";
import type { UiContext } from "../context.ts";
import type { ScreenFactory } from "../router.ts";
import type { UiKey } from "../../i18n/index.ts";
import { button, choiceRow, glyph, h, panel, toggleRow } from "../widgets.ts";
import { mainMenuScreen } from "./menus.ts";

export function gateScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const el = h(
      "section",
      {
        class: "nw-screen nw-screen-gate",
        "aria-label": ctx.t("ui.title.name"),
      },
      h("p", { class: "nw-gate-prompt nw-pulse" }, ctx.t("ui.gate.prompt")),
      h("p", { class: "nw-gate-note" }, ctx.t("ui.gate.note")),
    );
    let done = false;
    const proceed = () => {
      if (done) return;
      done = true;
      ctx.hooks.onAudioUnlock?.();
      // Defer one task so the same key press is not also read by the next
      // screen as "confirm" (which would skip the notice unread).
      setTimeout(() => ctx.router.replace(noticeScreen(ctx)), 0);
    };
    // Mouse proceeds on click (release), keys and buttons on press.
    el.addEventListener("click", proceed);
    const stop = ctx.input.onAnyPress((device) => {
      // Pointers proceed on click (release); keys and buttons on press.
      if (device !== "mouse" && device !== "touch") proceed();
    });
    return {
      el,
      onIntent: () => true,
      onBack: () => {},
      noBack: true,
      dispose: stop,
    };
  };
}

function langOptions(ctx: UiContext) {
  return LANGS.map((lang) => ({
    value: lang,
    label: ctx.t(`ui.lang.${lang}` as UiKey),
  }));
}

export function noticeScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const s = ctx.settings;
    const widgets = [
      choiceRow<Lang>({
        key: "textLang",
        label: ctx.t("ui.settings.textLang"),
        options: langOptions(ctx),
        get: () => s.get().textLang,
        set: (textLang) => s.update((c) => ({ ...c, textLang })),
      }),
      toggleRow({
        key: "subtitles",
        label: ctx.t("ui.settings.subtitles"),
        onText: ctx.t("ui.common.on"),
        offText: ctx.t("ui.common.off"),
        get: () => s.get().subtitles.enabled,
        set: (enabled) =>
          s.update((c) => ({ ...c, subtitles: { ...c.subtitles, enabled } })),
      }),
      toggleRow({
        key: "reducedFlashing",
        label: ctx.t("ui.settings.reducedFlashing"),
        onText: ctx.t("ui.common.on"),
        offText: ctx.t("ui.common.off"),
        get: () => s.get().accessibility.reducedFlashing,
        set: (reducedFlashing) =>
          s.update((c) => ({
            ...c,
            accessibility: { ...c.accessibility, reducedFlashing },
          })),
      }),
    ];
    const el = panel({
      id: "notice",
      title: ctx.t("ui.notice.title"),
      wrap: true,
      body: [
        h("p", { class: "nw-body" }, ctx.t("ui.notice.body")),
        h("h3", { class: "nw-subhead" }, ctx.t("ui.notice.firstSound")),
        h("div", { class: "nw-rows" }, ...widgets.map((w) => w.el)),
        h("p", { class: "nw-footnote" }, ctx.t("ui.notice.changeLater")),
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "continue",
            label: ctx.t("ui.notice.continue"),
            autofocus: true,
            onActivate: () => ctx.router.replace(logoScreen(ctx)),
          }),
        ),
      ],
      prompts: [["confirm", ctx.t("ui.common.select")], [
        "adjust",
        ctx.t("ui.common.adjust"),
      ]],
    });
    return {
      el,
      onBack: () => {},
      noBack: true,
      sync: () => widgets.forEach((w) => w.sync()),
    };
  };
}

/** Respects the OS reduced-motion preference for the placeholder animation. */
function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** CSS-only stand-in for the real 3D logo sequence. */
async function placeholderLogos(
  ctx: UiContext,
  slot: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const cards: [UiKey, UiKey, string][] = [
    ["ui.logo.studio", "ui.logo.studioTag", "is-studio"],
    ["ui.logo.publisher", "ui.logo.publisherTag", "is-publisher"],
  ];
  const holdMs = prefersReducedMotion() ? 1200 : 2400;
  for (const [name, tag, className] of cards) {
    if (signal.aborted) return;
    const card = h(
      "div",
      { class: `nw-logo ${className}` },
      h("div", { class: "nw-logo-mark" }),
      h("div", { class: "nw-logo-name" }, ctx.t(name)),
      h("div", { class: "nw-logo-tag" }, ctx.t(tag)),
    );
    slot.replaceChildren(card);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, holdMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
}

export function logoScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const slot = h("div", { class: "nw-logo-slot" });
    const el = h(
      "section",
      { class: "nw-screen nw-screen-logos" },
      slot,
      h(
        "div",
        { class: "nw-prompts nw-skip" },
        h(
          "span",
          { class: "nw-prompt" },
          glyph("confirm"),
          ctx.t("ui.logo.skip"),
        ),
      ),
    );
    const abort = new AbortController();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      abort.abort();
      setTimeout(() => ctx.router.replace(titleScreen(ctx)), 0);
    };
    const play = ctx.hooks.playBootLogos ??
      ((s: HTMLElement, sig: AbortSignal) => placeholderLogos(ctx, s, sig));
    // Start after the screen is attached, so the hook can measure the slot.
    queueMicrotask(() => play(slot, abort.signal).then(finish, finish));
    el.addEventListener("click", finish);
    return {
      el,
      onIntent: (event) => {
        if (event.intents.has("confirm") || event.intents.has("back")) finish();
        return true;
      },
      onBack: finish,
      // The logos show their own touch-safe Skip.
      noBack: true,
      dispose: () => abort.abort(),
    };
  };
}

export function titleScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const el = h(
      "section",
      { class: "nw-screen nw-screen-title" },
      h(
        "div",
        { class: "nw-logotype" },
        h("h1", { class: "nw-logotype-name" }, ctx.t("ui.title.name")),
        h("p", { class: "nw-logotype-sub" }, ctx.t("ui.title.chapter")),
      ),
      h(
        "p",
        { class: "nw-press nw-pulse" },
        glyph("confirm"),
        ctx.t("ui.title.press"),
      ),
    );
    const open = () => ctx.router.replace(mainMenuScreen(ctx));
    el.addEventListener("click", open);
    return {
      el,
      onIntent: (event) => {
        if (event.intents.has("confirm")) open();
        return true;
      },
      onBack: () => {},
      noBack: true,
    };
  };
}
