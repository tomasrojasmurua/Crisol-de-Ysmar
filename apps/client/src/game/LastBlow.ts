import type { EntityId, GameEvent, SpellForm, SpellId } from '@crisol/core';

/** Cuántos hechizos recientes de cada mago se recuerdan. */
const RECENT_MAX = 6;
/** Un hechizo lanzado hace más que esto (en pasos, 12 s) ya no se le atribuye al golpe. */
const RECENT_TICKS = 360;

interface Release {
  readonly spell: SpellId;
  readonly form: SpellForm;
  readonly tick: number;
}

/**
 * El hechizo con que un rival te derribó, para mostrarlo al final ("¿qué fue eso?"). El golpe
 * no dice qué hechizo lo causó, solo su familia, así que se busca entre lo último que lanzó
 * quien te pegó: el más reciente de esa familia o, si no hay, el último que lanzó. La zona y
 * las bestias no cuentan.
 */
export class LastBlow {
  private readonly recent = new Map<EntityId, Release[]>();
  private last: SpellId | null = null;

  constructor(readonly playerId: EntityId) {}

  /** El hechizo de tu última caída por un rival en la partida; null si no caíste así. */
  get spell(): SpellId | null {
    return this.last;
  }

  reset(): void {
    this.recent.clear();
    this.last = null;
  }

  /** Lo que pasó en un paso. `rival` dice si un mago es de otro equipo que el tuyo. */
  onStep(events: readonly GameEvent[], tick: number, rival: (id: EntityId) => boolean): void {
    let blow: { readonly sourceId: EntityId; readonly form: string } | null = null;
    for (const event of events) {
      if (event.type === 'release') {
        const list = this.recent.get(event.wizardId) ?? [];
        list.push({ spell: event.spell, form: event.form, tick });
        if (list.length > RECENT_MAX) list.shift();
        this.recent.set(event.wizardId, list);
      } else if (event.type === 'hit' && event.targetId === this.playerId) {
        blow = { sourceId: event.sourceId, form: event.form };
      } else if (event.type === 'defeated' && event.wizardId === this.playerId && blow) {
        if (blow.form === 'zone' || blow.form === 'beast' || !rival(blow.sourceId)) continue;
        const list = (this.recent.get(blow.sourceId) ?? []).filter(
          (r) => tick - r.tick <= RECENT_TICKS,
        );
        const form = blow.form;
        const pick = [...list].reverse().find((r) => r.form === form) ?? list[list.length - 1];
        if (pick) this.last = pick.spell;
      }
    }
  }
}
