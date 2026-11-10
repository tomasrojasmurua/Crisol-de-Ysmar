import type { ElementId } from '../elements';
import type { Vec2 } from '../math/vec2';
import type { WizardMods } from '../mods';
import type { ComboId, StatusId } from '../rules';
import type { SpellId } from '../spells/catalog';
import type { SpellForm, Weave } from '../weaving/weave';

export type EntityId = number;

export interface StatusInstance {
  ticks: number;
  sourceId: EntityId;
  /** La fuerza del estado cuando no es la de siempre (cuánto más daño recibe con el Ácido). */
  readonly power?: number;
  /** Para quién vale: la Sombra prestada te esconde solo de un rival. */
  readonly targetId?: EntityId;
}

export interface Channel {
  ticksLeft: number;
  readonly weave: Weave;
  /** Dirección elegida al lanzar; cero significa apuntar solo al objetivo. */
  readonly aim: Vec2;
}

/** Un desplazamiento en varios pasos: el Paso, el Cometa, el tirón de la Liana o la Catapulta. */
export interface Leap {
  ticksLeft: number;
  readonly step: Vec2;
  /** Rastro que deja en el suelo (el Cometa deja fuego). */
  readonly trail: 'fire' | null;
  /** Lo que golpea al aterrizar (la Catapulta de raíz enraíza alrededor). */
  readonly landing?: SpellPayload | null;
}

/** Un mago caído. En modo Espectro sigue moviéndose; en modo Vidas espera para reaparecer. */
export interface Fallen {
  /** Pasos para reaparecer; null si ya no le quedan vidas o la sala es de Espectros. */
  respawnTicks: number | null;
  /** Pasos que un aliado lleva reviviéndolo. */
  reviveProgress: number;
  /** Pasos para que el espectro pueda volver a lanzar su Lamento. */
  hauntCooldown: number;
}

export interface Wizard {
  readonly id: EntityId;
  readonly team: number;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  /** Vida máxima: la base de las reglas por sus Glifos y Presagio. */
  readonly maxHp: number;
  readonly mods: WizardMods;
  /** Afinidad elegida antes de la partida, o ninguna. */
  readonly affinity: ElementId | null;
  /** Esencia de cada elemento ganada cazando bestias en esta ronda. */
  essence: Record<ElementId, number>;
  /** Elementos tejidos y aún no lanzados. Lo ve todo el mundo. */
  weave: ElementId[];
  channel: Channel | null;
  leap: Leap | null;
  /** Pasos de cansancio que le quedan a cada elemento. */
  fatigue: Record<ElementId, number>;
  statuses: Partial<Record<StatusId, StatusInstance>>;
  lockTarget: EntityId | null;
  moveInput: Vec2;
  /** Vidas que quedan en la ronda (en modo Espectro es 1). */
  lives: number;
  fallen: Fallen | null;
  /** Lo que absorbe la coraza de Obsidiana antes de que el daño llegue a la vida. */
  shield: number;
  /** Todo el daño recibido en la ronda: la Ignición mide cuánto creció. */
  damageTaken: number;
  /** El último tejido que salió: lo leen el Reflejo, el Estruendo y la Bruma del olvido. */
  lastWeave: Weave | null;
  /** Un hechizo ajeno guardado (Reflejo, Hurto): sale en su próximo lanzamiento. */
  held: HeldSpell | null;
  /** Dónde estuvo y con cuánta vida, cada medio segundo: el Retroceso vuelve atrás. */
  past: PastSample[];
  /** Los hechizos de una vez por ronda que ya usó (Renacer, Transfusión). */
  spent: SpellId[];
}

/** Un hechizo copiado o robado que espera su turno. */
export interface HeldSpell {
  readonly spell: SpellId;
  readonly weave: Weave;
  ticksLeft: number;
}

export interface PastSample {
  readonly x: number;
  readonly z: number;
  readonly hp: number;
}

/** Lo que lleva un conjuro al salir: se arma una vez a partir del tejido. */
export interface SpellPayload {
  readonly form: SpellForm;
  readonly weave: Weave;
  readonly damage: number;
  readonly statuses: readonly StatusId[];
  /** El hechizo que lo lanzó. */
  readonly spell: SpellId;
  /** Radio de la explosión al impactar; 0 si no explota. */
  readonly blastRadius: number;
  /** Si atraviesa escudos (la Llama negra). */
  readonly pierce: boolean;
}

/**
 * Lo que hace distinto a un proyectil: la Llama negra atraviesa muros, escudos e invocaciones;
 * el Cometa negro lleva a quien lo lanzó junto al rival que toca.
 */
export type ProjectileTrait = 'pierce' | 'pull';

export interface Projectile {
  readonly kind: 'projectile';
  readonly id: EntityId;
  /** El Espejo de agua y el Llanto del abismo le cambian de dueño. */
  ownerId: EntityId;
  team: number;
  pos: Vec2;
  /** La Ventisca puede desviarlo una vez. */
  velocity: Vec2;
  deflected: boolean;
  readonly radius: number;
  travelled: number;
  readonly maxRange: number;
  readonly payload: SpellPayload;
  readonly trait: ProjectileTrait | null;
  /** Flotando en el Llanto del abismo: quién lo retiene y a qué velocidad saldrá. */
  held?: { readonly byId: EntityId; readonly speed: number } | null;
}

export interface Wall {
  readonly kind: 'wall';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly center: Vec2;
  /** Dirección a lo largo del muro. */
  readonly along: Vec2;
  readonly halfLength: number;
  readonly thickness: number;
  /**
   * Un muro sólido (la Muralla de raíces) corta el paso y los proyectiles de todos;
   * si no (el Muro de hielo), solo los de los rivales.
   */
  readonly solid: boolean;
  /** El Manglar frena proyectiles pero deja pasar a los magos. */
  readonly passable: boolean;
  readonly durationTicks: number;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/**
 * Suelo encantado por un rato: el rastro del Cometa quema, la Ventisca frena y desvía,
 * el Manantial cura a los aliados y las Esporas debilitan a los rivales.
 */
export type ZoneEffect =
  | 'burn'
  | 'blizzard'
  | 'spring'
  | 'spores'
  | 'hotSpring'
  | 'healingRain'
  | 'mist'
  | 'crimsonMist'
  | 'grove'
  | 'moss';

export interface Zone {
  readonly kind: 'zone';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  readonly radius: number;
  readonly effect: ZoneEffect;
  readonly durationTicks: number;
  ticksLeft: number;
}

/** La Corriente: un río recto que apura a los aliados a favor y frena a los rivales. */
export interface Current {
  readonly kind: 'current';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly origin: Vec2;
  readonly dir: Vec2;
  readonly length: number;
  readonly halfWidth: number;
  readonly durationTicks: number;
  ticksLeft: number;
}

/**
 * Lo que pasa al caer un golpe con aviso: el Géiser y el Huracán levantan por los aires,
 * la Era de hielo congela, el Abismo silencia y el Meteoro deja el suelo ardiendo.
 */
export type StrikeEffect = 'lift' | 'freeze' | 'silence' | 'scorch' | null;

/**
 * Un golpe marcado en el suelo: tras el aviso, cae sobre quien siga dentro. Es un círculo
 * (Géiser, Meteoro, Era de hielo, Hervidero, Abismo) o una línea (Lanza del cielo).
 */
export interface Strike {
  readonly kind: 'strike';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  /** Centro del círculo, o el punto donde empieza la línea. */
  readonly pos: Vec2;
  /** Radio del círculo, o medio ancho de la línea. */
  readonly radius: number;
  readonly line: { readonly dir: Vec2; readonly length: number } | null;
  readonly delayTicks: number;
  ticksLeft: number;
  readonly effect: StrikeEffect;
  readonly payload: SpellPayload;
}

/**
 * Algo que avanza solo por el campo y golpea al pasar: el Huracán levanta por los aires,
 * el Orbe errático da rayos alrededor y el Maremoto empapa todo lo que cruza.
 */
export type SweeperMode =
  | 'tornado'
  | 'orb'
  | 'wave'
  | 'bird'
  | 'stampede'
  | 'soulTide'
  | 'wildfire';

export interface Sweeper {
  readonly kind: 'sweeper';
  readonly mode: SweeperMode;
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  pos: Vec2;
  /** El Ave de ceniza da la vuelta a mitad de camino. */
  velocity: Vec2;
  returning: boolean;
  /** Radio de lo que toca; con `halfWidth`, el grosor de la ola. */
  readonly radius: number;
  /** Medio largo de un frente ancho, de costado a su avance (0: un círculo). */
  readonly halfWidth: number;
  travelled: number;
  readonly maxRange: number;
  /** Pasos hasta el próximo rayo del Orbe. */
  cooldown: number;
  /** A quién ya golpeó: cada uno recibe el golpe una sola vez. */
  readonly struck: EntityId[];
  readonly payload: SpellPayload;
}

/** La Estampida de espinas: brotes que avanzan en línea, uno tras otro. */
export interface ThornRush {
  readonly kind: 'thornRush';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly origin: Vec2;
  readonly dir: Vec2;
  /** Brotes que ya salieron. */
  bursts: number;
  ticksToNext: number;
  readonly payload: SpellPayload;
}

/** El hilo del Drenaje entre quien lo lanza y su blanco. */
export interface Tether {
  readonly kind: 'tether';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** La coraza de Obsidiana: cuando se rompe o se acaba, estalla alrededor de quien la lleva. */
export interface Obsidian {
  readonly kind: 'obsidian';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly durationTicks: number;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** La Ignición: guarda cuánto daño llevaba el rival para estallar con una parte de lo que reciba. */
export interface Ignite {
  readonly kind: 'ignite';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  readonly takenAtStart: number;
  readonly durationTicks: number;
  ticksLeft: number;
  /** Su daño es la parte del daño recibido que devuelve al estallar. */
  readonly payload: SpellPayload;
}

/** El Grillete: ata al rival a un punto; si se aleja demasiado, se tensa y lo castiga. */
export interface Shackle {
  readonly kind: 'shackle';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  readonly anchor: Vec2;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** Pira de almas: a los 2 s, el marcado arde según la vida que le falta. */
export interface Pyre {
  readonly kind: 'pyre';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** Ahogo: agua que sube por el rival mientras no salga del alcance. */
export interface Drown {
  readonly kind: 'drown';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  readonly durationTicks: number;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** Lluvia de fuego: cae fuego sobre cada rival que se mueva cerca de quien la lanzó. */
export interface FireRain {
  readonly kind: 'fireRain';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  ticksLeft: number;
  /** Pasos hasta la próxima andanada. */
  cooldown: number;
  readonly payload: SpellPayload;
}

/** Tempestad: los destellos que quedan y cuándo sale el próximo. */
export interface Tempest {
  readonly kind: 'tempest';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  jumpsLeft: number;
  ticksToNext: number;
  readonly payload: SpellPayload;
}

/** Portal: dos bocas unidas; quien entra por una sale por la otra. */
export interface Portal {
  readonly kind: 'portal';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly a: Vec2;
  readonly b: Vec2;
  readonly radius: number;
  readonly durationTicks: number;
  ticksLeft: number;
  /** Quienes están parados en una boca: no vuelven a cruzar hasta salir de ella. */
  inside: EntityId[];
}

/** Anillo de zarzas: nadie entra ni sale caminando, y las espinas queman a los rivales. */
export interface ThornRing {
  readonly kind: 'thornRing';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  readonly radius: number;
  readonly durationTicks: number;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** Una trampa de la Siembra: se arma, y el primer rival que la pisa queda enraizado. */
export interface Trap {
  readonly kind: 'trap';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  readonly radius: number;
  /** Pasos hasta que se arma. */
  armTicks: number;
  ticksLeft: number;
  /** Una flor del Jardín: la pisan los aliados y los cura. */
  readonly friendly: boolean;
  readonly payload: SpellPayload;
}

/** Burbuja: un escudo sobre un aliado que se deshace al terminar. */
export interface Bubble {
  readonly kind: 'bubble';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  ticksLeft: number;
}

/**
 * Lo que rodea a quien lo lanzó mientras dura: la Inmolación quema alrededor y cura,
 * el Ojo del huracán no deja entrar nada.
 */
export interface Aura {
  readonly kind: 'aura';
  readonly mode: 'immolation' | 'stormEye';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly radius: number;
  readonly durationTicks: number;
  ticksLeft: number;
  cooldown: number;
  readonly payload: SpellPayload;
}

/**
 * Lo que se invoca: el Fuego fatuo persigue y explota, el Pararrayos dispara desde su lugar,
 * el Guardián de musgo te sigue y pega, y el Señuelo corre fingiendo ser tú.
 * Los rivales pueden destruirlos a golpes.
 */
export type SummonKind =
  | 'wisp'
  | 'lightningRod'
  | 'mossGuardian'
  | 'decoy'
  | 'wanderingSpark'
  | 'magmaGolem'
  | 'glacier'
  | 'swarm'
  | 'ancientTree'
  | 'shadowTwin'
  | 'carnivore'
  | 'mirage'
  | 'sentinel'
  | 'mushroom'
  | 'voodooDoll';

export interface Summon {
  readonly kind: 'summon';
  readonly summon: SummonKind;
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly durationTicks: number;
  ticksLeft: number;
  /** Pasos hasta su próximo golpe o rayo. */
  cooldown: number;
  /** A quién persigue el Enjambre, o a quién se tragó la Planta carnívora. */
  targetId: EntityId | null;
  /** Lugar en el grupo: cada Chispa errante gira en su propio ángulo. */
  readonly slot: number;
  /** Fertilizar lo cambia por un rato. */
  payload: SpellPayload;
}

/** Brote de árbol: un árbol nuevo en la jungla, hasta que termine la ronda. */
export interface GrownTree {
  readonly kind: 'grownTree';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  readonly radius: number;
  /** Crece de a poco: el dibujo lo usa. */
  age: number;
}

/**
 * Lo que la cuarta tanda deja en el campo, con un dibujo propio cada uno: un volcán, una nube,
 * una fogata, un camino de hielo, un cable, nenúfares, tótems o una planta escondida.
 * `points` guarda los extremos de una línea (Pista de hielo, Tirolesa) o los puntos de un grupo
 * (Nenúfares, Círculo de tótems).
 */
export type FieldMode =
  | 'volcano'
  | 'monsoon'
  | 'smoke'
  | 'bonfire'
  | 'wither'
  | 'deluge'
  | 'growth'
  | 'pollen'
  | 'solarOrb'
  | 'iceTrack'
  | 'zipline'
  | 'lilyPads'
  | 'shadowMark'
  | 'totems'
  | 'mandrake';

export interface Field {
  readonly kind: 'field';
  readonly mode: FieldMode;
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  readonly radius: number;
  readonly points: readonly Vec2[];
  readonly durationTicks: number;
  ticksLeft: number;
  /** Pasos hasta el próximo rayo, roca o lo que toque. */
  cooldown: number;
  /** Quienes ya lo usaron y siguen encima: no lo vuelven a usar hasta salir. */
  inside: EntityId[];
  readonly payload: SpellPayload;
}

/** Relámpago guiado: un rayo que avanza hacia donde lo lleva el dedo de quien lo lanzó. */
export interface GuidedBolt {
  readonly kind: 'guidedBolt';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  pos: Vec2;
  dir: Vec2;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

/** Mil pasos: saltos de rival en rival, golpeando a cada uno una vez. */
export interface Stepper {
  readonly kind: 'stepper';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  hopsLeft: number;
  ticksToNext: number;
  readonly struck: EntityId[];
  readonly payload: SpellPayload;
}

/** Eco ardiente: el mismo hechizo vuelve a salir, desde el mismo lugar, un momento después. */
export interface Echo {
  readonly kind: 'echo';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly spell: SpellId;
  readonly weave: Weave;
  readonly aim: Vec2;
  readonly pos: Vec2;
  ticksLeft: number;
}

/** Profundidad: un golpe que llega de a poco. */
export interface Deferred {
  readonly kind: 'deferred';
  readonly id: EntityId;
  /** Quien dio el golpe. */
  readonly ownerId: EntityId;
  readonly team: number;
  readonly targetId: EntityId;
  readonly perTick: number;
  ticksLeft: number;
}

/** Rayo de enlace: une a dos magos; si se separan mucho, ambos quedan aturdidos. */
export interface Bond {
  readonly kind: 'bond';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly aId: EntityId;
  readonly bId: EntityId;
  ticksLeft: number;
}

/** Fertilizar: las invocaciones tocadas pegan más por un rato; guarda su daño de antes. */
export interface Boon {
  readonly kind: 'boon';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  ticksLeft: number;
  readonly summons: readonly { readonly id: EntityId; readonly damage: number }[];
}

export type SpellEntity =
  | Projectile
  | Wall
  | Zone
  | Current
  | Strike
  | Sweeper
  | ThornRush
  | Tether
  | Obsidian
  | Ignite
  | Shackle
  | Pyre
  | Drown
  | FireRain
  | Tempest
  | Portal
  | ThornRing
  | Trap
  | Bubble
  | Aura
  | GrownTree
  | Summon
  | Field
  | GuidedBolt
  | Stepper
  | Echo
  | Deferred
  | Bond
  | Boon;

/** Bestia neutral de un elemento. No toma partido: ataca a quien la ataque. */
export interface Beast {
  readonly id: EntityId;
  readonly element: ElementId;
  /** Campamento al que pertenece (índice en `rules.map.camps`), o null. */
  readonly camp: number | null;
  /** El Guardián de la plaza: más grande, más fuerte y con más premio. */
  readonly guardian: boolean;
  readonly maxHp: number;
  readonly home: Vec2;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  /** A quién persigue y por cuántos pasos más. */
  targetId: EntityId | null;
  aggroTicks: number;
  attackCooldown: number;
  velocity: Vec2;
  /** Domar bestia: el mago para el que pelea y por cuántos pasos más. */
  tamedBy: EntityId | null;
  tamedTicks: number;
}

/** Santuario de la Convergencia. El primer equipo que lo sostiene solo, lo toma. */
export interface Shrine {
  readonly id: EntityId;
  readonly pos: Vec2;
  /** Equipo que lo está tomando y cuánto lleva. */
  team: number | null;
  progress: number;
}

export type GameEvent =
  | { readonly type: 'cast'; readonly wizardId: EntityId; readonly weave: Weave }
  | {
      readonly type: 'release';
      readonly wizardId: EntityId;
      readonly form: SpellForm;
      readonly spell: SpellId;
    }
  /** Una explosión o un brote en área: Bola ígnea, espinas, géiser, Salpicón, Obsidiana… */
  | {
      readonly type: 'burst';
      readonly spell: SpellId;
      readonly pos: Vec2;
      readonly radius: number;
    }
  /** Un golpe en línea que cae de una vez: la Lanza del cielo. */
  | {
      readonly type: 'line';
      readonly spell: SpellId;
      readonly from: Vec2;
      readonly to: Vec2;
      readonly halfWidth: number;
    }
  /** El recorrido de un rayo en cadena, desde quien lo lanza. */
  | { readonly type: 'chain'; readonly points: readonly Vec2[] }
  /** Un rayo de un punto a otro: el del Pararrayos. */
  | { readonly type: 'zap'; readonly from: Vec2; readonly to: Vec2 }
  | {
      readonly type: 'blink';
      readonly spell: SpellId;
      readonly wizardId: EntityId;
      readonly from: Vec2;
      readonly to: Vec2;
    }
  /** La Liana sale de quien la lanza hasta donde se engancha (o hasta donde llegó si falló). */
  | { readonly type: 'vine'; readonly wizardId: EntityId; readonly to: Vec2; readonly hit: boolean }
  /** Una invocación destruida o consumida. */
  | { readonly type: 'summonGone'; readonly summon: SummonKind; readonly pos: Vec2 }
  | {
      readonly type: 'hit';
      readonly targetId: EntityId;
      readonly sourceId: EntityId;
      readonly amount: number;
      /** 'zone' es el daño por quedar fuera de la zona; 'beast', el mordisco de una bestia. */
      readonly form: SpellForm | 'zone' | 'beast';
    }
  | {
      readonly type: 'beastHit';
      readonly beastId: EntityId;
      readonly sourceId: EntityId;
      readonly amount: number;
    }
  | {
      readonly type: 'beastSlain';
      readonly beastId: EntityId;
      readonly element: ElementId;
      readonly killerId: EntityId | null;
      readonly guardian: boolean;
    }
  | { readonly type: 'guardianAwake'; readonly beastId: EntityId }
  | { readonly type: 'markBeast'; readonly wizardId: EntityId; readonly beastId: EntityId }
  | { readonly type: 'shrinesAppear' }
  | { readonly type: 'shrineClaimed'; readonly shrineId: EntityId; readonly team: number }
  | { readonly type: 'blocked'; readonly pos: Vec2 }
  /** Una reacción entre estados: empapado + Tormenta aturde, enraizado + Brasa arde… */
  | {
      readonly type: 'combo';
      readonly combo: ComboId;
      readonly targetId: EntityId;
      readonly sourceId: EntityId;
    }
  | { readonly type: 'fizzle'; readonly wizardId: EntityId }
  | { readonly type: 'defeated'; readonly wizardId: EntityId }
  | { readonly type: 'respawned'; readonly wizardId: EntityId }
  | { readonly type: 'revived'; readonly wizardId: EntityId; readonly byId: EntityId }
  | { readonly type: 'haunt'; readonly wizardId: EntityId; readonly targetId: EntityId }
  | { readonly type: 'phase'; readonly phase: RoundPhase };

/** Qué pasa al caer, según cómo se creó la sala. */
/**
 * Qué pasa al caer: `out` quedas fuera de la ronda y miras a quienes siguen; `spectre` sigues como
 * espíritu que ralentiza y puede ser revivido (en pausa); `lives` reapareces mientras tengas vidas.
 */
export type DeathRule = 'out' | 'spectre' | 'lives';

/** Caza, Convergencia y Duelo final. */
export type RoundPhase = 'hunt' | 'convergence' | 'final';

/**
 * El estado de una ronda. La partida al mejor de 3 encadena rondas con `series.ts`.
 */
export interface MatchState {
  readonly deathRule: DeathRule;
  tick: number;
  /** Radio de la zona segura; está centrada en la arena. */
  zoneRadius: number;
  rngState: number;
  nextEntityId: EntityId;
  wizards: Wizard[];
  spells: SpellEntity[];
  beasts: Beast[];
  /** Paso en que cada campamento vacío se vuelve a poblar; -1 si está poblado. */
  campRespawn: number[];
  guardianAwake: boolean;
  /** Árboles de la jungla que quemó el Incendio forestal en esta ronda, por su lugar. */
  burnedTrees: Vec2[];
  shrines: Shrine[];
  /** Lo que pasó en el último paso: el cliente lo usa para efectos y sonido. */
  events: GameEvent[];
  winnerTeam: number | null;
}
