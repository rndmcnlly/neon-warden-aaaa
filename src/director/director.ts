/**
 * The Director plays `Timeline`s: lists of `Cue`s (see
 * `src/contracts/timeline.ts`). It is a small interpreter with a program
 * counter, not a set of async functions, so a test can drive it frame by
 * frame with a fake clock and check exactly what happened when.
 *
 * Call `update()` once per rendered frame. Each call runs cues until one
 * blocks (a `wait`), then returns. `branch` pushes its chosen cue list as a
 * new frame on a stack, so nesting works without recursion.
 *
 * Between scenes, the Director also plays ambient chatter (see `ambient.ts`).
 * Chatter yields to scripted moments: it never starts while a timeline runs,
 * and a bark already playing when a scripted line starts is ducked, not cut.
 */

import type {
  CameraShotId,
  Cue,
  LineId,
  MusicCueId,
  Timeline,
} from "../contracts/index.ts";
import { AmbientScheduler, type ChatterBank } from "./ambient.ts";
import type {
  CameraPort,
  Clock,
  DirectorSettings,
  MusicPort,
  SfxPort,
  SimPort,
  TextLookup,
  VoiceHandle,
  VoiceLayer,
  VoicePort,
} from "./ports.ts";
import { estimateDurationMs, SubtitleModel } from "./subtitles.ts";

/** Mix and pacing constants, in one place for tuning. */
export const DIRECTOR_TUNING = {
  /** Gain of an ambient bark while a scripted line talks over it. */
  barkDuckGain: 0.3,
  duckRampMs: 250,
  /** Silence after a scripted line or scene before chatter may resume. */
  quietAfterScriptMs: 1500,
  defaultMusicFadeMs: 1500,
  /** Fade when a line is cut short by a skip or by the next line. */
  cutFadeMs: 120,
};

export interface DirectorPorts {
  readonly clock: Clock;
  readonly voice: VoicePort;
  readonly music: MusicPort;
  readonly sfx: SfxPort;
  readonly camera: CameraPort;
  readonly sim: SimPort;
  readonly text: TextLookup;
  readonly settings: () => DirectorSettings;
  /** Mirrored sim flags, read when the Director has no flag of that name. */
  readonly simFlag?: (name: string) => boolean | undefined;
  /**
   * Called whenever a story flag changes (cue, skip or `setFlag`), so the
   * sim and UI can honor flags such as `boss.parley` the moment they flip.
   */
  readonly onFlag?: (name: string, value: boolean) => void;
  /** For chatter shuffling; inject a seeded one in tests. */
  readonly random?: () => number;
}

interface Frame {
  readonly cues: readonly Cue[];
  index: number;
}

/** A `waitFlag` cue in progress. */
interface FlagWait {
  readonly flag: string;
  readonly value: boolean;
  readonly since: number;
  nudge: { readonly line: LineId; readonly at: number } | null;
}

interface ActiveLine {
  readonly line: LineId;
  readonly handle: VoiceHandle | null;
  readonly endsAt: number;
}

export class Director {
  readonly subtitles = new SubtitleModel();

  private readonly flags = new Map<string, boolean>();
  private readonly ambient: AmbientScheduler;
  private stack: Frame[] = [];
  /** While set, the program counter waits for the clock to reach it. */
  private blockedUntil: number | null = null;
  /** While set, the program counter waits for a flag instead of the clock. */
  private flagWait: FlagWait | null = null;
  /**
   * The time the last wait ended, exactly. Waits count from here rather
   * than from the frame that noticed, so a scene does not drift late by up
   * to a frame per wait.
   */
  private cursor = 0;
  private lines: Record<VoiceLayer, ActiveLine | null> = {
    scripted: null,
    ambient: null,
  };
  private finish: (() => void) | null = null;
  private current: Timeline | null = null;
  private chatterHeld = false;

  constructor(private readonly ports: DirectorPorts) {
    this.ambient = new AmbientScheduler(ports.random);
  }

  /** The timeline now playing, if any. */
  get timeline(): Timeline | null {
    return this.current;
  }

  /**
   * Starts `timeline`. Resolves when it ends or is skipped. Starting a
   * timeline while another runs skips the old one first (see `skipScene`).
   */
  play(timeline: Timeline): Promise<void> {
    if (this.current) this.skipScene();
    this.current = timeline;
    this.stack = [{ cues: timeline.cues, index: 0 }];
    this.blockedUntil = null;
    this.flagWait = null;
    this.cursor = this.ports.clock.now();
    const done = new Promise<void>((resolve) => (this.finish = resolve));
    this.update();
    return done;
  }

  /** Advances everything to the clock's current time. Call every frame. */
  update(): void {
    const now = this.ports.clock.now();
    this.expireLines(now);
    this.run(now);
    this.tickChatter(now);
    this.subtitles.update(now);
  }

  // ------------------------------------------------------------ the program

  private run(now: number): void {
    while (this.stack.length > 0) {
      if (this.blockedUntil !== null) {
        if (now < this.blockedUntil) return;
        this.cursor = this.blockedUntil;
        this.blockedUntil = null;
      }
      if (this.flagWait && !this.flagWaitOver(now)) return;
      const frame = this.stack[this.stack.length - 1];
      if (frame.index >= frame.cues.length) {
        this.stack.pop();
        continue;
      }
      this.exec(frame.cues[frame.index++], now);
    }
    if (this.current) this.endTimeline(now);
  }

  private exec(cue: Cue, now: number): void {
    const p = this.ports;
    switch (cue.type) {
      case "say":
        this.say(cue.line, "scripted", now);
        break;
      case "wait":
        if ("ms" in cue) {
          this.blockedUntil = this.cursor + cue.ms;
        } else {
          // "lineEnds": block until the latest scripted line's end time.
          const line = this.lines.scripted;
          if (line && line.endsAt > now) this.blockedUntil = line.endsAt;
        }
        break;
      case "music":
        p.music.play(
          cue.cue,
          cue.fadeMs ?? DIRECTOR_TUNING.defaultMusicFadeMs,
        );
        break;
      case "sfx":
        p.sfx.play(cue.role);
        break;
      case "camera":
        p.camera.shot(cue.shot, cue.durationMs, cue.ease ?? "inOut");
        break;
      case "setFlag":
        this.setFlag(cue.flag, cue.value);
        break;
      case "waitFlag":
        this.flagWait = {
          flag: cue.flag,
          value: cue.value,
          since: now,
          nudge: cue.nudge
            ? { line: cue.nudge.line, at: now + cue.nudge.afterMs }
            : null,
        };
        break;
      case "branch": {
        const chosen = this.getFlag(cue.flag) ? cue.then : cue.else ?? [];
        this.stack.push({ cues: chosen, index: 0 });
        break;
      }
      case "freezeSim":
        p.sim.freeze();
        break;
      case "resumeSim":
        p.sim.resume();
        break;
    }
  }

  /** True once the awaited flag holds; plays the nudge line once if late. */
  private flagWaitOver(now: number): boolean {
    const wait = this.flagWait!;
    if (this.getFlag(wait.flag) === wait.value) {
      this.flagWait = null;
      this.cursor = now;
      return true;
    }
    if (wait.nudge && now >= wait.nudge.at && !this.lines.scripted) {
      this.say(wait.nudge.line, "scripted", now);
      wait.nudge = null;
    }
    return false;
  }

  private endTimeline(now: number): void {
    this.current = null;
    this.ambient.postpone(now, DIRECTOR_TUNING.quietAfterScriptMs);
    const finish = this.finish;
    this.finish = null;
    finish?.();
  }

  // ---------------------------------------------------------------- lines

  private say(line: LineId, layer: VoiceLayer, now: number): void {
    const p = this.ports;
    const s = p.settings();
    this.stopLine(layer);
    const text = p.text(line, s.textLang) ?? line; // a visible id flags a gap
    const durationMs = p.voice.durationMs(line, s.voiceLang) ??
      estimateDurationMs(text, s.textLang);
    const handle = p.voice.play(line, s.voiceLang, layer);
    this.lines[layer] = { line, handle, endsAt: now + durationMs };
    if (layer === "scripted") {
      this.lines.ambient?.handle?.setGain(
        DIRECTOR_TUNING.barkDuckGain,
        DIRECTOR_TUNING.duckRampMs,
      );
    }
    this.subtitles.show(
      layer,
      line,
      p.voice.speaker(line),
      text,
      s.textLang,
      durationMs,
      s.subtitles.maxLines,
      now,
    );
  }

  private stopLine(layer: VoiceLayer): void {
    this.lines[layer]?.handle?.stop(DIRECTOR_TUNING.cutFadeMs);
    this.lines[layer] = null;
  }

  private expireLines(now: number): void {
    const scripted = this.lines.scripted;
    if (scripted && now >= scripted.endsAt) this.endScriptedLine(now);
    const bark = this.lines.ambient;
    if (bark && now >= bark.endsAt) this.lines.ambient = null;
  }

  private endScriptedLine(now: number): void {
    this.lines.scripted = null;
    this.lines.ambient?.handle?.setGain(1, DIRECTOR_TUNING.duckRampMs);
    this.ambient.postpone(now, DIRECTOR_TUNING.quietAfterScriptMs);
  }

  // ---------------------------------------------------------------- skips

  /**
   * Skips the current scripted line: stops its audio and caption, and
   * releases whatever wait the scene is in, so the next line starts now.
   */
  skipLine(): void {
    const now = this.ports.clock.now();
    if (this.lines.scripted) {
      this.stopLine("scripted");
      this.subtitles.clear("scripted", now);
      this.endScriptedLine(now);
    }
    if (this.blockedUntil !== null) {
      this.blockedUntil = null;
      this.cursor = now;
    }
    this.update();
  }

  /**
   * Skips the rest of the scene. Cues that change lasting state still take
   * effect, so the world ends up exactly as if the scene had played out:
   * flags are set (and branches followed), the last music cue plays, the
   * camera cuts to the last shot, and the sim ends frozen or running as the
   * scene would have left it. Lines, sound effects and waits are dropped.
   */
  skipScene(): void {
    if (!this.current) return;
    const now = this.ports.clock.now();
    this.stopLine("scripted");
    this.subtitles.clear("scripted", now);
    this.endScriptedLine(now);

    const last: {
      music?: { cue: MusicCueId; fadeMs: number };
      camera?: CameraShotId;
      frozen?: boolean;
    } = {};
    const walk = (cues: readonly Cue[]): void => {
      for (const cue of cues) {
        if (cue.type === "setFlag") this.setFlag(cue.flag, cue.value);
        else if (cue.type === "branch") {
          walk(this.getFlag(cue.flag) ? cue.then : cue.else ?? []);
        } else if (cue.type === "music") {
          last.music = {
            cue: cue.cue,
            fadeMs: cue.fadeMs ?? DIRECTOR_TUNING.defaultMusicFadeMs,
          };
        } else if (cue.type === "camera") last.camera = cue.shot;
        else if (cue.type === "freezeSim") last.frozen = true;
        else if (cue.type === "resumeSim") last.frozen = false;
      }
    };
    // Innermost frame first: its remainder runs before its parent's.
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      walk(frame.cues.slice(frame.index));
    }
    const p = this.ports;
    if (last.music) p.music.play(last.music.cue, last.music.fadeMs);
    if (last.camera) p.camera.shot(last.camera, 0, "linear");
    if (last.frozen === true) p.sim.freeze();
    if (last.frozen === false) p.sim.resume();

    this.stack = [];
    this.blockedUntil = null;
    this.flagWait = null;
    this.endTimeline(now);
    this.subtitles.update(now);
  }

  // ---------------------------------------------------------------- flags

  getFlag(name: string): boolean {
    return this.flags.get(name) ?? this.ports.simFlag?.(name) ?? false;
  }

  setFlag(name: string, value: boolean): void {
    if (this.flags.get(name) === value) return;
    this.flags.set(name, value);
    this.ports.onFlag?.(name, value);
  }

  // -------------------------------------------------------------- chatter

  /** Starts ambient chatter with these banks (replacing any before). */
  startChatter(banks: readonly ChatterBank[]): void {
    this.ambient.start(banks, this.ports.clock.now());
  }

  stopChatter(): void {
    this.ambient.stop();
    this.stopLine("ambient");
    this.subtitles.clear("ambient", this.ports.clock.now());
  }

  /**
   * Plays a one-off bark (a reaction to a sim event) on the ambient layer.
   * Scripted moments win: while a timeline or scripted line holds the floor,
   * the bark is dropped and this returns false. A bark outranks chatter, so
   * it cuts a chatter line, and chatter then waits until it has finished.
   */
  bark(line: LineId): boolean {
    const now = this.ports.clock.now();
    if (
      this.current !== null || this.lines.scripted !== null || this.chatterHeld
    ) return false;
    this.say(line, "ambient", now);
    const endsAt = this.lines.ambient?.endsAt ?? now;
    this.ambient.postpone(
      now,
      endsAt - now + DIRECTOR_TUNING.quietAfterScriptMs,
    );
    return true;
  }

  /** Holds chatter without a timeline (for example, while paused). */
  holdChatter(held: boolean): void {
    this.chatterHeld = held;
  }

  private tickChatter(now: number): void {
    const busy = this.current !== null || this.lines.scripted !== null ||
      this.chatterHeld;
    if (busy) {
      this.ambient.postpone(now, DIRECTOR_TUNING.quietAfterScriptMs);
      return;
    }
    if (this.lines.ambient) return;
    const bark = this.ambient.next(now);
    if (bark) this.say(bark, "ambient", now);
  }
}
