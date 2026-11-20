import * as THREE from 'three';

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de efectos');
  return [element, context];
}

/**
 * La onda de choque en el suelo: un borde encendido que se difumina hacia adentro, en vez de
 * una línea fina. Se usa con un anillo que va del 55 % al 100 % del radio.
 */
export function createShockwaveTexture(): THREE.Texture {
  const size = 128;
  const [element, ctx] = canvas(size, size);
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(0.95, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(element);
}

/**
 * Columna de energía (géiser, revivir): fuerte abajo, se pierde arriba, con hebras verticales
 * que suben. Se repite alrededor del cilindro sin costura.
 */
export function createColumnTexture(): THREE.Texture {
  const width = 128;
  const height = 128;
  const [element, ctx] = canvas(width, height);
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 40; i++) {
    const x = random() * width;
    const w = 1 + random() * 5;
    const alpha = 0.25 + random() * 0.6;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(255,255,255,0)`);
    gradient.addColorStop(0.3 + random() * 0.4, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = gradient;
    for (const ox of [-width, 0, width]) ctx.fillRect(x + ox, 0, w, height);
  }
  // Un velo parejo para que la columna no se vea a rayas sueltas.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/** Cómo se apaga la columna hacia arriba: un degradado que multiplica a las hebras. */
export function createColumnFadeTexture(): THREE.Texture {
  const [element, ctx] = canvas(4, 64);
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(element);
}

/**
 * La marca que deja una explosión en el suelo: una mancha oscura de bordes irregulares, con
 * vetas que salen del centro. Se dibuja oscureciendo la piedra (no suma luz).
 */
export function createScorchTexture(): THREE.Texture {
  const size = 128;
  const [element, ctx] = canvas(size, size);
  const c = size / 2;
  let seed = 3;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 14; i++) {
    const angle = random() * Math.PI * 2;
    const d = random() * c * 0.35;
    const r = c * (0.3 + random() * 0.35);
    const x = c + Math.cos(angle) * d;
    const y = c + Math.sin(angle) * d;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(0,0,0,0.35)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const angle = random() * Math.PI * 2;
    const length = c * (0.55 + random() * 0.35);
    ctx.lineWidth = 1 + random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(angle) * length, c + Math.sin(angle) * length);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(element);
}
