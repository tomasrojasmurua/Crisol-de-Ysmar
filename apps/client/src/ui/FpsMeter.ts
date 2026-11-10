import { el } from './dom';

const STORAGE_KEY = 'crisol.fps';
/** Cada cuánto se refresca la cifra: más seguido haría ilegible el número. */
const WINDOW_MS = 500;

/**
 * Medidor de rendimiento: cuadros por segundo y el cuadro más lento de cada medio segundo
 * (los tirones se notan en el peor cuadro, no en el promedio). Apagado por defecto: se
 * enciende en Pausa → "Mostrar datos de rendimiento" (o con `?fps=1`) y queda guardado.
 */
export class FpsMeter {
  private readonly root: HTMLElement;
  private frames = 0;
  private spentMs = 0;
  private worstMs = 0;
  private on: boolean;

  constructor(parent: HTMLElement) {
    this.on = readSetting();
    this.root = el('div', 'fps-meter');
    this.root.hidden = !this.on;
    parent.append(this.root);
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(value: boolean) {
    this.on = value;
    this.root.hidden = !value;
    try {
      if (value) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento: vale solo por esta vez.
    }
  }

  sample(frameMs: number): void {
    if (!this.on) return;
    this.frames++;
    this.spentMs += frameMs;
    this.worstMs = Math.max(this.worstMs, frameMs);
    if (this.spentMs < WINDOW_MS) return;
    const fps = Math.round((this.frames * 1000) / this.spentMs);
    this.root.textContent = `${fps} fps · peor ${Math.round(this.worstMs)} ms`;
    this.root.classList.toggle('slow', fps < 50);
    this.frames = 0;
    this.spentMs = 0;
    this.worstMs = 0;
  }
}

function readSetting(): boolean {
  try {
    const asked = new URLSearchParams(location.search).get('fps');
    if (asked === '1') localStorage.setItem(STORAGE_KEY, '1');
    if (asked === '0') localStorage.removeItem(STORAGE_KEY);
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
