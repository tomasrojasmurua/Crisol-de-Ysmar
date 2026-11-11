import { describe, expect, it } from 'vitest';
import {
  CHOOSE_TICKS,
  DuelHost,
  INTERMISSION_TICKS,
  LOBBY_GRACE_TICKS,
  SILENT_TICKS,
} from './duel';

function host(): DuelHost {
  let n = 0;
  return new DuelHost(7, () => `token-${++n}`);
}

/** Juega pasos hasta que la condición se cumpla (o se acaben los pasos). */
function until(duel: DuelHost, done: () => boolean, max = 30 * 600): void {
  for (let i = 0; i < max && !done(); i++) duel.tick();
}

describe('Sala de duelo 1v1', () => {
  it('espera a que quien creó la sala empiece', () => {
    const duel = host();
    expect(duel.join({ name: 'Tomás' })?.playerId).toBe(1);
    expect(duel.inLobby).toBe(true);
    expect(duel.state).toBeNull();
    expect(duel.join({ name: 'Amigo' })?.playerId).toBe(2);
    expect(duel.inLobby).toBe(true);
    expect(duel.begin(2)).toBe(false);
    expect(duel.begin(1)).toBe(true);
    expect(duel.inLobby).toBe(false);
    expect(duel.state?.wizards).toHaveLength(2);
    expect(duel.players.map((p) => p.team)).toEqual([0, 1]);
  });

  it('si llega un tercero, la sala crece de 1 vs 1 a 2 vs 2, y así hasta 6', () => {
    const duel = host();
    for (const name of ['A', 'B', 'C']) expect(duel.join({ name })).not.toBeNull();
    expect(duel.gameMode).toEqual({ kind: 'teams', size: 2 });
    expect(duel.takeMoved().size).toBeGreaterThan(0);
    for (const name of ['D', 'E', 'F']) expect(duel.join({ name })).not.toBeNull();
    expect(duel.gameMode).toEqual({ kind: 'teams', size: 3 });
    expect(duel.join({ name: 'G' })).toBeNull();
    expect(duel.joinError).toBe('La sala está llena');
  });

  it('las intenciones de cada jugador mueven a su mago', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    duel.begin(1);
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
    duel.begin(1);
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
    duel.begin(1);
    duel.leave(2);
    expect(duel.connectedCount).toBe(1);
    expect(duel.players[1]?.connected).toBe(false);
    until(duel, () => (duel.state?.tick ?? 0) > 60, 61);
    const back = duel.join({ name: 'B', token: second?.token });
    expect(back?.playerId).toBe(2);
    expect(duel.connectedCount).toBe(2);
  });

  it('en la sala de espera, quien se corta guarda su lugar un minuto y luego lo libera', () => {
    const duel = host();
    const first = duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    duel.leave(1);
    expect(duel.players).toHaveLength(2);
    expect(duel.hostId).toBe(2);
    // Vuelve con su pase al mismo lugar (sin mandar: ahora manda B).
    expect(duel.join({ name: 'A', token: first?.token })?.playerId).toBe(1);
    duel.leave(1);
    until(duel, () => false, LOBBY_GRACE_TICKS + 1);
    expect(duel.players.map((p) => p.name)).toEqual(['B']);
  });

  it('sin su pase (otro navegador), vuelve a su mago por el nombre', () => {
    const duel = host();
    duel.join({ name: 'Tomás' });
    duel.join({ name: 'Amigo' });
    duel.begin(1);
    duel.leave(2);
    expect(duel.join({ name: 'Otro' })).toBeNull();
    const back = duel.join({ name: 'Amigo' });
    expect(back?.playerId).toBe(2);
    expect(duel.players.find((p) => p.id === 2)?.connected).toBe(true);
  });

  it('juega una partida entera con Glifos entre rondas y revancha', () => {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    duel.begin(1);
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
    duel.begin(1);
    // Se fuerza el fin de la primera ronda.
    const loser = duel.state?.wizards[1];
    if (loser) loser.hp = 0;
    until(duel, () => duel.stageFor(1).kind === 'choosing', INTERMISSION_TICKS + 30);
    const stage = duel.stageFor(1);
    if (stage.kind !== 'choosing') throw new Error('sin elección');
    expect(stage.options.length).toBeGreaterThanOrEqual(3);
    // El celular recibe el tiempo que queda para mostrar la cuenta antes del Glifo al azar.
    expect(stage.ticksLeft).toBeGreaterThan(0);
    expect(stage.ticksLeft).toBeLessThanOrEqual(CHOOSE_TICKS);
    duel.chooseGlyph(1, stage.options[0] ?? '');
    expect(duel.stageFor(1)).toMatchObject({ kind: 'choosing', chosen: true });
    const other = duel.stageFor(2);
    if (other.kind !== 'choosing') throw new Error('sin elección');
    duel.chooseGlyph(2, other.options[0] ?? '');
    expect(duel.stageFor(1).kind).toBe('playing');
    expect(duel.seriesInfo().roundsPlayed).toBe(1);
  });
});

describe('Sala de duelo: celular de fondo y sin señal', () => {
  function playing(): DuelHost {
    const duel = host();
    duel.join({ name: 'A' });
    duel.join({ name: 'B' });
    duel.begin(1);
    return duel;
  }

  it('si sales de la app, la IA juega por ti y no te llega el estado', () => {
    const duel = playing();
    expect(duel.setAway(1, true)).toBe(true);
    expect(duel.setAway(1, true)).toBe(false);
    expect(duel.wantsState(1)).toBe(false);
    expect(duel.wantsState(2)).toBe(true);
    expect(duel.players[0]?.away).toBe(true);
    // Lo que llegue mientras tanto no mueve al mago: lo controla la IA.
    const start = duel.state?.wizards[0]?.pos.x ?? 0;
    for (let i = 0; i < 30; i++) {
      duel.intents(1, [{ kind: 'move', x: 1, z: 0 }]);
      duel.tick();
    }
    expect(duel.state?.wizards[0]?.pos.x ?? 0).toBeLessThan(start + 3);
    duel.setAway(1, false);
    expect(duel.players[0]?.away).toBe(false);
    expect(duel.wantsState(1)).toBe(true);
  });

  it('si te quedas callado más de 2 s jugando, la IA te cubre hasta que vuelvas a hablar', () => {
    const duel = playing();
    duel.intents(1, [{ kind: 'move', x: 1, z: 0 }]);
    for (let i = 0; i < SILENT_TICKS + 2; i++) {
      duel.intents(2, []);
      duel.tick();
    }
    expect(duel.players[0]?.away).toBe(true);
    expect(duel.players[1]?.away).toBe(false);
    expect(duel.awayKey).toBe('10');
    duel.intents(1, []);
    expect(duel.players[0]?.away).toBe(false);
  });

  it('al volver con el pase, vuelve presente', () => {
    const duel = playing();
    duel.setAway(1, true);
    duel.leave(1);
    const again = duel.join({ name: 'A', token: 'token-1' });
    expect(again?.playerId).toBe(1);
    expect(duel.players[0]).toMatchObject({ connected: true, away: false });
  });
});

describe('Salas de más de dos y ajustes', () => {
  function room(): DuelHost {
    const duel = host();
    duel.join({ name: 'Ana' });
    return duel;
  }
  const teams2 = { mode: { kind: 'teams', size: 2 } };

  it('solo quien creó la sala cambia los ajustes, y a la vista de todos', () => {
    const duel = room();
    duel.join({ name: 'Beto' });
    expect(duel.configure(2, teams2)).toBeNull();
    expect(duel.configure(1, { ...teams2, minutes: 5, bestOf: 1, glyphs: false })).not.toBeNull();
    expect(duel.settings).toMatchObject({ minutes: 5, bestOf: 1, glyphs: false, omen: true });
    expect(duel.gameMode).toEqual({ kind: 'teams', size: 2 });
    expect(duel.rules.round.durationTicks).toBe(5 * 60 * 30);
    expect(duel.rules.round.roundsToWin).toBe(1);
  });

  it('al cambiar el modo reparte los puestos de nuevo y avisa quién cambió', () => {
    const duel = room();
    duel.join({ name: 'Beto' });
    expect(duel.players.map((p) => p.id)).toEqual([1, 2]);
    // No se puede pasar a duelo con tres personas... pero sí a 2 contra 2.
    duel.configure(1, { mode: { kind: 'ffa', players: 4 } });
    duel.join({ name: 'Caro' });
    expect(duel.configure(1, { mode: { kind: 'duel' } })).toBeNull();
    const moved = duel.configure(1, teams2);
    expect(moved).toEqual(
      new Map([
        [2, 3],
        [3, 2],
      ]),
    );
    expect(duel.players.map((p) => [p.name, p.team])).toEqual([
      ['Ana', 0],
      ['Caro', 0],
      ['Beto', 1],
    ]);
  });

  it('en equipos reparte a los amigos entre los dos bandos', () => {
    const duel = room();
    duel.configure(1, teams2);
    duel.join({ name: 'Beto' });
    duel.join({ name: 'Caro' });
    duel.join({ name: 'Dani' });
    expect(duel.players.map((p) => p.team)).toEqual([0, 0, 1, 1]);
    // Un quinto: la sala crece a 3 contra 3.
    expect(duel.join({ name: 'Eli' })).not.toBeNull();
    expect(duel.gameMode).toEqual({ kind: 'teams', size: 3 });
  });

  it('al empezar, la IA ocupa los puestos libres', () => {
    const duel = room();
    duel.configure(1, { mode: { kind: 'ffa', players: 4 } });
    duel.join({ name: 'Beto' });
    expect(duel.begin(1)).toBe(true);
    expect(duel.players).toHaveLength(4);
    expect(duel.players.filter((p) => p.bot)).toHaveLength(2);
    expect(new Set(duel.players.map((p) => p.team)).size).toBe(4);
    expect(duel.seriesInfo().wins).toHaveLength(4);
    for (let i = 0; i < 30; i++) duel.tick();
    expect(duel.state?.tick).toBeGreaterThan(20);
  });

  it('con la partida empezada no entra nadie ni cambian los ajustes', () => {
    const duel = room();
    duel.begin(1);
    expect(duel.join({ name: 'Tarde' })).toBeNull();
    expect(duel.joinError).toBe('La partida ya empezó');
    expect(duel.configure(1, teams2)).toBeNull();
  });

  it('si se va quien creó la sala antes de empezar, manda el siguiente', () => {
    const duel = room();
    duel.configure(1, { mode: { kind: 'teams', size: 3 } });
    duel.join({ name: 'Beto' });
    duel.leave(1);
    expect(duel.hostId).toBe(4);
    expect(duel.begin(4)).toBe(true);
  });

  it('sin Presagio ni Glifos, a 1 ronda corta: se juega hasta el final', () => {
    const duel = room();
    duel.configure(1, { ...teams2, minutes: 2, bestOf: 1, glyphs: false, omen: false });
    duel.begin(1);
    duel.leave(1);
    expect(duel.omenId).toBe('ninguno');
    for (let i = 0; i < 30 * 60 * 10 && duel.stageFor(1).kind !== 'finished'; i++) duel.tick();
    expect(duel.stageFor(1).kind).toBe('finished');
    expect(duel.seriesInfo().roundsPlayed).toBeGreaterThanOrEqual(1);
  });

  it('a mejor de 3 sin Glifos, entre rondas no se elige nada', () => {
    const duel = room();
    duel.configure(1, { minutes: 2, glyphs: false });
    duel.begin(1);
    duel.leave(1);
    const kinds = new Set<string>();
    for (let i = 0; i < 30 * 60 * 20 && duel.stageFor(1).kind !== 'finished'; i++) {
      duel.tick();
      kinds.add(duel.stageFor(1).kind);
    }
    expect(kinds.has('choosing')).toBe(false);
    expect(kinds.has('intermission')).toBe(true);
  });
});
