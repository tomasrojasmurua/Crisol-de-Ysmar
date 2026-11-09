import type { ElementId } from '../elements';
import type { Vec2 } from '../math/vec2';
import type { WizardMods } from '../mods';
import type { StatusId } from '../rules';
import type { SpellForm, Weave } from '../weaving/weave';

export type EntityId = number;

export interface StatusInstance {
  ticks: number;
  sourceId: EntityId;
}

export interface Channel {
  ticksLeft: number;
  readonly weave: Weave;
  /** Dirección elegida al lanzar; cero significa apuntar solo al objetivo. */
  readonly aim: Vec2;
}

export interface Leap {
  ticksLeft: number;
  readonly step: Vec2;
  readonly payload: SpellPayload;
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
}

/** Lo que lleva un conjuro al salir: se arma una vez a partir del tejido. */
export interface SpellPayload {
  readonly form: SpellForm;
  readonly weave: Weave;
  readonly damage: number;
  readonly statuses: readonly StatusId[];
  readonly speedMultiplier: number;
  readonly rangeMultiplier: number;
  readonly hasStorm: boolean;
}

export interface Projectile {
  readonly kind: 'projectile';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  pos: Vec2;
  readonly velocity: Vec2;
  travelled: number;
  readonly maxRange: number;
  readonly payload: SpellPayload;
}

export interface Wall {
  readonly kind: 'wall';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly center: Vec2;
  /** Dirección a lo largo del muro. */
  readonly along: Vec2;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

export interface Trap {
  readonly kind: 'trap';
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly team: number;
  readonly pos: Vec2;
  armTicks: number;
  ticksLeft: number;
  readonly payload: SpellPayload;
}

export type SpellEntity = Projectile | Wall | Trap;

/** Bestia neutral de un elemento. No toma partido: ataca a quien la ataque. */
export interface Beast {
  readonly id: EntityId;
  readonly element: ElementId;
  readonly home: Vec2;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  /** A quién persigue y por cuántos pasos más. */
  targetId: EntityId | null;
  aggroTicks: number;
  attackCooldown: number;
  velocity: Vec2;
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
  | { readonly type: 'release'; readonly wizardId: EntityId; readonly form: SpellForm }
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
    }
  | { readonly type: 'markBeast'; readonly wizardId: EntityId; readonly beastId: EntityId }
  | { readonly type: 'shrinesAppear' }
  | { readonly type: 'shrineClaimed'; readonly shrineId: EntityId; readonly team: number }
  | { readonly type: 'blocked'; readonly pos: Vec2 }
  | { readonly type: 'fizzle'; readonly wizardId: EntityId }
  | { readonly type: 'defeated'; readonly wizardId: EntityId }
  | { readonly type: 'respawned'; readonly wizardId: EntityId }
  | { readonly type: 'revived'; readonly wizardId: EntityId; readonly byId: EntityId }
  | { readonly type: 'haunt'; readonly wizardId: EntityId; readonly targetId: EntityId }
  | { readonly type: 'phase'; readonly phase: RoundPhase };

/** Qué pasa al caer, según cómo se creó la sala. */
export type DeathRule = 'spectre' | 'lives';

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
  shrines: Shrine[];
  /** Lo que pasó en el último paso: el cliente lo usa para efectos y sonido. */
  events: GameEvent[];
  winnerTeam: number | null;
}
