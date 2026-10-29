/**
 * Modal dialogs: honest stubs ("not included in this vertical slice"),
 * plain messages, and confirmations for destructive actions. Confirmations
 * always open with focus on the safe choice (XAG 115).
 */

import type { UiContext } from "../context.ts";
import type { ScreenFactory } from "../router.ts";
import { uiSound } from "../sound.ts";
import type { UiKey } from "../../i18n/index.ts";
import { button, h, panel } from "../widgets.ts";

export interface MessageOptions {
  readonly title: UiKey;
  readonly body: UiKey;
  /** Show the "Not included in this vertical slice" badge. */
  readonly stub?: boolean;
}

export function messageDialog(
  ctx: UiContext,
  options: MessageOptions,
): ScreenFactory {
  return () => {
    uiSound(options.stub ? "locked" : "menu_open");
    const el = panel({
      id: "dialog",
      className: "is-modal",
      title: ctx.t(options.title),
      body: [
        options.stub
          ? h("p", { class: "nw-stub-badge" }, ctx.t("ui.stub.badge"))
          : null,
        h("p", { class: "nw-body" }, ctx.t(options.body)),
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "ok",
            label: ctx.t("ui.stub.ok"),
            autofocus: true,
            sound: "back",
            onActivate: () => ctx.router.pop(),
          }),
        ),
      ],
      prompts: [["confirm", ctx.t("ui.common.select")], [
        "back",
        ctx.t("ui.common.back"),
      ]],
    });
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    return { el, modal: true };
  };
}

/** Shortcut for the many stub tiles: title plus a stub body. */
export function stubDialog(
  ctx: UiContext,
  title: UiKey,
  body: UiKey,
): ScreenFactory {
  return messageDialog(ctx, { title, body, stub: true });
}

export interface ConfirmOptions {
  readonly title: UiKey;
  readonly body: UiKey;
  readonly confirmLabel: UiKey;
  readonly cancelLabel?: UiKey;
  readonly onConfirm: () => void;
  /** Runs after Cancel or Back closes the dialog. */
  readonly onCancel?: () => void;
  /**
   * Open with focus on the confirm button. Only for choices that lose
   * nothing (skipping onboarding); destructive ones keep the safe default.
   */
  readonly focusConfirm?: boolean;
}

export function confirmDialog(
  ctx: UiContext,
  options: ConfirmOptions,
): ScreenFactory {
  return () => {
    uiSound("notify");
    const cancel = () => {
      ctx.router.pop();
      options.onCancel?.();
    };
    const el = panel({
      id: "dialog",
      className: "is-modal is-confirm",
      title: ctx.t(options.title),
      body: [
        h("p", { class: "nw-body" }, ctx.t(options.body)),
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "cancel",
            label: ctx.t(options.cancelLabel ?? "ui.common.cancel"),
            autofocus: !options.focusConfirm,
            sound: "back",
            onActivate: cancel,
          }),
          button({
            key: "confirm",
            className: options.focusConfirm ? undefined : "is-destructive",
            label: ctx.t(options.confirmLabel),
            autofocus: options.focusConfirm,
            onActivate: () => {
              ctx.router.pop();
              options.onConfirm();
            },
          }),
        ),
      ],
      prompts: [["confirm", ctx.t("ui.common.select")], [
        "back",
        ctx.t("ui.common.cancel"),
      ]],
    });
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    return { el, modal: true, onBack: cancel };
  };
}
