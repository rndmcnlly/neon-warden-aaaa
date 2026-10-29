/**
 * The pause menu, opened by the pause binding or automatically when the tab
 * loses focus, the controller disconnects, or fullscreen ends. It sits as a
 * modal over the frozen game, so Settings opened from here returns here with
 * gameplay state untouched.
 */

import type { UiContext } from "../context.ts";
import type { ScreenFactory } from "../router.ts";
import type { UiKey } from "../../i18n/index.ts";
import { ACTIONS } from "../../input/bindings.ts";
import { button, glyph, h, panel } from "../widgets.ts";
import { confirmDialog } from "./dialogs.ts";
import { settingsScreen } from "./settings.ts";

export type PauseReason = "player" | "blur" | "gamepad" | "fullscreen";

const REASON_TEXT: Partial<Record<PauseReason, UiKey>> = {
  blur: "ui.pause.reasonBlur",
  gamepad: "ui.pause.reasonPad",
  fullscreen: "ui.pause.reasonFullscreen",
};

export function pauseScreen(
  ctx: UiContext,
  reason: PauseReason,
): ScreenFactory {
  return () => {
    const reasonKey = REASON_TEXT[reason];
    const el = panel({
      id: "pause",
      className: "is-modal",
      title: ctx.t("ui.pause.title"),
      wrap: true,
      body: [
        reasonKey
          ? h("p", { class: "nw-notice", role: "status" }, ctx.t(reasonKey))
          : null,
        h("p", { class: "nw-objective" }, ctx.t("ui.pause.objective")),
        h(
          "nav",
          { class: "nw-menu" },
          button({
            key: "resume",
            label: ctx.t("ui.pause.resume"),
            autofocus: true,
            sound: "pause_out",
            onActivate: () => ctx.resume(),
          }),
          button({
            key: "restart",
            label: ctx.t("ui.pause.restart"),
            onActivate: () =>
              ctx.router.push(confirmDialog(ctx, {
                title: "ui.confirm.restartTitle",
                body: "ui.confirm.restartBody",
                confirmLabel: "ui.confirm.restartYes",
                cancelLabel: "ui.confirm.keep",
                onConfirm: () => ctx.restartCheckpoint(),
              })),
          }),
          button({
            key: "settings",
            label: ctx.t("ui.pause.settings"),
            sound: "menu_open",
            onActivate: () => ctx.router.push(settingsScreen(ctx)),
          }),
          button({
            key: "controls",
            label: ctx.t("ui.pause.controls"),
            sound: "menu_open",
            onActivate: () => ctx.router.push(controlsReference(ctx)),
          }),
          button({
            key: "quit",
            label: ctx.t("ui.pause.quit"),
            onActivate: () =>
              ctx.router.push(confirmDialog(ctx, {
                title: "ui.confirm.quitTitle",
                body: "ui.confirm.quitBody",
                confirmLabel: "ui.confirm.quitYes",
                cancelLabel: "ui.confirm.keep",
                onConfirm: () => ctx.quitToTitle(),
              })),
          }),
        ),
        h("p", { class: "nw-footnote" }, ctx.t("ui.build.detail")),
      ],
      prompts: [["confirm", ctx.t("ui.common.select")], [
        "back",
        ctx.t("ui.pause.resume"),
      ]],
    });
    return {
      el,
      modal: true,
      onBack: () => ctx.resume(),
      onIntent: (event) => {
        // Pause again resumes, unless the same key also means "back" (Esc),
        // which the default back handling already turns into resume.
        if (event.intents.has("pause") && !event.intents.has("back")) {
          ctx.resume();
          return true;
        }
        return false;
      },
    };
  };
}

/** Read-only controls reminder for mid-game (GAG intermediate). */
function controlsReference(ctx: UiContext): ScreenFactory {
  return () => {
    const list = h(
      "dl",
      { class: "nw-controls-ref" },
      ...ACTIONS.flatMap((action) => [
        h("dt", {}, ctx.t(`ui.action.${action}` as UiKey)),
        h("dd", {}, glyph(action)),
      ]),
    );
    const el = panel({
      id: "controlsRef",
      className: "is-modal",
      title: ctx.t("ui.pause.controls"),
      body: [
        list,
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "ok",
            label: ctx.t("ui.common.back"),
            autofocus: true,
            sound: "back",
            onActivate: () => ctx.router.pop(),
          }),
        ),
      ],
      prompts: [["back", ctx.t("ui.common.back")]],
    });
    return { el, modal: true };
  };
}
