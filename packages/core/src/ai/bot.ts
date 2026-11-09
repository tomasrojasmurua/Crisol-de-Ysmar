import type { Controller, Intent } from '../controllers/intent';
import type { ElementId } from '../elements';
import { ELEMENT_IDS } from '../elements';
import { currentTarget } from '../match/queries';
import type { MatchState, Projectile, Wizard } from '../match/state';
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

type AimMode = 'lead' | 'target' | 'away';

interface Plan {
  readonly elements: ElementId[];
  readonly aimMode: AimMode;
}

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

  constructor(
    seed: number,
    private readonly rules: GameRules,
    private readonly profile: BotProfile = DEFAULT_BOT,
  ) {
    this.rng = new SeededRng(seed);
  }

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    const target = currentTarget(state as MatchState, self as Wizard);
    if (!target) {
      return [{ kind: 'move', x: 0, z: 0 }];
    }
    const intents: Intent[] = [];
    if (self.lockTarget !== target.id) {
      intents.push({ kind: 'lockTarget', targetId: target.id });
    }
    const move = this.chooseMove(state, self, target);
    intents.push({ kind: 'move', x: move.x, z: move.z });

    if (self.channel || self.leap) {
      return intents;
    }
    const weaveIntent = this.chooseWeaveAction(state, self, target);
    if (weaveIntent) {
      intents.push(weaveIntent);
    }
    return intents;
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

    let first: ElementId;
    let aimMode: AimMode = 'target';
    if (threatened && available.includes('marea') && this.rng.next() < 0.6) {
      first = 'marea';
    } else if (d < 3.5 && available.includes('tormenta')) {
      first = 'tormenta';
      aimMode = 'away';
    } else {
      const options = available.filter((e) => suits(e, d, this.rules));
      first = this.pick(options.length > 0 ? options : available);
      if (first === 'brasa') aimMode = 'lead';
      if (first === 'tormenta') aimMode = d > 8 ? 'target' : 'away';
    }

    const length = this.rng.int(1, MAX_WEAVE_LENGTH);
    const elements: ElementId[] = [first];
    while (elements.length < length) {
      elements.push(this.pick(available));
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
    // Se aleja del borde de la arena.
    if (length(self.pos) > this.rules.arenaRadius * 0.75) {
      move = add(move, scale(normalize(self.pos), -1.5));
    }
    return normalize(move);
  }

  private aimFor(self: Readonly<Wizard>, target: Wizard, mode: AimMode): Vec2 {
    let aimPoint = target.pos;
    if (mode === 'lead') {
      const speed = this.rules.forms.projectile.speed;
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

  private pick<T>(options: readonly T[]): T {
    const choice = options[this.rng.int(0, options.length - 1)];
    if (choice === undefined) {
      throw new Error('No hay opciones para elegir');
    }
    return choice;
  }
}

/** Qué formas tienen sentido según la distancia al rival. */
function suits(element: ElementId, d: number, rules: GameRules): boolean {
  switch (element) {
    case 'brasa':
      return d <= rules.forms.projectile.range;
    case 'umbra':
      return d <= rules.forms.mark.range;
    case 'raiz':
      return d <= rules.forms.trap.range;
    case 'marea':
      return d <= rules.forms.wall.pulseRadius + rules.forms.wall.distance;
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
