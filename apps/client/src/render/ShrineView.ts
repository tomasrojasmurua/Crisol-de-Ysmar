import type { GameRules, Shrine } from '@crisol/core';
import * as THREE from 'three';
import { glow } from './palette';

const SHRINE_COLOR = new THREE.Color('#f0d9a0');
const SEGMENTS = 48;

/**
 * Un santuario: un obelisco con un haz de luz y un círculo en el suelo.
 * Mientras un equipo lo toma, el círculo se llena con su color.
 */
export class ShrineView {
  readonly group = new THREE.Group();
  private readonly progress: THREE.Mesh;
  private readonly progressMaterial: THREE.MeshBasicMaterial;
  private readonly beamMaterial: THREE.MeshBasicMaterial;
  private readonly crystal: THREE.Mesh;

  constructor(
    shrine: Shrine,
    private readonly rules: GameRules,
  ) {
    this.group.position.set(shrine.pos.x, 0, shrine.pos.z);
    const radius = rules.shrines.radius;

    const stone = new THREE.MeshStandardMaterial({ color: '#3d3833', roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.3, 8), stone);
    base.position.y = 0.15;
    base.castShadow = true;
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1.6, 4), stone);
    obelisk.position.y = 1.1;
    obelisk.castShadow = true;
    this.group.add(base, obelisk);

    this.crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: glow(SHRINE_COLOR, 2.5) }),
    );
    this.crystal.position.y = 2.2;
    this.group.add(this.crystal);

    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: glow(SHRINE_COLOR, 0.55),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 12, 16, 1, true),
      this.beamMaterial,
    );
    beam.position.y = 6;
    this.group.add(beam);

    const circle = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.08, radius, 64),
      new THREE.MeshBasicMaterial({
        color: glow(SHRINE_COLOR, 1.4),
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.04;
    this.group.add(circle);

    this.progressMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.progress = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.35, radius - 0.12, SEGMENTS, 1, Math.PI / 2, Math.PI * 2),
      this.progressMaterial,
    );
    this.progress.rotation.x = -Math.PI / 2;
    this.progress.position.y = 0.05;
    this.group.add(this.progress);
  }

  update(shrine: Shrine, teamColor: (team: number) => string, timeSeconds: number): void {
    this.crystal.rotation.y = timeSeconds * 1.2;
    this.crystal.position.y = 2.2 + Math.sin(timeSeconds * 2) * 0.08;
    this.beamMaterial.opacity = 0.1 + 0.04 * Math.sin(timeSeconds * 3);
    const fraction = shrine.progress / this.rules.shrines.captureTicks;
    this.progress.visible = fraction > 0 && shrine.team !== null;
    if (this.progress.visible && shrine.team !== null) {
      this.progress.geometry.setDrawRange(0, Math.ceil(fraction * SEGMENTS) * 6);
      this.progressMaterial.color.copy(glow(new THREE.Color(teamColor(shrine.team)), 1.6));
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
