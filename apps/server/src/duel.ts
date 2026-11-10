import {
  AFFINITY_RULES,
  blindedFrom,
  cleanLook,
  GLYPHS,
  type Glyph,
  OMENS,
  type Omen,
  randomLook,
  rulesForMode,
  veiledFromTeam,
  WIZARD_NAMES,
} from '@crisol/content';
import {
  affinityPatch,
  BotController,
  combineMods,
  createMatch,
  createSeries,
  ELEMENT_IDS,
  type ElementId,
  type GameEvent,
  type GameMode,
  type GameRules,
  type Intent,
  isElementId,
  type MatchState,
  modeSetup,
  playerCount,
  recordRound,
  SeededRng,
  type SeriesState,
  stepMatch,
  TICK_RATE,
  teamCount,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { NetStage, PlayerInfo, PlayerLook, StateFrame } from '@crisol/protocol';

/** Pausa entre rondas, en pasos: tiempo para leer quién ganó (igual que en el celular). */
export const INTERMISSION_TICKS = TICK_RATE * 4;
/** Si alguien no elige Glifo en este tiempo, se le elige uno al azar. */
export const CHOOSE_TICKS = TICK_RATE * 25;
/** Glifos que se ofrecen entre rondas; quien perdió la ronda ve uno más. */
const GLYPH_OPTIONS = 3;
/** Intenciones que se guardan por jugador entre dos pasos: lo demás se descarta. */
const MAX_PENDING = 64;
/** Jugando, si un jugador conectado no manda nada en este tiempo, la IA lo cubre (2 s). */
export const SILENT_TICKS = TICK_RATE * 2;
const NAME_MAX = 14;

/** Lo que manda un celular al entrar. */
export interface JoinRequest {
  readonly name: string;
  readonly look?: PlayerLook | undefined;
  readonly affinity?: ElementId | null | undefined;
  readonly token?: string | undefined;
  /** El modo que pide quien crea la sala (el primero en entrar); los demás lo ignoran. */
  readonly mode?: GameMode | undefined;
}

interface Slot {
  readonly id: number;
  readonly token: string;
  /** Puesto que ocupa la IA porque nadie lo tomó al empezar. */
  readonly bot: boolean;
  name: string;
  look: PlayerLook;
  affinity: ElementId | null;
  connected: boolean;
  /** Salió de la app (pestaña oculta) o se quedó sin señal: la IA juega por él. */
  away: boolean;
  /** Paso en que llegó su último mensaje de toques. */
  heardAt: number;
  pending: Intent[];
  /** El número del último mensaje de toques recibido y el del último ya jugado. */
  received: number;
  acked: number;
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
 * La partida de una Sala, de 2 a 6 magos: duelo, equipos o todos contra todos. La Sala la corre
 * y es la única verdad. Es pura: no sabe de sockets ni de relojes; quien la usa le pasa las
 * intenciones y la hace avanzar paso a paso. Quien crea la sala elige el modo y puede empezar sin
 * esperar a que se llene: la IA ocupa los puestos libres. Si alguien se desconecta, la IA juega
 * por él hasta que vuelva.
 */
export class DuelHost {
  private mode: GameMode = { kind: 'duel' };
  rules: GameRules = rulesForMode({ kind: 'duel' });
  /** El puesto de quien manda en la sala de espera (el primero que entró y sigue). */
  hostId = 0;
  /** Por qué no pudo entrar el último que lo intentó. */
  joinError = '';
  private readonly slots = new Map<number, Slot>();
  private readonly rng: SeededRng;
  private stage: Stage = { kind: 'lobby' };
  private series: SeriesState = createSeries(2);
  private omen: Omen = OMENS[0] as Omen;
  private bots = new Map<number, BotController>();
  /** Dónde vio cada jugador por última vez a cada rival (para los que ahora no ve). */
  private readonly lastSeen = new Map<string, Vec2>();
  private seed: number;
  /** Pasos desde que se creó la Sala, para saber hace cuánto habló cada jugador. */
  private clock = 0;
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
    if (back && !back.bot) {
      back.connected = true;
      back.away = false;
      back.heardAt = this.clock;
      back.pending = [];
      back.received = 0;
      back.acked = 0;
      if (name) back.name = name;
      return { playerId: back.id, token: back.token };
    }
    if (this.stage.kind !== 'lobby') {
      this.joinError = 'La partida ya empezó';
      return null;
    }
    if (this.slots.size === 0) this.setMode(request.mode);
    const id = this.seatOrder().find((n) => !this.slots.has(n));
    if (id === undefined) {
      this.joinError = 'La sala está llena';
      return null;
    }
    const slot: Slot = {
      id,
      bot: false,
      token: this.makeToken(),
      name: name || `Hechicero ${id}`,
      look: cleanLook(request.look),
      affinity: request.affinity && isElementId(request.affinity) ? request.affinity : null,
      connected: true,
      away: false,
      heardAt: this.clock,
      pending: [],
      received: 0,
      acked: 0,
      glyphs: [],
      options: [],
      chosen: false,
      rematch: false,
    };
    this.slots.set(id, slot);
    if (this.hostId === 0) this.hostId = id;
    if (this.slots.size === playerCount(this.mode)) this.startSeries();
    return { playerId: id, token: slot.token };
  }

  get gameMode(): GameMode {
    return this.mode;
  }

  /** Quien manda empieza sin esperar: la IA ocupa los puestos libres. */
  begin(playerId: number): boolean {
    if (this.stage.kind !== 'lobby' || playerId !== this.hostId) return false;
    const names = WIZARD_NAMES.filter((n) => ![...this.slots.values()].some((s) => s.name === n));
    for (const id of this.seatOrder()) {
      if (this.slots.has(id)) continue;
      const [name] = names.splice(this.rng.int(0, Math.max(0, names.length - 1)), 1);
      this.slots.set(id, {
        id,
        bot: true,
        token: this.makeToken(),
        name: name ?? `Hechicero ${id}`,
        look: randomLook(this.rng),
        affinity: ELEMENT_IDS[this.rng.int(0, ELEMENT_IDS.length - 1)] ?? null,
        connected: false,
        away: false,
        heardAt: this.clock,
        pending: [],
        received: 0,
        acked: 0,
        glyphs: [],
        options: [],
        chosen: false,
        rematch: false,
      });
    }
    this.startSeries();
    return true;
  }

  /** El modo lo pone quien crea la sala; si viene mal, es un duelo. */
  private setMode(mode: GameMode | undefined): void {
    const valid =
      mode?.kind === 'teams'
        ? mode.size === 2 || mode.size === 3
        : mode?.kind === 'ffa'
          ? Number.isInteger(mode.players) && mode.players >= 3 && mode.players <= 6
          : true;
    this.mode = mode && valid ? mode : { kind: 'duel' };
    this.rules = rulesForMode(this.mode);
  }

  /**
   * En qué orden se ocupan los puestos: en equipos se alterna (1, 4, 2, 5…) para repartir a los
   * amigos entre los dos bandos; en duelo y todos contra todos, en orden.
   */
  private seatOrder(): number[] {
    const total = playerCount(this.mode);
    if (this.mode.kind !== 'teams') return Array.from({ length: total }, (_, i) => i + 1);
    const size = this.mode.size;
    return Array.from({ length: size }, (_, i) => [i + 1, i + 1 + size]).flat();
  }

  /** El equipo de un puesto, como lo arma el núcleo. */
  private teamOf(id: number): number {
    if (this.mode.kind === 'teams') return id <= this.mode.size ? 0 : 1;
    return id - 1;
  }

  /** Se cortó la conexión de un jugador: en la sala de espera deja su lugar; jugando, lo toma la IA. */
  leave(playerId: number): void {
    const slot = this.slots.get(playerId);
    if (!slot) return;
    if (this.stage.kind === 'lobby') {
      this.slots.delete(playerId);
      // Si se fue quien mandaba, manda el siguiente que sigue en la sala.
      if (this.hostId === playerId)
        this.hostId = [...this.slots.keys()].sort((a, b) => a - b)[0] ?? 0;
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
        team: this.teamOf(s.id),
        name: s.name,
        bot: s.bot,
        look: s.look,
        affinity: s.affinity,
        connected: s.connected,
        away: s.connected && this.isAway(s),
      }));
  }

  get omenId(): string {
    return this.omen.id;
  }

  get inLobby(): boolean {
    return this.stage.kind === 'lobby';
  }

  /** Salió de la app o volvió. Devuelve si cambió (para avisar a los demás). */
  setAway(playerId: number, away: boolean): boolean {
    const slot = this.slots.get(playerId);
    if (!slot?.connected || slot.away === away) return false;
    slot.away = away;
    slot.pending = [];
    slot.heardAt = this.clock;
    return true;
  }

  /** Si la IA juega por él aunque siga conectado: fuera de la app o callado hace rato. */
  isAway(slot: { away: boolean; heardAt: number }): boolean {
    return slot.away || (this.stage.kind === 'playing' && this.clock - slot.heardAt > SILENT_TICKS);
  }

  /** Quién está fuera ahora, para avisar cuando cambia. */
  get awayKey(): string {
    return [...this.slots.values()].map((s) => (s.connected && this.isAway(s) ? 1 : 0)).join('');
  }

  /** Si a este jugador hay que mandarle el estado (no, mientras está fuera de la app). */
  wantsState(playerId: number): boolean {
    const slot = this.slots.get(playerId);
    return !slot?.away;
  }

  /** Lo que tocó un jugador desde el último paso; `seq` numera sus mensajes. */
  intents(playerId: number, intents: readonly Intent[], seq = 0): void {
    const slot = this.slots.get(playerId);
    if (!slot?.connected) return;
    slot.heardAt = this.clock;
    if (Number.isFinite(seq) && seq > slot.received) slot.received = seq;
    if (this.stage.kind !== 'playing') {
      slot.acked = slot.received;
      return;
    }
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
    this.clock++;
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

  /** El último mensaje de toques de este jugador que ya entró a la simulación. */
  ackOf(playerId: number): number {
    return this.slots.get(playerId)?.acked ?? 0;
  }

  /**
   * El paso tal como lo ve un jugador, a partir de una copia del estado que nadie más modifica.
   * Los rivales que no ve (escondidos o por su Ceguera) llegan quietos donde los vio por última
   * vez, sin tejido ni canalización, y sin los avisos que delatarían lo que hacen.
   */
  frameFor(playerId: number, snapshot: MatchState): StateFrame {
    const viewer = snapshot.wizards.find((w) => w.id === playerId);
    const hidden: number[] = [];
    let wizards: readonly Wizard[] = snapshot.wizards;
    if (viewer) {
      wizards = snapshot.wizards.map((enemy) => {
        if (enemy.team === viewer.team) return enemy;
        const key = `${playerId}:${enemy.id}`;
        const unseen =
          veiledFromTeam(snapshot, viewer.team, enemy.id, this.rules) ||
          blindedFrom(viewer, enemy, this.rules);
        if (!unseen) {
          this.lastSeen.set(key, enemy.pos);
          return enemy;
        }
        hidden.push(enemy.id);
        return { ...enemy, pos: this.lastSeen.get(key) ?? enemy.pos, weave: [], channel: null };
      });
    }
    const state: MatchState =
      hidden.length === 0
        ? snapshot
        : {
            ...snapshot,
            wizards: wizards as Wizard[],
            events: snapshot.events.filter((e) => !revealsHidden(e, hidden)),
          };
    const series = this.seriesInfo();
    return {
      ack: this.ackOf(playerId),
      state,
      stage: structuredClone(this.stageFor(playerId)),
      wins: [...series.wins],
      roundsPlayed: series.roundsPlayed,
      seriesWinner: series.seriesWinner,
      glyphs: series.glyphs,
      hidden,
    };
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
    this.series = createSeries(teamCount(this.mode));
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
      if (slot?.connected && !this.isAway(slot)) {
        intents.set(wizard.id, slot.pending);
        slot.pending = [];
        slot.acked = slot.received;
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
      const lost = roundWinner !== this.teamOf(slot.id);
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
    this.lastSeen.clear();
    const roundSeed = (this.seed + this.series.roundsPlayed * 0x9e3779b1) >>> 0;
    const setup = modeSetup(this.mode, roundSeed, 'out', this.rules);
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

/** Avisos que dicen dónde está o qué hace un rival escondido. */
function revealsHidden(event: GameEvent, hidden: readonly number[]): boolean {
  switch (event.type) {
    case 'cast':
    case 'release':
    case 'blink':
    case 'fizzle':
    case 'vine':
      return hidden.includes(event.wizardId);
    default:
      return false;
  }
}
