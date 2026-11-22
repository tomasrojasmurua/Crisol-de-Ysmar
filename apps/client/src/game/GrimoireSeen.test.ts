import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comboPage, GrimoireSeen } from './GrimoireSeen';

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

describe('GrimoireSeen', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('quien ya jugaba parte con lo suyo leído; lo nuevo queda marcado hasta leerlo', () => {
    const seen = new GrimoireSeen(() => ['h:brasa', comboPage('amarre')]);
    expect(seen.isNew('h:brasa')).toBe(false);
    expect(seen.unread(['h:brasa', 'h:marea', comboPage('amarre')])).toBe(1);
    expect(seen.markRead(['h:marea'])).toBe(true);
    expect(seen.markRead(['h:marea'])).toBe(false);
    // Al volver a abrir el juego no se vuelve a tomar lo escrito como leído.
    const again = new GrimoireSeen(() => ['h:raiz']);
    expect(again.isNew('h:marea')).toBe(false);
    expect(again.isNew('h:raiz')).toBe(true);
  });
});
