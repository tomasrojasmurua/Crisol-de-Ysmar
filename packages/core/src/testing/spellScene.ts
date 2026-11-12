import type { Intent } from '../controllers/intent';
import type { ElementId } from '../elements';
import { createMatch } from '../match/createMatch';
import type { MatchState, Wizard } from '../match/state';
import { stepMatch } from '../match/step';
import type { Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { TEST_RULES } from './rules.fixture';

const rules = TEST_RULES;

/** El mago 1 en el origen mirando a +z; los demás son rivales en las posiciones dadas. */
export function scene(rivals: Vec2[], sceneRules: GameRules = rules): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [{ team: 0, spawn: { x: 0, z: 0 } }, ...rivals.map((spawn) => ({ team: 1, spawn }))],
    },
    sceneRules,
  );
}

export function wizard(state: MatchState, id: number): Wizard {
  const found = state.wizards.find((w) => w.id === id);
  if (!found) throw new Error(`No existe el mago ${id}`);
  return found;
}

export function cast(elements: ElementId[], dir: Vec2 = { x: 0, z: 1 }): Intent[] {
  return [
    ...elements.map((element): Intent => ({ kind: 'weave', element })),
    { kind: 'cast', dirX: dir.x, dirZ: dir.z },
  ];
}

/** Ejecuta `ticks` pasos; el mago 1 recibe `first` en el primero y los demás, `others` siempre. */
export function run(
  state: MatchState,
  ticks: number,
  first: Intent[] = [],
  sceneRules: GameRules = rules,
  others: ReadonlyMap<number, Intent[]> = new Map(),
): void {
  for (let i = 0; i < ticks; i++) {
    const intents = new Map(others);
    intents.set(1, i === 0 ? first : []);
    stepMatch(state, intents, sceneRules);
  }
}
