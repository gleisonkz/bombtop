import type { Cue, CueName } from "./cues";
import { explosionGain, panFor, VoiceLimiter } from "./mixer";

export type SoundName = CueName | "start" | "win" | "end" | "click";

interface SoundSpec {
  /** Linear volume (files are peak-normalized; this sets the mix). */
  gain: number;
  /** Random playback-rate spread (0.05 = ±5%). */
  vary: number;
  /** Copies allowed to start within VOICE_WINDOW_MS. */
  voices: number;
}

const VOICE_WINDOW_MS = 120;

/** Overall level of the game's sound, in dB. */
export const MASTER_DB = -2;
const MASTER_GAIN = 10 ** (MASTER_DB / 20);

/** The mix. Files live in public/sfx (built by scripts/build-sfx.mjs). */
export const SOUNDS: Record<SoundName, SoundSpec> = {
  place: { gain: 0.55, vary: 0.06, voices: 3 },
  explode: { gain: 0.9, vary: 0.08, voices: 3 },
  break: { gain: 0.35, vary: 0.1, voices: 2 },
  wall: { gain: 0.45, vary: 0.05, voices: 2 },
  kick: { gain: 0.6, vary: 0.08, voices: 2 },
  throw: { gain: 0.55, vary: 0.08, voices: 2 },
  pickup: { gain: 0.5, vary: 0.03, voices: 2 },
  curse: { gain: 0.6, vary: 0.03, voices: 1 },
  stun: { gain: 0.55, vary: 0.05, voices: 2 },
  death: { gain: 0.7, vary: 0.03, voices: 2 },
  mount: { gain: 0.55, vary: 0.04, voices: 2 },
  dismount: { gain: 0.6, vary: 0.04, voices: 2 },
  jump: { gain: 0.4, vary: 0.06, voices: 2 },
  dash: { gain: 0.45, vary: 0.06, voices: 2 },
  warp: { gain: 0.45, vary: 0.04, voices: 2 },
  hurry: { gain: 0.6, vary: 0, voices: 1 },
  start: { gain: 0.6, vary: 0, voices: 1 },
  win: { gain: 0.6, vary: 0, voices: 1 },
  end: { gain: 0.55, vary: 0, voices: 1 },
  click: { gain: 0.35, vary: 0.04, voices: 2 },
};

/** Where sounds actually go; WebAudioBackend in the browser, a fake in tests. */
export interface AudioBackend {
  unlock(): Promise<void>;
  play(name: SoundName, o: { gain: number; pan: number; rate: number }): void;
  /** Milliseconds, for the voice limiter. */
  now(): number;
}

interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const MUTE_KEY = "bombtop.muted";
const VOLUME_KEY = "bombtop.volume";

/** Game sound: what to play, how loud and where; the backend does the audio. */
export class Sound {
  private unlocking: Promise<void> | null = null;
  muted: boolean;
  /** 0..1, applied on top of the mix. */
  volume: number;

  constructor(
    private readonly backend: AudioBackend,
    private readonly store: Store,
    private readonly random: () => number = Math.random,
  ) {
    this.muted = store.get(MUTE_KEY) === "1";
    const saved = Number(store.get(VOLUME_KEY) ?? "1");
    this.volume = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    this.store.set(VOLUME_KEY, String(this.volume));
  }

  /** Browsers only allow audio after a tap or key press: call from one. */
  unlock(): Promise<void> {
    return (this.unlocking ??= this.backend.unlock());
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.store.set(MUTE_KEY, this.muted ? "1" : "0");
    return this.muted;
  }

  play(name: SoundName, o: { pan?: number; gain?: number } = {}): void {
    const spec = SOUNDS[name];
    if (this.muted || this.volume === 0 || !this.allow(name, spec.voices)) return;
    const rate = 1 + (this.random() * 2 - 1) * spec.vary;
    this.backend.play(name, { gain: MASTER_GAIN * this.volume * spec.gain * (o.gain ?? 1), pan: o.pan ?? 0, rate });
  }

  /** Plays what happened in the arena (see soundCues). */
  cues(cues: Cue[], arenaWidth: number): void {
    for (const c of cues) {
      this.play(c.name, { pan: panFor(c.x, arenaWidth), gain: c.size ? explosionGain(c.size) : 1 });
    }
  }

  private readonly limiters = new Map<SoundName, VoiceLimiter>();
  private allow(name: SoundName, voices: number): boolean {
    let l = this.limiters.get(name);
    if (!l) this.limiters.set(name, (l = new VoiceLimiter(voices, VOICE_WINDOW_MS)));
    return l.allow(name, this.backend.now());
  }
}

/** Web Audio output: decodes every file on unlock, then plays them with gain, pan and pitch. */
export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();

  constructor(private readonly baseUrl: string) {}

  async unlock(): Promise<void> {
    const ctx = (this.ctx = new AudioContext({ latencyHint: "interactive" }));
    await ctx.resume().catch(() => undefined);
    await Promise.all(
      (Object.keys(SOUNDS) as SoundName[]).map(async (name) => {
        try {
          const data = await fetch(`${this.baseUrl}sfx/${name}.m4a`).then((r) => r.arrayBuffer());
          this.buffers.set(name, await ctx.decodeAudioData(data));
        } catch (err) {
          console.warn(`sound ${name} unavailable`, err);
        }
      }),
    );
  }

  play(name: SoundName, o: { gain: number; pan: number; rate: number }): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = new AudioBufferSourceNode(ctx, { buffer, playbackRate: o.rate });
    const gain = new GainNode(ctx, { gain: o.gain });
    const pan = new StereoPannerNode(ctx, { pan: o.pan });
    src.connect(gain).connect(pan).connect(ctx.destination);
    src.start();
  }

  now(): number {
    return performance.now();
  }
}
