/**
 * Wave 3 HUD instruments: PAY and its multiplier, the Writ charge meter, the
 * graze meter, the scan lock readout, intel tags pinned to enemies, and the
 * radio text channel. Same two layers as `hud.ts`:
 *
 *   readInstruments(state)   pure: SimState in, a small view model out
 *   createInstruments(...)   DOM: paints the model, nothing else
 *
 * Everything continuous (pay, charge, graze, lock progress, AI state) is
 * read from the snapshot each frame, so the HUD can never drift from the
 * sim. Events are used only for punctuation (a pulse on graze, pay or lock)
 * and for codex unlocks.
 *
 * The wave 3 fields are read through `Partial<Wave3Fields>`: a Tolerant
 * Reader, so the HUD shows nothing rather than crashing on a snapshot (or a
 * replay) that predates them.
 */

import type { SimState } from "../contracts/index.ts";
import type { TextParams, UiKey } from "../i18n/index.ts";
import { h } from "./widgets.ts";

/** Anything with a `type`: a SimEvent, or one the sim adds later. */
export type LooseEvent = { readonly type: string };

/** The snapshot fields this file reads, all optional on purpose. */
interface Wave3Fields {
  readonly pay: { readonly credits: number; readonly rate: number };
  readonly graze: { readonly meter: number; readonly count: number };
}
interface Wave3Player {
  readonly chargeLevel: number;
  readonly charge: number;
  readonly scan: { readonly active: boolean; readonly targetId: unknown };
}
interface Wave3Target {
  readonly id: unknown;
  readonly pos: { readonly x: number; readonly y: number };
  readonly ai: string;
  readonly lock: number;
  readonly locked: boolean;
  readonly disarmed: boolean;
}

/** An enemy's revealed AI state, shown as a tag beside it. */
export interface IntelTag {
  readonly id: string;
  /** FSM state name from the sim: patrol, aim, fire, evade, retreat... */
  readonly state: string;
  readonly disarmed: boolean;
  readonly boss: boolean;
}

export interface InstrumentModel {
  readonly pay: number;
  readonly multiplier: number;
  /** Writ charge level 0–3, and progress through the current level, 0–1. */
  readonly writLevel: number;
  readonly writProgress: number;
  /** Graze meter 0–1, and the run's graze count. */
  readonly graze: number;
  readonly grazes: number;
  /** Scan beam: is it sweeping, on what, and how far along the lock. */
  readonly scanning: boolean;
  readonly scanTarget: string | null;
  readonly scanProgress: number;
  readonly locked: boolean;
  readonly scanState: string | null;
  /** Intel is truthful but earned: only locked targets show their state. */
  readonly intel: readonly IntelTag[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const finite = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function readInstruments(state: SimState): InstrumentModel {
  const s = state as SimState & Partial<Wave3Fields>;
  const player = state.player as Partial<Wave3Player>;
  const level = Math.min(3, Math.max(0, finite(player.chargeLevel)));
  // `charge` is progress to a full level 3; split it into per-level cells.
  const progress = level >= 3 ? 0 : clamp01(finite(player.charge) * 3 - level);
  const targets = [
    ...state.enemies.map((e) => ({
      t: e as Partial<Wave3Target>,
      boss: false,
    })),
    ...(state.boss
      ? [{ t: state.boss as Partial<Wave3Target>, boss: true }]
      : []),
  ];
  const scanId = player.scan?.targetId;
  const target = scanId === null || scanId === undefined
    ? undefined
    : targets.find(({ t }) => t.id === scanId)?.t;
  const intel = targets
    .filter(({ t }) => t.locked === true && typeof t.ai === "string")
    .map(({ t, boss }) => ({
      id: String(t.id),
      state: t.ai as string,
      disarmed: t.disarmed === true,
      boss,
    }));
  return {
    pay: finite(s.pay?.credits),
    multiplier: finite(s.pay?.rate, 1),
    writLevel: level,
    writProgress: progress,
    graze: clamp01(finite(s.graze?.meter)),
    grazes: finite(s.graze?.count),
    scanning: player.scan?.active === true,
    scanTarget: target ? String(target.id) : null,
    scanProgress: clamp01(finite(target?.lock)),
    locked: target?.locked === true,
    scanState: target?.locked === true && typeof target.ai === "string"
      ? target.ai
      : null,
    intel,
  };
}

/** The FSM state's display text: a known id, or the raw name in caps. */
export function intelLabel(
  t: (key: UiKey, vars?: TextParams) => string,
  state: string,
  has: (key: string) => boolean,
): string {
  const key = `ui.intel.state.${state}`;
  return has(key) ? t(key as UiKey) : state.toUpperCase();
}

// ----------------------------------------------------------------- DOM

/** A point on screen in CSS pixels; `null` when off screen or unknown. */
export type ScreenPoint = { readonly x: number; readonly y: number } | null;

export interface RadioLine {
  /** Who is talking, already localized (e.g. "Scout 4", "Lane Authority"). */
  readonly source: string;
  readonly text: string;
  /** Stereo position, -1 (left) to 1 (right), from the spatial mix. */
  readonly pan?: number;
  readonly durationMs?: number;
  /** Language tag of `text`, so CJK typesetting rules apply. */
  readonly lang?: string;
}

export interface InstrumentOptions {
  readonly t: (key: UiKey, vars?: TextParams) => string;
  readonly hasText: (key: string) => boolean;
  readonly locale: () => string;
  /** From the stage (V): where an entity is on screen right now. */
  readonly screenPositionOf?: (entityId: string) => ScreenPoint;
}

export interface Instruments {
  /** PAY and multiplier, drawn beside SCOUTS SPARED. */
  readonly pay: HTMLElement;
  /** Writ charge and graze meters, under the score. */
  readonly gauges: HTMLElement;
  /** Scan readout, for the top center under the Warden bar. */
  readonly scan: HTMLElement;
  /** Absolute layer for intel tags and the radio channel. */
  readonly overlay: HTMLElement;
  /** Reads the snapshot and re-pins intel tags; call each frame. */
  update(state: SimState): void;
  /** Punctuation only: pulses on graze, pay, lock and charge events. */
  event(e: LooseEvent): void;
  radio(line: RadioLine): void;
  relabel(): void;
  reset(): void;
}

const RADIO_MS = 4200;

export function createInstruments(options: InstrumentOptions): Instruments {
  const { t } = options;
  let model: InstrumentModel | null = null;
  let drawn = "";

  const payLabel = h("span", { class: "nw-hud-label" });
  const payValue = h("span", { class: "nw-pay-value" });
  const payMult = h("span", { class: "nw-pay-mult" });
  const pay = h(
    "div",
    { class: "nw-hud-stat nw-pay" },
    payLabel,
    h("span", { class: "nw-hud-value" }, payValue, payMult),
  );

  const writLabel = h("span", { class: "nw-hud-label" });
  const writCells = [0, 1, 2].map(() => h("i"));
  const writSr = h("span", { class: "nw-sr" });
  const writ = h(
    "div",
    { class: "nw-hud-stat nw-writ" },
    writLabel,
    h(
      "span",
      { class: "nw-hud-value nw-writ-cells", "aria-hidden": "true" },
      ...writCells,
    ),
    writSr,
  );

  const grazeLabel = h("span", { class: "nw-hud-label" });
  const grazeFill = h("span", { class: "nw-graze-fill" });
  const grazeCount = h("span", { class: "nw-graze-count" });
  const graze = h(
    "div",
    { class: "nw-hud-stat nw-graze" },
    grazeLabel,
    h(
      "span",
      { class: "nw-hud-value" },
      h("span", { class: "nw-graze-track" }, grazeFill),
      grazeCount,
    ),
  );
  const gauges = h("div", { class: "nw-gauges" }, writ, graze);

  const scanText = h("span", { class: "nw-scan-text" });
  const scanBar = h("span", { class: "nw-scan-bar" });
  const scan = h(
    "div",
    { class: "nw-scan", hidden: true },
    h("span", { class: "nw-scan-reticle", "aria-hidden": "true" }),
    scanText,
    h("span", { class: "nw-scan-track" }, scanBar),
  );

  const tags = h("div", { class: "nw-intel-layer", "aria-hidden": "true" });
  const radioList = h("div", {
    class: "nw-radio",
    role: "log",
    "aria-live": "polite",
  });
  const overlay = h("div", { class: "nw-instruments" }, tags, radioList);
  const tagEls = new Map<string, HTMLElement>();

  function paint(m: InstrumentModel): void {
    payValue.textContent = Math.round(m.pay).toLocaleString(options.locale());
    payMult.textContent = t("ui.hud.payMult", {
      mult: m.multiplier.toFixed(1),
    });
    payMult.classList.toggle("is-hot", m.multiplier >= 2);
    writCells.forEach((cell, i) => {
      const fill = i < m.writLevel ? 1 : i === m.writLevel ? m.writProgress : 0;
      cell.style.setProperty("--fill", fill.toFixed(3));
      cell.classList.toggle("is-full", i < m.writLevel);
    });
    writ.classList.toggle("is-max", m.writLevel >= 3);
    writSr.textContent = t("ui.hud.writLevel", { n: m.writLevel });
    grazeFill.style.width = `${Math.round(m.graze * 100)}%`;
    grazeCount.textContent = m.grazes > 0 ? `×${m.grazes}` : "";
    scan.hidden = !m.scanning && m.scanTarget === null;
    scan.classList.toggle("is-locked", m.locked);
    scan.classList.toggle("is-dwell", m.scanTarget !== null && !m.locked);
    scanBar.style.width = `${Math.round(m.scanProgress * 100)}%`;
    scanText.textContent = m.locked
      ? m.scanState
        ? t("ui.hud.scanLockedState", {
          state: intelLabel(t, m.scanState, options.hasText),
        })
        : t("ui.hud.scanLocked")
      : t("ui.hud.scanning");

    const live = new Set(m.intel.map((tag) => tag.id));
    for (const [id, el] of tagEls) {
      if (!live.has(id)) {
        el.remove();
        tagEls.delete(id);
      }
    }
    for (const tag of m.intel) {
      let el = tagEls.get(tag.id);
      if (!el) {
        el = h(
          "div",
          { class: "nw-intel" },
          h("span", {
            class: "nw-intel-state",
          }),
        );
        tagEls.set(tag.id, el);
        tags.append(el);
      }
      el.firstElementChild!.textContent = tag.disarmed
        ? t("ui.intel.disarmed")
        : intelLabel(t, tag.state, options.hasText);
      el.dataset.state = tag.disarmed ? "disarmed" : tag.state;
      el.classList.toggle("is-boss", tag.boss);
    }
  }

  function update(state: SimState): void {
    const m = readInstruments(state);
    model = m;
    const key = JSON.stringify(m);
    if (key !== drawn) {
      drawn = key;
      paint(m);
    }
    const locate = options.screenPositionOf;
    for (const [id, el] of tagEls) {
      const p = locate ? locate(id) : null;
      el.hidden = p === null;
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  function pulse(el: HTMLElement): void {
    el.classList.remove("is-pulse");
    void el.offsetWidth;
    el.classList.add("is-pulse");
  }

  function event(e: LooseEvent): void {
    if (e.type === "graze") pulse(graze);
    else if (e.type === "payChanged") pulse(pay);
    else if (e.type === "scanLock") pulse(scan);
    else if (e.type === "chargeLevel") pulse(writ);
  }

  function radio(line: RadioLine): void {
    const pan = Math.max(-1, Math.min(1, line.pan ?? 0));
    const side = pan < -0.25 ? "left" : pan > 0.25 ? "right" : "center";
    const item = h(
      "p",
      { class: "nw-radio-line", "data-side": side, lang: line.lang },
      h(
        "span",
        { class: "nw-radio-side", "aria-hidden": "true" },
        side === "left" ? "◂" : side === "right" ? "▸" : "◆",
      ),
      h("span", { class: "nw-radio-source" }, line.source),
      h("span", { class: "nw-radio-text" }, line.text),
    );
    radioList.append(item);
    while (radioList.children.length > 3) radioList.firstElementChild?.remove();
    setTimeout(() => item.remove(), line.durationMs ?? RADIO_MS);
  }

  function relabel(): void {
    payLabel.textContent = t("ui.hud.pay");
    writLabel.textContent = t("ui.hud.writ");
    grazeLabel.textContent = t("ui.hud.graze");
    drawn = "";
    if (model) paint(model);
  }

  function reset(): void {
    model = null;
    drawn = "";
    radioList.replaceChildren();
    tags.replaceChildren();
    tagEls.clear();
    scan.hidden = true;
  }

  relabel();
  return { pay, gauges, scan, overlay, update, event, radio, relabel, reset };
}
