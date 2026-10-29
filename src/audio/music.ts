/**
 * Music cue playback: one cue at a time, crossfaded, looping inside its loop
 * region. A cue whose file has not arrived starts as soon as it does (if it
 * is still the cue we want); a cue with no file at all is silence.
 */

import type { MusicCueId } from "../contracts/index.ts";
import type { MusicTrack } from "./manifests.ts";

interface Playing {
  readonly cue: MusicCueId;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

export class MusicPlayer {
  private playing: Playing | null = null;
  private wanted: MusicCueId = "silence";

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly tracks: ReadonlyMap<MusicCueId, MusicTrack>,
    private readonly load: (url: string) => Promise<AudioBuffer | undefined>,
    private readonly loaded: (url: string) => AudioBuffer | undefined,
  ) {}

  get cue(): MusicCueId {
    return this.wanted;
  }

  play(cue: MusicCueId, fadeMs: number): void {
    if (cue === this.wanted) return;
    this.wanted = cue;
    this.fadeOutCurrent(fadeMs);
    const track = this.tracks.get(cue);
    if (!track) return; // "silence", or a cue not produced yet
    const buffer = this.loaded(track.src);
    if (buffer) {
      this.start(cue, track, buffer, fadeMs);
    } else {
      this.load(track.src).then((b) => {
        if (b && this.wanted === cue && !this.playing) {
          this.start(cue, track, b, fadeMs);
        }
      });
    }
  }

  private start(
    cue: MusicCueId,
    track: MusicTrack,
    buffer: AudioBuffer,
    fadeMs: number,
  ): void {
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = track.loop;
    source.loopStart = track.loopStart ?? 0;
    source.loopEnd = track.loopEnd ?? buffer.duration;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + fadeMs / 1000);
    source.connect(gain).connect(this.out);
    source.start(t);
    this.playing = { cue, source, gain };
  }

  private fadeOutCurrent(fadeMs: number): void {
    const p = this.playing;
    if (!p) return;
    const t = this.ctx.currentTime;
    const end = t + Math.max(fadeMs, 10) / 1000;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, end);
    p.source.stop(end);
    this.playing = null;
  }
}
