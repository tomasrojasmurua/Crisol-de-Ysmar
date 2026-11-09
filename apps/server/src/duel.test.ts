import { describe, expect, it } from 'vitest';
import { CHOOSE_TICKS, DuelHost, INTERMISSION_TICKS } from './duel';

function host(): DuelHost {
  let n = 0;
  return new DuelHost(7, () => `token-${++n}`);
}

/** Juega pasos hasta que la condición se cumpla (o se acaben los pasos). */
function until(duel: DuelHost, done: () => boolean, max = 30 * 600): void {
  for (let i = 0; i < max && !done(); i++) duel.tick();
}

describe('Sala de duelo 1v1', () => {
  it('espera a dos jugadores y entonces empieza', () => {
    const duel = host();
    expect(duel.join({ name: 'Tomás' })?.playerId).toBe(1);
    expect(duel.inLobby).toBe(true);
    expect(duel.state).toBeNull();
    expect(duel.join({ name: 'Amigo' })?.playerId).toBe(2);
    expect(duel.inLobby).toBe(false);
    expect(duel.state?.wizards).toHaveLength(2);
    expect(duel.players.map((p) => p.team)).toEqual([0, 1]);
  });

  it('no deja entrar a un tercero', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    expect(duel.join({ name: 'C' })).toBeNull();
  });

  it('las intenciones de cada jugador mueven a su mago', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    const start = duel.state?.wizards[0]?.pos;
    for (let i = 0; i < 10; i++) {
      duel.intents(1, [{ kind: 'move', x: 1, z: 0 }]);
      duel.tick();
    }
    expect(duel.state?.wizards[0]?.pos.x).toBeGreaterThan((start?.x ?? 0) + 1);
  });

  it('ignora intenciones mal formadas', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    const bad = [
      { kind: 'move', x: 50, z: 0 },
      { kind: 'teleport' },
      { kind: 'weave', element: 'fuego' },
    ];
    duel.intents(1, bad as never);
    const before = duel.state?.wizards[0]?.pos;
    duel.tick();
    expect(duel.state?.wizards[0]?.pos).toEqual(before);
  });

  it('si alguien se va, la IA juega por él y puede volver con su token', () => {
    const duel = host();
    duel.join({ name: 'A' });
    const second = duel.join({ name: 'B' });
    duel.leave(2);
    expect(duel.connectedCount).toBe(1);
    expect(duel.players[1]?.connected).toBe(false);
    until(duel, () => (duel.state?.tick ?? 0) > 60, 61);
    const back = duel.join({ name: 'B', token: second?.token });
    expect(back?.playerId).toBe(2);
    expect(duel.connectedCount).toBe(2);
  });

  it('en la sala de espera, quien se va libera su lugar', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.leave(1);
    expect(duel.players).toHaveLength(0);
  });

  it('juega una partida entera con Glifos entre rondas y revancha', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    // Los dos se desconectan: la IA juega todo y elige los Glifos.
    duel.leave(1);
    duel.leave(2);
    until(duel, () => duel.stageFor(1).kind === 'intermission');
    expect(duel.seriesInfo().roundsPlayed).toBe(1);
    until(duel, () => duel.stageFor(1).kind !== 'intermission', INTERMISSION_TICKS + 1);
    until(duel, () => duel.stageFor(1).kind === 'playing', CHOOSE_TICKS + 1);
    expect(duel.seriesInfo().glyphs[1]).toHaveLength(1);
    until(duel, () => duel.stageFor(1).kind === 'finished', 30 * 60 * 30);
    expect(duel.seriesInfo().seriesWinner).not.toBeNull();
    duel.join({ name: 'A', token: 'token-1' });
    duel.rematch(1);
    expect(duel.stageFor(1).kind).toBe('playing');
    expect(duel.seriesInfo().roundsPlayed).toBe(0);
  });

  it('cada jugador ve solo sus opciones de Glifo y elige una', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    // Se fuerza el fin de la primera ronda.
    const loser = duel.state?.wizards[1];
    if (loser) loser.hp = 0;
    until(duel, () => duel.stageFor(1).kind === 'choosing', INTERMISSION_TICKS + 30);
    const stage = duel.stageFor(1);
    if (stage.kind !== 'choosing') throw new Error('sin elección');
    expect(stage.options.length).toBeGreaterThanOrEqual(3);
    duel.chooseGlyph(1, stage.options[0] ?? '');
    expect(duel.stageFor(1)).toMatchObject({ kind: 'choosing', chosen: true });
    const other = duel.stageFor(2);
    if (other.kind !== 'choosing') throw new Error('sin elección');
    duel.chooseGlyph(2, other.options[0] ?? '');
    expect(duel.stageFor(1).kind).toBe('playing');
    expect(duel.seriesInfo().roundsPlayed).toBe(1);
  });
});
