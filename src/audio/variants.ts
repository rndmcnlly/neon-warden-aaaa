/**
 * Runtime variants for in-context A/B: a choice between takes (a voice, a
 * music candidate) that can be switched by URL or the dev panel, without a
 * rebuild, so the team decides by hearing each option *in the scene, with
 * music*, not by auditioning files in isolation.
 *
 *   ?v.voice.tutorial_ai=original      the tutorial AI's first voice
 *   ?v.voice.tutorial_ai=a_captain     the recast (the base VO files)
 *   ?v.music.gameplay=cand1            a music candidate
 *
 * An axis is `<kind>.<name>`. Its choices come from data, never from code:
 *
 * - `voice.<speaker>`: `public/vo/variants/index.json` (written by
 *   `scripts/extract_voice_variant.ts`) lists frozen takes per variant; the
 *   `base` choice means the ordinary files in `public/vo/cues.json`.
 * - `music.<cue>`: the `variants` of a cue in `public/music/manifest.json`
 *   (written by `music/promote.py`); the cue's `variant` is the default.
 *
 * Precedence: a valid URL choice, else the axis default. An unknown axis or
 * choice in the URL is ignored and noted in `warnings` (a typo should not
 * silently change what QA records). The registry is pure (no DOM, no Web
 * Audio), so the rules are unit-tested; the engine and the dev panel
 * subscribe to it.
 */

import type { LineId, WordTiming } from "../contracts/index.ts";

export type VariantKind = "voice" | "music";

export interface VariantAxis {
  /** `<kind>.<name>`, e.g. `voice.tutorial_ai`. */
  readonly id: string;
  readonly kind: VariantKind;
  readonly choices: readonly string[];
  readonly defaultChoice: string;
  /** Shown in the dev panel, e.g. "provisional pick by stats". */
  readonly note?: string;
}

export class VariantRegistry {
  private readonly axesById = new Map<string, VariantAxis>();
  private readonly chosen = new Map<string, string>();
  private readonly listeners = new Set<(axis: string) => void>();
  readonly warnings: string[] = [];

  /** `requested` is `UrlFlags.variants`: axis id to choice, unvalidated. */
  constructor(private readonly requested: Readonly<Record<string, string>>) {}

  /** Registers an axis; a URL choice for it applies now if it is valid. */
  define(axis: VariantAxis): void {
    if (!axis.choices.includes(axis.defaultChoice)) {
      throw new Error(`${axis.id}: default ${axis.defaultChoice} not a choice`);
    }
    this.axesById.set(axis.id, axis);
    const want = this.requested[axis.id];
    if (want === undefined) return;
    if (axis.choices.includes(want)) this.chosen.set(axis.id, want);
    else {
      this.warnings.push(
        `${axis.id}: no choice "${want}" (${axis.choices.join(", ")})`,
      );
    }
  }

  /** Requested axes that nothing defined (call after all `define`s). */
  unknownAxes(): string[] {
    return Object.keys(this.requested).filter((id) => !this.axesById.has(id));
  }

  axes(): VariantAxis[] {
    return [...this.axesById.values()];
  }

  /** The current choice, or undefined for an axis nobody defined. */
  get(id: string): string | undefined {
    const axis = this.axesById.get(id);
    return axis && (this.chosen.get(id) ?? axis.defaultChoice);
  }

  set(id: string, choice: string): void {
    const axis = this.axesById.get(id);
    if (!axis || !axis.choices.includes(choice)) return;
    if (this.get(id) === choice) return;
    this.chosen.set(id, choice);
    for (const l of this.listeners) l(id);
  }

  subscribe(listener: (axis: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Every axis and its current choice, for QA logs and the dev panel. */
  describe(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const id of this.axesById.keys()) out[id] = this.get(id)!;
    return out;
  }

  /** `v.<axis>=<choice>` for choices that differ from the default. */
  toQuery(): string[] {
    return this.axes()
      .filter((a) => this.get(a.id) !== a.defaultChoice)
      .map((a) => `v.${a.id}=${this.get(a.id)}`);
  }
}

// ------------------------------------------------------- voice variants

/** One frozen take, in the same shape as a `cues.json` language entry. */
export interface VoiceVariantTake {
  readonly file: string;
  readonly duration: number;
  /** The text this take actually speaks (it may lag the script). */
  readonly text?: string;
  readonly words?: readonly WordTiming[];
  /** Measured leading silence, seconds (`scripts/sync_vo.ts`). */
  readonly onsetS?: number;
}

/** `public/vo/variants/index.json`. */
export interface VoiceVariantsFile {
  readonly version: 1;
  readonly speakers: Readonly<
    Record<string, {
      /** Name of the ordinary `cues.json` takes as a choice (default "base"). */
      readonly base?: string;
      /** The choice used when the URL names none (default: `base`). */
      readonly default?: string;
      readonly variants: Readonly<
        Record<string, {
          readonly from?: string;
          readonly lines: Readonly<
            Record<string, Readonly<Record<string, VoiceVariantTake>>>
          >;
        }>
      >;
    }>
  >;
}

/** Registers one `voice.<speaker>` axis per speaker in the file. */
export function defineVoiceAxes(
  registry: VariantRegistry,
  file: VoiceVariantsFile | null,
): void {
  for (const [speaker, s] of Object.entries(file?.speakers ?? {})) {
    const base = s.base ?? "base";
    const choices = [...Object.keys(s.variants), base];
    registry.define({
      id: `voice.${speaker}`,
      kind: "voice",
      choices,
      defaultChoice: s.default ?? base,
    });
  }
}

/**
 * The take the chosen voice variant has for a line, if any. Undefined means
 * "use the base files": the base choice, or a line the variant never
 * recorded (a line written after the variant was frozen).
 */
export function voiceVariantTake(
  registry: VariantRegistry,
  file: VoiceVariantsFile | null,
  speaker: string | undefined,
  line: LineId,
  lang: string,
): VoiceVariantTake | undefined {
  if (!speaker || !file) return undefined;
  const choice = registry.get(`voice.${speaker}`);
  const variant = choice && file.speakers[speaker]?.variants[choice];
  return variant ? variant.lines[line]?.[lang] : undefined;
}
