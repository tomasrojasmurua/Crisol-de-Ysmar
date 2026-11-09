import type { GameRules, SpellEntity } from '@crisol/core';
import * as THREE from 'three';
import { createGlowTexture } from './arena/textures';
import type { Particles } from './Particles';
import { elementColor, formColor, glow } from './palette';

const WALL_HEIGHT = 2.4;

/**
 * Dibuja los conjuros que existen en el mundo. Crea una vista al aparecer un conjuro
 * y la quita cuando el núcleo lo elimina; no decide nada del juego.
 */
export class SpellViews {
  private readonly views = new Map<number, THREE.Object3D>();
  private readonly coreGeometry = new THREE.IcosahedronGeometry(1, 2);
  private readonly sparkGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  private readonly glowTexture = createGlowTexture();
  private readonly wallGeometry: THREE.PlaneGeometry;
  private readonly spikeGeometry = new THREE.ConeGeometry(0.09, 0.6, 5);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rules: GameRules,
    private readonly particles: Particles,
  ) {
    this.wallGeometry = new THREE.PlaneGeometry(
      rules.forms.wall.halfLength * 2,
      WALL_HEIGHT,
      24,
      8,
    );
  }

  /** `positionOf` entrega la posición interpolada de los proyectiles. */
  sync(
    spells: readonly SpellEntity[],
    positionOf: (spell: SpellEntity) => { x: number; z: number },
    timeSeconds: number,
  ): void {
    const alive = new Set<number>();
    for (const spell of spells) {
      alive.add(spell.id);
      let view = this.views.get(spell.id);
      if (!view) {
        view = this.create(spell);
        this.views.set(spell.id, view);
        this.scene.add(view);
      }
      this.update(view, spell, positionOf(spell), timeSeconds);
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        view.removeFromParent();
        this.views.delete(id);
      }
    }
  }

  private create(spell: SpellEntity): THREE.Object3D {
    const color = formColor(spell.payload.form);
    switch (spell.kind) {
      case 'projectile':
        return this.createProjectile(spell, color);
      case 'wall':
        return this.createWall(spell, color);
      case 'trap':
        return this.createTrap(spell, color);
    }
  }

  private createProjectile(spell: SpellEntity, color: THREE.Color): THREE.Object3D {
    const group = new THREE.Group();
    const size = this.rules.forms.projectile.radius * (1 + 0.25 * (spell.payload.weave.length - 1));
    const core = new THREE.Mesh(
      this.coreGeometry,
      new THREE.MeshBasicMaterial({ color: glow(color, 3) }),
    );
    core.scale.setScalar(size * 0.8);
    group.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: glow(color, 1.5),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    halo.scale.setScalar(size * 6);
    group.add(halo);
    // Cada modificador deja una chispa de su color girando alrededor del proyectil.
    spell.payload.weave.slice(1).forEach((element, i) => {
      const spark = new THREE.Mesh(
        this.sparkGeometry,
        new THREE.MeshBasicMaterial({ color: glow(elementColor(element), 3) }),
      );
      spark.userData.phase = i * Math.PI;
      spark.userData.element = element;
      group.add(spark);
    });
    group.userData.color = color;
    return group;
  }

  private createWall(spell: SpellEntity & { kind: 'wall' }, color: THREE.Color): THREE.Object3D {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color.clone() },
        uFade: { value: 1 },
        uRise: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uRise;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(uv.y * 8.0 + uTime * 3.0 + uv.x * 5.0) * 0.06;
          p.y = mix(-1.2, p.y, uRise);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uFade;
        varying vec2 vUv;
        void main() {
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float top = smoothstep(1.0, 0.7, vUv.y);
          float waves = 0.55 + 0.45 * sin(vUv.y * 30.0 - uTime * 6.0 + sin(vUv.x * 12.0) * 2.0);
          float crest = smoothstep(0.75, 1.0, vUv.y) * (1.0 - smoothstep(0.95, 1.0, vUv.y)) * 2.0;
          float alpha = (0.35 * waves + crest) * edge * top * uFade;
          gl_FragColor = vec4(uColor * (1.2 + crest * 2.0), alpha);
        }
      `,
    });
    const wall = new THREE.Mesh(this.wallGeometry, material);
    wall.position.set(spell.center.x, WALL_HEIGHT / 2, spell.center.z);
    wall.rotation.y = -Math.atan2(spell.along.z, spell.along.x);
    this.particles.burst(spell.center.x, 0.4, spell.center.z, glow(color, 1.5), 24, 4, 0.4);
    return wall;
  }

  private createTrap(spell: SpellEntity & { kind: 'trap' }, color: THREE.Color): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(spell.pos.x, 0, spell.pos.z);
    const radius = this.rules.forms.trap.triggerRadius;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.85, radius, 40),
      new THREE.MeshBasicMaterial({
        color: glow(color, 1.6),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
    // Espinas de raíz alrededor, que asoman cuando la trampa está armada.
    const spikes = new THREE.Group();
    const spikeMaterial = new THREE.MeshStandardMaterial({
      color: '#2b3a22',
      emissive: color,
      emissiveIntensity: 0.4,
    });
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const spike = new THREE.Mesh(this.spikeGeometry, spikeMaterial);
      spike.position.set(Math.cos(angle) * radius * 0.8, 0.2, Math.sin(angle) * radius * 0.8);
      spike.rotation.set(Math.sin(angle) * 0.4, 0, -Math.cos(angle) * 0.4);
      spikes.add(spike);
    }
    group.add(spikes);
    group.userData.ring = ring;
    group.userData.spikes = spikes;
    return group;
  }

  private update(
    view: THREE.Object3D,
    spell: SpellEntity,
    pos: { x: number; z: number },
    timeSeconds: number,
  ): void {
    if (spell.kind === 'projectile') {
      view.position.set(pos.x, 1.3, pos.z);
      const color = view.userData.color as THREE.Color;
      // Estela de chispas detrás del proyectil.
      this.particles.emit({
        x: pos.x + (Math.random() - 0.5) * 0.15,
        y: 1.3 + (Math.random() - 0.5) * 0.15,
        z: pos.z + (Math.random() - 0.5) * 0.15,
        vy: 0.3,
        color: glow(color, 1.4),
        life: 0.35,
        size: 0.45,
      });
      view.children.forEach((child) => {
        const phase = child.userData.phase as number | undefined;
        if (phase === undefined) return;
        const angle = timeSeconds * 18 + phase;
        child.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0);
      });
      view.rotation.y = Math.atan2(spell.velocity.x, spell.velocity.z);
    } else if (spell.kind === 'trap') {
      const ring = view.userData.ring as THREE.Mesh;
      const spikes = view.userData.spikes as THREE.Group;
      const armed = spell.armTicks === 0;
      (ring.material as THREE.MeshBasicMaterial).opacity = armed
        ? 0.55 + 0.3 * Math.sin(timeSeconds * 5)
        : 0.2;
      ring.rotation.z = timeSeconds * 0.6;
      spikes.position.y = armed ? 0 : -0.5;
    } else {
      const material = (view as THREE.Mesh).material as THREE.ShaderMaterial;
      const uniforms = material.uniforms;
      if (uniforms.uTime) uniforms.uTime.value = timeSeconds;
      if (uniforms.uFade) uniforms.uFade.value = Math.min(1, spell.ticksLeft / 20);
      const total = this.rules.forms.wall.durationTicks;
      if (uniforms.uRise) uniforms.uRise.value = Math.min(1, (total - spell.ticksLeft) / 6);
    }
  }
}
