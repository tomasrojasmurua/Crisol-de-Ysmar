import type { MapLayout, Obstacle } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, glow } from '../palette';

/** Un número estable por obstáculo, para variar giro y forma sin azar. */
function hash(o: Obstacle, salt: number): number {
  const v = Math.sin(o.x * 12.9898 + o.z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Lo que la jungla necesita saber para no tapar al jugador. */
interface SeeThroughUniforms {
  readonly uJungleCamera: { value: THREE.Vector3 };
  readonly uJunglePlayer: { value: THREE.Vector3 };
  readonly uJungleActive: { value: number };
}

/**
 * Hace que la jungla se deshilache entre la cámara y el jugador: lo que tapa la vista se dibuja
 * a medias, con un tramado de puntos. Las sombras no cambian.
 */
function seeThrough(material: THREE.Material, uniforms: SeeThroughUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vJungleWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 jungleWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          jungleWorld = instanceMatrix * jungleWorld;
        #endif
        vJungleWorld = (modelMatrix * jungleWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vJungleWorld;
        uniform vec3 uJungleCamera;
        uniform vec3 uJunglePlayer;
        uniform float uJungleActive;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (uJungleActive > 0.5) {
          vec3 segment = uJunglePlayer - uJungleCamera;
          float t = clamp(dot(vJungleWorld - uJungleCamera, segment) / max(dot(segment, segment), 1e-3), 0.0, 1.0);
          float away = length(vJungleWorld - (uJungleCamera + segment * t));
          float fade = (1.0 - smoothstep(1.8, 3.4, away)) * smoothstep(0.4, 1.2, vJungleWorld.y);
          float noise = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (noise < fade * 0.82) discard;
        }`,
      );
  };
}

/** Muchas copias de una malla en una sola llamada de dibujo. */
function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  items: readonly Obstacle[],
  place: (o: Obstacle, matrix: THREE.Matrix4) => void,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  const matrix = new THREE.Matrix4();
  items.forEach((o, i) => {
    place(o, matrix);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.count = items.length;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * La jungla alrededor del Crisol: árboles retorcidos, rocas y ruinas, todos dibujados con
 * mallas instanciadas para que el celular los mueva sin esfuerzo. Los campamentos son claros
 * con un círculo en el suelo del color de su elemento.
 */
export class JungleView {
  readonly group = new THREE.Group();
  private readonly campMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly uniforms: SeeThroughUniforms = {
    uJungleCamera: { value: new THREE.Vector3() },
    uJunglePlayer: { value: new THREE.Vector3() },
    uJungleActive: { value: 0 },
  };

  constructor(map: MapLayout) {
    const trees = map.obstacles.filter((o) => o.kind === 'tree');
    const rocks = map.obstacles.filter((o) => o.kind === 'rock');
    const ruins = map.obstacles.filter((o) => o.kind === 'ruin');
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    // Árboles: tronco oscuro y copa en capas, verde muy apagado para que la magia resalte.
    const trunk = new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7);
    trunk.translate(0, 1.3, 0);
    const bark = new THREE.MeshStandardMaterial({ color: '#3a2e22', roughness: 0.95 });
    this.group.add(
      instanced(trunk, bark, trees, (o, m) => {
        const s = o.radius / 0.7;
        quaternion.setFromAxisAngle(up, hash(o, 1) * Math.PI * 2);
        m.compose(position.set(o.x, 0, o.z), quaternion, scale.set(s, 0.9 + hash(o, 2) * 0.5, s));
      }),
    );
    const crown = new THREE.ConeGeometry(1.5, 2.4, 7);
    crown.translate(0, 3.4, 0);
    const crownTop = new THREE.ConeGeometry(1.05, 1.9, 7);
    crownTop.translate(0, 4.6, 0);
    const leaves = new THREE.MeshStandardMaterial({
      color: '#2d4a37',
      roughness: 0.9,
      flatShading: true,
    });
    for (const geometry of [crown, crownTop]) {
      this.group.add(
        instanced(geometry, leaves, trees, (o, m) => {
          const s = (o.radius / 0.7) * (0.85 + hash(o, 3) * 0.35);
          const h = 0.9 + hash(o, 2) * 0.5;
          quaternion.setFromAxisAngle(up, hash(o, 4) * Math.PI * 2);
          m.compose(position.set(o.x, 0, o.z), quaternion, scale.set(s, h, s));
        }),
      );
    }

    // Rocas: piedras facetadas, achatadas y giradas.
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const stone = new THREE.MeshStandardMaterial({
      color: '#4a4744',
      roughness: 0.95,
      flatShading: true,
    });
    this.group.add(
      instanced(rockGeometry, stone, rocks, (o, m) => {
        const tilt = new THREE.Euler(hash(o, 5) * 0.4, hash(o, 6) * Math.PI * 2, hash(o, 7) * 0.4);
        quaternion.setFromEuler(tilt);
        const h = o.radius * (0.6 + hash(o, 8) * 0.5);
        m.compose(position.set(o.x, h * 0.45, o.z), quaternion, scale.set(o.radius, h, o.radius));
      }),
    );

    // Ruinas: columnas quebradas de la ciudad antigua, de distinta altura.
    const column = new THREE.CylinderGeometry(0.8, 0.9, 1, 10);
    column.translate(0, 0.5, 0);
    const ruinStone = new THREE.MeshStandardMaterial({ color: '#5a544d', roughness: 0.85 });
    this.group.add(
      instanced(column, ruinStone, ruins, (o, m) => {
        quaternion.setFromAxisAngle(up, hash(o, 9) * Math.PI);
        const s = o.radius;
        m.compose(position.set(o.x, 0, o.z), quaternion, scale.set(s, 1.4 + hash(o, 10) * 3.2, s));
      }),
    );
    const capital = new THREE.BoxGeometry(2.1, 0.35, 2.1);
    this.group.add(
      instanced(capital, ruinStone, ruins, (o, m) => {
        const h = 1.4 + hash(o, 10) * 3.2;
        quaternion.setFromEuler(new THREE.Euler(hash(o, 11) * 0.25, hash(o, 9) * Math.PI, 0));
        m.compose(position.set(o.x, h + 0.1, o.z), quaternion, scale.set(o.radius, 1, o.radius));
      }),
    );

    for (const material of [bark, leaves, stone, ruinStone]) seeThrough(material, this.uniforms);

    // Campamentos: un círculo rúnico tenue y piedras que brillan del color del elemento.
    const ringGeometry = new THREE.RingGeometry(3.3, 3.6, 48);
    // Las piedras de todos los campamentos van en una sola malla instanciada.
    const stones = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial(),
      map.camps.length * 4,
    );
    const matrix = new THREE.Matrix4();
    map.camps.forEach((camp, c) => {
      const color = elementColor(camp.element);
      const material = new THREE.MeshBasicMaterial({
        color: glow(color, 0.9),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      this.campMaterials.push(material);
      const ring = new THREE.Mesh(ringGeometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(camp.x, 0.03, camp.z);
      this.group.add(ring);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        matrix.compose(
          position.set(camp.x + Math.cos(a) * 3.45, 0.25, camp.z + Math.sin(a) * 3.45),
          quaternion.identity(),
          scale.set(1, 1.6, 1),
        );
        stones.setMatrixAt(c * 4 + k, matrix);
        stones.setColorAt(c * 4 + k, glow(color, 1.8));
      }
    });
    this.group.add(stones);
  }

  /** `player` en null (menú, Vestidor) deja la jungla entera. */
  update(
    timeSeconds: number,
    camera: THREE.Vector3,
    player: { x: number; z: number } | null,
  ): void {
    this.uniforms.uJungleActive.value = player ? 1 : 0;
    this.uniforms.uJungleCamera.value.copy(camera);
    if (player) this.uniforms.uJunglePlayer.value.set(player.x, 1.1, player.z);
    this.campMaterials.forEach((material, i) => {
      material.opacity = 0.35 + 0.12 * Math.sin(timeSeconds * 1.3 + i);
    });
  }
}
