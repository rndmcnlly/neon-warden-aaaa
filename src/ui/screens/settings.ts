/**
 * Settings: every field of the `Settings` contract, in six tabs. Each row
 * writes through `settings.update`, so a change applies live everywhere that
 * subscribes (renderer, audio, subtitles) and is persisted the same frame.
 * Opening this from the pause menu never touches gameplay state.
 */

import {
  type Action,
  type AimAssist,
  type Difficulty,
  type DisplayPreset,
  type Lang,
  LANGS,
  type Settings,
  type TouchScheme,
} from "../../contracts/index.ts";
import {
  ACTIONS,
  type BindSlot,
  rebind,
  unboundActions,
} from "../../input/bindings.ts";
import { buttonLabel, keyLabel } from "../../input/labels.ts";
import { setFullscreen } from "../../platform/fullscreen.ts";
import { DEFAULT_BINDINGS } from "../../settings/defaults.ts";
import {
  applyPreset,
  GAME_SPEED_RANGE,
  RENDER_SCALE_RANGE,
  setRenderScale,
  SUBTITLE_SCALE_RANGE,
  TOUCH_SENSITIVITY_RANGE,
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
  stagger,
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
  const presets: DisplayPreset[] = [
    "school",
    "low",
    "medium",
    "high",
    "ultra",
    "custom",
  ];
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
        void setFullscreen(on);
      },
    }),
    staticRow(ctx.t("ui.settings.vsync"), ctx.t("ui.settings.vsyncBody")),
    {
      el: button({
        key: "redetect",
        label: ctx.t("ui.settings.redetect"),
        hint: ctx.t("ui.settings.redetectHint"),
        onActivate: () => ctx.redetectTier(),
      }),
      sync() {},
    },
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

type Bus = Exclude<keyof Settings["audio"], "mono">;

function audioTab(ctx: UiContext): Widget[] {
  const { s, set, onOff } = rows(ctx);
  const buses: [Bus, UiKey][] = [
    ["master", "ui.settings.master"],
    ["music", "ui.settings.music"],
    ["sfx", "ui.settings.sfx"],
    ["voice", "ui.settings.voice"],
    ["ui", "ui.settings.uiVolume"],
  ];
  const sliders = buses.map(([bus, label]) =>
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
  return [
    ...sliders,
    toggleRow({
      key: "monoAudio",
      label: ctx.t("ui.settings.monoAudio"),
      ...onOff,
      get: () => s.get().audio.mono,
      set: (mono) => set((c) => ({ ...c, audio: { ...c.audio, mono } })),
    }),
  ];
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
    choiceRow<AimAssist>({
      key: "aimAssist",
      label: ctx.t("ui.settings.aimAssist"),
      options: [
        { value: "touch", label: ctx.t("ui.settings.aimAssist.touch") },
        { value: "on", label: ctx.t("ui.common.on") },
        { value: "off", label: ctx.t("ui.common.off") },
      ],
      get: () => s.get().accessibility.aimAssist,
      set: (aimAssist) => a11y({ aimAssist }),
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
    toggleRow({
      key: "reduceMotion",
      label: ctx.t("ui.settings.reduceMotion"),
      hint: ctx.t("ui.settings.reduceMotionHint"),
      ...onOff,
      get: () => s.get().accessibility.reduceMotion,
      set: (reduceMotion) => a11y({ reduceMotion }),
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
      s.update((c) => ({
        ...c,
        controls: { ...c.controls, bindings: result.bindings },
      }));
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
      if (slot.index === 0) {
        el.dataset.navEntry = slot.device === "key" ? "key" : "pad";
      }
      const cell = { el, action, slot };
      cells.push(cell);
      return el;
    });
    return h(
      "div",
      { class: "nw-bind-row", "data-nav-row": true },
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
          s.update((c) => ({
            ...c,
            controls: { ...c.controls, bindings: DEFAULT_BINDINGS },
          })),
      })),
  });
  const touch = (patch: Partial<Settings["controls"]>) =>
    s.update((c) => ({ ...c, controls: { ...c.controls, ...patch } }));
  // Touch rows first on touch devices: that is what those players came for.
  const touchRows: Widget[] = [
    choiceRow<TouchScheme>({
      key: "touchScheme",
      label: ctx.t("ui.settings.touchScheme"),
      options: (["thumbs", "oneFinger", "arcade"] as const).map((value) => ({
        value,
        label: ctx.t(`ui.settings.touch.${value}`),
      })),
      get: () => s.get().controls.touchScheme,
      set: (touchScheme) => touch({ touchScheme }),
    }),
    sliderRow({
      key: "touchSensitivity",
      label: ctx.t("ui.settings.touchSensitivity"),
      ...TOUCH_SENSITIVITY_RANGE,
      step: 0.1,
      format: percent,
      get: () => s.get().controls.touchSensitivity,
      set: (value) => touch({ touchSensitivity: Math.round(value * 10) / 10 }),
    }),
    choiceRow<"left" | "right">({
      key: "fireSide",
      label: ctx.t("ui.settings.fireSide"),
      options: (["left", "right"] as const).map((value) => ({
        value,
        label: ctx.t(`ui.settings.side.${value}`),
      })),
      get: () => s.get().controls.fireSide,
      set: (fireSide) => touch({ fireSide }),
    }),
  ];
  const onTouch = ctx.input.device() === "touch";
  return [
    ...(onTouch ? touchRows : []),
    table,
    ...(onTouch ? [] : touchRows),
    staticRow(
      ctx.t("ui.controls.captureNote"),
      ctx.t("ui.controls.fallbackNote"),
    ),
    // Fixed, not remappable: listed so the shortcut is discoverable. Pad
    // labels follow the connected family (LB on Xbox, L1 on PlayStation).
    staticRow(
      ctx.t("ui.controls.langCycle", {
        prevKey: inputLabel(ctx, "BracketLeft"),
        nextKey: inputLabel(ctx, "BracketRight"),
        prevPad: inputLabel(ctx, 4),
        nextPad: inputLabel(ctx, 5),
      }),
      ctx.t("ui.controls.langCycleNote"),
    ),
    { el: reset, sync: () => {} },
  ];
}

/**
 * The description shown in the side panel for each focusable row, by its
 * `data-key`. Every row has one (critique item 1); a stub row shows its stub
 * copy, so the honest "not in this slice" text is readable without opening
 * a dialog. Remap cells share their action's description.
 */
export function descriptionKey(key: string): UiKey | null {
  if (key.startsWith("tab-")) {
    return `ui.settings.tabDesc.${key.slice(4)}` as UiKey;
  }
  const bind = /^bind-([a-zA-Z]+)-/.exec(key);
  if (bind) return `ui.controls.desc.${bind[1]}` as UiKey;
  return (DESCRIPTIONS as Record<string, UiKey | undefined>)[key] ?? null;
}

const DESCRIPTIONS = {
  preset: "ui.settings.desc.preset",
  renderScale: "ui.settings.desc.renderScale",
  fullscreen: "ui.settings.desc.fullscreen",
  "audio-master": "ui.settings.desc.master",
  "audio-music": "ui.settings.desc.music",
  "audio-sfx": "ui.settings.desc.sfx",
  "audio-voice": "ui.settings.desc.voice",
  "audio-ui": "ui.settings.desc.uiVolume",
  monoAudio: "ui.settings.desc.monoAudio",
  textLang: "ui.settings.desc.textLang",
  voiceLang: "ui.settings.desc.voiceLang",
  moreLangs: "ui.stub.moreLangs",
  subtitles: "ui.settings.desc.subtitles",
  subtitleScale: "ui.settings.desc.subtitleScale",
  subtitleBg: "ui.settings.desc.subtitleBg",
  speakerNames: "ui.settings.desc.speakerNames",
  maxLines: "ui.settings.desc.maxLines",
  autoFire: "ui.settings.desc.autoFire",
  holdToggle: "ui.settings.desc.holdToggle",
  aimAssist: "ui.settings.desc.aimAssist",
  touchScheme: "ui.settings.desc.touchScheme",
  touchSensitivity: "ui.settings.desc.touchSensitivity",
  fireSide: "ui.settings.desc.fireSide",
  redetect: "ui.settings.desc.redetect",
  shake: "ui.settings.desc.shake",
  reducedFlashing: "ui.settings.desc.reducedFlashing",
  reduceMotion: "ui.settings.desc.reduceMotion",
  gameSpeed: "ui.settings.desc.gameSpeed",
  difficulty: "ui.settings.desc.difficulty",
  colorCues: "ui.settings.desc.colorCues",
  narration: "ui.stub.narration",
  resetControls: "ui.settings.desc.resetControls",
  resetAll: "ui.settings.desc.resetAll",
} as const satisfies Record<string, UiKey>;

/** The side panel: the focused row's name, what it does, and (on Subtitles) the live preview. */
function describer(ctx: UiContext, aside: HTMLElement) {
  const title = h("h3", { class: "nw-desc-title" });
  const text = h("p", { class: "nw-desc-body" });
  const stub = h(
    "p",
    { class: "nw-desc-stub", hidden: true },
    ctx.t("ui.stub.badge"),
  );
  const card = h(
    "div",
    { class: "nw-desc", "aria-live": "polite" },
    stub,
    title,
    text,
  );
  let preview: Widget | null = null;
  return {
    setPreview(next: Widget | null) {
      preview = next;
      aside.replaceChildren(card, ...(preview ? [preview.el] : []));
    },
    describe(target: HTMLElement | null) {
      const row = target?.closest<HTMLElement>("[data-key]");
      const key = row ? descriptionKey(row.dataset.key ?? "") : null;
      card.hidden = key === null;
      if (!row || key === null) return;
      title.textContent = row.querySelector(".nw-row-label, .nw-button-label")
        ?.textContent ?? row.getAttribute("aria-label") ?? "";
      if (row.dataset.key?.startsWith("bind-")) {
        title.textContent = row.closest(".nw-bind-row")
          ?.querySelector(".nw-bind-action")?.textContent ?? "";
      }
      text.textContent = ctx.t(key);
      stub.hidden = !row.classList.contains("is-locked");
      card.classList.remove("is-fresh");
      void card.offsetWidth;
      card.classList.add("is-fresh");
    },
    sync() {
      preview?.sync();
    },
  };
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
    const body = h("div", { class: "nw-rows", role: "tabpanel" });
    const aside = h("div", { class: "nw-settings-aside" });
    const desc = describer(ctx, aside);
    body.addEventListener(
      "focusin",
      (e) => desc.describe(e.target as HTMLElement),
    );

    const tabButtons = TABS.map((tab) =>
      button({
        key: `tab-${tab}`,
        label: ctx.t(`ui.settings.tab.${tab}` as UiKey),
        className: "nw-tab",
        sound: "tab_switch",
        onActivate: () => show(tab, false, 0),
      })
    );
    tabButtons.forEach((el) => {
      el.setAttribute("role", "tab");
      el.addEventListener("focus", () => desc.describe(el));
    });

    /** `direction` slides the new rows in from the side the tab moved toward. */
    function show(
      tab: TabId,
      moveFocus: boolean,
      direction?: -1 | 0 | 1,
    ): void {
      const from = TABS.indexOf(lastTab);
      const dir = direction ?? Math.sign(TABS.indexOf(tab) - from);
      lastTab = tab;
      widgets = TAB_BUILDERS[tab](ctx);
      body.replaceChildren(...widgets.map((w) => w.el));
      stagger(body);
      body.dataset.slide = dir < 0 ? "back" : dir > 0 ? "forward" : "none";
      body.classList.remove("is-sliding");
      void body.offsetWidth;
      body.classList.add("is-sliding");
      desc.setPreview(tab === "subtitles" ? subtitlePreview(ctx) : null);
      desc.describe(tabButtons[TABS.indexOf(tab)]);
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

    const offline = button({
      key: "offline",
      label: ctx.t("ui.settings.offline"),
      onActivate: () =>
        globalThis.dispatchEvent(new CustomEvent("platform-offline-open")),
    });

    resetAll.addEventListener("focus", () => desc.describe(resetAll));
    const el = panel({
      id: "settings",
      title: ctx.t("ui.settings.title"),
      className: "is-wide",
      body: [
        h("div", { class: "nw-tabs", role: "tablist" }, ...tabButtons),
        h("div", { class: "nw-settings-body" }, body, aside),
        h("div", { class: "nw-actions is-end" }, offline, resetAll),
      ],
      prompts: [
        ["confirm", ctx.t("ui.common.select")],
        ["adjust", ctx.t("ui.common.adjust")],
        ["tabs", ctx.t("ui.common.tab")],
        ["back", ctx.t("ui.common.back")],
      ],
    });
    show(lastTab, false, 0);
    tabButtons[TABS.indexOf(lastTab)].dataset.autofocus = "";

    return {
      el,
      onIntent: (event) => {
        const platform = document.querySelector<HTMLDialogElement>(
          "dialog[data-platform-modal][open]",
        );
        if (platform) {
          if (event.intents.has("back") || event.intents.has("pause")) {
            platform.close();
          }
          return true;
        }
        const delta = event.intents.has("tabPrev")
          ? -1
          : event.intents.has("tabNext")
          ? 1
          : 0;
        if (delta === 0) return false;
        const next =
          TABS[(TABS.indexOf(lastTab) + delta + TABS.length) % TABS.length];
        uiSound("tab_switch");
        show(next, true, delta > 0 ? 1 : -1);
        return true;
      },
      sync: () => {
        widgets.forEach((w) => w.sync());
        desc.sync();
      },
    };
  };
}
