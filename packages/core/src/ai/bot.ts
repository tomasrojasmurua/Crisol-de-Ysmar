import type { Controller, Intent } from '../controllers/intent';
import type { ElementId } from '../elements';
import { ELEMENT_IDS } from '../elements';
import { lineBlocked } from '../match/obstacles';
import { currentTarget, isAlive } from '../match/queries';
import { roundPhase } from '../match/round';
import type {
  Beast,
  EntityId,
  MatchState,
  Projectile,
  Shrine,
  Strike,
  Wizard,
} from '../match/state';
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
import type { GameRules } from '../rules';
import { SeededRng } from '../sim/rng';
import { SPELL_WEAVES, type SpellId, spellOf } from '../spells/catalog';
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
   * Si está, solo teje estos hechizos (los de una escuela) y nunca improvisa. Sirve para medir
   * el balance de los sets de principiante.
   */
  readonly spellbook?: readonly SpellId[];
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
};

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
      return [];
    }
    const seen = currentTarget(state as MatchState, self as Wizard, this.rules);
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
    const lockId = beast ? beast.id : target.id;
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
    if (beast) {
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
      if (--this.thinkTicks > 0) {
        return null;
      }
      this.plan = this.choosePlan(state, self, target);
      const [min, max] = this.profile.reactionTicks;
      this.thinkTicks = this.rng.int(min, max);
      if (!this.plan) {
        return null;
      }
    }

    const next = this.plan?.elements.shift();
    if (next !== undefined) {
      if (this.plan && this.plan.elements.length === 0) {
        this.aimMode = this.plan.aimMode;
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
    if (book) return this.chooseFromBook(book, spells, available);
    if (spells.length > 0 && this.rng.next() >= this.profile.improvise) {
      return this.remember(this.pickWeighted(spells));
    }

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
    return this.keepInZone(state, self, add(move, this.dodge(state, self)));
  }

  /** El rival que perdió de vista, en el último lugar donde lo vio, mientras lo recuerde. */
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
      if (out && this.decide(strike.id, this.profile.dodgeStrikes)) {
        move = add(move, scale(out, 3));
      }
    }
    return move;
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
      const speed = this.rules.spells.spark.speed;
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

  /** Con un set cerrado: lo pensado que esté en el set, o cualquiera del set que se pueda. */
  private chooseFromBook(
    book: readonly SpellId[],
    spells: readonly (Plan & { readonly weight: number })[],
    available: readonly ElementId[],
  ): Plan | null {
    const inBook = spells.filter((o) => {
      const id = spellOf(o.elements);
      return id !== null && book.includes(id);
    });
    if (inBook.length > 0) return this.remember(this.pickWeighted(inBook));
    const ready = book
      .map((id) => SPELL_WEAVES[id])
      .filter((weave) => weave.every((e) => available.includes(e)));
    const weave = ready.length > 0 ? ready[this.rng.int(0, ready.length - 1)] : undefined;
    return weave ? this.remember({ elements: [...weave], aimMode: 'target' }) : null;
  }

  private pickWeighted(options: readonly (Plan & { readonly weight: number })[]): Plan {
    // Lo que usó hace poco pesa menos: así no repite el mismo hechizo una y otra vez.
    const weightOf = (option: Plan & { readonly weight: number }): number => {
      const key = option.elements.join('>');
      const times = this.recent.filter((k) => k === key).length;
      return option.weight * this.profile.repeatPenalty ** times;
    };
    const total = options.reduce((sum, o) => sum + weightOf(o), 0);
    let roll = this.rng.next() * total;
    for (const option of options) {
      roll -= weightOf(option);
      if (roll <= 0) return { elements: [...option.elements], aimMode: option.aimMode };
    }
    const last = this.pick(options);
    return { elements: [...last.elements], aimMode: last.aimMode };
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
