import { ELEMENT_IDS, modeSetup, obstacleAt } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { AFFINITY_RULES } from './affinity';
import { ELEMENTS } from './elements';
import { ALL_WEAVES, spellName, weaveKey } from './grimoire';
import { MAP, MAP_RADIUS } from './map';
import { GAME_RULES } from './rules';

describe('tablas de contenido', () => {
  it('describe exactamente los cinco elementos del núcleo, en el mismo orden', () => {
    expect(ELEMENTS.map((element) => element.id)).toEqual([...ELEMENT_IDS]);
  });

  it('cada elemento tiene un color distinto', () => {
    const colors = new Set(ELEMENTS.map((element) => element.color.toLowerCase()));
    expect(colors.size).toBe(ELEMENTS.length);
  });

  it('la Afinidad acelera el elemento propio y frena los opuestos', () => {
    expect(AFFINITY_RULES.ownFatigueMultiplier).toBeLessThan(1);
    expect(AFFINITY_RULES.opposingFatigueMultiplier).toBeGreaterThan(1);
  });
});

describe('reglas de combate', () => {
  it('todos los números son finitos y no negativos', () => {
    const check = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value) && value >= 0, path).toBe(true);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) check(child, `${path}.${key}`);
      }
    };
    // El mapa tiene coordenadas negativas: se revisa aparte.
    const { map: _map, ...numbers } = GAME_RULES;
    check(numbers, 'GAME_RULES');
  });

  it('un tejido más largo tarda más en salir', () => {
    const [one, two, three] = GAME_RULES.weave.castTicksByLength;
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
  });
});

describe('Grimorio', () => {
  it('hay 155 tejidos y cada uno tiene un nombre y una clave únicos', () => {
    expect(ALL_WEAVES).toHaveLength(155);
    expect(new Set(ALL_WEAVES.map(spellName)).size).toBe(155);
    expect(new Set(ALL_WEAVES.map(weaveKey)).size).toBe(155);
  });

  it('el nombre sigue el orden del tejido', () => {
    expect(spellName(['brasa'])).toBe('Dardo ígneo');
    expect(spellName(['marea', 'brasa', 'umbra'])).toBe('Muro de brasas y sombra');
    expect(spellName(['raiz', 'tormenta', 'tormenta'])).toBe('Trampa de trueno doble');
  });
});

describe('mapa', () => {
  const spawns = modeSetup({ kind: 'ffa', players: 6 }, 1, 'spectre', GAME_RULES)
    .wizards.concat(modeSetup({ kind: 'teams', size: 3 }, 1, 'spectre', GAME_RULES).wizards)
    .map((w) => w.spawn);

  it('es simétrico respecto del centro, para que ningún equipo tenga ventaja', () => {
    for (const o of MAP.obstacles) {
      const mirror = MAP.obstacles.find(
        (m) => Math.abs(m.x + o.x) < 1e-9 && Math.abs(m.z + o.z) < 1e-9 && m.radius === o.radius,
      );
      expect(mirror, `${o.x},${o.z}`).toBeDefined();
    }
    for (const camp of MAP.camps) {
      const mirror = MAP.camps.find(
        (c) => Math.abs(c.x + camp.x) < 1e-9 && Math.abs(c.z + camp.z) < 1e-9,
      );
      expect(mirror?.element).toBe(camp.element);
    }
  });

  it('deja libres las bases, los campamentos y la plaza', () => {
    for (const p of [...spawns, ...MAP.camps]) {
      expect(obstacleAt(p, 1.5, MAP.obstacles), `${p.x},${p.z}`).toBeUndefined();
    }
    for (const o of MAP.obstacles) {
      expect(Math.hypot(o.x, o.z) + o.radius).toBeLessThan(MAP_RADIUS);
    }
  });

  it('tiene jungla de verdad: más de cien obstáculos', () => {
    expect(MAP.obstacles.length).toBeGreaterThan(100);
  });
});
