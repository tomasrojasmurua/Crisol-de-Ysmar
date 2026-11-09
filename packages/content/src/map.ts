import {
  type Camp,
  ELEMENT_IDS,
  type ElementId,
  type MapLayout,
  type Obstacle,
  SeededRng,
} from '@crisol/core';
import { FEATURES } from './features';

/** Radio del mapa, en metros. Cruzarlo caminando toma unos 15 segundos. */
export const MAP_RADIUS = 40;

/** La plaza del centro queda libre: ahí termina la Convergencia. */
export const PLAZA_RADIUS = 15;
/** Los campamentos están en un anillo a media distancia, sobre los senderos. */
const CAMP_RADIUS = 24;
const CAMP_CLEARING = 5;
/** Donde aparecen los magos: el borde del mapa, cada 30 grados. */
const SPAWN_RADIUS = 32;
const SPAWN_CLEARING = 5;
/** Un sendero circular une los campamentos con las bases. */
const RING_PATH = { from: 27.5, to: 30 };
const PATH_HALF_WIDTH = 1.8;
/** Hueco mínimo entre obstáculos para que un mago pase. */
const GAP = 1.4;

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * Diez campamentos, dos por elemento, en espejo respecto del centro:
 * los equipos aparecen en bordes opuestos y cada uno tiene los mismos cinco cerca.
 */
function campLayout(): Camp[] {
  const camps: Camp[] = [];
  for (let k = 0; k < 10; k++) {
    const angle = deg(-72 + 36 * k);
    camps.push({
      x: Math.cos(angle) * CAMP_RADIUS,
      z: Math.sin(angle) * CAMP_RADIUS,
      element: ELEMENT_IDS[k % 5] ?? 'brasa',
    });
  }
  return camps;
}

/** Las ruinas del Crisol: pilares rotos en la plaza que sirven de cobertura. */
function plazaRuins(): Obstacle[] {
  const ruins: Obstacle[] = [];
  for (let k = 0; k < 6; k++) {
    const angle = deg(-60 + 60 * k);
    ruins.push({ x: Math.cos(angle) * 8.5, z: Math.sin(angle) * 8.5, radius: 0.9, kind: 'ruin' });
  }
  return ruins;
}

/**
 * Diez braseros al borde de la plaza, dos por elemento y en espejo. Son obstáculos bajos:
 * cubren poco, pero se ven de lejos y orientan.
 */
const BRAZIER_RADIUS = 15.6;
function plazaBraziers(): { x: number; z: number; element: ElementId }[] {
  return Array.from({ length: 10 }, (_, k) => {
    const angle = deg(9 + 36 * k); // Entre senderos, para no taparlos.
    return {
      x: Math.cos(angle) * BRAZIER_RADIUS,
      z: Math.sin(angle) * BRAZIER_RADIUS,
      element: ELEMENT_IDS[k % 5] ?? 'brasa',
    };
  });
}

/** Lo que hay en la plaza en cualquier mapa: las ruinas del Crisol y los braseros. */
function plazaObstacles(): Obstacle[] {
  return [
    ...plazaRuins(),
    ...plazaBraziers().map((b) => ({ x: b.x, z: b.z, radius: 0.55, kind: 'brazier' })),
  ];
}

function distanceToRay(x: number, z: number, angle: number): number {
  // Distancia a la semirrecta desde el centro con ese ángulo.
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const t = Math.max(0, x * dx + z * dz);
  return Math.hypot(x - dx * t, z - dz * t);
}

/**
 * Arma el mapa con una semilla fija: siempre sale igual. La jungla llena el anillo entre la plaza
 * y el borde, salvo los claros (campamentos y bases) y los senderos: uno radial por campamento,
 * uno hacia cada base y el anillo que los une.
 */
function buildMap(): MapLayout {
  const camps = campLayout();
  const obstacles: Obstacle[] = plazaObstacles();
  const spawnAngles = Array.from({ length: 12 }, (_, i) => deg(-90 + 30 * i));
  const pathAngles = [...camps.map((c) => Math.atan2(c.z, c.x)), deg(-90), deg(90)];
  const rng = new SeededRng(0x5eed_1a55);

  const free = (x: number, z: number, radius: number): boolean => {
    const r = Math.hypot(x, z);
    if (r < PLAZA_RADIUS + radius || r > MAP_RADIUS - radius - 0.5) return false;
    if (r + radius > RING_PATH.from && r - radius < RING_PATH.to) return false;
    for (const camp of camps) {
      if (Math.hypot(x - camp.x, z - camp.z) < CAMP_CLEARING + radius) return false;
    }
    for (const angle of spawnAngles) {
      const sx = Math.cos(angle) * SPAWN_RADIUS;
      const sz = Math.sin(angle) * SPAWN_RADIUS;
      if (Math.hypot(x - sx, z - sz) < SPAWN_CLEARING + radius) return false;
    }
    for (const angle of pathAngles) {
      if (distanceToRay(x, z, angle) < PATH_HALF_WIDTH + radius) return false;
    }
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + radius + GAP) return false;
    }
    return true;
  };

  // Se prueban candidatos al azar; los que caen en un claro o encima de otro se descartan.
  // Se coloca en espejo para que ningún lado tenga ventaja.
  for (let attempt = 0; attempt < 8000 && obstacles.length < 190; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const r = PLAZA_RADIUS + rng.next() * (MAP_RADIUS - PLAZA_RADIUS);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const roll = rng.next();
    const kind = roll < 0.62 ? 'tree' : roll < 0.92 ? 'rock' : 'ruin';
    const radius =
      kind === 'tree'
        ? 0.55 + rng.next() * 0.35
        : kind === 'rock'
          ? 0.9 + rng.next() * 0.8
          : 1.4 + rng.next() * 0.6;
    if (!free(x, z, radius) || !free(-x, -z, radius)) continue;
    obstacles.push({ x, z, radius, kind });
    obstacles.push({ x: -x, z: -z, radius, kind });
  }
  return { obstacles, camps, guardianLair: FEATURES.guardian ? { x: 0, z: 0 } : null };
}

/** La jungla completa: para 2v2 en adelante (y para el 1v1 si `FEATURES.duelInJungle`). */
export const MAP: MapLayout = buildMap();

/**
 * Radio de la arena del duelo: la plaza con sus braseros adentro y un poco de aire para
 * rodearlos. Los magos aparecen al 80%, a unos 27 m uno del otro.
 */
export const PLAZA_ARENA_RADIUS = 17;

/** El 1v1: solo la plaza, sin jungla, campamentos ni Guardián. Las ruinas sirven de cobertura. */
export const PLAZA_MAP: MapLayout = { obstacles: plazaObstacles(), camps: [], guardianLair: null };

/** Lo que el cliente necesita para dibujar el mapa y que el núcleo no usa: senderos y braseros. */
export const MAP_DECOR = {
  plazaRadius: PLAZA_RADIUS,
  ringPath: RING_PATH,
  pathHalfWidth: PATH_HALF_WIDTH,
  pathAngles: [...MAP.camps.map((c) => Math.atan2(c.z, c.x)), deg(-90), deg(90)],
  braziers: plazaBraziers(),
  /** Hasta dónde ve un mago (si la jungla no lo tapa): más lejos, el rival no sale en pantalla. */
  sightRange: 22,
} as const;
