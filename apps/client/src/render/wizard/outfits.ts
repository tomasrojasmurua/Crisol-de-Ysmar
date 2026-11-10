import * as THREE from 'three';
import { frayBottom, jitter, type ModelKit } from './kit';

const HALF_PI = Math.PI / 2;

/** Perfil de una túnica (radio, altura), de abajo hacia el cuello. Se gira alrededor del eje. */
type Profile = readonly (readonly [number, number])[];

const ROBE: Profile = [
  [0.0, 0.0],
  [1.25, 0.0],
  [1.15, 0.25],
  [0.82, 0.85],
  [0.78, 1.05],
  [0.86, 1.3],
  [0.72, 1.48],
  [0.3, 1.58],
  [0.0, 1.6],
];

const PROFILES: Readonly<Record<string, Profile>> = {
  tunica: ROBE,
  habito: [
    [0.0, 0.0],
    [1.05, 0.0],
    [1.0, 0.3],
    [0.84, 0.9],
    [0.8, 1.05],
    [0.86, 1.3],
    [0.72, 1.48],
    [0.3, 1.58],
    [0.0, 1.6],
  ],
  bruja: [
    [0.0, 0.0],
    [1.6, 0.0],
    [1.5, 0.12],
    [1.1, 0.5],
    [0.72, 0.98],
    [0.7, 1.1],
    [0.84, 1.3],
    [0.7, 1.48],
    [0.3, 1.58],
    [0.0, 1.6],
  ],
  sectario: [
    [0.0, 0.0],
    [1.35, 0.0],
    [1.28, 0.4],
    [1.0, 0.95],
    [0.92, 1.2],
    [0.78, 1.48],
    [0.3, 1.58],
    [0.0, 1.6],
  ],
  chaman: ROBE,
  armadura: [
    [0.0, 0.0],
    [1.15, 0.0],
    [1.05, 0.3],
    [0.82, 0.85],
    [0.84, 1.05],
    [0.92, 1.3],
    [0.74, 1.48],
    [0.3, 1.58],
    [0.0, 1.6],
  ],
  harapos: ROBE,
  gala: [
    [0.0, 0.0],
    [1.2, 0.0],
    [1.1, 0.2],
    [0.78, 0.9],
    [0.74, 1.05],
    [0.84, 1.3],
    [0.7, 1.48],
    [0.3, 1.58],
    [0.0, 1.6],
  ],
};

/**
 * La ropa del hechicero: la túnica (cuya malla usa la Afinidad para sus grietas y su humo) y lo
 * que la acompaña. Devuelve la túnica.
 */
export function buildOutfit(kit: ModelKit, outfit: string): THREE.Mesh {
  const r = kit.radius;
  const profile = PROFILES[outfit] ?? ROBE;
  const points = profile.map(([x, y]) => new THREE.Vector2(x * r, y));
  const segments = outfit === 'harapos' || outfit === 'bruja' ? 28 : 18;
  const geometry = new THREE.LatheGeometry(points, segments);
  if (outfit === 'harapos') frayBottom(geometry, 0.3, 0.18);
  const robe = kit.solid(geometry, kit.robe, [0, 0, 0]);
  robe.userData.keep = true;

  const sash = (y: number, size = 0.8, tube = 0.045, material: THREE.Material = kit.trim): void => {
    kit.solid(new THREE.TorusGeometry(r * size, tube, 6, 20), material, [0, y, 0], [HALF_PI, 0, 0]);
  };
  const mantle = (): void => {
    kit.solid(
      new THREE.SphereGeometry(r * 0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
      kit.robe,
      [0, 1.32, 0],
      [0, 0, 0],
      [1.1, 0.7, 0.95],
    );
  };

  switch (outfit) {
    case 'habito': {
      mantle();
      sash(0.98, 0.82, 0.05, kit.cloth);
      // El paño que cruza del hombro a la cadera.
      kit.solid(
        new THREE.TorusGeometry(r * 0.88, 0.07, 6, 22),
        kit.cloth,
        [0, 1.2, 0],
        [HALF_PI, 0.75, 0],
        [1, 1, 1.15],
      );
      break;
    }
    case 'bruja': {
      sash(1.02, 0.72, 0.04);
      sash(1.14, 0.74, 0.03);
      // Chal sobre los hombros.
      kit.solid(new THREE.ConeGeometry(r * 1.15, 0.38, 18, 1, true), kit.cape, [0, 1.36, 0]);
      break;
    }
    case 'sectario': {
      mantle();
      sash(0.96, 0.98, 0.025, kit.cloth);
      const cord = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4);
      kit.solid(cord, kit.cloth, [0.12, 0.76, r * 0.98], [0.05, 0, 0]);
      kit.solid(cord, kit.cloth, [0.2, 0.8, r * 0.95], [0.08, 0, 0.1]);
      // Estandarte al frente con un sello que brilla.
      kit.solid(
        new THREE.BoxGeometry(0.26, 0.9, 0.015),
        kit.trim,
        [0, 0.62, r * 1.06],
        [-0.18, 0, 0],
      );
      kit.glow(
        new THREE.TorusGeometry(0.06, 0.012, 4, 16),
        kit.crystal,
        [0, 0.7, r * 1.08 + 0.02],
        [-0.18, 0, 0],
      );
      break;
    }
    case 'chaman': {
      sash(0.98, 0.8, 0.05, kit.fur);
      // Manto de pieles y collar de huesos.
      kit.solid(
        new THREE.TorusGeometry(r * 0.62, 0.14, 7, 14),
        kit.fur,
        [0, 1.42, 0],
        [HALF_PI, 0, 0],
        [1, 1, 0.8],
      );
      const tooth = new THREE.ConeGeometry(0.018, 0.08, 5);
      for (let i = 0; i < 7; i++) {
        const angle = -0.9 + i * 0.3;
        kit.solid(
          tooth,
          kit.bone,
          [Math.sin(angle) * 0.2, 1.47, Math.cos(angle) * 0.2],
          [Math.PI, 0, 0],
        );
      }
      break;
    }
    case 'armadura': {
      sash(0.98, 0.84, 0.06);
      // Hombreras, peto y faldones de metal.
      const pauldron = new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, HALF_PI);
      for (const side of [-1, 1]) {
        kit.solid(pauldron, kit.trim, [side * 0.31, 1.4, 0], [0, 0, -side * 0.35], [1, 0.8, 1.1]);
      }
      kit.solid(
        new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI, 0.6, 1.3),
        kit.trim,
        [0, 1.12, 0.02],
        [0, 0, 0],
        [0.95, 1, 0.7],
      );
      const tasset = new THREE.BoxGeometry(0.16, 0.24, 0.02);
      for (const side of [-1, 1]) {
        kit.solid(tasset, kit.trim, [side * 0.12, 0.8, r * 0.86], [-0.12, 0, 0]);
      }
      break;
    }
    case 'harapos': {
      mantle();
      sash(0.98, 0.8, 0.035, kit.cloth);
      // Remiendos de otra tela.
      const patch = new THREE.BoxGeometry(0.12, 0.1, 0.01);
      const spots: [number, number][] = [
        [0.6, 0.35],
        [-0.9, 0.62],
        [2.4, 0.3],
      ];
      spots.forEach(([angle, y], i) => {
        const radius = r * (y < 0.5 ? 1.08 : 0.86);
        kit.solid(
          patch,
          i % 2 ? kit.cloth : kit.fur,
          [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
          [0, angle, jitter(i, 0.3)],
        );
      });
      break;
    }
    case 'gala': {
      mantle();
      sash(0.98, 0.78, 0.035);
      // Cuello alto que enmarca la cabeza por detrás.
      kit.solid(
        new THREE.CylinderGeometry(0.3, 0.17, 0.42, 16, 1, true, Math.PI * 0.3, Math.PI * 1.4),
        kit.cape,
        [0, 1.72, -0.02],
      );
      const stripe = new THREE.BoxGeometry(0.035, 0.95, 0.01);
      for (const side of [-1, 1]) {
        kit.solid(stripe, kit.trim, [side * 0.09, 0.5, r * 1.02], [-0.33, 0, 0]);
      }
      break;
    }
    default: {
      mantle();
      sash(0.98);
      break;
    }
  }
  return robe;
}

/** La capa cuelga por la espalda: un trozo de cilindro abierto. */
export function buildCape(kit: ModelKit, cape: string): void {
  if (cape === 'ninguna') return;
  const long = cape !== 'corta';
  const height = long ? 1.45 : 0.75;
  const geometry = new THREE.CylinderGeometry(
    0.34,
    long ? 0.62 : 0.5,
    height,
    16,
    4,
    true,
    Math.PI * 0.62,
    Math.PI * 0.76,
  );
  if (cape === 'harapienta') {
    geometry.translate(0, height / 2, 0);
    frayBottom(geometry, 0.12, 0.2);
    geometry.translate(0, -height / 2, 0);
  }
  kit.solid(geometry, kit.cape, [0, 1.5 - height / 2, -0.04]);
  // El broche que la sostiene.
  for (const side of [-1, 1]) {
    kit.solid(new THREE.SphereGeometry(0.035, 8, 6), kit.trim, [side * 0.2, 1.48, 0.1]);
  }
}
