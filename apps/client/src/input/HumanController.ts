import {
  type Controller,
  currentTarget,
  type GameRules,
  type Intent,
  type MatchState,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { PlayerInput, ScreenVector } from './PlayerInput';

/** Traduce lo que hace el dedo a intenciones, con la misma forma que usan la IA y la red. */
export class HumanController implements Controller {
  constructor(
    private readonly input: PlayerInput,
    private readonly toGround: (screen: ScreenVector) => Vec2,
    private readonly rules: GameRules,
  ) {}

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    const intents: Intent[] = [];
    const move = this.toGround(this.input.move);
    intents.push({ kind: 'move', x: move.x, z: move.z });

    // Si el objetivo fijado cae, se pasa solo al enemigo más cercano.
    // Una bestia fijada a mano se mantiene mientras viva.
    const huntingBeast = state.beasts.some((b) => b.id === self.lockTarget && b.hp > 0);
    const target = currentTarget(state as MatchState, self as Wizard, this.rules);
    if (target && !huntingBeast && self.lockTarget !== target.id) {
      intents.push({ kind: 'lockTarget', targetId: target.id });
    }

    for (const action of this.input.drain()) {
      switch (action.type) {
        case 'weave':
          intents.push({ kind: 'weave', element: action.element });
          break;
        case 'cancel':
          intents.push({ kind: 'cancelWeave' });
          break;
        case 'lock':
          intents.push({ kind: 'lockTarget', targetId: action.targetId });
          break;
        case 'cast': {
          const aim = action.aim ? this.toGround(action.aim) : { x: 0, z: 0 };
          intents.push({ kind: 'cast', dirX: aim.x, dirZ: aim.z });
          break;
        }
      }
    }
    return intents;
  }
}
