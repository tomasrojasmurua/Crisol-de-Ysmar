/**
 * Modos de cámara para probar con amigos (Pausa → Cámara). Cuando se decida cuál queda, los
 * demás se pueden borrar.
 * - fija: solo se centra en lo que tocas para fijar.
 * - asistida: como la fija, más flechas hacia los rivales fuera de pantalla, aviso de golpes
 *   desde fuera de cuadro y centrado suave al disparar sin arrastrar.
 * - seguimiento: sigue sola al blanco del disparo, pero despacio y solo cuando está por salirse
 *   de la pantalla.
 */
export type CameraMode = 'fija' | 'asistida' | 'seguimiento';

export const CAMERA_MODES: readonly {
  readonly id: CameraMode;
  readonly label: string;
  readonly detail: string;
}[] = [
  { id: 'fija', label: 'Fija', detail: 'Solo se centra en lo que tocas para fijar.' },
  {
    id: 'asistida',
    label: 'Asistida',
    detail: 'Flechas hacia rivales fuera de pantalla, aviso de golpes y se centra al disparar.',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento',
    detail: 'Sigue sola a tu blanco, despacio, cuando está por salirse de la pantalla.',
  },
];

const STORAGE_KEY = 'crisol.camara';

export function readCameraMode(): CameraMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CAMERA_MODES.some((mode) => mode.id === saved) ? (saved as CameraMode) : 'fija';
  } catch {
    return 'fija';
  }
}

export function saveCameraMode(mode: CameraMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Sin almacenamiento: vale solo por esta vez.
  }
}
