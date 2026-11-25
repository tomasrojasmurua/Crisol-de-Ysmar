import type { Controller, Intent } from '../controllers/intent';
import type { ElementId } from '../elements';
import { ELEMENT_IDS } from '../elements';
import { lineBlocked } from '../match/obstacles';
import { currentTarget, isAlive, isHiddenFrom, wizardById } from '../match/queries';
import { roundPhase } from '../match/round';
import type {
  Beast,
  EntityId,
  MatchState,
  Projectile,
  Shrine,
  Strike,
  Summon,
  SummonKind,
  Wizard,
} from '../match/state';
import { stepMatch } from '../match/step';
import {
  add,
  distance,
  dot,
  length,
  normalize,
  perpendicular,
  scale,
  sub,
  type Vec2,
} from '../math/vec2';
import type { GameRules, StatusId } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { SeededRng } from '../sim/rng';
import { type SpellId, spellOf } from '../spells/catalog';
import { MAX_WEAVE_LENGTH } from '../weaving/weave';
import { Navigator } from './navigation';
import { type AimMode, type Plan, spellOptions } from './spellPlans';

/** Las dificultades de la IA: Aprendiz, Duelista y Maestro. */
export type BotLevel = 'apprentice' | 'duelist' | 'master';
export const BOT_LEVELS: readonly BotLevel[] = ['apprentice', 'duelist', 'master'];

/** Cómo juega un bot. Los valores de cada dificultad viven en `packages/content`. */
export interface BotProfile {
  /** Pasos de "pensar" entre un conjuro y el siguiente. */
  readonly reactionTicks: readonly [number, number];
  /** Error de puntería máximo, en radianes. */
  readonly aimError: number;
  /** Distancia que intenta mantener con su rival. */
  readonly preferredDistance: number;
  /** Probabilidad de esquivar un proyectil que viene hacia él. */
  readonly dodgeProjectiles: number;
  /** Probabilidad de salir del aviso de un golpe en el suelo (Meteoro, Era de hielo…). */
  readonly dodgeStrikes: number;
  /** Probabilidad de moverse de lado al ver que el rival canaliza un Gran hechizo. */
  readonly readWeave: number;
  /** Cuánto pesa un hechizo que usó hace poco, por cada vez (1: no le importa repetir). */
  readonly repeatPenalty: number;
  /** Probabilidad de improvisar un tejido al azar en vez de elegir uno pensado. */
  readonly improvise: number;
  /** Cuánto recuerda dónde vio al rival si lo pierde de vista (ceguera, Velo), en pasos. */
  readonly memoryTicks: number;
  /**
   * Pasos entre un toque y el siguiente al tejer (y antes de ✦), como un pulgar: una persona
   * no toca tres elementos en el mismo instante.
   */
  readonly tapTicks: number;
  /**
   * Pasos que tarda en reaccionar a un proyectil o a un aviso de suelo antes de empezar a
   * esquivar. Sin esto esquiva en el mismo instante en que aparece, cosa que nadie puede.
   */
  readonly dodgeDelayTicks: number;
  /**
   * Cuánto le gusta cada hechizo (1 si no se dice). Multiplica el peso de cada opción pensada
   * para que la IA elija en proporciones parecidas a las de las personas.
   */
  readonly taste?: Readonly<Partial<Record<SpellId, number>>>;
  /**
   * Peso de esperar en vez de lanzar algo que no le convence (con el mismo peso que una opción
   * pensada). Sin esto, con un solo elemento libre lanza lo que sea y se queda sin nada.
   */
  readonly patience?: number;
  /**
   * Cuántas de sus mejores opciones prueba antes de elegir: copia el duelo, juega unos
   * segundos con cada una (y con esperar) y se queda con la que deja mejor la cuenta de vida.
   * 0 elige sin probar.
   */
  readonly lookahead?: number;
  /**
   * Si está, solo teje estos hechizos (los de un linaje) y nunca improvisa. Sirve para medir
   * el balance de los sets de principiante.
   */
  readonly spellbook?: readonly SpellId[];
  /**
   * Si está, pelea primero contra este mago mientras siga vivo y a la vista (una cuenta
   * pendiente en la Historia); después, contra el rival de siempre.
   */
  readonly focus?: EntityId;
}

/** Un bot de nivel medio, para pruebas y para quien no elige dificultad. */
export const DEFAULT_BOT: BotProfile = {
  reactionTicks: [14, 32],
  aimError: 0.14,
  preferredDistance: 7,
  dodgeProjectiles: 0.7,
  dodgeStrikes: 0.75,
  readWeave: 0.4,
  repeatPenalty: 0.45,
  improvise: 0.2,
  memoryTicks: 90,
  tapTicks: 4,
  dodgeDelayTicks: 8,
};

/** Las invocaciones rivales que el bot rompe si las tiene cerca, y a cuántos metros. */
const PESTS: ReadonlySet<SummonKind> = new Set<SummonKind>(['wisp']);
const BREAK_RANGE = 6;

/** Hechizos usados hace poco que el bot recuerda para no repetirse. */
const RECENT_PLANS = 4;

/**
 * Hechicero controlado por la IA. Usa las mismas intenciones y reglas que un jugador:
 * teje un elemento por paso, así que su tejido se ve igual que el de una persona.
 */
export class BotController implements Controller {
  private readonly rng: SeededRng;
  private plan: Plan | null = null;
  private aimMode: AimMode = 'target';
  private thinkTicks = 20;
  private strafeSign = 1;
  private strafeTicks = 0;
  private readonly nav: Navigator;
  /** Dónde vio por última vez a su rival, para seguir peleando si lo pierde de vista. */
  private lastSeen: { readonly id: EntityId; readonly pos: Vec2; readonly tick: number } | null =
    null;
  /** Qué decidió ante cada amenaza (esquivar o no), para no volver a tirar el dado cada paso. */
  private readonly decisions = new Map<EntityId, boolean>();
  /** En qué paso vio por primera vez cada amenaza, para reaccionar con retraso. */
  private readonly firstSeen = new Map<EntityId, number>();
  /** Pasos que faltan para el próximo toque (tejer o lanzar). */
  private tapWait = 0;
  /** Velocidad del proyectil que va a lanzar, para adelantar bien la puntería. */
  private aimSpeed = 0;
  /** Las opciones que está probando, una por paso, antes de decidir (ver `lookahead`). */
  private trial: Trial | null = null;
  private readonly recent: string[] = [];

  constructor(
    seed: number,
    private readonly rules: GameRules,
    private readonly profile: BotProfile = DEFAULT_BOT,
  ) {
    this.rng = new SeededRng(seed);
    this.nav = new Navigator(rules);
  }

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    if (!isAlive(self as Wizard)) {
      this.plan = null;
      this.trial = null;
      return [];
    }
    const seen =
      this.focusTarget(state, self) ??
      currentTarget(state as MatchState, self as Wizard, this.rules);
    if (seen) this.lastSeen = { id: seen.id, pos: seen.pos, tick: state.tick };
    // Ciego o con el rival escondido: nunca se queda quieto. Pelea contra donde lo vio por
    // última vez y, si ya no lo recuerda, se mueve esquivando.
    const target = seen ?? this.remembered(state);
    if (!target) {
      const wander = this.wander(state, self);
      return [{ kind: 'move', x: wander.x, z: wander.z }];
    }
    const intents: Intent[] = [];
    const beast = seen ? this.beastToHunt(state, self, target) : undefined;
    const pest = seen && !beast ? this.summonToBreak(state, self) : undefined;
    const lockId = beast?.id ?? pest?.id ?? target.id;
    if (seen && self.lockTarget !== lockId) {
      intents.push({ kind: 'lockTarget', targetId: lockId });
    }
    const ally = this.allyToRevive(state, self, target);
    const shrine = ally || beast ? undefined : this.shrineToTake(state, self, target);
    let move: Vec2;
    if (ally) {
      move = this.keepInZone(state, self, normalize(sub(ally.pos, self.pos)));
    } else if (beast) {
      move = this.approach(state, self, beast.pos, 5.5);
    } else if (shrine) {
      move = this.approach(state, self, shrine.pos, 0.4);
    } else {
      move = this.chooseMove(state, self, target);
    }
    // Si un árbol o una roca tapa la meta, la rodea por la jungla.
    const goal = ally?.pos ?? beast?.pos ?? shrine?.pos ?? target.pos;
    const obstacles = this.rules.map.obstacles;
    const hidden = lineBlocked(self.pos, goal, obstacles, 0.5);
    if (hidden) {
      move = this.keepInZone(state, self, this.nav.directionTo(self.pos, goal));
    }
    // Mientras dirige el Relámpago guiado, el pulgar de moverse lleva el rayo hacia el rival.
    const bolt = state.spells.find((e) => e.kind === 'guidedBolt' && e.ownerId === self.id);
    if (bolt?.kind === 'guidedBolt' && self.statuses.steering) {
      move = normalize(sub(target.pos, bolt.pos), bolt.dir);
    }
    intents.push({ kind: 'move', x: move.x, z: move.z });

    if (self.channel || self.leap) {
      return intents;
    }
    // Con la Sombra lanzada, salta a ella si lo encimaron o está mal.
    if (self.weave.length === 0 && this.shouldJumpToShadow(state, self, target)) {
      intents.push({ kind: 'cast', dirX: 0, dirZ: 0 });
      return intents;
    }
    // No gasta conjuros en un tronco: espera a tener el blanco a la vista.
    const aimed = beast?.pos ?? target.pos;
    if (lineBlocked(self.pos, aimed, obstacles, 0.3)) {
      return intents;
    }
    if (beast || pest) {
      const hunt = this.huntAction(self);
      if (hunt) intents.push(hunt);
      return intents;
    }
    const weaveIntent = this.chooseWeaveAction(state, self, target);
    if (weaveIntent) {
      intents.push(weaveIntent);
    }
    return intents;
  }

  private shouldJumpToShadow(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): boolean {
    const mark = state.spells.find(
      (e) => e.kind === 'field' && e.mode === 'shadowMark' && e.ownerId === self.id,
    );
    if (mark?.kind !== 'field') return false;
    const close = distance(self.pos, target.pos) < 3.5;
    return close || self.hp / self.maxHp < 0.35 || mark.ticksLeft < 10;
  }

  private chooseWeaveAction(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): Intent | null {
    if (!this.plan && self.weave.length === 0) {
      // Probando opciones: una por paso, para no trabar el cuadro.
      if (this.trial) return this.continueTrial(state, self);
      // Si va a probar opciones, empieza antes: termina de pensar a la misma hora de siempre.
      const look = this.profile.lookahead ?? 0;
      if (--this.thinkTicks > (look > 0 ? look + 1 : 0)) {
        return null;
      }
      this.plan = this.choosePlan(state, self, target);
      const [min, max] = this.profile.reactionTicks;
      this.thinkTicks = this.rng.int(min, max);
      if (!this.plan) {
        return null;
      }
    }

    // Entre toque y toque pasa lo que tarda un pulgar.
    if (this.tapWait > 0) {
      this.tapWait--;
      return null;
    }
    this.tapWait = this.profile.tapTicks;
    const next = this.plan?.elements.shift();
    if (next !== undefined) {
      if (this.plan && this.plan.elements.length === 0) {
        this.aimMode = this.plan.aimMode;
        this.aimSpeed = projectileSpeed(this.rules, [...self.weave, next]);
        this.plan = null;
      }
      return { kind: 'weave', element: next };
    }

    this.plan = null;
    if (self.weave.length === 0) {
      return null;
    }
    const aim = this.aimFor(self, target, this.aimMode);
    return { kind: 'cast', dirX: aim.x, dirZ: aim.z };
  }

  private choosePlan(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): Plan | null {
    const available = ELEMENT_IDS.filter((e) => self.fatigue[e] === 0);
    if (available.length === 0) {
      return null;
    }
    const d = distance(self.pos, target.pos);
    const threatened = incomingProjectiles(state, self).length > 0;

    // Casi siempre elige un hechizo propio según la situación; a veces improvisa un tejido.
    const spells = spellOptions({ state, self, target, available, threatened });
    const book = this.profile.spellbook;
    if (book) return this.chooseFromBook(book, spells);
    if (spells.length > 0 && (this.profile.lookahead ?? 0) > 0) {
      this.trial = this.startTrial(state, target, spells);
      return null;
    }
    if (spells.length > 0 && this.rng.next() >= this.profile.improvise) {
      const plan = this.pickWeighted(spells, this.profile.patience ?? 0);
      return plan ? this.remember(plan) : null;
    }
    // Si nada cuadra, casi siempre espera a que descanse algo; solo a veces improvisa.
    if (spells.length === 0 && this.rng.next() >= this.profile.improvise) return null;

    let first: ElementId;
    let aimMode: AimMode = 'target';
    if (threatened && available.includes('marea') && this.rng.next() < 0.6) {
      first = 'marea';
    } else if (d < 3.5 && available.includes('tormenta')) {
      first = 'tormenta';
      aimMode = 'away';
    } else {
      const options = available.filter((e) => suits(e, d));
      first = this.pick(options.length > 0 ? options : available);
      if (first === 'brasa') aimMode = 'lead';
      if (first === 'tormenta') aimMode = d > 8 ? 'target' : 'away';
    }

    const length = this.rng.int(1, MAX_WEAVE_LENGTH);
    const elements: ElementId[] = [first];
    while (elements.length < length) {
      // Cada tanto refuerza el conjuro con su propio hilo, que se cansa menos.
      const own = self.affinity;
      const preferOwn = own !== null && available.includes(own) && this.rng.next() < 0.35;
      elements.push(preferOwn && own ? own : this.pick(available));
    }
    return { elements, aimMode };
  }

  private chooseMove(state: Readonly<MatchState>, self: Readonly<Wizard>, target: Wizard): Vec2 {
    const toTarget = normalize(sub(target.pos, self.pos));
    const d = distance(self.pos, target.pos);
    const preferred = this.profile.preferredDistance;
    const radial = d > preferred + 2 ? 1 : d < preferred - 2 ? -1 : 0;

    if (--this.strafeTicks <= 0) {
      this.strafeSign = this.rng.next() < 0.5 ? -1 : 1;
      this.strafeTicks = this.rng.int(40, 90);
    }
    let move = add(scale(toTarget, radial), scale(perpendicular(toTarget), this.strafeSign * 0.8));
    // Si el rival canaliza un Gran hechizo, se corre de lado para que no lo pille quieto.
    if (this.readsWeave(target)) {
      move = add(move, scale(perpendicular(toTarget), this.strafeSign * 1.6));
    }
    // Bajo la Lluvia de fuego de un rival, moverse quema: se queda quieto salvo para esquivar.
    if (underRivalRain(state, self, this.rules)) move = { x: 0, z: 0 };
    return this.keepInZone(state, self, add(move, this.dodge(state, self)));
  }

  /** El rival que perdió de vista, en el último lugar donde lo vio, mientras lo recuerde. */
  /** El mago con quien tiene una cuenta pendiente, si sigue vivo, es rival y está a la vista. */
  private focusTarget(state: Readonly<MatchState>, self: Readonly<Wizard>): Wizard | undefined {
    const focus = wizardById(state as MatchState, this.profile.focus ?? null);
    if (!focus || !isAlive(focus) || focus.team === self.team) return undefined;
    return isHiddenFrom(focus, self as Wizard, this.rules) ? undefined : focus;
  }

  private remembered(state: Readonly<MatchState>): Wizard | undefined {
    const last = this.lastSeen;
    if (!last || state.tick - last.tick > this.profile.memoryTicks) return undefined;
    const rival = state.wizards.find((w) => w.id === last.id && isAlive(w));
    // Una copia con la posición recordada: no se usa su posición real, que no ve.
    return rival ? { ...rival, pos: last.pos, moveInput: { x: 0, z: 0 } } : undefined;
  }

  /** Sin nadie a la vista: rodea el centro de la zona cambiando de lado, sin quedarse quieto. */
  private wander(state: Readonly<MatchState>, self: Readonly<Wizard>): Vec2 {
    if (--this.strafeTicks <= 0) {
      this.strafeSign = this.rng.next() < 0.5 ? -1 : 1;
      this.strafeTicks = this.rng.int(30, 70);
    }
    const toCenter = normalize(scale(self.pos, -1), self.facing);
    const around = add(scale(perpendicular(toCenter), this.strafeSign), scale(toCenter, 0.3));
    return this.keepInZone(state, self, add(around, this.dodge(state, self)));
  }

  /**
   * Hacia dónde correrse para esquivar: de lado ante un proyectil que viene, y hacia afuera
   * del aviso de un golpe en el suelo. Cada amenaza se decide una vez según la dificultad.
   */
  private dodge(state: Readonly<MatchState>, self: Readonly<Wizard>): Vec2 {
    let move: Vec2 = { x: 0, z: 0 };
    for (const projectile of incomingProjectiles(state, self)) {
      if (!this.noticed(state, projectile.id)) continue;
      if (!this.decide(projectile.id, this.profile.dodgeProjectiles)) continue;
      const side = perpendicular(normalize(projectile.velocity));
      const away = dot(side, sub(self.pos, projectile.pos)) >= 0 ? 1 : -1;
      move = add(move, scale(side, 2 * away));
      break;
    }
    const margin = this.rules.wizard.radius + 0.5;
    for (const strike of state.spells) {
      if (strike.kind !== 'strike' || strike.team === self.team || strike.ticksLeft <= 0) continue;
      const out = outOfStrike(strike, self.pos, margin);
      if (
        out &&
        this.noticed(state, strike.id) &&
        this.decide(strike.id, this.profile.dodgeStrikes)
      ) {
        move = add(move, scale(out, 3));
      }
    }
    return move;
  }

  /** Si ya pasó su tiempo de reacción desde que vio esta amenaza por primera vez. */
  private noticed(state: Readonly<MatchState>, id: EntityId): boolean {
    const seen = this.firstSeen.get(id);
    if (seen === undefined) {
      if (this.firstSeen.size > 64) this.firstSeen.clear();
      this.firstSeen.set(id, state.tick);
      return this.profile.dodgeDelayTicks <= 0;
    }
    return state.tick - seen >= this.profile.dodgeDelayTicks;
  }

  /** Tira el dado una sola vez por amenaza y recuerda lo que salió. */
  private decide(id: EntityId, chance: number): boolean {
    const known = this.decisions.get(id);
    if (known !== undefined) return known;
    if (this.decisions.size > 64) this.decisions.clear();
    const yes = this.rng.next() < chance;
    this.decisions.set(id, yes);
    return yes;
  }

  /** Si lee que el rival canaliza un Gran hechizo (una vez por canalización). */
  private readsWeave(target: Wizard): boolean {
    // Clave negativa: no choca con los ids de proyectiles y golpes.
    const key = -1 - target.id;
    if ((target.channel?.weave.length ?? 0) < MAX_WEAVE_LENGTH) {
      this.decisions.delete(key);
      return false;
    }
    return this.decide(key, this.profile.readWeave);
  }

  /** Anota el hechizo elegido, para que pese menos si lo quiere repetir enseguida. */
  private remember(plan: Plan): Plan {
    this.recent.push(plan.elements.join('>'));
    if (this.recent.length > RECENT_PLANS) this.recent.shift();
    return plan;
  }

  /** Durante la Caza, si no hay rivales cerca, va por la bestia más cercana. */
  private beastToHunt(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): Beast | undefined {
    if (roundPhase(state.tick, this.rules) !== 'hunt') return undefined;
    if (distance(self.pos, target.pos) < 12) return undefined;
    let best: Beast | undefined;
    // En un mapa grande vale la pena cruzar la jungla hasta un campamento.
    let bestDistance = 30;
    for (const beast of state.beasts) {
      let d = distance(beast.pos, self.pos);
      if (beast.guardian) {
        // El Guardián muerde fuerte: solo se lo enfrenta con buena vida, pero vale el viaje.
        const healthy = self.hp / self.maxHp;
        if (healthy < (beast.targetId === self.id ? 0.4 : 0.7)) continue;
        d /= 2;
      }
      if (d < bestDistance) {
        best = beast;
        bestDistance = d;
      }
    }
    return best;
  }

  /**
   * Una invocación rival que conviene romper antes de seguir con el mago: el Fuego fatuo que lo
   * persigue (cae de un golpe). Como un jugador, la fija y le tira un básico. Se decide una vez
   * por invocación, según qué tanto esquiva este bot. Al Pararrayos no: perseguirlo con
   * básicos le cuesta más de lo que le quita.
   */
  private summonToBreak(state: Readonly<MatchState>, self: Readonly<Wizard>): Summon | undefined {
    if (self.weave.length > 0 && self.lockTarget === null) return undefined;
    let best: Summon | undefined;
    let bestDistance = BREAK_RANGE;
    for (const spell of state.spells) {
      if (spell.kind !== 'summon' || spell.team === self.team || spell.hp <= 0) continue;
      if (!PESTS.has(spell.summon)) continue;
      const d = distance(spell.pos, self.pos);
      if (d > bestDistance || lineBlocked(self.pos, spell.pos, this.rules.map.obstacles, 0.3)) {
        continue;
      }
      if (!this.decide(-spell.id - 1_000_000, this.profile.dodgeProjectiles)) continue;
      best = spell;
      bestDistance = d;
    }
    return best;
  }

  /** En la Convergencia, un santuario cercano vale más que pelear de lejos. */
  private shrineToTake(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): Shrine | undefined {
    if (distance(self.pos, target.pos) < 6) return undefined;
    return state.shrines.find((s) => distance(s.pos, self.pos) < 14);
  }

  /** Contra una bestia basta un conjuro corto, apuntado solo. */
  private huntAction(self: Readonly<Wizard>): Intent | null {
    if (self.weave.length > 0) {
      return { kind: 'cast', dirX: 0, dirZ: 0 };
    }
    if (--this.thinkTicks > 0) return null;
    this.thinkTicks = this.rng.int(...this.profile.reactionTicks);
    const element = (['brasa', 'umbra'] as const).find((e) => self.fatigue[e] === 0);
    return element ? { kind: 'weave', element } : null;
  }

  private approach(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    goal: Vec2,
    stopAt: number,
  ): Vec2 {
    const offset = sub(goal, self.pos);
    const d = length(offset);
    const toward =
      d > stopAt + 0.5
        ? normalize(offset)
        : d < stopAt - 1
          ? scale(normalize(offset), -1)
          : { x: 0, z: 0 };
    return this.keepInZone(state, self, add(toward, this.dodge(state, self)));
  }

  /** Se aleja del borde: de la arena al principio y de la zona cuando se cierra. */
  private keepInZone(state: Readonly<MatchState>, self: Readonly<Wizard>, move: Vec2): Vec2 {
    const safeRadius = Math.min(this.rules.arenaRadius * 0.75, state.zoneRadius - 1.5);
    const fromCenter = length(self.pos);
    if (fromCenter > safeRadius) {
      const urgency = fromCenter > state.zoneRadius ? 4 : 1.5;
      move = add(move, scale(normalize(self.pos), -urgency));
    }
    return normalize(move);
  }

  /** Un aliado caído cerca, si no hay un enemigo encima: vale la pena ir a levantarlo. */
  private allyToRevive(
    state: Readonly<MatchState>,
    self: Readonly<Wizard>,
    target: Wizard,
  ): Wizard | undefined {
    if (distance(self.pos, target.pos) < 5) return undefined;
    return state.wizards.find(
      (w) =>
        w.team === self.team &&
        w.id !== self.id &&
        w.fallen !== null &&
        w.fallen.respawnTicks === null &&
        distance(w.pos, self.pos) < 12 &&
        distance(w.pos, self.pos) > this.rules.death.revive.radius * 0.6,
    );
  }

  private aimFor(self: Readonly<Wizard>, target: Wizard, mode: AimMode): Vec2 {
    let aimPoint = target.pos;
    if (mode === 'lead') {
      // Adelanta según la velocidad del proyectil que lanza; si no es uno, la de la Chispa.
      const speed = this.aimSpeed > 0 ? this.aimSpeed : this.rules.spells.spark.speed;
      const time = distance(self.pos, target.pos) / speed;
      aimPoint = add(target.pos, scale(target.moveInput, this.rules.wizard.moveSpeed * time));
    }
    let aim = normalize(sub(aimPoint, self.pos), self.facing);
    if (mode === 'away') {
      aim = scale(aim, -1);
    }
    const error = (this.rng.next() * 2 - 1) * this.profile.aimError;
    const cos = Math.cos(error);
    const sin = Math.sin(error);
    return { x: aim.x * cos - aim.z * sin, z: aim.x * sin + aim.z * cos };
  }

  /** Con un set cerrado: solo lo pensado para la situación que esté en el set. */
  private chooseFromBook(
    book: readonly SpellId[],
    spells: readonly (Plan & { readonly weight: number })[],
  ): Plan | null {
    const inBook = spells.filter((o) => {
      const id = spellOf(o.elements);
      return id !== null && book.includes(id);
    });
    // Si ninguno de su set cuadra ahora, espera: lanzar al azar gasta el elemento.
    const plan = inBook.length > 0 ? this.pickWeighted(inBook, 0) : null;
    return plan ? this.remember(plan) : null;
  }

  private pickWeighted(
    options: readonly (Plan & { readonly weight: number })[],
    waitWeight: number,
  ): Plan | null {
    const weightOf = (option: Plan & { readonly weight: number }): number => this.weightOf(option);
    const total = options.reduce((sum, o) => sum + weightOf(o), 0);
    let roll = this.rng.next() * (total + waitWeight);
    // Le tocó esperar: vuelve a pensar en un rato.
    if (roll >= total) return null;
    for (const option of options) {
      roll -= weightOf(option);
      if (roll <= 0) return { elements: [...option.elements], aimMode: option.aimMode };
    }
    const last = this.pick(options);
    return { elements: [...last.elements], aimMode: last.aimMode };
  }

  /** Cuánto pesa una opción: su peso pensado, el gusto y no repetirse. */
  private weightOf(option: Plan & { readonly weight: number }): number {
    // Lo que usó hace poco pesa menos: así no repite el mismo hechizo una y otra vez.
    const key = option.elements.join('>');
    const times = this.recent.filter((k) => k === key).length;
    // Con un set cerrado (los linajes, el valor de un hechizo) no hay gusto: se mide el set.
    const spell = this.profile.spellbook ? null : spellOf(option.elements);
    const taste = spell === null ? 1 : (this.profile.taste?.[spell] ?? 1);
    return option.weight * taste * this.profile.repeatPenalty ** times;
  }

  /**
   * Empieza a probar sus mejores opciones (`lookahead` de ellas, más esperar). Cada una se
   * juega en una copia del duelo durante `LOOKAHEAD_TICKS` pasos, con el rival manejado por
   * una IA sencilla, y gana la que deja mejor la cuenta: daño hecho menos daño recibido,
   * más cómo quedan parados los dos (`standing`: control, escudos, invocaciones).
   */
  private startTrial(
    state: Readonly<MatchState>,
    target: Wizard,
    options: readonly (Plan & { readonly weight: number })[],
  ): Trial {
    const seen = new Set<string>();
    const ranked = [...options]
      .sort((a, b) => this.weightOf(b) - this.weightOf(a))
      .filter((o) => {
        const key = o.elements.join('>');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, this.profile.lookahead ?? 0);
    // Las reglas a mano solo desempatan: entre dos parecidas, la que ellas prefieren.
    const top = Math.max(...ranked.map((o) => this.weightOf(o)), 1e-6);
    const prior = (weight: number): number =>
      TASTE_IN_SCORE * Math.log(Math.max(weight, 1e-3) / top);
    // Todas se prueban sobre la misma foto del duelo, para compararlas parejo.
    const snapshot = copyOf(state) as MatchState;
    return {
      snapshot,
      targetId: target.id,
      options: [null, ...ranked.map((o) => ({ elements: [...o.elements], aimMode: o.aimMode }))],
      priors: [prior(this.profile.patience ?? 0), ...ranked.map((o) => prior(this.weightOf(o)))],
      next: 0,
      best: null,
      bestScore: -Infinity,
    };
  }

  /** Prueba la siguiente opción; al terminar, se queda con la mejor (o espera). */
  private continueTrial(state: Readonly<MatchState>, self: Readonly<Wizard>): Intent | null {
    const trial = this.trial;
    if (!trial) return null;
    // Entre todos los bots de la partida, pocas pruebas por paso: el cuadro no se traba.
    if (!takeRollout(state)) return null;
    const option = trial.options[trial.next] ?? null;
    // El plan elegido empieza cuando termine de probar: en la copia también.
    const delay = trial.options.length;
    const score =
      this.rollout(trial.snapshot, self.id, trial.targetId, option, delay) +
      (trial.priors[trial.next] ?? 0);
    // Ante un empate, la primera probada (esperar va primero): no gasta por gastar.
    if (score > trial.bestScore) {
      trial.bestScore = score;
      trial.best = option;
    }
    trial.next++;
    if (trial.next < trial.options.length) return null;
    this.trial = null;
    if (trial.best) this.plan = this.remember(trial.best);
    return null;
  }

  /** Juega unos segundos en una copia del duelo con ese plan (o esperando) y da su cuenta. */
  private rollout(
    state: Readonly<MatchState>,
    selfId: EntityId,
    targetId: EntityId,
    plan: Plan | null,
    delay: number,
  ): number {
    const sim = copyOf(state) as MatchState;
    const me = sim.wizards.find((w) => w.id === selfId);
    const foe = sim.wizards.find((w) => w.id === targetId);
    if (!me || !foe) return 0;
    const rival = new BotController(sim.tick * 7 + foe.id, this.rules, ROLLOUT_RIVAL);
    const queue = plan ? [...plan.elements] : [];
    const speed = plan ? projectileSpeed(this.rules, plan.elements) : 0;
    let pending = plan !== null;
    let wait = delay;
    const myStart = me.hp;
    const foeStart = foe.hp;
    for (let t = 0; t < LOOKAHEAD_TICKS && sim.winnerTeam === null; t++) {
      const mine: Intent[] = [{ kind: 'move', x: me.moveInput.x, z: me.moveInput.z }];
      if (!me.channel && wait-- <= 0) {
        const next = queue.shift();
        if (next !== undefined) {
          mine.push({ kind: 'weave', element: next });
          wait = this.profile.tapTicks;
        } else if (pending && me.weave.length > 0) {
          const aim = cleanAim(me, foe, plan?.aimMode ?? 'target', speed, this.rules);
          mine.push({ kind: 'cast', dirX: aim.x, dirZ: aim.z });
          pending = false;
        }
      }
      stepMatch(
        sim,
        new Map([
          [me.id, mine],
          [foe.id, rival.intentsFor(sim, foe)],
        ]),
        this.rules,
      );
    }
    const dealt = foeStart - Math.max(0, foe.hp);
    const taken = myStart - Math.max(0, me.hp);
    return (
      dealt -
      1.2 * taken +
      (foe.hp <= 0 ? 100 : 0) -
      (me.hp <= 0 ? 150 : 0) +
      standing(sim, me, foe) -
      standing(state, startOf(state, selfId), startOf(state, targetId))
    );
  }

  private pick<T>(options: readonly T[]): T {
    const choice = options[this.rng.int(0, options.length - 1)];
    if (choice === undefined) {
      throw new Error('No hay opciones para elegir');
    }
    return choice;
  }
}

/** Qué primer elemento tiene sentido según la distancia al rival, para improvisar. */
function suits(element: ElementId, d: number): boolean {
  switch (element) {
    case 'brasa':
      return d <= 14;
    case 'umbra':
      return d <= 8;
    case 'raiz':
    case 'marea':
      return d <= 8;
    case 'tormenta':
      return d < 4 || d > 10;
  }
}

/** Copia profunda de datos simples (el estado del duelo no guarda clases ni funciones). */
function copyOf<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => copyOf(item)) as T;
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = copyOf(item);
    return copy as T;
  }
  return value;
}

/** Lo que lleva probado antes de decidir. `null` es esperar. */
interface Trial {
  readonly snapshot: Readonly<MatchState>;
  readonly targetId: EntityId;
  readonly options: readonly (Plan | null)[];
  /** Lo que suma a la cuenta de cada opción cuánto le gusta (0 a la favorita, menos al resto). */
  readonly priors: readonly number[];
  next: number;
  best: Plan | null;
  bestScore: number;
}

/**
 * Cuántas pruebas hacen entre todos los bots de una partida en un mismo paso. Con 5 Maestros
 * en un todos contra todos, se turnan en vez de probar todos a la vez en el mismo cuadro.
 */
const ROLLOUTS_PER_TICK = 1;
/** Cuántos puntos de vida vale lo que prefieren las reglas: por cada vez que pesa e veces más. */
const TASTE_IN_SCORE = 4;
const rolloutBudget = new WeakMap<object, { tick: number; used: number }>();

/** Si queda presupuesto de pruebas en este paso de esta partida (y lo gasta). */
function takeRollout(state: Readonly<MatchState>): boolean {
  const budget = rolloutBudget.get(state);
  if (!budget || budget.tick !== state.tick) {
    rolloutBudget.set(state, { tick: state.tick, used: 1 });
    return true;
  }
  if (budget.used >= ROLLOUTS_PER_TICK) return false;
  budget.used++;
  return true;
}

/** Cuántos pasos juega hacia adelante al probar una opción: 1,5 segundos. */
const LOOKAHEAD_TICKS = 45;

/** El rival imaginado al probar opciones: un Duelista que no prueba nada (sin recursión). */
const ROLLOUT_RIVAL: BotProfile = { ...DEFAULT_BOT, improvise: 0 };

/** Estados que dejan mal a quien los tiene: controlado, debilitado o marcado. */
const HARMFUL: readonly StatusId[] = [
  'burn',
  'slow',
  'root',
  'curse',
  'airborne',
  'silenced',
  'weak',
  'blind',
  'frozen',
  'asleep',
  'soaked',
  'sluggish',
  'exposed',
  'combusting',
  'plague',
  'tracked',
  'stunned',
  'halted',
  'scalded',
  'withered',
  'grounded',
  'hexed',
  'rotting',
];
/** Estados que ayudan a quien los tiene. */
const HELPFUL: readonly StatusId[] = [
  'empowered',
  'veiled',
  'regen',
  'haste',
  'phased',
  'quickened',
  'warded',
  'insight',
  'hunting',
  'unseen',
  'shrouded',
  'disguised',
  'untouchable',
  'kindled',
  'deepRooted',
  'magma',
  'surfing',
  'panther',
  'thorny',
  'vengeful',
  'leeching',
];

/**
 * Cómo queda parado un mago frente a otro más allá de la vida, en puntos de vida: estados
 * (cada segundo de control o de ayuda que le queda), escudo, invocaciones en pie y elementos
 * libres para responder. Así la IA valora un Muro, una invocación o una Pesadilla, no solo
 * el daño inmediato.
 */
function standing(
  state: Readonly<MatchState>,
  me: Wizard | undefined,
  foe: Wizard | undefined,
): number {
  if (!me || !foe) return 0;
  const seconds = (w: Wizard, ids: readonly StatusId[]): number =>
    ids.reduce((sum, id) => sum + Math.min(3, (w.statuses[id]?.ticks ?? 0) / TICK_RATE), 0);
  let summons = 0;
  for (const spell of state.spells) {
    if (spell.kind !== 'summon' || spell.hp <= 0) continue;
    if (spell.ownerId === me.id) summons += Math.min(spell.hp, 60);
    else if (spell.ownerId === foe.id) summons -= Math.min(spell.hp, 60);
  }
  const free = (w: Wizard): number => ELEMENT_IDS.filter((e) => w.fatigue[e] === 0).length;
  return (
    STANDING.status * (seconds(foe, HARMFUL) - seconds(me, HARMFUL)) +
    STANDING.status * 0.6 * (seconds(me, HELPFUL) - seconds(foe, HELPFUL)) +
    STANDING.shield * (me.shield - foe.shield) +
    STANDING.summon * summons +
    STANDING.free * (free(me) - free(foe))
  );
}

/** Cuántos puntos de vida vale cada cosa de `standing`. */
const STANDING = { status: 4, shield: 0.8, summon: 0.3, free: 2 };

function startOf(state: Readonly<MatchState>, id: EntityId): Wizard | undefined {
  return state.wizards.find((w) => w.id === id);
}

/** Apuntar sin error, adelantando a un rival que se mueve si el proyectil tiene velocidad. */
function cleanAim(
  self: Readonly<Wizard>,
  target: Readonly<Wizard>,
  mode: AimMode,
  speed: number,
  rules: GameRules,
): Vec2 {
  let point = target.pos;
  if (mode === 'lead' && speed > 0) {
    const time = distance(self.pos, target.pos) / speed;
    point = add(target.pos, scale(target.moveInput, rules.wizard.moveSpeed * time));
  }
  const aim = normalize(sub(point, self.pos), self.facing);
  return mode === 'away' ? scale(aim, -1) : aim;
}

/** La velocidad del proyectil de ese tejido, o 0 si no lanza uno con velocidad propia. */
function projectileSpeed(rules: GameRules, weave: readonly ElementId[]): number {
  const spell = spellOf(weave);
  if (spell === null) return 0;
  const speed = (rules.spells as unknown as Record<string, { readonly speed?: unknown }>)[spell]
    ?.speed;
  return typeof speed === 'number' && speed > 0 ? speed : 0;
}

function incomingProjectiles(state: Readonly<MatchState>, self: Readonly<Wizard>): Projectile[] {
  return state.spells.filter(
    (s): s is Projectile =>
      s.kind === 'projectile' &&
      s.team !== self.team &&
      distance(s.pos, self.pos) < 6 &&
      dot(s.velocity, sub(self.pos, s.pos)) > 0,
  );
}

/**
 * Hacia dónde salir del aviso de un golpe en el suelo (círculo o línea), o null si no lo
 * alcanza. `margin` es cuánto más allá del borde quiere quedar.
 */
function outOfStrike(strike: Strike, pos: Vec2, margin: number): Vec2 | null {
  const reach = strike.radius + margin;
  if (!strike.line) {
    const offset = sub(pos, strike.pos);
    if (length(offset) >= reach) return null;
    return normalize(offset, { x: 1, z: 0 });
  }
  const { dir, length: span } = strike.line;
  const along = Math.max(0, Math.min(span, dot(sub(pos, strike.pos), dir)));
  const closest = add(strike.pos, scale(dir, along));
  const offset = sub(pos, closest);
  if (length(offset) >= reach) return null;
  return normalize(offset, perpendicular(dir));
}

/** Si está al alcance de la Lluvia de fuego de un rival. */
function underRivalRain(state: Readonly<MatchState>, self: Readonly<Wizard>, rules: GameRules) {
  return state.spells.some((s) => {
    if (s.kind !== 'fireRain' || s.team === self.team) return false;
    const owner = wizardById(state as MatchState, s.ownerId);
    return owner !== undefined && distance(owner.pos, self.pos) <= rules.spells.fireRain.radius;
  });
}
