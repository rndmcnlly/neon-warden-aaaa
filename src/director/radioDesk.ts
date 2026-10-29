/**
 * The radio desk: radio lines (scout chatter, Lane Control traffic, the
 * derelict recorder) shown in the HUD's radio box, apart from subtitles, and
 * voiced where the line has audio, panned toward whoever is talking.
 *
 * One line at a time. Like the Director, the desk never shows a voiced
 * line's text before its audio can start: a line still downloading waits
 * (briefly; radio is a reaction, so a line late by more than
 * `loadTimeoutMs` goes out as text only).
 *
 * Ports only, no Web Audio or DOM, so it runs under `deno test`.
 */

import type { Lang, LineId, RadioChannel } from "../contracts/index.ts";
import { lineId } from "../contracts/index.ts";
import type { Clock, TextLookup, VoiceStatus } from "./ports.ts";
import { estimateDurationMs } from "./subtitles.ts";

export interface RadioShow {
  /** Callsign, already localized. */
  readonly source: string;
  readonly text: string;
  readonly pan: number;
  readonly durationMs: number;
  readonly lang: Lang;
}

export interface RadioDeskPorts {
  readonly clock: Clock;
  readonly text: TextLookup;
  readonly langs: () => { readonly textLang: Lang; readonly voiceLang: Lang };
  readonly status: (line: LineId, lang: Lang) => VoiceStatus;
  /** Plays the voice; false if it could not start. */
  readonly play: (line: LineId, lang: Lang, pan: number) => boolean;
  readonly durationMs: (line: LineId, lang: Lang) => number | undefined;
  readonly show: (line: RadioShow) => void;
}

export const RADIO_TUNING = {
  loadTimeoutMs: 1500,
  /** Quiet between radio lines, so chatter never stacks. */
  gapMs: 2500,
};

interface Pending {
  readonly line: LineId;
  readonly channel: RadioChannel;
  readonly pan: number;
  readonly since: number;
}

export class RadioDesk {
  private pending: Pending | null = null;
  private busyUntil = -Infinity;

  constructor(private readonly ports: RadioDeskPorts) {}

  /** True when the channel is clear for an event-driven line. */
  get free(): boolean {
    return this.pending === null &&
      this.ports.clock.now() >= this.busyUntil + RADIO_TUNING.gapMs;
  }

  /**
   * Puts `line` on the air. Voiced lines are `rad_*` VO ids; `radio.*` ids
   * are text only. `pan` is the speaker's side, -1 to 1.
   */
  say(line: LineId, channel: RadioChannel, pan = 0): void {
    const now = this.ports.clock.now();
    if (voiced(line)) {
      const status = this.ports.status(line, this.ports.langs().voiceLang);
      if (status === "loading") {
        this.pending = { line, channel, pan, since: now };
        return;
      }
      this.start(line, channel, pan, status === "ready", now);
    } else {
      this.start(line, channel, pan, false, now);
    }
  }

  /** Call every frame. */
  update(): void {
    const p = this.pending;
    if (!p) return;
    const now = this.ports.clock.now();
    const status = this.ports.status(p.line, this.ports.langs().voiceLang);
    if (status === "loading" && now - p.since < RADIO_TUNING.loadTimeoutMs) {
      return;
    }
    this.pending = null;
    this.start(p.line, p.channel, p.pan, status === "ready", now);
  }

  /** Drops anything waiting (a new run, quit to title). */
  reset(): void {
    this.pending = null;
    this.busyUntil = -Infinity;
  }

  private start(
    line: LineId,
    channel: RadioChannel,
    pan: number,
    withAudio: boolean,
    now: number,
  ): void {
    const { textLang, voiceLang } = this.ports.langs();
    const text = this.ports.text(line, textLang);
    if (text === undefined) return;
    if (withAudio) this.ports.play(line, voiceLang, pan);
    const durationMs =
      (withAudio ? this.ports.durationMs(line, voiceLang) : undefined) ??
        estimateDurationMs(text, textLang);
    const callsign = lineId(`radio.callsign.${channel}`);
    this.ports.show({
      source: this.ports.text(callsign, textLang) ?? channel,
      text,
      pan,
      durationMs,
      lang: textLang,
    });
    this.busyUntil = now + durationMs;
  }
}

/** Radio VO lines are `rad_*`; text-only lines are `radio.*`. */
export function voiced(line: LineId): boolean {
  return !line.startsWith("radio.");
}
