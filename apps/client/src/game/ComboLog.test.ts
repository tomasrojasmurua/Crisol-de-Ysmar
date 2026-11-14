import { COMBOS } from '@crisol/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboLog } from './ComboLog';

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

const byId = (id: string) => {
  const combo = COMBOS.find((c) => c.id === id);
  if (!combo) throw new Error(id);
  return combo;
};

describe('ComboLog', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('empieza sin combos y el tutorial entrega el de tu escuela', () => {
    const log = new ComboLog();
    expect(log.unlockedCount).toBe(0);
    expect(log.tutorialDone).toBe(false);
    log.gift('hilo-a-ciegas');
    expect(log.unlockedCount).toBe(1);
    const again = new ComboLog();
    expect(again.tutorialDone).toBe(true);
    expect(again.isUnlocked(byId('hilo-a-ciegas'))).toBe(true);
    expect(again.isUnlocked(byId('amarre'))).toBe(false);
  });

  it('quien hizo el tutorial de antes conserva sus 3 combos', () => {
    localStorage.setItem('crisol.tutorial', 'true');
    const log = new ComboLog();
    expect(log.tutorialDone).toBe(true);
    expect(log.isUnlocked(byId('amarre'))).toBe(true);
    expect(log.unlockedCount).toBe(3);
  });

  it('un combo del tutorial también aparece si se acierta 3 veces en partidas', () => {
    const log = new ComboLog();
    log.record('quiebre');
    log.record('quiebre');
    expect(log.record('quiebre')?.id).toBe('quiebre');
  });

  it('un combo aparece al tercer acierto y queda guardado', () => {
    const log = new ComboLog();
    expect(log.record('lena')).toBeNull();
    expect(log.record('lena')).toBeNull();
    expect(log.record('lena')?.name).toBe('Leña');
    expect(new ComboLog().isUnlocked(byId('lena'))).toBe(true);
  });

  it('los más poderosos piden 5 aciertos', () => {
    const log = new ComboLog();
    for (let i = 0; i < 4; i++) expect(log.record('raiz-y-hoguera')).toBeNull();
    expect(log.record('raiz-y-hoguera')?.id).toBe('raiz-y-hoguera');
  });

  it('cada reacción del juego tiene su combo', () => {
    expect(ComboLog.forReaction('kindling')?.id).toBe('lena');
    expect(ComboLog.forReaction('ashenCurse')?.id).toBe('brasa-maldita');
  });

  it('guarda, cambia y borra combos propios de hasta 4 hechizos', () => {
    const log = new ComboLog();
    const saved = log.saveOwn({
      name: '  Mi trampa ',
      steps: ['vine', 'fireball', 'claw', 'spark', 'splash'],
      note: 'Contra Benja',
    });
    expect(saved.name).toBe('Mi trampa');
    expect(saved.steps).toHaveLength(4);
    log.saveOwn({ ...saved, name: 'Otra' });
    expect(new ComboLog().ownCombos.map((c) => c.name)).toEqual(['Otra']);
    log.removeOwn(saved.id);
    expect(new ComboLog().ownCombos).toHaveLength(0);
  });

  it('ignora guardados rotos', () => {
    localStorage.setItem('crisol.combos', '{"lena": "mucho", "nada": 4}');
    localStorage.setItem(
      'crisol.misCombos',
      '[{"id": 1}, {"id": "x", "name": "Y", "steps": ["nope", "spark"]}]',
    );
    const log = new ComboLog();
    expect(log.unlockedCount).toBe(0);
    expect(log.ownCombos).toEqual([{ id: 'x', name: 'Y', steps: ['spark'], note: '' }]);
  });
});
