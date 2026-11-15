import type { SpellEntity } from '@crisol/core';
import * as THREE from 'three';
import { allyColor, enemyColor, glow } from './palette';

/** Lo que cada conjuro en el suelo necesita para su anillo: dónde y de qué tamaño. */
type Spot = { readonly x: number; readonly z: number; readonly radius: number };

/** Campos que ocupan un área redonda; los de varios puntos (tótems, hojas, cables) no llevan. */
const AREA_FIELDS: ReadonlySet<string> = new Set([
  'volcano',
  'monsoon',
  'smoke',
  'bonfire',
  'wither',
  'deluge',
  'growth',
  'pollen',
  'solarOrb',
]);

/** Las invocaciones son chicas: su anillo queda un poco más afuera del cuerpo. */
const SUMMON_RING = 1.7;
const MIN_RADIUS = 0.7;
/** Un pelo sobre el suelo, para que no parpadee contra él. */
const RING_HEIGHT = 0.04;

/**
 * Un anillo fino en el suelo, del color del bando, bajo cada conjuro que queda en el campo
 * (zonas, avisos, tornados, invocaciones): verde agua si es tuyo o de tu equipo, carmesí si es
 * de un rival. Así se sabe de un vistazo si hay que correr. Todos comparten una geometría y dos
 * materiales, y los anillos se reciclan: no se crea nada en plena pelea.
 */
export class TeamRings {
  /** Para las pruebas: cuántos anillos hay en el campo y cuántos esperan en la reserva. */
  get counts(): { readonly shown: number; readonly spare: number } {
    return { shown: this.rings.size, spare: this.spare.length };
  }

  /** Para las pruebas: si el anillo de un conjuro es del bando de quien mira. */
  isAlly(id: number): boolean | null {
    const ring = this.rings.get(id);
    return ring ? ring.material === this.allyMaterial : null;
  }

  private readonly geometry = new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2);
  private readonly allyMaterial = ringMaterial(allyColor(), 0.5);
  private readonly enemyMaterial = ringMaterial(enemyColor(), 0.7);
  private readonly rings = new Map<number, THREE.Mesh>();
  private readonly spare: THREE.Mesh[] = [];
  private readonly seen = new Set<number>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Antes de recorrer los conjuros del cuadro. */
  begin(time: number): void {
    this.seen.clear();
    // Lo rival late apenas: llama la vista sin tapar la magia.
    this.enemyMaterial.opacity = 0.55 + 0.25 * Math.sin(time * 5);
  }

  /** El anillo de un conjuro, si lleva; `visible` copia si su vista se dibuja (la Mandrágora no). */
  mark(
    spell: SpellEntity,
    place: { x: number; z: number },
    viewerTeam: number,
    visible: boolean,
  ): void {
    const spot = visible ? spotOf(spell, place) : null;
    if (!spot) return;
    this.seen.add(spell.id);
    let ring = this.rings.get(spell.id);
    if (!ring) {
      ring = this.spare.pop() ?? new THREE.Mesh(this.geometry, this.allyMaterial);
      ring.renderOrder = 1;
      this.rings.set(spell.id, ring);
      this.scene.add(ring);
    }
    ring.material = spell.team === viewerTeam ? this.allyMaterial : this.enemyMaterial;
    ring.position.set(spot.x, RING_HEIGHT, spot.z);
    ring.scale.setScalar(Math.max(MIN_RADIUS, spot.radius));
  }

  /** Después de recorrerlos: los anillos de conjuros que ya no están vuelven a la reserva. */
  end(): void {
    for (const [id, ring] of this.rings) {
      if (this.seen.has(id)) continue;
      ring.removeFromParent();
      this.rings.delete(id);
      this.spare.push(ring);
    }
  }
}

function ringMaterial(color: THREE.Color, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: glow(color, 1.25),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Dónde va el anillo de un conjuro, o nada si no queda en el suelo o ya se nota de quién es. */
function spotOf(spell: SpellEntity, place: { x: number; z: number }): Spot | null {
  switch (spell.kind) {
    case 'zone':
    case 'thornRing':
    case 'trap':
      return { x: spell.pos.x, z: spell.pos.z, radius: spell.radius };
    case 'strike':
      // Los avisos en línea ya marcan su franja; solo los redondos llevan anillo.
      return spell.line ? null : { x: spell.pos.x, z: spell.pos.z, radius: spell.radius };
    case 'sweeper':
      return { x: place.x, z: place.z, radius: spell.radius };
    case 'field':
      return AREA_FIELDS.has(spell.mode)
        ? { x: spell.pos.x, z: spell.pos.z, radius: spell.radius }
        : null;
    case 'summon':
      // El Señuelo, el Gemelo y el Espejismo fingen ser su mago: un anillo los delataría.
      if (spell.summon === 'decoy' || spell.summon === 'shadowTwin' || spell.summon === 'mirage')
        return null;
      return { x: place.x, z: place.z, radius: spell.radius * SUMMON_RING };
    default:
      return null;
  }
}
