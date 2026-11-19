import type { SpellId } from '../spells/catalog';
import type { EntityId, MatchState } from './state';

/**
 * Lo que hizo un mago en toda la partida (todas las rondas): sale en el resumen del final y se
 * suma a su perfil. Se cuenta solo con los avisos de cada paso, sin tocar el estado.
 */
export interface WizardMatchStats {
  readonly id: EntityId;
  /** Daño hecho a magos rivales (no cuenta el que te haces tú ni el de la zona). */
  damage: number;
  /** Daño recibido de todo: rivales, bestias y la zona. */
  taken: number;
  /** Rivales que cayeron con un golpe tuyo. */
  knockouts: number;
  /** Veces que caíste. */
  falls: number;
  /** Hechizos que salieron (los que se deshicieron antes de salir no cuentan). */
  casts: number;
  /** Reacciones entre estados que provocaste (empapado + Tormenta, enraizado + Brasa…). */
  reactions: number;
  /** Bestias que remataste (el Guardián incluido). */
  beasts: number;
  /** Cuántas veces salió cada hechizo; el eco de un Gran hechizo cuenta como su base. */
  spells: Partial<Record<SpellId, number>>;
}

/** Las estadísticas de una partida, un mago por fila. */
export type MatchStats = WizardMatchStats[];

export function createMatchStats(ids: readonly EntityId[]): MatchStats {
  return ids.map((id) => ({
    id,
    damage: 0,
    taken: 0,
    knockouts: 0,
    falls: 0,
    casts: 0,
    reactions: 0,
    beasts: 0,
    spells: {},
  }));
}

/**
 * Suma lo que pasó en el último paso (`state.events`). Barato: recorre los avisos una vez y
 * solo mira a los magos para saber de qué equipo es cada uno.
 */
export function recordMatchStats(stats: MatchStats, state: MatchState): void {
  if (state.events.length === 0) return;
  /** Quién dio el último golpe a cada mago en este paso: a ese se le cuenta el derribo. */
  let lastHit: Map<EntityId, EntityId> | null = null;
  for (const event of state.events) {
    switch (event.type) {
      case 'release': {
        const row = rowOf(stats, event.wizardId);
        if (!row) break;
        row.casts++;
        row.spells[event.spell] = (row.spells[event.spell] ?? 0) + 1;
        break;
      }
      case 'hit': {
        const target = rowOf(stats, event.targetId);
        if (target) target.taken += event.amount;
        if (rivals(state, event.sourceId, event.targetId)) {
          const source = rowOf(stats, event.sourceId);
          if (source) source.damage += event.amount;
        }
        lastHit ??= new Map();
        lastHit.set(event.targetId, event.sourceId);
        break;
      }
      case 'defeated': {
        const fallen = rowOf(stats, event.wizardId);
        if (fallen) fallen.falls++;
        const by = lastHit?.get(event.wizardId);
        if (by !== undefined && rivals(state, by, event.wizardId)) {
          const killer = rowOf(stats, by);
          if (killer) killer.knockouts++;
        }
        break;
      }
      case 'combo': {
        const row = rowOf(stats, event.sourceId);
        if (row) row.reactions++;
        break;
      }
      case 'beastSlain': {
        const row = event.killerId === null ? undefined : rowOf(stats, event.killerId);
        if (row) row.beasts++;
        break;
      }
      default:
        break;
    }
  }
}

function rowOf(stats: MatchStats, id: EntityId): WizardMatchStats | undefined {
  for (const row of stats) if (row.id === id) return row;
  return undefined;
}

/** Si los dos son magos de equipos distintos (las bestias y la zona no son rivales). */
export function rivals(state: MatchState, sourceId: EntityId, targetId: EntityId): boolean {
  if (sourceId === targetId) return false;
  let sourceTeam: number | null = null;
  let targetTeam: number | null = null;
  for (const wizard of state.wizards) {
    if (wizard.id === sourceId) sourceTeam = wizard.team;
    if (wizard.id === targetId) targetTeam = wizard.team;
  }
  return sourceTeam !== null && targetTeam !== null && sourceTeam !== targetTeam;
}

/** El hechizo que más usó (en empate, el que se usó primero), o null si no lanzó nada. */
export function favoriteSpell(row: WizardMatchStats): SpellId | null {
  let best: SpellId | null = null;
  let bestCount = 0;
  for (const [spell, count] of Object.entries(row.spells) as [SpellId, number][]) {
    if (count > bestCount) {
      best = spell;
      bestCount = count;
    }
  }
  return best;
}
