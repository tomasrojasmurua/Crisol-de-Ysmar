import {
  autoTarget,
  type Controller,
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
    private readonly moveToGround: (screen: ScreenVector) => Vec2,
    private readonly aimToGround: (screen: ScreenVector) => Vec2,
    private readonly rules: GameRules,
  ) {}

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    const intents: Intent[] = [];
    const move = this.moveToGround(this.input.move);
    intents.push({ kind: 'move', x: move.x, z: move.z });

    // Solo se fija tocando. Lo fijado se suelta solo si cae, se esconde o se aleja demasiado:
    // así el disparo y la cámara vuelven a elegir lo mejor puesto. Antes el juego fijaba solo
    // al más cercano y ya no lo soltaba, aunque otro te estuviera atacando al lado.
    if (self.lockTarget !== null) {
      const target = autoTarget(state as MatchState, self as Wizard, this.rules);
      if (target?.id !== self.lockTarget) intents.push({ kind: 'lockTarget', targetId: null });
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
          const aim = action.aim ? this.aimToGround(action.aim) : { x: 0, z: 0 };
          intents.push({ kind: 'cast', dirX: aim.x, dirZ: aim.z });
          break;
        }
      }
    }
    return intents;
  }
}
