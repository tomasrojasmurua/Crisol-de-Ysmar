/**
 * Lo mínimo del navegador de un celular, para correr el código de red del juego en Node: la
 * visibilidad de la app, el aviso de "volvió la señal", el almacenamiento (en un archivo, para
 * sobrevivir a una recarga) y un WebSocket al que se le puede cortar la señal.
 *
 * Se importa antes que nada: `NetMatch` lee la dirección (`?lag=`) al cargarse.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const STORAGE_FILE = process.env.ALMACEN ?? '';

class FakeDocument extends EventTarget {
  hidden = false;
}

/** Como `localStorage`, guardado en un archivo propio de este celular. */
const saved: Record<string, string> =
  STORAGE_FILE && existsSync(STORAGE_FILE) ? JSON.parse(readFileSync(STORAGE_FILE, 'utf8')) : {};
const storage = {
  getItem: (key: string): string | null => saved[key] ?? null,
  setItem: (key: string, value: string): void => {
    saved[key] = value;
    if (STORAGE_FILE) writeFileSync(STORAGE_FILE, JSON.stringify(saved));
  },
  removeItem: (key: string): void => {
    delete saved[key];
  },
};

type Handler = (event: unknown) => void;
const RealSocket = globalThis.WebSocket;
/** Cuánto tarda en rendirse un intento de conexión que nunca contesta (como un celular). */
const CONNECT_GIVE_UP_MS = 60_000;

/**
 * Un WebSocket con la señal de un celular. Sin señal, los sockets abiertos quedan colgados (no
 * llega ni sale nada y nadie avisa que se cortó) y los intentos nuevos no contestan: así se ve
 * un túnel, un cambio de wifi a 4G o iOS matando la conexión en segundo plano.
 */
export class FlakySocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  /** Si hay señal ahora. */
  static online = true;
  static readonly all = new Set<FlakySocket>();

  readyState = 0;
  binaryType = 'arraybuffer';
  /** Colgado para siempre: lo que se manda se pierde y no avisa que se cortó. */
  zombie = false;
  private real: WebSocket | null = null;
  private readonly handlers = new Map<string, Handler[]>();
  private giveUp: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly url: string) {
    FlakySocket.all.add(this);
    if (FlakySocket.online) this.dial();
    else this.giveUp = setTimeout(() => this.fail(), CONNECT_GIVE_UP_MS);
  }

  private dial(): void {
    const real = new RealSocket(this.url);
    real.binaryType = 'arraybuffer';
    this.real = real;
    real.addEventListener('open', () => {
      if (this.zombie || this.readyState !== 0) return;
      this.readyState = 1;
      this.emit('open', {});
    });
    real.addEventListener('message', (event) => {
      if (!this.zombie && this.readyState === 1) this.emit('message', { data: event.data });
    });
    real.addEventListener('close', (event) => {
      if (this.zombie || this.readyState === 3) return;
      this.readyState = 3;
      FlakySocket.all.delete(this);
      this.emit('close', { code: event.code });
    });
  }

  /** Un intento que nunca contestó: el sistema se rinde. */
  private fail(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    FlakySocket.all.delete(this);
    this.emit('close', { code: 1006 });
  }

  /** Se corta la señal: este socket queda colgado sin avisar. */
  hang(): void {
    if (this.readyState === 3) return;
    this.zombie = true;
    if (this.readyState === 0 && !this.giveUp) {
      this.giveUp = setTimeout(() => this.fail(), CONNECT_GIVE_UP_MS);
    }
  }

  addEventListener(type: string, handler: Handler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('El socket no está abierto');
    if (!this.zombie) this.real?.send(data);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState >= 2) return;
    const wasConnecting = this.readyState === 0;
    this.readyState = 2;
    if (this.giveUp) clearTimeout(this.giveUp);
    if (this.zombie || wasConnecting) {
      // Colgado: el navegador no recibe respuesta al cierre y avisa tarde; si aún conectaba, ya.
      try {
        this.real?.close(code, reason);
      } catch {}
      setTimeout(() => this.fail(), wasConnecting ? 0 : 20_000);
      return;
    }
    this.real?.close(code, reason);
  }

  private emit(type: string, event: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
}

/** Se corta la señal de este celular. */
export function signalLost(): void {
  FlakySocket.online = false;
  for (const socket of FlakySocket.all) socket.hang();
}

/**
 * Vuelve la señal. Si el sistema se dio cuenta de que se había ido (modo avión, sin antena),
 * avisa con el evento "online"; en un túnel o con la señal colgada, no avisa nada.
 */
export function signalBack(announce: boolean): void {
  FlakySocket.online = true;
  if (announce) globalThis.window.dispatchEvent(new Event('online'));
}

/** iOS mata la conexión en segundo plano sin avisar. */
export function killSockets(): void {
  for (const socket of FlakySocket.all) socket.hang();
}

/** Sale de la app o vuelve a ella. */
export function setHidden(hidden: boolean): void {
  doc.hidden = hidden;
  doc.dispatchEvent(new Event('visibilitychange'));
}

const doc = new FakeDocument();
Object.assign(globalThis, {
  document: doc,
  window: new EventTarget(),
  localStorage: storage,
  WebSocket: FlakySocket,
  location: { search: process.env.DIRECCION ?? '' },
});
