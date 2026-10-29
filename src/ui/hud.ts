/**
 * The in-game HUD and the big center banners. Two layers, on purpose:
 *
 *   hudModel(state, tally)  pure: SimState in, a small view model out
 *   createHud(...)          DOM: draws the model, touching only what changed
 *
 * The pure half is a view model (MVVM in miniature): tests check what the
 * HUD would show without a browser, and the DOM half stays a dumb painter.
 *
 * The loop feeds it three things, all read-only:
 *   update(state)  after each sim step (or each frame; it diffs)
 *   event(e)       every SimEvent (spawn tallies, sector and boss banners)
 *   flag(n, v)     story flags (serial reveal, ending banners, tutorial)
 */

import type {
  BossPhase,
  Lang,
  SectorIndex,
  SimEvent,
  SimState,
} from "../contracts/index.ts";
import type { TextParams, UiKey } from "../i18n/index.ts";
import { glyph, h } from "./widgets.ts";
import {
  createInstruments,
  type LooseEvent,
  type RadioLine,
  type ScreenPoint,
} from "./instruments.ts";

/** Pilot #0122: the serial the flashback reveals (see BIBLE.md). */
export const PLAYER_SERIAL = "0122";
const MAX_LIFE_PIPS = 5;
const BANNER_MS = 3200;
const ENDING_BANNER_MS = 5200;

/** Counts the HUD keeps from events, since `SimState` has no history. */
export interface HudTally {
  /** Enemies spawned this run (the Warden excluded). */
  spawned: number;
  /** Escorts wiped when the Warden fell: gone, but not spared. */
  wiped: number;
  serialRevealed: boolean;
}

export function emptyTally(): HudTally {
  return { spawned: 0, wiped: 0, serialRevealed: false };
}

export interface WardenModel {
  /** Remaining health, 0–1. */
  readonly fraction: number;
  readonly phase: BossPhase;
  /** Descending or talking: shots deflect. */
  readonly shielded: boolean;
}

export interface HudModel {
  readonly tutorial: boolean;
  readonly score: number;
  readonly lives: number;
  readonly power: number;
  readonly shielded: boolean;
  readonly sector: SectorIndex;
  readonly warden: WardenModel | null;
  /** No kills yet this run (hidden in the tutorial, whose drills reset). */
  readonly pacifist: boolean;
  /** Enemies that left play alive, without being wiped by the Warden's fall. */
  readonly spared: number;
  readonly serial: string | null;
}

export function hudModel(state: SimState, tally: HudTally): HudModel {
  const tutorial = state.phase === "tutorial";
  const boss = state.boss;
  // Prefer the sim's own count (wave 3); derive it from the tally before.
  const fromSim = (state as { readonly scoutsSpared?: number }).scoutsSpared;
  const spared = fromSim ?? tally.spawned - tally.wiped - state.kills -
      state.enemies.length;
  return {
    tutorial,
    score: state.score,
    lives: state.player.lives,
    power: state.player.power,
    shielded: state.player.shielded,
    sector: state.sector,
    warden: boss && state.phase !== "ended"
      ? {
        fraction: boss.maxHp > 0 ? Math.max(0, boss.hp / boss.maxHp) : 0,
        phase: boss.phase,
        shielded: boss.invulnerable,
      }
      : null,
    pacifist: !tutorial && state.flags.pacifistIntact,
    spared: tutorial ? 0 : Math.max(0, spared),
    serial: tally.serialRevealed ? PLAYER_SERIAL : null,
  };
}

/** Folds one event into the tally. Pure, so tests can replay event logs. */
export function tallyEvent(tally: HudTally, event: SimEvent): void {
  if (event.type === "spawn" && event.kind !== "warden") tally.spawned++;
  if (event.type === "despawn" && event.reason === "wiped") tally.wiped++;
}

/** The event types this file's own tally and banners understand. */
const SIM_EVENT_TYPES: ReadonlySet<string> = new Set<SimEvent["type"]>([
  "sectorStarted",
  "sectorCleared",
  "spawn",
  "despawn",
  "playerFired",
  "hit",
  "kill",
  "lifeLost",
  "pickup",
  "bossWarning",
  "bossPhase",
  "bossDefeated",
  "bossSurvived",
  "gameOver",
]);

function isSimEvent(e: SimEvent | LooseEvent): e is SimEvent {
  return SIM_EVENT_TYPES.has(e.type);
}

// ------------------------------------------------------------- banners

export interface BannerSpec {
  readonly kicker?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly tone: "sector" | "warning" | "ending";
}

/** Text for an event's banner, or null. Sector 6 is the Warden's warning. */
export function bannerForEvent(
  event: SimEvent,
):
  | { kicker?: UiBit; title: UiBit; subtitle?: UiBit; tone: BannerSpec["tone"] }
  | null {
  if (event.type === "sectorStarted" && event.sector <= 5) {
    return {
      kicker: ["ui.banner.sector", { n: event.sector }],
      title: [`ui.sector.${event.sector}.name` as UiKey],
      subtitle: [`ui.sector.${event.sector}.subtitle` as UiKey],
      tone: "sector",
    };
  }
  if (event.type === "bossWarning") {
    return {
      kicker: ["ui.banner.warning"],
      title: [`ui.sector.6.name`],
      subtitle: ["ui.banner.wardenApproaches"],
      tone: "warning",
    };
  }
  return null;
}

/** A UI string id with optional params, resolved at draw time. */
export type UiBit = readonly [UiKey, TextParams?];

const FLAG_BANNERS: Readonly<
  Record<string, { title: UiKey; subtitle: UiKey }>
> = {
  "banner.wardenDown": {
    title: "ui.banner.wardenDown",
    subtitle: "ui.banner.lanesOpen",
  },
  "banner.lanesKept": {
    title: "ui.banner.lanesKept",
    subtitle: "ui.banner.lanesKeptSub",
  },
};

/**
 * Banner type size from text length, so a long Spanish title shrinks before
 * it would wrap into three lines. Returns a CSS length.
 */
export function bannerFontSize(text: string): string {
  // CJK glyphs are about 1.8 Latin characters wide (same rule as qa/).
  let width = 0;
  for (const ch of text) width += /[　-鿿＀-￯]/.test(ch) ? 1.8 : 1;
  const chars = Math.max(8, width);
  return `min(4.6em, calc(88vw / ${(chars * 0.72).toFixed(2)}))`;
}

// ----------------------------------------------------------------- DOM

export interface HudOptions {
  readonly t: (key: UiKey, vars?: TextParams) => string;
  readonly lang: () => Lang;
  /** Pressing the tutorial's skip chip with a pointer. */
  readonly onSkipClick: () => void;
  /** True if a text id exists (intel state names fall back to raw ids). */
  readonly hasText?: (key: string) => boolean;
  /** From the stage: an entity's screen position, for intel tags. */
  readonly screenPositionOf?: (entityId: string) => ScreenPoint;
}

export interface Hud {
  readonly el: HTMLElement;
  update(state: SimState): void;
  /** Every SimEvent, plus wave 3 events the sim may add (read loosely). */
  event(event: SimEvent | LooseEvent): void;
  /** Radio chatter text, separate from main-dialogue subtitles. */
  radio(line: RadioLine): void;
  flag(name: string, value: boolean): void;
  /** Clears tallies and banners: call at the start of each run. */
  reset(): void;
  /** True while the last snapshot was in the tutorial. */
  inTutorial(): boolean;
  /** Redraw every label (text language changed). */
  relabel(): void;
}

export function createHud(options: HudOptions): Hud {
  const { t } = options;
  let tally = emptyTally();
  let lastState: SimState | null = null;
  let lastPhase: SimState["phase"] | null = null;
  let drawn: Partial<Record<keyof HudModel, string>> = {};

  const el = h("div", { class: "nw-hud", "aria-hidden": "false" });
  const left = h("div", { class: "nw-hud-corner is-left" });
  const right = h("div", { class: "nw-hud-corner is-right" });
  const top = h("div", { class: "nw-hud-top" });
  const banners = h("div", {
    class: "nw-banners",
    role: "status",
    "aria-live": "polite",
  });
  el.append(left, right, top, banners);

  const stat = (cls: string) => {
    const label = h("span", { class: "nw-hud-label" });
    const value = h("span", { class: "nw-hud-value" });
    const box = h("div", { class: `nw-hud-stat ${cls}` }, label, value);
    return { box, label, value };
  };
  const score = stat("is-score");
  const sector = stat("is-sector");
  const hull = stat("is-hull");
  const cannon = stat("is-cannon");
  const shield = h("div", { class: "nw-hud-shield", hidden: true });
  const serial = h("div", { class: "nw-hud-serial", hidden: true });
  const conscience = h("div", { class: "nw-hud-conscience" });
  const pacifist = h("span", { class: "nw-hud-pacifist", hidden: true });
  const spared = h("span", { class: "nw-hud-spared", hidden: true });
  conscience.append(pacifist, spared);
  const instruments = createInstruments({
    t,
    hasText: options.hasText ?? (() => false),
    locale: () => options.lang() === "zh" ? "zh-CN" : options.lang(),
    screenPositionOf: options.screenPositionOf,
  });
  const ledger = h(
    "div",
    { class: "nw-hud-ledger" },
    instruments.pay,
    conscience,
  );
  left.append(score.box, sector.box, instruments.gauges, serial);
  right.append(hull.box, cannon.box, shield, ledger);

  const skip = h(
    "button",
    { type: "button", class: "nw-hud-skip", hidden: true, tabindex: "-1" },
  );
  skip.addEventListener("click", () => options.onSkipClick());
  left.append(skip);

  const warden = h("div", { class: "nw-warden", hidden: true });
  const wardenLabel = h("span", { class: "nw-warden-label" });
  const wardenState = h("span", { class: "nw-warden-state" });
  const wardenFill = h("span", { class: "nw-warden-fill" });
  const wardenTrack = h(
    "span",
    { class: "nw-warden-track", role: "meter", "aria-valuemin": "0" },
    wardenFill,
  );
  const pips = h("span", { class: "nw-warden-pips" }, h("i"), h("i"), h("i"));
  warden.append(
    h("span", { class: "nw-warden-head" }, wardenLabel, pips, wardenState),
    wardenTrack,
  );
  top.append(warden, instruments.scan);
  el.append(instruments.overlay);

  const pipRow = (count: number, max: number, cls: string) =>
    h(
      "span",
      { class: `nw-pips ${cls}`, "aria-hidden": "true" },
      ...Array.from(
        { length: max },
        (_, i) => h("i", { class: i < count ? "is-on" : undefined }),
      ),
    );

  function relabel(): void {
    score.label.textContent = t("ui.hud.score");
    hull.label.textContent = t("ui.hud.hull");
    cannon.label.textContent = t("ui.hud.cannon");
    shield.textContent = t("ui.hud.shield");
    wardenLabel.textContent = t("ui.hud.wardenMeter");
    pacifist.textContent = t("ui.hud.pacifist");
    skip.replaceChildren(glyph("backOnly"), t("ui.tut.skipPrompt"));
    instruments.relabel();
    drawn = {};
    if (lastState) update(lastState);
  }

  function changed(key: keyof HudModel, value: unknown): boolean {
    const text = JSON.stringify(value);
    if (drawn[key] === text) return false;
    drawn[key] = text;
    return true;
  }

  function update(state: SimState): void {
    // A new run (or a restart) starts from a lower tick: begin a fresh tally.
    // Leaving the tutorial wipes kills, so the tally starts over there too.
    if (lastState && state.tick < lastState.tick) reset();
    if (lastPhase === "tutorial" && state.phase !== "tutorial") {
      tally = { ...emptyTally(), serialRevealed: tally.serialRevealed };
    }
    lastPhase = state.phase;
    lastState = state;
    const m = hudModel(state, tally);
    const lang = options.lang();

    if (changed("score", m.score)) {
      score.value.textContent = m.score.toLocaleString(
        lang === "zh" ? "zh-CN" : lang,
      );
    }
    if (changed("sector", [m.sector, m.tutorial])) {
      sector.label.textContent = m.tutorial
        ? t("ui.hud.route")
        : t("ui.hud.sector", { n: m.sector });
      sector.value.textContent = m.tutorial
        ? t("ui.speaker.tutorial_ai")
        : t(`ui.sector.${m.sector}.name` as UiKey);
    }
    if (changed("lives", m.lives)) {
      hull.value.replaceChildren(
        pipRow(Math.min(m.lives, MAX_LIFE_PIPS), MAX_LIFE_PIPS, "is-hull"),
        h(
          "span",
          { class: "nw-sr" },
          t("ui.hud.livesLeft", { count: m.lives }),
        ),
      );
    }
    if (changed("power", m.power)) {
      cannon.value.replaceChildren(
        pipRow(m.power, 3, "is-cannon"),
        h("span", { class: "nw-sr" }, t("ui.hud.powerLevel", { n: m.power })),
      );
    }
    if (changed("shielded", m.shielded)) shield.hidden = !m.shielded;
    if (changed("serial", m.serial)) {
      serial.hidden = m.serial === null;
      if (m.serial) {
        serial.textContent = t("ui.hud.serial", { serial: m.serial });
      }
    }
    if (changed("pacifist", m.pacifist)) {
      pacifist.hidden = !m.pacifist;
    }
    if (changed("spared", m.spared)) {
      spared.hidden = m.spared === 0;
      spared.textContent = t("ui.hud.spared", { count: m.spared });
    }
    if (changed("tutorial", m.tutorial)) skip.hidden = !m.tutorial;
    if (changed("warden", m.warden)) drawWarden(m.warden);
    // The tutorial teaches one verb at a time: instruments appear after it.
    el.classList.toggle("is-tutorial", m.tutorial);
    instruments.update(state);
  }

  function drawWarden(w: WardenModel | null): void {
    warden.hidden = w === null;
    if (!w) return;
    const percent = Math.round(w.fraction * 100);
    wardenFill.style.width = `${percent}%`;
    wardenTrack.setAttribute("aria-valuemax", "100");
    wardenTrack.setAttribute("aria-valuenow", String(percent));
    warden.classList.toggle("is-shielded", w.shielded);
    [...pips.children].forEach((pip, i) =>
      pip.classList.toggle("is-on", w.phase >= i + 1)
    );
    wardenState.textContent = w.shielded
      ? t("ui.hud.wardenShielded")
      : w.phase > 0
      ? t("ui.hud.phase", { n: w.phase })
      : "";
  }

  // Banners: one at a time, queued, each held for its tone's duration.
  const queue: BannerSpec[] = [];
  let showing: ReturnType<typeof setTimeout> | undefined;
  function showBanner(spec: BannerSpec): void {
    queue.push(spec);
    if (showing === undefined) next();
  }
  function next(): void {
    const spec = queue.shift();
    banners.replaceChildren();
    if (!spec) {
      showing = undefined;
      return;
    }
    const title = h("p", { class: "nw-banner-title" }, spec.title);
    title.style.fontSize = bannerFontSize(spec.title);
    banners.append(h(
      "div",
      { class: `nw-banner is-${spec.tone}` },
      spec.kicker ? h("p", { class: "nw-banner-kicker" }, spec.kicker) : null,
      title,
      spec.subtitle ? h("p", { class: "nw-banner-sub" }, spec.subtitle) : null,
    ));
    showing = setTimeout(
      next,
      spec.tone === "ending" ? ENDING_BANNER_MS : BANNER_MS,
    );
  }
  const resolve = (bit?: UiBit) => bit && t(bit[0], bit[1]);

  function event(loose: SimEvent | LooseEvent): void {
    instruments.event(loose);
    if (!isSimEvent(loose)) return;
    const e = loose;
    tallyEvent(tally, e);
    const banner = bannerForEvent(e);
    if (banner) {
      showBanner({
        kicker: resolve(banner.kicker),
        title: resolve(banner.title)!,
        subtitle: resolve(banner.subtitle),
        tone: banner.tone,
      });
    }
  }

  function flag(name: string, value: boolean): void {
    if (name === "hud.serialRevealed") {
      tally.serialRevealed = value;
      if (lastState) update(lastState);
    }
    const ending = FLAG_BANNERS[name];
    if (ending && value) {
      showBanner({
        title: t(ending.title),
        subtitle: t(ending.subtitle),
        tone: "ending",
      });
    }
  }

  function reset(): void {
    tally = emptyTally();
    lastState = null;
    lastPhase = null;
    queue.length = 0;
    clearTimeout(showing);
    showing = undefined;
    banners.replaceChildren();
    drawn = {};
    warden.hidden = true;
    instruments.reset();
  }

  relabel();
  return {
    el,
    update,
    event,
    radio: (line) => instruments.radio(line),
    flag,
    reset,
    inTutorial: () => lastState?.phase === "tutorial",
    relabel,
  };
}
