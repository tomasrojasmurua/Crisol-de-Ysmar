import type { ElementId } from './elements';
import type { Vec2 } from './math/vec2';
import type { SpellRules } from './spells/spellRules';

/**
 * `empowered` lo da un santuario: más daño por un rato.
 * `airborne` (por los aires), `stasis` (Ataúd helado), `veiled` (Velo) y `regen` (Savia)
 * vienen de los hechizos propios, igual que `silenced` (no puede tejer), `weak` (pega menos),
 * `blind` (solo ve de cerca) y `haste` (corre más). Los Grandes hechizos suman `frozen`
 * (congelado: no actúa, pero recibe daño), `asleep` (dormido hasta que lo golpean),
 * `phased` (atraviesa magos, muros y árboles) y `soaked` (empapado: muy lento). La segunda
 * tanda suma `quickened` (teje más rápido), `sluggish` (teje más lento), `warded` (no le entran
 * estados dañinos), `exposed` (recibe más daño), `combusting` (tejer le quema), `plague` (daño que
 * contagia) y `linked` (sus golpes curan a un aliado). La tercera suma la información
 * (`insight`, `hunting`, `tracked`), el sigilo (`unseen`, `shrouded`, `disguised`, `shadowed`,
 * `leeching`) y las transformaciones (`magma`, `surfing`, `deepRooted`, `panther`).
 * La cuarta tanda suma el control (`stunned`, `halted`, `muted`, `hexed`, `forgetful`, `robbed`),
 * las defensas (`untouchable`, `thorny`, `emberSeed`, `depth`, `rebirth`, `attracting`,
 * `mirroring`, `wailing`, `oath`, `grafted`), el desgaste (`scalded`, `rotting`, `withered`,
 * `grounded`), las marcas (`ashHunger`, `vengeful`), el ritmo (`kindled`, `forged`,
 * `overcharged`, `propelled`, `dewy`, `echoing`, `steering`) la Esencia (`harvesting`) y el
 * Cortocircuito armado (`primed`).
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
  | 'soaked'
  | 'quickened'
  | 'sluggish'
  | 'warded'
  | 'exposed'
  | 'combusting'
  | 'plague'
  | 'linked'
  | 'insight'
  | 'hunting'
  | 'tracked'
  | 'unseen'
  | 'shrouded'
  | 'disguised'
  | 'shadowed'
  | 'leeching'
  | 'magma'
  | 'surfing'
  | 'deepRooted'
  | 'panther'
  | 'stunned'
  | 'halted'
  | 'untouchable'
  | 'scalded'
  | 'thorny'
  | 'emberSeed'
  | 'kindled'
  | 'withered'
  | 'grounded'
  | 'ashHunger'
  | 'vengeful'
  | 'hexed'
  | 'oath'
  | 'grafted'
  | 'rotting'
  | 'depth'
  | 'rebirth'
  | 'forged'
  | 'overcharged'
  | 'propelled'
  | 'dewy'
  | 'echoing'
  | 'robbed'
  | 'forgetful'
  | 'muted'
  | 'attracting'
  | 'mirroring'
  | 'wailing'
  | 'steering'
  | 'harvesting'
  | 'primed';

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
  'quickened',
  'sluggish',
  'warded',
  'exposed',
  'combusting',
  'plague',
  'linked',
  'insight',
  'hunting',
  'tracked',
  'unseen',
  'shrouded',
  'disguised',
  'shadowed',
  'leeching',
  'magma',
  'surfing',
  'deepRooted',
  'panther',
  'stunned',
  'halted',
  'untouchable',
  'scalded',
  'thorny',
  'emberSeed',
  'kindled',
  'withered',
  'grounded',
  'ashHunger',
  'vengeful',
  'hexed',
  'oath',
  'grafted',
  'rotting',
  'depth',
  'rebirth',
  'forged',
  'overcharged',
  'propelled',
  'dewy',
  'echoing',
  'robbed',
  'forgetful',
  'muted',
  'attracting',
  'mirroring',
  'wailing',
  'steering',
  'harvesting',
  'primed',
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
    /** Teje más rápido: multiplica el tiempo de canalización. */
    readonly quickened: { readonly ticks: number; readonly castMultiplier: number };
    /** Teje más lento: multiplica el tiempo de canalización. */
    readonly sluggish: { readonly ticks: number; readonly castMultiplier: number };
    /** No le entran estados dañinos. */
    readonly warded: { readonly ticks: number };
    /** Recibe más daño de todo. */
    readonly exposed: { readonly ticks: number; readonly damageMultiplier: number };
    /** Cada hechizo que lanza le hace daño a él mismo. */
    readonly combusting: { readonly ticks: number; readonly damage: number };
    /** Daño en el tiempo que salta a los rivales cercanos de quien lo lanzó. */
    readonly plague: {
      readonly ticks: number;
      readonly damagePerSecond: number;
      readonly spreadRadius: number;
    };
    /** Cada golpe que da cura lo mismo a su aliado más cercano. */
    readonly linked: { readonly ticks: number };
    /** Barómetro: ve cuánto le falta a cada elemento del rival para descansar. */
    readonly insight: { readonly ticks: number };
    /** Cazador: ve a todos los rivales del mapa y corre más. */
    readonly hunting: { readonly ticks: number; readonly moveMultiplier: number };
    /** Huella: el equipo de quien lo marcó lo ve aunque esté en la jungla. */
    readonly tracked: { readonly ticks: number };
    /** No aparece en el minimapa rival ni lo revelan Cazador, Huella o Centinela. */
    readonly unseen: { readonly ticks: number };
    /** Dentro del Bosque maldito: invisible salvo de cerca, como con Velo. */
    readonly shrouded: { readonly ticks: number };
    /** Ilusión de tejido: el rival ve elementos falsos en su tejido. */
    readonly disguised: { readonly ticks: number };
    /** Sombra prestada: invisible solo para un rival. */
    readonly shadowed: { readonly ticks: number };
    /** Niebla carmesí: cada golpe que da le devuelve parte en vida. */
    readonly leeching: { readonly ticks: number; readonly lifesteal: number };
    /** Forma de magma: lento, no lo frenan ni lo enraízan y deja el suelo ardiendo. */
    readonly magma: {
      readonly ticks: number;
      readonly moveMultiplier: number;
      readonly trailEvery: number;
    };
    /** Surf: muy rápido y empapa a los rivales que cruza, pero no teje. */
    readonly surfing: { readonly ticks: number; readonly moveMultiplier: number };
    /** Raíces profundas: no se mueve, no lo controlan y sus hechizos llegan más lejos. */
    readonly deepRooted: { readonly ticks: number; readonly rangeMultiplier: number };
    /** Pantera de sombra: rápida y con zarpazos que roban vida, pero no teje. */
    readonly panther: {
      readonly ticks: number;
      readonly moveMultiplier: number;
      readonly damage: number;
      readonly reach: number;
      readonly intervalTicks: number;
    };
    /** Aturdido: no se mueve ni teje (Cortocircuito, Círculo de tótems, Rayo de enlace). */
    readonly stunned: { readonly ticks: number };
    /** Instante: detenido en el tiempo; no actúa, no recibe daño ni estados. */
    readonly halted: { readonly ticks: number };
    /** Mil pasos: no recibe daño ni estados dañinos. */
    readonly untouchable: { readonly ticks: number };
    /** Escaldar: no puede tener escudos. */
    readonly scalded: { readonly ticks: number };
    /** Ortiga: quien le pega recibe de vuelta una parte. */
    readonly thorny: { readonly ticks: number; readonly reflect: number };
    /** Semilla de fuego: al recibir un golpe, explota alrededor. */
    readonly emberSeed: {
      readonly ticks: number;
      readonly damage: number;
      readonly radius: number;
    };
    /** Junto a la Hoguera: sus elementos descansan más rápido. */
    readonly kindled: { readonly ticks: number; readonly restMultiplier: number };
    /** Dentro de Marchitar: sus elementos no descansan. */
    readonly withered: { readonly ticks: number };
    /** Dentro del Diluvio: no salta ni se teletransporta. */
    readonly grounded: { readonly ticks: number };
    /** Hambre de ceniza: si cae o queda muy herido, quien lo marcó descansa y se cura. */
    readonly ashHunger: { readonly ticks: number; readonly threshold: number };
    /** Venganza: si cae o queda muy herido, el rival marcado recibe daño. */
    readonly vengeful: {
      readonly ticks: number;
      readonly threshold: number;
      readonly damage: number;
    };
    /** Mal de ojo: sus botones de elementos cambian de lugar (lo resuelve su pantalla). */
    readonly hexed: { readonly ticks: number };
    /** Juramento: él y el marcado no pueden hacerse daño. */
    readonly oath: { readonly ticks: number };
    /** Injerto: el daño que recibe se reparte con su aliado. */
    readonly grafted: { readonly ticks: number; readonly share: number };
    /** Podredumbre: cada curación le hace daño. */
    readonly rotting: { readonly ticks: number };
    /** Profundidad: el daño no llega de golpe, se reparte en el tiempo. */
    readonly depth: { readonly ticks: number; readonly spreadTicks: number };
    /** Renacer: si cae, vuelve ahí mismo con parte de la vida. */
    readonly rebirth: { readonly ticks: number; readonly hpFraction: number };
    /** Forja: su próximo hechizo de daño pega más. */
    readonly forged: { readonly ticks: number; readonly damageMultiplier: number };
    /** Sobrecarga: sus próximos hechizos salen sin canalizar. */
    readonly overcharged: { readonly ticks: number; readonly charges: number };
    /** Propulsión: cada hechizo que lanza le da un salto corto que deja fuego. */
    readonly propelled: {
      readonly ticks: number;
      readonly distance: number;
      readonly leapTicks: number;
    };
    /** Rocío: cada hechizo que lanza cura a su equipo cercano. */
    readonly dewy: { readonly ticks: number; readonly heal: number; readonly radius: number };
    /** Eco ardiente: su próximo hechizo sale dos veces. */
    readonly echoing: { readonly ticks: number; readonly delayTicks: number };
    /** Hurto: su próximo hechizo se lo queda quien lo marcó. */
    readonly robbed: { readonly ticks: number };
    /** Bruma del olvido: no puede repetir su último hechizo. */
    readonly forgetful: { readonly ticks: number };
    /** Réquiem: sus hechizos no hacen daño. */
    readonly muted: { readonly ticks: number };
    /** Pararrayos humano: atrae los proyectiles rivales y los vuelve escudo. */
    readonly attracting: { readonly ticks: number; readonly radius: number; readonly pull: number };
    /** Espejo de agua: devuelve los proyectiles a quien los lanzó. */
    readonly mirroring: { readonly ticks: number };
    /** Llanto del abismo: los proyectiles cercanos quedan flotando. */
    readonly wailing: { readonly ticks: number; readonly radius: number };
    /** Relámpago guiado: quieto mientras dirige el rayo. */
    readonly steering: { readonly ticks: number };
    /** Cosecha de almas: sus golpes fuertes y las caídas cercanas le dan Esencia. */
    readonly harvesting: {
      readonly ticks: number;
      readonly radius: number;
      readonly minHit: number;
      readonly maxStacks: number;
    };
    /** Cortocircuito armado: el primer rival cercano que teja pierde su hechizo. */
    readonly primed: { readonly ticks: number };
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
