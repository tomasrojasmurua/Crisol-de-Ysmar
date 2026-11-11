import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

export type Outcome = 'win' | 'loss' | 'draw';

/** Un bando en el marcador final. */
export interface ResultTeam {
  /** "Tú", "Tu equipo", el nombre del rival o "Equipo rival". */
  readonly label: string;
  readonly color: string;
  readonly wins: number;
  readonly own: boolean;
  readonly winner: boolean;
}

export interface ResultSummary {
  readonly outcome: Outcome;
  /** Debajo del título: quién ganó, o nada si ganaste tú. */
  readonly detail: string;
  readonly teams: readonly ResultTeam[];
  readonly roundsToWin: number;
}

/** En red, cómo va la revancha (la empiezan todos los conectados). */
export interface RematchView {
  readonly asked: number;
  readonly needed: number;
  readonly mine: boolean;
}

const TITLES: Record<Outcome, string> = { win: 'Victoria', loss: 'Derrota', draw: 'Empate' };

/**
 * Emblema sobre el título: un cristal con la estrella de Lanzar, que en la victoria irradia. En la derrota el cristal está
 * trizado y sin estrella; en el empate, la estrella queda hueca.
 */
const CREST: Record<Outcome, string> = {
  win:
    '<path d="M24 4L36 20L24 44L12 20Z"/><path d="M12 20H36"/>' +
    '<path d="M24 24L26 30L32 32L26 34L24 40L22 34L16 32L22 30Z" fill="currentColor"/>' +
    '<path d="M4 14L9 16M44 14L39 16M5 27L10 26M43 27L38 26"/>',
  loss:
    '<path d="M24 4L36 20L24 44L12 20Z"/><path d="M12 20H36"/>' +
    '<path d="M27 6L22 16L27 23L21 32L24 42"/>',
  draw:
    '<path d="M24 4L36 20L24 44L12 20Z"/><path d="M12 20H36"/>' +
    '<path d="M24 24L26 30L32 32L26 34L24 40L22 34L16 32L22 30Z"/>',
};

function crest(outcome: Outcome): string {
  return (
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CREST[outcome]}</svg>`
  );
}

/**
 * La pantalla final de la serie: el resultado, el marcador de rondas con los colores de cada
 * bando y los botones. En red, Revancha no saca la pantalla: muestra a quién se espera, y
 * Menú siempre está a mano por si el otro ya se fue.
 */
export class ResultScreen {
  private readonly root: HTMLElement;
  private readonly crest: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly score: HTMLElement;
  private readonly rematchNote: HTMLElement;
  private readonly rematchButton: HTMLButtonElement;
  private readonly rematchLabel: HTMLElement;
  private readonly perf: HTMLElement;
  private rematchKey = '';

  constructor(parent: HTMLElement, onRematch: () => void, onMenu: () => void) {
    this.root = el('div', 'hud-result');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="hud-result-card">
        <div class="hud-result-crest"></div>
        <h2></h2>
        <p class="hud-result-detail"></p>
        <div class="hud-result-score"></div>
        <p class="hud-result-rematch" hidden></p>
        <div class="hud-result-actions">
          <button type="button" class="primary rematch">${MENU_ICONS.rematch}<span>Revancha</span></button>
          <button type="button" class="secondary to-menu">${MENU_ICONS.leave}<span>Menú</span></button>
        </div>
        <ul class="hud-result-perf" hidden></ul>
      </div>`;
    parent.append(this.root);
    this.crest = query(this.root, '.hud-result-crest');
    this.title = query(this.root, 'h2');
    this.detail = query(this.root, '.hud-result-detail');
    this.score = query(this.root, '.hud-result-score');
    this.rematchNote = query(this.root, '.hud-result-rematch');
    this.rematchButton = query(this.root, '.rematch');
    this.rematchLabel = query(this.rematchButton, 'span');
    this.perf = query(this.root, '.hud-result-perf');
    this.rematchButton.addEventListener('click', onRematch);
    query(this.root, '.to-menu').addEventListener('click', onMenu);
  }

  show(summary: ResultSummary): void {
    this.root.dataset.outcome = summary.outcome;
    this.crest.innerHTML = crest(summary.outcome);
    this.title.textContent = TITLES[summary.outcome];
    this.detail.textContent = summary.detail;
    this.detail.hidden = summary.detail === '';
    this.score.replaceChildren(
      ...summary.teams.map((team) => this.teamScore(team, summary.roundsToWin)),
    );
    this.setRematch(null);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.perf.hidden = true;
  }

  /** Informe de rendimiento bajo el resultado; vacío lo oculta. */
  showPerf(lines: readonly string[]): void {
    this.perf.replaceChildren(...lines.map((line) => el('li', '', line)));
    this.perf.hidden = lines.length === 0;
  }

  /** En red: a quién se espera para la revancha. `null` contra la IA. */
  setRematch(status: RematchView | null): void {
    const key = status ? `${status.asked}/${status.needed}/${status.mine}` : '';
    if (key === this.rematchKey) return;
    this.rematchKey = key;
    const waiting = status?.mine ?? false;
    this.rematchButton.disabled = waiting;
    this.rematchLabel.textContent = waiting ? 'Esperando' : 'Revancha';
    const othersAsked = status ? status.asked - (status.mine ? 1 : 0) : 0;
    this.rematchButton.classList.toggle('called', !waiting && othersAsked > 0);
    this.rematchNote.textContent = status ? rematchText(status, othersAsked) : '';
    this.rematchNote.hidden = this.rematchNote.textContent === '';
  }

  private teamScore(team: ResultTeam, roundsToWin: number): HTMLElement {
    const group = el(
      'div',
      `hud-result-team${team.own ? ' own' : ''}${team.winner ? ' winner' : ''}`,
    );
    group.style.setProperty('--team', team.color);
    const pips = el('span', 'hud-result-pips');
    for (let i = 0; i < roundsToWin; i++) {
      pips.append(el('span', `pip${i < team.wins ? ' won' : ''}`));
    }
    group.append(pips, el('span', 'hud-result-team-name', team.label));
    return group;
  }
}

function rematchText(status: RematchView, othersAsked: number): string {
  if (status.needed <= 1) return '';
  if (status.needed === 2) {
    if (status.mine) return 'Esperando a tu rival';
    return othersAsked > 0 ? 'Tu rival quiere revancha' : '';
  }
  if (status.asked === 0) return '';
  return `Revancha: ${status.asked} de ${status.needed}`;
}
