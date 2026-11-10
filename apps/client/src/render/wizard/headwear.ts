import * as THREE from 'three';
import type { FaceInfo } from './faces';
import { HEAD_Y, type ModelKit } from './kit';

const HALF_PI = Math.PI / 2;

/**
 * Lo que va en la cabeza. Se apoya en la coronilla del rostro, así un sombrero le calza igual a
 * un humano que a un sapo. Devuelve la altura de lo más alto (donde brotan las astas de Raíz).
 */
export function buildHeadwear(kit: ModelKit, id: string, face: FaceInfo, faceId: string): number {
  const top = face.top;
  const w = face.width;
  switch (id) {
    case 'capucha':
      return deepHood(kit);
    case 'abierta':
      return openHood(kit, face);
    case 'sombrero': {
      kit.solid(
        new THREE.CylinderGeometry(0.44, 0.46, 0.03, 24),
        kit.robe,
        [0, top - 0.06, 0],
        [-0.12, 0, 0],
      );
      kit.solid(
        new THREE.ConeGeometry(0.2, 0.62, 16, 1, true),
        kit.robe,
        [0, top + 0.24, -0.06],
        [-0.32, 0, 0],
      );
      kit.solid(
        new THREE.TorusGeometry(0.19, 0.025, 6, 20),
        kit.trim,
        [0, top - 0.02, -0.01],
        [HALF_PI - 0.12, 0, 0],
      );
      return top + 0.5;
    }
    case 'bruja': {
      kit.solid(
        new THREE.CylinderGeometry(0.5, 0.52, 0.025, 24),
        kit.robe,
        [0, top - 0.06, 0],
        [0.1, 0, 0.05],
      );
      // Un cono en tres tramos, cada uno más torcido: la punta se dobla hacia atrás.
      const tiers: [number, number, number, number, number, number][] = [
        [0.15, 0.22, 0.3, 0, top + 0.1, 0],
        [0.08, 0.15, 0.28, -0.04, top + 0.37, -0.25],
        [0.0, 0.08, 0.26, -0.13, top + 0.58, -0.75],
      ];
      for (const [rt, rb, h, z, y, tilt] of tiers) {
        kit.solid(
          new THREE.CylinderGeometry(rt, rb, h, 14, 1, true),
          kit.robe,
          [0, y, z],
          [tilt, 0, 0],
        );
      }
      kit.solid(
        new THREE.TorusGeometry(0.215, 0.022, 6, 20),
        kit.trim,
        [0, top - 0.02, 0],
        [HALF_PI, 0, 0],
      );
      kit.solid(new THREE.BoxGeometry(0.07, 0.07, 0.02), kit.trim, [0, top - 0.01, 0.215]);
      return top + 0.6;
    }
    case 'diadema': {
      if (faceId === 'humano' || faceId === 'elfo') {
        kit.solid(
          new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
          kit.hair,
          [0, HEAD_Y + 0.02, -0.01],
          [-0.5, 0, 0],
        );
      }
      kit.solid(
        new THREE.TorusGeometry(w - 0.002, 0.016, 6, 24),
        kit.trim,
        [0, top - 0.11, 0.02],
        [HALF_PI + 0.15, 0, 0],
      );
      kit.glow(
        new THREE.OctahedronGeometry(0.035),
        kit.crystal,
        [0, top - 0.09, w + 0.02],
        [0, 0, 0],
        [0.8, 1.3, 0.6],
      );
      return top + 0.05;
    }
    case 'cresta': {
      // Gorro de cresta: un arco alto de lana que va de la frente a la nuca.
      kit.solid(new THREE.SphereGeometry(w + 0.01, 14, 8, 0, Math.PI * 2, 0, HALF_PI), kit.trim, [
        0,
        top - 0.08,
        0,
      ]);
      kit.solid(
        new THREE.TorusGeometry(0.17, 0.07, 8, 18, Math.PI),
        kit.trim,
        [0, top - 0.02, 0],
        [0, HALF_PI, 0],
        [1, 1.1, 0.45],
      );
      return top + 0.2;
    }
    case 'turbante': {
      for (let i = 0; i < 3; i++) {
        kit.solid(
          new THREE.TorusGeometry(w - 0.01 - i * 0.025, 0.055, 8, 20),
          kit.cloth,
          [0, top - 0.07 + i * 0.06, -0.01],
          [HALF_PI + 0.12 - i * 0.08, 0, i * 0.1],
        );
      }
      kit.glow(new THREE.OctahedronGeometry(0.04), kit.crystal, [0, top - 0.02, w + 0.05]);
      return top + 0.12;
    }
    case 'corona': {
      kit.solid(
        new THREE.TorusGeometry(w + 0.005, 0.02, 6, 24),
        kit.bone,
        [0, top - 0.06, 0],
        [HALF_PI, 0, 0],
      );
      const spike = new THREE.ConeGeometry(0.025, 0.16, 5);
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const tall = i === 0 ? 0.05 : 0;
        kit.solid(
          spike,
          kit.bone,
          [Math.sin(angle) * w, top + 0.02 + tall / 2, Math.cos(angle) * w],
          [0, 0, 0],
          [1, 1 + tall * 6, 1],
        );
      }
      return top + 0.15;
    }
    case 'yelmo': {
      kit.solid(
        new THREE.SphereGeometry(w + 0.03, 16, 10, 0, Math.PI * 2, 0, HALF_PI * 1.1),
        kit.trim,
        [0, top - 0.12, 0],
      );
      const guard = new THREE.BoxGeometry(0.03, 0.14, 0.12);
      for (const side of [-1, 1]) kit.solid(guard, kit.trim, [side * (w + 0.02), top - 0.2, 0.05]);
      const horn = new THREE.ConeGeometry(0.03, 0.2, 6);
      for (const side of [-1, 1]) {
        kit.solid(horn, kit.horn, [side * (w + 0.06), top + 0.02, 0], [0, 0, -side * 0.9]);
      }
      return top + 0.12;
    }
    case 'tocado': {
      kit.solid(
        new THREE.TorusGeometry(w, 0.025, 6, 20),
        kit.trim,
        [0, top - 0.06, 0],
        [HALF_PI + 0.1, 0, 0],
      );
      const feather = new THREE.ConeGeometry(0.04, 0.38, 4);
      for (let i = 0; i < 7; i++) {
        const spread = (i - 3) * 0.32;
        kit.solid(
          feather,
          i % 2 ? kit.cloth : kit.robe,
          [Math.sin(spread) * 0.12, top + 0.13, -0.08],
          [-0.35, 0, -spread * 0.9],
          [1, 1, 0.3],
        );
      }
      return top + 0.32;
    }
    default:
      return top;
  }
}

/** Capucha honda: el rostro queda en sombra (es la de siempre). */
function deepHood(kit: ModelKit): number {
  const r = kit.radius;
  const profile = [
    [0.0, 0.0],
    [r * 0.62, 0.02],
    [r * 0.66, 0.25],
    [r * 0.5, 0.48],
    [r * 0.2, 0.68],
    [0.0, 0.82],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  kit.solid(new THREE.LatheGeometry(profile, 16), kit.robe, [0, 1.5, -0.04], [-0.18, 0, 0]);
  return 2.2;
}

/** Capucha echada atrás: cubre la nuca y deja ver el rostro. */
function openHood(kit: ModelKit, face: FaceInfo): number {
  const profile = [
    [0.0, 0.0],
    [0.27, 0.02],
    [0.29, 0.2],
    [0.22, 0.36],
    [0.08, 0.46],
    [0.0, 0.5],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Solo la mitad de atrás del torno, para que no tape la cara.
  const hood = new THREE.LatheGeometry(profile, 14, Math.PI * 0.55, Math.PI * 0.9);
  kit.solid(hood, kit.cape, [0, face.top - 0.36, -0.05], [-0.35, 0, 0]);
  return face.top + 0.1;
}
