import type { ComboId } from '../rules';
import type { SpellId } from '../spells/catalog';
import type { EntityId, MatchState } from './state';

/**
 * El registro de una ronda: qué lanzó cada mago y en qué paso, y qué pasó después (golpes,
 * ataques atajados, reacciones y caídas). Sirve para buscar combinaciones de hechizos que
 * funcionan (`pnpm --filter @crisol/balance combinaciones`, ver docs/partidas.md). Se arma solo
 * con los avisos de cada paso, sin tocar el estado, y no viaja en la partida: se manda una vez
 * al final. Todo va en arreglos cortos para que pese poco.
 */
export interface MatchLogRound {
  /** Pasos que duró la ronda. */
  ticks: number;
  /** Equipo que ganó la ronda (-1 empate, null si no terminó). */
  winnerTeam: number | null;
  /** [paso, mago, hechizo] cada vez que salió un hechizo. */
  casts: [number, EntityId, SpellId][];
  /** [paso, quien golpea, golpeado, daño] cada golpe a un mago (la zona viene con quien golpea 0). */
  hits: [number, EntityId, EntityId, number][];
  /** [paso, quien ataca, atacado] cada ataque rival que no hizo daño (escudo, Espejo…). */
  blocked: [number, EntityId, EntityId][];
  /** [paso, quien la provoca, a quien, reacción]. */
  combos: [number, EntityId, EntityId, ComboId][];
  /** [paso, mago] cada vez que cae un mago. */
  falls: [number, EntityId][];
}

/** Tope de filas por lista: una ronda eterna no hace un registro gigante. */
export const MATCH_LOG_ROW_LIMIT = 2000;

export function createLogRound(): MatchLogRound {
  return { ticks: 0, winnerTeam: null, casts: [], hits: [], blocked: [], combos: [], falls: [] };
}

/** Suma lo que pasó en el último paso (`state.events`). */
export function recordLogRound(round: MatchLogRound, state: Readonly<MatchState>): void {
  round.ticks = state.tick;
  round.winnerTeam = state.winnerTeam;
  const tick = state.tick;
  for (const event of state.events) {
    switch (event.type) {
      case 'release':
        push(round.casts, [tick, event.wizardId, event.spell]);
        break;
      case 'hit':
        push(round.hits, [
          tick,
          event.form === 'zone' ? 0 : event.sourceId,
          event.targetId,
          Math.round(event.amount * 10) / 10,
        ]);
        break;
      case 'attacked':
        push(round.blocked, [tick, event.sourceId, event.targetId]);
        break;
      case 'combo':
        push(round.combos, [tick, event.sourceId, event.targetId, event.combo]);
        break;
      case 'defeated':
        push(round.falls, [tick, event.wizardId]);
        break;
    }
  }
}

function push<T>(rows: T[], row: T): void {
  if (rows.length < MATCH_LOG_ROW_LIMIT) rows.push(row);
}
