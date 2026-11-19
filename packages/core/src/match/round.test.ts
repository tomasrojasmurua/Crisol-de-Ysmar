import { describe, expect, it } from 'vitest';
import type { Intent } from '../controllers/intent';
import { TICK_RATE } from '../sim/fixedStep';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch, type WizardSetup } from './createMatch';
import { modeSetup, playerCount, spawnTurn } from './modes';
import { roundPhase, zoneDamageAt, zoneRadiusAt } from './round';
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
    const state = match('out', [
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

  it('sin Vidas, caer en un duelo termina la ronda', () => {
    const state = match('out', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 5 } },
    ]);
    knockDown(state, 2);
    run(state, 1);
    expect(state.winnerTeam).toBe(0);
  });

  it('con Vidas, un aliado al lado revive al caído antes de que reaparezca', () => {
    const state = match('lives', [
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

  it('la ronda no se acaba por tiempo: sigue en muerte súbita', () => {
    const state = match('out', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 2 } },
    ]);
    wizard(state, 2).hp = 50;
    state.tick = rules.round.durationTicks - 1;
    run(state, 1);
    expect(state.winnerTeam).toBeNull();
    expect(roundPhase(state.tick, rules)).toBe('sudden');
  });

  it('en muerte súbita la zona se cierra del todo y su daño sube', () => {
    const { durationTicks, finalRadius, suddenDeath, zoneDamagePerSecond } = rules.round;
    expect(zoneRadiusAt(durationTicks, rules)).toBe(finalRadius);
    expect(zoneRadiusAt(durationTicks + suddenDeath.shrinkTicks, rules)).toBe(0);
    expect(zoneDamageAt(durationTicks, rules)).toBe(zoneDamagePerSecond);
    expect(zoneDamageAt(durationTicks + 10 * TICK_RATE, rules)).toBe(
      zoneDamagePerSecond + suddenDeath.damageRampPerSecond * 10,
    );
  });

  it('la muerte súbita termina la ronda aunque nadie pelee', () => {
    const state = match('out', [
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 2 } },
    ]);
    wizard(state, 2).hp = 50;
    state.tick = rules.round.durationTicks;
    for (let i = 0; i < 60 * TICK_RATE && state.winnerTeam === null; i++) run(state, 1);
    expect(state.winnerTeam).toBe(0);
  });
});

describe('modos', () => {
  it('arma equipos y todos contra todos con el jugador en el equipo 0', () => {
    const teams = modeSetup({ kind: 'teams', size: 3 }, 1, 'lives', rules);
    expect(teams.wizards).toHaveLength(6);
    expect(teams.wizards.filter((w) => w.team === 0)).toHaveLength(3);
    const ffa = modeSetup({ kind: 'ffa', players: 5 }, 1, 'out', rules);
    expect(new Set(ffa.wizards.map((w) => w.team)).size).toBe(5);
    expect(ffa.wizards[0]?.team).toBe(0);
    expect(playerCount({ kind: 'ffa', players: 9 })).toBe(6);
  });
});

describe('punto de partida de cada ronda', () => {
  const turning = { ...rules, map: { ...rules.map, spawnTurns: 12 } };
  const angleOf = (p: { x: number; z: number }): number => Math.atan2(p.z, p.x);

  it('dos rondas seguidas nunca repiten giro, ni medio giro, en ninguna partida', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let round = 0; round < 6; round++) {
        const a = spawnTurn(seed * 7919, round, 12);
        const b = spawnTurn(seed * 7919, round + 1, 12);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(12);
        expect((b - a + 12) % 6).not.toBe(0);
      }
    }
  });

  it('cada ronda parte en otro lugar, con los equipos siempre en bordes opuestos', () => {
    const modes = [
      { kind: 'duel' },
      { kind: 'teams', size: 3 },
      { kind: 'ffa', players: 4 },
    ] as const;
    for (const mode of modes) {
      const first = modeSetup(mode, 1, 'out', turning, { matchSeed: 42, index: 0 }).wizards;
      const second = modeSetup(mode, 2, 'out', turning, { matchSeed: 42, index: 1 }).wizards;
      const me = (ws: typeof first) => ws[0]?.spawn ?? { x: 0, z: 0 };
      expect(Math.hypot(me(first).x - me(second).x, me(first).z - me(second).z)).toBeGreaterThan(5);
      for (const ws of [first, second]) {
        // Girar no acerca a nadie: las distancias entre todos quedan iguales que sin girar.
        const still = modeSetup(mode, 1, 'out', rules).wizards;
        ws.forEach((w, i) => {
          ws.forEach((v, j) => {
            const d = Math.hypot(w.spawn.x - v.spawn.x, w.spawn.z - v.spawn.z);
            const s0 = still[i]?.spawn ?? w.spawn;
            const s1 = still[j]?.spawn ?? v.spawn;
            expect(d).toBeCloseTo(Math.hypot(s0.x - s1.x, s0.z - s1.z), 6);
          });
          expect(Math.hypot(w.spawn.x, w.spawn.z)).toBeCloseTo(
            Math.hypot(still[i]?.spawn.x ?? 0, still[i]?.spawn.z ?? 0),
            6,
          );
        });
      }
      if (mode.kind !== 'ffa') {
        const enemy = second.find((w) => w.team === 1)?.spawn ?? { x: 0, z: 0 };
        const gap = Math.abs(angleOf(me(second)) - angleOf(enemy));
        expect(Math.min(gap, Math.PI * 2 - gap)).toBeGreaterThan(Math.PI * 0.85);
      }
    }
  });

  it('sin ronda (entrenamiento, pruebas) o sin giros en el mapa, todo queda como antes', () => {
    const plain = modeSetup({ kind: 'duel' }, 1, 'out', turning).wizards;
    expect(plain[0]?.spawn.z).toBeLessThan(0);
    const fixed = modeSetup({ kind: 'duel' }, 1, 'out', rules, { matchSeed: 9, index: 1 });
    expect(fixed.wizards).toEqual(modeSetup({ kind: 'duel' }, 1, 'out', rules).wizards);
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
