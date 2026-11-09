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

export const PHASE_NAMES: Record<RoundPhase, string> = {
  hunt: 'Caza',
  convergence: 'Convergencia',
  final: 'Duelo final',
};

const PHASE_HINTS: Record<RoundPhase, string> = {
  hunt: 'La arena está abierta',
  convergence: 'La Trama empieza a cerrarse',
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
  private readonly allies: HTMLElement;
  private readonly roundLabel: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly score: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSubtitle: HTMLElement;
  private readonly spectreHint: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultScore: HTMLElement;
  private bannerTimer: number | undefined;
  private readonly allyRows = new Map<number, HTMLElement>();
  private lastScoreKey = '';
  private lastHp = -1;

  constructor(parent: HTMLElement, onRematch: () => void, onMenu: () => void) {
    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="hud-player">
        <div class="hud-name">Tú <span class="hud-lives"></span></div>
        <div class="hud-bar"><div class="hud-fill"></div></div>
        <div class="hud-allies"></div>
      </div>
      <div class="hud-round">
        <div class="hud-round-label"></div>
        <div class="hud-clock">6:00</div>
        <div class="hud-phase"></div>
        <div class="hud-score"></div>
      </div>
      <div class="hud-banner" hidden>
        <div class="hud-banner-title"></div>
        <div class="hud-banner-subtitle"></div>
      </div>
      <p class="hud-spectre" hidden>Eres un espectro · ✦ lanza tu Lamento · un aliado a tu lado te revive</p>
      <div class="hud-result" hidden>
        <div class="hud-result-card">
          <h2></h2>
          <p class="hud-result-score"></p>
          <div class="hud-result-actions">
            <button type="button" class="primary rematch">Revancha</button>
            <button type="button" class="secondary to-menu">Menú</button>
          </div>
        </div>
      </div>`;
    parent.append(this.root);
    this.playerFill = query(this.root, '.hud-fill');
    this.playerLives = query(this.root, '.hud-lives');
    this.allies = query(this.root, '.hud-allies');
    this.roundLabel = query(this.root, '.hud-round-label');
    this.clock = query(this.root, '.hud-clock');
    this.phase = query(this.root, '.hud-phase');
    this.score = query(this.root, '.hud-score');
    this.banner = query(this.root, '.hud-banner');
    this.bannerTitle = query(this.root, '.hud-banner-title');
    this.bannerSubtitle = query(this.root, '.hud-banner-subtitle');
    this.spectreHint = query(this.root, '.hud-spectre');
    this.result = query(this.root, '.hud-result');
    this.resultTitle = query(this.root, '.hud-result h2');
    this.resultScore = query(this.root, '.hud-result-score');
    query(this.root, '.rematch').addEventListener('click', onRematch);
    query(this.root, '.to-menu').addEventListener('click', onMenu);
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  /** Prepara la lista de aliados para una ronda nueva. */
  reset(state: MatchState, player: Wizard, badges: ReadonlyMap<number, WizardBadge>): void {
    this.allies.replaceChildren();
    this.allyRows.clear();
    for (const ally of state.wizards) {
      if (ally.team !== player.team || ally.id === player.id) continue;
      const badge = badges.get(ally.id);
      const row = el('div', 'hud-ally');
      row.append(el('span', 'hud-ally-name', badge?.name ?? ''));
      const bar = el('div', 'hud-bar small');
      bar.append(el('div', 'hud-fill'));
      row.append(bar);
      row.style.setProperty('--team', badge?.color ?? '#fff');
      this.allies.append(row);
      this.allyRows.set(ally.id, row);
    }
    this.lastScoreKey = '';
    this.lastHp = -1;
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
      this.playerFill.style.width = `${(player.hp / rules.wizard.maxHp) * 100}%`;
      this.playerFill.classList.toggle('low', player.hp < rules.wizard.maxHp * 0.3);
    }
    this.playerLives.textContent =
      state.deathRule === 'lives'
        ? '◆'.repeat(player.lives) + '◇'.repeat(Math.max(0, rules.death.lives - player.lives))
        : '';

    for (const [id, row] of this.allyRows) {
      const ally = state.wizards.find((w) => w.id === id);
      if (!ally) continue;
      const fill = query(row, '.hud-fill');
      fill.style.width = `${(ally.hp / rules.wizard.maxHp) * 100}%`;
      row.classList.toggle('down', ally.hp <= 0);
    }

    this.roundLabel.textContent = `Ronda ${roundNumber}`;
    const secondsLeft = (rules.round.durationTicks - state.tick) / TICK_RATE;
    this.clock.textContent = formatClock(secondsLeft);
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

  showResult(title: string, score: string): void {
    this.resultTitle.textContent = title;
    this.resultScore.textContent = score;
    this.result.hidden = false;
  }

  hideResult(): void {
    this.result.hidden = true;
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
