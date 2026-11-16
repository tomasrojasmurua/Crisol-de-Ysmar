import {
  type BotLevel,
  type ElementId,
  type GameMode,
  neighborsOf,
  opposingOf,
} from '@crisol/core';
import { OMENS } from './glyphs';
import { masterOf } from './masters';
import { schoolOf } from './schools';

/**
 * El Camino de tu Linaje: diez duelos contra la IA, uno detrás de otro, cada uno con una regla
 * distinta, y el último contra tu maestro. No hay historia ni reloj: es para volver un rato y
 * avanzar un paso. Se juega con lo que ya existe (modos, dificultades, sets de los Linajes y
 * Presagios); por eso cada paso es solo una combinación de esas piezas.
 *
 * Los premios (hechizos del Grimorio o piezas del Vestidor) quedan para después: cada paso tiene
 * un `id` fijo, y el lugar donde se marca un paso superado es donde se enchufarán.
 */

/** Lo que hay que lograr, además de ganar la serie. */
export type PathGoal =
  /** Ganar la serie. */
  | { readonly kind: 'win' }
  /** Ganar sin perder ninguna ronda. */
  | { readonly kind: 'sweep' }
  /** Ganar tejiendo solo los hechizos de tu Linaje (y Paso, que lo aprenden todos). */
  | { readonly kind: 'ownSpells' }
  /** Ganar usando al menos tantos hechizos distintos. */
  | { readonly kind: 'variety'; readonly spells: number };

/** Contra qué Linaje es un paso, visto desde el tuyo: uno de tus dos rivales del pentágono. */
type RivalSlot = 'first' | 'second';

/** Un paso tal como se escribe, igual para los cinco Linajes. */
interface StepPlan {
  readonly title: string;
  readonly mode: GameMode;
  readonly botLevel: BotLevel;
  /** Los magos rivales solo tejen el set de ese Linaje rival, con su Afinidad. */
  readonly rival?: RivalSlot;
  /** El Presagio del Linaje rival (si no, sin Presagio). */
  readonly rivalOmen?: RivalSlot;
  /** Solo puedes tejer tu elemento y sus dos aliados (los botones rivales no aparecen). */
  readonly alliesOnly?: boolean;
  readonly goal: PathGoal;
  /** El rival es tu maestro, con su cara y su nombre. */
  readonly master?: boolean;
}

const DUEL: GameMode = { kind: 'duel' };

/** Los diez pasos, de menos a más. Los números (dificultad, hechizos distintos) se afinan aquí. */
const PLANS: readonly StepPlan[] = [
  { title: 'Primer duelo', mode: DUEL, botLevel: 'apprentice', goal: { kind: 'win' } },
  { title: 'Lo que te enseñé', mode: DUEL, botLevel: 'apprentice', goal: { kind: 'ownSpells' } },
  {
    title: 'Sin tus rivales',
    mode: DUEL,
    botLevel: 'apprentice',
    alliesOnly: true,
    goal: { kind: 'win' },
  },
  { title: 'El otro lado', mode: DUEL, botLevel: 'duelist', rival: 'first', goal: { kind: 'win' } },
  {
    title: 'Codo a codo',
    mode: { kind: 'teams', size: 2 },
    botLevel: 'duelist',
    goal: { kind: 'win' },
  },
  {
    title: 'Mal presagio',
    mode: DUEL,
    botLevel: 'duelist',
    rival: 'second',
    rivalOmen: 'second',
    goal: { kind: 'win' },
  },
  {
    title: 'Mil hilos',
    mode: DUEL,
    botLevel: 'duelist',
    goal: { kind: 'variety', spells: 6 },
  },
  {
    title: 'Todos contra ti',
    mode: { kind: 'ffa', players: 4 },
    botLevel: 'duelist',
    goal: { kind: 'win' },
  },
  { title: 'Sin un rasguño', mode: DUEL, botLevel: 'duelist', goal: { kind: 'sweep' } },
  { title: 'Tu maestro', mode: DUEL, botLevel: 'master', master: true, goal: { kind: 'win' } },
];

/** Un paso del Camino ya armado para un Linaje. */
export interface PathStep {
  /** Fijo para siempre (`paso-1`…): el progreso guardado y los premios futuros cuelgan de él. */
  readonly id: string;
  /** Tu Linaje: el de quien recorre el Camino (y el de tu maestro). */
  readonly school: ElementId;
  /** Desde 1. */
  readonly number: number;
  readonly title: string;
  readonly mode: GameMode;
  readonly botLevel: BotLevel;
  /** Los rivales solo tejen el set de este Linaje y tienen su Afinidad; null: juegan libres. */
  readonly rivalSchool: ElementId | null;
  /** El Presagio fijo del paso, o null: sin Presagio. */
  readonly omenId: string | null;
  /** Los elementos que puedes tejer; null: todos. */
  readonly elements: readonly ElementId[] | null;
  readonly goal: PathGoal;
  /** El rival es tu maestro. */
  readonly master: boolean;
  /** Lo que dice tu maestro al presentar el paso. */
  readonly line: string;
  /** La clave de su voz (`voice.marea.camp.2`), por si existe el archivo. */
  readonly voice: string;
}

/** Cuántos pasos tiene el Camino. */
export const PATH_LENGTH = PLANS.length;

/** El Camino de un Linaje: los diez pasos con sus rivales, Presagios y frases del maestro. */
export function linajePath(school: ElementId): readonly PathStep[] {
  const master = masterOf(school);
  const rivals = opposingOf(school);
  const rivalOf = (slot: RivalSlot | undefined): ElementId | null =>
    slot === undefined ? null : slot === 'first' ? rivals[0] : rivals[1];
  return PLANS.map((plan, index): PathStep => {
    const number = index + 1;
    const omenElement = rivalOf(plan.rivalOmen);
    // El maestro presenta cada paso con una de sus frases de campamento; el primero, con su
    // bienvenida, y el último, con su desafío.
    const camp = (index - 1) % master.lines.camp.length;
    const line =
      index === 0
        ? master.lines.welcome
        : plan.master
          ? master.lines.challenge
          : (master.lines.camp[camp] ?? '');
    const voice =
      index === 0
        ? `voice.${school}.welcome`
        : plan.master
          ? `voice.${school}.challenge`
          : `voice.${school}.camp.${camp}`;
    return {
      id: `paso-${number}`,
      school,
      number,
      title: plan.title,
      mode: plan.mode,
      botLevel: plan.botLevel,
      rivalSchool: rivalOf(plan.rival),
      omenId: omenElement ? omenOf(omenElement) : null,
      elements: plan.alliesOnly ? [school, ...neighborsOf(school)] : null,
      goal: plan.goal,
      master: plan.master ?? false,
      line,
      voice,
    };
  });
}

/** El Presagio de un elemento (hay uno por elemento). */
function omenOf(element: ElementId): string | null {
  return OMENS.find((omen) => omen.element === element)?.id ?? null;
}

/** La meta en una frase, para la tarjeta del paso y el resultado. */
export function goalText(goal: PathGoal, school: ElementId): string {
  switch (goal.kind) {
    case 'win':
      return 'Gana el duelo.';
    case 'sweep':
      return 'Gana sin perder ni una ronda.';
    case 'ownSpells':
      return `Gana tejiendo solo los hechizos del ${schoolOf(school).name} (y Paso).`;
    case 'variety':
      return `Gana usando al menos ${goal.spells} hechizos distintos.`;
  }
}
