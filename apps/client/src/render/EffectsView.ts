import type { GameEvent, MatchState, Vec2, Wizard } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, formColor, glow } from './palette';

interface Timed {
  readonly mesh: THREE.Mesh;
  age: number;
  duration: number;
}

const HIT_HEIGHT = 1.2;
const SPECTRE_COLOR = new THREE.Color('#a9b8ff');
const LIFE_COLOR = new THREE.Color('#9effc8');
const ZONE_COLOR = new THREE.Color('#b49cff');
const SHRINE_COLOR = new THREE.Color('#f0d9a0');

/**
 * Lo que dura un instante: estallidos, ondas, rayos de la marca y columnas al revivir.
 * Las mallas se reutilizan para no crear objetos en plena pelea.
 */
export class EffectsView {
  private readonly rings: Timed[] = [];
  private readonly beams: Timed[] = [];
  private readonly columns: Timed[] = [];
  private readonly ringGeometry = new THREE.RingGeometry(0.85, 1, 48);
  private readonly beamGeometry: THREE.CylinderGeometry;
  private readonly columnGeometry = new THREE.CylinderGeometry(0.7, 0.7, 6, 24, 1, true);
  /** Sacudida de cámara pendiente, de 0 a 1. */
  shake = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly particles: Particles,
    private readonly playerId: number,
  ) {
    this.beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true);
    this.beamGeometry.translate(0, 0.5, 0);
    this.beamGeometry.rotateX(Math.PI / 2);
    this.ringGeometry.rotateX(-Math.PI / 2);
  }

  /** `placeOf` dice dónde estaba una bestia o un santuario, aunque ya no exista. */
  onEvents(
    events: readonly GameEvent[],
    state: MatchState,
    placeOf: (id: number) => Vec2 | undefined,
  ): void {
    const byId = (id: number): Wizard | undefined => state.wizards.find((w) => w.id === id);
    for (const event of events) {
      switch (event.type) {
        case 'cast': {
          const caster = byId(event.wizardId);
          const first = event.weave[0];
          if (caster && first) {
            this.particles.burst(
              caster.pos.x,
              1.4,
              caster.pos.z,
              glow(elementColor(first), 1.6),
              6 + event.weave.length * 4,
              2,
              0.3,
            );
          }
          break;
        }
        case 'release': {
          const caster = byId(event.wizardId);
          if (!caster) break;
          const color = formColor(event.form);
          if (event.form === 'leap' || event.form === 'wall') {
            this.ring(caster.pos.x, caster.pos.z, color, 2.5, 0.4);
          }
          break;
        }
        case 'hit': {
          const target = byId(event.targetId);
          if (!target) break;
          if (event.form === 'zone') {
            if (Math.random() < 0.15) {
              this.particles.burst(
                target.pos.x,
                0.8,
                target.pos.z,
                glow(ZONE_COLOR, 1.4),
                2,
                1.5,
                0.3,
              );
            }
            break;
          }
          // Los daños por segundo (quemadura, maldición) no generan estallido.
          if (event.amount < 1) break;
          const color = event.form === 'beast' ? ZONE_COLOR : formColor(event.form);
          this.particles.burst(
            target.pos.x,
            HIT_HEIGHT,
            target.pos.z,
            glow(color, 1.8),
            18,
            5,
            0.45,
          );
          if (event.form === 'mark') {
            const source = byId(event.sourceId);
            if (source) this.beam(source.pos, target.pos, color, 0.35);
          }
          if (event.form === 'leap') {
            this.ring(target.pos.x, target.pos.z, color, 3, 0.45);
          }
          if (event.targetId === this.playerId) {
            this.shake = Math.min(1, this.shake + Math.min(0.6, event.amount / 30));
          }
          break;
        }
        case 'blocked':
          this.particles.burst(
            event.pos.x,
            1.3,
            event.pos.z,
            glow(elementColor('marea'), 1.8),
            16,
            4,
            0.4,
          );
          break;
        case 'fizzle': {
          const caster = byId(event.wizardId);
          if (caster)
            this.particles.burst(
              caster.pos.x,
              1.4,
              caster.pos.z,
              new THREE.Color('#6b6670'),
              8,
              1.2,
              0.3,
            );
          break;
        }
        case 'defeated': {
          const fallen = byId(event.wizardId);
          if (!fallen) break;
          this.particles.burst(fallen.pos.x, 1, fallen.pos.z, glow(SPECTRE_COLOR, 1.3), 40, 4, 0.6);
          this.ring(fallen.pos.x, fallen.pos.z, SPECTRE_COLOR, 4, 0.7);
          if (event.wizardId === this.playerId) this.shake = 1;
          break;
        }
        case 'respawned':
        case 'revived': {
          const wizard = byId(event.wizardId);
          if (!wizard) break;
          this.column(wizard.pos.x, wizard.pos.z, LIFE_COLOR, 0.9);
          this.particles.burst(wizard.pos.x, 0.3, wizard.pos.z, glow(LIFE_COLOR, 1.6), 24, 3, 0.4);
          break;
        }
        case 'haunt': {
          const spectre = byId(event.wizardId);
          const target = byId(event.targetId);
          if (spectre && target) {
            this.beam(spectre.pos, target.pos, SPECTRE_COLOR, 0.5);
            this.particles.burst(
              target.pos.x,
              HIT_HEIGHT,
              target.pos.z,
              glow(SPECTRE_COLOR, 1.5),
              14,
              2,
              0.4,
            );
          }
          break;
        }
        case 'beastHit': {
          const beast = state.beasts.find((b) => b.id === event.beastId);
          if (beast) {
            this.particles.burst(
              beast.pos.x,
              0.8,
              beast.pos.z,
              glow(elementColor(beast.element), 1.6),
              12,
              4,
              0.4,
            );
          }
          break;
        }
        case 'beastSlain': {
          const place = placeOf(event.beastId);
          if (!place) break;
          const color = elementColor(event.element);
          this.particles.burst(place.x, 0.8, place.z, glow(color, 1.8), 36, 5, 0.5);
          this.ring(place.x, place.z, color, 2.5, 0.5);
          // La Esencia vuela hacia quien la cazó.
          const killer = event.killerId === null ? undefined : byId(event.killerId);
          if (killer) this.stream(place, killer.pos, color);
          break;
        }
        case 'markBeast': {
          const caster = byId(event.wizardId);
          const place = placeOf(event.beastId);
          if (caster && place) this.beam(caster.pos, place, elementColor('umbra'), 0.35);
          break;
        }
        case 'shrineClaimed': {
          const place = placeOf(event.shrineId);
          if (!place) break;
          this.column(place.x, place.z, SHRINE_COLOR, 1.2);
          this.ring(place.x, place.z, SHRINE_COLOR, 4, 0.7);
          this.particles.burst(place.x, 1, place.z, glow(SHRINE_COLOR, 1.6), 40, 5, 0.45);
          break;
        }
        case 'shrinesAppear':
        case 'phase':
          break;
      }
    }
  }

  /** Un chorro de partículas de un punto a otro, que llega en medio segundo. */
  private stream(from: Vec2, to: Vec2, color: THREE.Color): void {
    const time = 0.55;
    for (let i = 0; i < 26; i++) {
      const jitter = () => (Math.random() - 0.5) * 1.2;
      this.particles.emit({
        x: from.x + jitter() * 0.3,
        y: 1,
        z: from.z + jitter() * 0.3,
        vx: (to.x - from.x) / time + jitter(),
        vy: 0.6 + Math.random(),
        vz: (to.z - from.z) / time + jitter(),
        color: glow(color, 1.8),
        life: time,
        size: 0.35,
      });
    }
  }

  /** Partículas continuas de un mago: llamas si se quema y humo si es espectro. */
  aura(wizard: Wizard, x: number, z: number, spectre: boolean, deltaSeconds: number): void {
    const chance = deltaSeconds * 30;
    if (wizard.statuses.burn && Math.random() < chance) {
      this.particles.emit({
        x: x + (Math.random() - 0.5) * 0.6,
        y: 0.4 + Math.random() * 1.2,
        z: z + (Math.random() - 0.5) * 0.6,
        vy: 1.4,
        color: glow(elementColor('brasa'), 1.5),
        life: 0.5,
        size: 0.35,
        gravity: 1,
      });
    }
    if (spectre && Math.random() < chance * 0.6) {
      this.particles.emit({
        x: x + (Math.random() - 0.5) * 0.5,
        y: 0.5 + Math.random() * 1.4,
        z: z + (Math.random() - 0.5) * 0.5,
        vy: 0.6,
        color: SPECTRE_COLOR.clone().multiplyScalar(0.6),
        life: 1.1,
        size: 0.5,
      });
    }
  }

  update(deltaSeconds: number): void {
    this.shake = Math.max(0, this.shake - deltaSeconds * 3);
    for (const ring of this.rings) {
      if (!advance(ring, deltaSeconds)) continue;
      const t = ring.age / ring.duration;
      const size = (ring.mesh.userData.size as number) * (0.2 + t * 0.8);
      ring.mesh.scale.setScalar(size);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
    }
    for (const beam of this.beams) {
      if (!advance(beam, deltaSeconds)) continue;
      const t = beam.age / beam.duration;
      (beam.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      const width = 1 + (1 - t) * 2;
      beam.mesh.scale.x = width;
      beam.mesh.scale.y = width;
    }
    for (const column of this.columns) {
      if (!advance(column, deltaSeconds)) continue;
      const t = column.age / column.duration;
      (column.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
      column.mesh.scale.set(1 - t * 0.6, 1, 1 - t * 0.6);
    }
  }

  private ring(x: number, z: number, color: THREE.Color, size: number, duration: number): void {
    const ring = this.take(this.rings, this.ringGeometry, duration);
    ring.mesh.position.set(x, 0.06, z);
    ring.mesh.userData.size = size;
    (ring.mesh.material as THREE.MeshBasicMaterial).color.copy(glow(color, 1.8));
  }

  private beam(
    from: { x: number; z: number },
    to: { x: number; z: number },
    color: THREE.Color,
    duration: number,
  ): void {
    const beam = this.take(this.beams, this.beamGeometry, duration);
    const start = new THREE.Vector3(from.x, 1.5, from.z);
    const end = new THREE.Vector3(to.x, HIT_HEIGHT, to.z);
    beam.mesh.position.copy(start);
    beam.mesh.lookAt(end);
    beam.mesh.scale.set(1, 1, start.distanceTo(end));
    (beam.mesh.material as THREE.MeshBasicMaterial).color.copy(glow(color, 2.5));
  }

  private column(x: number, z: number, color: THREE.Color, duration: number): void {
    const column = this.take(this.columns, this.columnGeometry, duration);
    column.mesh.position.set(x, 3, z);
    (column.mesh.material as THREE.MeshBasicMaterial).color.copy(glow(color, 1.5));
  }

  private take(pool: Timed[], geometry: THREE.BufferGeometry, duration: number): Timed {
    let item = pool.find((p) => !p.mesh.visible);
    if (!item) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      this.scene.add(mesh);
      item = { mesh, age: 0, duration };
      pool.push(item);
    }
    item.age = 0;
    item.duration = duration;
    item.mesh.visible = true;
    item.mesh.scale.setScalar(1);
    return item;
  }
}

/** Avanza un efecto; devuelve false si ya terminó o no está en uso. */
function advance(item: Timed, deltaSeconds: number): boolean {
  if (!item.mesh.visible) return false;
  item.age += deltaSeconds;
  if (item.age >= item.duration) {
    item.mesh.visible = false;
    return false;
  }
  return true;
}
