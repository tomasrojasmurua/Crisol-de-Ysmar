import type { ElementId } from './elements';
import type { SpellForm } from './weaving/weave';

/** `empowered` lo da un santuario: más daño por un rato. */
export type StatusId = 'burn' | 'slow' | 'root' | 'curse' | 'empowered';

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
    readonly empowered: { readonly ticks: number; readonly damageMultiplier: number };
  };
  readonly interactions: {
    /** Tormenta se conduce por el agua: más daño contra quien está ralentizado. */
    readonly stormVsSlowedMultiplier: number;
    /** Marea apaga Brasa: ralentizar a alguien le quita la quemadura. */
    readonly tideExtinguishesBurn: boolean;
  };
  readonly round: RoundRules;
  readonly death: DeathRules;
  readonly beasts: BeastRules;
  readonly shrines: ShrineRules;
}

/** Bestias neutrales: se cazan en la arena y dejan Esencia de su elemento. */
export interface BeastRules {
  /** Cuántas aparecen al empezar cada ronda. */
  readonly count: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly moveSpeed: number;
  readonly damage: number;
  readonly attackRange: number;
  readonly attackCooldownTicks: number;
  /** Cuánto persiguen a quien las atacó. */
  readonly aggroTicks: number;
  /** Distancia máxima a su guarida antes de volver. */
  readonly leash: number;
  /** Daño extra por cada Esencia, en conjuros que usan ese elemento. */
  readonly essenceDamagePerStack: number;
  readonly maxEssence: number;
}

/** Santuarios de la Convergencia: se disputan parándose encima. */
export interface ShrineRules {
  readonly count: number;
  readonly radius: number;
  readonly captureTicks: number;
  /** Vida que recupera quien lo toma, como fracción del máximo. */
  readonly healFraction: number;
}

/** Ritmo de una ronda: Caza, Convergencia y Duelo final, con una zona que se cierra. */
export interface RoundRules {
  /** Rondas que hay que ganar para llevarse la partida (2 en un mejor de 3). */
  readonly roundsToWin: number;
  /** Tope de rondas, por si hay empates. */
  readonly maxRounds: number;
  readonly durationTicks: number;
  /** Fin de la Caza: la zona empieza a cerrarse. */
  readonly huntEndTick: number;
  /** Fin de la Convergencia: empieza el Duelo final. */
  readonly convergenceEndTick: number;
  /** Radio de la zona al terminar la Convergencia. */
  readonly convergenceRadius: number;
  /** Radio de la zona al terminar la ronda. */
  readonly finalRadius: number;
  /** Daño por segundo fuera de la zona. */
  readonly zoneDamagePerSecond: number;
}

/** Qué pasa al caer: modo Espectro o Vidas, y cómo se revive a un aliado. */
export interface DeathRules {
  readonly lives: number;
  readonly respawnTicks: number;
  readonly revive: {
    readonly radius: number;
    readonly ticks: number;
    readonly hpFraction: number;
  };
  readonly spectre: {
    readonly moveMultiplier: number;
    /** Lamento: el espectro ralentiza a un enemigo cercano. */
    readonly hauntRange: number;
    readonly hauntCooldownTicks: number;
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
