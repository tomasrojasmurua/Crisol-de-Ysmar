import { MAP_DECOR } from '@crisol/content';
import * as THREE from 'three';
import type { Particles } from '../Particles';
import { elementColor } from '../palette';
import { Ambience } from './Ambience';
import {
  createFloorTexture,
  createGlowTexture,
  createGroundTexture,
  createRuneCircleTexture,
} from './textures';

const BACKGROUND = '#0d0d18';
const PILLAR_COUNT = 10;
/** Lado de la zona con sombras alrededor del jugador: en el celular no alcanza para todo el mapa. */
const SHADOW_EXTENT = 24;

interface Brazier {
  readonly flame: THREE.Sprite;
  readonly color: THREE.Color;
  readonly position: THREE.Vector3;
  readonly phase: number;
}

/**
 * El Crisol: una plaza de piedra en ruinas bajo la luna, con un círculo rúnico al centro y
 * braseros de los cinco elementos en su borde. Alrededor, la jungla y sus senderos de tierra.
 * La escena es oscura a propósito: la magia es lo que brilla.
 */
export class ArenaView {
  readonly scene = new THREE.Scene();
  private readonly braziers: Brazier[] = [];
  /**
   * Las luces de los braseros: solo dos, puestas en los dos más cercanos a quien juega. Cada
   * luz encarece el sombreado de todo lo que se ve, y antes había cinco siempre encendidas.
   */
  private readonly brazierLights: THREE.PointLight[] = [];
  private readonly lightOwners: (Brazier | null)[] = [];
  private readonly runeMaterial: THREE.MeshBasicMaterial;
  private readonly rune: THREE.Mesh;
  private ambience: Ambience | null = null;
  private readonly stars: THREE.Points;
  private readonly moon = new THREE.DirectionalLight('#b8c2ff', 2.4);
  /** Lo que depende del tamaño de la arena: senderos, murete, columnas y ruinas lejanas. */
  private readonly layout = new THREE.Group();
  private readonly groundTexture: THREE.Texture;
  private layoutKey = '';
  private emberTimer = 0;

  constructor(
    arenaRadius: number,
    private readonly particles: Particles,
  ) {
    const scene = this.scene;
    scene.background = new THREE.Color(BACKGROUND);
    scene.fog = new THREE.FogExp2(BACKGROUND, 0.02);

    scene.add(createSky());
    this.stars = createStars();
    scene.add(this.stars);
    scene.add(createMoon());

    // La plaza: losas en anillos alrededor del círculo rúnico.
    const plaza = MAP_DECOR.plazaRadius;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(plaza + 1.2, 96),
      new THREE.MeshStandardMaterial({
        map: createFloorTexture(plaza, plaza + 1.2),
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    // La jungla: tierra con musgo que se pierde en la niebla.
    const groundTexture = createGroundTexture();
    this.groundTexture = groundTexture;
    const groundSize = 2 * (arenaRadius + 60);
    groundTexture.repeat.set(groundSize / 9, groundSize / 9);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    this.runeMaterial = new THREE.MeshBasicMaterial({
      map: createRuneCircleTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
      // Pegado a las losas: sin este empujón de profundidad, en celular el círculo y el piso se
      // pelean cuadro a cuadro y el centro de la plaza parpadea.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), this.runeMaterial);
    this.rune = rune;
    rune.rotation.x = -Math.PI / 2;
    // Un pelo sobre las losas (0.02) y bajo los anillos y marcas de hechizos (desde 0.03).
    rune.position.y = 0.025;
    rune.renderOrder = 1;
    scene.add(rune);

    scene.add(this.layout);
    this.setLayout(arenaRadius, true);
    this.createBraziers();
    this.createLights();
  }

  /**
   * Ajusta el borde de la arena a la partida: el 1v1 cierra el murete alrededor de la plaza y
   * no dibuja senderos; la jungla lo abre a todo el mapa.
   */
  setLayout(arenaRadius: number, paths: boolean): void {
    const key = `${arenaRadius}|${paths}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    for (const child of [...this.layout.children]) disposeTree(child);
    this.layout.clear();
    if (paths) this.layout.add(createPaths(arenaRadius, this.groundTexture));
    this.layout.add(
      createLowWall(arenaRadius),
      createPillars(arenaRadius),
      createDistantRuins(arenaRadius),
    );
    if (this.ambience) {
      this.scene.remove(this.ambience.group);
      this.ambience.dispose();
    }
    this.ambience = new Ambience(arenaRadius);
    this.scene.add(this.ambience.group);
  }

  update(timeSeconds: number, deltaSeconds: number): void {
    this.runeMaterial.opacity = 0.6 + 0.18 * Math.sin(timeSeconds * 0.8);
    // El círculo rúnico gira muy lento: la arena se siente viva sin distraer.
    this.rune.rotation.z = timeSeconds * 0.02;
    this.ambience?.update(timeSeconds);
    for (const brazier of this.braziers) {
      const flicker =
        0.85 + 0.1 * Math.sin(timeSeconds * 11 + brazier.phase) + 0.05 * Math.sin(timeSeconds * 23);
      brazier.flame.scale.set(1.3 * flicker, 1.9 * flicker, 1);
      const slot = this.lightOwners.indexOf(brazier);
      const light = slot >= 0 ? this.brazierLights[slot] : undefined;
      if (light) light.intensity = 7 * flicker;
    }
    this.stars.rotation.y = timeSeconds * 0.003;

    // Brasas que suben de los braseros.
    this.emberTimer += deltaSeconds;
    while (this.emberTimer > 0.05) {
      this.emberTimer -= 0.05;
      const brazier = this.braziers[Math.floor(Math.random() * this.braziers.length)];
      if (!brazier) continue;
      this.particles.emit({
        x: brazier.position.x + (Math.random() - 0.5) * 0.5,
        y: brazier.position.y + 0.3,
        z: brazier.position.z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 1 + Math.random() * 1.2,
        vz: (Math.random() - 0.5) * 0.4,
        color: brazier.color,
        life: 1.2 + Math.random(),
        size: 0.18,
        gravity: 0.3,
      });
    }
  }

  /** La luna sigue al jugador: así la sombra es nítida donde se juega sin pagar todo el mapa. */
  focus(x: number, z: number): void {
    this.moon.position.set(x - 12, 22, z + 10);
    this.moon.target.position.set(x, 0, z);
  }

  private createBraziers(): void {
    const glow = createGlowTexture();
    const bowlGeometry = new THREE.CylinderGeometry(0.5, 0.28, 0.36, 12, 1, true);
    const bowlMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2622',
      roughness: 0.6,
      metalness: 0.5,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    const pedestalGeometry = new THREE.CylinderGeometry(0.32, 0.5, 1.2, 8);
    pedestalGeometry.translate(0, 0.6, 0);
    const pedestalMaterial = new THREE.MeshStandardMaterial({ color: '#3b3733', roughness: 0.9 });
    const count = MAP_DECOR.braziers.length;
    const pedestals = new THREE.InstancedMesh(pedestalGeometry, pedestalMaterial, count);
    const bowls = new THREE.InstancedMesh(bowlGeometry, bowlMaterial, count);
    pedestals.castShadow = true;
    this.scene.add(pedestals, bowls);
    const matrix = new THREE.Matrix4();
    MAP_DECOR.braziers.forEach((brazier, i) => {
      const color = elementColor(brazier.element);
      const position = new THREE.Vector3(brazier.x, 1.38, brazier.z);
      pedestals.setMatrixAt(i, matrix.makeTranslation(brazier.x, 0, brazier.z));
      bowls.setMatrixAt(i, matrix.makeTranslation(position.x, position.y, position.z));

      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: color.clone().multiplyScalar(2.2),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      flame.position.copy(position).add(new THREE.Vector3(0, 0.7, 0));
      this.scene.add(flame);

      this.braziers.push({ flame, color, position, phase: i * 1.7 });
    });
    for (let i = 0; i < 2; i++) {
      const light = new THREE.PointLight('#ffffff', 0, 14, 1.6);
      this.scene.add(light);
      this.brazierLights.push(light);
      this.lightOwners.push(null);
    }
    this.lightBraziersNear(0, 0);
  }

  /** Enciende los dos braseros más cercanos a ese punto (se llama con la posición del jugador). */
  lightBraziersNear(x: number, z: number): void {
    const nearest = [...this.braziers]
      .sort(
        (a, b) =>
          (a.position.x - x) ** 2 +
          (a.position.z - z) ** 2 -
          ((b.position.x - x) ** 2 + (b.position.z - z) ** 2),
      )
      .slice(0, this.brazierLights.length);
    this.brazierLights.forEach((light, i) => {
      const brazier = nearest[i] ?? null;
      if (this.lightOwners[i] === brazier) return;
      this.lightOwners[i] = brazier;
      if (!brazier) return;
      light.color.copy(brazier.color);
      light.position.copy(brazier.position).add(new THREE.Vector3(0, 1, 0));
    });
  }

  /**
   * Gráficos livianos: sin sombras de la luna ni luz propia en los braseros (sus llamas siguen
   * brillando). Cada luz encarece el sombreado de todo lo que se ve.
   */
  setLight(full: boolean): void {
    this.moon.castShadow = full;
    for (const light of this.brazierLights) light.visible = full;
  }

  private createLights(): void {
    this.scene.add(new THREE.HemisphereLight('#8a95c6', '#3a3024', 1.7));
    // La luna proyecta las sombras de los magos sobre la piedra.
    const moon = this.moon;
    moon.position.set(-12, 22, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const extent = SHADOW_EXTENT / 2;
    const shadowCamera = moon.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = 1;
    shadowCamera.far = 60;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.03;
    this.scene.add(moon, moon.target);
    // Relleno cálido desde el lado opuesto, para que nadie quede negro de espaldas.
    const fill = new THREE.DirectionalLight('#9a8468', 0.9);
    fill.position.set(8, 10, -12);
    this.scene.add(fill);
  }
}

function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#141a33') },
      middle: { value: new THREE.Color('#151829') },
      bottom: { value: new THREE.Color(BACKGROUND) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 middle;
      uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 color = h > 0.0 ? mix(middle, top, smoothstep(0.0, 0.6, h)) : bottom;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), material);
}

function createStars(): THREE.Points {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = 0.15 + Math.random() * 0.85;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 140, y * 140, Math.sin(theta) * r * 140], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#c9d0ff',
      size: 1.4,
      sizeAttenuation: false,
      fog: false,
      transparent: true,
      opacity: 0.7,
    }),
  );
}

function createMoon(): THREE.Sprite {
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: new THREE.Color('#dfe4ff').multiplyScalar(1.6),
      fog: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  moon.position.set(-60, 75, 55);
  moon.scale.setScalar(26);
  return moon;
}

/** Libera geometrías y materiales de un objeto y sus hijos (las texturas compartidas quedan). */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial && material.map !== null) {
        material.map.dispose();
      }
      material.dispose();
    }
  });
}

/** Un murete bajo marca el borde de la arena. */
function createLowWall(arenaRadius: number): THREE.Group {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#3b3733', roughness: 0.9 });
  const segments = 36;
  const geometry = new THREE.BoxGeometry(1, 0.6, 0.7);
  const blocks = new THREE.InstancedMesh(geometry, stone, segments);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const r = arenaRadius + 0.9;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const height = 0.5 + ((i * 37) % 7) * 0.06;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.PI / 2);
    matrix.compose(
      new THREE.Vector3(Math.cos(angle) * r, height / 2, Math.sin(angle) * r),
      quaternion,
      new THREE.Vector3((Math.PI * 2 * r) / segments - 0.08, height / 0.6, 1),
    );
    blocks.setMatrixAt(i, matrix);
  }
  blocks.receiveShadow = true;
  group.add(blocks);
  return group;
}

/** Columnas antiguas, algunas rotas, alrededor de la arena. */
function createPillars(arenaRadius: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#34302c', roughness: 0.85 });
  const shaft = new THREE.CylinderGeometry(0.55, 0.65, 1, 10);
  const base = new THREE.BoxGeometry(1.6, 0.5, 1.6);
  const shafts = new THREE.InstancedMesh(shaft, material, PILLAR_COUNT);
  const bases = new THREE.InstancedMesh(base, material, PILLAR_COUNT * 2);
  const matrix = new THREE.Matrix4();
  const r = arenaRadius + 3.2;
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const angle = -Math.PI / 2 + (i / PILLAR_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    // Las columnas pares sostienen braseros y están enteras; las impares están rotas.
    const height = i % 2 === 0 ? 3.8 : 1.6 + ((i * 53) % 10) * 0.25;
    matrix.compose(
      new THREE.Vector3(x, height / 2 + 0.25, z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, height, 1),
    );
    shafts.setMatrixAt(i, matrix);
    matrix.makeTranslation(x, 0.25, z);
    bases.setMatrixAt(i * 2, matrix);
    matrix.makeTranslation(x, height + 0.25, z);
    bases.setMatrixAt(i * 2 + 1, i % 2 === 0 ? matrix : new THREE.Matrix4().makeScale(0, 0, 0));
  }
  shafts.castShadow = true;
  group.add(shafts, bases);
  return group;
}

/** Siluetas de ruinas lejanas que se pierden en la niebla. */
function createDistantRuins(arenaRadius: number): THREE.InstancedMesh {
  const count = 46;
  const ruins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#16151a', roughness: 1 }),
    count,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.sin(i * 12.9) * 0.05;
    const r = arenaRadius + 8 + ((i * 29) % 17);
    const width = 2 + ((i * 7) % 5);
    const height = 3 + ((i * 13) % 11) * 1.4;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + ((i * 3) % 5) * 0.1);
    matrix.compose(
      new THREE.Vector3(Math.cos(angle) * r, height / 2, Math.sin(angle) * r),
      quaternion,
      new THREE.Vector3(width, height, 2),
    );
    ruins.setMatrixAt(i, matrix);
  }
  return ruins;
}

/**
 * Senderos de tierra pisada: un anillo que une los campamentos y uno recto hacia cada
 * campamento y cada base. Ayudan a orientarse sin mirar el minimapa.
 */
function createPaths(arenaRadius: number, groundTexture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  // Tierra más clara que la jungla; la textura se escala para que cada metro se vea igual.
  const dirt = (repeatX: number, repeatY: number): THREE.MeshStandardMaterial => {
    const texture = groundTexture.clone();
    texture.repeat.set(repeatX / 9, repeatY / 9);
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: '#c4ae92',
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  };
  const outer = MAP_DECOR.ringPath.to;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(MAP_DECOR.ringPath.from, outer, 128, 1),
    dirt(outer * 2, outer * 2),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  ring.receiveShadow = true;
  group.add(ring);

  const from = MAP_DECOR.plazaRadius;
  const length = arenaRadius - from;
  const width = MAP_DECOR.pathHalfWidth * 2 * 0.8;
  const strip = new THREE.PlaneGeometry(length, width);
  const material = dirt(length, width);
  strip.rotateX(-Math.PI / 2);
  strip.translate(from + length / 2, 0, 0);
  for (const angle of MAP_DECOR.pathAngles) {
    const path = new THREE.Mesh(strip, material);
    path.rotation.y = -angle;
    path.position.y = 0.006;
    path.receiveShadow = true;
    group.add(path);
  }
  return group;
}
