import { ELEMENTS } from '@crisol/content';
import * as THREE from 'three';

/**
 * Texturas dibujadas en código, sin descargar imágenes: piedra del suelo y el círculo
 * rúnico del centro. Cuando lleguen las texturas del Hito 5 se reemplazan aquí.
 */

/** Generador pseudoaleatorio pequeño para que la arena se vea igual en todos los celulares. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const context = element.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de texturas');
  return [element, context];
}

/**
 * Losas de piedra en anillos concéntricos, con grietas y manchas.
 * `arenaRadius` y `outerRadius` en metros; la textura cubre el disco completo.
 */
export function createFloorTexture(arenaRadius: number, outerRadius: number): THREE.Texture {
  const size = 2048;
  const [element, ctx] = canvas(size);
  const random = seeded(7);
  const center = size / 2;
  const pxPerMeter = size / 2 / outerRadius;

  ctx.fillStyle = '#1b1a1d';
  ctx.fillRect(0, 0, size, size);

  // Anillos de losas: cada anillo mide ~1,6 m y tiene losas de ~2,2 m de largo.
  const ringWidth = 1.6;
  for (let r0 = 1.2; r0 < outerRadius; r0 += ringWidth) {
    const r1 = r0 + ringWidth;
    const count = Math.max(6, Math.round((Math.PI * 2 * (r0 + ringWidth / 2)) / 2.2));
    const offset = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a0 = offset + (i / count) * Math.PI * 2;
      const a1 = offset + ((i + 1) / count) * Math.PI * 2;
      const inside = r0 < arenaRadius;
      const base = inside ? 44 + random() * 16 : 30 + random() * 10;
      const warm = random() * 6;
      ctx.fillStyle = `rgb(${base + warm}, ${base + warm * 0.6}, ${base + 4})`;
      ctx.beginPath();
      ctx.arc(center, center, r1 * pxPerMeter - 2, a0 + 0.006, a1 - 0.006);
      ctx.arc(center, center, r0 * pxPerMeter + 2, a1 - 0.006, a0 + 0.006, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Disco central entero, donde va el círculo rúnico.
  ctx.fillStyle = '#2e2c2f';
  ctx.beginPath();
  ctx.arc(center, center, 1.2 * pxPerMeter, 0, Math.PI * 2);
  ctx.fill();

  // Manchas y desgaste.
  for (let i = 0; i < 1400; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 4 + random() * 40;
    const light = random() < 0.5;
    ctx.fillStyle = light ? 'rgba(255,245,230,0.025)' : 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grietas finas.
  ctx.strokeStyle = 'rgba(8,8,10,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) {
    let x = random() * size;
    let y = random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (random() - 0.5) * 60;
      y += (random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Borde de la arena: una banda de piedra más clara.
  ctx.strokeStyle = 'rgba(120,110,95,0.5)';
  ctx.lineWidth = 0.35 * pxPerMeter;
  ctx.beginPath();
  ctx.arc(center, center, arenaRadius * pxPerMeter, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Círculo rúnico del centro: el pentágono de los cinco elementos, con cada vértice
 * en el color de su elemento. Se usa como textura que brilla en la oscuridad.
 */
export function createRuneCircleTexture(): THREE.Texture {
  const size = 1024;
  const [element, ctx] = canvas(size);
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';

  const gold = 'rgba(214,190,140,0.9)';
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ring(ctx, c, c * 0.96);
  ctx.lineWidth = 3;
  ring(ctx, c, c * 0.88);
  ring(ctx, c, c * 0.42);

  // Marcas como runas entre los dos anillos exteriores.
  const random = seeded(11);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = c * 0.89;
    const r1 = c * (0.91 + random() * 0.04);
    ctx.lineWidth = 2 + random() * 3;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a + 0.03) * r1, c + Math.sin(a + 0.03) * r1);
    ctx.stroke();
  }

  // Pentágono y estrella: vecinos unidos por el borde, opuestos por las diagonales.
  const points = ELEMENTS.map((_, i) => {
    const a = -Math.PI / 2 + (i / ELEMENTS.length) * Math.PI * 2;
    return { x: c + Math.cos(a) * c * 0.78, y: c + Math.sin(a) * c * 0.78 };
  });
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(214,190,140,0.45)';
  ctx.beginPath();
  for (let i = 0; i <= ELEMENTS.length; i++) {
    const p = points[(i * 2) % ELEMENTS.length];
    if (!p) continue;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  points.forEach((p, i) => {
    const color = ELEMENTS[i]?.color ?? '#ffffff';
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 70);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.35, `${color}aa`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ring(ctx, c, 30, p.x, p.y);
  });

  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Degradado suave para halos y llamas dibujados como sprites. */
export function createGlowTexture(): THREE.Texture {
  const size = 128;
  const [element, ctx] = canvas(size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(element);
}

function ring(ctx: CanvasRenderingContext2D, c: number, r: number, x = c, y = c): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Suelo de la jungla: tierra oscura con manchas de musgo y hojarasca. La textura se repite
 * sin costuras: cada mancha se dibuja también del otro lado del borde.
 */
export function createGroundTexture(): THREE.Texture {
  const size = 512;
  const [element, ctx] = canvas(size);
  const random = seeded(11);
  ctx.fillStyle = '#262520';
  ctx.fillRect(0, 0, size, size);
  const blob = (x: number, y: number, r: number, color: string): void => {
    ctx.fillStyle = color;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  // Musgo verde azulado y tierra húmeda.
  for (let i = 0; i < 120; i++) {
    const moss = random() < 0.55;
    blob(
      random() * size,
      random() * size,
      10 + random() * 46,
      moss ? 'rgba(52, 74, 52, 0.16)' : 'rgba(10, 9, 8, 0.22)',
    );
  }
  // Hojarasca: puntitos cálidos.
  for (let i = 0; i < 900; i++) {
    const warm = random() < 0.5;
    blob(
      random() * size,
      random() * size,
      0.8 + random() * 2.2,
      warm ? 'rgba(110, 82, 52, 0.35)' : 'rgba(70, 90, 60, 0.3)',
    );
  }
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
