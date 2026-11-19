import { BOT_LEVEL_NAMES, type StoryFight, type StoryLine, type StoryScene } from '@crisol/content';
import type { GameMode } from '@crisol/core';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

/** Cuántas líneas quedan a la vista: las de más arriba se van apagando. */
const VISIBLE_LINES = 4;

/** Las ilustraciones y retratos de la Historia: se piden recién al verlos, nunca en combate. */
const backdropUrl = (name: string): string => `/historia/escenas/${name}.webp`;
const portraitUrl = (name: string): string => `/historia/retratos/${name}.webp`;

/** Lo que hace la pantalla de la Historia al terminar cada cosa. */
export interface StoryScreenActions {
  /** Terminó (o se saltó) la escena. */
  readonly sceneDone: () => void;
  /** Tocó "Al combate". */
  readonly fight: (fight: StoryFight) => void;
  /** Tocó "Volver a empezar" al final de lo que hay. */
  readonly restart: () => void;
  /** Cerró la Historia: vuelve al menú (el avance queda guardado). */
  readonly close: () => void;
}

function modeText(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return '1 contra 1';
    case 'teams':
      return `${mode.size} contra ${mode.size}, con un aliado`;
    case 'ffa':
      return `Todos contra todos, de ${mode.players}`;
  }
}

/**
 * La Historia a pantalla completa, sobre negro: las escenas avanzan de a una línea con cada
 * toque, y antes de cada combate hay una tarjeta con lo que viene. No corre ninguna partida
 * mientras se ve, así que no le quita nada a la fluidez del combate.
 */
export class StoryScreen {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly card: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly portrait: HTMLImageElement;
  private backdropName = '';
  private portraitName = '';
  private lines: readonly StoryLine[] = [];
  private next = 0;
  /** Un título o un murmullo: va solo, al centro, y el siguiente toque limpia la pantalla. */
  private alone = false;

  constructor(
    parent: HTMLElement,
    private readonly actions: StoryScreenActions,
  ) {
    this.root = el('div', 'story');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="story-backdrop"></div>
      <img class="story-portrait" alt="" hidden />
      <div class="story-top">
        <button type="button" class="secondary story-skip">Saltar escena</button>
        <button type="button" class="grimoire-card-close story-close" aria-label="Volver al menú">×</button>
      </div>
      <div class="story-stage" aria-live="polite"></div>
      <p class="story-hint">Toca para seguir</p>
      <div class="story-card" hidden></div>`;
    parent.append(this.root);
    this.stage = query(this.root, '.story-stage');
    this.skip = query(this.root, '.story-skip');
    this.hint = query(this.root, '.story-hint');
    this.card = query(this.root, '.story-card');
    this.backdrop = query(this.root, '.story-backdrop');
    this.portrait = query(this.root, '.story-portrait');
    this.skip.addEventListener('click', (event) => {
      event.stopPropagation();
      this.finishScene();
    });
    query(this.root, '.story-close').addEventListener('click', (event) => {
      event.stopPropagation();
      this.hide();
      this.actions.close();
    });
    this.root.addEventListener('click', () => {
      if (this.card.hidden) this.advance();
    });
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Muestra una escena desde su primera línea; con `skippable`, aparece "Saltar escena". */
  showScene(scene: StoryScene, skippable: boolean): void {
    this.open();
    this.lines = scene.lines;
    this.next = 0;
    this.alone = false;
    this.stage.replaceChildren();
    this.skip.hidden = !skippable;
    this.hint.hidden = false;
    this.setBackdrop('');
    this.setPortrait('');
    // Con retratos, el texto se corre a la derecha toda la escena (no salta de línea en línea).
    this.root.classList.toggle(
      'cast',
      scene.lines.some((line) => line.portrait),
    );
    preload(scene);
    this.advance();
  }

  /** La tarjeta antes de un combate: qué es, contra quién y cuántas continuaciones quedan. */
  showFight(fight: StoryFight, continues: number, maxContinues: number): void {
    this.open();
    this.stage.replaceChildren();
    this.skip.hidden = true;
    this.hint.hidden = true;
    const rules = [`${modeText(fight.mode)} · IA ${BOT_LEVEL_NAMES[fight.botLevel]}`];
    if (fight.foeGlyphs > 0)
      rules.push(
        fight.foeGlyphs === 1
          ? 'Tu rival empieza con un Glifo'
          : `Tu rival empieza con ${fight.foeGlyphs} Glifos`,
      );
    if (fight.omenId) rules.push('Con el Presagio de su Linaje');
    const dots = Array.from({ length: maxContinues }, (_, i) => (i < continues ? '●' : '○')).join(
      ' ',
    );
    this.card.innerHTML = `
      <span class="story-card-act">Acto ${fight.act}</span>
      <h2 class="story-card-title"></h2>
      <ul class="story-card-rules"></ul>
      <p class="story-card-continues"><span>Continuaciones</span> <strong class="story-card-dots"></strong></p>
      <button type="button" class="primary story-go">${MENU_ICONS.duel}<span>Al combate</span></button>`;
    query(this.card, '.story-card-title').textContent = `Combate ${fight.number} · ${fight.title}`;
    query(this.card, '.story-card-rules').replaceChildren(...rules.map((r) => el('li', '', r)));
    query(this.card, '.story-card-dots').textContent = dots;
    query(this.card, '.story-go').addEventListener('click', () => {
      this.hide();
      this.actions.fight(fight);
    });
    this.card.hidden = false;
  }

  /** Llegaste al final de lo que hay por ahora. */
  showEnd(): void {
    this.open();
    this.stage.replaceChildren();
    this.skip.hidden = true;
    this.hint.hidden = true;
    this.card.innerHTML = `
      <h2 class="story-card-title">La Historia sigue pronto</h2>
      <p class="story-card-note">Ya viste los actos 1 y 2. El acto 3, el Guardián y los finales llegan en la próxima versión.</p>
      <button type="button" class="secondary story-again">Volver a empezar</button>`;
    query(this.card, '.story-again').addEventListener('click', () => this.actions.restart());
    this.card.hidden = false;
  }

  private open(): void {
    this.root.hidden = false;
    this.card.hidden = true;
    this.root.classList.remove('cast', 'murmuring');
    this.setBackdrop('');
    this.setPortrait('');
  }

  /** Cambia la ilustración de fondo, con un fundido; vacío la quita. */
  private setBackdrop(name: string): void {
    if (name === this.backdropName) return;
    this.backdropName = name;
    this.backdrop.classList.remove('shown');
    if (!name) return;
    this.backdrop.style.backgroundImage = `url("${backdropUrl(name)}")`;
    // Se fuerza el dibujo sin la clase para que el fundido vuelva a empezar.
    void this.backdrop.offsetWidth;
    this.backdrop.classList.add('shown');
  }

  /** Muestra el retrato de quien habla; vacío lo esconde. */
  private setPortrait(name: string): void {
    if (name === this.portraitName) return;
    this.portraitName = name;
    this.portrait.hidden = !name;
    if (!name) return;
    this.portrait.src = portraitUrl(name);
    this.portrait.classList.remove('shown');
    void this.portrait.offsetWidth;
    this.portrait.classList.add('shown');
  }

  /** Muestra la línea siguiente; sin más líneas, termina la escena. */
  private advance(): void {
    const line = this.lines[this.next];
    if (!line) {
      this.finishScene();
      return;
    }
    this.next++;
    if (line.backdrop !== undefined) this.setBackdrop(line.backdrop);
    // El retrato se queda mientras hablas tú o se describe algo: es con quien conversas.
    if (line.portrait) this.setPortrait(line.portrait);
    this.root.classList.toggle('murmuring', line.style === 'murmur');
    const alone = line.style === 'title' || line.style === 'murmur';
    if (alone) this.setPortrait('');
    if (alone || this.alone) this.stage.replaceChildren();
    this.alone = alone;
    this.stage.classList.toggle('alone', alone);
    this.stage.append(lineElement(line));
    // Las de más arriba se apagan y, pasadas unas cuantas, se van.
    const shown = [...this.stage.children];
    shown.slice(0, -VISIBLE_LINES).forEach((old) => {
      old.remove();
    });
    const kept = shown.slice(-VISIBLE_LINES);
    kept.forEach((item, i) => {
      item.classList.toggle('past', i < kept.length - 1);
    });
  }

  private finishScene(): void {
    this.lines = [];
    this.next = 0;
    this.actions.sceneDone();
  }
}

/** Pide de antemano las imágenes de la escena, para que no aparezcan a medio cargar. */
function preload(scene: StoryScene): void {
  for (const line of scene.lines) {
    if (line.backdrop) new Image().src = backdropUrl(line.backdrop);
    if (line.portrait) new Image().src = portraitUrl(line.portrait);
  }
}

function lineElement(line: StoryLine): HTMLElement {
  const item = el('p', `story-line story-${line.style}`);
  if (line.style === 'title') {
    item.append(el('strong', 'story-title', line.text));
    if (line.who) item.append(el('span', 'story-subtitle', line.who));
    return item;
  }
  if (line.who) {
    const who = el('span', 'story-who', line.who);
    if (line.color) who.style.color = line.color;
    item.append(who);
  }
  item.append(el('span', 'story-text', line.text));
  return item;
}
