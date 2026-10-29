/**
 * The audio engine: one Web Audio graph, five buses, and the players for VO,
 * music and sound effects. It implements the Director's voice, music and sfx
 * ports: hand `engine` (voice), `engine.musicPort` and `engine.sfxPort` to
 * the Director.
 *
 *   music -> musicDuck --\
 *   sfx -----------------+--> master -> speakers
 *   voice ---------------|
 *   ui ------------------/
 *
 * Bus gains follow the settings store live. `musicDuck` is a separate node
 * so ducking never fights the player's music volume slider.
 *
 * The engine's clock is the audio clock (`AudioContext.currentTime`): give
 * it to the Director and subtitles stay in sync with speech, even when the
 * context is suspended for pause.
 */

import type {
  Lang,
  LineId,
  MusicCueId,
  Settings,
  SettingsStore,
  SfxRoleId,
  Speaker,
} from "../contracts/index.ts";
import type {
  Clock,
  MusicPort,
  SfxPort,
  VoiceHandle,
  VoiceLayer,
  VoicePort,
} from "../director/ports.ts";
import { Ducker } from "./ducker.ts";
import { type Stage, StagedLoader, type StageProgress } from "./loader.ts";
import {
  type MusicManifestFile,
  musicTracks,
  type SfxManifestFile,
  sfxUrls,
  VoCatalog,
  type VoCuesFile,
} from "./manifests.ts";
import { MusicPlayer } from "./music.ts";

export type Bus = "master" | "music" | "sfx" | "voice" | "ui";

/** Which music cues and VO scenes each loading stage brings in. */
export const STAGE_CONTENTS: Readonly<
  Record<Stage, { music: readonly MusicCueId[]; scene: (s: string) => boolean }>
> = {
  boot: { music: ["logos"], scene: () => false },
  menu: { music: ["menu", "tutorial"], scene: (s) => s === "tutorial" },
  gameplay: {
    music: ["gameplay", "flashback", "boss"],
    scene: (s) => s !== "tutorial" && !s.startsWith("ending"),
  },
  ending: {
    music: ["ending", "endingKill", "endingPacifist"],
    scene: (s) => s.startsWith("ending") || s === "credits",
  },
};

export interface AudioEngineOptions {
  readonly store: SettingsStore;
  /** Public root of the asset folders, e.g. `import.meta.env.BASE_URL`. */
  readonly base?: string;
  readonly ctx?: AudioContext;
}

export class AudioEngine implements VoicePort {
  readonly clock: Clock;
  readonly musicPort: MusicPort = {
    play: (cue, fadeMs) => this.playMusic(cue, fadeMs),
  };
  readonly sfxPort: SfxPort = { play: (role) => this.playSfx(role) };
  private readonly buses: Record<Bus, GainNode>;
  private readonly ducker: Ducker;
  private readonly loader: StagedLoader<AudioBuffer>;
  private readonly music: MusicPlayer;

  private constructor(
    readonly ctx: AudioContext,
    private readonly store: SettingsStore,
    private readonly base: string,
    private readonly vo: VoCatalog,
    private readonly sfx: ReadonlyMap<string, string>,
    musicFile: MusicManifestFile | null,
  ) {
    this.clock = { now: () => ctx.currentTime * 1000 };
    const bus = () => ctx.createGain();
    this.buses = {
      master: bus(),
      music: bus(),
      sfx: bus(),
      voice: bus(),
      ui: bus(),
    };
    const musicDuck = bus();
    this.buses.master.connect(ctx.destination);
    this.buses.music.connect(musicDuck).connect(this.buses.master);
    for (const b of ["sfx", "voice", "ui"] as const) {
      this.buses[b].connect(this.buses.master);
    }
    this.ducker = new Ducker(musicDuck.gain, () => ctx.currentTime);

    this.loader = new StagedLoader((url) => this.decode(url));
    const tracks = musicTracks(musicFile);
    this.music = new MusicPlayer(
      ctx,
      this.buses.music,
      tracks,
      (url) => this.loader.request(this.url(url)),
      (url) => this.loader.get(this.url(url)),
    );
    for (const src of sfx.values()) this.loader.add("boot", this.url(src));
    for (const [stage, contents] of Object.entries(STAGE_CONTENTS)) {
      for (const cue of contents.music) {
        const track = tracks.get(cue);
        if (track) this.loader.add(stage as Stage, this.url(track.src));
      }
    }

    this.applyVolumes(store.get(), 0);
    store.subscribe((s) => this.applyVolumes(s, 0.03));
  }

  /**
   * Builds the engine and its graph. Missing manifests are fine: the game
   * runs silent (and subtitled) until assets exist.
   */
  static async create(options: AudioEngineOptions): Promise<AudioEngine> {
    const base = options.base ?? "./";
    const [vo, sfx, music] = await Promise.all([
      fetchJson<VoCuesFile>(base + "vo/cues.json"),
      fetchJson<SfxManifestFile>(base + "sfx/manifest.json"),
      fetchJson<MusicManifestFile>(base + "music/manifest.json"),
    ]);
    return new AudioEngine(
      options.ctx ?? new AudioContext(),
      options.store,
      base,
      new VoCatalog(vo ?? { lines: {} }),
      sfxUrls(sfx),
      music,
    );
  }

  /** Browsers start audio suspended; call from the first click or key. */
  resume(): Promise<void> {
    return this.ctx.resume();
  }

  /** Loads a stage in the background, VO in the current voice language. */
  loadStage(stage: Stage): Promise<StageProgress> {
    const lang = this.store.get().voiceLang;
    for (const line of this.vo.linesWhere(STAGE_CONTENTS[stage].scene)) {
      const v = this.vo.resolve(line, lang);
      if (v) this.loader.add(stage, this.url(v.url));
    }
    return this.loader.loadStage(stage);
  }

  onProgress(listener: (p: StageProgress) => void): () => void {
    return this.loader.onProgress(listener);
  }

  // ------------------------------------------------------------ VoicePort

  durationMs(line: LineId, lang: Lang): number | undefined {
    return this.vo.resolve(line, lang)?.durationMs;
  }

  speaker(line: LineId): Speaker | undefined {
    return this.vo.speaker(line);
  }

  play(line: LineId, lang: Lang, _layer: VoiceLayer): VoiceHandle | null {
    const v = this.vo.resolve(line, lang);
    if (!v) return null;
    const buffer = this.loader.get(this.url(v.url));
    if (!buffer) {
      this.loader.request(this.url(v.url)); // ready for next time
      return null;
    }
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain).connect(this.buses.voice);
    this.ducker.voiceStarted();
    let ended = false;
    source.onended = () => {
      if (!ended) this.ducker.voiceEnded();
      ended = true;
    };
    source.start();
    return {
      setGain(target, rampMs) {
        gain.gain.setTargetAtTime(target, ctx.currentTime, rampMs / 3000);
      },
      stop(fadeMs = 0) {
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0, t, fadeMs / 3000);
        source.stop(t + fadeMs / 1000);
      },
    };
  }

  // ------------------------------------------------------- Music and sfx

  /** Crossfades to `cue` (`silence` fades out). */
  playMusic(cue: MusicCueId, fadeMs: number): void {
    this.music.play(cue, fadeMs);
  }

  /** Timeline `sfx` cues: plays on the sfx bus. */
  playSfx(role: SfxRoleId): void {
    this.oneShot(role, "sfx");
  }

  /** Menu sounds: plays on the ui bus. Silent if the role has no pick. */
  playUi(role: string): void {
    this.oneShot(role, "ui");
  }

  private oneShot(role: string, bus: "sfx" | "ui"): void {
    const src = this.sfx.get(role);
    const buffer = src && this.loader.get(this.url(src));
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.buses[bus]);
    source.start();
  }

  // -------------------------------------------------------------- helpers

  private applyVolumes(s: Settings, timeConstant: number): void {
    const t = this.ctx.currentTime;
    for (const bus of Object.keys(this.buses) as Bus[]) {
      const gain = this.buses[bus].gain;
      if (timeConstant === 0) gain.value = s.audio[bus];
      else gain.setTargetAtTime(s.audio[bus], t, timeConstant);
    }
  }

  private url(path: string): string {
    return path.startsWith(this.base) ? path : this.base + path;
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url, { priority: "low" } as RequestInit);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await this.ctx.decodeAudioData(await res.arrayBuffer());
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? (await res.json()) as T : null;
  } catch {
    return null;
  }
}
