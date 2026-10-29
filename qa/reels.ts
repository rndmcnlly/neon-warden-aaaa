/**
 * Reels: short, single-topic capture scripts. Each reel becomes one WebM
 * (1280x720, under a minute), a six-frame contact sheet, a console error log
 * and a pass/fail list of assertions. Add a reel by adding an entry here;
 * the runner, the dashboard and `deno task qa:reel <id>` pick it up.
 *
 * Steps drive the build the way a player would (keys, not DOM pokes), so a
 * reel that passes is evidence the real path works. Two escape hatches are
 * labeled as such in the assertions: `navigate` falls back to script focus
 * when arrow keys cannot reach a control, and `until` reads the QA probe
 * (`window.__nwqa`, requested in qa/REQUESTS.md) instead of the pixels.
 *
 * A reel or step that needs something not built yet says so with
 * `pendingIfMissing` or `needs`; it reports `pending`, not `fail`.
 */

export type Topic =
  | "menus"
  | "accessibility"
  | "cinematics"
  | "gameplay"
  | "endings";

/**
 * Partial settings preseeded into the store before the page loads (the store
 * merges missing keys from defaults). Typed loosely on purpose: QA must be
 * able to seed values the current `Settings` shape rejects, to test clamping.
 */
export type SeedSettings = Record<string, unknown>;

export type Step =
  /** Press `key` (default Enter) until `.nw-screen-<screen>` is visible. */
  | {
    readonly do: "advanceTo";
    readonly screen: string;
    readonly key?: string;
    readonly max?: number;
  }
  | {
    readonly do: "press";
    readonly key: string;
    readonly times?: number;
    readonly gapMs?: number;
  }
  | { readonly do: "wait"; readonly ms: number }
  /** Arrow keys until the control with `data-key` has focus; script focus as a labeled fallback. */
  | { readonly do: "navigate"; readonly key: string; readonly max?: number }
  | {
    readonly do: "waitFor";
    readonly selector: string;
    readonly label: string;
    readonly timeoutMs?: number;
    readonly pendingIfMissing?: string;
  }
  /** Visit every settings tab with tabNext (E), asserting no overflow on each. */
  | { readonly do: "settingsTabs"; readonly holdMs?: number }
  /** Capture a new key for the focused binding cell and assert the label changed. */
  | { readonly do: "remap"; readonly cell: string; readonly newKey: string }
  /** scrollWidth <= clientWidth on every element of the visible screen. */
  | { readonly do: "assertNoOverflow"; readonly label: string }
  /** Background alpha of `selector` within 0.06 of `alpha`. */
  | {
    readonly do: "assertBgAlpha";
    readonly selector: string;
    readonly alpha: number;
    readonly label: string;
  }
  /** Poll a predicate over the QA probe `p`; pending if the probe is absent. */
  | {
    readonly do: "until";
    readonly probe: string;
    readonly label: string;
    readonly timeoutMs: number;
  }
  /** The rendered frame is not blank (screenshot entropy proxy). */
  | { readonly do: "assertFrame"; readonly label: string }
  /** Load another URL in the same profile (settings persist). */
  | { readonly do: "goto"; readonly query: string };

export interface Reel {
  readonly id: string;
  readonly topic: Topic;
  readonly title: string;
  /** Query string for the first load, e.g. `?skipto=boss&seed=121`. */
  readonly query: string;
  readonly settings?: SeedSettings;
  readonly steps: readonly Step[];
  /** Hard cap on the recording; the runner stops here even mid-step. */
  readonly maxSeconds: number;
  /** Known missing prerequisites; the reel still runs, then reports pending. */
  readonly needs?: readonly string[];
}

/** Gate, photosensitivity notice, logos, title: the real cold-start path. */
const BOOT_TO_MENU: readonly Step[] = [
  {
    do: "waitFor",
    selector: ".nw-screen-gate",
    label: "press-any-key gate shows",
    timeoutMs: 15_000,
  },
  { do: "advanceTo", screen: "notice", max: 3 },
  { do: "assertNoOverflow", label: "photosensitivity notice fits" },
  { do: "advanceTo", screen: "title", max: 12 },
  { do: "advanceTo", screen: "main", max: 4 },
  { do: "assertNoOverflow", label: "main menu fits" },
];

function menuTour(lang: string): readonly Step[] {
  return [
    ...BOOT_TO_MENU,
    { do: "navigate", key: "settings" },
    { do: "press", key: "Enter" },
    {
      do: "waitFor",
      selector: ".nw-screen-settings",
      label: `settings opens (${lang})`,
    },
    { do: "settingsTabs", holdMs: 900 },
    { do: "remap", cell: "bind-fire-key0", newKey: "KeyJ" },
    { do: "assertNoOverflow", label: "controls tab after remap fits" },
    { do: "press", key: "Escape" },
    { do: "advanceTo", screen: "main", key: "Escape", max: 3 },
    { do: "navigate", key: "extras" },
    { do: "press", key: "Enter" },
    { do: "wait", ms: 700 },
    { do: "assertNoOverflow", label: "extras fits" },
    { do: "navigate", key: "licenses" },
    { do: "press", key: "Enter" },
    { do: "wait", ms: 900 },
    { do: "assertNoOverflow", label: "licenses fits" },
    { do: "advanceTo", screen: "main", key: "Escape", max: 4 },
    { do: "navigate", key: "credits" },
    { do: "press", key: "Enter" },
    { do: "wait", ms: 2500 },
    { do: "assertNoOverflow", label: "credits fits" },
  ];
}

const GAME = "&seed=121&qa=1";

export const REELS: readonly Reel[] = [
  {
    id: "menus-en",
    topic: "menus",
    title:
      "Front end, English: boot to menu, every settings tab, keyboard remap, extras, credits",
    query: "?qa=1",
    steps: menuTour("en"),
    maxSeconds: 60,
  },
  {
    id: "menus-es",
    topic: "menus",
    title: "Front end, Spanish: same tour, overflow asserted on every panel",
    query: "?qa=1",
    settings: { textLang: "es", voiceLang: "es" },
    steps: menuTour("es"),
    maxSeconds: 60,
  },
  {
    id: "menus-zh",
    topic: "menus",
    title: "Front end, Chinese: same tour, overflow asserted on every panel",
    query: "?qa=1",
    settings: { textLang: "zh", voiceLang: "zh" },
    steps: menuTour("zh"),
    maxSeconds: 60,
  },
  {
    id: "accessibility",
    topic: "accessibility",
    title:
      "Subtitles at 200% with 90% background, reduced flashing, shake 0, in menus and in the tutorial",
    query: "?qa=1",
    settings: {
      subtitles: {
        enabled: true,
        scale: 2,
        bgOpacity: 0.9,
        speakerNames: true,
      },
      accessibility: { reducedFlashing: true, shake: 0 },
    },
    steps: [
      ...BOOT_TO_MENU,
      { do: "navigate", key: "settings" },
      { do: "press", key: "Enter" },
      {
        do: "waitFor",
        selector: ".nw-screen-settings",
        label: "settings opens",
      },
      { do: "press", key: "KeyE", times: 3, gapMs: 500 },
      {
        do: "waitFor",
        selector: ".nw-subtitle-preview, .nw-settings-aside .nw-subtitle",
        label: "subtitle preview on the subtitles tab",
      },
      {
        do: "assertBgAlpha",
        selector: ".nw-settings-aside .nw-subtitle",
        alpha: 0.9,
        label: "preview background honors 90% opacity",
      },
      { do: "assertNoOverflow", label: "subtitles tab at 200% fits" },
      { do: "wait", ms: 1500 },
      { do: "goto", query: `?skipto=tutorial${GAME}` },
      {
        do: "waitFor",
        selector: ".nw-subtitle",
        label: "in-game subtitle appears in the tutorial",
        timeoutMs: 20_000,
        pendingIfMissing: "Director subtitles not mounted in main.ts",
      },
      {
        do: "assertBgAlpha",
        selector: ".nw-subtitle",
        alpha: 0.9,
        label: "in-game subtitle background honors 90% opacity",
      },
      { do: "wait", ms: 8000 },
      { do: "assertFrame", label: "tutorial renders" },
    ],
    maxSeconds: 60,
  },
  {
    id: "boot-cinematic",
    topic: "cinematics",
    title: "Cold boot: gate, notice, both studio logos, title",
    query: "?qa=1",
    steps: [
      {
        do: "waitFor",
        selector: ".nw-screen-gate",
        label: "gate shows",
        timeoutMs: 15_000,
      },
      { do: "advanceTo", screen: "notice", max: 3 },
      { do: "press", key: "Enter" },
      {
        do: "waitFor",
        selector: ".nw-screen-logos",
        label: "logo sequence starts",
      },
      { do: "assertFrame", label: "logo frame renders" },
      {
        do: "waitFor",
        selector: ".nw-screen-title",
        label: "logos hand off to title unskipped",
        timeoutMs: 40_000,
      },
      { do: "wait", ms: 2500 },
    ],
    maxSeconds: 55,
  },
  {
    id: "tutorial",
    topic: "cinematics",
    title:
      "Tutorial at 8x: the autopilot clears every module, the wink, the end",
    query: `?skipto=tutorial&autoplay=fight&speed=8${GAME}`,
    steps: [
      { do: "wait", ms: 3000 },
      { do: "assertFrame", label: "tutorial renders" },
      {
        do: "until",
        probe: "p.log.includes('line:tut_move_001')",
        label: "autopilot clears the movement module",
        timeoutMs: 15_000,
      },
      {
        do: "until",
        probe: "p.flags()['tut.targetDestroyed'] === true",
        label: "autopilot destroys the practice target",
        timeoutMs: 20_000,
      },
      {
        do: "until",
        probe: "p.log.includes('line:tut_wink_001')",
        label: "reaches the wink line",
        timeoutMs: 20_000,
      },
      {
        do: "until",
        probe: "p.flags()['tut.complete'] === true && p.sim().sector === 1",
        label: "tutorial ends and hands off to sector 1",
        timeoutMs: 25_000,
      },
    ],
    maxSeconds: 60,
  },
  {
    id: "gameplay-fight",
    topic: "gameplay",
    title: "Fight autopilot through sectors 1–3 at 4x, with chatter",
    query: `?skipto=sector1&autoplay=fight&speed=4${GAME}`,
    steps: [
      { do: "wait", ms: 4000 },
      { do: "assertFrame", label: "sector 1 renders" },
      {
        do: "until",
        probe: "p.sim().kills > 0",
        label: "the autopilot kills something",
        timeoutMs: 10_000,
      },
      {
        do: "until",
        probe:
          "p.events.some((e) => e.type === 'sectorCleared' && e.sector === 1)",
        label: "clears sector 1",
        timeoutMs: 25_000,
      },
      {
        do: "until",
        probe: "p.sim().sector >= 2",
        label: "reaches sector 2",
        timeoutMs: 10_000,
      },
      {
        do: "until",
        probe: "p.log.some((e) => e.startsWith('line:amb_fight_'))",
        label: "ambient fight chatter plays between scenes",
        timeoutMs: 25_000,
      },
      {
        do: "until",
        probe: "p.sim().sector >= 3",
        label: "reaches sector 3",
        timeoutMs: 25_000,
      },
      { do: "assertFrame", label: "sector 3 renders" },
    ],
    maxSeconds: 60,
  },
  {
    id: "flashback",
    topic: "cinematics",
    title:
      "First powerup flashback: frozen world, #0121's recorder, serial #0122",
    query: `?skipto=flashback${GAME}`,
    steps: [
      {
        do: "until",
        probe: "p.timeline() === 'flashback'",
        label: "flashback timeline is playing",
        timeoutMs: 10_000,
      },
      {
        do: "until",
        probe: "p.sim().frozen && p.flags()['flashback.recording'] === true",
        label: "the world freezes for the recorder playback",
        timeoutMs: 15_000,
      },
      { do: "assertFrame", label: "flashback renders" },
      {
        do: "until",
        probe:
          "(() => { const t = p.sim().tick; return new Promise((r) => setTimeout(() => r(p.sim().tick === t), 1000)); })()",
        label: "sim ticks hold still while frozen",
        timeoutMs: 5_000,
      },
      {
        do: "until",
        probe: "p.log.includes('line:flash_ai_002')",
        label: "recorder ends, the assistant returns",
        timeoutMs: 40_000,
      },
      {
        do: "until",
        probe: "!p.sim().frozen && p.timeline() !== 'flashback'",
        label: "sim resumes and the flashback hands back to gameplay",
        timeoutMs: 20_000,
      },
    ],
    maxSeconds: 60,
  },
  {
    id: "boss",
    topic: "cinematics",
    title: "Warden descent speech, phase 1, phase 2; fight autopilot at 4x",
    query: `?skipto=boss&autoplay=fight&speed=4${GAME}`,
    steps: [
      { do: "wait", ms: 2000 },
      { do: "assertFrame", label: "boss arena renders" },
      {
        do: "until",
        probe: "p.timeline() === 'boss'",
        label: "Warden descent plays",
        timeoutMs: 10_000,
      },
      {
        do: "until",
        probe: "p.log.includes('line:desc_001')",
        label: "the Warden's descent speech starts",
        timeoutMs: 15_000,
      },
      {
        do: "until",
        probe:
          "p.log.includes('line:desc_ai_002') && p.flags()['boss.parley'] === false",
        label: "the descent speech finishes and the Warden fights",
        timeoutMs: 20_000,
      },
      {
        do: "until",
        probe: "p.events.some((e) => e.type === 'bossPhase' && e.phase === 2)",
        label: "the autopilot pushes the Warden into phase 2",
        timeoutMs: 30_000,
      },
      { do: "assertFrame", label: "phase 2 renders" },
    ],
    maxSeconds: 60,
  },
  {
    id: "ending-kill",
    topic: "endings",
    title: "Kill ending: tollgates, replacement already in onboarding",
    query: `?skipto=ending-kill${GAME}`,
    steps: [
      {
        do: "until",
        probe: "p.timeline() === 'ending-kill'",
        label: "kill ending timeline plays",
        timeoutMs: 10_000,
      },
      { do: "assertFrame", label: "ending renders" },
      {
        do: "until",
        probe: "p.flags()['ending.tollgates'] === true",
        label: "tollgates unfold",
        timeoutMs: 30_000,
      },
      {
        do: "until",
        probe: "p.log.includes('line:kill_ai_004')",
        label: "the replacement line plays",
        timeoutMs: 30_000,
      },
      { do: "wait", ms: 3000 },
    ],
    maxSeconds: 60,
  },
  {
    id: "ending-pacifist",
    topic: "endings",
    title: "Pacifist autopilot, no fire, 32x from sector 5 to Lanes Kept",
    query: `?skipto=sector5&autoplay=pacifist&speed=32${GAME}`,
    steps: [
      { do: "wait", ms: 3000 },
      { do: "assertFrame", label: "sector 5 renders" },
      {
        do: "until",
        probe: "p.timeline() === 'ending-pacifist'",
        label: "reaches the pacifist ending",
        timeoutMs: 45_000,
      },
      {
        do: "until",
        probe: "p.flags()['banner.lanesKept'] === true",
        label: "Lanes Kept",
        timeoutMs: 10_000,
      },
      {
        do: "until",
        probe:
          "p.sim().kills === 0 && p.sim().shotsFired === 0 && p.sim().outcome === 'pacifist'",
        label: "zero kills, zero shots, pacifist outcome",
        timeoutMs: 2_000,
      },
      { do: "wait", ms: 4000 },
    ],
    maxSeconds: 60,
  },
];
