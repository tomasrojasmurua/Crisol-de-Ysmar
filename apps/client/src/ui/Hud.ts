import { ELEMENTS } from '@crisol/content';
import {
  type GameRules,
  isSpectre,
  type MatchState,
  type RoundPhase,
  roundPhase,
  type SeriesState,
  TICK_RATE,
  type Wizard,
} from '@crisol/core';
import { el, formatClock, query } from './dom';
import { CAST_ICON, elementIcon } from './icons';
import { type RematchView, ResultScreen, type ResultSummary } from './ResultScreen';

/** Reloj de arena de la cinta de ronda. */
const HOURGLASS_ICON =
  '<svg class="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 4H23M9 28H23M10 4C10 11 22 13 22 16C22 19 10 21 10 28M22 4C22 11 10 13 10 16C10 19 22 21 22 28"/></svg>';

const PHASE_NAMES: Record<RoundPhase, string> = {
  hunt: 'Caza',
  convergence: 'Convergencia',
  final: 'Duelo final',
};

const PHASE_HINTS: Record<RoundPhase, string> = {
  hunt: 'La arena está abierta',
  convergence: 'La Trama se cierra · aparecen santuarios',
  final: 'No queda dónde esconderse',
};

/** Lo que el HUD necesita saber de cada mago para dibujarlo. */
export interface WizardBadge {
  readonly name: string;
  readonly color: string;
}

/**
 * La capa de interfaz durante la partida: tu vida y tus vidas, tus aliados, el reloj de la ronda,
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
  private readonly clock: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly score: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSubtitle: HTMLElement;
  private readonly spectreHint: HTMLElement;
  private readonly result: ResultScreen;
  private bannerTimer: number | undefined;
  private discoveryTimer: number | undefined;
  private readonly discovery: HTMLElement;
  private readonly allyRows = new Map<number, HTMLElement>();
  private lastScoreKey = '';
  private lastHp = -1;

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
        <div class="hud-clock-wrap">${HOURGLASS_ICON}<span class="hud-clock">6:00</span></div>
        <div class="hud-phase"></div>
        <div class="hud-score"></div>
      </div>
      <div class="hud-discovery" hidden>
        <span class="hud-discovery-kicker">Nuevo conjuro</span>
        <span class="hud-discovery-orbs"></span>
        <strong class="hud-discovery-name"></strong>
        <span class="hud-discovery-count"></span>
      </div>
      <div class="hud-banner" hidden>
        <div class="hud-banner-title"></div>
        <div class="hud-banner-subtitle"></div>
      </div>
      <p class="hud-spectre" hidden>Eres un espectro · el botón central lanza tu Lamento · un aliado a tu lado te revive</p>
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
    this.roundLabel = query(this.root, '.hud-round-label');
    this.clock = query(this.root, '.hud-clock');
    this.phase = query(this.root, '.hud-phase');
    this.score = query(this.root, '.hud-score');
    this.banner = query(this.root, '.hud-banner');
    this.bannerTitle = query(this.root, '.hud-banner-title');
    this.bannerSubtitle = query(this.root, '.hud-banner-subtitle');
    this.spectreHint = query(this.root, '.hud-spectre');
    this.result = new ResultScreen(this.root, onRematch, onMenu);
  }

  setPlayerName(name: string): void {
    query(this.root, '.hud-player-name').textContent = name || 'Tú';
  }

  /** Celebra un conjuro que el jugador lanzó por primera vez. */
  celebrateDiscovery(name: string, orbs: HTMLElement, known: number, total: number): void {
    query(this.discovery, '.hud-discovery-orbs').replaceChildren(orbs);
    query(this.discovery, '.hud-discovery-name').textContent = name;
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

  /** El Presagio de la partida queda a la vista bajo el reloj. */
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

  /** La columna de arriba a la izquierda (nombre, vida, Presagio), para sumar cosas debajo. */
  get playerColumn(): HTMLElement {
    return query(this.root, '.hud-player');
  }

  /** En el entrenamiento no hay reloj: su lugar lo usa el panel. */
  set training(value: boolean) {
    this.root.classList.toggle('training', value);
  }

  /** Prepara la lista de aliados para una ronda nueva. */
  reset(state: MatchState, player: Wizard, badges: ReadonlyMap<number, WizardBadge>): void {
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
  }

  update(
    state: MatchState,
    player: Wizard,
    series: SeriesState,
    roundNumber: number,
    badges: ReadonlyMap<number, WizardBadge>,
    rules: GameRules,
  ): void {
    if (player.hp !== this.lastHp) {
      this.lastHp = player.hp;
      this.playerFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
      this.playerFill.classList.toggle('low', player.hp < player.maxHp * 0.3);
      this.playerHp.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${Math.round(player.maxHp)}`;
    }
    // El medallón muestra tu Afinidad; sin Afinidad, la estrella del Crisol.
    const portraitKey = player.affinity ?? '';
    if (portraitKey !== this.lastPortrait) {
      this.lastPortrait = portraitKey;
      this.portrait.innerHTML = player.affinity ? elementIcon(player.affinity) : CAST_ICON;
      const element = ELEMENTS.find((e) => e.id === player.affinity);
      this.portrait.style.setProperty('--icon-color', element?.color ?? 'var(--player)');
    }
    this.playerLives.textContent =
      state.deathRule === 'lives'
        ? '◆'.repeat(player.lives) + '◇'.repeat(Math.max(0, rules.death.lives - player.lives))
        : '';

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

    for (const [id, row] of this.allyRows) {
      const ally = state.wizards.find((w) => w.id === id);
      if (!ally) continue;
      const fill = query(row, '.hud-fill');
      fill.style.width = `${(ally.hp / ally.maxHp) * 100}%`;
      row.classList.toggle('down', ally.hp <= 0);
    }

    this.roundLabel.textContent = `Ronda ${roundNumber}`;
    const secondsLeft = (rules.round.durationTicks - state.tick) / TICK_RATE;
    // En el entrenamiento la ronda no se acaba.
    this.clock.textContent = secondsLeft > 60 * 60 * 24 ? '∞' : formatClock(secondsLeft);
    this.clock.classList.toggle('urgent', secondsLeft < 30);
    this.phase.textContent = PHASE_NAMES[roundPhase(state.tick, rules)];

    const scoreKey = `${series.wins.join(',')}|${player.team}`;
    if (scoreKey !== this.lastScoreKey) {
      this.lastScoreKey = scoreKey;
      this.renderScore(series, player.team, badges, state, rules);
    }
    this.spectreHint.hidden = !isSpectre(state, player);
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

  announcePhase(phase: RoundPhase): void {
    this.announce(PHASE_NAMES[phase], PHASE_HINTS[phase]);
  }

  showResult(summary: ResultSummary): void {
    this.result.show(summary);
  }

  hideResult(): void {
    this.result.hide();
  }

  /** Informe de rendimiento de la partida bajo el resultado; vacío lo oculta. */
  showPerf(lines: readonly string[]): void {
    this.result.showPerf(lines);
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
