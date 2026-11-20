import type { Weave } from '@crisol/core';
import { el, query } from './dom';
import { weaveOrbs } from './GrimoireBook';
import { type HighlightView, highlightCard } from './HighlightCard';
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

/** El cuadro de un mago en el resumen: lo que hizo en toda la partida. */
export interface ResultPlayer {
  readonly name: string;
  readonly color: string;
  readonly own: boolean;
  readonly damage: number;
  readonly knockouts: number;
  readonly falls: number;
  readonly casts: number;
  /** Su hechizo más usado, o null si no lanzó nada. */
  readonly favorite: { readonly name: string; readonly weave: Weave } | null;
  /** Quien hizo más daño en la partida. */
  readonly top: boolean;
  /**
   * Cada uno por su cuenta (1v1 y todos contra todos): sus rondas ganadas van en su cuadro, en
   * vez de un marcador aparte que no cabría con 6 magos.
   */
  readonly rounds?: { readonly wins: number; readonly winner: boolean } | undefined;
}

export interface ResultSummary {
  readonly outcome: Outcome;
  /** Debajo del título: quién ganó, o nada si ganaste tú. */
  readonly detail: string;
  readonly teams: readonly ResultTeam[];
  readonly roundsToWin: number;
  /** Un cuadro por mago, tu bando primero. Vacío, no se muestra el resumen. */
  readonly players: readonly ResultPlayer[];
  /** Lo que dice tu maestro (sin Linaje elegido, nada). */
  readonly master?:
    | { readonly name: string; readonly line: string; readonly color: string }
    | undefined;
  /**
   * Un combate de la Historia: cómo salió, bajo el título.
   * Cambia además lo que dicen Revancha y Menú.
   */
  readonly path?: ResultPath | undefined;
  /** La mejor jugada de la partida, sobre los cuadros de cada mago. */
  readonly highlight?: HighlightView | undefined;
  /** Si se puede volver a ver su repetición (un botón en la franja de la jugada). */
  readonly replay?: boolean | undefined;
}

/** Cómo salió el combate de la Historia, bajo el título. */
export interface ResultPath {
  /** "Combate 2 · La ronda". */
  readonly title: string;
  readonly passed: boolean;
  /** "ganado", "perdido"… */
  readonly status: string;
  /** Cómo sigue la historia, o cuántas continuaciones quedan. */
  readonly note: string;
  /** Lo que dice Revancha ("Seguir", "Reintentar"). */
  readonly again: string;
  /** Lo que dice Menú. */
  readonly back: string;
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
  private readonly card: HTMLElement;
  private readonly players: HTMLElement;
  private readonly highlight: HTMLElement;
  private readonly rematchNote: HTMLElement;
  private readonly rematchButton: HTMLButtonElement;
  private readonly rematchLabel: HTMLElement;
  /** Lo que dice Revancha cuando no se espera a nadie ("Seguir" en la Historia). */
  private rematchText = 'Revancha';
  private readonly menuLabel: HTMLElement;
  private readonly path: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly opinion: HTMLElement;
  private readonly opinionAsk: HTMLElement;
  private readonly opinionChange: HTMLButtonElement;
  private readonly opinionOptions: HTMLElement;
  private readonly opinionMore: HTMLFormElement;
  private readonly opinionInput: HTMLInputElement;
  private readonly opinionThanks: HTMLElement;
  private opinionSink: OpinionSink | null = null;
  private chosen: Opinion | null = null;
  private rematchKey = '';
  /** Ver la repetición otra vez (lo conecta quien arma la partida). */
  onReplay: (() => void) | null = null;

  constructor(parent: HTMLElement, onRematch: () => void, onMenu: () => void) {
    this.root = el('div', 'hud-result');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="hud-result-card">
        <div class="hud-result-main">
        <div class="hud-result-crest"></div>
        <h2></h2>
        <p class="hud-result-detail"></p>
        <p class="hud-result-path" hidden><strong></strong><span></span></p>
        <div class="hud-result-score"></div>
        <figure class="hud-result-master" hidden>
          <blockquote></blockquote>
          <figcaption></figcaption>
        </figure>
        <p class="hud-result-rematch" hidden></p>
        <div class="hud-result-actions">
          <button type="button" class="primary rematch">${MENU_ICONS.rematch}<span>Revancha</span></button>
          <button type="button" class="secondary to-menu">${MENU_ICONS.leave}<span class="to-menu-label">Menú</span></button>
        </div>
        </div>
        <div class="hud-result-side">
        <div class="hud-result-highlight"></div>
        <section class="hud-result-players" aria-label="Resumen de la partida" hidden></section>
        <div class="hud-result-opinion" hidden>
          <p class="hud-result-opinion-ask"><span>¿Cómo se jugó?</span>
            <button type="button" class="hud-result-opinion-change" hidden>Cambiar</button></p>
          <div class="hud-result-opinion-options"></div>
          <form class="hud-result-opinion-more" hidden>
            <input maxlength="280" enterkeyhint="send" autocomplete="off"
              placeholder="¿Qué fue lo mejor? ¿Qué mejorarías?" aria-label="Qué fue lo mejor y qué mejorarías" />
            <button type="submit" class="secondary">Enviar</button>
          </form>
          <p class="hud-result-opinion-thanks" hidden>¡Gracias! Lo vemos para la próxima versión.</p>
        </div>
        <ul class="hud-result-perf" hidden></ul>
        </div>
      </div>`;
    parent.append(this.root);
    this.crest = query(this.root, '.hud-result-crest');
    this.title = query(this.root, 'h2');
    this.detail = query(this.root, '.hud-result-detail');
    this.score = query(this.root, '.hud-result-score');
    this.master = query(this.root, '.hud-result-master');
    this.card = query(this.root, '.hud-result-card');
    this.players = query(this.root, '.hud-result-players');
    this.highlight = query(this.root, '.hud-result-highlight');
    this.rematchNote = query(this.root, '.hud-result-rematch');
    this.rematchButton = query(this.root, '.rematch');
    this.rematchLabel = query(this.rematchButton, 'span');
    this.menuLabel = query(this.root, '.to-menu-label');
    this.path = query(this.root, '.hud-result-path');
    this.perf = query(this.root, '.hud-result-perf');
    this.rematchButton.addEventListener('click', onRematch);
    query(this.root, '.to-menu').addEventListener('click', onMenu);
    this.opinion = query(this.root, '.hud-result-opinion');
    this.opinionAsk = query(this.root, '.hud-result-opinion-ask span');
    this.opinionChange = query(this.root, '.hud-result-opinion-change') as HTMLButtonElement;
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
      this.opinionChange.hidden = true;
      this.opinionAsk.textContent = this.chosen ? `Se jugó: ${this.chosen}` : '';
      this.opinionThanks.hidden = false;
    });
    // Volver a las tres opciones, por si tocó la que no era.
    this.opinionChange.addEventListener('click', () => this.showOptions());
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
    this.opinionThanks.hidden = true;
    this.showOptions();
    this.opinion.hidden = false;
  }

  /**
   * Las opciones y el comentario ocupan la misma fila, uno a la vez: así la pregunta cabe entera
   * bajo los cuadros en un celular en horizontal.
   */
  private showOptions(): void {
    this.opinionAsk.textContent = '¿Cómo se jugó?';
    this.opinionChange.hidden = true;
    this.opinionOptions.hidden = false;
    this.opinionMore.hidden = true;
  }

  private choose(opinion: Opinion): void {
    if (this.chosen !== opinion) {
      this.chosen = opinion;
      for (const chip of this.opinionOptions.children)
        chip.classList.toggle('selected', chip.textContent === opinion);
      this.opinionSink?.(opinion, '');
    }
    this.opinionAsk.textContent = `${opinion}. ¿Algo que mejorar?`;
    this.opinionChange.hidden = false;
    this.opinionOptions.hidden = true;
    this.opinionMore.hidden = !this.opinionThanks.hidden;
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
    this.score.hidden = summary.teams.length === 0;
    this.players.replaceChildren(
      ...summary.players.map((player) => playerCard(player, summary.roundsToWin)),
    );
    this.players.hidden = summary.players.length === 0;
    // Va con los cuadros: sin resumen (entrenamiento) no hay columna donde ponerla.
    const strip =
      summary.highlight && summary.players.length > 0
        ? highlightCard(summary.highlight, 'result-highlight')
        : null;
    if (strip && summary.replay) {
      // Un botón redondo en la esquina de la franja: así no crece y todo sigue cabiendo.
      const again = el('button', 'result-highlight-replay') as HTMLButtonElement;
      again.type = 'button';
      again.setAttribute('aria-label', 'Ver repetición');
      again.title = 'Ver repetición';
      again.innerHTML = MENU_ICONS.replay;
      again.addEventListener('click', () => this.onReplay?.());
      strip.classList.add('with-replay');
      strip.append(again);
    }
    this.highlight.replaceChildren(...(strip ? [strip] : []));
    // De a 3 por fila salvo con 2 o 4 magos (1v1 y 2v2: cada bando en su fila).
    const count = summary.players.length;
    const columns = count === 2 || count === 4 ? 2 : Math.min(3, count);
    this.players.dataset.columns = String(columns);
    // Con la jugada y dos filas de cuadros, la columna baja para no quedar bajo Pausa.
    this.card.classList.toggle('with-highlight', this.highlight.childElementCount > 0);
    this.card.classList.toggle('two-rows', count > columns);
    this.card.classList.toggle('with-players', count > 0);
    // Por equipos el marcador va además a la izquierda: en celulares bajos se aprieta esa columna.
    this.card.classList.toggle('with-teams', count > 0 && summary.teams.length > 0);
    const master = summary.master;
    this.master.hidden = !master;
    if (master) {
      query(this.master, 'blockquote').textContent = master.line;
      query(this.master, 'figcaption').textContent = master.name;
      this.master.style.setProperty('--master', master.color);
    }
    const path = summary.path;
    this.path.hidden = !path;
    if (path) {
      this.path.classList.toggle('passed', path.passed);
      query(this.path, 'strong').textContent = `${path.title} · ${path.status}`;
      query(this.path, 'span').textContent = path.note;
    }
    // En la Historia, Revancha sigue ahí mismo.
    this.rematchText = path?.again ?? 'Revancha';
    this.menuLabel.textContent = path?.back ?? 'Menú';
    this.rematchKey = '-';
    this.setRematch(null);
    this.root.hidden = false;
  }

  /** Solo lo saca de la vista (la repetición pasa por encima) o lo devuelve, tal como estaba. */
  setHidden(hidden: boolean): void {
    this.root.hidden = hidden;
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
    this.rematchLabel.textContent = waiting ? 'Esperando' : this.rematchText;
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
    group.append(roundPips(team.wins, roundsToWin), el('span', 'hud-result-team-name', team.label));
    return group;
  }
}

/** Daño con miles separados por punto, como se lee en Chile. */
const formatNumber = (value: number): string => Math.round(value).toLocaleString('es-CL');

/** Los rombos de las rondas ganadas, como en la cinta de ronda. */
function roundPips(wins: number, roundsToWin: number): HTMLElement {
  const pips = el('span', 'hud-result-pips');
  for (let i = 0; i < roundsToWin; i++) {
    pips.append(el('span', `pip${i < wins ? ' won' : ''}`));
  }
  return pips;
}

function playerCard(player: ResultPlayer, roundsToWin: number): HTMLElement {
  const winner = player.rounds?.winner ?? false;
  const card = el(
    'article',
    `hud-result-player${player.own ? ' own' : ''}${winner ? ' winner' : ''}`,
  );
  card.style.setProperty('--team', player.color);
  const head = el('header', 'hud-result-player-head');
  // Tu cuadro dice "Tú" (tu nombre ya lo conoces) y así cabe junto a tus rondas.
  head.append(el('span', 'hud-result-player-name', player.own ? 'Tú' : player.name));
  if (player.rounds) head.append(roundPips(player.rounds.wins, roundsToWin));
  const list = el('dl', 'hud-result-player-stats');
  const rows: [string, string, boolean][] = [
    ['Daño', formatNumber(player.damage), player.top],
    ['Derribos', String(player.knockouts), false],
    ['Caídas', String(player.falls), false],
    ['Hechizos', String(player.casts), false],
  ];
  for (const [label, value, best] of rows) {
    const row = el('div', best ? 'best' : '');
    row.append(el('dt', '', label), el('dd', '', value));
    list.append(row);
  }
  const favorite = el('p', 'hud-result-player-fav');
  if (player.favorite) {
    favorite.append(weaveOrbs(player.favorite.weave), el('span', '', player.favorite.name));
    favorite.title = `Su favorito: ${player.favorite.name}`;
  } else {
    favorite.append(el('span', '', 'Sin hechizos'));
  }
  card.append(head, list, favorite);
  return card;
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
