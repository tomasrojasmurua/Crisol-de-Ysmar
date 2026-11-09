import type { ElementId } from './elements';
import type { SpellForm } from './weaving/weave';

export type StatusId = 'burn' | 'slow' | 'root' | 'curse';

/**
 * Todos los números que definen el balance. El núcleo solo declara su forma;
 * los valores viven en `packages/content`, para balancear sin tocar código.
 * Los tiempos van en pasos de simulación (30 por segundo) y las distancias en metros.
 */
export interface GameRules {
  readonly arenaRadius: number;
  readonly wizard: {
    readonly maxHp: number;
    readonly moveSpeed: number;
    readonly radius: number;
    /** Velocidad mientras se canaliza un conjuro. */
    readonly channelMoveMultiplier: number;
  };
  readonly weave: {
    /** Pasos que tarda en salir un conjuro de 1, 2 y 3 elementos. */
    readonly castTicksByLength: readonly [number, number, number];
    /** Pasos que un elemento queda cansado después de usarlo. */
    readonly fatigueTicks: number;
  };
  readonly forms: {
    readonly projectile: FormBase & {
      readonly speed: number;
      readonly range: number;
      readonly radius: number;
    };
    readonly wall: FormBase & {
      readonly halfLength: number;
      readonly distance: number;
      readonly durationTicks: number;
      readonly pulseRadius: number;
    };
    readonly trap: FormBase & {
      readonly range: number;
      readonly triggerRadius: number;
      readonly armTicks: number;
      readonly durationTicks: number;
    };
    readonly leap: FormBase & {
      readonly distance: number;
      readonly durationTicks: number;
      readonly impactRadius: number;
    };
    readonly mark: FormBase & { readonly range: number; readonly coneDot: number };
  };
  /** Lo que aporta cada elemento cuando no es el primero del tejido. */
  readonly modifiers: Readonly<Record<ElementId, ModifierRules>>;
  readonly statuses: {
    readonly burn: { readonly ticks: number; readonly damagePerSecond: number };
    readonly slow: { readonly ticks: number; readonly moveMultiplier: number };
    readonly root: { readonly ticks: number };
    readonly curse: {
      readonly ticks: number;
      readonly damagePerSecond: number;
      readonly lifesteal: number;
    };
  };
  readonly interactions: {
    /** Tormenta se conduce por el agua: más daño contra quien está ralentizado. */
    readonly stormVsSlowedMultiplier: number;
    /** Marea apaga Brasa: ralentizar a alguien le quita la quemadura. */
    readonly tideExtinguishesBurn: boolean;
  };
}

export interface FormBase {
  readonly damage: number;
  /** Estado que la forma aplica por sí misma. */
  readonly status: StatusId | null;
}

export interface ModifierRules {
  readonly damageMultiplier: number;
  readonly status: StatusId | null;
  readonly speedMultiplier: number;
  readonly rangeMultiplier: number;
}

export type FormRules = GameRules['forms'][SpellForm];
