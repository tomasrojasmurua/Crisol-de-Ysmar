import type { SpellEntity } from '@crisol/core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TeamRings } from './TeamRings';

const zone = (id: number, team: number) =>
  ({
    kind: 'zone',
    id,
    team,
    ownerId: 1,
    pos: { x: 2, z: 3 },
    radius: 3,
  }) as unknown as SpellEntity;
const summon = (id: number, team: number, kind: string) =>
  ({
    kind: 'summon',
    id,
    team,
    ownerId: 1,
    summon: kind,
    pos: { x: 0, z: 0 },
    radius: 0.5,
  }) as unknown as SpellEntity;
const here = { x: 0, z: 0 };

describe('TeamRings', () => {
  it('marca lo propio en el color del bando y lo rival en carmesí', () => {
    const rings = new TeamRings(new THREE.Scene());
    rings.begin(0);
    rings.mark(zone(1, 1), here, 1, true);
    rings.mark(zone(2, 2), here, 1, true);
    rings.end();
    expect(rings.isAlly(1)).toBe(true);
    expect(rings.isAlly(2)).toBe(false);
  });

  it('no delata al Señuelo ni dibuja lo que no se ve', () => {
    const rings = new TeamRings(new THREE.Scene());
    rings.begin(0);
    rings.mark(summon(1, 2, 'decoy'), here, 1, true);
    rings.mark(summon(2, 2, 'wisp'), here, 1, false);
    rings.mark(summon(3, 2, 'wisp'), here, 1, true);
    rings.end();
    expect(rings.counts.shown).toBe(1);
    expect(rings.isAlly(3)).toBe(false);
  });

  it('recicla los anillos de conjuros que terminan', () => {
    const rings = new TeamRings(new THREE.Scene());
    rings.begin(0);
    rings.mark(zone(1, 1), here, 1, true);
    rings.end();
    rings.begin(0.1);
    rings.end();
    expect(rings.counts).toEqual({ shown: 0, spare: 1 });
    rings.begin(0.2);
    rings.mark(zone(2, 2), here, 1, true);
    rings.end();
    expect(rings.counts).toEqual({ shown: 1, spare: 0 });
  });
});
