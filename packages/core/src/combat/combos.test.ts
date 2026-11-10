import { describe, expect, it } from 'vitest';
import type { SpellPayload } from '../match/state';
import { TEST_RULES } from '../testing/rules.fixture';
import { scene, wizard } from '../testing/spellScene';
import type { Weave } from '../weaving/weave';
import { applyHit } from './hit';

const rules = TEST_RULES;

function payload(weave: Weave, damage = 10): SpellPayload {
  return {
    form: 'projectile',
    weave,
    damage,
    statuses: [],
    spell: 'spark',
    blastRadius: 0,
    pierce: false,
  };
}

function hitRival(status: 'soaked' | 'frozen' | 'root' | 'burn', weave: Weave) {
  const state = scene([{ x: 0, z: 4 }]);
  const rival = wizard(state, 2);
  rival.statuses[status] = { ticks: 60, sourceId: 1 };
  applyHit(state, rival, 1, payload(weave), rules);
  return { state, rival };
}

describe('reacciones entre estados', () => {
  it('Conducción: Tormenta sobre empapado aturde, pega más y seca el agua', () => {
    const { state, rival } = hitRival('soaked', ['tormenta']);
    expect(rival.statuses.stunned).toBeDefined();
    expect(rival.statuses.soaked).toBeUndefined();
    expect(rival.hp).toBeCloseTo(rival.maxHp - 12);
    expect(state.events).toContainEqual({
      type: 'combo',
      combo: 'conduction',
      targetId: 2,
      sourceId: 1,
    });
  });

  it('Quiebre: Tormenta sobre congelado rompe el hielo con 50% más', () => {
    const { rival } = hitRival('frozen', ['tormenta', 'brasa']);
    expect(rival.statuses.frozen).toBeUndefined();
    expect(rival.hp).toBeCloseTo(rival.maxHp - 15);
  });

  it('Leña: Brasa sobre enraizado quema sin soltar la raíz', () => {
    const { rival } = hitRival('root', ['brasa']);
    expect(rival.statuses.burn).toBeDefined();
    expect(rival.statuses.root).toBeDefined();
  });

  it('Vapor: Marea sobre quien arde apaga el fuego y escalda', () => {
    const { rival } = hitRival('burn', ['marea']);
    expect(rival.statuses.burn).toBeUndefined();
    expect(rival.statuses.scalded).toBeDefined();
  });

  it('Brasa maldita: Umbra sobre quien arde vuelve el fuego maldición', () => {
    const { rival } = hitRival('burn', ['umbra']);
    expect(rival.statuses.burn).toBeUndefined();
    expect(rival.statuses.curse).toBeDefined();
  });

  it('Lodazal: Raíz sobre empapado enraíza', () => {
    const { rival } = hitRival('soaked', ['raiz']);
    expect(rival.statuses.root).toBeDefined();
  });

  it('sin el estado previo no hay reacción', () => {
    const state = scene([{ x: 0, z: 4 }]);
    const rival = wizard(state, 2);
    applyHit(state, rival, 1, payload(['tormenta']), rules);
    expect(rival.statuses.stunned).toBeUndefined();
    expect(state.events.some((e) => e.type === 'combo')).toBe(false);
  });

  it('solo sale una reacción por golpe, la primera de la lista', () => {
    const state = scene([{ x: 0, z: 4 }]);
    const rival = wizard(state, 2);
    rival.statuses.soaked = { ticks: 60, sourceId: 1 };
    rival.statuses.frozen = { ticks: 60, sourceId: 1 };
    applyHit(state, rival, 1, payload(['tormenta']), rules);
    expect(state.events.filter((e) => e.type === 'combo')).toHaveLength(1);
    expect(rival.statuses.frozen).toBeDefined();
  });
});
