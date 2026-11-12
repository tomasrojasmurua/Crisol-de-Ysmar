import type { Beast, ElementId, Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ELEMENT_COLORS, elementColor, glow } from './palette';

/** El Guardián es la misma criatura, mucho más grande. */
const GUARDIAN_SCALE = 2.2;
/**
 * Desde esta distancia de la cámara (metros) la bestia se dibuja de lejos: las patas quedan
 * quietas y fundidas con el cuerpo, una llamada de dibujo en vez de cinco. A esa distancia
 * mide unos pocos píxeles y entre la niebla no se nota. Vuelve a lo de cerca algo antes,
 * para que no titile justo en el borde.
 */
const FAR_ENTER_M = 26;
const FAR_LEAVE_M = 22;

/**
 * Una bestia neutral: cuerpo de piedra y sombra con un núcleo que brilla del color de su elemento,
 * y un rasgo propio por elemento (cresta de brasas, alas, caparazón, astas o cola de humo).
 */
export class BeastView {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly skin: THREE.MeshStandardMaterial;
  private readonly wings: THREE.Mesh[] = [];
  private flash = 0;
  private lastHp = -1;
  private stride = 0;
  private lastX = 0;
  private lastZ = 0;
  private readonly shards = new THREE.Group();
  /** Lo quieto del cuerpo con las patas en reposo, para verla de lejos. */
  private readonly farSkin: THREE.Mesh | null;
  private readonly nearSkin: THREE.Mesh[] = [];
  private far = false;

  constructor(
    readonly element: ElementId,
    readonly guardian = false,
  ) {
    const color = elementColor(element);
    this.skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3631').lerp(color, 0.3),
      roughness: 0.8,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: glow(color, 2.4) });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), this.skin);
    torso.scale.set(0.9, 0.7, 1.25);
    torso.position.y = 0.7;
    torso.castShadow = true;
    this.body.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), this.skin);
    head.position.set(0, 0.85, 0.65);
    head.scale.set(1, 0.85, 1.1);
    head.castShadow = true;
    this.body.add(head);

    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, glowMaterial);
      eye.position.set(side * 0.12, 0.92, 0.88);
      this.body.add(eye);
    }

    // El núcleo: una grieta de luz en el lomo.
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glowMaterial);
    core.position.set(0, 1.05, 0);
    core.scale.set(1, 0.6, 1.8);
    this.body.add(core);

    const legGeometry = new THREE.CylinderGeometry(0.07, 0.05, 0.5, 6);
    legGeometry.translate(0, -0.25, 0);
    for (const [x, z] of [
      [-0.3, 0.35],
      [0.3, 0.35],
      [-0.3, -0.35],
      [0.3, -0.35],
    ] as const) {
      const leg = new THREE.Mesh(legGeometry, this.skin);
      leg.position.set(x, 0.5, z);
      leg.castShadow = true;
      this.legs.push(leg);
      this.body.add(leg);
    }

    this.addFeature(element, color, glowMaterial);
    // Cada pieza era una llamada de dibujo y una bestia tenía hasta 15: con 18 bestias en el
    // mapa eran más de la mitad de lo que dibujaba el celular. Las piezas quietas que comparten
    // material se funden en una sola malla; se ven idénticas.
    const still = this.body.children.filter(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && !this.moving(child),
    );
    const glowParts = still.filter((mesh) => mesh.material === glowMaterial);
    const skinParts = still.filter((mesh) => mesh.material === this.skin);
    const glowMesh = fuse(glowParts, glowMaterial);
    if (glowMesh) this.body.add(glowMesh);
    const skinMesh = fuse(skinParts, this.skin);
    if (skinMesh) {
      skinMesh.castShadow = true;
      this.body.add(skinMesh);
      this.nearSkin.push(skinMesh, ...this.legs);
    }
    this.farSkin = fuse([...skinParts, ...this.legs], this.skin, false);
    if (this.farSkin) {
      this.farSkin.castShadow = true;
      this.farSkin.visible = false;
      this.body.add(this.farSkin);
    }
    this.group.add(this.body);

    if (guardian) {
      // Cinco esquirlas, una por elemento, giran sobre su lomo: el Guardián los guarda a todos.
      const shardGeometry = new THREE.OctahedronGeometry(0.09);
      let i = 0;
      for (const shardColor of ELEMENT_COLORS.values()) {
        const shard = new THREE.Mesh(
          shardGeometry,
          new THREE.MeshBasicMaterial({ color: glow(shardColor, 2.2) }),
        );
        const angle = (i / ELEMENT_COLORS.size) * Math.PI * 2;
        shard.position.set(Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55);
        shard.scale.set(1, 1.8, 1);
        this.shards.add(shard);
        i++;
      }
      this.shards.position.y = 1.45;
      this.body.add(this.shards);
      this.group.scale.setScalar(GUARDIAN_SCALE);
      this.skin.color.multiplyScalar(0.8);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.85, 32),
      new THREE.MeshBasicMaterial({
        color: glow(color, 0.8),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);
  }

  /** `viewer`: dónde está la cámara, para dibujarla con menos detalle si está lejos. */
  update(beast: Beast, timeSeconds: number, deltaSeconds: number, viewer?: Vec2): void {
    const x = beast.pos.x;
    const z = beast.pos.z;
    if (viewer && this.farSkin) {
      const distance = Math.hypot(viewer.x - x, viewer.z - z);
      const far = this.far ? distance > FAR_LEAVE_M : distance > FAR_ENTER_M;
      if (far !== this.far) {
        this.far = far;
        this.farSkin.visible = far;
        for (const mesh of this.nearSkin) mesh.visible = !far;
      }
    }
    const speed = deltaSeconds > 0 ? Math.hypot(x - this.lastX, z - this.lastZ) / deltaSeconds : 0;
    this.lastX = x;
    this.lastZ = z;
    this.group.position.set(x, 0, z);
    this.body.rotation.y = Math.atan2(beast.facing.x, beast.facing.z);

    const moving = Math.min(1, speed / 3);
    this.stride += deltaSeconds * (3 + moving * 10);
    this.legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(this.stride + (i % 2 === 0 ? 0 : Math.PI)) * 0.6 * moving;
    });
    const hover = this.element === 'tormenta' ? 0.35 + Math.sin(timeSeconds * 3) * 0.1 : 0;
    this.body.position.y = hover + Math.abs(Math.sin(this.stride)) * 0.05 * moving;
    this.shards.rotation.y = timeSeconds * 0.9;
    this.shards.position.y = 1.45 + Math.sin(timeSeconds * 1.6) * 0.06;
    for (const wing of this.wings) {
      wing.rotation.z = (wing.userData.side as number) * (0.4 + Math.sin(timeSeconds * 14) * 0.5);
    }

    if (this.lastHp >= 0 && beast.hp < this.lastHp) this.flash = 1;
    this.lastHp = beast.hp;
    this.flash = Math.max(0, this.flash - deltaSeconds * 6);
    this.skin.emissive.setScalar(this.flash * 0.8);
    // Enojada, la bestia se tiñe de su color.
    if (beast.targetId !== null) {
      this.skin.emissive.add(elementColor(this.element).clone().multiplyScalar(0.18));
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }

  /** Lo que se anima por su cuenta (patas y alas) no se funde con el resto. */
  private moving(mesh: THREE.Mesh): boolean {
    return this.legs.includes(mesh) || this.wings.includes(mesh);
  }

  private addFeature(element: ElementId, color: THREE.Color, glowMaterial: THREE.Material): void {
    switch (element) {
      case 'brasa': {
        // Cresta de brasas a lo largo del lomo.
        const spike = new THREE.ConeGeometry(0.07, 0.3, 5);
        for (let i = 0; i < 5; i++) {
          const cone = new THREE.Mesh(spike, glowMaterial);
          cone.position.set(0, 1.0 + Math.sin((i / 4) * Math.PI) * 0.08, 0.45 - i * 0.22);
          cone.rotation.x = -0.4;
          this.body.add(cone);
        }
        return;
      }
      case 'tormenta': {
        // Alas finas que vibran.
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.9, 0.25);
        shape.lineTo(0.75, -0.15);
        shape.closePath();
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
          color: glow(color, 1.2),
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          forceSinglePass: true,
          depthWrite: false,
        });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(geometry, material);
          wing.position.set(side * 0.25, 0.95, 0);
          wing.rotation.x = -Math.PI / 2;
          wing.scale.x = side;
          wing.userData.side = side;
          this.wings.push(wing);
          this.body.add(wing);
        }
        return;
      }
      case 'marea': {
        // Caparazón con vetas que brillan.
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: '#1f2b3a',
            roughness: 0.4,
            metalness: 0.3,
            emissive: color,
            emissiveIntensity: 0.25,
          }),
        );
        shell.position.y = 0.72;
        shell.scale.set(1, 0.8, 1.2);
        shell.castShadow = true;
        this.body.add(shell);
        return;
      }
      case 'raiz': {
        // Astas de madera y musgo.
        const antler = new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5);
        for (const side of [-1, 1]) {
          const main = new THREE.Mesh(antler, this.skin);
          main.position.set(side * 0.15, 1.2, 0.6);
          main.rotation.z = side * -0.5;
          this.body.add(main);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), glowMaterial);
          tip.position.set(side * 0.28, 1.43, 0.6);
          this.body.add(tip);
        }
        const moss = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: '#2f4a26', roughness: 1 }),
        );
        moss.position.set(0, 0.98, -0.15);
        moss.scale.set(1.3, 0.5, 1.4);
        this.body.add(moss);
        return;
      }
      case 'umbra': {
        // Cola larga de humo.
        const tail = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 1.1, 8),
          new THREE.MeshBasicMaterial({
            color: glow(color, 0.8),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        tail.position.set(0, 0.8, -0.95);
        tail.rotation.x = -Math.PI / 2 - 0.3;
        this.body.add(tail);
        this.skin.transparent = true;
        this.skin.opacity = 0.85;
        return;
      }
    }
  }
}

/**
 * Junta varias piezas del cuerpo en una sola malla, con su posición, giro y escala horneados.
 * `remove`: si se sacan las originales (las patas de cerca se quedan, para animarlas).
 */
function fuse(
  meshes: readonly THREE.Mesh[],
  material: THREE.Material,
  remove = true,
): THREE.Mesh | null {
  if (meshes.length === 0) return null;
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix();
    const source = mesh.geometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
    }
    return geometry.applyMatrix4(mesh.matrix);
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) return null;
  if (remove) for (const mesh of meshes) mesh.removeFromParent();
  return new THREE.Mesh(merged, material);
}
