import { ELEMENTS } from '@crisol/content';
import {
  type GameRules,
  type MatchState,
  type RoundPhase,
  roundPhase,
  type SeriesState,
  type Wizard,
} from '@crisol/core';
import { barWidth, el, query, setStyle, setText } from './dom';
import { type HighlightView, highlightCard } from './HighlightCard';
import { CAST_ICON, elementIcon } from './icons';
import {
  type OpinionSink,
  type RematchView,
  ResultScreen,
  type ResultSummary,
} from './ResultScreen';

export const PHASE_NAMES: Record<RoundPhase, string> = {
  hunt: 'Caza',
  convergence: 'Convergencia',
  final: 'Duelo final',
  sudden: 'Muerte súbita',
};

const PHASE_HINTS: Record<RoundPhase, string> = {
  hunt: 'La arena está abierta',
  convergence: 'La Trama se cierra · aparecen santuarios',
  final: 'No queda dónde esconderse',
  sudden: 'La Trama se cierra del todo',
};

/** Un aviso corto de lo que pasó en la partida, para la franja bajo la ronda. */
export interface FeedLine {
  readonly text: string;
  /** Dorado para lo tuyo o lo de tu equipo, carmesí para lo que te hicieron, neutro el resto. */
  readonly tone: 'own' | 'foe' | 'neutral';
  /** Más grande: dobles y triples derribos, y quedar último en pie. */
  readonly big: boolean;
}

/** Cuántos avisos caben a la vez bajo la ronda. */
const FEED_MAX = 2;

/** Lo que el HUD necesita saber de cada mago para dibujarlo. */
export interface WizardBadge {
  readonly name: string;
  readonly color: string;
}

/**
 * La capa de interfaz durante la partida: tu vida y tus vidas, tus aliados, la ronda y su fase,
 * el marcador, avisos grandes en el centro y la pantalla final.
 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly playerFill: HTMLElement;
  private readonly playerLives: HTMLElement;
  private readonly playerHp: HTMLElement;
  private readonly portrait: HTMLElement;
  private lastPortrait: string | undefined;
  private readonly essence: HTMLElement;
  private readonly omen: HTMLElement;
  private lastEssenceKey = '';
  private readonly allies: HTMLElement;
  private readonly roundLabel: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly score: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSubtitle: HTMLElement;
  private readonly result: ResultScreen;
  private bannerTimer: number | undefined;
  /** Bajo el aviso de fin de ronda: la mejor jugada de la ronda. */
  private readonly highlightSlot: HTMLElement;
  private highlightTimer: number | undefined;
  private discoveryTimer: number | undefined;
  private readonly discovery: HTMLElement;
  /** Avisos cortos bajo la ronda: quién derribó a quién, dobles derribos, último en pie. */
  private readonly feed: HTMLElement;
  private readonly allyRows = new Map<number, HTMLElement>();
  private lastScoreKey = '';
  private lastHp = -1;
  /** Tu nombre, para volver a él cuando dejas de mirar a otro mago. */
  private ownName = 'Tú';
  /** A quién muestra la ficha de arriba a la izquierda: tú, o el mago que miras tras caer. */
  private shownId = -1;

  constructor(parent: HTMLElement, onRematch: () => void, onMenu: () => void) {
    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="hud-player">
        <div class="hud-player-head">
          <div class="hud-portrait"></div>
          <div class="hud-player-main">
            <div class="hud-name"><span class="hud-player-name">Tú</span> <span class="hud-lives"></span></div>
            <div class="hud-bar"><div class="hud-fill"></div><span class="hud-hp"></span></div>
          </div>
        </div>
        <div class="hud-omen" hidden></div>
        <div class="hud-essence"></div>
        <div class="hud-allies"></div>
      </div>
      <div class="hud-round">
        <div class="hud-round-label"></div>
        <div class="hud-phase"></div>
        <div class="hud-score"></div>
      </div>
      <div class="hud-feed" aria-live="polite"></div>
      <div class="hud-discovery" hidden>
        <span class="hud-discovery-kicker">Nuevo conjuro</span>
        <span class="hud-discovery-orbs"></span>
        <strong class="hud-discovery-name"></strong>
        <span class="hud-discovery-intent"></span>
        <span class="hud-discovery-count"></span>
      </div>
      <div class="hud-banner" hidden>
        <div class="hud-banner-title"></div>
        <div class="hud-banner-subtitle"></div>
      </div>
      <div class="hud-highlight-slot"></div>
`;
    parent.append(this.root);
    this.playerFill = query(this.root, '.hud-fill');
    this.playerLives = query(this.root, '.hud-lives');
    this.playerHp = query(this.root, '.hud-hp');
    this.portrait = query(this.root, '.hud-portrait');
    this.essence = query(this.root, '.hud-essence');
    this.omen = query(this.root, '.hud-omen');
    this.allies = query(this.root, '.hud-allies');
    this.discovery = query(this.root, '.hud-discovery');
    this.feed = query(this.root, '.hud-feed');
    this.roundLabel = query(this.root, '.hud-round-label');
    this.phase = query(this.root, '.hud-phase');
    this.score = query(this.root, '.hud-score');
    this.banner = query(this.root, '.hud-banner');
    this.bannerTitle = query(this.root, '.hud-banner-title');
    this.bannerSubtitle = query(this.root, '.hud-banner-subtitle');
    this.highlightSlot = query(this.root, '.hud-highlight-slot');
    this.result = new ResultScreen(this.root, onRematch, onMenu);
  }

  setPlayerName(name: string): void {
    this.ownName = name || 'Tú';
    if (!this.root.classList.contains('watching'))
      query(this.root, '.hud-player-name').textContent = this.ownName;
  }

  /**
   * Suma avisos a la franja bajo la ronda. Caben dos a la vez (el más nuevo abajo) para no
   * bajar hasta el aviso de descubrimiento; cada uno se va solo a los pocos segundos.
   */
  pushFeed(lines: readonly FeedLine[]): void {
    for (const line of lines) {
      const row = el('div', `hud-feed-line ${line.tone}${line.big ? ' big' : ''}`, line.text);
      row.addEventListener('animationend', () => row.remove());
      this.feed.append(row);
    }
    while (this.feed.children.length > FEED_MAX) this.feed.firstElementChild?.remove();
  }

  /** Celebra un conjuro que el jugador lanzó por primera vez (o un combo nuevo). */
  celebrateDiscovery(
    name: string,
    orbs: HTMLElement,
    known: number,
    total: number,
    kicker = 'Nuevo conjuro',
    intent: HTMLElement | null = null,
  ): void {
    query(this.discovery, '.hud-discovery-kicker').textContent = kicker;
    query(this.discovery, '.hud-discovery-orbs').replaceChildren(orbs);
    query(this.discovery, '.hud-discovery-name').textContent = name;
    // Para qué sirve, en un ícono y una palabra: se sabe al tiro si pega, cura o ayuda.
    const intentSlot = query(this.discovery, '.hud-discovery-intent');
    if (intent) intentSlot.replaceChildren(intent);
    else intentSlot.replaceChildren();
    query(this.discovery, '.hud-discovery-count').textContent = `${known}/${total}`;
    this.discovery.hidden = false;
    this.discovery.classList.remove('show');
    void this.discovery.offsetWidth;
    this.discovery.classList.add('show');
    window.clearTimeout(this.discoveryTimer);
    this.discoveryTimer = window.setTimeout(() => {
      this.discovery.hidden = true;
    }, 2600);
  }

  /** El Presagio de la partida queda a la vista bajo la cinta de ronda. */
  setOmen(name: string | null, description = ''): void {
    if (name === null) {
      this.omen.hidden = true;
      return;
    }
    this.omen.textContent = `Presagio: ${name}`;
    this.omen.title = description;
    this.omen.hidden = false;
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  /** La capa del HUD, para piezas que van sobre la arena y se esconden con él. */
  get layer(): HTMLElement {
    return this.root;
  }

  /** La columna de arriba a la izquierda (nombre, vida, Presagio), para sumar cosas debajo. */
  get playerColumn(): HTMLElement {
    return query(this.root, '.hud-player');
  }

  /** En el entrenamiento no hay cinta de ronda: su lugar lo usa el panel. */
  set training(value: boolean) {
    this.root.classList.toggle('training', value);
  }

  /** Prepara la lista de aliados para una ronda nueva. */
  reset(state: MatchState, player: Wizard, badges: ReadonlyMap<number, WizardBadge>): void {
    this.feed.replaceChildren();
    this.allies.replaceChildren();
    this.allyRows.clear();
    for (const ally of state.wizards) {
      if (ally.team !== player.team || ally.id === player.id) continue;
      const badge = badges.get(ally.id);
      const row = el('div', 'hud-ally');
      row.append(el('span', 'hud-ally-dot'), el('span', 'hud-ally-name', badge?.name ?? ''));
      const bar = el('div', 'hud-bar small');
      bar.append(el('div', 'hud-fill'));
      row.append(bar);
      row.style.setProperty('--team', badge?.color ?? '#fff');
      this.allies.append(row);
      this.allyRows.set(ally.id, row);
    }
    this.lastScoreKey = '';
    this.lastEssenceKey = '';
    this.lastHp = -1;
    this.lastPortrait = undefined;
    this.shownId = -1;
  }

  /**
   * `player` es tu mago (equipo y marcador). `shown` es el de la ficha de vida: tú mientras
   * juegas, o el mago que miras si caíste.
   */
  update(
    state: MatchState,
    player: Wizard,
    series: SeriesState,
    roundNumber: number,
    badges: ReadonlyMap<number, WizardBadge>,
    rules: GameRules,
    shown: Wizard = player,
  ): void {
    this.showWizard(player, shown, badges);
    this.updateCard(state, shown, rules);

    for (const [id, row] of this.allyRows) {
      const ally = state.wizards.find((w) => w.id === id);
      if (!ally) continue;
      const fill = query(row, '.hud-fill');
      setStyle(fill, 'width', barWidth(ally.hp, ally.maxHp));
      row.classList.toggle('down', ally.hp <= 0);
    }

    setText(this.roundLabel, `Ronda ${roundNumber}`);
    setText(this.phase, PHASE_NAMES[roundPhase(state.tick, rules)]);

    const scoreKey = `${series.wins.join(',')}|${player.team}`;
    if (scoreKey !== this.lastScoreKey) {
      this.lastScoreKey = scoreKey;
      this.renderScore(series, player.team, badges, state, rules);
    }
  }

  /** Cambia la ficha de arriba a la izquierda a otro mago: su nombre y su color. */
  private showWizard(
    player: Wizard,
    shown: Wizard,
    badges: ReadonlyMap<number, WizardBadge>,
  ): void {
    if (shown.id === this.shownId) return;
    this.shownId = shown.id;
    const watching = shown.id !== player.id;
    this.root.classList.toggle('watching', watching);
    const badge = badges.get(shown.id);
    query(this.root, '.hud-player-name').textContent = watching
      ? (badge?.name ?? 'Otro mago')
      : this.ownName;
    const head = query(this.root, '.hud-player-head');
    if (watching && badge) head.style.setProperty('--watched', badge.color);
    else head.style.removeProperty('--watched');
    // Otro mago, otra vida: se repinta todo aunque los números coincidan.
    this.lastHp = -1;
    this.lastEssenceKey = '';
    this.lastPortrait = undefined;
  }

  /** La vida, el medallón de Afinidad, las vidas y la Esencia del mago de la ficha. */
  private updateCard(state: MatchState, player: Wizard, rules: GameRules): void {
    if (player.hp !== this.lastHp) {
      this.lastHp = player.hp;
      setStyle(this.playerFill, 'width', barWidth(player.hp, player.maxHp));
      this.playerFill.classList.toggle('low', player.hp < player.maxHp * 0.3);
      setText(this.playerHp, `${Math.max(0, Math.ceil(player.hp))} / ${Math.round(player.maxHp)}`);
    }
    // El medallón muestra tu Afinidad; sin Afinidad, la estrella del Crisol.
    const portraitKey = player.affinity ?? '';
    if (portraitKey !== this.lastPortrait) {
      this.lastPortrait = portraitKey;
      this.portrait.innerHTML = player.affinity ? elementIcon(player.affinity) : CAST_ICON;
      const element = ELEMENTS.find((e) => e.id === player.affinity);
      this.portrait.style.setProperty('--icon-color', element?.color ?? 'var(--player)');
    }
    setText(
      this.playerLives,
      state.deathRule === 'lives'
        ? '◆'.repeat(player.lives) + '◇'.repeat(Math.max(0, rules.death.lives - player.lives))
        : '',
    );

    const essenceKey = ELEMENTS.map((e) => player.essence[e.id]).join(',');
    if (essenceKey !== this.lastEssenceKey) {
      this.lastEssenceKey = essenceKey;
      this.essence.replaceChildren();
      for (const element of ELEMENTS) {
        const count = player.essence[element.id];
        if (count <= 0) continue;
        const chip = el('span', 'hud-essence-chip', `${element.name} ${'●'.repeat(count)}`);
        chip.style.setProperty('--essence', element.color);
        this.essence.append(chip);
      }
    }
  }

  /** Aviso grande en el centro que se va solo. */
  announce(title: string, subtitle = '', seconds = 2.4): void {
    this.bannerTitle.textContent = title;
    this.bannerSubtitle.textContent = subtitle;
    this.banner.hidden = false;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.banner.hidden = true;
    }, seconds * 1000);
  }

  /** La mejor jugada de la ronda bajo el aviso de quién ganó; se va sola. */
  showHighlight(view: HighlightView, seconds: number): void {
    this.highlightSlot.replaceChildren(highlightCard(view, 'hud-highlight'));
    window.clearTimeout(this.highlightTimer);
    this.highlightTimer = window.setTimeout(() => this.hideHighlight(), seconds * 1000);
  }

  hideHighlight(): void {
    window.clearTimeout(this.highlightTimer);
    if (this.highlightSlot.firstChild) this.highlightSlot.replaceChildren();
  }

  announcePhase(phase: RoundPhase): void {
    this.announce(PHASE_NAMES[phase], PHASE_HINTS[phase]);
  }

  showResult(summary: ResultSummary): void {
    // Un aviso que quedaba ("Caíste") no se transparenta bajo el resultado.
    window.clearTimeout(this.bannerTimer);
    this.banner.hidden = true;
    this.hideHighlight();
    this.result.show(summary);
  }

  /** Qué hace el botón "Ver repetición" del resultado. */
  set onReplay(handler: (() => void) | null) {
    this.result.onReplay = handler;
  }

  /** Esconde el resultado sin olvidarlo (mientras se ve la repetición) o lo vuelve a mostrar. */
  setResultHidden(hidden: boolean): void {
    this.result.setHidden(hidden);
  }

  hideResult(): void {
    this.result.hide();
  }

  /** Informe de rendimiento de la partida bajo el resultado; vacío lo oculta. */
  showPerf(lines: readonly string[]): void {
    this.result.showPerf(lines);
  }

  /** En red: pregunta en la pantalla final cómo se jugó. */
  askOpinion(sink: OpinionSink): void {
    this.result.askOpinion(sink);
  }

  /** En red: cómo va la revancha en la pantalla final. */
  setRematch(status: RematchView | null): void {
    this.result.setRematch(status);
  }

  private renderScore(
    series: SeriesState,
    playerTeam: number,
    badges: ReadonlyMap<number, WizardBadge>,
    state: MatchState,
    rules: GameRules,
  ): void {
    this.score.replaceChildren();
    series.wins.forEach((wins, team) => {
      const member = state.wizards.find((w) => w.team === team);
      const color = member ? (badges.get(member.id)?.color ?? '#fff') : '#fff';
      const group = el('span', `hud-score-team${team === playerTeam ? ' own' : ''}`);
      group.style.setProperty('--team', color);
      for (let i = 0; i < rules.round.roundsToWin; i++) {
        group.append(el('span', `pip${i < wins ? ' won' : ''}`));
      }
      this.score.append(group);
    });
  }
}
