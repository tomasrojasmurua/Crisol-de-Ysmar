import * as THREE from 'three';

/**
 * Las formas que puede tener una chispa. Todas viven en una sola textura (un atlas de 4 × 2
 * casillas), así el sistema de partículas sigue dibujándose en una sola llamada.
 */
export const PARTICLE_SHAPES = {
  /** Punto de luz con centro caliente: la chispa de siempre. */
  dot: 0,
  /** Raya fina que se estira en la dirección en que vuela. */
  spark: 1,
  /** Lengua de fuego. */
  ember: 2,
  /** Voluta de humo que crece al apagarse. */
  smoke: 3,
  /** Hoja con nervio. */
  leaf: 4,
  /** Gota, alargada en la dirección en que cae. */
  drop: 5,
  /** Destello de cuatro puntas. */
  star: 6,
  /** Esquirla de cristal o hielo. */
  shard: 7,
} as const;

export type ParticleShape = keyof typeof PARTICLE_SHAPES;

/** Formas que se orientan según su velocidad en pantalla (las demás giran solas). */
export const ORIENTED_SHAPES: ReadonlySet<number> = new Set([
  PARTICLE_SHAPES.spark,
  PARTICLE_SHAPES.drop,
  PARTICLE_SHAPES.ember,
]);

const CELL = 64;
const COLUMNS = 4;
const ROWS = 2;

type Painter = (ctx: CanvasRenderingContext2D, c: number) => void;

function radial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: readonly [number, number][],
): CanvasGradient {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  return gradient;
}

/** Cada forma se dibuja en blanco sobre negro, mirando hacia la derecha (+x). */
const PAINTERS: readonly Painter[] = [
  // dot
  (ctx, c) => {
    ctx.fillStyle = radial(ctx, c, c, c, [
      [0, 1],
      [0.18, 0.9],
      [0.4, 0.35],
      [1, 0],
    ]);
    ctx.fillRect(0, 0, CELL, CELL);
  },
  // spark: una raya con la punta encendida.
  (ctx, c) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.scale(1, 0.12);
    ctx.fillStyle = radial(ctx, 0, 0, c, [
      [0, 1],
      [0.35, 0.7],
      [1, 0],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = radial(ctx, c + 10, c, 9, [
      [0, 1],
      [1, 0],
    ]);
    ctx.fillRect(0, 0, CELL, CELL);
  },
  // ember: lengua de fuego que apunta hacia +x (hacia donde va).
  (ctx, c) => {
    ctx.save();
    ctx.translate(c - 6, c);
    ctx.fillStyle = radial(ctx, 0, 0, 22, [
      [0, 1],
      [0.5, 0.6],
      [1, 0],
    ]);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.bezierCurveTo(-18, -16, 6, -14, 30, 0);
    ctx.bezierCurveTo(6, 14, -18, 16, -18, 0);
    ctx.fill();
    ctx.restore();
  },
  // smoke: voluta hecha de varias bolas suaves.
  (ctx, c) => {
    const puffs: readonly [number, number, number][] = [
      [0, 0, 20],
      [-10, 6, 15],
      [11, 5, 14],
      [4, -10, 13],
      [-8, -8, 11],
    ];
    for (const [x, y, r] of puffs) {
      ctx.fillStyle = radial(ctx, c + x, c + y, r, [
        [0, 0.5],
        [0.6, 0.25],
        [1, 0],
      ]);
      ctx.fillRect(0, 0, CELL, CELL);
    }
  },
  // leaf
  (ctx, c) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.quadraticCurveTo(0, -18, 24, 0);
    ctx.quadraticCurveTo(0, 18, -24, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = radial(ctx, c, c, c, [
      [0, 1],
      [1, 0.45],
    ]);
    ctx.fillRect(0, 0, CELL, CELL);
    ctx.globalCompositeOperation = 'source-over';
  },
  // drop: gota con la punta hacia atrás y brillo en el frente.
  (ctx, c) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = radial(ctx, 8, 0, 18, [
      [0, 1],
      [0.6, 0.7],
      [1, 0.15],
    ]);
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.quadraticCurveTo(0, -12, 12, -10);
    ctx.arc(12, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.quadraticCurveTo(0, 12, -26, 0);
    ctx.fill();
    ctx.restore();
  },
  // star: cuatro puntas finas y un centro.
  (ctx, c) => {
    ctx.save();
    ctx.translate(c, c);
    for (const angle of [0, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(angle);
      ctx.scale(1, 0.08);
      ctx.fillStyle = radial(ctx, 0, 0, c, [
        [0, 1],
        [0.4, 0.5],
        [1, 0],
      ]);
      ctx.beginPath();
      ctx.arc(0, 0, c, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = radial(ctx, 0, 0, 14, [
      [0, 1],
      [1, 0],
    ]);
    ctx.fillRect(-c, -c, CELL, CELL);
    ctx.restore();
  },
  // shard: rombo alargado con una cara más clara.
  (ctx, c) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(0, -9);
    ctx.lineTo(26, 0);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(0, -9);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
];

/** Dibuja el atlas una vez; la tarjeta gráfica lo recibe como una textura de 256 × 128. */
export function createParticleAtlas(): THREE.Texture {
  const element = document.createElement('canvas');
  element.width = CELL * COLUMNS;
  element.height = CELL * ROWS;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el lienzo de las chispas');
  PAINTERS.forEach((paint, i) => {
    ctx.save();
    ctx.translate((i % COLUMNS) * CELL, Math.floor(i / COLUMNS) * CELL);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    paint(ctx, CELL / 2);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(element);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export const ATLAS_COLUMNS = COLUMNS;
export const ATLAS_ROWS = ROWS;
