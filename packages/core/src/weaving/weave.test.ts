import { describe, expect, it } from 'vitest';
import { addToWeave, baseSpellCount, EMPTY_WEAVE, recipeOf, weaveKey } from './weave';

describe('tejido', () => {
  it('acepta hasta tres elementos, con repetición', () => {
    let weave = EMPTY_WEAVE;
    weave = addToWeave(weave, 'marea');
    weave = addToWeave(weave, 'marea');
    weave = addToWeave(weave, 'umbra');
    weave = addToWeave(weave, 'brasa');
    expect(weave).toEqual(['marea', 'marea', 'umbra']);
  });

  it('el primer elemento define la forma', () => {
    expect(recipeOf(['brasa', 'marea'])?.form).toBe('projectile');
    expect(recipeOf(['marea', 'brasa'])?.form).toBe('wall');
  });

  it('el orden cambia el conjuro', () => {
    expect(weaveKey(['brasa', 'marea'])).not.toBe(weaveKey(['marea', 'brasa']));
  });

  it('un tejido vacío no produce conjuro', () => {
    expect(recipeOf(EMPTY_WEAVE)).toBeNull();
  });

  it('hay 155 conjuros base', () => {
    expect(baseSpellCount()).toBe(155);
  });
});
