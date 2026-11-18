import { SPELL_WEAVES } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { SPELL_INTENTS } from './intents';

/** Los hechizos de dos elementos que terminan en un elemento dado. */
const endingIn = (element: string) =>
  Object.entries(SPELL_WEAVES)
    .filter(([, weave]) => weave.length === 2 && weave[1] === element)
    .map(([id]) => id as keyof typeof SPELL_INTENTS);

describe('la receta de los hechizos de dos elementos', () => {
  it('con Brasa de segunda, todos hacen daño', () => {
    expect(endingIn('brasa').map((id) => SPELL_INTENTS[id])).toEqual(Array(5).fill('damage'));
  });

  it('con Tormenta de segunda, todos te mueven (o te apuran, como la Corriente)', () => {
    for (const id of endingIn('tormenta')) {
      expect(['movement', 'support'], id).toContain(SPELL_INTENTS[id]);
    }
  });

  it('con Marea de segunda, ninguno es daño: protegen o estorban', () => {
    for (const id of endingIn('marea')) {
      expect(['support', 'control'], id).toContain(SPELL_INTENTS[id]);
    }
  });

  it('con Raíz de segunda, ninguno te mueve: se quedan donde los dejas', () => {
    for (const id of endingIn('raiz')) expect(SPELL_INTENTS[id], id).not.toBe('movement');
  });
});
