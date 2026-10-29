/**
 * The end credits as data: departments, roles, and who filled them. A tiny
 * team wearing a AAA department structure, credited honestly: one human
 * (direction, review, every final choice) and AI agents by workstream.
 *
 * Department and role names are UI string ids. People, tools and models
 * are proper nouns and stay untranslated, like `src/data/thirdParty.ts`.
 * Agent credits go through `ui.crawl.agent` so each language can mark them.
 */

import type { UiKey } from "../i18n/index.ts";
import { THIRD_PARTY } from "../data/thirdParty.ts";

export type CreditName =
  /** A person, studio, tool or model: shown as is. */
  | { readonly name: string }
  /** An AI agent credited by model: "{model}, agent". */
  | { readonly agent: string }
  /** Translated text. */
  | { readonly text: UiKey };

export interface CreditRole {
  /** Omitted for a department's plain list (licenses, memoriam). */
  readonly role?: UiKey;
  readonly names: readonly CreditName[];
}

export interface CreditSection {
  readonly heading: UiKey;
  readonly roles: readonly CreditRole[];
}

/**
 * The model behind the workstream agents (orchestration, the seven
 * workstreams, QA, research). Correct it here if a workstream ran elsewhere.
 */
export const AGENT_MODEL = "Claude Opus 5.5 (Anthropic)";

const ADAM: CreditName = { name: "Adam Smith" };
const AGENT: CreditName = { agent: AGENT_MODEL };
const one = (role: UiKey, ...names: CreditName[]): CreditRole => ({
  role,
  names,
});

export const STUDIO = "adamsmith.systems";

export const CREDITS: readonly CreditSection[] = [
  {
    heading: "ui.crawl.dept.leadership",
    roles: [
      one("ui.crawl.role.execProducer", ADAM),
      one("ui.crawl.role.creativeDirector", ADAM),
      one("ui.crawl.role.gameDirector", ADAM),
    ],
  },
  {
    heading: "ui.crawl.dept.design",
    roles: [
      one("ui.crawl.role.originalDesign", ADAM),
      one("ui.crawl.role.systemsDesign", AGENT),
    ],
  },
  {
    heading: "ui.crawl.dept.narrative",
    roles: [
      one("ui.crawl.role.storyDirection", ADAM),
      one("ui.crawl.role.narrativeDesign", AGENT),
      one("ui.crawl.role.research", AGENT),
    ],
  },
  {
    heading: "ui.crawl.dept.engineering",
    roles: [
      one("ui.crawl.role.simEngineering", AGENT),
      one("ui.crawl.role.renderEngineering", AGENT),
      one("ui.crawl.role.uiEngineering", AGENT),
      one("ui.crawl.role.audioEngineering", AGENT),
      one("ui.crawl.role.integration", AGENT),
    ],
  },
  {
    heading: "ui.crawl.dept.art",
    roles: [
      one("ui.crawl.role.artDirection", ADAM),
      one("ui.crawl.role.modeling", AGENT, { name: "Blender" }),
    ],
  },
  {
    heading: "ui.crawl.dept.audio",
    roles: [
      one("ui.crawl.role.music", { name: "Stable Audio 3 (Stability AI)" }),
      one("ui.crawl.role.sfx", AGENT, {
        name: "Stable Audio 3 (Stability AI)",
      }),
      one("ui.crawl.role.curation", ADAM),
    ],
  },
  {
    heading: "ui.crawl.dept.voice",
    roles: [
      one("ui.speaker.tutorial_ai", { name: "Qwen3-TTS" }),
      one("ui.speaker.narrator", { name: "Qwen3-TTS" }),
      one("ui.speaker.warden", { name: "Qwen3-TTS" }),
      one("ui.speaker.pilot", { name: "Qwen3-TTS" }),
      one("ui.crawl.role.voiceRendering", AGENT, {
        name: "Qwen3-TTS, Qwen3-ASR (Alibaba Qwen)",
      }),
    ],
  },
  {
    heading: "ui.crawl.dept.localization",
    roles: [one("ui.crawl.role.languages", AGENT)],
  },
  {
    heading: "ui.crawl.dept.qa",
    roles: [
      one("ui.crawl.role.qaTooling", AGENT, {
        name: "Playwright, FFmpeg",
      }),
      one("ui.crawl.role.playtest", AGENT, ADAM),
    ],
  },
  {
    heading: "ui.crawl.dept.accessibility",
    roles: [one("ui.crawl.role.accessibility", AGENT, ADAM)],
  },
  {
    heading: "ui.crawl.dept.production",
    roles: [one("ui.crawl.role.orchestration", AGENT, ADAM)],
  },
  {
    heading: "ui.crawl.dept.publishing",
    roles: [
      one("ui.crawl.role.incubator", { text: "ui.crawl.incubated" }),
    ],
  },
  {
    heading: "ui.crawl.dept.tools",
    roles: [
      one(
        "ui.crawl.role.software",
        ...[
          "three.js",
          "Vite",
          "Deno",
          "TypeScript",
          "Blender",
          "Playwright",
          "FFmpeg",
          "uv",
          "OpenChamber",
        ].map((name) => ({ name })),
      ),
      one(
        "ui.crawl.role.models",
        { name: AGENT_MODEL },
        { name: "Qwen3-TTS (Alibaba Qwen)" },
        { name: "Qwen3-ASR (Alibaba Qwen)" },
        { name: "Stable Audio 3 (Stability AI)" },
      ),
    ],
  },
  {
    heading: "ui.crawl.dept.licenses",
    roles: [{
      names: THIRD_PARTY.map((entry) => ({
        name: `${entry.name}: ${entry.license}`,
      })),
    }],
  },
  {
    heading: "ui.crawl.dept.thanks",
    roles: [
      one("ui.crawl.role.students", { text: "ui.credits.original" }),
      one("ui.crawl.role.catering", { text: "ui.stub.badge" }),
    ],
  },
  {
    heading: "ui.crawl.dept.memoriam",
    roles: [{
      names: [
        { text: "ui.credits.stuntPilots" },
        { text: "ui.credits.stuntPilotKept" },
      ],
    }],
  },
];
