import type { SpellId } from '@crisol/core';

/**
 * Combinaciones que la IA prueba: después de lanzar un hechizo, cuáles conviene probar justo
 * después porque juntos rinden más que el segundo solo. No son órdenes: la IA las prueba en su
 * copia del duelo y solo las usa si le resultan. Lo escribe
 * `pnpm --filter @crisol/balance combinaciones --guardar` (hoy: 1500 duelos de autojuego y
 * 0 partidas registradas). No se edita a mano.
 */
export const BOT_COMBOS: Readonly<Partial<Record<SpellId, readonly SpellId[]>>> = {
  ancientTree: ['iceAge', 'blizzard', 'spark'],
  blinding: ['blink'],
  blink: ['veil', 'purify'],
  claw: ['tidalWave', 'spark', 'blizzard'],
  comet: ['eclipse'],
  drain: ['powerGrid', 'tidalWave'],
  fireRain: ['claw', 'iceAge', 'splash'],
  glacier: ['spark', 'fireball', 'eclipse'],
  iceAge: ['ancientTree', 'claw', 'powerGrid'],
  iceWall: ['rootPack'],
  lightningRod: ['spark', 'eclipse', 'claw'],
  meteor: ['mossGuardian', 'blink'],
  mossGuardian: ['spark', 'thousandSteps', 'claw'],
  nightmare: ['fireball'],
  powerGrid: ['claw', 'splash'],
  rootPack: ['fireball'],
  spark: ['garden'],
  thousandSteps: ['spark'],
  tidalWave: ['thornRush'],
  transfusion: ['lightningRod'],
  wisp: ['tidalWave', 'tempest'],
};
