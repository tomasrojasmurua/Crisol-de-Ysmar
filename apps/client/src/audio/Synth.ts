import type { ElementId } from '@crisol/core';
import type { AudioEngine } from './AudioEngine';
import { ELEMENT_VOICES } from './voices';

/** Dónde suena algo: volumen (0 a 1) y lado (-1 izquierda, 1 derecha). */
export interface Placement {
  readonly gain: number;
  readonly pan: number;
}

export const CENTER: Placement = { gain: 1, pan: 0 };

/**
 * Sonidos hechos con osciladores y ruido, sin archivos. Son provisorios: cuando lleguen los de
 * ElevenLabs, `SoundBank` los usa en su lugar y estos quedan de respaldo.
 */
export class Synth {
  constructor(private readonly engine: AudioEngine) {}

  /** Salida de un sonido: volumen, paneo y un envío a la reverberación. */
  private output(place: Placement, wet: number, bus: 'sfx' | 'music' = 'sfx'): GainNode | null {
    const ctx = this.engine.ctx;
    const dest = bus === 'sfx' ? this.engine.sfx : this.engine.music;
    if (!ctx || !dest || place.gain <= 0.001) return null;
    const gain = ctx.createGain();
    gain.gain.value = place.gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, place.pan));
    gain.connect(panner).connect(dest);
    const reverb = this.engine.reverb;
    if (reverb && wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      panner.connect(send).connect(reverb);
    }
    return gain;
  }

  /** Una nota de un elemento: lo que suena al tocarlo en el tejido. */
  note(element: ElementId, place: Placement, opts: NoteOptions = {}): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, ELEMENT_VOICES[element].wet, opts.bus);
    if (!ctx || !out) return;
    const v = ELEMENT_VOICES[element];
    const t = ctx.currentTime + (opts.delay ?? 0);
    const length = v.decay * (opts.length ?? 1);
    const freq = v.freq * (opts.octave ?? 1);
    const level = opts.level ?? 0.32;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(v.brightFrom, t);
    filter.frequency.exponentialRampToValueAtTime(v.brightTo, t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + v.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + v.attack + length);
    filter.connect(env).connect(out);

    const stop = t + v.attack + length + 0.05;
    const detunes = v.detune ? [-v.detune, v.detune] : [0];
    for (const cents of detunes) {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      if (v.vibratoHz > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = v.vibratoHz;
        const depth = ctx.createGain();
        depth.gain.value = v.vibratoCents;
        lfo.connect(depth).connect(osc.detune);
        lfo.start(t);
        lfo.stop(stop);
      }
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1 / detunes.length;
      osc.connect(voiceGain).connect(filter);
      osc.start(t);
      osc.stop(stop);
    }
    if (v.noise > 0) this.noiseHit(out, t, v.noise * level * 2, v.noiseFreq, 0.08, 'bandpass');
  }

  /** El acorde de un tejido al lanzarlo: sus notas juntas, una octava más brillante al final. */
  chord(weave: readonly ElementId[], place: Placement, strong: boolean): void {
    const length = strong ? 2.2 : 1.5;
    const level = 0.26 / Math.sqrt(Math.max(1, weave.length));
    weave.forEach((element, i) => {
      this.note(element, place, { length, level, delay: i * 0.018 });
    });
    const last = weave[weave.length - 1];
    if (last && weave.length > 1) {
      this.note(last, place, { octave: 2, length: length * 0.8, level: level * 0.5, delay: 0.05 });
    }
  }

  /** Deshacer el tejido: una nota que cae. */
  untie(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.2);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const env = envelope(ctx, t, 0.12, 0.002, 0.16);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** El soplo de un hechizo que sale. El primer elemento le da el color. */
  whoosh(element: ElementId, place: Placement, size = 1): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.3);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const v = ELEMENT_VOICES[element];
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    const center = Math.min(7000, v.freq * 6);
    filter.frequency.setValueAtTime(center * 0.5, t);
    filter.frequency.exponentialRampToValueAtTime(center * 2, t + 0.12);
    filter.frequency.exponentialRampToValueAtTime(center * 0.6, t + 0.32 * size);
    const env = envelope(ctx, t, 0.5, 0.03, 0.32 * size);
    this.noiseSource(t, 0.4 * size + 0.1)
      ?.connect(filter)
      .connect(env)
      .connect(out);
  }

  /** Una explosión o un brote: ruido grave con golpe, más largo cuanto más grande. */
  boom(element: ElementId, place: Placement, radius: number): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.45);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const size = Math.max(0.6, Math.min(2.2, radius / 2.5));
    const v = ELEMENT_VOICES[element];
    // El golpe: un seno que cae de tono.
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140 / size + 40, t);
    thump.frequency.exponentialRampToValueAtTime(38, t + 0.25 * size);
    thump.connect(envelope(ctx, t, 0.7, 0.004, 0.3 * size)).connect(out);
    thump.start(t);
    thump.stop(t + 0.4 * size);
    // El cuerpo: ruido filtrado con el color del elemento.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(8000, v.noiseFreq * 2.5), t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.5 * size);
    const env = envelope(ctx, t, 0.55, 0.006, 0.55 * size);
    this.noiseSource(t, 0.7 * size)
      ?.connect(filter)
      .connect(env)
      .connect(out);
  }

  /** Un rayo: chasquido brillante con zumbido. */
  zap(place: Placement, length = 1): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.5);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    this.noiseSource(t, 0.25 * length)
      ?.connect(filter)
      .connect(envelope(ctx, t, 0.5, 0.001, 0.18 * length))
      .connect(out);
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(1200, t);
    buzz.frequency.exponentialRampToValueAtTime(90, t + 0.2 * length);
    buzz.connect(envelope(ctx, t, 0.14, 0.001, 0.2 * length)).connect(out);
    buzz.start(t);
    buzz.stop(t + 0.25 * length);
  }

  /** Un golpe recibido: seco y grave. `mine` lo hace más presente. */
  hurt(place: Placement, heavy: boolean): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.1);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(heavy ? 120 : 170, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    osc
      .connect(filter)
      .connect(envelope(ctx, t, heavy ? 0.5 : 0.35, 0.002, 0.14))
      .connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
    this.noiseHit(out, t, 0.25, 1200, 0.06, 'lowpass');
  }

  /** Tu golpe llegó: un tic alto y corto. */
  confirm(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.15);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    osc.connect(envelope(ctx, t, 0.16, 0.001, 0.07)).connect(out);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Bloqueado por un muro o un escudo: un tañido metálico. */
  clang(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.6);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    for (const [freq, level] of [
      [620, 0.18],
      [1490, 0.1],
      [2330, 0.06],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(envelope(ctx, t, level, 0.001, 0.5)).connect(out);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  }

  /** Un hechizo que se deshace sin salir. */
  fizzle(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.2);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.35);
    this.noiseSource(t, 0.4)
      ?.connect(filter)
      .connect(envelope(ctx, t, 0.3, 0.01, 0.35))
      .connect(out);
  }

  /** Un salto o un destello: viento rápido que sube. */
  blink(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.5);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.15);
    this.noiseSource(t, 0.25)
      ?.connect(filter)
      .connect(envelope(ctx, t, 0.35, 0.01, 0.18))
      .connect(out);
  }

  /** Una campana: santuarios, bestias vencidas, descubrir un hechizo. */
  bell(place: Placement, freq: number, level = 0.2, length = 1.6): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.8);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    for (const [ratio, gain] of [
      [1, 1],
      [2.01, 0.45],
      [2.76, 0.3],
      [5.4, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      osc.connect(envelope(ctx, t, level * gain, 0.002, length / ratio ** 0.5)).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  }

  /** Un gong grave: caer, la fase final. */
  gong(place: Placement, freq = 73, length = 3): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 1);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    for (const [ratio, gain] of [
      [1, 0.5],
      [1.48, 0.25],
      [2.02, 0.2],
      [2.93, 0.1],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio * 1.02, t);
      osc.frequency.exponentialRampToValueAtTime(freq * ratio, t + 0.4);
      osc.connect(envelope(ctx, t, gain * 0.5, 0.01, length)).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.1);
    }
    this.noiseHit(out, t, 0.2, 500, 0.3, 'lowpass');
  }

  /** Un rugido de bestia grande: ruido grave modulado. */
  roar(place: Placement): void {
    const ctx = this.engine.ctx;
    const out = this.output(place, 0.6);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.linearRampToValueAtTime(900, t + 0.4);
    filter.frequency.exponentialRampToValueAtTime(150, t + 1.4);
    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.frequency.setValueAtTime(70, t);
    growl.frequency.linearRampToValueAtTime(95, t + 0.4);
    growl.frequency.exponentialRampToValueAtTime(45, t + 1.4);
    const env = envelope(ctx, t, 0.5, 0.15, 1.3);
    growl.connect(filter);
    this.noiseSource(t, 1.5)?.connect(filter);
    filter.connect(env).connect(out);
    growl.start(t);
    growl.stop(t + 1.5);
  }

  /** Un clic de botón de la interfaz. */
  click(): void {
    const ctx = this.engine.ctx;
    const out = this.output({ gain: 1, pan: 0 }, 0.05);
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.04);
    osc.connect(envelope(ctx, t, 0.12, 0.001, 0.06)).connect(out);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Remate de victoria o derrota: un arpegio que sube o que cae. */
  fanfare(win: boolean): void {
    const notes: readonly ElementId[] = win
      ? ['raiz', 'marea', 'tormenta', 'brasa']
      : ['brasa', 'umbra', 'raiz', 'umbra'];
    notes.forEach((element, i) => {
      this.note(element, CENTER, {
        delay: i * (win ? 0.14 : 0.22),
        length: i === notes.length - 1 ? 4 : 1.6,
        level: 0.22,
        octave: win && i === notes.length - 1 ? 2 : 1,
      });
    });
  }

  private noiseSource(t: number, duration: number): AudioBufferSourceNode | null {
    const ctx = this.engine.ctx;
    const buffer = this.engine.noiseBuffer;
    if (!ctx || !buffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start(t, Math.random() * 1.5);
    source.stop(t + duration + 0.05);
    return source;
  }

  private noiseHit(
    out: AudioNode,
    t: number,
    level: number,
    freq: number,
    length: number,
    type: BiquadFilterType,
  ): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    this.noiseSource(t, length)
      ?.connect(filter)
      .connect(envelope(ctx, t, level, 0.002, length))
      .connect(out);
  }
}

export interface NoteOptions {
  readonly octave?: number;
  /** Multiplica la duración natural de la nota. */
  readonly length?: number;
  readonly level?: number;
  readonly delay?: number;
  readonly bus?: 'sfx' | 'music';
}

/** Una envolvente: sube en `attack` y se apaga en `release` (exponencial). */
function envelope(
  ctx: AudioContext,
  t: number,
  level: number,
  attack: number,
  release: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return gain;
}
