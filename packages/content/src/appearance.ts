import type { ElementId } from '@crisol/core';

/** Una opción del Vestidor: todas son cosméticas, ninguna cambia el poder. */
export interface LookOption {
  readonly id: string;
  readonly name: string;
  /** Color en hexadecimal, cuando la opción es un color. */
  readonly color?: string;
}

/** Colores de túnica: apagados, para que la magia sea lo único intenso. */
export const ROBE_COLORS: readonly LookOption[] = [
  { id: 'ceniza', name: 'Ceniza', color: '#3d3833' },
  { id: 'noche', name: 'Noche', color: '#252a40' },
  { id: 'vino', name: 'Vino', color: '#47222b' },
  { id: 'musgo', name: 'Musgo', color: '#2c3a29' },
  { id: 'hueso', name: 'Hueso', color: '#7a7264' },
  { id: 'oxido', name: 'Óxido', color: '#55331f' },
];

/** Colores de los adornos: faja, garra del báculo y bordes. */
export const TRIM_COLORS: readonly LookOption[] = [
  { id: 'oro', name: 'Oro', color: '#c9a45c' },
  { id: 'plata', name: 'Plata', color: '#b9c2cc' },
  { id: 'cobre', name: 'Cobre', color: '#b8693c' },
  { id: 'jade', name: 'Jade', color: '#4fa58a' },
  { id: 'amatista', name: 'Amatista', color: '#8e6cc7' },
  { id: 'carmesi', name: 'Carmesí', color: '#b23a48' },
];

export const SKIN_TONES: readonly LookOption[] = [
  { id: 'marfil', name: 'Marfil', color: '#e6c7a8' },
  { id: 'arena', name: 'Arena', color: '#c99a73' },
  { id: 'canela', name: 'Canela', color: '#a06a46' },
  { id: 'ebano', name: 'Ébano', color: '#5e3b27' },
  { id: 'ceniza', name: 'Gris ceniza', color: '#9a9a9e' },
];

export const HEADWEAR: readonly LookOption[] = [
  { id: 'capucha', name: 'Capucha' },
  { id: 'sombrero', name: 'Sombrero' },
  { id: 'diadema', name: 'Diadema' },
];

export const FOCI: readonly LookOption[] = [
  { id: 'baculo', name: 'Báculo' },
  { id: 'cetro', name: 'Cetro' },
  { id: 'orbe', name: 'Orbe' },
];

/** Cómo transforma la Afinidad al hechicero (del documento de diseño). */
export const AFFINITY_LOOKS: Record<ElementId, string> = {
  brasa: 'Grietas incandescentes, túnica humeante y brasas que caen al caminar.',
  tormenta: 'Runas que chisporrotean, ojos brillantes y un aire que nunca se calma.',
  marea: 'Escarcha en el rostro, ropa empapada y aliento visible de frío.',
  raiz: 'Corteza y musgo, astas que brotan y flores a tu paso.',
  umbra: 'Un cuerpo que se deshace en humo, ojos huecos y una sombra propia.',
};
