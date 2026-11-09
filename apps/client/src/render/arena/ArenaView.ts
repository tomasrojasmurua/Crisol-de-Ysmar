import { ELEMENTS } from '@crisol/content';
import * as THREE from 'three';
import type { Particles } from '../Particles';
import { createFloorTexture, createGlowTexture, createRuneCircleTexture } from './textures';

const BACKGROUND = '#07070c';
const PILLAR_COUNT = 10;

interface Brazier {
  readonly flame: THREE.Sprite;
  readonly light: THREE.PointLight;
  readonly color: THREE.Color;
  readonly position: THREE.Vector3;
  readonly phase: number;
}

/**
 * El Crisol: una arena de piedra en ruinas bajo la luna, con un círculo rúnico al centro
 * y cinco braseros, uno por elemento. La escena es oscura a propósito: la magia es lo que brilla.
 */
export class ArenaView {
  readonly scene = new THREE.Scene();
  private readonly braziers: Brazier[] = [];
  private readonly runeMaterial: THREE.MeshBasicMaterial;
  private readonly stars: THREE.Points;
  private emberTimer = 0;

  constructor(
    private readonly arenaRadius: number,
    private readonly particles: Particles,
  ) {
    const scene = this.scene;
    scene.background = new THREE.Color(BACKGROUND);
    scene.fog = new THREE.FogExp2(BACKGROUND, 0.022);

    scene.add(createSky());
    this.stars = createStars();
    scene.add(this.stars);
    scene.add(createMoon());

    const outer = arenaRadius + 9;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(outer, 96),
      new THREE.MeshStandardMaterial({
        map: createFloorTexture(arenaRadius, outer),
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Más allá de las losas, tierra oscura que se pierde en la niebla.
    const ground = new THREE.Mesh(
      new THREE.RingGeometry(outer - 0.5, 140, 64),
      new THREE.MeshStandardMaterial({ color: '#100f12', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    this.runeMaterial = new THREE.MeshBasicMaterial({
      map: createRuneCircleTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), this.runeMaterial);
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.02;
    scene.add(rune);

    scene.add(createLowWall(arenaRadius));
    scene.add(createPillars(arenaRadius));
    scene.add(createDistantRuins());
    this.createBraziers();
    this.createLights();
  }

  update(timeSeconds: number, deltaSeconds: number): void {
    this.runeMaterial.opacity = 0.55 + 0.15 * Math.sin(timeSeconds * 0.8);
    for (const brazier of this.braziers) {
      const flicker =
        0.85 + 0.1 * Math.sin(timeSeconds * 11 + brazier.phase) + 0.05 * Math.sin(timeSeconds * 23);
      brazier.light.intensity = 6 * flicker;
      brazier.flame.scale.set(1.3 * flicker, 1.9 * flicker, 1);
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

  private createBraziers(): void {
    const glow = createGlowTexture();
    const bowlGeometry = new THREE.CylinderGeometry(0.55, 0.3, 0.4, 12, 1, true);
    const bowlMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2622',
      roughness: 0.6,
      metalness: 0.5,
      side: THREE.DoubleSide,
    });
    ELEMENTS.forEach((element, i) => {
      // Un brasero cada dos columnas, en el orden del pentágono.
      const angle = -Math.PI / 2 + (i / ELEMENTS.length) * Math.PI * 2;
      const r = this.arenaRadius + 3.2;
      const position = new THREE.Vector3(Math.cos(angle) * r, 4.25, Math.sin(angle) * r);
      const color = new THREE.Color(element.color);

      const bowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
      bowl.position.copy(position);
      this.scene.add(bowl);

      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: color.clone().multiplyScalar(2.2),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      flame.position.copy(position).add(new THREE.Vector3(0, 0.75, 0));
      this.scene.add(flame);

      const light = new THREE.PointLight(color, 6, 12, 1.6);
      light.position.copy(position).add(new THREE.Vector3(0, 1, 0));
      this.scene.add(light);

      this.braziers.push({ flame, light, color, position, phase: i * 1.7 });
    });
  }

  private createLights(): void {
    this.scene.add(new THREE.HemisphereLight('#5d6380', '#1c1714', 1.15));
    // La luna proyecta las sombras de los magos sobre la piedra.
    const moon = new THREE.DirectionalLight('#aeb9ff', 1.6);
    moon.position.set(-12, 22, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const extent = this.arenaRadius + 2;
    const shadowCamera = moon.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = 1;
    shadowCamera.far = 60;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.03;
    this.scene.add(moon);
    // Relleno cálido desde el lado opuesto, para que nadie quede negro de espaldas.
    const fill = new THREE.DirectionalLight('#8a7660', 0.55);
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
      middle: { value: new THREE.Color('#0d0d18') },
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
function createDistantRuins(): THREE.InstancedMesh {
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
    const r = 34 + ((i * 29) % 17);
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
