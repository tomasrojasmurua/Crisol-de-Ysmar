import { describe, expect, it } from 'vitest';
import type { Intent } from '../controllers/intent';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch, type WizardSetup } from './createMatch';
import { modeSetup, playerCount } from './modes';
import { roundPhase, zoneRadiusAt } from './round';
import { createSeries, recordRound } from './series';
import type { DeathRule, MatchState, Wizard } from './state';
import { stepMatch } from './step';

const rules = TEST_RULES;

function match(deathRule: DeathRule, wizards: WizardSetup[]): MatchState {
  return createMatch({ seed: 1, deathRule, wizards }, rules);
}

function wizard(state: MatchState, id: number): Wizard {
  const found = state.wizards.find((w) => w.id === id);
  if (!found) throw new Error(`No existe el mago ${id}`);
  return found;
}

function run(state: MatchState, ticks: number, intents: Map<number, Intent[]> = new Map()): void {
  for (let i = 0; i < ticks && state.winnerTeam === null; i++) {
    stepMatch(state, intents, rules);
  }
}

/** Deja al mago al borde de la muerte para que el próximo daño lo tumbe. */
function knockDown(state: MatchState, id: number): void {
  const target = wizard(state, id);
  target.hp = 0.01;
  target.pos = { x: rules.arenaRadius, z: 0 };
  state.zoneRadius = 1;
  state.tick = rules.round.convergenceEndTick;
}

describe('ronda', () => {
  it('pasa por Caza, Convergencia y Duelo final', () => {
    expect(roundPhase(0, rules)).toBe('hunt');
    expect(roundPhase(rules.round.huntEndTick, rules)).toBe('convergence');
    expect(roundPhase(rules.round.convergenceEndTick, rules)).toBe('final');
  });

  it('la zona está abierta en la Caza y se cierra hasta el radio final', () => {
    expect(zoneRadiusAt(0, rules)).toBe(rules.arenaRadius);
    expect(zoneRadiusAt(rules.round.convergenceEndTick, rules)).toBe(rules.round.convergenceRadius);
    expect(zoneRadiusAt(rules.round.durationTicks, rules)).toBe(rules.round.finalRadius);
  });

  it('quedar fuera de la zona hace daño', () => {
    const state = match('spectre', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 15, z: 0 } },
    ]);
    state.tick = rules.round.durationTicks - 10;
    run(state, 1);
    expect(wizard(state, 1).hp).toBe(rules.wizard.maxHp);
    expect(wizard(state, 2).hp).toBeLessThan(rules.wizard.maxHp);
  });

  it('con Vidas, el caído reaparece y gasta una vida', () => {
    const state = match('lives', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 5 } },
    ]);
    knockDown(state, 2);
    run(state, 1);
    expect(wizard(state, 2).fallen?.respawnTicks).toBe(rules.death.respawnTicks);
    expect(state.winnerTeam).toBeNull();
    state.zoneRadius = rules.arenaRadius;
    state.tick = 0;
    run(state, rules.death.respawnTicks);
    expect(wizard(state, 2).hp).toBe(rules.wizard.maxHp);
    expect(wizard(state, 2).lives).toBe(rules.death.lives - 1);
  });

  it('con Espectros, caer en un duelo termina la ronda', () => {
    const state = match('spectre', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 5 } },
    ]);
    knockDown(state, 2);
    run(state, 1);
    expect(state.winnerTeam).toBe(0);
  });

  it('el espectro ralentiza a un enemigo con su Lamento', () => {
    const state = match('spectre', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 0, spawn: { x: 0, z: -3 } },
      { team: 1, spawn: { x: 0, z: 5 } },
    ]);
    knockDown(state, 1);
    run(state, 1);
    wizard(state, 1).pos = { x: 0, z: 2 };
    const fallen = wizard(state, 1).fallen;
    if (fallen) fallen.hauntCooldown = 0;
    run(state, 1, new Map([[1, [{ kind: 'cast', dirX: 0, dirZ: 0 }]]]));
    expect(wizard(state, 3).statuses.slow).toBeDefined();
    expect(state.events).toContainEqual({ type: 'haunt', wizardId: 1, targetId: 3 });
  });

  it('un aliado al lado revive al caído', () => {
    const state = match('spectre', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 0, spawn: { x: 1, z: 0 } },
      { team: 1, spawn: { x: 0, z: 10 } },
    ]);
    knockDown(state, 1);
    run(state, 1);
    wizard(state, 1).pos = { x: 0, z: 0 };
    state.zoneRadius = rules.arenaRadius;
    state.tick = 0;
    run(state, rules.death.revive.ticks);
    expect(wizard(state, 1).fallen).toBeNull();
    expect(wizard(state, 1).hp).toBe(rules.wizard.maxHp * rules.death.revive.hpFraction);
  });

  it('si se acaba el tiempo gana el equipo con más vida', () => {
    const state = match('spectre', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 2 } },
    ]);
    wizard(state, 2).hp = 50;
    state.tick = rules.round.durationTicks - 1;
    run(state, 1);
    expect(state.winnerTeam).toBe(0);
  });
});

describe('modos', () => {
  it('arma equipos y todos contra todos con el jugador en el equipo 0', () => {
    const teams = modeSetup({ kind: 'teams', size: 3 }, 1, 'lives', rules);
    expect(teams.wizards).toHaveLength(6);
    expect(teams.wizards.filter((w) => w.team === 0)).toHaveLength(3);
    const ffa = modeSetup({ kind: 'ffa', players: 5 }, 1, 'spectre', rules);
    expect(new Set(ffa.wizards.map((w) => w.team)).size).toBe(5);
    expect(ffa.wizards[0]?.team).toBe(0);
    expect(playerCount({ kind: 'ffa', players: 9 })).toBe(6);
  });
});

describe('partida al mejor de 3', () => {
  it('gana quien llega primero a dos rondas', () => {
    const series = createSeries(2);
    recordRound(series, 1, rules.round);
    recordRound(series, 0, rules.round);
    expect(series.winnerTeam).toBeNull();
    recordRound(series, 0, rules.round);
    expect(series.winnerTeam).toBe(0);
  });

  it('los empates no suman y hay un tope de rondas', () => {
    const series = createSeries(2);
    for (let i = 0; i < rules.round.maxRounds; i++) recordRound(series, -1, rules.round);
    expect(series.wins).toEqual([0, 0]);
    expect(series.winnerTeam).toBe(-1);
  });
});
