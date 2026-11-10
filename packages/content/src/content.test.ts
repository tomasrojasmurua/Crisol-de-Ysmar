import { ELEMENT_IDS, modeSetup, obstacleAt, SPELL_IDS } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { AFFINITY_RULES } from './affinity';
import { SPELL_DESCRIPTIONS } from './descriptions';
import { ELEMENTS } from './elements';
import { FEATURES } from './features';
import { ALL_WEAVES, spellName, weaveKey } from './grimoire';
import { MAP, MAP_RADIUS, PLAZA_MAP } from './map';
import { DUEL_RULES, GAME_RULES, rulesForMode } from './rules';

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

  it('cada hechizo tiene su descripción para el Grimorio y el entrenamiento', () => {
    for (const id of SPELL_IDS) {
      expect(SPELL_DESCRIPTIONS[id]?.length ?? 0, id).toBeGreaterThan(10);
    }
  });

  it('cada uno de los 155 tejidos tiene su propio hechizo con nombre, sin ecos', () => {
    expect(ALL_WEAVES.filter((w) => spellName(w).includes(' · eco de '))).toEqual([]);
    expect(spellName(['brasa'])).toBe('Chispa');
    expect(spellName(['marea', 'brasa'])).toBe('Géiser');
    expect(spellName(['brasa', 'brasa', 'marea'])).toBe('Erupción');
    expect(spellName(['brasa', 'tormenta', 'tormenta'])).toBe('Propulsión');
    expect(spellName(['tormenta', 'brasa', 'tormenta'])).toBe('Pararrayos humano');
    expect(spellName(['tormenta', 'brasa', 'marea'])).toBe('Orbe errático');
    expect(spellName(['marea', 'brasa', 'umbra'])).toBe('Ácido');
    expect(spellName(['brasa', 'marea'])).toBe('Obsidiana');
    expect(spellName(['brasa', 'brasa', 'brasa'])).toBe('Meteoro');
    expect(spellName(['umbra', 'brasa', 'tormenta'])).toBe('Portal');
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

describe('el 1v1 en la plaza', () => {
  it('el duelo usa la plaza y los equipos la jungla', () => {
    expect(rulesForMode({ kind: 'duel' })).toBe(DUEL_RULES);
    expect(rulesForMode({ kind: 'teams', size: 2 })).toBe(GAME_RULES);
    expect(rulesForMode({ kind: 'ffa', players: 4 })).toBe(GAME_RULES);
  });

  it('no tiene jungla, campamentos, bestias ni Guardián', () => {
    expect(PLAZA_MAP.camps).toHaveLength(0);
    expect(PLAZA_MAP.guardianLair).toBeNull();
    expect(PLAZA_MAP.obstacles.some((o) => o.kind === 'tree' || o.kind === 'rock')).toBe(false);
    expect(DUEL_RULES.beasts.count).toBe(0);
  });

  it('todo lo de la plaza cabe en la arena y las bases quedan libres', () => {
    for (const o of PLAZA_MAP.obstacles) {
      expect(Math.hypot(o.x, o.z) + o.radius).toBeLessThan(DUEL_RULES.arenaRadius);
    }
    for (const w of modeSetup({ kind: 'duel' }, 1, 'spectre', DUEL_RULES).wizards) {
      expect(obstacleAt(w.spawn, 1.5, PLAZA_MAP.obstacles)).toBeUndefined();
    }
  });

  it('solo cambia el mapa: el combate usa los mismos números', () => {
    expect(DUEL_RULES.spells).toBe(GAME_RULES.spells);
    expect(DUEL_RULES.round).toBe(GAME_RULES.round);
    expect(DUEL_RULES.round.convergenceRadius).toBeLessThan(DUEL_RULES.arenaRadius);
  });
});

describe('piezas en pausa', () => {
  it('el Guardián solo existe si está encendido', () => {
    expect(MAP.guardianLair === null).toBe(!FEATURES.guardian);
  });
});
