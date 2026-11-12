import { describe, expect, it } from 'vitest';
import { BotController } from '../ai/bot';
import type { Intent } from '../controllers/intent';
import { affinityPatch, combineMods } from '../mods';
import type { GameRules } from '../rules';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch, type WizardSetup } from './createMatch';
import { modeSetup } from './modes';
import type { MatchState, Wizard } from './state';
import { stepMatch } from './step';

const rules = TEST_RULES;

function match(wizards: WizardSetup[], withRules: GameRules = rules): MatchState {
  return createMatch({ seed: 3, deathRule: 'out', wizards }, withRules);
}

function wizard(state: MatchState, id: number): Wizard {
  const found = state.wizards.find((w) => w.id === id);
  if (!found) throw new Error(`No existe el mago ${id}`);
  return found;
}

function run(state: MatchState, ticks: number, first: Intent[] = []): void {
  for (let i = 0; i < ticks; i++) {
    stepMatch(state, new Map([[1, i === 0 ? first : []]]), rules);
  }
}

const brasaForward: Intent[] = [
  { kind: 'weave', element: 'brasa' },
  { kind: 'cast', dirX: 0, dirZ: 1 },
];

/** Una bestia de Brasa justo delante del mago 1, y el rival lejos. */
function huntingScene(): MatchState {
  const state = match([
    { team: 0, spawn: { x: 0, z: 0 } },
    { team: 1, spawn: { x: 12, z: 0 } },
  ]);
  state.beasts.push({
    id: 99,
    element: 'brasa',
    camp: null,
    guardian: false,
    maxHp: TEST_RULES.beasts.maxHp,
    home: { x: 0, z: 4 },
    pos: { x: 0, z: 4 },
    facing: { x: 0, z: 1 },
    hp: rules.beasts.maxHp,
    targetId: null,
    aggroTicks: 0,
    attackCooldown: 0,
    velocity: { x: 0, z: 0 },
    tamedBy: null,
    tamedTicks: 0,
  });
  return state;
}

describe('bestias', () => {
  it('un conjuro daña a la bestia y la enoja con quien la atacó', () => {
    const state = huntingScene();
    run(state, 12, brasaForward);
    const beast = state.beasts[0];
    expect(beast?.hp).toBe(rules.beasts.maxHp - rules.spells.spark.damage);
    expect(beast?.targetId).toBe(1);
  });

  it('cazarla da Esencia, y la Esencia sube el daño de ese elemento', () => {
    const state = huntingScene();
    const beast = state.beasts[0];
    if (beast) beast.hp = 1;
    run(state, 12, brasaForward);
    expect(state.beasts).toHaveLength(0);
    expect(wizard(state, 1).essence.brasa).toBe(1);

    // Ahora la Chispa contra el rival pega 50% más (TEST_RULES), sin contar la quemadura.
    const rival = wizard(state, 2);
    rival.pos = { x: 0, z: 5 };
    const fatigue = wizard(state, 1).fatigue;
    fatigue.brasa = 0;
    run(state, 12, brasaForward);
    const lost = rival.maxHp - rival.hp;
    expect(lost).toBeGreaterThanOrEqual(rules.spells.spark.damage * 1.5);
    expect(lost).toBeLessThan(rules.spells.spark.damage * 1.5 + 2);
  });

  it('una bestia enojada muerde', () => {
    const state = huntingScene();
    const beast = state.beasts[0];
    if (beast) {
      beast.targetId = 1;
      beast.aggroTicks = 100;
      beast.pos = { x: 0, z: 1 };
    }
    run(state, 2);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp - rules.beasts.damage);
  });
});

describe('santuarios', () => {
  it('aparecen al empezar la Convergencia y se toman sin rivales encima', () => {
    const state = match([
      { team: 0, spawn: { x: 0, z: 0 } },
      { team: 1, spawn: { x: 0, z: 15 } },
    ]);
    state.tick = rules.round.huntEndTick - 1;
    run(state, 1);
    expect(state.shrines).toHaveLength(rules.shrines.count);
    expect(state.events).toContainEqual({ type: 'shrinesAppear' });

    const shrine = state.shrines[0];
    const player = wizard(state, 1);
    if (shrine) player.pos = shrine.pos;
    player.hp = 10;
    run(state, rules.shrines.captureTicks);
    expect(state.shrines).toHaveLength(rules.shrines.count - 1);
    expect(player.hp).toBeGreaterThan(10);
    expect(player.statuses.empowered).toBeDefined();
  });
});

describe('Glifos y Presagios', () => {
  it('combinan multiplicadores y suman robo de vida', () => {
    const mods = combineMods({ castTime: 0.5, lifesteal: 0.1 }, { castTime: 0.5, lifesteal: 0.2 });
    expect(mods.castTime).toBe(0.25);
    expect(mods.lifesteal).toBeCloseTo(0.3);
  });

  it('cambian la vida máxima, el tiempo de tejido y curan al golpear', () => {
    const mods = combineMods({ maxHp: 1.5, castTime: 0.5, lifesteal: 1 });
    const state = match([
      { team: 0, spawn: { x: 0, z: 0 }, mods },
      { team: 1, spawn: { x: 0, z: 4 } },
    ]);
    const player = wizard(state, 1);
    expect(player.maxHp).toBe(rules.wizard.maxHp * 1.5);
    player.hp = 50;
    run(state, 1, [
      { kind: 'weave', element: 'brasa' },
      { kind: 'weave', element: 'brasa' },
      { kind: 'cast', dirX: 0, dirZ: 1 },
    ]);
    expect(player.channel?.ticksLeft).toBe(Math.round(rules.weave.castTicksByLength[1] * 0.5) - 1);
    run(state, 20);
    expect(player.hp).toBeGreaterThan(50);
  });
});

describe('Afinidad', () => {
  it('el hilo propio descansa antes y los opuestos después', () => {
    const mods = combineMods(affinityPatch('brasa', 0.75, 1.15));
    expect(mods.fatigue.brasa).toBe(0.75);
    expect(mods.fatigue.marea).toBe(1.15);
    expect(mods.fatigue.raiz).toBe(1.15);
    expect(mods.fatigue.tormenta).toBe(1);

    const state = match([
      { team: 0, spawn: { x: 0, z: 0 }, mods, affinity: 'brasa' },
      { team: 1, spawn: { x: 12, z: 0 } },
    ]);
    expect(wizard(state, 1).affinity).toBe('brasa');
    expect(wizard(state, 2).affinity).toBeNull();
    run(state, 12, brasaForward);
    const expected = Math.round(rules.weave.fatigueTicks * 0.75) - 12 + 1;
    expect(wizard(state, 1).fatigue.brasa).toBeLessThanOrEqual(expected);
    expect(wizard(state, 1).fatigue.brasa).toBeGreaterThan(0);
  });
});

describe('bots con bestias', () => {
  it('cazan durante la Caza y la ronda termina igual', () => {
    const withBeasts: GameRules = { ...rules, beasts: { ...rules.beasts, count: 5 } };
    const state = createMatch(
      modeSetup({ kind: 'ffa', players: 4 }, 4, 'lives', withBeasts),
      withBeasts,
    );
    const bots = new Map(state.wizards.map((w) => [w.id, new BotController(w.id * 7, withBeasts)]));
    let slain = 0;
    while (state.winnerTeam === null) {
      const intents = new Map(
        state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
      );
      stepMatch(state, intents, withBeasts);
      slain += state.events.filter((e) => e.type === 'beastSlain').length;
    }
    expect(slain).toBeGreaterThan(0);
  });
});
