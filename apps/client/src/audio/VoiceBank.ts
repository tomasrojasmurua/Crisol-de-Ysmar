import type { AudioEngine } from './AudioEngine';

const MANIFEST_URL = 'audio/manifest.json';
/** Si un archivo tarda más que esto en llegar, la frase ya no viene al caso y no suena. */
const STALE_MS = 2500;
/** Cuántas frases pueden esperar turno detrás de la que suena. */
const QUEUE_MAX = 2;

/**
 * Las voces: el Crisol y los maestros. Cada frase es un archivo con clave `voice.…` en
 * `public/audio/manifest.json` (ver `docs/audio-voces.md`). Sin archivo no suena nada: a
 * diferencia de los efectos, las voces no tienen versión sintetizada.
 *
 * Suena una a la vez. Las del Crisol se cargan al primer toque, porque acompañan momentos de la
 * partida; las de los maestros se piden cuando hacen falta.
 */
export class VoiceBank {
  private readonly files = new Map<string, string>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private current: AudioBufferSourceNode | null = null;
  private readonly queue: string[] = [];

  constructor(private readonly engine: AudioEngine) {
    void this.readManifest();
    engine.onReady(() => this.preload());
  }

  /** Hay archivo para esta frase (cargado o no). */
  has(key: string): boolean {
    return this.files.has(key);
  }

  /**
   * Dice la frase. Con `after`, espera a que termine la que suena; si no, la corta. Devuelve
   * false si no hay archivo.
   */
  say(key: string, after = false): boolean {
    if (!this.files.has(key)) return false;
    if (after && this.current) {
      if (this.queue.length < QUEUE_MAX) this.queue.push(key);
      return true;
    }
    this.queue.length = 0;
    this.stop();
    const asked = Date.now();
    void this.load(key).then((buffer) => {
      if (buffer && Date.now() - asked < STALE_MS) this.start(buffer);
    });
    return true;
  }

  private start(buffer: AudioBuffer): void {
    const ctx = this.engine.ctx;
    const dest = this.engine.sfx;
    if (!ctx || !dest) return;
    this.stop();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);
    source.onended = () => {
      if (this.current !== source) return;
      this.current = null;
      const next = this.queue.shift();
      if (next) this.say(next);
    };
    this.current = source;
    source.start();
  }

  private stop(): void {
    const source = this.current;
    this.current = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Ya había terminado.
    }
  }

  private preload(): void {
    for (const key of this.files.keys()) if (key.startsWith('voice.crisol.')) void this.load(key);
  }

  private load(key: string): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(key);
    if (ready) return Promise.resolve(ready);
    const pending = this.loading.get(key);
    if (pending) return pending;
    const url = this.files.get(key);
    const ctx = this.engine.ctx;
    if (!url || !ctx) return Promise.resolve(null);
    const promise = (async () => {
      try {
        const response = await fetch(url);
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(key, buffer);
        return buffer;
      } catch {
        // Un archivo roto no detiene el juego: esa frase no suena.
        return null;
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, promise);
    return promise;
  }

  private async readManifest(): Promise<void> {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!response.ok) return;
      const manifest = (await response.json()) as Record<string, unknown>;
      for (const [key, file] of Object.entries(manifest)) {
        if (key.startsWith('voice.') && typeof file === 'string' && file) {
          this.files.set(key, `audio/${file}`);
        }
      }
      if (this.engine.ctx) this.preload();
    } catch {
      // Sin manifiesto: no hay voces.
    }
  }
}
