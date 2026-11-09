import { ELEMENT_IDS, type ElementId, opposingOf } from './elements';
import { STATUS_IDS, type StatusId } from './rules';
import type { SpellForm } from './weaving/weave';

/**
 * Lo que cambia a un mago concreto: Glifos, Presagio de la partida y su Afinidad.
 * Todos los campos son multiplicadores (1 = sin cambio), salvo `lifesteal`, que se suma.
 */
export interface WizardMods {
  readonly damage: number;
  /** Daño según el largo del tejido: 1, 2 y 3 elementos. */
  readonly damageByLength: readonly [number, number, number];
  readonly formDamage: Readonly<Record<SpellForm, number>>;
  readonly castTime: number;
  readonly fatigue: Readonly<Record<ElementId, number>>;
  readonly statusDuration: Readonly<Record<StatusId, number>>;
  /** Fracción del daño hecho que cura al mago. */
  readonly lifesteal: number;
  readonly maxHp: number;
  readonly moveSpeed: number;
}

/** Un cambio parcial, como lo escribe una tabla de Glifos o Presagios. */
export interface ModsPatch {
  readonly damage?: number;
  readonly damageByLength?: readonly [number, number, number];
  readonly formDamage?: Partial<Record<SpellForm, number>>;
  readonly castTime?: number;
  readonly fatigue?: Partial<Record<ElementId, number>>;
  readonly statusDuration?: Partial<Record<StatusId, number>>;
  readonly lifesteal?: number;
  readonly maxHp?: number;
  readonly moveSpeed?: number;
}

const FORMS: readonly SpellForm[] = ['projectile', 'wall', 'trap', 'leap', 'mark'];

function ones<K extends string>(keys: readonly K[]): Record<K, number> {
  const record = {} as Record<K, number>;
  for (const key of keys) record[key] = 1;
  return record;
}

export const NEUTRAL_MODS: WizardMods = {
  damage: 1,
  damageByLength: [1, 1, 1],
  formDamage: ones(FORMS),
  castTime: 1,
  fatigue: ones(ELEMENT_IDS),
  statusDuration: ones(STATUS_IDS),
  lifesteal: 0,
  maxHp: 1,
  moveSpeed: 1,
};

/** Junta varios cambios: los multiplicadores se multiplican y el robo de vida se suma. */
export function combineMods(...patches: readonly ModsPatch[]): WizardMods {
  let mods = NEUTRAL_MODS;
  for (const patch of patches) {
    mods = {
      damage: mods.damage * (patch.damage ?? 1),
      damageByLength: [0, 1, 2].map(
        (i) => (mods.damageByLength[i] ?? 1) * (patch.damageByLength?.[i] ?? 1),
      ) as unknown as [number, number, number],
      formDamage: multiplyRecord(mods.formDamage, patch.formDamage),
      castTime: mods.castTime * (patch.castTime ?? 1),
      fatigue: multiplyRecord(mods.fatigue, patch.fatigue),
      statusDuration: multiplyRecord(mods.statusDuration, patch.statusDuration),
      lifesteal: mods.lifesteal + (patch.lifesteal ?? 0),
      maxHp: mods.maxHp * (patch.maxHp ?? 1),
      moveSpeed: mods.moveSpeed * (patch.moveSpeed ?? 1),
    };
  }
  return mods;
}

function multiplyRecord<K extends string>(
  base: Readonly<Record<K, number>>,
  patch: Partial<Record<K, number>> | undefined,
): Record<K, number> {
  const result = { ...base } as Record<K, number>;
  if (!patch) return result;
  for (const key of Object.keys(patch) as K[]) {
    result[key] = (result[key] ?? 1) * (patch[key] ?? 1);
  }
  return result;
}

/**
 * La Afinidad como cambio: el elemento propio se cansa menos y sus dos opuestos, más.
 * Los multiplicadores vienen de las tablas de contenido.
 */
export function affinityPatch(
  element: ElementId,
  ownFatigueMultiplier: number,
  opposingFatigueMultiplier: number,
): ModsPatch {
  const fatigue: Partial<Record<ElementId, number>> = { [element]: ownFatigueMultiplier };
  for (const opposing of opposingOf(element)) fatigue[opposing] = opposingFatigueMultiplier;
  return { fatigue };
}
