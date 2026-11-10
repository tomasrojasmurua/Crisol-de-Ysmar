import type { QualityName } from '../game/MatchPerfLog';

const STORAGE_KEY = 'crisol.calidad';

/**
 * Calidad gráfica elegida en Pausa. "Liviana" apaga lo que más cuesta en un celular: sombras,
 * luces de los braseros, resplandor, corrección de color y estelas. Queda guardada.
 */
export function readQuality(): QualityName {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'liviana' ? 'liviana' : 'alta';
  } catch {
    return 'alta';
  }
}

export function saveQuality(quality: QualityName): void {
  try {
    if (quality === 'liviana') localStorage.setItem(STORAGE_KEY, 'liviana');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento: vale solo por esta vez.
  }
}
