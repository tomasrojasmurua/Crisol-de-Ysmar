import { describe, expect, it } from 'vitest';
import { SPELL_FORM_BY_ELEMENT, weaveKey } from './weave';

describe('tejido', () => {
  it('el primer elemento define la familia', () => {
    expect(SPELL_FORM_BY_ELEMENT.brasa).toBe('projectile');
    expect(SPELL_FORM_BY_ELEMENT.marea).toBe('wall');
  });

  it('el orden cambia el conjuro', () => {
    expect(weaveKey(['brasa', 'marea'])).not.toBe(weaveKey(['marea', 'brasa']));
  });
});
