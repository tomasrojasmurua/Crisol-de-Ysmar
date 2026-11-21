import type { Beast, ElementId, Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeTree, shared } from './dispose';
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

/** Una bestia ya armada, de cada elemento (y Guardián o no), para copiarla en vez de rearmarla. */
interface BeastTemplate {
  readonly group: THREE.Group;
  readonly skin: THREE.MeshStandardMaterial;
}

/**
 * Armar una bestia (fundir sus piezas, pintarlas, subirlas a la tarjeta gráfica) cuesta varios
 * milisegundos en un celular, y al empezar cada ronda aparecen unas 20 a la vez: un tirón que se
 * veía en todas las pruebas ("Entre rondas", 21 de noviembre). Ahora cada tipo se arma una sola
 * vez y las demás se copian compartiendo las mallas, que quedan en la tarjeta gráfica.
 */
const TEMPLATES = new Map<string, BeastTemplate>();

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
  /** El anillo del suelo (se esconde de lejos). */
  private ring: THREE.Mesh | null = null;

  constructor(
    readonly element: ElementId,
    readonly guardian = false,
  ) {
    const key = `${element}|${guardian}`;
    const template = TEMPLATES.get(key);
    if (template) {
      // Copia: las mallas se comparten; la piel es propia (cada una brilla al recibir daño).
      this.group = template.group.clone(true);
      this.skin = template.skin.clone();
      let body: THREE.Group | null = null;
      let shards: THREE.Group | null = null;
      let farSkin: THREE.Mesh | null = null;
      this.group.traverse((object) => {
        const role = object.userData as BeastRole;
        if (object instanceof THREE.Mesh && object.material === template.skin) {
          object.material = this.skin;
        }
        if (role.body) body = object as THREE.Group;
        if (role.shards) shards = object as THREE.Group;
        if (role.far) farSkin = object as THREE.Mesh;
        if (role.ring) this.ring = object as THREE.Mesh;
        if (role.leg) this.legs.push(object as THREE.Mesh);
        if (role.wing) this.wings.push(object as THREE.Mesh);
        if (role.near) this.nearSkin.push(object as THREE.Mesh);
      });
      this.body = body ?? this.body;
      this.shards = shards ?? this.shards;
      this.farSkin = farSkin;
      return;
    }
    const color = elementColor(element);
    this.skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a453f').lerp(color, 0.2),
      roughness: 0.8,
      // Lomo claro y panza oscura (ver `shadeByHeight`): se lee el volumen sin luces nuevas.
      vertexColors: true,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: glow(color, 2.4) });

    // Cuerpo de depredador: pecho alto, lomo que baja hacia las ancas, cuello y cabeza con
    // hocico y mandíbula. Todo lo quieto se funde después en una sola malla.
    const part = (
      geometry: THREE.BufferGeometry,
      position: readonly [number, number, number],
      scale: readonly [number, number, number] = [1, 1, 1],
      rotation: readonly [number, number, number] = [0, 0, 0],
      material: THREE.Material = this.skin,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    const ball = new THREE.SphereGeometry(0.5, 12, 8);
    part(ball, [0, 0.78, 0.22], [0.88, 0.78, 0.82]); // pecho
    part(ball, [0, 0.68, -0.32], [0.72, 0.62, 0.78]); // ancas
    part(new THREE.CylinderGeometry(0.14, 0.2, 0.42, 8), [0, 0.98, 0.5], [1, 1, 1], [0.9, 0, 0]); // cuello
    part(ball, [0, 1.06, 0.72], [0.5, 0.44, 0.56]); // cráneo
    part(new THREE.BoxGeometry(0.22, 0.14, 0.3), [0, 1.0, 0.98], [1, 1, 1], [0.15, 0, 0]); // hocico
    part(new THREE.BoxGeometry(0.18, 0.06, 0.26), [0, 0.9, 0.93], [1, 1, 1], [0.35, 0, 0]); // mandíbula
    const ear = new THREE.ConeGeometry(0.07, 0.24, 5);
    for (const side of [-1, 1]) {
      part(ear, [side * 0.14, 1.28, 0.62], [1, 1, 1], [-0.5, 0, side * -0.35]);
    }
    // Cola: tres conos que se afinan hacia atrás (la de Umbra es de humo; Marea no tiene).
    if (element !== 'umbra' && element !== 'marea') {
      const tail = new THREE.ConeGeometry(0.1, 0.7, 6);
      part(tail, [0, 0.82, -0.82], [1, 1, 1], [-2.0, 0, 0]);
    }

    // Ojos grandes y rasgados: lo primero que se ve de una bestia en la oscuridad.
    const eyeGeometry = new THREE.SphereGeometry(0.075, 8, 6);
    for (const side of [-1, 1]) {
      part(
        eyeGeometry,
        [side * 0.12, 1.1, 0.92],
        [1.3, 0.6, 0.8],
        [0, 0, side * 0.35],
        glowMaterial,
      );
    }

    // Vetas de luz en los flancos, del color de su elemento: marcan la silueta en la noche.
    const stripe = new THREE.BoxGeometry(0.03, 0.05, 0.26);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        part(
          stripe,
          [side * (0.4 - i * 0.03), 0.88 - i * 0.02, 0.3 - i * 0.24],
          [1, 1, 1 - i * 0.15],
          [0.5 + i * 0.1, side * 0.15, 0],
          glowMaterial,
        );
      }
    }

    // El núcleo: una grieta de luz en el lomo.
    part(
      new THREE.OctahedronGeometry(0.16),
      [0, 1.1, 0.05],
      [1, 0.6, 1.8],
      [0, 0, 0],
      glowMaterial,
    );

    // Patas: muslo grueso que se afina, con una pata ancha al final (una sola pieza animada).
    const legGeometry = mergeGeometries([
      new THREE.CylinderGeometry(0.11, 0.06, 0.5, 7).translate(0, -0.25, 0),
      new THREE.SphereGeometry(0.09, 6, 4).scale(1, 0.55, 1.4).translate(0, -0.5, 0.04),
    ]) as THREE.BufferGeometry;
    shadeByHeight(legGeometry, -0.55, 0, 0.35, 0.8);
    for (const [x, z] of [
      [-0.3, 0.35],
      [0.3, 0.35],
      [-0.27, -0.38],
      [0.27, -0.38],
    ] as const) {
      const leg = new THREE.Mesh(legGeometry, this.skin);
      leg.position.set(x, 0.55, z);
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
    const skinMesh = shadeFused(fuse(skinParts, this.skin));
    if (skinMesh) {
      skinMesh.castShadow = true;
      this.body.add(skinMesh);
      this.nearSkin.push(skinMesh, ...this.legs);
    }
    this.farSkin = shadeFused(fuse([...skinParts, ...this.legs], this.skin, false));
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
    this.ring = ring;
    this.keepAsTemplate(key);
  }

  /** Marca qué es cada pieza y guarda una copia para las próximas de este tipo. */
  private keepAsTemplate(key: string): void {
    const mark = (object: THREE.Object3D, role: keyof BeastRole): void => {
      (object.userData as BeastRole)[role] = true;
    };
    mark(this.body, 'body');
    mark(this.shards, 'shards');
    if (this.farSkin) mark(this.farSkin, 'far');
    if (this.ring) mark(this.ring, 'ring');
    for (const leg of this.legs) mark(leg, 'leg');
    for (const wing of this.wings) mark(wing, 'wing');
    for (const mesh of this.nearSkin) mark(mesh, 'near');
    // Las mallas quedan para siempre: al quitar una bestia no se liberan.
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) shared(object.geometry);
    });
    TEMPLATES.set(key, { group: this.group.clone(true), skin: this.skin });
  }

  /** `viewer`: dónde está la cámara, para dibujarla con menos detalle si está lejos. */
  update(
    beast: Beast,
    timeSeconds: number,
    deltaSeconds: number,
    viewer?: Vec2,
    /** Dónde se dibuja, entre un paso y el siguiente (si no, donde está en el paso). */
    shownAt: Vec2 = beast.pos,
  ): void {
    const x = shownAt.x;
    const z = shownAt.z;
    if (viewer && this.farSkin) {
      const distance = Math.hypot(viewer.x - x, viewer.z - z);
      const far = this.far ? distance > FAR_LEAVE_M : distance > FAR_ENTER_M;
      if (far !== this.far) {
        this.far = far;
        this.farSkin.visible = far;
        for (const mesh of this.nearSkin) mesh.visible = !far;
        // De lejos, entre la niebla, el anillo del suelo no se ve: una llamada de dibujo menos.
        if (this.ring) this.ring.visible = !far;
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
    disposeTree(this.group);
  }

  /** Lo que se anima por su cuenta (patas y alas) no se funde con el resto. */
  private moving(mesh: THREE.Mesh): boolean {
    return this.legs.includes(mesh) || this.wings.includes(mesh);
  }

  private addFeature(element: ElementId, color: THREE.Color, glowMaterial: THREE.Material): void {
    switch (element) {
      case 'brasa': {
        // Cresta de brasas a lo largo del lomo.
        const spike = new THREE.ConeGeometry(0.07, 0.34, 5);
        for (let i = 0; i < 6; i++) {
          const cone = new THREE.Mesh(spike, glowMaterial);
          // Más altas sobre los hombros, más bajas hacia la cola.
          cone.position.set(0, 1.17 - i * 0.04, 0.38 - i * 0.18);
          cone.scale.setScalar(1.15 - i * 0.12);
          cone.rotation.x = -0.5;
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
          wing.position.set(side * 0.25, 1.12, 0.15);
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
        shell.position.set(0, 0.78, -0.02);
        shell.scale.set(1, 0.75, 1.25);
        shell.castShadow = true;
        this.body.add(shell);
        return;
      }
      case 'raiz': {
        // Astas de madera y musgo.
        const antler = new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5);
        for (const side of [-1, 1]) {
          const main = new THREE.Mesh(antler, this.skin);
          main.position.set(side * 0.2, 1.42, 0.62);
          main.rotation.z = side * -0.5;
          this.body.add(main);
          // Una rama hacia adelante en cada asta.
          const branch = new THREE.Mesh(antler, this.skin);
          branch.position.set(side * 0.24, 1.5, 0.72);
          branch.scale.setScalar(0.55);
          branch.rotation.set(0.9, 0, side * -0.3);
          this.body.add(branch);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), glowMaterial);
          tip.position.set(side * 0.33, 1.65, 0.62);
          this.body.add(tip);
        }
        const moss = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: '#2f4a26', roughness: 1 }),
        );
        moss.position.set(0, 1.08, -0.05);
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

/** Qué es cada pieza de una bestia, para encontrarla en una copia. */
interface BeastRole {
  body?: boolean;
  shards?: boolean;
  far?: boolean;
  ring?: boolean;
  leg?: boolean;
  wing?: boolean;
  near?: boolean;
}

/**
 * Pinta la malla con un degradado de abajo (`dark`) hacia arriba (`light`), entre las alturas
 * `bottom` y `top`. Va en colores por vértice: no agrega luces ni llamadas de dibujo.
 */
function shadeByHeight(
  geometry: THREE.BufferGeometry,
  bottom: number,
  top: number,
  dark: number,
  light: number,
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) - bottom) / (top - bottom), 0, 1);
    colors.fill(dark + (light - dark) * t * t, i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** El cuerpo fundido, con la panza en sombra y el lomo que recibe la luna. */
function shadeFused(mesh: THREE.Mesh | null): THREE.Mesh | null {
  if (mesh) shadeByHeight(mesh.geometry, 0.35, 1.3, 0.3, 1.55);
  return mesh;
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
