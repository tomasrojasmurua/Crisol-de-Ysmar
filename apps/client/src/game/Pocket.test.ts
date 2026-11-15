import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POCKET_SIZE, Pocket } from './Pocket';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('Pocket', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('guarda hasta 3 hechizos en el orden en que se marcaron', () => {
    const pocket = new Pocket();
    expect(pocket.toggle(['marea', 'brasa'])).toBe(true);
    expect(pocket.toggle(['raiz'])).toBe(true);
    expect(pocket.toggle(['tormenta', 'tormenta', 'marea'])).toBe(true);
    expect(pocket.full).toBe(true);
    expect(pocket.toggle(['umbra', 'umbra'])).toBe(false);
    expect(pocket.weaves).toHaveLength(POCKET_SIZE);
    expect(new Pocket().weaves).toEqual([
      ['marea', 'brasa'],
      ['raiz'],
      ['tormenta', 'tormenta', 'marea'],
    ]);
  });

  it('sacar uno deja lugar para otro', () => {
    const pocket = new Pocket();
    pocket.toggle(['marea', 'brasa']);
    pocket.toggle(['marea', 'brasa']);
    expect(pocket.has(['marea', 'brasa'])).toBe(false);
    expect(new Pocket().weaves).toEqual([]);
  });

  it('ignora lo guardado que no es un tejido, los repetidos y lo que sobra', () => {
    localStorage.setItem(
      'crisol.bolsillo',
      JSON.stringify(['marea-brasa', 'nada', 'marea-brasa', 'raiz', 'umbra', 'brasa', 7]),
    );
    expect(new Pocket().weaves).toEqual([['marea', 'brasa'], ['raiz'], ['umbra']]);
  });
});
