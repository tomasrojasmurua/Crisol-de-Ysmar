import type { ElementId } from '@crisol/core';

/** Una opción del Vestidor: todas son cosméticas, ninguna cambia el poder. */
export interface LookOption {
  readonly id: string;
  readonly name: string;
  /** Color en hexadecimal, cuando la opción es un color. */
  readonly color?: string;
  /** Rostros con los que se puede combinar; sin la lista, va con todos. */
  readonly faces?: readonly string[];
}

/** Colores de túnica: apagados, para que la magia sea lo único intenso. */
export const ROBE_COLORS: readonly LookOption[] = [
  { id: 'ceniza', name: 'Ceniza', color: '#3d3833' },
  { id: 'noche', name: 'Noche', color: '#252a40' },
  { id: 'vino', name: 'Vino', color: '#47222b' },
  { id: 'musgo', name: 'Musgo', color: '#2c3a29' },
  { id: 'hueso', name: 'Hueso', color: '#7a7264' },
  { id: 'oxido', name: 'Óxido', color: '#55331f' },
  { id: 'azafran', name: 'Azafrán', color: '#9a5a1c' },
  { id: 'carbon', name: 'Carbón', color: '#171719' },
  { id: 'lino', name: 'Lino', color: '#a39a86' },
  { id: 'pantano', name: 'Pantano', color: '#3a4128' },
  { id: 'abismo', name: 'Abismo', color: '#1d1530' },
  { id: 'sangre', name: 'Sangre seca', color: '#5a1a1a' },
];

/** Colores de los adornos: faja, garra del báculo y bordes. */
export const TRIM_COLORS: readonly LookOption[] = [
  { id: 'oro', name: 'Oro', color: '#c9a45c' },
  { id: 'plata', name: 'Plata', color: '#b9c2cc' },
  { id: 'cobre', name: 'Cobre', color: '#b8693c' },
  { id: 'jade', name: 'Jade', color: '#4fa58a' },
  { id: 'amatista', name: 'Amatista', color: '#8e6cc7' },
  { id: 'carmesi', name: 'Carmesí', color: '#b23a48' },
  { id: 'hierro', name: 'Hierro', color: '#5c6066' },
  { id: 'marfil', name: 'Marfil', color: '#ddd3bb' },
];

/** Piel, escamas, pelaje o plumas: el color del rostro, sea cual sea. */
export const SKIN_TONES: readonly LookOption[] = [
  { id: 'marfil', name: 'Marfil', color: '#e6c7a8' },
  { id: 'arena', name: 'Arena', color: '#c99a73' },
  { id: 'canela', name: 'Canela', color: '#a06a46' },
  { id: 'ebano', name: 'Ébano', color: '#5e3b27' },
  { id: 'ceniza', name: 'Gris ceniza', color: '#9a9a9e' },
  { id: 'escama', name: 'Escama verde', color: '#5c7a3a' },
  { id: 'cieno', name: 'Cieno', color: '#7d8a4a' },
  { id: 'lobo', name: 'Pelaje gris', color: '#6e6a66' },
  { id: 'zorro', name: 'Pelaje rojizo', color: '#b5602c' },
  { id: 'nieve', name: 'Nieve', color: '#e8e6e0' },
  { id: 'pizarra', name: 'Pizarra', color: '#4d5a6b' },
  { id: 'azabache', name: 'Azabache', color: '#232226' },
  { id: 'palido', name: 'Pálido de cripta', color: '#c8c9b8' },
  { id: 'malva', name: 'Malva', color: '#8a6a8e' },
];

/** Rostros: el linaje del hechicero. Solo cambian cómo se ve. */
export const FACES: readonly LookOption[] = [
  { id: 'humano', name: 'Humano' },
  { id: 'elfo', name: 'Orejas largas' },
  { id: 'lagarto', name: 'Lagarto' },
  { id: 'lobo', name: 'Lobo' },
  { id: 'zorro', name: 'Zorro' },
  { id: 'cuervo', name: 'Cuervo' },
  { id: 'carnero', name: 'Carnero' },
  { id: 'sapo', name: 'Sapo' },
  { id: 'calavera', name: 'Calavera' },
  { id: 'automata', name: 'Autómata' },
];

/** La ropa: cambia la silueta del cuerpo. */
export const OUTFITS: readonly LookOption[] = [
  { id: 'tunica', name: 'Túnica' },
  { id: 'habito', name: 'Hábito de monje' },
  { id: 'bruja', name: 'Vestido de bruja' },
  { id: 'sectario', name: 'Manto de secta' },
  { id: 'chaman', name: 'Pieles de chamán' },
  { id: 'armadura', name: 'Coraza arcana' },
  { id: 'harapos', name: 'Harapos de ermitaño' },
  { id: 'gala', name: 'Cuello alto' },
];

export const HEADWEAR: readonly LookOption[] = [
  { id: 'capucha', name: 'Capucha honda' },
  { id: 'abierta', name: 'Capucha abierta' },
  { id: 'sombrero', name: 'Sombrero' },
  { id: 'bruja', name: 'Sombrero torcido' },
  { id: 'diadema', name: 'Diadema' },
  { id: 'cresta', name: 'Gorro de cresta' },
  { id: 'turbante', name: 'Turbante' },
  { id: 'corona', name: 'Corona de hueso' },
  { id: 'yelmo', name: 'Yelmo' },
  { id: 'tocado', name: 'Tocado de plumas' },
  { id: 'ninguno', name: 'Nada' },
];

/** Lo que va en el rostro. La barba y el bigote solo crecen en algunos linajes. */
export const MASKS: readonly LookOption[] = [
  { id: 'ninguno', name: 'Nada' },
  { id: 'barba', name: 'Barba larga', faces: ['humano', 'elfo', 'carnero'] },
  { id: 'bigote', name: 'Bigote', faces: ['humano', 'elfo'] },
  { id: 'hueso', name: 'Máscara de hueso' },
  { id: 'velo', name: 'Velo' },
  { id: 'pintura', name: 'Runas pintadas' },
  { id: 'vendas', name: 'Vendas' },
];

export const CAPES: readonly LookOption[] = [
  { id: 'ninguna', name: 'Sin capa' },
  { id: 'corta', name: 'Capa corta' },
  { id: 'larga', name: 'Capa larga' },
  { id: 'harapienta', name: 'Capa raída' },
];

export const FOCI: readonly LookOption[] = [
  { id: 'baculo', name: 'Báculo' },
  { id: 'cetro', name: 'Cetro' },
  { id: 'orbe', name: 'Orbe' },
  { id: 'grimorio', name: 'Grimorio' },
  { id: 'linterna', name: 'Linterna' },
  { id: 'hoz', name: 'Hoz' },
  { id: 'cuenco', name: 'Cuenco' },
  { id: 'varita', name: 'Varita' },
];

/** Todas las piezas que elige el jugador, por id. */
export interface LookIds {
  readonly robe: string;
  readonly trim: string;
  readonly skin: string;
  readonly face: string;
  readonly outfit: string;
  readonly headwear: string;
  readonly mask: string;
  readonly cape: string;
  readonly focus: string;
}

export const DEFAULT_LOOK: LookIds = {
  robe: 'ceniza',
  trim: 'oro',
  skin: 'arena',
  face: 'humano',
  outfit: 'tunica',
  headwear: 'capucha',
  mask: 'ninguno',
  cape: 'ninguna',
  focus: 'baculo',
};

/** Las opciones de cada pieza, para validar y para elegir al azar. */
export const LOOK_OPTIONS: Readonly<Record<keyof LookIds, readonly LookOption[]>> = {
  robe: ROBE_COLORS,
  trim: TRIM_COLORS,
  skin: SKIN_TONES,
  face: FACES,
  outfit: OUTFITS,
  headwear: HEADWEAR,
  mask: MASKS,
  cape: CAPES,
  focus: FOCI,
};

/** Si una opción se puede usar con ese rostro. */
export function fitsFace(option: LookOption, face: string): boolean {
  return !option.faces || option.faces.includes(face);
}

/**
 * Deja un aspecto válido: cada pieza existe y combina con el rostro. Lo que no, vuelve al
 * valor por defecto. Sirve para lo guardado en el celular y para lo que llega por la red.
 */
export function cleanLook(raw: unknown): LookIds {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof LookIds): string => {
    const value = source[key];
    return LOOK_OPTIONS[key].some((o) => o.id === value) ? (value as string) : DEFAULT_LOOK[key];
  };
  const look = {
    robe: pick('robe'),
    trim: pick('trim'),
    skin: pick('skin'),
    face: pick('face'),
    outfit: pick('outfit'),
    headwear: pick('headwear'),
    mask: pick('mask'),
    cape: pick('cape'),
    focus: pick('focus'),
  };
  const mask = MASKS.find((m) => m.id === look.mask);
  if (mask && !fitsFace(mask, look.face)) look.mask = DEFAULT_LOOK.mask;
  return look;
}

/** Hechiceros armados de una vez: un punto de partida para cambiar lo que quieras. */
export interface Archetype {
  readonly id: string;
  readonly name: string;
  readonly look: LookIds;
}

export const ARCHETYPES: readonly Archetype[] = [
  { id: 'clasico', name: 'Hechicero', look: DEFAULT_LOOK },
  {
    id: 'bruja',
    name: 'Bruja del pantano',
    look: {
      robe: 'pantano',
      trim: 'jade',
      skin: 'cieno',
      face: 'humano',
      outfit: 'bruja',
      headwear: 'bruja',
      mask: 'ninguno',
      cape: 'harapienta',
      focus: 'cuenco',
    },
  },
  {
    id: 'monje',
    name: 'Monje de la cumbre',
    look: {
      robe: 'azafran',
      trim: 'carmesi',
      skin: 'canela',
      face: 'humano',
      outfit: 'habito',
      headwear: 'cresta',
      mask: 'ninguno',
      cape: 'ninguna',
      focus: 'cuenco',
    },
  },
  {
    id: 'sectario',
    name: 'Sectario del abismo',
    look: {
      robe: 'abismo',
      trim: 'carmesi',
      skin: 'palido',
      face: 'humano',
      outfit: 'sectario',
      headwear: 'capucha',
      mask: 'hueso',
      cape: 'larga',
      focus: 'hoz',
    },
  },
  {
    id: 'lagarto',
    name: 'Mago lagarto',
    look: {
      robe: 'vino',
      trim: 'oro',
      skin: 'escama',
      face: 'lagarto',
      outfit: 'tunica',
      headwear: 'sombrero',
      mask: 'ninguno',
      cape: 'corta',
      focus: 'baculo',
    },
  },
  {
    id: 'lobo',
    name: 'Brujo lobo',
    look: {
      robe: 'oxido',
      trim: 'marfil',
      skin: 'lobo',
      face: 'lobo',
      outfit: 'chaman',
      headwear: 'abierta',
      mask: 'pintura',
      cape: 'harapienta',
      focus: 'orbe',
    },
  },
  {
    id: 'carnero',
    name: 'Chamán carnero',
    look: {
      robe: 'hueso',
      trim: 'cobre',
      skin: 'nieve',
      face: 'carnero',
      outfit: 'chaman',
      headwear: 'tocado',
      mask: 'barba',
      cape: 'ninguna',
      focus: 'linterna',
    },
  },
  {
    id: 'nigromante',
    name: 'Nigromante',
    look: {
      robe: 'carbon',
      trim: 'amatista',
      skin: 'palido',
      face: 'calavera',
      outfit: 'gala',
      headwear: 'corona',
      mask: 'ninguno',
      cape: 'larga',
      focus: 'grimorio',
    },
  },
  {
    id: 'automata',
    name: 'Autómata errante',
    look: {
      robe: 'ceniza',
      trim: 'cobre',
      skin: 'pizarra',
      face: 'automata',
      outfit: 'armadura',
      headwear: 'ninguno',
      mask: 'ninguno',
      cape: 'corta',
      focus: 'cetro',
    },
  },
  {
    id: 'cuervo',
    name: 'Cuervo vidente',
    look: {
      robe: 'carbon',
      trim: 'plata',
      skin: 'azabache',
      face: 'cuervo',
      outfit: 'harapos',
      headwear: 'ninguno',
      mask: 'vendas',
      cape: 'harapienta',
      focus: 'varita',
    },
  },
  {
    id: 'zorro',
    name: 'Zorro peregrino',
    look: {
      robe: 'lino',
      trim: 'oro',
      skin: 'zorro',
      face: 'zorro',
      outfit: 'tunica',
      headwear: 'turbante',
      mask: 'ninguno',
      cape: 'corta',
      focus: 'linterna',
    },
  },
  {
    id: 'sapo',
    name: 'Sapo alquimista',
    look: {
      robe: 'musgo',
      trim: 'cobre',
      skin: 'cieno',
      face: 'sapo',
      outfit: 'harapos',
      headwear: 'sombrero',
      mask: 'ninguno',
      cape: 'ninguna',
      focus: 'cuenco',
    },
  },
  {
    id: 'elfo',
    name: 'Tejedora de la Trama',
    look: {
      robe: 'noche',
      trim: 'plata',
      skin: 'marfil',
      face: 'elfo',
      outfit: 'gala',
      headwear: 'diadema',
      mask: 'pintura',
      cape: 'larga',
      focus: 'cetro',
    },
  },
];

/** Cómo transforma la Afinidad al hechicero (del documento de diseño). */
export const AFFINITY_LOOKS: Record<ElementId, string> = {
  brasa: 'Grietas incandescentes, túnica humeante y brasas que caen al caminar.',
  tormenta: 'Runas que chisporrotean, ojos brillantes y un aire que nunca se calma.',
  marea: 'Escarcha en el rostro, ropa empapada y aliento visible de frío.',
  raiz: 'Corteza y musgo, astas que brotan y flores a tu paso.',
  umbra: 'Un cuerpo que se deshace en humo, ojos huecos y una sombra propia.',
};
