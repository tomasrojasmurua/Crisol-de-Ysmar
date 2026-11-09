import type { Controller, Intent } from '../controllers/intent';
import type { ElementId } from '../elements';
import { ELEMENT_IDS } from '../elements';
import { lineBlocked } from '../match/obstacles';
import { currentTarget, isAlive } from '../match/queries';
import { isSpectre, roundPhase } from '../match/round';
import type { Beast, MatchState, Projectile, Shrine, Wizard } from '../match/state';
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
import { MAX_WEAVE_LENGTH } from '../weaving/weave';
import { Navigator } from './navigation';
import { type AimMode, type Plan, spellOptions } from './spellPlans';

export interface BotProfile {
  /** Pasos de "pensar" entre un conjuro y el siguiente. */
  readonly reactionTicks: readonly [number, number];
  /** Error de puntería máximo, en radianes. */
  readonly aimError: number;
  /** Distancia que intenta mantener con su rival. */
  readonly preferredDistance: number;
}

export const DEFAULT_BOT: BotProfile = {
  reactionTicks: [14, 32],
  aimError: 0.14,
  preferredDistance: 7,
};

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
      return this.spectreIntents(state, self);
    }
    const target = currentTarget(state as MatchState, self as Wizard, this.rules);
    if (!target) {
      return [{ kind: 'move', x: 0, z: 0 }];
    }
    const intents: Intent[] = [];
    const beast = this.beastToHunt(state, self, target);
    const lockId = beast ? beast.id : target.id;
    if (self.lockTarget !== lockId) {
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
    if (spells.length > 0 && this.rng.next() < 0.8) {
      return this.pickWeighted(spells);
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

    const threat = incomingProjectiles(state, self)[0];
    if (threat) {
      const side = perpendicular(normalize(threat.velocity));
      const away = dot(side, sub(self.pos, threat.pos)) >= 0 ? 1 : -1;
      move = add(move, scale(side, 2 * away));
    }
    return this.keepInZone(state, self, move);
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
    const threat = incomingProjectiles(state, self)[0];
    const dodge = threat ? scale(perpendicular(normalize(threat.velocity)), 1.5) : { x: 0, z: 0 };
    return this.keepInZone(state, self, add(toward, dodge));
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

  /** Como espectro: busca a un aliado que lo levante o persigue enemigos con su Lamento. */
  private spectreIntents(state: Readonly<MatchState>, self: Readonly<Wizard>): Intent[] {
    if (!isSpectre(state as MatchState, self as Wizard)) {
      return [];
    }
    const ally = state.wizards.find((w) => w.team === self.team && w.id !== self.id && isAlive(w));
    const enemy = currentTarget(state as MatchState, self as Wizard, this.rules);
    const intents: Intent[] = [];
    const goal = ally ?? enemy;
    if (goal) {
      const offset = sub(goal.pos, self.pos);
      const stop = ally
        ? this.rules.death.revive.radius * 0.5
        : this.rules.death.spectre.hauntRange * 0.7;
      const move = length(offset) > stop ? normalize(offset) : { x: 0, z: 0 };
      intents.push({ kind: 'move', x: move.x, z: move.z });
    }
    if (
      enemy &&
      self.fallen &&
      self.fallen.hauntCooldown === 0 &&
      distance(enemy.pos, self.pos) <= this.rules.death.spectre.hauntRange
    ) {
      intents.push({ kind: 'cast', dirX: 0, dirZ: 0 });
    }
    return intents;
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

  private pickWeighted(options: readonly (Plan & { readonly weight: number })[]): Plan {
    const total = options.reduce((sum, o) => sum + o.weight, 0);
    let roll = this.rng.next() * total;
    for (const option of options) {
      roll -= option.weight;
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
