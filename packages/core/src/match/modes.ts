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
 * Arma la ronda de un modo. El primer mago (id 1) siempre es del equipo 0:
 * en el celular es el jugador.
 */
export function modeSetup(
  mode: GameMode,
  seed: number,
  deathRule: DeathRule,
  rules: GameRules,
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
  return { seed, deathRule, wizards };
}
