import type { AudioEngine } from './AudioEngine';
import type { SoundBank, SoundKey } from './SoundBank';
import { CRISOL_SCALE } from './voices';

/** Qué pide la música: la portada, cada fase de la ronda o nada. */
export type MusicMood = 'menu' | 'hunt' | 'convergence' | 'final' | 'silent';

interface MoodSettings {
  readonly bpm: number;
  /** Brillo del bordón (Hz del pasa bajos). */
  readonly drone: number;
  /** Probabilidad de una nota punteada en cada corchea. */
  readonly pluck: number;
  /** Latido grave en cada pulso. */
  readonly pulse: boolean;
  /** Golpecito de ruido a contratiempo. */
  readonly tick: boolean;
  /** Notas más altas de la escala que puede usar. */
  readonly reach: number;
}

const MOODS: Readonly<Record<Exclude<MusicMood, 'silent'>, MoodSettings>> = {
  menu: { bpm: 56, drone: 320, pluck: 0.16, pulse: false, tick: false, reach: 7 },
  hunt: { bpm: 72, drone: 420, pluck: 0.24, pulse: false, tick: false, reach: 9 },
  convergence: { bpm: 84, drone: 620, pluck: 0.3, pulse: true, tick: false, reach: 10 },
  final: { bpm: 108, drone: 950, pluck: 0.38, pulse: true, tick: true, reach: 11 },
};

const LOOKAHEAD_S = 0.25;
const SCHEDULE_MS = 60;

/**
 * Música generada en vivo con la escala del Crisol: un bordón grave, notas punteadas al azar
 * y, desde la Convergencia, un latido que se acelera en el Duelo final. Si llega una pista de
 * ElevenLabs para el ánimo (`music.hunt`…), suena esa en bucle en su lugar.
 */
export class Music {
  private mood: MusicMood = 'silent';
  private drone: { osc: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private track: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private nextBeat = 0;
  private beat = 0;
  private timer: number | null = null;

  constructor(
    private readonly engine: AudioEngine,
    private readonly bank: SoundBank,
  ) {
    engine.onReady(() => {
      const wanted = this.mood;
      this.mood = 'silent';
      this.set(wanted);
    });
  }

  set(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const ctx = this.engine.ctx;
    if (!ctx) return;
    this.stopTrack(ctx);
    if (mood === 'silent') {
      this.stopDrone(ctx);
      this.stopScheduler();
      return;
    }
    const track = this.bank.loop(`music.${mood}` as SoundKey);
    if (track) {
      this.stopDrone(ctx);
      this.stopScheduler();
      this.startTrack(ctx, track);
      return;
    }
    this.startDrone(ctx, MOODS[mood].drone);
    if (this.timer === null) {
      this.nextBeat = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), SCHEDULE_MS);
    }
  }

  private schedule(): void {
    const ctx = this.engine.ctx;
    if (!ctx || this.mood === 'silent' || document.hidden) return;
    const settings = MOODS[this.mood];
    const eighth = 30 / settings.bpm;
    // Si la pestaña estuvo dormida, no se ponen al día todas las notas perdidas.
    if (this.nextBeat < ctx.currentTime - 0.5) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + LOOKAHEAD_S) {
      const t = this.nextBeat;
      const onBeat = this.beat % 2 === 0;
      if (settings.pulse && onBeat) this.pulse(ctx, t, this.beat % 8 === 0 ? 0.5 : 0.32);
      if (settings.tick && !onBeat) this.tick(ctx, t);
      if (Math.random() < settings.pluck) {
        const index = Math.floor(Math.random() * settings.reach);
        const freq = CRISOL_SCALE[index] ?? 220;
        this.pluck(ctx, t, freq * 2, onBeat ? 0.09 : 0.06);
      }
      // Cada ocho pulsos, una nota larga y grave que ancla la armonía.
      if (this.beat % 16 === 0)
        this.pluck(ctx, t, CRISOL_SCALE[Math.random() < 0.5 ? 0 : 3] ?? 110, 0.1, 3);
      this.beat++;
      this.nextBeat += eighth;
    }
  }

  private pluck(ctx: AudioContext, t: number, freq: number, level: number, length = 1.2): void {
    const dest = this.engine.music;
    if (!dest) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(filter).connect(env).connect(dest);
    const reverb = this.engine.reverb;
    if (reverb) {
      const send = ctx.createGain();
      send.gain.value = 1.2;
      env.connect(send).connect(reverb);
    }
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  private pulse(ctx: AudioContext, t: number, level: number): void {
    const dest = this.engine.music;
    if (!dest) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private tick(ctx: AudioContext, t: number): void {
    const dest = this.engine.music;
    const buffer = this.engine.noiseBuffer;
    if (!dest || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.06, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    source.connect(filter).connect(env).connect(dest);
    source.start(t, Math.random());
    source.stop(t + 0.06);
  }

  private startDrone(ctx: AudioContext, brightness: number): void {
    const dest = this.engine.music;
    if (!dest) return;
    if (this.drone) {
      this.drone.filter.frequency.setTargetAtTime(brightness, ctx.currentTime, 1.5);
      return;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.value = brightness;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 3);
    filter.connect(gain).connect(dest);
    // Un pulso lento en el filtro para que el bordón respire.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 120;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    const osc = [55, 55.3, 82.41].map((freq) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.connect(filter);
      o.start();
      return o;
    });
    osc.push(lfo);
    this.drone = { osc, filter, gain };
  }

  private stopDrone(ctx: AudioContext): void {
    const drone = this.drone;
    if (!drone) return;
    this.drone = null;
    drone.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    for (const o of drone.osc) o.stop(ctx.currentTime + 3);
  }

  private startTrack(ctx: AudioContext, source: AudioBufferSourceNode): void {
    const dest = this.engine.music;
    if (!dest) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
    source.connect(gain).connect(dest);
    source.start();
    this.track = { source, gain };
  }

  private stopTrack(ctx: AudioContext): void {
    const track = this.track;
    if (!track) return;
    this.track = null;
    track.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
    track.source.stop(ctx.currentTime + 2.5);
  }

  private stopScheduler(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
