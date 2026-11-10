/**
 * El motor de sonido: un solo AudioContext con tres buses (efectos, música e interfaz), una
 * reverberación compartida y el interruptor de silencio. El navegador no deja sonar nada hasta
 * que el jugador toca la pantalla, así que el contexto se crea con el primer toque.
 */

const STORAGE_KEY = 'crisol.sonido';
const MASTER_GAIN = 0.9;
const SFX_GAIN = 0.85;
const MUSIC_GAIN = 0.32;
const REVERB_SECONDS = 2.2;
const REVERB_SEND = 0.22;

export interface AudioSettings {
  muted: boolean;
  music: boolean;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly listeners = new Set<() => void>();
  readonly settings: AudioSettings = { muted: false, music: true };

  constructor() {
    this.restore();
    const unlock = (): void => {
      this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // Al volver de otra app, el celular suele dejar el contexto suspendido.
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend();
      else void this.context.resume();
    });
  }

  /** Avisa cuando el contexto queda listo (por ejemplo, para arrancar la música). */
  onReady(listener: () => void): void {
    this.listeners.add(listener);
    if (this.context) listener();
  }

  /** El contexto, o null si todavía no hubo un toque o el navegador no tiene audio. */
  get ctx(): AudioContext | null {
    return this.context && this.context.state !== 'closed' ? this.context : null;
  }

  get sfx(): GainNode | null {
    return this.sfxBus;
  }

  get music(): GainNode | null {
    return this.musicBus;
  }

  get reverb(): GainNode | null {
    return this.reverbBus;
  }

  /** Dos segundos de ruido blanco, reutilizados por todos los efectos de ruido. */
  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  set muted(value: boolean) {
    this.settings.muted = value;
    this.applyGains();
    this.save();
  }

  get musicOn(): boolean {
    return this.settings.music;
  }

  set musicOn(value: boolean) {
    this.settings.music = value;
    this.applyGains();
    this.save();
  }

  private unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended' && !document.hidden) void this.context.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    let context: AudioContext;
    try {
      context = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    this.context = context;
    const master = context.createGain();
    // Un compresor suave evita que una pila de explosiones sature el parlante del celular.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 10;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(context.destination);
    this.masterBus = master;

    const sfx = context.createGain();
    sfx.connect(master);
    this.sfxBus = sfx;
    const music = context.createGain();
    music.connect(master);
    this.musicBus = music;

    const reverbIn = context.createGain();
    reverbIn.gain.value = REVERB_SEND;
    const convolver = context.createConvolver();
    convolver.buffer = impulse(context, REVERB_SECONDS);
    reverbIn.connect(convolver).connect(master);
    this.reverbBus = reverbIn;

    this.noise = whiteNoise(context, 2);
    this.applyGains();
    for (const listener of this.listeners) listener();
  }

  private applyGains(): void {
    const context = this.context;
    if (!context || !this.masterBus || !this.sfxBus || !this.musicBus) return;
    const now = context.currentTime;
    this.masterBus.gain.setTargetAtTime(this.settings.muted ? 0 : MASTER_GAIN, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(SFX_GAIN, now, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music ? MUSIC_GAIN : 0, now, 0.3);
  }

  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AudioSettings>;
      if (typeof saved.muted === 'boolean') this.settings.muted = saved.muted;
      if (typeof saved.music === 'boolean') this.settings.music = saved.music;
    } catch {
      // Sin almacenamiento: suena con los valores por defecto.
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // No es grave: solo se pierde la preferencia al cerrar.
    }
  }
}

function whiteNoise(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Una sala de piedra inventada: ruido que se apaga, un poco más largo en el canal derecho. */
function impulse(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const decay = channel === 0 ? 3.2 : 2.8;
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}
