/**
 * Settings: every field of the `Settings` contract, in six tabs. Each row
 * writes through `settings.update`, so a change applies live everywhere that
 * subscribes (renderer, audio, subtitles) and is persisted the same frame.
 * Opening this from the pause menu never touches gameplay state.
 */

import {
  type Action,
  type Difficulty,
  type DisplayPreset,
  type Lang,
  LANGS,
  type Settings,
} from "../../contracts/index.ts";
import {
  ACTIONS,
  type BindSlot,
  rebind,
  unboundActions,
} from "../../input/bindings.ts";
import { buttonLabel, keyLabel } from "../../input/labels.ts";
import { DEFAULT_BINDINGS } from "../../settings/defaults.ts";
import {
  applyPreset,
  GAME_SPEED_RANGE,
  RENDER_SCALE_RANGE,
  setRenderScale,
  SUBTITLE_SCALE_RANGE,
} from "../../settings/validate.ts";
import type { UiContext } from "../context.ts";
import type { ScreenFactory } from "../router.ts";
import { uiSound } from "../sound.ts";
import type { UiKey } from "../../i18n/index.ts";
import {
  button,
  choiceRow,
  h,
  panel,
  sliderRow,
  toggleRow,
  type Widget,
} from "../widgets.ts";
import { confirmDialog, stubDialog } from "./dialogs.ts";

type TabId =
  | "display"
  | "audio"
  | "language"
  | "subtitles"
  | "accessibility"
  | "controls";

const TABS: readonly TabId[] = [
  "display",
  "audio",
  "language",
  "subtitles",
  "accessibility",
  "controls",
];

/** Remembered across openings, so returning to Settings lands where you were. */
let lastTab: TabId = "display";

const percent = (v: number) => `${Math.round(v * 100)}%`;

type Recipe = (current: Settings) => Settings;

/** Small helpers so each row reads as "label, getter, setter". */
function rows(ctx: UiContext) {
  const s = ctx.settings;
  const set = (recipe: Recipe) => s.update(recipe);
  const onOff = {
    onText: ctx.t("ui.common.on"),
    offText: ctx.t("ui.common.off"),
  };
  return { s, set, onOff };
}

function displayTab(ctx: UiContext): Widget[] {
  const { s, set, onOff } = rows(ctx);
  const presets: DisplayPreset[] = ["low", "medium", "high", "ultra", "custom"];
  return [
    choiceRow<DisplayPreset>({
      key: "preset",
      label: ctx.t("ui.settings.preset"),
      options: presets.map((value) => ({
        value,
        label: ctx.t(`ui.settings.preset.${value}` as UiKey),
      })),
      get: () => s.get().display.preset,
      set: (preset) => set((c) => applyPreset(c, preset)),
    }),
    sliderRow({
      key: "renderScale",
      label: ctx.t("ui.settings.renderScale"),
      ...RENDER_SCALE_RANGE,
      step: 0.05,
      format: percent,
      hint: () => {
        const scale = s.get().display.renderScale * devicePixelRatio;
        return ctx.t("ui.settings.renderScaleHint", {
          w: Math.round(innerWidth * scale),
          h: Math.round(innerHeight * scale),
        });
      },
      get: () => s.get().display.renderScale,
      set: (value) => set((c) => setRenderScale(c, value)),
    }),
    toggleRow({
      key: "fullscreen",
      label: ctx.t("ui.settings.fullscreen"),
      ...onOff,
      get: () => s.get().display.fullscreen,
      // The Fullscreen API needs this click or key press as its gesture; the
      // front end mirrors the real state back into settings on change.
      set: (on) => {
        const write = (fullscreen: boolean) =>
          set((c) => ({ ...c, display: { ...c.display, fullscreen } }));
        if (on) {
          document.documentElement.requestFullscreen?.().catch(() =>
            write(false)
          );
        } else if (document.fullscreenElement) document.exitFullscreen();
        write(on);
      },
    }),
    staticRow(ctx.t("ui.settings.vsync"), ctx.t("ui.settings.vsyncBody")),
  ];
}

/** A non-interactive explanatory row. */
function staticRow(label: string, body: string): Widget {
  const el = h(
    "div",
    { class: "nw-row is-static" },
    h(
      "span",
      { class: "nw-row-text" },
      h("span", { class: "nw-row-label" }, label),
      h("span", { class: "nw-row-hint" }, body),
    ),
  );
  return { el, sync: () => {} };
}

function stubRow(
  ctx: UiContext,
  key: string,
  title: UiKey,
  body: UiKey,
): Widget {
  const el = button({
    key,
    label: ctx.t(title),
    badge: ctx.t("ui.stub.badge"),
    className: "nw-row is-locked",
    sound: "locked",
    onActivate: () => ctx.router.push(stubDialog(ctx, title, body)),
  });
  return { el, sync: () => {} };
}

function audioTab(ctx: UiContext): Widget[] {
  const { s, set } = rows(ctx);
  const buses: [keyof Settings["audio"], UiKey][] = [
    ["master", "ui.settings.master"],
    ["music", "ui.settings.music"],
    ["sfx", "ui.settings.sfx"],
    ["voice", "ui.settings.voice"],
    ["ui", "ui.settings.uiVolume"],
  ];
  return buses.map(([bus, label]) =>
    sliderRow({
      key: `audio-${bus}`,
      label: ctx.t(label),
      min: 0,
      max: 1,
      step: 0.05,
      format: percent,
      get: () => s.get().audio[bus],
      set: (value) =>
        set((c) => ({ ...c, audio: { ...c.audio, [bus]: value } })),
    })
  );
}

function languageTab(ctx: UiContext): Widget[] {
  const { s, set } = rows(ctx);
  // Language names are written in their own language, so anyone can find theirs.
  const options = LANGS.map((value) => ({
    value,
    label: ctx.t(`ui.lang.${value}` as UiKey),
  }));
  return [
    choiceRow<Lang>({
      key: "textLang",
      label: ctx.t("ui.settings.textLang"),
      options,
      get: () => s.get().textLang,
      set: (textLang) => set((c) => ({ ...c, textLang })),
    }),
    choiceRow<Lang>({
      key: "voiceLang",
      label: ctx.t("ui.settings.voiceLang"),
      hint: ctx.t("ui.settings.langHint"),
      options,
      get: () => s.get().voiceLang,
      set: (voiceLang) => set((c) => ({ ...c, voiceLang })),
    }),
    stubRow(ctx, "moreLangs", "ui.settings.moreLangs", "ui.stub.moreLangs"),
  ];
}

function subtitlesTab(ctx: UiContext): Widget[] {
  const { s, set, onOff } = rows(ctx);
  const sub = (patch: Partial<Settings["subtitles"]>) =>
    set((c) => ({ ...c, subtitles: { ...c.subtitles, ...patch } }));
  return [
    toggleRow({
      key: "subtitles",
      label: ctx.t("ui.settings.subtitles"),
      ...onOff,
      get: () => s.get().subtitles.enabled,
      set: (enabled) => sub({ enabled }),
    }),
    sliderRow({
      key: "subtitleScale",
      label: ctx.t("ui.settings.subtitleScale"),
      ...SUBTITLE_SCALE_RANGE,
      step: 0.1,
      format: percent,
      get: () => s.get().subtitles.scale,
      set: (scale) => sub({ scale }),
    }),
    sliderRow({
      key: "subtitleBg",
      label: ctx.t("ui.settings.subtitleBg"),
      min: 0,
      max: 1,
      step: 0.05,
      format: percent,
      get: () => s.get().subtitles.bgOpacity,
      set: (bgOpacity) => sub({ bgOpacity }),
    }),
    toggleRow({
      key: "speakerNames",
      label: ctx.t("ui.settings.speakerNames"),
      ...onOff,
      get: () => s.get().subtitles.speakerNames,
      set: (speakerNames) => sub({ speakerNames }),
    }),
    choiceRow<1 | 2>({
      key: "maxLines",
      label: ctx.t("ui.settings.maxLines"),
      options: [
        { value: 1, label: ctx.t("ui.settings.maxLines1") },
        { value: 2, label: ctx.t("ui.settings.maxLines2") },
      ],
      get: () => s.get().subtitles.maxLines,
      set: (maxLines) => sub({ maxLines }),
    }),
  ];
}

/**
 * A live subtitle sample using the same CSS variables the in-game subtitle
 * layer should use, so what you tune here is what you get in play.
 */
function subtitlePreview(ctx: UiContext): Widget {
  const speaker = h(
    "span",
    { class: "nw-subtitle-speaker" },
    ctx.t("ui.settings.previewSpeaker"),
  );
  const text = h(
    "span",
    { class: "nw-subtitle-text" },
    ctx.t("ui.settings.previewLine"),
  );
  const box = h("div", { class: "nw-subtitle" }, speaker, text);
  const el = h(
    "figure",
    {
      class: "nw-subtitle-preview",
      "aria-label": ctx.t("ui.settings.preview"),
    },
    h("figcaption", { class: "nw-footnote" }, ctx.t("ui.settings.preview")),
    box,
  );
  const sync = () => {
    const sub = ctx.settings.get().subtitles;
    box.style.setProperty("--subtitle-scale", String(sub.scale));
    box.style.setProperty("--subtitle-bg", String(sub.bgOpacity));
    box.style.setProperty("--subtitle-lines", String(sub.maxLines));
    box.hidden = !sub.enabled;
    speaker.hidden = !sub.speakerNames;
  };
  sync();
  return { el, sync };
}

function accessibilityTab(ctx: UiContext): Widget[] {
  const { s, set, onOff } = rows(ctx);
  const a11y = (patch: Partial<Settings["accessibility"]>) =>
    set((c) => ({ ...c, accessibility: { ...c.accessibility, ...patch } }));
  const difficulties: Difficulty[] = ["story", "normal", "hard"];
  return [
    toggleRow({
      key: "autoFire",
      label: ctx.t("ui.settings.autoFire"),
      hint: ctx.t("ui.settings.autoFireHint"),
      ...onOff,
      get: () => s.get().accessibility.autoFire,
      set: (autoFire) => a11y({ autoFire }),
    }),
    choiceRow<"hold" | "toggle">({
      key: "holdToggle",
      label: ctx.t("ui.settings.holdToggle"),
      options: [
        { value: "hold", label: ctx.t("ui.settings.hold") },
        { value: "toggle", label: ctx.t("ui.settings.toggle") },
      ],
      get: () => s.get().accessibility.holdToggle,
      set: (holdToggle) => a11y({ holdToggle }),
    }),
    sliderRow({
      key: "shake",
      label: ctx.t("ui.settings.shake"),
      min: 0,
      max: 1,
      step: 0.1,
      format: percent,
      get: () => s.get().accessibility.shake,
      set: (shake) => a11y({ shake }),
    }),
    toggleRow({
      key: "reducedFlashing",
      label: ctx.t("ui.settings.reducedFlashing"),
      ...onOff,
      get: () => s.get().accessibility.reducedFlashing,
      set: (reducedFlashing) => a11y({ reducedFlashing }),
    }),
    sliderRow({
      key: "gameSpeed",
      label: ctx.t("ui.settings.gameSpeed"),
      ...GAME_SPEED_RANGE,
      step: 0.05,
      format: percent,
      get: () => s.get().accessibility.gameSpeed,
      set: (gameSpeed) => a11y({ gameSpeed }),
    }),
    choiceRow<Difficulty>({
      key: "difficulty",
      label: ctx.t("ui.settings.difficulty"),
      options: difficulties.map((value) => ({
        value,
        label: ctx.t(`ui.difficulty.${value}` as UiKey),
      })),
      get: () => s.get().accessibility.difficulty,
      set: (difficulty) => a11y({ difficulty }),
    }),
    toggleRow({
      key: "colorCues",
      label: ctx.t("ui.settings.colorCues"),
      ...onOff,
      get: () => s.get().accessibility.colorIndependentCues,
      set: (colorIndependentCues) => a11y({ colorIndependentCues }),
    }),
    stubRow(ctx, "narration", "ui.settings.narration", "ui.stub.narration"),
  ];
}

const SLOTS: readonly BindSlot[] = [
  { device: "key", index: 0 },
  { device: "key", index: 1 },
  { device: "button", index: 0 },
];

function actionLabel(ctx: UiContext, action: Action): string {
  return ctx.t(`ui.action.${action}` as UiKey);
}

function inputLabel(ctx: UiContext, input: string | number): string {
  return typeof input === "string"
    ? keyLabel(input)
    : buttonLabel(input, ctx.input.padFamily());
}

/**
 * The remapping table: one row per action, three cells (two keys, one
 * button). Activating a cell captures the next key or button; conflicts are
 * resolved by `rebind` (swap where possible) and announced in a toast.
 */
function controlsTab(ctx: UiContext): Widget[] {
  const s = ctx.settings;
  const cells: { el: HTMLButtonElement; action: Action; slot: BindSlot }[] = [];

  const header = h(
    "div",
    { class: "nw-bind-row is-header", "aria-hidden": "true" },
    h("span", {}, ctx.t("ui.controls.action")),
    h("span", {}, ctx.t("ui.controls.keyboard")),
    h("span", {}, ctx.t("ui.controls.alternate")),
    h("span", {}, ctx.t("ui.controls.gamepad")),
  );

  const startCapture = (cell: typeof cells[number]) => {
    const kind = cell.slot.device;
    cell.el.classList.add("is-capturing");
    cell.el.textContent = ctx.t(
      kind === "key" ? "ui.controls.pressKey" : "ui.controls.pressButton",
    );
    ctx.input.capture(kind, (captured) => {
      cell.el.classList.remove("is-capturing");
      if (!captured) {
        uiSound("back");
        sync();
        return;
      }
      const input = captured.kind === "key" ? captured.code : captured.index;
      const result = rebind(
        s.get().controls.bindings,
        cell.action,
        cell.slot,
        input,
      );
      s.update((c) => ({ ...c, controls: { bindings: result.bindings } }));
      uiSound(result.moves.length > 0 ? "notify" : "confirm");
      for (const move of result.moves) {
        ctx.toast(
          move.swappedIn === null
            ? ctx.t("ui.controls.moved", {
              input: inputLabel(ctx, move.input),
              from: actionLabel(ctx, move.from),
            })
            : ctx.t("ui.controls.swapped", {
              input: inputLabel(ctx, move.input),
              from: actionLabel(ctx, move.from),
              swapped: inputLabel(ctx, move.swappedIn),
            }),
        );
      }
    }, 6000);
  };

  const tableRows = ACTIONS.map((action) => {
    const rowCells = SLOTS.map((slot) => {
      const el = button({
        key: `bind-${action}-${slot.device}${slot.index}`,
        label: "",
        className: "nw-bind-cell",
        onActivate: () => startCapture(cell),
      });
      const cell = { el, action, slot };
      cells.push(cell);
      return el;
    });
    return h(
      "div",
      { class: "nw-bind-row" },
      h("span", { class: "nw-bind-action" }, actionLabel(ctx, action)),
      ...rowCells,
    );
  });

  const sync = () => {
    const bindings = s.get().controls.bindings;
    const unbound = new Set(unboundActions(bindings));
    for (const cell of cells) {
      if (cell.el.classList.contains("is-capturing")) continue;
      const binding = bindings[cell.action];
      const list = cell.slot.device === "key" ? binding.keys : binding.buttons;
      const value = list[cell.slot.index];
      cell.el.textContent = value === undefined
        ? (unbound.has(cell.action) && cell.slot.index === 0
          ? ctx.t("ui.controls.unbound")
          : "–")
        : inputLabel(ctx, value);
      cell.el.classList.toggle("is-unbound", unbound.has(cell.action));
    }
  };
  sync();

  const table: Widget = {
    el: h("div", { class: "nw-bind-table" }, header, ...tableRows),
    sync,
  };
  const reset = button({
    key: "resetControls",
    label: ctx.t("ui.controls.reset"),
    onActivate: () =>
      ctx.router.push(confirmDialog(ctx, {
        title: "ui.confirm.resetControlsTitle",
        body: "ui.confirm.resetControlsBody",
        confirmLabel: "ui.confirm.resetYes",
        onConfirm: () =>
          s.update((c) => ({ ...c, controls: { bindings: DEFAULT_BINDINGS } })),
      })),
  });
  return [
    table,
    staticRow(
      ctx.t("ui.controls.captureNote"),
      ctx.t("ui.controls.fallbackNote"),
    ),
    { el: reset, sync: () => {} },
  ];
}

const TAB_BUILDERS: Readonly<Record<TabId, (ctx: UiContext) => Widget[]>> = {
  display: displayTab,
  audio: audioTab,
  language: languageTab,
  subtitles: subtitlesTab,
  accessibility: accessibilityTab,
  controls: controlsTab,
};

export function settingsScreen(ctx: UiContext): ScreenFactory {
  return () => {
    let widgets: Widget[] = [];
    let preview: Widget | null = null;
    const body = h("div", { class: "nw-rows", role: "tabpanel" });
    const aside = h("div", { class: "nw-settings-aside" });

    const tabButtons = TABS.map((tab) =>
      button({
        key: `tab-${tab}`,
        label: ctx.t(`ui.settings.tab.${tab}` as UiKey),
        className: "nw-tab",
        sound: "tab_switch",
        onActivate: () => show(tab, false),
      })
    );
    tabButtons.forEach((el) => el.setAttribute("role", "tab"));

    function show(tab: TabId, moveFocus: boolean): void {
      lastTab = tab;
      widgets = TAB_BUILDERS[tab](ctx);
      body.replaceChildren(...widgets.map((w) => w.el));
      preview = tab === "subtitles" ? subtitlePreview(ctx) : null;
      aside.replaceChildren(...(preview ? [preview.el] : []));
      tabButtons.forEach((el, i) => {
        const selected = TABS[i] === tab;
        el.setAttribute("aria-selected", String(selected));
        el.classList.toggle("is-selected", selected);
      });
      if (moveFocus) {
        tabButtons[TABS.indexOf(tab)].focus({ preventScroll: true });
      }
    }

    const resetAll = button({
      key: "resetAll",
      label: ctx.t("ui.settings.resetAll"),
      className: "is-destructive is-quiet",
      onActivate: () =>
        ctx.router.push(confirmDialog(ctx, {
          title: "ui.confirm.resetTitle",
          body: "ui.confirm.resetBody",
          confirmLabel: "ui.confirm.resetYes",
          onConfirm: () => ctx.settings.reset(),
        })),
    });

    const el = panel({
      id: "settings",
      title: ctx.t("ui.settings.title"),
      className: "is-wide",
      body: [
        h("div", { class: "nw-tabs", role: "tablist" }, ...tabButtons),
        h("div", { class: "nw-settings-body" }, body, aside),
        h("div", { class: "nw-actions is-end" }, resetAll),
      ],
      prompts: [
        ["confirm", ctx.t("ui.common.select")],
        ["adjust", ctx.t("ui.common.adjust")],
        ["tabs", ctx.t("ui.common.tab")],
        ["back", ctx.t("ui.common.back")],
      ],
    });
    show(lastTab, false);
    tabButtons[TABS.indexOf(lastTab)].dataset.autofocus = "";

    return {
      el,
      onIntent: (event) => {
        const delta = event.intents.has("tabPrev")
          ? -1
          : event.intents.has("tabNext")
          ? 1
          : 0;
        if (delta === 0) return false;
        const next =
          TABS[(TABS.indexOf(lastTab) + delta + TABS.length) % TABS.length];
        uiSound("tab_switch");
        show(next, true);
        return true;
      },
      sync: () => {
        widgets.forEach((w) => w.sync());
        preview?.sync();
      },
    };
  };
}
