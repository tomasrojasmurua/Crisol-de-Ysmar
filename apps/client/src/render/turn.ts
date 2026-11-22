/**
 * Hacia dónde mira algo que se dibuja (un mago, una bestia), girando suave hacia donde dice el
 * estado. El estado cambia 30 veces por segundo y antes el cuerpo giraba de golpe en cada paso:
 * al doblar o al apuntar se veía a saltos, sobre todo a 60 o 120 cuadros por segundo.
 */
const TURN_RATE = 28;

/** Un ángulo entre -π y π. */
function wrap(angle: number): number {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
}

/**
 * El giro de este cuadro: se acerca a `target` por el lado más corto, la mitad en ~25 ms. Sin
 * ángulo anterior (`current` NaN) o en pausa (`deltaSeconds` 0) queda donde corresponda.
 */
export function turnToward(current: number, target: number, deltaSeconds: number): number {
  if (Number.isNaN(current)) return target;
  if (deltaSeconds <= 0) return current;
  const t = 1 - Math.exp(-TURN_RATE * deltaSeconds);
  return wrap(current + wrap(target - current) * t);
}
