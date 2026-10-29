/**
 * Screens that interrupt a run: the continue screen after a game over, the
 * end credits crawl, and the tutorial skip confirmation. Each one takes a
 * callback for its outcome, so `frontEnd.ts` decides what happens next and
 * these stay simple to read.
 */

import type { UiContext } from "../context.ts";
import { type CreditName, CREDITS, STUDIO } from "../creditsRoll.ts";
import type { ScreenFactory } from "../router.ts";
import { uiSound } from "../sound.ts";
import { button, h, panel } from "../widgets.ts";
import { confirmDialog } from "./dialogs.ts";

// ------------------------------------------------------------ continue

export interface ContinueInfo {
  readonly continuesLeft: number;
  readonly score: number;
}

export type ContinueChoice = "continue" | "quit";

/** The original's "GAME OVER / The lanes stay closed", plus the choice. */
export function continueScreen(
  ctx: UiContext,
  info: ContinueInfo,
  choose: (choice: ContinueChoice) => void,
): ScreenFactory {
  return () => {
    uiSound("notify");
    const canContinue = info.continuesLeft > 0;
    const el = panel({
      id: "continue",
      className: "is-modal",
      body: [
        h(
          "p",
          { class: "nw-banner-title is-gameover" },
          ctx.t("ui.banner.gameOver"),
        ),
        h("p", { class: "nw-banner-sub" }, ctx.t("ui.banner.lanesClosed")),
        h(
          "p",
          { class: "nw-continue-score" },
          ctx.t("ui.continue.score", {
            score: info.score.toLocaleString(
              ctx.lang() === "zh" ? "zh-CN" : ctx.lang(),
            ),
          }),
        ),
        h(
          "p",
          { class: "nw-body" },
          canContinue
            ? ctx.t("ui.continue.left", { count: info.continuesLeft })
            : ctx.t("ui.continue.none"),
        ),
        canContinue
          ? h("h2", { class: "nw-title" }, ctx.t("ui.continue.prompt"))
          : null,
        h(
          "nav",
          { class: "nw-menu" },
          canContinue
            ? button({
              key: "continue",
              label: ctx.t("ui.continue.yes"),
              autofocus: true,
              onActivate: () => choose("continue"),
            })
            : null,
          button({
            key: "quit",
            label: ctx.t("ui.continue.no"),
            autofocus: !canContinue,
            sound: "back",
            onActivate: () => choose("quit"),
          }),
        ),
      ],
      wrap: true,
      prompts: [["confirm", ctx.t("ui.common.select")]],
    });
    el.setAttribute("role", "alertdialog");
    // Back does nothing here: leaving is an explicit choice, not a reflex.
    return { el, modal: true, onBack: () => {}, noBack: true };
  };
}

// ------------------------------------------------------- credits crawl

/** Crawl speed in CSS pixels per second, and the calm mode's page hold. */
const CRAWL_PX_PER_S = 70;
const PAGE_MS = 3400;

function creditName(ctx: UiContext, name: CreditName): string {
  if ("agent" in name) return ctx.t("ui.crawl.agent", { model: name.agent });
  if ("text" in name) return ctx.t(name.text);
  return name.name;
}

/** Builds the crawl's sections; exported shape is plain DOM for the screen. */
function crawlSections(ctx: UiContext): HTMLElement[] {
  const opening = h(
    "section",
    { class: "nw-crawl-section is-opening" },
    h(
      "p",
      { class: "nw-crawl-studio" },
      ctx.t("ui.crawl.presents", { studio: STUDIO }),
    ),
    h("p", { class: "nw-crawl-name" }, ctx.t("ui.crawl.incubated")),
    h("p", { class: "nw-crawl-note" }, ctx.t("ui.crawl.agentNote")),
  );
  const sections = CREDITS.map((section) =>
    h(
      "section",
      { class: "nw-crawl-section" },
      h("h3", { class: "nw-crawl-heading" }, ctx.t(section.heading)),
      ...section.roles.map((role) =>
        h(
          "div",
          { class: "nw-crawl-role" },
          role.role
            ? h("p", { class: "nw-crawl-title" }, ctx.t(role.role))
            : null,
          ...role.names.map((name) =>
            h("p", { class: "nw-crawl-name" }, creditName(ctx, name))
          ),
        )
      ),
    )
  );
  const closing = h(
    "section",
    { class: "nw-crawl-section is-closing" },
    h("p", { class: "nw-crawl-name" }, ctx.t("ui.crawl.role.lastLine")),
    h("p", { class: "nw-crawl-note" }, ctx.t("ui.build.detail")),
  );
  return [opening, ...sections, closing];
}

/**
 * The end credits. Scrolls upward, or with reduced motion turns pages
 * (one department at a time, no movement). Confirm or Back skips; `done`
 * runs exactly once either way.
 */
export function creditsCrawlScreen(
  ctx: UiContext,
  calm: () => boolean,
  done: () => void,
): ScreenFactory {
  return () => {
    const sections = crawlSections(ctx);
    const reel = h("div", { class: "nw-crawl-reel" }, ...sections);
    const viewport = h("div", { class: "nw-crawl-viewport" }, reel);
    const skip = button({
      key: "skip",
      label: ctx.t("ui.crawl.skip"),
      className: "nw-crawl-skip",
      autofocus: true,
      sound: "back",
      onActivate: () => finish(),
    });
    const el = h(
      "section",
      {
        class: "nw-screen nw-screen-crawl",
        "aria-label": ctx.t("ui.credits.title"),
      },
      viewport,
      h("div", { class: "nw-crawl-actions" }, skip),
    );

    let finished = false;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function finish(): void {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      done();
    }

    if (calm()) {
      el.classList.add("is-paged");
      let page = 0;
      const show = () => {
        sections.forEach((s, i) => (s.hidden = i !== page));
        page++;
        timer = setTimeout(
          () => (page < sections.length ? show() : finish()),
          PAGE_MS,
        );
      };
      show();
    } else {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const y = ((now - start) / 1000) * CRAWL_PX_PER_S;
        const travel = viewport.clientHeight + reel.scrollHeight;
        reel.style.transform = `translateY(${viewport.clientHeight - y}px)`;
        if (y >= travel) finish();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return {
      el,
      onBack: finish,
      // The crawl has its own visible Skip button.
      noBack: true,
      dispose: () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      },
    };
  };
}

// ------------------------------------------------------- tutorial skip

/**
 * "Skip onboarding?" with the honest note. Skipping loses nothing, so focus
 * opens on Skip: Back (or the chip), then Confirm, is the whole path.
 */
export function tutorialSkipDialog(
  ctx: UiContext,
  onSkip: () => void,
  onKeep: () => void,
): ScreenFactory {
  return confirmDialog(ctx, {
    title: "ui.tut.skipConfirm1",
    body: "ui.tut.skipNote",
    confirmLabel: "ui.tut.skipPrompt",
    cancelLabel: "ui.tut.skipNo",
    focusConfirm: true,
    onConfirm: onSkip,
    onCancel: onKeep,
  });
}
