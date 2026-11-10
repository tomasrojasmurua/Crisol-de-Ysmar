import type { AudioEngine } from './AudioEngine';
import type { Placement } from './Synth';

/**
 * Los sonidos que el juego sabe pedir. Cada uno tiene una versión sintetizada; si en
 * `public/audio/manifest.json` aparece un archivo para la clave, se usa el archivo.
 * Así los de ElevenLabs entran sin tocar código: se copia el .mp3 y se anota en el manifiesto.
 */
const SOUND_KEYS = [
  'note.brasa',
  'note.tormenta',
  'note.marea',
  'note.raiz',
  'note.umbra',
  'untie',
  'release.brasa',
  'release.tormenta',
  'release.marea',
  'release.raiz',
  'release.umbra',
  'burst.brasa',
  'burst.tormenta',
  'burst.marea',
  'burst.raiz',
  'burst.umbra',
  'zap',
  'blink',
  'vine',
  'hurt',
  'hurtHeavy',
  'confirm',
  'clang',
  'combo',
  'fizzle',
  'summonGone',
  'beastSlain',
  'guardianAwake',
  'shrinesAppear',
  'shrineClaimed',
  'defeated',
  'phase.convergence',
  'phase.final',
  'victory',
  'defeat',
  'discover',
  'click',
  'music.menu',
  'music.hunt',
  'music.convergence',
  'music.final',
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

const MANIFEST_URL = 'audio/manifest.json';

export class SoundBank {
  private readonly files = new Map<SoundKey, string>();
  private readonly buffers = new Map<SoundKey, AudioBuffer>();
  private readonly loading = new Set<SoundKey>();

  constructor(private readonly engine: AudioEngine) {
    void this.readManifest();
    engine.onReady(() => {
      for (const key of this.files.keys()) void this.load(key);
    });
  }

  /** Hay archivo listo para esta clave. */
  has(key: SoundKey): boolean {
    return this.buffers.has(key);
  }

  /** Toca el archivo de la clave si existe; devuelve false para que suene el sintetizado. */
  play(key: SoundKey, place: Placement, rate = 1): boolean {
    const buffer = this.buffers.get(key);
    const ctx = this.engine.ctx;
    const dest = this.engine.sfx;
    if (!buffer || !ctx || !dest) return false;
    if (place.gain > 0.001) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = place.gain;
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, place.pan));
      source.connect(gain).connect(panner).connect(dest);
      source.start();
    }
    return true;
  }

  /** Una pista de música en bucle, o null si no hay archivo (entonces suena la generada). */
  loop(key: SoundKey): AudioBufferSourceNode | null {
    const buffer = this.buffers.get(key);
    const ctx = this.engine.ctx;
    if (!buffer || !ctx) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  private async readManifest(): Promise<void> {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!response.ok) return;
      const manifest = (await response.json()) as Record<string, unknown>;
      for (const key of SOUND_KEYS) {
        const file = manifest[key];
        if (typeof file === 'string' && file) this.files.set(key, `audio/${file}`);
      }
      if (this.engine.ctx) for (const key of this.files.keys()) void this.load(key);
    } catch {
      // Sin manifiesto: todo suena sintetizado.
    }
  }

  private async load(key: SoundKey): Promise<void> {
    const url = this.files.get(key);
    const ctx = this.engine.ctx;
    if (!url || !ctx || this.buffers.has(key) || this.loading.has(key)) return;
    this.loading.add(key);
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      this.buffers.set(key, await ctx.decodeAudioData(data));
    } catch {
      // Un archivo roto no detiene el juego: esa clave sigue sintetizada.
    } finally {
      this.loading.delete(key);
    }
  }
}
