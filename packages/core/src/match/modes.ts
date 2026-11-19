import type { GameRules } from '../rules';
import type { MatchSetup, WizardSetup } from './createMatch';
import type { DeathRule } from './state';

/** Los modos de la sala. Los puestos sin persona los ocupa la IA. */
export type GameMode =
  | { readonly kind: 'duel' }
  | { readonly kind: 'teams'; readonly size: 2 | 3 }
  | { readonly kind: 'ffa'; readonly players: number };

export const MAX_PLAYERS = 6;

export function playerCount(mode: GameMode): number {
  switch (mode.kind) {
    case 'duel':
      return 2;
    case 'teams':
      return mode.size * 2;
    case 'ffa':
      return Math.min(Math.max(mode.players, 3), MAX_PLAYERS);
  }
}

/** Cuántos equipos hay: en todos contra todos cada mago es su propio equipo. */
export function teamCount(mode: GameMode): number {
  return mode.kind === 'ffa' ? playerCount(mode) : 2;
}

/**
 * Cuánto se gira la ronda `round` (desde 0) de una partida: un múltiplo de la vuelta repartida en
 * `turns`. Parte de un giro sacado de la semilla de la partida y avanza 5 por ronda (5 no divide
 * a 12): dos rondas seguidas nunca repiten lugar ni solo cambian de lado o de asiento, así nadie
 * vuelve a partir frente al mismo campamento.
 */
export function spawnTurn(matchSeed: number, round: number, turns: number): number {
  if (turns <= 1) return 0;
  const base = Math.imul(matchSeed >>> 0, 0x9e3779b1) >>> 0;
  return ((((base % turns) + round * 5) % turns) + turns) % turns;
}

/**
 * Arma la ronda de un modo. El primer mago (id 1) siempre es del equipo 0:
 * en el celular es el jugador. Con `round` (la partida y su número de ronda), la ronda entera
 * se gira alrededor del centro: los equipos siguen en bordes opuestos, pero cada ronda en otros.
 */
export function modeSetup(
  mode: GameMode,
  seed: number,
  deathRule: DeathRule,
  rules: GameRules,
  round?: { readonly matchSeed: number; readonly index: number },
): MatchSetup {
  const r = rules.arenaRadius;
  const wizards: WizardSetup[] = [];
  if (mode.kind === 'ffa') {
    const count = playerCount(mode);
    for (let i = 0; i < count; i++) {
      // Repartidos en un círculo, empezando por el sur.
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      wizards.push({
        team: i,
        spawn: { x: Math.cos(angle) * r * 0.8, z: Math.sin(angle) * r * 0.8 },
      });
    }
  } else {
    const size = mode.kind === 'teams' ? mode.size : 1;
    const spacing = 2.5;
    for (const team of [0, 1]) {
      const z = (team === 0 ? -1 : 1) * r * 0.8;
      for (let i = 0; i < size; i++) {
        const x = (i - (size - 1) / 2) * spacing;
        wizards.push({ team, spawn: { x, z } });
      }
    }
  }
  const turns = rules.map.spawnTurns ?? 1;
  const turn = round ? spawnTurn(round.matchSeed, round.index, turns) : 0;
  if (turn === 0) return { seed, deathRule, wizards };
  const angle = (turn / turns) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    seed,
    deathRule,
    wizards: wizards.map((w) => ({
      ...w,
      spawn: { x: w.spawn.x * cos - w.spawn.z * sin, z: w.spawn.x * sin + w.spawn.z * cos },
    })),
  };
}
