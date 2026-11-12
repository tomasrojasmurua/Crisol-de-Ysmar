import type { ElementId } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

/** Lo que la transformación necesita tocar del mago. */
export interface AffinityParts {
  readonly body: THREE.Group;
  readonly robe: THREE.Mesh;
  readonly robeMaterial: THREE.MeshStandardMaterial;
  readonly eyeMaterial: THREE.MeshBasicMaterial;
  /** Altura de la coronilla, donde brotan astas o flotan runas. */
  readonly headY: number;
  /** Altura de la boca, para el aliento de Marea. */
  readonly mouthY: number;
  readonly radius: number;
}

/**
 * La Afinidad se ve en el hechicero (tabla del documento de diseño):
 * Brasa agrieta y humea, Tormenta chisporrotea, Marea escarcha, Raíz brota y Umbra se deshace.
 * Así el rival sabe por dónde va a atacar.
 */
export class AffinityLook {
  private readonly color: THREE.Color;
  private readonly glowColor: THREE.Color;
  private readonly animated: THREE.Object3D[] = [];
  private readonly cracks: THREE.MeshBasicMaterial | null = null;
  private readonly shadow: THREE.Mesh | null = null;
  private emitTimer = 0;
  private breathTimer = 0;
  private lastX = Number.NaN;
  private lastZ = Number.NaN;
  private trailDistance = 0;

  constructor(
    readonly element: ElementId,
    private readonly parts: AffinityParts,
  ) {
    this.color = elementColor(element);
    this.glowColor = glow(this.color, 1.6);
    const { body, robe, robeMaterial, eyeMaterial, headY, radius } = parts;

    switch (element) {
      case 'brasa': {
        // Grietas incandescentes: una copia de la túnica con vetas que brillan.
        this.cracks = new THREE.MeshBasicMaterial({
          map: crackTexture(),
          color: glow(this.color, 1.8),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const overlay = new THREE.Mesh(robe.geometry, this.cracks);
        overlay.scale.setScalar(1.012);
        body.add(overlay);
        robeMaterial.color.lerp(new THREE.Color('#1c1512'), 0.45);
        break;
      }
      case 'tormenta': {
        // Runas que flotan alrededor de la cabeza y ojos que brillan más.
        eyeMaterial.color.copy(glow(this.color, 3.2));
        const runeMaterial = new THREE.MeshBasicMaterial({
          map: runeTexture(),
          color: glow(this.color, 2),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          forceSinglePass: true,
        });
        for (let i = 0; i < 3; i++) {
          const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), runeMaterial);
          rune.userData.phase = (i / 3) * Math.PI * 2;
          this.animated.push(rune);
          body.add(rune);
        }
        break;
      }
      case 'marea': {
        // Ropa empapada (brillante y fría) y escarcha sobre los hombros.
        robeMaterial.roughness = 0.3;
        robeMaterial.metalness = 0.25;
        robeMaterial.color.lerp(new THREE.Color('#1d3550'), 0.35);
        const ice = new THREE.MeshStandardMaterial({
          color: '#cfe8ff',
          emissive: glow(this.color, 0.35),
          roughness: 0.15,
          metalness: 0.1,
          transparent: true,
          opacity: 0.8,
        });
        const shard = new THREE.OctahedronGeometry(0.07);
        for (let i = 0; i < 7; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const crystal = new THREE.Mesh(shard, ice);
          const along = Math.floor(i / 2) * 0.07;
          crystal.position.set(side * (radius * 0.75 + along), 1.36 - along * 0.6, -0.02 + along);
          crystal.scale.set(0.7, 1.6, 0.7);
          crystal.rotation.z = side * 0.6;
          body.add(crystal);
        }
        break;
      }
      case 'raiz': {
        // Corteza, musgo en los hombros y astas que brotan de la cabeza.
        robeMaterial.color.lerp(new THREE.Color('#4a3523'), 0.45);
        robeMaterial.roughness = 1;
        const bark = new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 0.9 });
        const antler = new THREE.CylinderGeometry(0.018, 0.035, 0.42, 5);
        antler.translate(0, 0.21, 0);
        const tine = new THREE.CylinderGeometry(0.012, 0.022, 0.2, 5);
        tine.translate(0, 0.1, 0);
        const bud = new THREE.MeshBasicMaterial({ color: glow(this.color, 2) });
        for (const side of [-1, 1]) {
          const main = new THREE.Mesh(antler, bark);
          main.position.set(side * 0.13, headY, 0);
          main.rotation.z = side * -0.55;
          main.castShadow = true;
          body.add(main);
          const branch = new THREE.Mesh(tine, bark);
          branch.position.set(side * 0.24, headY + 0.17, 0);
          branch.rotation.z = side * 0.3;
          body.add(branch);
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), bud);
          leaf.position.set(side * 0.37, headY + 0.36, 0);
          body.add(leaf);
          this.animated.push(leaf);
        }
        const moss = new THREE.MeshStandardMaterial({ color: '#33522a', roughness: 1 });
        for (const side of [-1, 1]) {
          const patch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), moss);
          patch.position.set(side * radius * 0.62, 1.4, -0.04);
          patch.scale.set(1.2, 0.45, 1.1);
          body.add(patch);
        }
        break;
      }
      case 'umbra': {
        // El borde de la túnica se deshace en humo, los ojos quedan huecos
        // y una sombra propia ronda a sus pies.
        // Solo la túnica se deshace: capucha y hombros quedan firmes.
        robeMaterial.color.lerp(new THREE.Color('#3a2a52'), 0.3);
        const smoky = robeMaterial.clone();
        smoky.alphaMap = fadeTexture();
        smoky.transparent = true;
        smoky.emissive = glow(this.color, 0.12);
        robe.material = smoky;
        robe.userData.solidMaterial = smoky;
        eyeMaterial.color.set('#000000');
        const halo = new THREE.MeshBasicMaterial({ color: glow(this.color, 1.6) });
        const ring = new THREE.TorusGeometry(0.045, 0.012, 6, 14);
        for (const side of [-1, 1]) {
          const rim = new THREE.Mesh(ring, halo);
          rim.position.set(side * 0.07, parts.mouthY + 0.07, radius * 0.47);
          body.add(rim);
        }
        this.shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.45, 24),
          new THREE.MeshBasicMaterial({
            color: '#000000',
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.scale.set(1, 1.8, 1);
        break;
      }
    }
  }

  /** El grupo del mago, para que la sombra de Umbra quede fuera del cuerpo que gira. */
  attach(group: THREE.Group): void {
    if (this.shadow) group.add(this.shadow);
  }

  update(
    x: number,
    z: number,
    facing: number,
    timeSeconds: number,
    deltaSeconds: number,
    active: boolean,
    particles: Particles | null,
  ): void {
    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(x - this.lastX, z - this.lastZ);
    this.lastX = x;
    this.lastZ = z;
    const { headY, mouthY, radius } = this.parts;

    if (this.cracks) {
      this.cracks.opacity = 0.65 + 0.35 * Math.sin(timeSeconds * 2.3) * Math.sin(timeSeconds * 0.7);
    }
    if (this.shadow) {
      this.shadow.visible = active;
      const angle = timeSeconds * 0.6;
      this.shadow.position.set(Math.cos(angle) * 0.55, 0.02, Math.sin(angle * 1.3) * 0.55 - 0.2);
      this.shadow.rotation.z = angle;
    }
    this.animated.forEach((item, i) => {
      if (this.element === 'tormenta') {
        const phase = (item.userData.phase as number) + timeSeconds * 1.6;
        item.position.set(
          Math.cos(phase) * 0.42,
          headY + 0.08 + Math.sin(phase * 2) * 0.06,
          Math.sin(phase) * 0.42,
        );
        item.rotation.y = -phase + Math.PI / 2;
        item.visible = active && Math.sin(timeSeconds * 23 + i * 7) > -0.7;
      } else {
        item.scale.setScalar(1 + 0.25 * Math.sin(timeSeconds * 3 + i));
      }
    });

    if (!active || !particles) return;
    this.trailDistance += moved;
    this.emitTimer += deltaSeconds;
    const sx = Math.sin(facing);
    const cz = Math.cos(facing);
    const around = (spread: number): [number, number] => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      return [x + Math.cos(a) * r, z + Math.sin(a) * r];
    };

    switch (this.element) {
      case 'brasa': {
        // Brasas que caen al caminar y un poco de humo siempre.
        const rate = moved > 0.001 ? 0.05 : 0.16;
        while (this.emitTimer > rate) {
          this.emitTimer -= rate;
          const [px, pz] = around(radius * 0.9);
          particles.emit({
            x: px,
            y: 0.4 + Math.random() * 0.9,
            z: pz,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -0.2,
            vz: (Math.random() - 0.5) * 0.4,
            color: this.glowColor,
            life: 0.8,
            size: 0.09,
            gravity: -3,
          });
        }
        break;
      }
      case 'tormenta': {
        while (this.emitTimer > 0.09) {
          this.emitTimer -= 0.09;
          const [px, pz] = around(0.5);
          particles.emit({
            x: px,
            y: 0.4 + Math.random() * 1.6,
            z: pz,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            vz: (Math.random() - 0.5) * 3,
            color: glow(this.color, 2.4),
            life: 0.18,
            size: 0.08,
          });
        }
        break;
      }
      case 'marea': {
        // Aliento de frío cada tanto y gotas que caen del ruedo.
        this.breathTimer += deltaSeconds;
        if (this.breathTimer > 1.8) {
          this.breathTimer = 0;
          for (let i = 0; i < 6; i++) {
            particles.emit({
              x: x + sx * 0.32,
              y: mouthY,
              z: z + cz * 0.32,
              vx: sx * (0.5 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.2,
              vy: 0.12,
              vz: cz * (0.5 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.2,
              color: new THREE.Color('#a9c8e8').multiplyScalar(0.55),
              life: 1.1,
              size: 0.22,
              gravity: 0.2,
            });
          }
        }
        while (this.emitTimer > 0.3) {
          this.emitTimer -= 0.3;
          const [px, pz] = around(radius * 1.1);
          particles.emit({
            x: px,
            y: 0.25,
            z: pz,
            vy: -0.3,
            color: glow(this.color, 1.2),
            life: 0.4,
            size: 0.06,
            gravity: -4,
          });
        }
        break;
      }
      case 'raiz': {
        // Flores a tu paso: brotan donde pisas y duran un rato.
        if (this.trailDistance > 0.55) {
          this.trailDistance = 0;
          const petals = ['#ff8fc8', '#ffe27a', '#f4f0e6', '#9ff0a0'];
          const [px, pz] = around(0.35);
          particles.emit({
            x: px,
            y: 0.06,
            z: pz,
            color: new THREE.Color(
              petals[Math.floor(Math.random() * petals.length)],
            ).multiplyScalar(0.9),
            life: 2.6,
            size: 0.16,
          });
        }
        break;
      }
      case 'umbra': {
        while (this.emitTimer > 0.07) {
          this.emitTimer -= 0.07;
          const [px, pz] = around(radius * 1.1);
          particles.emit({
            x: px,
            y: 0.1 + Math.random() * 0.5,
            z: pz,
            vx: (px - x) * 0.6,
            vy: 0.35,
            vz: (pz - z) * 0.6,
            color: glow(this.color, 0.55),
            life: 1.1,
            size: 0.32,
            gravity: 0.4,
          });
        }
        break;
      }
    }
  }
}

/** Vetas de fuego sobre negro: con mezcla aditiva, solo brillan las grietas. */
function crackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    // Grietas deterministas: el mismo dibujo en cada mago.
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 14; i++) {
      let px = rand() * 256;
      let py = 256 - rand() * 120;
      ctx.lineWidth = 1.5 + rand() * 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 0; s < 6; s++) {
        px += (rand() - 0.5) * 40;
        py -= 10 + rand() * 22;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** Un signo de tres trazos que se lee como runa sin copiar ningún alfabeto real. */
function runeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(32, 56);
    ctx.moveTo(32, 20);
    ctx.lineTo(14, 36);
    ctx.moveTo(32, 30);
    ctx.lineTo(50, 46);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

/** De transparente abajo a opaco arriba: la túnica de Umbra se deshace en humo. */
function fadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // En la túnica, v va de abajo (0) hacia arriba (1); el lienzo, de arriba hacia abajo.
    const gradient = ctx.createLinearGradient(0, 64, 0, 0);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(0.18, '#777');
    gradient.addColorStop(0.4, '#fff');
    gradient.addColorStop(1, '#fff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 64);
  }
  return new THREE.CanvasTexture(canvas);
}
