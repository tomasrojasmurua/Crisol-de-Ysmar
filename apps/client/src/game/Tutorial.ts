import { COMBOS, type Combo } from '@crisol/content';
import type { ComboId, EntityId, GameEvent, MatchState, SpellId, Vec2 } from '@crisol/core';
import { ComboDetector } from './ComboDetector';

/** Qué completa un paso del tutorial. */
type Goal =
  | { readonly kind: 'move'; readonly meters: number }
  | { readonly kind: 'release'; readonly spell: SpellId }
  | { readonly kind: 'reaction'; readonly reaction: ComboId }
  | { readonly kind: 'combo'; readonly comboId: string }
  /** Solo se lee: avanza con «Siguiente». */
  | { readonly kind: 'read' };

export interface TutorialStep {
  readonly title: string;
  readonly text: string;
  readonly goal: Goal;
  /** El combo que enseña: se dibuja con sus signos, igual que en el Grimorio. */
  readonly combo?: Combo;
}

const combo = (id: string): Combo => {
  const found = COMBOS.find((c) => c.id === id);
  if (!found) throw new Error(`Falta el combo ${id}`);
  return found;
};

/**
 * Los pasos: moverse, tejer y lanzar, el descanso de los elementos y los 3 combos que entrega
 * (Brasa maldita, Quiebre y Amarre: entre los tres, los 5 elementos).
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: 'Moverse',
    text: 'Arrastra el pulgar izquierdo para caminar por la arena.',
    goal: { kind: 'move', meters: 3 },
  },
  {
    title: 'Tejer y lanzar',
    text: 'Toca Brasa y después ✦: lanzas una Chispa al muñeco.',
    goal: { kind: 'release', spell: 'spark' },
  },
  {
    title: 'El descanso',
    text: 'Cada elemento que usas descansa 3 s y su botón se apaga: alterna elementos. Tejer dos o tres seguidos crea hechizos más fuertes, y cada uno nuevo queda en tu Grimorio.',
    goal: { kind: 'read' },
  },
  {
    title: 'Combo: Brasa maldita',
    text: 'Quema al muñeco con una Chispa y, mientras arde, golpéalo con Umbra (Zarpa: Umbra y ✦).',
    goal: { kind: 'reaction', reaction: 'ashenCurse' },
    combo: combo('brasa-maldita'),
  },
  {
    title: 'Combo: Quiebre',
    text: 'Lanza Era de hielo (Marea, Marea, Marea). Cuando lo congele, suéltale un Rayo en cadena (Tormenta, Brasa).',
    goal: { kind: 'reaction', reaction: 'shatter' },
    combo: combo('quiebre'),
  },
  {
    title: 'Combo: Amarre',
    text: 'La Liana (Raíz, Tormenta) te lleva al muñeco y lo enraíza; ahí mismo, un Salpicón (Marea).',
    goal: { kind: 'combo', comboId: 'amarre' },
    combo: combo('amarre'),
  },
];

/**
 * El tutorial de Entrenamiento, paso a paso. Lee los eventos de la partida de práctica para ver
 * si cumpliste lo que pide cada paso; al terminar el último entrega los 3 combos.
 */
export class Tutorial {
  private index = 0;
  private start: Vec2 | null = null;
  private readonly detector: ComboDetector;

  constructor(private readonly playerId: EntityId) {
    this.detector = new ComboDetector(playerId);
  }

  get step(): TutorialStep | null {
    return TUTORIAL_STEPS[this.index] ?? null;
  }

  get stepNumber(): number {
    return this.index + 1;
  }

  get total(): number {
    return TUTORIAL_STEPS.length;
  }

  get done(): boolean {
    return this.index >= TUTORIAL_STEPS.length;
  }

  /** «Siguiente» en un paso que solo se lee. */
  next(): void {
    if (this.step?.goal.kind === 'read') this.advance();
  }

  /** Procesa un paso de la partida; devuelve si avanzó el tutorial. */
  onStep(events: readonly GameEvent[], state: MatchState): boolean {
    const combos = this.detector.onStep(events, state).map((h) => h.combo.id);
    const goal = this.step?.goal;
    if (!goal) return false;
    const me = state.wizards.find((w) => w.id === this.playerId);
    let reached = false;
    switch (goal.kind) {
      case 'move':
        if (me) {
          this.start ??= me.pos;
          reached = Math.hypot(me.pos.x - this.start.x, me.pos.z - this.start.z) >= goal.meters;
        }
        break;
      case 'release':
        reached = events.some(
          (e) => e.type === 'release' && e.wizardId === this.playerId && e.spell === goal.spell,
        );
        break;
      case 'reaction':
        reached = events.some(
          (e) => e.type === 'combo' && e.sourceId === this.playerId && e.combo === goal.reaction,
        );
        break;
      case 'combo':
        reached = combos.includes(goal.comboId);
        break;
      case 'read':
        break;
    }
    if (reached) this.advance();
    return reached;
  }

  private advance(): void {
    this.index++;
  }
}
