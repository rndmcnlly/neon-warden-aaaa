/**
 * The hangar: the Pilot's ship on a lit pad (V's hangar shot behind the
 * panel), with four tabs:
 *
 *   Loadout   weapon and sensor packages (real stat deltas from
 *             `contracts/loadout.ts`) and cosmetics, previewed live
 *   Mastery   a 50-rank track; the slice reaches rank 3
 *   Codex     entries unlocked by scan intel
 *   Campaign  eight chapters of five sectors; chapter 1 is this slice
 *
 * Reached from the main menu ("browse") and between New Game and the first
 * contract ("launch", which adds the Launch action). Everything beyond the
 * slice is shown and walled, with its own copy in the side panel: the
 * premium version of a stub is a confident description, not an apology.
 */

import {
  type Loadout,
  SENSOR_PACKAGES,
  type SensorPackageId,
  type SensorStats,
  TICK_RATE,
  WEAPON_PACKAGES,
  type WeaponPackageId,
  type WeaponStats,
} from "../../contracts/index.ts";
import {
  CHAPTERS,
  CODEX_INDEX,
  DECALS,
  HELMETS,
  MASTERY_IN_SLICE,
  MASTERY_RANKS,
  PAINTS,
  payForRank,
  RANK_REWARDS,
  rankForPay,
  SECTORS_PER_CHAPTER,
  TRAILS,
  TRIMS,
  WALLED_CODEX,
  WALLED_SLOTS,
} from "../../data/hangar.ts";
import { hasText, t as text } from "../../i18n/index.ts";
import type { UiKey } from "../../i18n/index.ts";
import type { UiContext } from "../context.ts";
import { codexLines, type ProgressStore } from "../progress.ts";
import type { ScreenFactory } from "../router.ts";
import { uiSound } from "../sound.ts";
import {
  button,
  choiceRow,
  h,
  panel,
  stagger,
  type Widget,
} from "../widgets.ts";
import { chapterSelectScreen } from "./menus.ts";

type TabId = "loadout" | "mastery" | "codex" | "campaign";
const TABS: readonly TabId[] = ["loadout", "mastery", "codex", "campaign"];
let lastTab: TabId = "loadout";
/** A quiet "describe yourself again" event (no focus sound). */
const REDESCRIBE = "nw-describe";

export type HangarMode = "browse" | "launch";

/** What V's `applyLoadout` takes: ids plus display colors. */
export function shipLook(loadout: Loadout) {
  const c = loadout.cosmetics;
  return {
    weapon: loadout.weapon,
    sensor: loadout.sensor,
    paint: PAINTS[c.paint] ?? PAINTS.authorityWhite,
    trim: c.trimColor,
    decal: c.decal,
    trail: c.trail,
    helmet: c.helmetLivery,
  };
}

// ------------------------------------------------------------- stats

interface StatLine {
  readonly label: UiKey;
  readonly value: number;
  readonly base: number;
  /** Larger is better (rate, damage) or smaller is better (cooldowns). */
  readonly better: "higher" | "lower";
  readonly format: (v: number) => string;
  /** Largest value among in-slice packages, for the bar length. */
  readonly max: number;
}

const secs = (ticks: number) => `${(ticks / TICK_RATE).toFixed(2)} s`;

function weaponLines(s: WeaponStats, base: WeaponStats): StatLine[] {
  const all = Object.values(WEAPON_PACKAGES).map((p) => p.stats);
  const max = (f: (w: WeaponStats) => number) => Math.max(...all.map(f));
  const rate = (w: WeaponStats) => TICK_RATE / w.streamInterval;
  return [
    {
      label: "ui.hangar.stat.streamRate",
      value: rate(s),
      base: rate(base),
      better: "higher",
      format: (v) => `${v.toFixed(1)}/s`,
      max: max(rate),
    },
    {
      label: "ui.hangar.stat.aimedDamage",
      value: s.aimedDamage,
      base: base.aimedDamage,
      better: "higher",
      format: String,
      max: max((w) => w.aimedDamage),
    },
    {
      label: "ui.hangar.stat.aimedCooldown",
      value: s.aimedCooldown,
      base: base.aimedCooldown,
      better: "lower",
      format: secs,
      max: max((w) => w.aimedCooldown),
    },
    {
      label: "ui.hangar.stat.writCharge",
      value: s.chargeTicks[2],
      base: base.chargeTicks[2],
      better: "lower",
      format: secs,
      max: max((w) => w.chargeTicks[2]),
    },
    {
      label: "ui.hangar.stat.writDamage",
      value: s.writDamage[2],
      base: base.writDamage[2],
      better: "higher",
      format: String,
      max: max((w) => w.writDamage[2]),
    },
    {
      label: "ui.hangar.stat.writRadius",
      value: s.writRadius[2],
      base: base.writRadius[2],
      better: "higher",
      format: String,
      max: max((w) => w.writRadius[2]),
    },
  ];
}

function sensorLines(s: SensorStats, base: SensorStats): StatLine[] {
  const all = Object.values(SENSOR_PACKAGES).map((p) => p.stats);
  const max = (f: (x: SensorStats) => number) => Math.max(...all.map(f));
  const deg = (x: SensorStats) => (x.coneHalfAngle * 2 * 180) / Math.PI;
  return [
    {
      label: "ui.hangar.stat.cone",
      value: deg(s),
      base: deg(base),
      better: "higher",
      format: (v) => `${Math.round(v)}°`,
      max: max(deg),
    },
    {
      label: "ui.hangar.stat.range",
      value: s.range,
      base: base.range,
      better: "higher",
      format: String,
      max: max((x) => x.range),
    },
    {
      label: "ui.hangar.stat.lockTime",
      value: s.lockTicks,
      base: base.lockTicks,
      better: "lower",
      format: secs,
      max: max((x) => x.lockTicks),
    },
  ];
}

/** "+40%" or "–25%", and whether the change helps. Pure, for tests. */
export function statDelta(
  line: Pick<StatLine, "value" | "base" | "better">,
): { text: string; tone: "better" | "worse" | "same" } {
  if (line.base === 0 || line.value === line.base) {
    return { text: "±0%", tone: "same" };
  }
  const pct = Math.round(((line.value - line.base) / line.base) * 100);
  const up = line.value > line.base;
  return {
    text: `${up ? "+" : "–"}${Math.abs(pct)}%`,
    tone: up === (line.better === "higher") ? "better" : "worse",
  };
}

function statTable(ctx: UiContext, lines: StatLine[]): HTMLElement {
  return h(
    "dl",
    { class: "nw-stats nw-hangar-stats" },
    ...lines.flatMap((line) => {
      const delta = statDelta(line);
      const fraction = line.max > 0 ? line.value / line.max : 0;
      const baseFraction = line.max > 0 ? line.base / line.max : 0;
      const bar = h("span", { class: "nw-stat-bar" });
      bar.style.setProperty("--v", fraction.toFixed(3));
      bar.style.setProperty("--b", baseFraction.toFixed(3));
      return [
        h("dt", {}, ctx.t(line.label)),
        h(
          "dd",
          {},
          bar,
          h("span", { class: "nw-stat-value" }, line.format(line.value)),
          h(
            "span",
            { class: `nw-stat-delta is-${delta.tone}` },
            delta.text,
          ),
        ),
      ];
    }),
  );
}

// ------------------------------------------------------------ aside

function aside(ctx: UiContext) {
  const el = h("aside", { class: "nw-hangar-aside", "aria-live": "polite" });
  return {
    el,
    show(
      opts: {
        kicker?: string;
        title: string;
        body?: string;
        extra?: HTMLElement | null;
        walled?: boolean;
      },
    ) {
      const parts: (Node | null)[] = [
        opts.walled
          ? h("p", { class: "nw-wall-badge" }, ctx.t("ui.stub.badge"))
          : null,
        opts.kicker ? h("p", { class: "nw-hd-kicker" }, opts.kicker) : null,
        h("h3", { class: "nw-desc-title" }, opts.title),
        opts.body ? h("p", { class: "nw-desc-body" }, opts.body) : null,
        opts.extra ?? null,
      ];
      el.replaceChildren(...parts.filter((p): p is Node => p !== null));
      el.classList.toggle("is-walled", !!opts.walled);
    },
  };
}

/** A walled item: focusable, plays the locked sound, explains itself. */
function walled(
  key: string,
  label: string,
  onFocus: () => void,
  className = "nw-row is-locked",
): HTMLButtonElement {
  const el = button({
    key,
    label,
    className: `${className} is-walled nw-walled`,
    sound: "locked",
    onActivate: () => {},
  });
  el.addEventListener("focus", onFocus);
  el.prepend(h("span", { class: "nw-lock", "aria-hidden": "true" }));
  return el;
}

// ------------------------------------------------------------- tabs

interface TabResult {
  readonly widgets: Widget[];
  readonly nodes: HTMLElement[];
}

function loadoutTab(
  ctx: UiContext,
  progress: ProgressStore,
  side: ReturnType<typeof aside>,
  apply: (loadout: Loadout) => void,
): TabResult {
  const get = () => progress.get().loadout;
  const setCosmetic = (patch: Partial<Loadout["cosmetics"]>) =>
    apply({ ...get(), cosmetics: { ...get().cosmetics, ...patch } });
  const weapons = Object.values(WEAPON_PACKAGES).filter((p) => p.inSlice);
  const sensors = Object.values(SENSOR_PACKAGES).filter((p) => p.inSlice);

  const describeWeapon = () => {
    const id = get().weapon;
    side.show({
      kicker: ctx.t("ui.hangar.slot.weapon"),
      title: ctx.t(`ui.hangar.weapon.${id}.name` as UiKey),
      body: ctx.t(`ui.hangar.weapon.${id}.blurb` as UiKey),
      extra: statTable(
        ctx,
        weaponLines(WEAPON_PACKAGES[id].stats, WEAPON_PACKAGES.standard.stats),
      ),
    });
  };
  const describeSensor = () => {
    const id = get().sensor;
    side.show({
      kicker: ctx.t("ui.hangar.slot.sensor"),
      title: ctx.t(`ui.hangar.sensor.${id}.name` as UiKey),
      body: ctx.t(`ui.hangar.sensor.${id}.blurb` as UiKey),
      extra: statTable(
        ctx,
        sensorLines(SENSOR_PACKAGES[id].stats, SENSOR_PACKAGES.standard.stats),
      ),
    });
  };
  const describeCosmetic = (slot: string) => () =>
    side.show({
      kicker: ctx.t("ui.hangar.cosmetic"),
      title: ctx.t(`ui.hangar.slot.${slot}` as UiKey),
      body: ctx.t(`ui.hangar.desc.${slot}` as UiKey),
    });

  const rows: { widget: Widget; describe: () => void }[] = [
    {
      widget: choiceRow<WeaponPackageId>({
        key: "hangar-weapon",
        label: ctx.t("ui.hangar.slot.weapon"),
        options: weapons.map((p) => ({
          value: p.id,
          label: ctx.t(`ui.hangar.weapon.${p.id}.name` as UiKey),
        })),
        get: () => get().weapon,
        set: (weapon) => apply({ ...get(), weapon }),
      }),
      describe: describeWeapon,
    },
    {
      widget: choiceRow<SensorPackageId>({
        key: "hangar-sensor",
        label: ctx.t("ui.hangar.slot.sensor"),
        options: sensors.map((p) => ({
          value: p.id,
          label: ctx.t(`ui.hangar.sensor.${p.id}.name` as UiKey),
        })),
        get: () => get().sensor,
        set: (sensor) => apply({ ...get(), sensor }),
      }),
      describe: describeSensor,
    },
    {
      widget: choiceRow({
        key: "hangar-paint",
        label: ctx.t("ui.hangar.slot.paint"),
        options: (Object.keys(PAINTS) as (keyof typeof PAINTS)[]).map((
          value,
        ) => ({ value, label: ctx.t(`ui.hangar.paint.${value}` as UiKey) })),
        get: () => get().cosmetics.paint,
        set: (paint) => setCosmetic({ paint }),
      }),
      describe: describeCosmetic("paint"),
    },
    {
      widget: choiceRow({
        key: "hangar-trim",
        label: ctx.t("ui.hangar.slot.trim"),
        options: (Object.entries(TRIMS)).map(([name, hex]) => ({
          value: hex as string,
          label: ctx.t(`ui.hangar.trim.${name}` as UiKey),
        })),
        get: () => get().cosmetics.trimColor,
        set: (trimColor) => setCosmetic({ trimColor }),
      }),
      describe: describeCosmetic("trim"),
    },
    {
      widget: choiceRow({
        key: "hangar-decal",
        label: ctx.t("ui.hangar.slot.decal"),
        options: DECALS.map((value) => ({
          value,
          label: ctx.t(`ui.hangar.decal.${value}` as UiKey),
        })),
        get: () => get().cosmetics.decal,
        set: (decal) => setCosmetic({ decal }),
      }),
      describe: describeCosmetic("decal"),
    },
    {
      widget: choiceRow({
        key: "hangar-trail",
        label: ctx.t("ui.hangar.slot.trail"),
        options: TRAILS.map((value) => ({
          value,
          label: ctx.t(`ui.hangar.trail.${value}` as UiKey),
        })),
        get: () => get().cosmetics.trail,
        set: (trail) => setCosmetic({ trail }),
      }),
      describe: describeCosmetic("trail"),
    },
    {
      widget: choiceRow({
        key: "hangar-helmet",
        label: ctx.t("ui.hangar.slot.helmet"),
        options: HELMETS.map((value) => ({
          value,
          label: ctx.t(`ui.hangar.helmet.${value}` as UiKey),
        })),
        get: () => get().cosmetics.helmetLivery,
        set: (helmetLivery) => setCosmetic({ helmetLivery }),
      }),
      describe: describeCosmetic("helmet"),
    },
  ];
  for (const { widget, describe } of rows) {
    widget.el.addEventListener("focus", describe);
    // `apply` re-describes the focused row, so stat deltas follow the cycler.
    widget.el.addEventListener(REDESCRIBE, describe);
  }
  // Swatch beside the paint and trim values.
  const swatch = (row: Widget, color: () => string) => {
    const dot = h("span", { class: "nw-swatch", "aria-hidden": "true" });
    row.el.querySelector(".nw-row-control")?.prepend(dot);
    const sync = row.sync;
    return {
      el: row.el,
      sync: () => {
        sync();
        dot.style.background = color();
      },
    };
  };
  rows[2].widget = swatch(rows[2].widget, () => PAINTS[get().cosmetics.paint]);
  rows[3].widget = swatch(rows[3].widget, () => get().cosmetics.trimColor);

  const beyond = [
    ...Object.values(WEAPON_PACKAGES).filter((p) => !p.inSlice).map((p) =>
      walled(
        `wall-weapon-${p.id}`,
        ctx.t(`ui.hangar.weapon.${p.id}.name` as UiKey),
        () =>
          side.show({
            walled: true,
            kicker: ctx.t("ui.hangar.slot.weapon"),
            title: ctx.t(`ui.hangar.weapon.${p.id}.name` as UiKey),
            body: ctx.t(`ui.hangar.weapon.${p.id}.blurb` as UiKey),
          }),
      )
    ),
    ...Object.values(SENSOR_PACKAGES).filter((p) => !p.inSlice).map((p) =>
      walled(
        `wall-sensor-${p.id}`,
        ctx.t(`ui.hangar.sensor.${p.id}.name` as UiKey),
        () =>
          side.show({
            walled: true,
            kicker: ctx.t("ui.hangar.slot.sensor"),
            title: ctx.t(`ui.hangar.sensor.${p.id}.name` as UiKey),
            body: ctx.t(`ui.hangar.sensor.${p.id}.blurb` as UiKey),
          }),
      )
    ),
    ...WALLED_SLOTS.map((slot) =>
      walled(
        `wall-slot-${slot}`,
        ctx.t(`ui.hangar.wall.${slot}` as UiKey),
        () =>
          side.show({
            walled: true,
            kicker: ctx.t("ui.hangar.slotBeyond"),
            title: ctx.t(`ui.hangar.wall.${slot}` as UiKey),
            body: ctx.t(`ui.hangar.wall.${slot}Body` as UiKey),
          }),
      )
    ),
  ];
  const widgets = rows.map((r) => r.widget);
  widgets.forEach((w) => w.sync());
  return {
    widgets,
    nodes: [
      h("h3", { class: "nw-subhead" }, ctx.t("ui.hangar.equipped")),
      stagger(
        h("div", { class: "nw-hangar-list" }, ...widgets.map((w) => w.el)),
      ),
      h("h3", { class: "nw-subhead is-walled" }, ctx.t("ui.hangar.beyond")),
      stagger(h("div", { class: "nw-hangar-list is-walled-list" }, ...beyond)),
    ],
  };
}

function masteryTab(
  ctx: UiContext,
  progress: ProgressStore,
  side: ReturnType<typeof aside>,
): TabResult {
  const pay = progress.get().careerPay;
  const rank = rankForPay(pay);
  const next = payForRank(rank + 1);
  const meter = h("span", { class: "nw-mastery-fill" });
  const prev = payForRank(rank);
  meter.style.width = `${
    Math.min(100, ((pay - prev) / Math.max(1, next - prev)) * 100)
  }%`;
  const header = h(
    "div",
    { class: "nw-mastery-head" },
    h("span", { class: "nw-mastery-rank" }, String(rank)),
    h(
      "span",
      { class: "nw-mastery-text" },
      h("strong", {}, ctx.t("ui.hangar.mastery.rank", { n: rank })),
      h(
        "span",
        { class: "nw-footnote" },
        ctx.t("ui.hangar.mastery.career", { pay: Math.round(pay) }),
      ),
      h("span", { class: "nw-mastery-track" }, meter),
    ),
  );
  const ranks = Array.from({ length: MASTERY_RANKS }, (_, i) => i + 1).map(
    (n) => {
      const reward = RANK_REWARDS[(n - 1) % RANK_REWARDS.length];
      const label = ctx.t("ui.hangar.mastery.rankShort", { n });
      const rewardText = ctx.t(`ui.hangar.reward.${reward}` as UiKey);
      if (n > MASTERY_IN_SLICE) {
        return walled(`rank-${n}`, label, () =>
          side.show({
            walled: true,
            kicker: rewardText,
            title: label,
            body: ctx.t("ui.hangar.mastery.walledBody", {
              pay: payForRank(n),
            }),
          }), "nw-rank is-locked");
      }
      const el = button({
        key: `rank-${n}`,
        label,
        className: `nw-rank ${n <= rank ? "is-earned" : ""}`,
        onActivate: () => {},
      });
      el.addEventListener("focus", () =>
        side.show({
          kicker: rewardText,
          title: label,
          body: n <= rank
            ? ctx.t("ui.hangar.mastery.earned")
            : ctx.t("ui.hangar.mastery.toEarn", { pay: payForRank(n) }),
        }));
      return el;
    },
  );
  return {
    widgets: [],
    nodes: [
      header,
      h("div", { class: "nw-rank-track" }, ...ranks),
    ],
  };
}

function codexTab(
  ctx: UiContext,
  progress: ProgressStore,
  side: ReturnType<typeof aside>,
): TabResult {
  const unlocked = new Set(progress.get().codex);
  const lang = ctx.lang();
  const title = (id: string) => {
    const lines = codexLines(id);
    return lines ? text(lines.title, lang) : id;
  };
  const body = (id: string) => {
    const lines = codexLines(id);
    return lines && hasText(lines.body)
      ? text(lines.body, lang)
      : ctx.t("ui.codex.bodyPending");
  };
  const entries = CODEX_INDEX.map((entry) => {
    const open = unlocked.has(entry.id);
    const el = button({
      key: entry.id,
      label: open ? title(entry.id) : ctx.t("ui.codex.unknown"),
      className: `nw-row nw-codex-entry ${open ? "is-open" : "is-sealed"}`,
      sound: open ? "confirm" : "locked",
      onActivate: () => {},
    });
    el.addEventListener("focus", () =>
      side.show(
        open
          ? {
            kicker: ctx.t("ui.codex.entry"),
            title: title(entry.id),
            body: body(entry.id),
          }
          : {
            kicker: ctx.t("ui.codex.sealed"),
            title: ctx.t("ui.codex.unknown"),
            body: ctx.t(entry.hint as UiKey),
          },
      ));
    return el;
  });
  const shelves = WALLED_CODEX.map((shelf) =>
    walled(
      `codex-${shelf}`,
      ctx.t(`ui.codex.shelf.${shelf}` as UiKey),
      () =>
        side.show({
          walled: true,
          kicker: ctx.t("ui.codex.shelf"),
          title: ctx.t(`ui.codex.shelf.${shelf}` as UiKey),
          body: ctx.t(`ui.codex.shelf.${shelf}Body` as UiKey),
        }),
    )
  );
  return {
    widgets: [],
    nodes: [
      h(
        "p",
        { class: "nw-footnote" },
        ctx.t("ui.codex.count", {
          n: unlocked.size,
          total: CODEX_INDEX.length,
        }),
      ),
      stagger(h("div", { class: "nw-hangar-list" }, ...entries)),
      h("h3", { class: "nw-subhead is-walled" }, ctx.t("ui.hangar.beyond")),
      stagger(h("div", { class: "nw-hangar-list is-walled-list" }, ...shelves)),
    ],
  };
}

function campaignTab(
  ctx: UiContext,
  side: ReturnType<typeof aside>,
): TabResult {
  const chapters = Array.from({ length: CHAPTERS }, (_, i) => i + 1).map(
    (n) => {
      const name = ctx.t(`ui.campaign.ch${n}` as UiKey);
      const label = ctx.t("ui.campaign.chapter", { n });
      const nodes = h(
        "span",
        { class: "nw-sector-nodes", "aria-hidden": "true" },
        ...Array.from(
          { length: SECTORS_PER_CHAPTER },
          (_, j) =>
            h("i", { class: n === 1 ? "is-open" : undefined }, `${n}-${j + 1}`),
        ),
      );
      if (n > 1) {
        const el = walled(
          `chapter-${n}`,
          `${label} · ${name}`,
          () =>
            side.show({
              walled: true,
              kicker: label,
              title: name,
              body: ctx.t(`ui.campaign.ch${n}Body` as UiKey),
            }),
          "nw-chapter-node is-locked",
        );
        el.append(nodes);
        return el;
      }
      const el = button({
        key: "chapter-1",
        label: `${label} · ${name}`,
        className: "nw-chapter-node is-current",
        sound: "menu_open",
        onActivate: () => ctx.router.push(chapterSelectScreen(ctx)),
      });
      el.append(nodes);
      el.addEventListener("focus", () =>
        side.show({
          kicker: ctx.t("ui.campaign.thisSlice"),
          title: name,
          body: ctx.t("ui.campaign.ch1Body"),
        }));
      return el;
    },
  );
  return {
    widgets: [],
    nodes: [
      h("p", { class: "nw-footnote" }, ctx.t("ui.campaign.intro")),
      h("div", { class: "nw-campaign-map" }, ...chapters),
    ],
  };
}

// ------------------------------------------------------------ screen

export function hangarScreen(
  ctx: UiContext,
  progress: ProgressStore,
  mode: HangarMode,
): ScreenFactory {
  return () => {
    let widgets: Widget[] = [];
    const side = aside(ctx);
    const body = h("div", { class: "nw-hangar-body", role: "tabpanel" });

    const apply = (loadout: Loadout) => {
      progress.setLoadout(loadout);
      ctx.hooks.applyLoadout?.(loadout, shipLook(loadout));
      widgets.forEach((w) => w.sync());
      document.activeElement?.dispatchEvent(new Event(REDESCRIBE));
    };
    ctx.hooks.showHangar?.("hero");
    ctx.hooks.applyLoadout?.(
      progress.get().loadout,
      shipLook(progress.get().loadout),
    );

    const tabButtons = TABS.map((tab) =>
      button({
        key: `tab-${tab}`,
        label: ctx.t(`ui.hangar.tab.${tab}` as UiKey),
        className: "nw-tab",
        sound: "tab_switch",
        onActivate: () => show(tab, false, 0),
      })
    );
    const describeTab = (tab: TabId) =>
      side.show({
        title: ctx.t(`ui.hangar.tab.${tab}` as UiKey),
        body: ctx.t(`ui.hangar.tabDesc.${tab}` as UiKey),
      });
    tabButtons.forEach((el, i) => {
      el.setAttribute("role", "tab");
      el.addEventListener("focus", () => describeTab(TABS[i]));
    });

    function show(tab: TabId, moveFocus: boolean, dir: number): void {
      lastTab = tab;
      const result = tab === "loadout"
        ? loadoutTab(ctx, progress, side, apply)
        : tab === "mastery"
        ? masteryTab(ctx, progress, side)
        : tab === "codex"
        ? codexTab(ctx, progress, side)
        : campaignTab(ctx, side);
      widgets = result.widgets;
      body.replaceChildren(...result.nodes);
      body.dataset.slide = dir < 0 ? "back" : dir > 0 ? "forward" : "none";
      body.classList.remove("is-sliding");
      void body.offsetWidth;
      body.classList.add("is-sliding");
      // Turntable while browsing the codex and map; hero shot on loadout.
      ctx.hooks.showHangar?.(tab === "loadout" ? "hero" : "turntable");
      tabButtons.forEach((el, i) => {
        el.setAttribute("aria-selected", String(TABS[i] === tab));
        el.classList.toggle("is-selected", TABS[i] === tab);
      });
      describeTab(tab);
      if (moveFocus) {
        tabButtons[TABS.indexOf(tab)].focus({ preventScroll: true });
      }
    }

    const actions = mode === "launch"
      ? h(
        "div",
        { class: "nw-actions is-end" },
        button({
          key: "launch",
          label: ctx.t("ui.hangar.launch"),
          className: "is-primary",
          onActivate: () =>
            ctx.startGame({
              at: "tutorial",
              difficulty: ctx.settings.get().accessibility.difficulty,
            }),
        }),
      )
      : null;

    const el = panel({
      id: "hangar",
      title: ctx.t("ui.hangar.title"),
      className: "is-wide",
      body: [
        h("div", { class: "nw-tabs", role: "tablist" }, ...tabButtons),
        h("div", { class: "nw-hangar-grid" }, body, side.el),
        actions,
      ],
      prompts: [
        ["confirm", ctx.t("ui.common.select")],
        ["adjust", ctx.t("ui.common.adjust")],
        ["tabs", ctx.t("ui.common.tab")],
        ["back", ctx.t("ui.common.back")],
      ],
    });
    show(lastTab, false, 0);
    // Land on what you came to change: Launch when about to fly, else the
    // first loadout row (or the tab, on the other tabs).
    const first = el.querySelector<HTMLElement>(
      '[data-key="launch"], [data-key="hangar-weapon"]',
    );
    (first ?? tabButtons[TABS.indexOf(lastTab)]).dataset.autofocus = "";

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
        show(next, true, delta);
        return true;
      },
      sync: () => widgets.forEach((w) => w.sync()),
      dispose: () => ctx.hooks.showHangar?.(null),
    };
  };
}
