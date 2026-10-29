/**
 * Main menu and everything one step off it: New Game, Chapter Select,
 * Extras (mostly honest stubs), Credits, Licenses, and Data and Privacy.
 */

import type { Difficulty, SkipTo } from "../../contracts/index.ts";
import type { UiContext } from "../context.ts";
import type { ScreenFactory } from "../router.ts";
import type { UiKey } from "../../i18n/index.ts";
import { button, h, panel } from "../widgets.ts";
import { messageDialog, stubDialog } from "./dialogs.ts";
import { settingsScreen } from "./settings.ts";
import { THIRD_PARTY } from "../../data/thirdParty.ts";
import { titleScreen } from "./boot.ts";

const SELECT_BACK = (ctx: UiContext): [string, string][] => [
  ["confirm", ctx.t("ui.common.select")],
  ["back", ctx.t("ui.common.back")],
];

const BEAT_LABEL: Partial<Record<SkipTo, UiKey>> = {
  tutorial: "ui.chapters.beat.tutorial",
  sector1: "ui.chapters.beat.sector1",
  sector3: "ui.chapters.beat.sector3",
  flashback: "ui.chapters.beat.flashback",
  boss: "ui.chapters.beat.boss",
};

function beatLabel(ctx: UiContext, at: SkipTo): string {
  const key = BEAT_LABEL[at];
  return key ? ctx.t(key) : at;
}

export function mainMenuScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const checkpoint = ctx.saves.load();
    const continueHint = checkpoint
      ? ctx.t("ui.menu.continueFrom", {
        where: beatLabel(ctx, checkpoint.at),
        date: new Date(checkpoint.savedAt).toLocaleDateString(ctx.lang()),
      })
      : ctx.t("ui.menu.continueNone");
    const items = [
      button({
        key: "continue",
        label: ctx.t("ui.menu.continue"),
        hint: continueHint,
        unavailable: !checkpoint,
        autofocus: !!checkpoint,
        onActivate: () => checkpoint && ctx.startGame(checkpoint),
      }),
      button({
        key: "newGame",
        label: ctx.t("ui.menu.newGame"),
        autofocus: !checkpoint,
        sound: "menu_open",
        onActivate: () => ctx.router.push(newGameScreen(ctx)),
      }),
      button({
        key: "chapters",
        label: ctx.t("ui.menu.chapters"),
        sound: "menu_open",
        onActivate: () => ctx.router.push(chapterSelectScreen(ctx)),
      }),
      button({
        key: "settings",
        label: ctx.t("ui.menu.settings"),
        sound: "menu_open",
        onActivate: () => ctx.router.push(settingsScreen(ctx)),
      }),
      button({
        key: "extras",
        label: ctx.t("ui.menu.extras"),
        sound: "menu_open",
        onActivate: () => ctx.router.push(extrasScreen(ctx)),
      }),
      button({
        key: "credits",
        label: ctx.t("ui.menu.credits"),
        sound: "menu_open",
        onActivate: () => ctx.router.push(creditsScreen(ctx)),
      }),
      button({
        key: "quit",
        label: ctx.t("ui.menu.quit"),
        onActivate: () =>
          ctx.router.push(messageDialog(ctx, {
            title: "ui.quit.title",
            body: "ui.quit.body",
            stub: true,
          })),
      }),
    ];
    const el = panel({
      id: "main",
      wrap: true,
      body: [
        h(
          "div",
          { class: "nw-logotype is-small" },
          h("h1", { class: "nw-logotype-name" }, ctx.t("ui.title.name")),
          h("p", { class: "nw-logotype-sub" }, ctx.t("ui.title.chapter")),
        ),
        h("nav", { class: "nw-menu" }, ...items),
      ],
      prompts: SELECT_BACK(ctx),
    });
    return { el, onBack: () => ctx.router.replace(titleScreen(ctx)) };
  };
}

const DIFFICULTIES: readonly [Difficulty, UiKey, UiKey][] = [
  ["story", "ui.difficulty.story", "ui.difficulty.storyHint"],
  ["normal", "ui.difficulty.normal", "ui.difficulty.normalHint"],
  ["hard", "ui.difficulty.hard", "ui.difficulty.hardHint"],
];

function setDifficulty(ctx: UiContext, difficulty: Difficulty): void {
  ctx.settings.update((c) => ({
    ...c,
    accessibility: { ...c.accessibility, difficulty },
  }));
}

export function newGameScreen(ctx: UiContext): ScreenFactory {
  return () => {
    // Difficulty is the accessibility setting itself, so changing it later in
    // Settings and choosing it here are the same act.
    const tiles = DIFFICULTIES.map(([value, label, hint]) => {
      const tile = button({
        key: `difficulty-${value}`,
        label: ctx.t(label),
        hint: ctx.t(hint),
        className: "nw-tile",
        sound: "toggle_on",
        autofocus: ctx.settings.get().accessibility.difficulty === value,
        onActivate: () => setDifficulty(ctx, value),
      });
      return { value, tile };
    });
    const sync = () => {
      const current = ctx.settings.get().accessibility.difficulty;
      for (const { value, tile } of tiles) {
        tile.setAttribute("aria-pressed", String(value === current));
      }
    };
    sync();
    const el = panel({
      id: "newGame",
      title: ctx.t("ui.newGame.title"),
      body: [
        h("h3", { class: "nw-subhead" }, ctx.t("ui.newGame.difficulty")),
        h("div", { class: "nw-tiles" }, ...tiles.map((t) => t.tile)),
        h("p", { class: "nw-footnote" }, ctx.t("ui.newGame.changeLater")),
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "start",
            label: ctx.t("ui.newGame.start"),
            className: "is-primary",
            onActivate: () =>
              ctx.startGame({
                at: "tutorial",
                difficulty: ctx.settings.get().accessibility.difficulty,
              }),
          }),
        ),
      ],
      prompts: SELECT_BACK(ctx),
    });
    return { el, sync };
  };
}

const SLICE_BEATS: readonly SkipTo[] = [
  "tutorial",
  "sector1",
  "sector3",
  "flashback",
  "boss",
];

export function chapterSelectScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const start = (at: SkipTo) =>
      ctx.startGame({
        at,
        difficulty: ctx.settings.get().accessibility.difficulty,
      });
    const el = panel({
      id: "chapters",
      title: ctx.t("ui.chapters.title"),
      body: [
        h(
          "div",
          { class: "nw-chapter" },
          h("h3", { class: "nw-subhead" }, ctx.t("ui.chapters.ch1")),
          h("p", { class: "nw-footnote" }, ctx.t("ui.chapters.ch1Desc")),
          h(
            "div",
            { class: "nw-beats" },
            ...SLICE_BEATS.map((at, i) =>
              button({
                key: `beat-${at}`,
                label: beatLabel(ctx, at),
                badge: String(i + 1).padStart(2, "0"),
                className: "nw-beat",
                autofocus: i === 0,
                onActivate: () => start(at),
              })
            ),
          ),
        ),
        button({
          key: "locked",
          label: ctx.t("ui.chapters.locked"),
          badge: ctx.t("ui.stub.badge"),
          className: "nw-tile is-locked",
          sound: "locked",
          onActivate: () =>
            ctx.router.push(
              stubDialog(ctx, "ui.chapters.locked", "ui.chapters.lockedBody"),
            ),
        }),
      ],
      prompts: SELECT_BACK(ctx),
    });
    return { el };
  };
}

export function extrasScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const stub = (key: string, title: UiKey, body: UiKey) =>
      button({
        key,
        label: ctx.t(title),
        badge: ctx.t("ui.stub.badge"),
        className: "nw-tile is-locked",
        sound: "locked",
        onActivate: () => ctx.router.push(stubDialog(ctx, title, body)),
      });
    const el = panel({
      id: "extras",
      title: ctx.t("ui.extras.title"),
      body: [
        h(
          "div",
          { class: "nw-grid" },
          button({
            key: "privacy",
            label: ctx.t("ui.extras.privacy"),
            className: "nw-tile",
            autofocus: true,
            onActivate: () =>
              ctx.router.push(messageDialog(ctx, {
                title: "ui.privacy.title",
                body: "ui.privacy.body",
              })),
          }),
          button({
            key: "licenses",
            label: ctx.t("ui.extras.licenses"),
            className: "nw-tile",
            sound: "menu_open",
            onActivate: () => ctx.router.push(licensesScreen(ctx)),
          }),
          stub("multiplayer", "ui.extras.multiplayer", "ui.stub.multiplayer"),
          stub(
            "leaderboards",
            "ui.extras.leaderboards",
            "ui.stub.leaderboards",
          ),
          stub("store", "ui.extras.store", "ui.stub.store"),
          stub("signIn", "ui.extras.signIn", "ui.stub.signIn"),
          stub("photo", "ui.extras.photo", "ui.stub.photo"),
          stub("eula", "ui.extras.eula", "ui.stub.eula"),
        ),
      ],
      prompts: SELECT_BACK(ctx),
    });
    el.dataset.wrap = "grid";
    return { el };
  };
}

/**
 * A focusable scroll box: up and down scroll it until an edge, then pass the
 * intent on so focus can leave. Long text stays reachable without a mouse.
 */
function scrollArea(...children: (Node | string)[]): HTMLElement {
  const area = h("div", {
    class: "nw-scroll",
    "data-nav": true,
    "data-key": "scroll",
    "data-autofocus": true,
    tabindex: "0",
  }, ...children);
  return area;
}

export function scrollIntent(area: HTMLElement, up: boolean): boolean {
  const before = area.scrollTop;
  area.scrollBy({ top: up ? -80 : 80 });
  return area.scrollTop !== before;
}

export function creditsScreen(ctx: UiContext): ScreenFactory {
  return () => {
    const section = (title: UiKey, body: UiKey) =>
      h(
        "div",
        { class: "nw-credit" },
        h("h3", { class: "nw-subhead" }, ctx.t(title)),
        h("p", { class: "nw-body" }, ctx.t(body)),
      );
    const area = scrollArea(
      h("p", { class: "nw-credits-studio" }, ctx.t("ui.credits.studio")),
      section("ui.credits.direction", "ui.credits.directionBody"),
      section("ui.credits.agents", "ui.credits.agentsBody"),
      section("ui.credits.tools", "ui.credits.toolsBody"),
      h("p", { class: "nw-footnote" }, ctx.t("ui.credits.stubNote")),
      h("p", { class: "nw-footnote" }, ctx.t("ui.build.detail")),
    );
    const el = panel({
      id: "credits",
      title: ctx.t("ui.credits.title"),
      body: [
        area,
        h(
          "div",
          { class: "nw-actions" },
          button({
            key: "licenses",
            label: ctx.t("ui.extras.licenses"),
            sound: "menu_open",
            onActivate: () => ctx.router.push(licensesScreen(ctx)),
          }),
          button({
            key: "privacy",
            label: ctx.t("ui.extras.privacy"),
            onActivate: () =>
              ctx.router.push(messageDialog(ctx, {
                title: "ui.privacy.title",
                body: "ui.privacy.body",
              })),
          }),
        ),
      ],
      prompts: SELECT_BACK(ctx),
    });
    return {
      el,
      onIntent: (event) =>
        document.activeElement === area &&
        (event.intents.has("up") || event.intents.has("down")) &&
        scrollIntent(area, event.intents.has("up")),
    };
  };
}

export function licensesScreen(ctx: UiContext): ScreenFactory {
  return () => {
    // Names, versions and license ids are proper nouns: shown as data.
    const entries = THIRD_PARTY.map((entry) =>
      h(
        "li",
        { class: "nw-license-entry" },
        h(
          "span",
          { class: "nw-license-name" },
          entry.version ? `${entry.name} ${entry.version}` : entry.name,
        ),
        h(
          "span",
          { class: "nw-badge" },
          ctx.t(`ui.licenses.role.${entry.role}`),
        ),
        h(
          "span",
          { class: "nw-license-meta" },
          ctx.t("ui.licenses.license", { license: entry.license }),
        ),
        h("span", { class: "nw-license-note" }, ctx.t(entry.note)),
        h("span", { class: "nw-license-url" }, entry.url),
      )
    );
    const notices: UiKey[] = [
      "ui.licenses.three",
      "ui.licenses.vite",
      "ui.licenses.deno",
    ];
    const area = scrollArea(
      h("p", { class: "nw-body" }, ctx.t("ui.licenses.intro")),
      h("ul", { class: "nw-license-list" }, ...entries),
      h(
        "ul",
        { class: "nw-license-notices" },
        ...notices.map((key) => h("li", {}, ctx.t(key))),
      ),
      h("pre", { class: "nw-license-text" }, ctx.t("ui.licenses.mitText")),
    );
    const el = panel({
      id: "licenses",
      title: ctx.t("ui.licenses.title"),
      body: [area],
      prompts: [["back", ctx.t("ui.common.back")]],
    });
    return {
      el,
      onIntent: (event) =>
        (event.intents.has("up") || event.intents.has("down")) &&
        scrollIntent(area, event.intents.has("up")),
    };
  };
}
