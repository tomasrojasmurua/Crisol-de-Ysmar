import type { RoundRules } from '../rules';

/** Una partida al mejor de N rondas. Las rondas empatadas no suman para nadie. */
export interface SeriesState {
  /** Rondas ganadas por cada equipo. */
  readonly wins: number[];
  roundsPlayed: number;
  /** Equipo que ganó la partida, -1 si terminó empatada, null si sigue. */
  winnerTeam: number | null;
}

export function createSeries(teamCount: number): SeriesState {
  return { wins: new Array<number>(teamCount).fill(0), roundsPlayed: 0, winnerTeam: null };
}

/** Anota el resultado de una ronda (-1 es empate) y decide si la partida terminó. */
export function recordRound(series: SeriesState, roundWinner: number, rules: RoundRules): void {
  if (series.winnerTeam !== null) {
    return;
  }
  series.roundsPlayed++;
  if (roundWinner >= 0 && roundWinner < series.wins.length) {
    series.wins[roundWinner] = (series.wins[roundWinner] ?? 0) + 1;
    if ((series.wins[roundWinner] ?? 0) >= rules.roundsToWin) {
      series.winnerTeam = roundWinner;
      return;
    }
  }
  if (series.roundsPlayed >= rules.maxRounds) {
    series.winnerTeam = leader(series.wins);
  }
}

/** El equipo con más rondas, o -1 si hay empate arriba. */
function leader(wins: readonly number[]): number {
  const best = Math.max(...wins);
  const leaders = wins.flatMap((w, team) => (w === best ? [team] : []));
  return leaders.length === 1 ? (leaders[0] ?? -1) : -1;
}
