import { describe, expect, it } from 'vitest';
import { addToWeave, baseSpellCount, EMPTY_WEAVE, SPELL_FORM_BY_ELEMENT, weaveKey } from './weave';

describe('tejido', () => {
  it('acepta hasta tres elementos, con repetición', () => {
    let weave = EMPTY_WEAVE;
    weave = addToWeave(weave, 'marea');
    weave = addToWeave(weave, 'marea');
    weave = addToWeave(weave, 'umbra');
    weave = addToWeave(weave, 'brasa');
    expect(weave).toEqual(['marea', 'marea', 'umbra']);
  });

  it('el primer elemento define la familia', () => {
    expect(SPELL_FORM_BY_ELEMENT.brasa).toBe('projectile');
    expect(SPELL_FORM_BY_ELEMENT.marea).toBe('wall');
  });

  it('el orden cambia el conjuro', () => {
    expect(weaveKey(['brasa', 'marea'])).not.toBe(weaveKey(['marea', 'brasa']));
  });

  it('hay 155 conjuros base', () => {
    expect(baseSpellCount()).toBe(155);
  });
});
