import { DUEL_RULES } from '@crisol/content';
import {
  type Controller,
  type ElementId,
  type Intent,
  type MatchState,
  SPELL_WEAVES,
  type SpellId,
} from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { TrainingMatch } from './TrainingMatch';
import { Tutorial } from './Tutorial';

/** Un dedo de mentira: en cada paso hace lo que diga el guion para ese momento. */
class Script implements Controller {
  tick = 0;
  constructor(private readonly plan: (tick: number, state: MatchState) => Intent[]) {}
  intentsFor(state: Readonly<MatchState>): readonly Intent[] {
    return this.plan(this.tick++, state as MatchState);
  }
}

function castAt(state: MatchState, spell: SpellId): Intent[] {
  const me = state.wizards.find((w) => w.id === 1);
  const dummy = state.wizards.find((w) => w.id === 2);
  const dx = (dummy?.pos.x ?? 0) - (me?.pos.x ?? 0);
  const dz = (dummy?.pos.z ?? 1) - (me?.pos.z ?? 0);
  const length = Math.hypot(dx, dz) || 1;
  return [
    ...SPELL_WEAVES[spell].map((element: ElementId): Intent => ({ kind: 'weave', element })),
    { kind: 'cast', dirX: dx / length, dirZ: dz / length },
  ];
}

describe('Tutorial', () => {
  it('se completa paso a paso con lo que enseña, en la partida de práctica', () => {
    // Guion: caminar, Chispa, (leer), Chispa → Zarpa, Era de hielo → Rayo, Liana → Salpicón.
    const casts = new Map<number, SpellId>([
      [70, 'spark'],
      // Brasa descansa 3 s antes de la segunda Chispa.
      [170, 'spark'],
      [195, 'claw'],
      [290, 'iceAge'],
      // El Rayo, recién cuando el hielo ya cayó y lo congeló.
      [325, 'chainLightning'],
      [450, 'vine'],
      [475, 'splash'],
    ]);
    const finger = new Script((tick, state) => {
      const spell = casts.get(tick);
      if (spell) return castAt(state, spell);
      // Camina hacia el muñeco hasta quedar a unos 5 m.
      const me = state.wizards.find((w) => w.id === 1);
      const dummy = state.wizards.find((w) => w.id === 2);
      if (!me || !dummy) return [];
      const dx = dummy.pos.x - me.pos.x;
      const dz = dummy.pos.z - me.pos.z;
      const distance = Math.hypot(dx, dz);
      return distance > 5 ? [{ kind: 'move', x: dx / distance, z: dz / distance }] : [];
    });
    const match = new TrainingMatch(DUEL_RULES, finger, null);
    match.restless = false;
    const tutorial = new Tutorial(match.playerId);
    const reached: string[] = [];
    for (let i = 0; i < 700 && !tutorial.done; i++) {
      const title = tutorial.step?.title ?? '';
      const events = match.step();
      if (tutorial.onStep(events, match.state)) reached.push(title);
      if (tutorial.step?.goal.kind === 'read') {
        reached.push(tutorial.step.title);
        tutorial.next();
      }
    }
    expect(reached).toEqual([
      'Moverse',
      'Tejer y lanzar',
      'El descanso',
      'Combo: Brasa maldita',
      'Combo: Quiebre',
      'Combo: Amarre',
    ]);
    expect(tutorial.done).toBe(true);
  });
});
