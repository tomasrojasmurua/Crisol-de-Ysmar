import { applyStatus } from '../combat/hit';
import { distance } from '../math/vec2';
import type { GameRules } from '../rules';
import { placeInArena } from './obstacles';
import { isAlive } from './queries';
import { withRng } from './random';
import type { MatchState } from './state';

/** Al empezar la Convergencia aparecen los santuarios, dentro de la zona que va a quedar. */
export function spawnShrines(state: MatchState, rules: GameRules): void {
  withRng(state, (rng) => {
    const count = rules.shrines.count;
    const offset = rng.next() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      const r = rules.round.convergenceRadius * (0.45 + rng.next() * 0.2);
      state.shrines.push({
        id: state.nextEntityId++,
        pos: placeInArena(
          { x: Math.cos(angle) * r, z: Math.sin(angle) * r },
          rules.shrines.radius * 0.5,
          rules,
        ),
        team: null,
        progress: 0,
      });
    }
  });
  state.events.push({ type: 'shrinesAppear' });
}

/**
 * Un santuario avanza si hay magos de un solo equipo encima; disputado se detiene y vacío se enfría.
 * Al tomarlo, cada mago del equipo que está encima recupera vida y queda potenciado.
 */
export function updateShrines(state: MatchState, rules: GameRules): void {
  const { radius, captureTicks, healFraction } = rules.shrines;
  state.shrines = state.shrines.filter((shrine) => {
    const present = state.wizards.filter(
      (w) => isAlive(w) && distance(w.pos, shrine.pos) <= radius,
    );
    const teams = new Set(present.map((w) => w.team));
    if (teams.size !== 1) {
      if (teams.size === 0) shrine.progress = Math.max(0, shrine.progress - 1);
      return true;
    }
    const [team = 0] = teams;
    if (shrine.team !== team) {
      shrine.team = team;
      shrine.progress = 0;
    }
    if (++shrine.progress < captureTicks) return true;

    for (const wizard of present) {
      wizard.hp = Math.min(wizard.maxHp, wizard.hp + wizard.maxHp * healFraction);
      applyStatus(state, wizard, 'empowered', wizard.id, rules);
    }
    state.events.push({ type: 'shrineClaimed', shrineId: shrine.id, team });
    return false;
  });
}
