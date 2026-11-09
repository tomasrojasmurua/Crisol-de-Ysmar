import {
  AFFINITY_RULES,
  GLYPHS,
  type Glyph,
  OMENS,
  type Omen,
  rulesForMode,
} from '@crisol/content';
import {
  affinityPatch,
  BotController,
  combineMods,
  createMatch,
  createSeries,
  type ElementId,
  type GameRules,
  type Intent,
  isElementId,
  type MatchState,
  modeSetup,
  recordRound,
  SeededRng,
  type SeriesState,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';
import type { NetStage, PlayerInfo, PlayerLook } from '@crisol/protocol';

/** Pausa entre rondas, en pasos: tiempo para leer quién ganó (igual que en el celular). */
export const INTERMISSION_TICKS = TICK_RATE * 4;
/** Si alguien no elige Glifo en este tiempo, se le elige uno al azar. */
export const CHOOSE_TICKS = TICK_RATE * 25;
/** Glifos que se ofrecen entre rondas; quien perdió la ronda ve uno más. */
const GLYPH_OPTIONS = 3;
/** Intenciones que se guardan por jugador entre dos pasos: lo demás se descarta. */
const MAX_PENDING = 64;
const NAME_MAX = 14;
const PLAYERS = 2;

const DEFAULT_LOOK: PlayerLook = {
  robe: 'ceniza',
  trim: 'oro',
  skin: 'arena',
  headwear: 'capucha',
  focus: 'baculo',
};

/** Lo que manda un celular al entrar. */
export interface JoinRequest {
  readonly name: string;
  readonly look?: PlayerLook | undefined;
  readonly affinity?: ElementId | null | undefined;
  readonly token?: string | undefined;
}

interface Slot {
  readonly id: number;
  readonly token: string;
  name: string;
  look: PlayerLook;
  affinity: ElementId | null;
  connected: boolean;
  pending: Intent[];
  glyphs: Glyph[];
  options: Glyph[];
  chosen: boolean;
  rematch: boolean;
}

type Stage =
  | { kind: 'lobby' }
  | { kind: 'playing' }
  | { kind: 'intermission'; roundWinner: number; ticksLeft: number }
  | { kind: 'choosing'; ticksLeft: number }
  | { kind: 'finished' };

/**
 * Un duelo 1v1 entre dos celulares: la Sala lo corre y es la única verdad. Es puro: no sabe de
 * sockets ni de relojes; quien lo usa le pasa las intenciones y lo hace avanzar paso a paso.
 * Si un jugador se desconecta, la IA juega por él hasta que vuelva.
 */
export class DuelHost {
  readonly rules: GameRules = rulesForMode({ kind: 'duel' });
  private readonly slots = new Map<number, Slot>();
  private readonly rng: SeededRng;
  private stage: Stage = { kind: 'lobby' };
  private series: SeriesState = createSeries(PLAYERS);
  private omen: Omen = OMENS[0] as Omen;
  private bots = new Map<number, BotController>();
  private seed: number;
  state: MatchState | null = null;
  /** Se pone en true cuando empieza una partida; quien lo usa avisa y lo vuelve a false. */
  startedNew = false;

  constructor(
    seed: number,
    private readonly makeToken: () => string,
  ) {
    this.seed = seed >>> 0;
    this.rng = new SeededRng(this.seed ^ 0x2545f491);
  }

  /** Entra un jugador, o vuelve uno que se había ido (con su token). Null si la Sala está llena. */
  join(request: JoinRequest): { playerId: number; token: string } | null {
    const back = request.token
      ? [...this.slots.values()].find((s) => s.token === request.token)
      : undefined;
    const name = cleanName(request.name);
    if (back) {
      back.connected = true;
      back.pending = [];
      if (name) back.name = name;
      return { playerId: back.id, token: back.token };
    }
    if (this.slots.size >= PLAYERS) return null;
    const id = [1, 2].find((n) => !this.slots.has(n)) ?? 1;
    const slot: Slot = {
      id,
      token: this.makeToken(),
      name: name || `Hechicero ${id}`,
      look: cleanLook(request.look),
      affinity: request.affinity && isElementId(request.affinity) ? request.affinity : null,
      connected: true,
      pending: [],
      glyphs: [],
      options: [],
      chosen: false,
      rematch: false,
    };
    this.slots.set(id, slot);
    if (this.slots.size === PLAYERS && this.stage.kind === 'lobby') this.startSeries();
    return { playerId: id, token: slot.token };
  }

  /** Se cortó la conexión de un jugador: en la sala de espera deja su lugar; jugando, lo toma la IA. */
  leave(playerId: number): void {
    const slot = this.slots.get(playerId);
    if (!slot) return;
    if (this.stage.kind === 'lobby') {
      this.slots.delete(playerId);
      return;
    }
    slot.connected = false;
    slot.pending = [];
  }

  /** Cuántos jugadores siguen conectados. */
  get connectedCount(): number {
    return [...this.slots.values()].filter((s) => s.connected).length;
  }

  get players(): PlayerInfo[] {
    return [...this.slots.values()]
      .sort((a, b) => a.id - b.id)
      .map((s) => ({
        id: s.id,
        team: s.id - 1,
        name: s.name,
        look: s.look,
        affinity: s.affinity,
        connected: s.connected,
      }));
  }

  get omenId(): string {
    return this.omen.id;
  }

  get inLobby(): boolean {
    return this.stage.kind === 'lobby';
  }

  /** Lo que tocó un jugador desde el último paso. */
  intents(playerId: number, intents: readonly Intent[]): void {
    const slot = this.slots.get(playerId);
    if (!slot?.connected || this.stage.kind !== 'playing') return;
    for (const intent of intents) {
      if (slot.pending.length >= MAX_PENDING) break;
      if (isIntent(intent)) slot.pending.push(intent);
    }
  }

  /** El jugador eligió su Glifo entre los que le ofrecieron. */
  chooseGlyph(playerId: number, glyphId: string): void {
    const slot = this.slots.get(playerId);
    if (!slot || this.stage.kind !== 'choosing' || slot.chosen) return;
    const pick = slot.options.find((g) => g.id === glyphId);
    if (!pick) return;
    slot.glyphs.push(pick);
    slot.chosen = true;
    this.maybeNextRound();
  }

  /** Pide la revancha; cuando la piden los dos (o el otro ya no está), empieza otra partida. */
  rematch(playerId: number): void {
    const slot = this.slots.get(playerId);
    if (!slot || this.stage.kind !== 'finished') return;
    slot.rematch = true;
    if ([...this.slots.values()].every((s) => s.rematch || !s.connected)) this.startSeries();
  }

  /** Avanza un paso. */
  tick(): void {
    switch (this.stage.kind) {
      case 'lobby':
      case 'finished':
        return;
      case 'intermission':
        if (--this.stage.ticksLeft <= 0) this.offerGlyphs(this.stage.roundWinner);
        return;
      case 'choosing':
        // Quien no está o no alcanzó a elegir, recibe uno al azar.
        if (--this.stage.ticksLeft <= 0) {
          for (const slot of this.slots.values()) if (!slot.chosen) this.autoPick(slot);
          this.maybeNextRound();
        } else {
          for (const slot of this.slots.values())
            if (!slot.connected && !slot.chosen) this.autoPick(slot);
          this.maybeNextRound();
        }
        return;
      case 'playing':
        this.stepRound();
        return;
    }
  }

  /** La etapa vista por un jugador: sus opciones de Glifo son solo suyas. */
  stageFor(playerId: number): NetStage {
    const slot = this.slots.get(playerId);
    switch (this.stage.kind) {
      case 'lobby':
        return { kind: 'lobby' };
      case 'playing':
        return { kind: 'playing' };
      case 'intermission':
        return {
          kind: 'intermission',
          roundWinner: this.stage.roundWinner,
          ticksLeft: this.stage.ticksLeft,
        };
      case 'choosing':
        return {
          kind: 'choosing',
          options: slot?.options.map((g) => g.id) ?? [],
          chosen: slot?.chosen ?? true,
        };
      case 'finished':
        return {
          kind: 'finished',
          rematch: [...this.slots.values()].filter((s) => s.rematch).map((s) => s.id),
        };
    }
  }

  /** Lo de la serie que va en cada estado. */
  seriesInfo(): {
    wins: readonly number[];
    roundsPlayed: number;
    seriesWinner: number | null;
    glyphs: Record<number, string[]>;
  } {
    const glyphs: Record<number, string[]> = {};
    for (const slot of this.slots.values()) glyphs[slot.id] = slot.glyphs.map((g) => g.id);
    return {
      wins: this.series.wins,
      roundsPlayed: this.series.roundsPlayed,
      seriesWinner: this.series.winnerTeam,
      glyphs,
    };
  }

  private startSeries(): void {
    this.seed = (this.seed + 0x9e3779b9) >>> 0;
    this.series = createSeries(PLAYERS);
    this.omen = OMENS[this.rng.int(0, OMENS.length - 1)] ?? (OMENS[0] as Omen);
    for (const slot of this.slots.values()) {
      slot.glyphs = [];
      slot.options = [];
      slot.chosen = false;
      slot.rematch = false;
      slot.pending = [];
    }
    this.state = this.startRound();
    this.stage = { kind: 'playing' };
    this.startedNew = true;
  }

  private stepRound(): void {
    const state = this.state;
    if (!state) return;
    const intents = new Map<number, Intent[]>();
    for (const wizard of state.wizards) {
      const slot = this.slots.get(wizard.id);
      if (slot?.connected) {
        intents.set(wizard.id, slot.pending);
        slot.pending = [];
      } else {
        intents.set(wizard.id, [...(this.bots.get(wizard.id)?.intentsFor(state, wizard) ?? [])]);
      }
    }
    stepMatch(state, intents, this.rules);
    const roundWinner = state.winnerTeam;
    if (roundWinner !== null) {
      recordRound(this.series, roundWinner, this.rules.round);
      this.stage =
        this.series.winnerTeam === null
          ? { kind: 'intermission', roundWinner, ticksLeft: INTERMISSION_TICKS }
          : { kind: 'finished' };
    }
  }

  private offerGlyphs(roundWinner: number): void {
    for (const slot of this.slots.values()) {
      const lost = roundWinner !== slot.id - 1;
      slot.options = this.glyphOptions(slot, GLYPH_OPTIONS + (lost ? 1 : 0));
      slot.chosen = slot.options.length === 0;
    }
    this.stage = { kind: 'choosing', ticksLeft: CHOOSE_TICKS };
    this.maybeNextRound();
  }

  private autoPick(slot: Slot): void {
    const pick = slot.options[this.rng.int(0, slot.options.length - 1)];
    if (pick) slot.glyphs.push(pick);
    slot.chosen = true;
  }

  private maybeNextRound(): void {
    if (this.stage.kind !== 'choosing') return;
    if (![...this.slots.values()].every((s) => s.chosen)) return;
    this.state = this.startRound();
    this.stage = { kind: 'playing' };
  }

  /** Glifos al azar que el mago todavía no tiene. */
  private glyphOptions(slot: Slot, count: number): Glyph[] {
    const owned = new Set(slot.glyphs.map((g) => g.id));
    const pool = GLYPHS.filter((g) => !owned.has(g.id));
    const options: Glyph[] = [];
    while (options.length < count && pool.length > 0) {
      const [pick] = pool.splice(this.rng.int(0, pool.length - 1), 1);
      if (pick) options.push(pick);
    }
    return options;
  }

  private startRound(): MatchState {
    const roundSeed = (this.seed + this.series.roundsPlayed * 0x9e3779b1) >>> 0;
    const setup = modeSetup({ kind: 'duel' }, roundSeed, 'spectre', this.rules);
    const wizards = setup.wizards.map((w, index) => {
      const slot = this.slots.get(index + 1);
      const affinity = slot?.affinity ?? null;
      const patches = (slot?.glyphs ?? []).map((g) => g.mods);
      if (affinity) {
        patches.push(
          affinityPatch(
            affinity,
            AFFINITY_RULES.ownFatigueMultiplier,
            AFFINITY_RULES.opposingFatigueMultiplier,
          ),
        );
      }
      return { ...w, affinity, mods: combineMods(this.omen.mods, ...patches) };
    });
    const state = createMatch({ ...setup, wizards }, this.rules);
    this.bots = new Map(
      state.wizards.map((w) => [
        w.id,
        new BotController((roundSeed ^ Math.imul(w.id, 0x5bd1e995)) >>> 0, this.rules),
      ]),
    );
    return state;
  }
}

function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
}

function cleanLook(look: PlayerLook | undefined): PlayerLook {
  if (!look || typeof look !== 'object') return DEFAULT_LOOK;
  const pick = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.length <= 24 ? value : fallback;
  return {
    robe: pick(look.robe, DEFAULT_LOOK.robe),
    trim: pick(look.trim, DEFAULT_LOOK.trim),
    skin: pick(look.skin, DEFAULT_LOOK.skin),
    headwear: pick(look.headwear, DEFAULT_LOOK.headwear),
    focus: pick(look.focus, DEFAULT_LOOK.focus),
  };
}

const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n);

/** Una intención bien formada; lo demás se ignora (nadie manda basura al núcleo). */
function isIntent(value: unknown): value is Intent {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'move':
      return finite(v.x) && finite(v.z) && Math.hypot(v.x as number, v.z as number) <= 1.5;
    case 'weave':
      return typeof v.element === 'string' && isElementId(v.element);
    case 'cancelWeave':
      return true;
    case 'cast':
      return finite(v.dirX) && finite(v.dirZ);
    case 'lockTarget':
      return v.targetId === null || finite(v.targetId);
    default:
      return false;
  }
}
