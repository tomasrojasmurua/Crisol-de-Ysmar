/** Un celular o tablet: se juega con los dedos. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Orientación que acepta `screen.orientation.lock` (no todos los navegadores la tipan). */
interface LockableOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

/**
 * Pantalla completa y horizontal fija, donde el navegador lo permite (Chrome en Android).
 * Debe llamarse dentro de un toque del jugador. En iPhone no hace nada: ahí la pantalla
 * completa llega agregando el juego a la pantalla de inicio.
 */
export function enterImmersive(): void {
  if (!isTouchDevice() || document.fullscreenElement) return;
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function') return;
  root
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape'))
    .catch(() => {
      // Si el navegador se niega, se sigue jugando igual.
    });
}

/** Lo mínimo del Wake Lock que se usa (no todos los navegadores lo tienen). */
interface WakeLockHandle {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockHandle>;
}

/**
 * Mantiene la pantalla encendida durante la partida: un duelo sin tocar el celular por unos
 * segundos (mirando, esperando la revancha) no debe apagarlo. Se vuelve a pedir al volver a la app.
 */
export class ScreenAwake {
  private handle: WakeLockHandle | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wanted) this.acquire();
    });
  }

  set active(value: boolean) {
    this.wanted = value;
    if (value) this.acquire();
    else {
      void this.handle?.release().catch(() => undefined);
      this.handle = null;
    }
  }

  private acquire(): void {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api || this.handle) return;
    api
      .request('screen')
      .then((handle) => {
        if (!this.wanted) {
          void handle.release().catch(() => undefined);
          return;
        }
        this.handle = handle;
        handle.addEventListener('release', () => {
          if (this.handle === handle) this.handle = null;
        });
      })
      .catch(() => {
        // Sin permiso (batería baja, pestaña oculta): no pasa nada.
      });
  }
}
