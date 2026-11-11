import { el } from './dom';

/** Versiones anteriores guardaban aquí si el medidor quedaba encendido; se borra al abrir. */
const LEGACY_STORAGE_KEY = 'crisol.fps';
/** Cada cuánto se refresca la cifra: más seguido haría ilegible el número. */
const WINDOW_MS = 500;

/**
 * Medidor de rendimiento: cuadros por segundo y el cuadro más lento de cada medio segundo
 * (los tirones se notan en el peor cuadro, no en el promedio). Siempre empieza apagado: solo se
 * enciende en Pausa → "Mostrar datos de rendimiento", y no se guarda: al volver a abrir el juego
 * está apagado otra vez.
 */
export class FpsMeter {
  private readonly root: HTMLElement;
  private frames = 0;
  private spentMs = 0;
  private worstMs = 0;
  private on = false;

  constructor(parent: HTMLElement) {
    forgetLegacySetting();
    this.root = el('div', 'fps-meter');
    this.root.hidden = true;
    parent.append(this.root);
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(value: boolean) {
    this.on = value;
    this.root.hidden = !value;
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

function forgetLegacySetting(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}
