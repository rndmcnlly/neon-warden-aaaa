/**
 * Fake ports for Director tests (used by `tests/director_*_test.ts`): a manual clock and recorders that log
 * every call as a short string, so a test can assert the exact sequence.
 */

import type { Lang, LineId, Speaker } from "../contracts/index.ts";
import { Director } from "./director.ts";
import type { DirectorSettings, VoiceHandle, VoiceLayer } from "./ports.ts";

export class FakeClock {
  t = 0;
  now(): number {
    return this.t;
  }
}

export interface Rig {
  readonly director: Director;
  readonly clock: FakeClock;
  readonly log: string[];
  /** Story flag changes reported through the `onFlag` port. */
  readonly flagLog: string[];
  settings: DirectorSettings;
  /** Advances the clock in 16 ms frames, calling `update()` each frame. */
  advance(ms: number): void;
}

/** Durations by line id (ms); lines not listed have no audio. */
export function makeRig(durations: Record<string, number> = {}): Rig {
  const clock = new FakeClock();
  const log: string[] = [];
  const flagLog: string[] = [];
  const rig: Rig = {
    clock,
    log,
    flagLog,
    settings: { textLang: "en", voiceLang: "en", subtitles: { maxLines: 2 } },
    director: undefined as unknown as Director,
    advance(ms) {
      const end = clock.t + ms;
      while (clock.t < end) {
        clock.t = Math.min(end, clock.t + 16);
        rig.director.update();
      }
    },
  };
  const handle = (line: LineId, layer: VoiceLayer): VoiceHandle => ({
    setGain: (g) => log.push(`gain ${layer} ${line} ${g}`),
    stop: () => log.push(`stop ${layer} ${line}`),
  });
  (rig as { director: Director }).director = new Director({
    clock,
    voice: {
      play(line: LineId, lang: Lang, layer: VoiceLayer) {
        log.push(`say ${layer} ${line} ${lang} @${clock.t}`);
        return line in durations ? handle(line, layer) : null;
      },
      durationMs: (line) => durations[line],
      speaker: (): Speaker => "tutorial_ai",
    },
    music: { play: (cue, fade) => log.push(`music ${cue} ${fade}`) },
    sfx: { play: (role) => log.push(`sfx ${role}`) },
    camera: { shot: (shot, ms) => log.push(`camera ${shot} ${ms}`) },
    sim: {
      freeze: () => log.push("freeze"),
      resume: () => log.push("resume"),
    },
    onFlag: (name, value) => flagLog.push(`${name} ${value}`),
    text: (line, lang) => `${lang}:${line}`,
    settings: () => rig.settings,
    random: () => 0.5,
  });
  return rig;
}
