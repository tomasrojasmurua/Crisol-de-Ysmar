import type { QualityName } from '../game/MatchPerfLog';
import { gpuInfo } from '../platform/gpuTier';

const STORAGE_KEY = 'crisol.calidad';

/**
 * Calidad gráfica elegida en Pausa. "Liviana" apaga lo que más cuesta en un celular: sombras,
 * luces de los braseros, resplandor, corrección de color y estelas. Queda guardada. Sin elección
 * guardada, un Android de gama media parte en Liviana (ver `platform/gpuTier.ts`).
 */
export function readQuality(): QualityName {
  const fallback: QualityName = gpuInfo().modest ? 'liviana' : 'alta';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'liviana' || saved === 'alta' ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveQuality(quality: QualityName): void {
  try {
    // Alta también se guarda: en un Android de gama media, sin guardar, volvería a Liviana.
    localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Sin almacenamiento: vale solo por esta vez.
  }
}
