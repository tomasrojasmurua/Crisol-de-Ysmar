import {
  cleanLook,
  DEFAULT_LOOK,
  fitsFace,
  LOOK_OPTIONS,
  type LookIds,
  type LookOption,
} from '@crisol/content';
import { type ElementId, isElementId, type SeededRng } from '@crisol/core';

/** Cómo se ve un hechicero: solo cosmético. */
export type Appearance = LookIds;

/** Lo que el jugador elige y queda guardado en este celular. */
export interface Profile {
  readonly name: string;
  readonly look: Appearance;
  readonly affinity: ElementId | null;
}

const STORAGE_KEY = 'crisol.perfil';
export const NAME_MAX_LENGTH = 14;

export const DEFAULT_PROFILE: Profile = {
  name: '',
  look: DEFAULT_LOOK,
  affinity: null,
};

/** Limpia un nombre: sin espacios de más y con largo máximo. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}

export function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<{
      name: unknown;
      look: unknown;
      affinity: unknown;
    }>;
    return {
      name: typeof saved.name === 'string' ? cleanName(saved.name) : '',
      // Los perfiles de antes no tienen rostro, ropa, máscara ni capa: quedan los de siempre.
      look: cleanLook(saved.look),
      affinity:
        typeof saved.affinity === 'string' && isElementId(saved.affinity) ? saved.affinity : null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Sin almacenamiento: el perfil dura solo esta visita.
  }
}

/** Un aspecto al azar que respeta las combinaciones (para la IA y el botón "Al azar"). */
export function randomAppearance(rng: SeededRng): Appearance {
  const any = (options: readonly LookOption[]): string =>
    options[rng.int(0, options.length - 1)]?.id ?? '';
  const face = any(LOOK_OPTIONS.face);
  return {
    robe: any(LOOK_OPTIONS.robe),
    trim: any(LOOK_OPTIONS.trim),
    skin: any(LOOK_OPTIONS.skin),
    face,
    outfit: any(LOOK_OPTIONS.outfit),
    headwear: any(LOOK_OPTIONS.headwear),
    mask: any(LOOK_OPTIONS.mask.filter((m) => fitsFace(m, face))),
    cape: any(LOOK_OPTIONS.cape),
    focus: any(LOOK_OPTIONS.focus),
  };
}

/** El color de una opción del Vestidor. */
export function lookColor(options: readonly LookOption[], id: string): string {
  return options.find((o) => o.id === id)?.color ?? options[0]?.color ?? '#808080';
}
