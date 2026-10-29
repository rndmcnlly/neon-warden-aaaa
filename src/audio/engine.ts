/**
 * The audio engine: one Web Audio graph, five buses, and the players for VO,
 * music and sound effects. It implements the Director's voice, music and sfx
 * ports: hand `engine` (voice), `engine.musicPort` and `engine.sfxPort` to
 * the Director.
 *
 *   music -> musicDuck -> eventDuck -> musicFilter -> trim --\
 *   sfx -> sfxDuck -> sfxFilter --------------------> trim ---+--> master
 *   voice (Warden lines via the arena PA) ----------> trim ---|   -> limiter
 *   ui ---------------------------------------------> trim --/    -> ceiling
 *                                                                 -> speakers
 *
 * Two kinds of gain, kept apart: the bus faders are the player's (settings
 * sliders); the trims are the mix's (`MIX_TRIM_DB`), set by measuring each
 * bus's loudness in QA reels (`qa/av.ts` records a stem per bus). The
 * master chain is a limiter (a compressor with its automatic makeup gain
 * cancelled) and a soft ceiling at -1.2 dBFS (see `masterChain`).
 *
 * Bus gains follow the settings store live. The duck and filter nodes are
 * separate so ducking never fights the player's volume sliders: story VO
 * ducks music and gameplay sfx (`Ducker`), big gameplay moments dip the
 * music (`GAMEPLAY_SOUNDS[role].duck`), and the flashback muffles sfx (the
 * past is muffled). The limiter is a safety net, not a mastering tool.
 *
 * Gameplay sound lives in `gameplay` (what plays, from sim events) and
 * `sfxPlayer` (how: two layers, grid, key, space, voice caps).
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
  VoiceStatus,
} from "../director/ports.ts";
import { createArenaPa } from "./arenaPa.ts";
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
import { type BeatGrid, DEFAULT_GRIDS, FALLBACK_GRID } from "./beatGrid.ts";
import { GameplayAudio } from "./gameplayAudio.ts";
import {
  type GameplaySoundId,
  isGameplaySound,
  type SoundRole,
} from "./gameplaySounds.ts";
import { SfxPlayer } from "./sfxPlayer.ts";
import type { Vec2, WordTiming } from "../contracts/index.ts";
import {
  defineVoiceAxes,
  VariantRegistry,
  type VoiceVariantsFile,
  voiceVariantTake,
} from "./variants.ts";

export type Bus = "master" | "music" | "sfx" | "voice" | "ui";

/** Which music cues and VO scenes each loading stage brings in. */
export const STAGE_CONTENTS: Readonly<
  Record<Stage, { music: readonly MusicCueId[]; scene: (s: string) => boolean }>
> = {
  boot: { music: ["logos"], scene: () => false },
  menu: { music: ["menu", "tutorial"], scene: (s) => s === "tutorial" },
  gameplay: {
    music: ["gameplay", "flashback", "boss"],
    // (gameplay sfx variants are added to this stage too; see the constructor)
    scene: (s) => s !== "tutorial" && !s.startsWith("ending"),
  },
  ending: {
    music: ["ending", "endingKill", "endingPacifist", "credits"],
    scene: (s) => s.startsWith("ending") || s === "credits",
  },
};

export interface AudioEngineOptions {
  readonly store: SettingsStore;
  /** Public root of the asset folders, e.g. `import.meta.env.BASE_URL`. */
  readonly base?: string;
  readonly ctx?: AudioContext;
  /**
   * A/B variants (voice and music takes). The engine defines the axes it
   * finds in the manifests; omitted means every default.
   */
  readonly variants?: VariantRegistry;
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
  private readonly sfxDucker: Ducker;
  private readonly eventDuck: GainNode;
  private readonly musicFilter: BiquadFilterNode;
  private readonly sfxFilter: BiquadFilterNode;
  /** Gameplay sound: sim events in, cues out (see `gameplayAudio.ts`). */
  readonly gameplay: GameplayAudio;
  readonly sfxPlayer: SfxPlayer;
  private ear: () => { pos: Vec2; vel: Vec2 } = () => ({
    pos: { x: 240, y: 560 },
    vel: { x: 0, y: 0 },
  });
  /** Built on the Warden's first line (see `arenaPa.ts`). */
  private arenaPa: AudioNode | null = null;
  /** Stages asked for so far, so a voice-language change can refetch VO. */
  private readonly stagesWanted = new Set<Stage>();
  private voiceLang: Lang;
  private readonly vo: VoCatalog;
  /**
   * The voice sounding on each layer. A layer holds one line: a new line
   * cuts the old one. The Director already stops a line it interrupts, but
   * a line it considers finished by its own clock may still be sounding
   * (auto-play runs the scene clock up to 8x), and stacked lines were most
   * of the reels' -8 LUFS.
   */
  private readonly layerVoices = new Map<VoiceLayer, VoiceHandle>();

  private constructor(
    readonly ctx: AudioContext,
    private readonly store: SettingsStore,
    private readonly base: string,
    voFile: VoCuesFile,
    voVariants: VoiceVariantsFile | null,
    private readonly sfx: ReadonlyMap<string, string>,
    musicFile: MusicManifestFile | null,
    gameplaySfx: ReadonlyMap<string, readonly string[]>,
    readonly variants: VariantRegistry,
  ) {
    defineVoiceAxes(variants, voVariants);
    defineMusicAxes(variants, musicFile);
    this.vo = new VoCatalog(
      voFile,
      "vo/",
      (line, speaker, lang) =>
        voiceVariantTake(variants, voVariants, speaker, line, lang),
    );
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
    const sfxDuck = bus();
    this.eventDuck = bus();
    const lowpass = () => {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = OPEN_HZ;
      return f;
    };
    this.musicFilter = lowpass();
    this.sfxFilter = lowpass();
    const [chainIn, chainOut] = masterChain(ctx);
    this.buses.master.connect(chainIn);
    chainOut.connect(ctx.destination);
    const trim = (b: MixBus) => {
      const g = bus();
      g.gain.value = Math.pow(10, MIX_TRIM_DB[b] / 20);
      g.connect(this.buses.master);
      // QA records a stem per bus here (qa/av.ts); absent outside QA.
      (globalThis as { __nwqaBusTap?: (b: string, n: AudioNode) => void })
        .__nwqaBusTap?.(b, g);
      return g;
    };
    this.buses.music.connect(musicDuck).connect(this.eventDuck)
      .connect(this.musicFilter).connect(trim("music"));
    this.buses.sfx.connect(sfxDuck).connect(this.sfxFilter)
      .connect(trim("sfx"));
    for (const b of ["voice", "ui"] as const) {
      this.buses[b].connect(trim(b));
    }
    const now = () => ctx.currentTime;
    this.ducker = new Ducker(musicDuck.gain, now);
    this.sfxDucker = new Ducker(sfxDuck.gain, now, SFX_UNDER_VOICE);

    this.loader = new StagedLoader((url) => this.decode(url));
    const choose = (cue: MusicCueId) => variants.get(`music.${cue}`);
    const tracks = musicTracks(musicFile, choose);
    this.music = new MusicPlayer(
      ctx,
      this.buses.music,
      tracks,
      (url) => this.loader.request(this.url(url)),
      (url) => this.loader.get(this.url(url)),
    );
    for (const src of sfx.values()) this.loader.add("boot", this.url(src));
    for (const variants of gameplaySfx.values()) {
      for (const src of variants) this.loader.add("gameplay", this.url(src));
    }
    this.sfxPlayer = new SfxPlayer({
      ctx,
      buses: this.buses,
      samples: (role) =>
        (gameplaySfx.get(role) ?? [])
          .map((src) => this.loader.get(this.url(src)))
          .filter((b): b is AudioBuffer => b !== undefined),
      grid: () => this.grid(),
      ear: () => this.ear(),
      mono: () => this.store.get().audio.mono,
      duck: (role) => this.duckMusic(role),
    });
    this.gameplay = new GameplayAudio(this.sfxPlayer);
    for (const [stage, contents] of Object.entries(STAGE_CONTENTS)) {
      for (const cue of contents.music) {
        const track = tracks.get(cue);
        if (track) this.loader.add(stage as Stage, this.url(track.src));
      }
    }

    variants.subscribe((axis) => {
      if (axis.startsWith("music.")) {
        this.music.retrack(musicTracks(musicFile, choose), 400);
      } else if (axis.startsWith("voice.")) {
        for (const stage of this.stagesWanted) void this.loadStage(stage);
      }
    });

    this.voiceLang = store.get().voiceLang;
    this.applyVolumes(store.get(), 0);
    store.subscribe((s) => {
      this.applyVolumes(s, 0.03);
      if (s.voiceLang !== this.voiceLang) {
        this.voiceLang = s.voiceLang;
        for (const stage of this.stagesWanted) void this.loadStage(stage);
      }
    });
  }

  /**
   * Builds the engine and its graph. Missing manifests are fine: the game
   * runs silent (and subtitled) until assets exist.
   */
  static async create(options: AudioEngineOptions): Promise<AudioEngine> {
    const base = options.base ?? "./";
    const [vo, voVariants, sfx, music, gameplay] = await Promise.all([
      fetchJson<VoCuesFile>(base + "vo/cues.json"),
      fetchJson<VoiceVariantsFile>(base + "vo/variants/index.json"),
      fetchJson<SfxManifestFile>(base + "sfx/manifest.json"),
      fetchJson<MusicManifestFile>(base + "music/manifest.json"),
      fetchJson<GameplaySfxFile>(base + "sfx/gameplay.json"),
    ]);
    return new AudioEngine(
      options.ctx ?? new AudioContext(),
      options.store,
      base,
      vo ?? { lines: {} },
      voVariants,
      sfxUrls(sfx),
      music,
      gameplayVariants(gameplay),
      options.variants ?? new VariantRegistry({}),
    );
  }

  /** Browsers start audio suspended; call from the first click or key. */
  resume(): Promise<void> {
    return this.ctx.resume();
  }

  /** Loads a stage in the background, VO in the current voice language. */
  loadStage(stage: Stage): Promise<StageProgress> {
    this.stagesWanted.add(stage);
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

  /**
   * Ready, loading or missing. Asking about a line that is not loaded also
   * requests it at once, ahead of the staged queue: the Director holds the
   * line until it arrives, so it is never dropped.
   */
  status(line: LineId, lang: Lang): VoiceStatus {
    const v = this.vo.resolve(line, lang);
    if (!v) return "missing";
    const url = this.url(v.url);
    if (this.loader.get(url)) return "ready";
    if (this.loader.hasFailed(url)) return "missing";
    void this.loader.request(url);
    return "loading";
  }

  play(line: LineId, lang: Lang, layer: VoiceLayer): VoiceHandle | null {
    const v = this.vo.resolve(line, lang);
    if (!v) return null;
    const buffer = this.loader.get(this.url(v.url));
    if (!buffer) {
      this.loader.request(this.url(v.url)); // ready for next time
      return null;
    }
    this.layerVoices.get(layer)?.stop(LAYER_CUT_MS);
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain).connect(this.voiceInput(line, layer));
    this.ducker.voiceStarted();
    this.sfxDucker.voiceStarted();
    let ended = false;
    source.onended = () => {
      if (!ended) {
        this.ducker.voiceEnded();
        this.sfxDucker.voiceEnded();
      }
      ended = true;
      if (this.layerVoices.get(layer) === handle) {
        this.layerVoices.delete(layer);
      }
    };
    // Skip the take's measured lead-in (`voStartS`): the Director's clock,
    // subtitles and word timings already count from this point.
    source.start(0, v.startS);
    const handle: VoiceHandle = {
      setGain(target, rampMs) {
        gain.gain.setTargetAtTime(target, ctx.currentTime, rampMs / 3000);
      },
      stop: (fadeMs = 0) => {
        if (ended) return;
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0, t, fadeMs / 3000);
        source.stop(t + fadeMs / 1000);
        if (this.layerVoices.get(layer) === handle) {
          this.layerVoices.delete(layer);
        }
      },
    };
    this.layerVoices.set(layer, handle);
    return handle;
  }

  /** Where a voice line enters the graph: the Warden goes through the PA. */
  private voiceInput(line: LineId, _layer: VoiceLayer): AudioNode {
    if (this.vo.speaker(line) === "warden") {
      this.arenaPa ??= createArenaPa(this.ctx, this.buses.voice);
      return this.arenaPa;
    }
    return this.buses.voice;
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

  /**
   * Menu sounds on the ui bus: the promoted pick if there is one, else its
   * synth stand-in (`ui_<role>` in `GAMEPLAY_SOUNDS`), else a hangar role.
   */
  playUi(role: string): void {
    if (this.sfx.has(role)) return this.oneShot(role, "ui");
    const id = `ui_${role}`;
    if (isGameplaySound(id)) this.sfxPlayer.play({ role: id });
    else if (isGameplaySound(role)) this.sfxPlayer.play({ role });
  }

  /** Word timings for subtitles (see `VoCatalog.words`). */
  words(line: LineId, lang: Lang): readonly WordTiming[] | undefined {
    return this.vo.words(line, lang);
  }

  /**
   * Radio chatter: a voice line heard over a scout's or Lane Control's
   * channel, band-limited like a radio and panned to where the speaker is
   * (`pan`, -1 to 1; 0 for a channel with no position). It does not duck
   * music. Returns false if the audio is not ready (it is then requested).
   */
  playRadio(line: LineId, lang: Lang, pan: number): boolean {
    const v = this.vo.resolve(line, lang);
    const buffer = v && this.loader.get(this.url(v.url));
    if (!buffer) return false;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3600;
    const panner = ctx.createStereoPanner();
    panner.pan.value = this.store.get().audio.mono ? 0 : pan;
    source.connect(hp).connect(lp).connect(panner).connect(this.buses.voice);
    source.start(0, v.startS);
    return true;
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

  // ------------------------------------------------------ gameplay mix

  /** Where the ears are: the player's ship. Set by the game loop. */
  setEar(ear: () => { pos: Vec2; vel: Vec2 }): void {
    this.ear = ear;
  }

  /** The grid of the cue now playing (or its briefed grid, or a default). */
  grid(): { grid: BeatGrid; cueStart: number } {
    const playing = this.music.playing;
    const cue = playing?.cue ?? this.music.cue;
    const t = playing?.track;
    const grid: BeatGrid = t?.bpm
      ? {
        bpm: t.bpm,
        beatOffset: t.beatOffset ?? 0,
        beatsPerBar: t.beatsPerBar ?? 4,
        key: t.key ?? (DEFAULT_GRIDS[cue] ?? FALLBACK_GRID).key,
      }
      : DEFAULT_GRIDS[cue] ?? FALLBACK_GRID;
    return { grid, cueStart: playing?.startedAt ?? 0 };
  }

  /** A gameplay moment dips (and maybe dulls) the music, then lets go. */
  private duckMusic(role: SoundRole): void {
    const d = role.duck;
    if (!d) return;
    const t = this.ctx.currentTime;
    const g = this.eventDuck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(Math.pow(10, d.db / 20), t, d.attackS / 3);
    g.setTargetAtTime(1, t + d.attackS * 2, d.releaseS / 3);
    if (d.lowpassHz) {
      const f = this.musicFilter.frequency;
      f.cancelScheduledValues(t);
      f.setTargetAtTime(d.lowpassHz, t, d.attackS / 3);
      f.setTargetAtTime(OPEN_HZ, t + d.attackS * 2, d.releaseS / 3);
    }
  }

  /** The flashback: gameplay sfx drop 12 dB behind a low-pass. */
  setMuffled(on: boolean): void {
    const t = this.ctx.currentTime;
    this.sfxFilter.frequency.setTargetAtTime(on ? 900 : OPEN_HZ, t, 0.3);
  }

  /** Plays a gameplay role by id (hangar UI, tests). */
  playGameplay(role: GameplaySoundId): void {
    this.sfxPlayer.play({ role });
  }

  // -------------------------------------------------------------- helpers

  private applyVolumes(s: Settings, timeConstant: number): void {
    const t = this.ctx.currentTime;
    // Mono folds the mix to one channel at the master, after all panning.
    const master = this.buses.master;
    const channels = s.audio.mono ? 1 : 2;
    if (master.channelCount !== channels) {
      master.channelCount = channels;
      master.channelCountMode = "explicit";
      master.channelInterpretation = "speakers";
    }
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

type MixBus = Exclude<Bus, "master">;

/**
 * The mix's own gain per bus, in dB, on top of the player's faders. Set from
 * QA stem loudness (see `qa/av.ts`, "audio: bus loudness"): with default
 * faders, story VO lands near -20 LUFS, music beds about 8 LU under VO,
 * gameplay sfx about 4 LU under VO, and the full mix near -17 LUFS
 * integrated.
 */
export const MIX_TRIM_DB: Readonly<Record<MixBus, number>> = {
  music: 5,
  sfx: 2,
  voice: -1,
  ui: 2,
};

/** Where the master limiter starts working, dBFS. */
export const LIMIT_THRESHOLD_DB = -6;
const LIMIT_RATIO = 20;
/** The ceiling the soft clipper approaches, dBFS (true peak target -1). */
export const CEILING_DB = -1.2;

/**
 * Web Audio's compressor applies automatic makeup gain: the spec scales its
 * output by (1 / g)^0.6, where g is its gain at a full-scale input. With a
 * hard knee g is threshold + (0 - threshold) / ratio dB, so the makeup is
 * 0.6 of that, in dB. Left alone, a "safety limiter" at -6 dB and 20:1
 * quietly adds about 3.4 dB to the whole mix.
 */
export function compressorMakeupDb(thresholdDb: number, ratio: number): number {
  return -0.6 * (thresholdDb + (0 - thresholdDb) / ratio);
}

/**
 * A soft-clip transfer curve: linear below `kneeDb`, then easing (tanh) to
 * `ceilingDb`; inputs past full scale clamp to the curve's ends. Pure, so it
 * is tested.
 */
export function ceilingCurve(
  kneeDb: number,
  ceilingDb: number,
  n = 2049,
): Float32Array<ArrayBuffer> {
  const k = Math.pow(10, kneeDb / 20);
  const c = Math.pow(10, ceilingDb / 20);
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= k ? a : k + (c - k) * Math.tanh((a - k) / (c - k));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/**
 * Master: a fast compressor as the limiter (its makeup gain cancelled), then
 * a 4x-oversampled soft clipper whose output cannot pass `CEILING_DB`, so
 * the mix meets -1 dBTP even when the compressor's 3 ms attack lets a
 * transient through. Native nodes only: cheap enough for a school
 * Chromebook, no AudioWorklet.
 */
function masterChain(ctx: BaseAudioContext): [AudioNode, AudioNode] {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = LIMIT_THRESHOLD_DB;
  comp.knee.value = 0;
  comp.ratio.value = LIMIT_RATIO;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const unmakeup = ctx.createGain();
  unmakeup.gain.value = Math.pow(
    10,
    -compressorMakeupDb(LIMIT_THRESHOLD_DB, LIMIT_RATIO) / 20,
  );
  const ceiling = ctx.createWaveShaper();
  ceiling.curve = ceilingCurve(CEILING_DB - 2, CEILING_DB);
  ceiling.oversample = "4x";
  comp.connect(unmakeup).connect(ceiling);
  return [comp, ceiling];
}

/** One `music.<cue>` axis per cue that ships more than one take. */
function defineMusicAxes(
  registry: VariantRegistry,
  file: MusicManifestFile | null,
): void {
  for (const [cue, track] of Object.entries(file?.cues ?? {})) {
    const choices = Object.keys(track?.variants ?? {});
    if (!track || choices.length < 2 || !track.variant) continue;
    registry.define({
      id: `music.${cue}`,
      kind: "music",
      choices,
      defaultChoice: track.variant,
      note: track.provisional ? "provisional pick (music/stats.py)" : undefined,
    });
  }
}

/** How fast a new line on a layer fades out the one still sounding there. */
const LAYER_CUT_MS = 80;

/** A low-pass "open" enough to be inaudible. */
const OPEN_HZ = 20000;

/** Gameplay sfx under story VO: about -4 dB. */
const SFX_UNDER_VOICE = 0.63;

/** `sfx/gameplay.json`, written by `sfx/promote.py`. */
interface GameplaySfxFile {
  readonly sounds: Readonly<
    Record<string, { readonly variants: readonly string[] } | null>
  >;
}

function gameplayVariants(
  file: GameplaySfxFile | null,
): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [role, entry] of Object.entries(file?.sounds ?? {})) {
    if (entry?.variants.length) out.set(role, entry.variants);
  }
  return out;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? (await res.json()) as T : null;
  } catch {
    return null;
  }
}
