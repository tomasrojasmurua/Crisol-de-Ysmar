import {
  type Controller,
  type Intent,
  type MatchState,
  nearestEnemy,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { PlayerInput, ScreenVector } from './PlayerInput';

/** Traduce lo que hace el dedo a intenciones, con la misma forma que usan la IA y la red. */
export class HumanController implements Controller {
  constructor(
    private readonly input: PlayerInput,
    private readonly toGround: (screen: ScreenVector) => Vec2,
  ) {}

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    const intents: Intent[] = [];
    const move = this.toGround(this.input.move);
    intents.push({ kind: 'move', x: move.x, z: move.z });

    // En el duelo 1v1 el objetivo se fija solo en el rival más cercano.
    const enemy = nearestEnemy(state as MatchState, self as Wizard);
    if (enemy && self.lockTarget !== enemy.id) {
      intents.push({ kind: 'lockTarget', targetId: enemy.id });
    }

    for (const action of this.input.drain()) {
      switch (action.type) {
        case 'weave':
          intents.push({ kind: 'weave', element: action.element });
          break;
        case 'cancel':
          intents.push({ kind: 'cancelWeave' });
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
