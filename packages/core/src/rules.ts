import type { ElementId } from './elements';
import type { Vec2 } from './math/vec2';
import type { SpellRules } from './spells/spellRules';

/**
 * `empowered` lo da un santuario: más daño por un rato.
 * `airborne` (por los aires), `stasis` (Ataúd helado), `veiled` (Velo) y `regen` (Savia)
 * vienen de los hechizos propios, igual que `silenced` (no puede tejer), `weak` (pega menos),
 * `blind` (solo ve de cerca) y `haste` (corre más). Los Grandes hechizos suman `frozen`
 * (congelado: no actúa, pero recibe daño), `asleep` (dormido hasta que lo golpean),
 * `phased` (atraviesa magos, muros y árboles) y `soaked` (empapado: muy lento).
 */
export type StatusId =
  | 'burn'
  | 'slow'
  | 'root'
  | 'curse'
  | 'empowered'
  | 'airborne'
  | 'stasis'
  | 'veiled'
  | 'regen'
  | 'silenced'
  | 'weak'
  | 'blind'
  | 'haste'
  | 'frozen'
  | 'asleep'
  | 'phased'
  | 'soaked';

/** Todos los estados, en un orden fijo. */
export const STATUS_IDS: readonly StatusId[] = [
  'burn',
  'slow',
  'root',
  'curse',
  'empowered',
  'airborne',
  'stasis',
  'veiled',
  'regen',
  'silenced',
  'weak',
  'blind',
  'haste',
  'frozen',
  'asleep',
  'phased',
  'soaked',
];

/**
 * Todos los números que definen el balance. El núcleo solo declara su forma;
 * los valores viven en `packages/content`, para balancear sin tocar código.
 * Los tiempos van en pasos de simulación (30 por segundo) y las distancias en metros.
 */
/** Un árbol, una roca o una ruina: frena el paso, los proyectiles y la vista. */
export interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /** Solo para el dibujo: tree, rock o ruin. */
  readonly kind: string;
}

/** Un campamento de bestias: un claro en la jungla con criaturas de un elemento. */
export interface Camp {
  readonly x: number;
  readonly z: number;
  readonly element: ElementId;
}

/** El mapa: siempre el mismo, para que se pueda aprender. */
export interface MapLayout {
  readonly obstacles: readonly Obstacle[];
  readonly camps: readonly Camp[];
  /** Donde despierta el Guardián; sin guarida no hay Guardián. */
  readonly guardianLair: Vec2 | null;
}

export interface GameRules {
  readonly arenaRadius: number;
  readonly map: MapLayout;
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
  /** Los hechizos propios, cada uno con sus números. */
  readonly spells: SpellRules;
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
    /** Por los aires: no se mueve ni teje. */
    readonly airborne: { readonly ticks: number };
    /** Congelado en hielo: no recibe daño ni estados, pero tampoco actúa. */
    readonly stasis: { readonly ticks: number };
    /** Invisible salvo de cerca; el primer hechizo que sale del velo pega más. */
    readonly veiled: {
      readonly ticks: number;
      readonly revealRadius: number;
      readonly damageMultiplier: number;
    };
    /** Se cura en el tiempo. */
    readonly regen: { readonly ticks: number; readonly healPerSecond: number };
    /** Silenciado: se mueve, pero no teje ni lanza. */
    readonly silenced: { readonly ticks: number };
    /** Débil: sus hechizos hacen menos daño. */
    readonly weak: { readonly ticks: number; readonly damageMultiplier: number };
    /** Cegado: no ve a los rivales más allá de este radio. */
    readonly blind: { readonly ticks: number; readonly sightRadius: number };
    /** Apurado: corre más rápido. */
    readonly haste: { readonly ticks: number; readonly moveMultiplier: number };
    /** Congelado: no se mueve ni teje, pero el daño le llega. */
    readonly frozen: { readonly ticks: number };
    /** Dormido: no se mueve ni teje; despierta al recibir daño. */
    readonly asleep: { readonly ticks: number };
    /** Fantasma: atraviesa magos, muros y árboles caminando. */
    readonly phased: { readonly ticks: number };
    /** Empapado: mucho más lento que el `slow`. */
    readonly soaked: { readonly ticks: number; readonly moveMultiplier: number };
  };
  readonly interactions: {
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
  /** Bestias por campamento. */
  readonly packSize: number;
  /** Pasos hasta que un campamento vacío se vuelve a poblar. */
  readonly respawnTicks: number;
  readonly guardian: GuardianRules;
}

/** Lo que una bestia necesita para moverse y pelear. */
export interface BeastStats {
  readonly maxHp: number;
  readonly radius: number;
  readonly moveSpeed: number;
  readonly damage: number;
  readonly attackRange: number;
  readonly attackCooldownTicks: number;
  readonly aggroTicks: number;
  readonly leash: number;
}

/** El Guardián: una bestia enorme que despierta en la plaza a mitad de la Caza. */
export interface GuardianRules extends BeastStats {
  /** Paso de la ronda en que despierta. */
  readonly spawnTick: number;
  /** Esencia que da de cada elemento a quien lo vence. */
  readonly essenceReward: number;
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
