import type { ModsPatch } from '@crisol/core';

/** Un Glifo: se elige entre rondas y cambia cómo funcionan tus combinaciones. */
export interface Glyph {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Elemento al que se asocia, para el color de la carta; null si es general. */
  readonly element: 'brasa' | 'tormenta' | 'marea' | 'raiz' | 'umbra' | null;
  readonly mods: ModsPatch;
}

export const GLYPHS: readonly Glyph[] = [
  {
    id: 'eco-triple',
    name: 'Eco de tres hilos',
    description: 'Tus conjuros de 3 elementos hacen 25% más de daño.',
    element: null,
    mods: { damageByLength: [1, 1, 1.25] },
  },
  {
    id: 'mano-ligera',
    name: 'Mano ligera',
    description: 'Tus conjuros de 1 elemento hacen 20% más de daño.',
    element: null,
    mods: { damageByLength: [1.2, 1, 1] },
  },
  {
    id: 'tejido-veloz',
    name: 'Tejido veloz',
    description: 'Canalizas un 30% más rápido.',
    element: null,
    mods: { castTime: 0.7 },
  },
  {
    id: 'respiro',
    name: 'Respiro',
    description: 'Todos tus elementos descansan un 20% menos.',
    element: null,
    mods: {
      fatigue: { brasa: 0.8, tormenta: 0.8, marea: 0.8, raiz: 0.8, umbra: 0.8 },
    },
  },
  {
    id: 'piel-de-piedra',
    name: 'Piel de piedra',
    description: '15% más de vida máxima.',
    element: null,
    mods: { maxHp: 1.15 },
  },
  {
    id: 'brasa-hambrienta',
    name: 'Brasa hambrienta',
    description:
      'Tus hechizos que empiezan con Brasa hacen 20% más y tus quemaduras duran el doble.',
    element: 'brasa',
    mods: { formDamage: { projectile: 1.2 }, statusDuration: { burn: 2 } },
  },
  {
    id: 'viento-a-favor',
    name: 'Viento a favor',
    description: 'Te mueves 12% más rápido y tus hechizos que empiezan con Tormenta hacen 30% más.',
    element: 'tormenta',
    mods: { moveSpeed: 1.12, formDamage: { leap: 1.3 } },
  },
  {
    id: 'marea-alta',
    name: 'Marea alta',
    description:
      'Tus hechizos que empiezan con Marea hacen 40% más y tus ralentizaciones duran 50% más.',
    element: 'marea',
    mods: { formDamage: { wall: 1.4 }, statusDuration: { slow: 1.5 } },
  },
  {
    id: 'raiz-profunda',
    name: 'Raíz profunda',
    description: 'Tus hechizos que empiezan con Raíz hacen 30% más y enraízan 50% más tiempo.',
    element: 'raiz',
    mods: { formDamage: { trap: 1.3 }, statusDuration: { root: 1.5 } },
  },
  {
    id: 'sed-de-umbra',
    name: 'Sed de Umbra',
    description: 'Te curas con el 12% del daño que haces.',
    element: 'umbra',
    mods: { lifesteal: 0.12 },
  },
];

/** Un Presagio: cambia la partida entera, para todos por igual. */
export interface Omen {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly element: Glyph['element'];
  readonly mods: ModsPatch;
}

export const OMENS: readonly Omen[] = [
  {
    id: 'luna-de-umbra',
    name: 'Luna de Umbra',
    description: 'Todos se curan con el 10% del daño que hacen.',
    element: 'umbra',
    mods: { lifesteal: 0.1 },
  },
  {
    id: 'tormenta-eterna',
    name: 'Tormenta eterna',
    description:
      'Todos se mueven 15% más rápido y los hechizos que empiezan con Tormenta pegan más.',
    element: 'tormenta',
    mods: { moveSpeed: 1.15, formDamage: { leap: 1.25 } },
  },
  {
    id: 'cielo-de-ceniza',
    name: 'Cielo de ceniza',
    description: 'Las quemaduras duran el doble.',
    element: 'brasa',
    mods: { statusDuration: { burn: 2 } },
  },
  {
    id: 'bruma-espesa',
    name: 'Bruma espesa',
    description: 'Ralentizar y enraizar dura 40% más.',
    element: 'marea',
    mods: { statusDuration: { slow: 1.4, root: 1.4 } },
  },
  {
    id: 'trama-tensa',
    name: 'Trama tensa',
    description: 'Todos tejen 20% más rápido.',
    element: 'raiz',
    mods: { castTime: 0.8 },
  },
];

/** Nombre de la bestia de cada elemento, en el bestiario de Ysmar. */
/** La bestia enorme que despierta en la plaza a mitad de la Caza. */
export const GUARDIAN_NAME = 'Guardián del Crisol';

export const BEAST_NAMES = {
  brasa: 'Ascuario',
  tormenta: 'Zumbador',
  marea: 'Galápago de bruma',
  raiz: 'Musgoso',
  umbra: 'Merodeador',
} as const;
