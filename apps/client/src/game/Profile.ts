import {
  FOCI,
  HEADWEAR,
  type LookOption,
  ROBE_COLORS,
  SKIN_TONES,
  TRIM_COLORS,
} from '@crisol/content';
import { type ElementId, isElementId, type SeededRng } from '@crisol/core';

/** Cómo se ve un hechicero: solo cosmético. */
export interface Appearance {
  readonly robe: string;
  readonly trim: string;
  readonly skin: string;
  readonly headwear: string;
  readonly focus: string;
}

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
  look: { robe: 'ceniza', trim: 'oro', skin: 'arena', headwear: 'capucha', focus: 'baculo' },
  affinity: null,
};

const pickId = (options: readonly LookOption[], id: unknown, fallback: string): string =>
  options.some((o) => o.id === id) ? (id as string) : fallback;

/** Limpia un nombre: sin espacios de más y con largo máximo. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}

export function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<{
      name: unknown;
      look: Partial<Record<keyof Appearance, unknown>>;
      affinity: unknown;
    }>;
    const look = saved.look ?? {};
    const base = DEFAULT_PROFILE.look;
    return {
      name: typeof saved.name === 'string' ? cleanName(saved.name) : '',
      look: {
        robe: pickId(ROBE_COLORS, look.robe, base.robe),
        trim: pickId(TRIM_COLORS, look.trim, base.trim),
        skin: pickId(SKIN_TONES, look.skin, base.skin),
        headwear: pickId(HEADWEAR, look.headwear, base.headwear),
        focus: pickId(FOCI, look.focus, base.focus),
      },
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

/** Un aspecto al azar para los hechiceros de la IA. */
export function randomAppearance(rng: SeededRng): Appearance {
  const any = (options: readonly LookOption[]): string =>
    options[rng.int(0, options.length - 1)]?.id ?? '';
  return {
    robe: any(ROBE_COLORS),
    trim: any(TRIM_COLORS),
    skin: any(SKIN_TONES),
    headwear: any(HEADWEAR),
    focus: any(FOCI),
  };
}

/** El color de una opción del Vestidor. */
export function lookColor(options: readonly LookOption[], id: string): string {
  return options.find((o) => o.id === id)?.color ?? options[0]?.color ?? '#808080';
}
