import type { Weave } from '@crisol/core';
import { comboStepsView } from './comboSteps';
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

/** Una página del Grimorio que se abre desde el resultado. */
export type ResultPage =
  | { readonly kind: 'spell'; readonly weave: Weave }
  | { readonly kind: 'combo'; readonly id: string };

/** Lo que la partida deja para tu Grimorio, en una franja que lleva a cada página. */
export interface ResultGrimoire {
  /** El hechizo con que te derribaron la última vez (y si ya lo descubriste). */
  readonly defeatedBy: { readonly weave: Weave; readonly name: string } | null;
  /** Los hechizos que descubriste en la partida, en orden. */
  readonly discovered: readonly { readonly weave: Weave; readonly name: string }[];
  /** Los combos que aparecieron en el Grimorio con esta partida. */
  readonly combos: readonly {
    readonly id: string;
    readonly name: string;
    readonly steps: Parameters<typeof comboStepsView>[0]['steps'];
  }[];
}

/** Cuántas tarjetas caben en la franja: lo demás se cuenta en un "+N". */
const GRIMOIRE_CHIPS = 2;

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
  /** Lo nuevo para tu Grimorio; sin nada que mostrar, la franja no aparece. */
  readonly grimoire?: ResultGrimoire | undefined;
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
  /**
   * En red, la revancha espera a que respondas "¿Cómo se jugó?" o la saltes: así todos la ven
   * antes de seguir jugando, sin obligar a nadie.
   */
  private opinionPending = false;
  private lastRematch: RematchView | null = null;
  private readonly opinionSkip: HTMLButtonElement;
  private readonly menuLabel: HTMLElement;
  private readonly path: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly opinion: HTMLElement;
  private readonly opinionTitle: HTMLElement;
  private readonly opinionHint: HTMLElement;
  private closeTimer: number | undefined;
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
  /** Abrir una página del Grimorio (lo conecta quien arma la partida). */
  onGrimoire: ((page: ResultPage) => void) | null = null;
  private readonly grimoire: HTMLElement;

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
        <nav class="hud-result-grimoire" aria-label="Para tu Grimorio" hidden></nav>
        <p class="hud-result-rematch" hidden></p>
        <div class="hud-result-actions">
          <button type="button" class="primary rematch">${MENU_ICONS.rematch}<span>Revancha</span></button>
          <button type="button" class="secondary to-menu">${MENU_ICONS.leave}<span class="to-menu-label">Menú</span></button>
        </div>
        </div>
        <div class="hud-result-side">
        <div class="hud-result-highlight"></div>
        <section class="hud-result-players" aria-label="Resumen de la partida" hidden></section>
        <ul class="hud-result-perf" hidden></ul>
        </div>
      </div>
      <div class="hud-result-opinion" hidden>
        <div class="hud-result-opinion-card" role="dialog" aria-label="Cómo se jugó">
          <h3 class="hud-result-opinion-title">¿Cómo se jugó?</h3>
          <p class="hud-result-opinion-hint"></p>
          <div class="hud-result-opinion-options"></div>
          <form class="hud-result-opinion-more" hidden>
            <input maxlength="280" enterkeyhint="send" autocomplete="off"
              placeholder="¿Qué fue lo mejor? ¿Qué mejorarías?" aria-label="Qué fue lo mejor y qué mejorarías" />
            <button type="submit" class="primary">Enviar</button>
          </form>
          <p class="hud-result-opinion-thanks" hidden>¡Gracias! Lo vemos para la próxima versión.</p>
          <div class="hud-result-opinion-foot">
            <button type="button" class="hud-result-opinion-change" hidden>Cambiar</button>
            <button type="button" class="hud-result-opinion-skip">Saltar</button>
          </div>
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
    this.grimoire = query(this.root, '.hud-result-grimoire');
    this.rematchButton.addEventListener('click', () => {
      if (!this.opinionPending) onRematch();
    });
    query(this.root, '.to-menu').addEventListener('click', onMenu);
    this.opinion = query(this.root, '.hud-result-opinion');
    this.opinionTitle = query(this.root, '.hud-result-opinion-title');
    this.opinionHint = query(this.root, '.hud-result-opinion-hint');
    this.opinionChange = query(this.root, '.hud-result-opinion-change') as HTMLButtonElement;
    this.opinionSkip = query(this.root, '.hud-result-opinion-skip') as HTMLButtonElement;
    this.opinionSkip.addEventListener('click', () => this.closeOpinion());
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
      this.opinionSkip.hidden = true;
      this.opinionHint.hidden = true;
      this.opinionThanks.hidden = false;
      // El "¡Gracias!" se alcanza a leer y el cuadro se va solo.
      window.clearTimeout(this.closeTimer);
      this.closeTimer = window.setTimeout(() => this.closeOpinion(), 1300);
    });
    // Volver a las tres opciones, por si tocó la que no era.
    this.opinionChange.addEventListener('click', () => this.showOptions());
    // Que las teclas del juego (1-5, espacio) no tejan mientras escribes.
    this.opinionInput.addEventListener('keydown', (event) => event.stopPropagation());
  }

  /**
   * En red: pregunta cómo se jugó, en un cuadro al centro sobre el resultado. La respuesta sale
   * al tocarla (por si cierran la app) y el comentario, si lo escriben, sale aparte. Se puede
   * saltar; mientras está abierto, la revancha espera.
   */
  askOpinion(sink: OpinionSink): void {
    this.opinionSink = sink;
    this.chosen = null;
    for (const chip of this.opinionOptions.children) chip.classList.remove('selected');
    this.opinionInput.value = '';
    this.opinionThanks.hidden = true;
    window.clearTimeout(this.closeTimer);
    this.showOptions();
    this.opinion.hidden = false;
    this.opinionPending = true;
    this.renderRematch();
  }

  /** Respondió o saltó la pregunta: el cuadro se va y la revancha queda libre. */
  private closeOpinion(): void {
    window.clearTimeout(this.closeTimer);
    this.opinionInput.blur();
    this.opinion.hidden = true;
    if (!this.opinionPending) return;
    this.opinionPending = false;
    this.renderRematch();
  }

  private showOptions(): void {
    this.opinionTitle.textContent = '¿Cómo se jugó?';
    this.opinionHint.textContent = 'Tu opinión nos ayuda a mejorar el Crisol.';
    this.opinionHint.hidden = false;
    this.opinionChange.hidden = true;
    this.opinionSkip.hidden = false;
    this.opinionSkip.textContent = 'Saltar';
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
    this.opinionTitle.textContent = `Se jugó: ${opinion}`;
    this.opinionHint.textContent = 'Si quieres, cuéntanos qué fue lo mejor y qué mejorarías.';
    this.opinionChange.hidden = false;
    this.opinionSkip.textContent = 'Listo';
    this.opinionOptions.hidden = true;
    this.opinionMore.hidden = false;
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
      ...(() => {
        const bests = matchBests(summary.players);
        return summary.players.map((player, i) =>
          playerCard(player, summary.roundsToWin, bests, i === bests.mvp),
        );
      })(),
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
    this.renderGrimoire(summary.grimoire);
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
    this.opinionPending = false;
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
    this.opinionPending = false;
    window.clearTimeout(this.closeTimer);
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
    this.lastRematch = status;
    this.renderRematch();
  }

  private renderRematch(): void {
    const status = this.lastRematch;
    const waiting = status?.mine ?? false;
    this.rematchButton.disabled = waiting;
    this.rematchLabel.textContent = waiting ? 'Esperando' : this.rematchText;
    const othersAsked = status ? status.asked - (status.mine ? 1 : 0) : 0;
    this.rematchButton.classList.toggle('called', !waiting && othersAsked > 0);
    this.rematchNote.textContent = status ? rematchText(status, othersAsked) : '';
    this.rematchNote.hidden = this.rematchNote.textContent === '';
  }

  /**
   * "Para tu Grimorio": el hechizo que te derribó, lo que descubriste y los combos nuevos. Cada
   * tarjeta abre su página; lo que no cabe se cuenta en "+N" y abre la primera de esas.
   */
  private renderGrimoire(grimoire: ResultGrimoire | undefined): void {
    const chips: { kicker: string; signs: HTMLElement; name: string; page: ResultPage }[] = [];
    if (grimoire?.defeatedBy) {
      const { weave, name } = grimoire.defeatedBy;
      chips.push({
        kicker: 'Te derribó',
        signs: weaveOrbs(weave),
        name,
        page: { kind: 'spell', weave },
      });
    }
    for (const combo of grimoire?.combos ?? []) {
      chips.push({
        kicker: 'Combo nuevo',
        signs: comboStepsView(combo),
        name: combo.name,
        page: { kind: 'combo', id: combo.id },
      });
    }
    for (const spell of grimoire?.discovered ?? []) {
      chips.push({
        kicker: 'Descubriste',
        signs: weaveOrbs(spell.weave),
        name: spell.name,
        page: { kind: 'spell', weave: spell.weave },
      });
    }
    this.grimoire.hidden = chips.length === 0;
    this.card.classList.toggle('with-grimoire', chips.length > 0);
    const shown = chips.length > GRIMOIRE_CHIPS ? chips.slice(0, GRIMOIRE_CHIPS - 1) : chips;
    const items = shown.map((chip) => {
      const button = el('button', 'hud-result-grimoire-chip') as HTMLButtonElement;
      button.type = 'button';
      button.classList.toggle('defeat', chip.kicker === 'Te derribó');
      const text = el('span', 'hud-result-grimoire-text');
      text.append(
        el('span', 'hud-result-grimoire-kicker', chip.kicker),
        el('span', 'hud-result-grimoire-name', chip.name),
      );
      button.append(chip.signs, text);
      button.addEventListener('click', () => this.onGrimoire?.(chip.page));
      return button;
    });
    const rest = chips.slice(shown.length);
    const first = rest[0];
    if (first) {
      const more = el('button', 'hud-result-grimoire-chip more') as HTMLButtonElement;
      more.type = 'button';
      more.setAttribute('aria-label', `${rest.length} más en tu Grimorio`);
      const text = el('span', 'hud-result-grimoire-text');
      text.append(
        el('span', 'hud-result-grimoire-kicker', 'Y además'),
        el('span', 'hud-result-grimoire-name', `${rest.length} más`),
      );
      more.append(text);
      more.addEventListener('click', () => this.onGrimoire?.(first.page));
      items.push(more);
    }
    const title = el('span', 'hud-result-grimoire-title');
    title.innerHTML = MENU_ICONS.grimoire;
    title.append(el('span', '', 'Para tu Grimorio'));
    this.grimoire.replaceChildren(...(chips.length > 0 ? [title, ...items] : []));
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

/** Lo mejor de la partida en cada cifra, y quién fue la figura (índice en la lista). */
interface MatchBests {
  readonly damage: number;
  readonly knockouts: number;
  /** Menos caídas; null si todos cayeron lo mismo (no destaca a nadie). */
  readonly falls: number | null;
  readonly casts: number;
  readonly mvp: number;
}

/** Peso de un derribo frente al daño para elegir la figura, como en la mejor jugada. */
const MVP_KNOCKOUT = 60;

function matchBests(players: readonly ResultPlayer[]): MatchBests {
  const max = (pick: (p: ResultPlayer) => number): number =>
    players.reduce((top, p) => Math.max(top, pick(p)), 0);
  const falls = players.map((p) => p.falls);
  const fewest = Math.min(...falls);
  let mvp = -1;
  let best = 0;
  players.forEach((p, i) => {
    const score = p.damage + MVP_KNOCKOUT * p.knockouts;
    if (score > best) {
      best = score;
      mvp = i;
    }
  });
  return {
    damage: max((p) => p.damage),
    knockouts: max((p) => p.knockouts),
    falls: players.length > 1 && fewest !== Math.max(...falls) ? fewest : null,
    casts: max((p) => p.casts),
    mvp: players.length > 1 ? mvp : -1,
  };
}

function playerCard(
  player: ResultPlayer,
  roundsToWin: number,
  bests: MatchBests,
  mvp: boolean,
): HTMLElement {
  const winner = player.rounds?.winner ?? false;
  const card = el(
    'article',
    `hud-result-player${player.own ? ' own' : ''}${winner ? ' winner' : ''}${mvp ? ' mvp' : ''}`,
  );
  card.style.setProperty('--team', player.color);
  const head = el('header', 'hud-result-player-head');
  // Tu cuadro dice "Tú" (tu nombre ya lo conoces) y así cabe junto a tus rondas.
  head.append(el('span', 'hud-result-player-name', player.own ? 'Tú' : player.name));
  if (mvp) head.append(el('span', 'hud-result-player-mvp', 'Figura'));
  if (player.rounds) head.append(roundPips(player.rounds.wins, roundsToWin));
  const list = el('dl', 'hud-result-player-stats');
  // Cada cifra que es la mejor de la partida brilla en oro (empates incluidos).
  const rows: [string, string, boolean][] = [
    ['Daño', formatNumber(player.damage), bests.damage > 0 && player.damage === bests.damage],
    [
      'Derribos',
      String(player.knockouts),
      bests.knockouts > 0 && player.knockouts === bests.knockouts,
    ],
    ['Caídas', String(player.falls), bests.falls !== null && player.falls === bests.falls],
    ['Hechizos', String(player.casts), bests.casts > 0 && player.casts === bests.casts],
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
