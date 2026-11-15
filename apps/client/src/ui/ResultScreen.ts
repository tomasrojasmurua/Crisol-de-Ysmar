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
  /** Lo que dice tu maestro (sin Linaje elegido, nada). */
  readonly master?:
    | { readonly name: string; readonly line: string; readonly color: string }
    | undefined;
}

/** En red, cómo va la revancha (la empiezan todos los conectados). */
export interface RematchView {
  readonly asked: number;
  readonly needed: number;
  readonly mine: boolean;
}

/** Cómo se sintió la partida en red: lo que se elige al final (va al registro). */
export const OPINIONS = ['Fluida', 'Con tirones', 'Muy trabada'] as const;
export type Opinion = (typeof OPINIONS)[number];

/** Recibe la opinión al tocarla y, si escribe algo, el comentario aparte. */
export type OpinionSink = (opinion: Opinion | null, comment: string) => void;

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
  private readonly master: HTMLElement;
  private readonly rematchNote: HTMLElement;
  private readonly rematchButton: HTMLButtonElement;
  private readonly rematchLabel: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly opinion: HTMLElement;
  private readonly opinionOptions: HTMLElement;
  private readonly opinionMore: HTMLFormElement;
  private readonly opinionInput: HTMLInputElement;
  private readonly opinionThanks: HTMLElement;
  private opinionSink: OpinionSink | null = null;
  private chosen: Opinion | null = null;
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
        <figure class="hud-result-master" hidden>
          <blockquote></blockquote>
          <figcaption></figcaption>
        </figure>
        <p class="hud-result-rematch" hidden></p>
        <div class="hud-result-actions">
          <button type="button" class="primary rematch">${MENU_ICONS.rematch}<span>Revancha</span></button>
          <button type="button" class="secondary to-menu">${MENU_ICONS.leave}<span>Menú</span></button>
        </div>
        <div class="hud-result-opinion" hidden>
          <p class="hud-result-opinion-ask">¿Cómo se jugó?</p>
          <div class="hud-result-opinion-options"></div>
          <form class="hud-result-opinion-more" hidden>
            <input maxlength="280" enterkeyhint="send" autocomplete="off"
              placeholder="¿Qué mejorarías? (opcional)" aria-label="Qué mejorarías" />
            <button type="submit" class="secondary">Enviar</button>
          </form>
          <p class="hud-result-opinion-thanks" hidden>¡Gracias! Lo vemos para la próxima versión.</p>
        </div>
        <ul class="hud-result-perf" hidden></ul>
      </div>`;
    parent.append(this.root);
    this.crest = query(this.root, '.hud-result-crest');
    this.title = query(this.root, 'h2');
    this.detail = query(this.root, '.hud-result-detail');
    this.score = query(this.root, '.hud-result-score');
    this.master = query(this.root, '.hud-result-master');
    this.rematchNote = query(this.root, '.hud-result-rematch');
    this.rematchButton = query(this.root, '.rematch');
    this.rematchLabel = query(this.rematchButton, 'span');
    this.perf = query(this.root, '.hud-result-perf');
    this.rematchButton.addEventListener('click', onRematch);
    query(this.root, '.to-menu').addEventListener('click', onMenu);
    this.opinion = query(this.root, '.hud-result-opinion');
    this.opinionOptions = query(this.root, '.hud-result-opinion-options');
    this.opinionMore = query(this.root, '.hud-result-opinion-more') as HTMLFormElement;
    this.opinionInput = query(this.opinionMore, 'input') as HTMLInputElement;
    this.opinionThanks = query(this.root, '.hud-result-opinion-thanks');
    for (const opinion of OPINIONS) {
      const chip = el('button', 'hud-result-opinion-chip', opinion) as HTMLButtonElement;
      chip.type = 'button';
      chip.addEventListener('click', () => this.choose(opinion));
      this.opinionOptions.append(chip);
    }
    this.opinionMore.addEventListener('submit', (event) => {
      event.preventDefault();
      const comment = this.opinionInput.value.trim();
      if (comment) this.opinionSink?.(this.chosen, comment);
      this.opinionInput.blur();
      this.opinionMore.hidden = true;
      this.opinionThanks.hidden = false;
    });
    // Que las teclas del juego (1-5, espacio) no tejan mientras escribes.
    this.opinionInput.addEventListener('keydown', (event) => event.stopPropagation());
  }

  /**
   * En red: pregunta cómo se jugó. La respuesta sale al tocarla (por si cierran la app) y el
   * comentario, si lo escriben, sale aparte.
   */
  askOpinion(sink: OpinionSink): void {
    this.opinionSink = sink;
    this.chosen = null;
    for (const chip of this.opinionOptions.children) chip.classList.remove('selected');
    this.opinionInput.value = '';
    this.opinionMore.hidden = true;
    this.opinionThanks.hidden = true;
    this.opinion.hidden = false;
  }

  private choose(opinion: Opinion): void {
    if (this.chosen === opinion) return;
    this.chosen = opinion;
    for (const chip of this.opinionOptions.children)
      chip.classList.toggle('selected', chip.textContent === opinion);
    this.opinionSink?.(opinion, '');
    if (this.opinionThanks.hidden) this.opinionMore.hidden = false;
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
    const master = summary.master;
    this.master.hidden = !master;
    if (master) {
      query(this.master, 'blockquote').textContent = master.line;
      query(this.master, 'figcaption').textContent = master.name;
      this.master.style.setProperty('--master', master.color);
    }
    this.setRematch(null);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.perf.hidden = true;
    this.opinion.hidden = true;
    this.opinionSink = null;
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
