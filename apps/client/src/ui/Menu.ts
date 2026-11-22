import { BOT_LEVEL_NAMES, ELEMENTS, FEATURES, masterOf } from '@crisol/content';
import {
  BOT_LEVELS,
  type BotLevel,
  type DeathRule,
  type ElementId,
  type GameMode,
} from '@crisol/core';
import type { AudioEngine } from '../audio/AudioEngine';
import type { MatchOptions } from '../game/LocalMatch';
import type { Profile } from '../game/Profile';
import { Dropdown } from './Dropdown';
import { el, query } from './dom';
import { HomeScreenInvite } from './HomeScreenInvite';
import { elementIcon } from './icons';
import { MENU_ICONS } from './menuIcons';

interface ModeChoice {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly mode: GameMode;
}

const MODES: readonly ModeChoice[] = [
  { id: 'duel', title: 'Duelo', detail: '1 contra 1', mode: { kind: 'duel' } },
  { id: 'teams2', title: '2 contra 2', detail: 'Equipos', mode: { kind: 'teams', size: 2 } },
  { id: 'teams3', title: '3 contra 3', detail: 'Equipos', mode: { kind: 'teams', size: 3 } },
  {
    id: 'ffa3',
    title: 'Libre de 3',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 3 },
  },
  {
    id: 'ffa4',
    title: 'Libre de 4',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 4 },
  },
  {
    id: 'ffa5',
    title: 'Libre de 5',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 5 },
  },
  {
    id: 'ffa6',
    title: 'Libre de 6',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 6 },
  },
];

const ALL_DEATH_RULES: readonly { id: DeathRule; title: string; detail: string }[] = [
  { id: 'out', title: 'Fuera', detail: 'Miras a los que quedan' },
  { id: 'lives', title: 'Vidas', detail: '3 vidas por ronda' },
];
/** Qué pasa al caer. Si solo queda "fuera" (Vidas apagadas), el menú no pregunta. */
const DEATH_RULES = ALL_DEATH_RULES.filter((rule) => rule.id !== 'lives' || FEATURES.livesRule);

const STORAGE_KEY = 'crisol.menu';

/** Bajo el logo, mientras no tengas Linaje; con Linaje, habla tu maestro. */
const TAGLINE = 'Teje la magia. Lee al rival. Sobrevive al Crisol.';

/** Las tres pestañas del mockup; equipos y todos contra todos eligen además el tamaño. */
const TABS: readonly {
  readonly id: 'duel' | 'teams' | 'ffa';
  readonly title: string;
  readonly icon: string;
  readonly sizes: readonly { readonly modeId: string; readonly label: string }[];
}[] = [
  { id: 'duel', title: 'Duelo', icon: MENU_ICONS.duel, sizes: [{ modeId: 'duel', label: '' }] },
  {
    id: 'teams',
    title: 'Equipos',
    icon: MENU_ICONS.teams,
    sizes: [
      { modeId: 'teams2', label: '2 contra 2' },
      { modeId: 'teams3', label: '3 contra 3' },
    ],
  },
  {
    id: 'ffa',
    title: 'Todos contra todos',
    icon: MENU_ICONS.ffa,
    sizes: [
      { modeId: 'ffa3', label: '3 magos' },
      { modeId: 'ffa4', label: '4 magos' },
      { modeId: 'ffa5', label: '5 magos' },
      { modeId: 'ffa6', label: '6 magos' },
    ],
  },
];

type SoundChoice = 'all' | 'effects' | 'off';
const SOUND_CHOICES: readonly { id: SoundChoice; label: string; icon: string }[] = [
  { id: 'all', label: 'Música y efectos', icon: MENU_ICONS.soundAll },
  { id: 'effects', label: 'Solo efectos', icon: MENU_ICONS.soundEffects },
  { id: 'off', label: 'Silencio', icon: MENU_ICONS.soundOff },
];

/**
 * La portada: tu mago a la izquierda, el título y la elección de modo al centro, y Grimorio
 * y Sonido a la derecha, sobre el Crisol que gira de fondo. Recuerda la última elección en
 * este celular.
 */
export class Menu {
  private readonly root: HTMLElement;
  private modeId = 'duel';
  private deathRule: DeathRule = 'out';
  private botLevel: BotLevel = 'duelist';
  private affinity: ElementId | null = null;
  private readonly wizardName: HTMLElement;
  private readonly wizardAffinity: HTMLElement;
  private readonly affinityIcon: HTMLElement;
  private readonly portrait: HTMLElement;
  private readonly grimoireCount: HTMLElement;
  private readonly grimoireNew: HTMLElement;
  /** Un desplegable de tamaño por pestaña (equipos y todos contra todos). */
  private readonly sizePickers = new Map<string, Dropdown>();
  private readonly rulesBox: HTMLElement;
  private readonly rulePicker: Dropdown;
  private readonly levelPicker: Dropdown;
  private readonly tagline: HTMLElement;
  /** Tu Linaje y la última frase de su maestro, para no repetirla al volver al menú. */
  private school: ElementId | null = null;
  private campLine = -1;
  private readonly camp: HTMLElement;
  /** El Linaje cuya ilustración ya se pidió, para no pedirla de nuevo. */
  private campFor: ElementId | null = null;
  /** La columna derecha (Grimorio, Sonido…), para sumarle tarjetas desde afuera. */
  readonly side: HTMLElement;
  /** La Historia (se ve una vez elegido el Linaje). */
  private readonly storyCard: HTMLElement;
  private readonly storyState: HTMLElement;
  /** Al tocar la Historia. */
  onStory: () => void = () => {};
  /** El último tamaño elegido en cada pestaña, para volver a él. */
  private readonly lastSize = new Map<string, string>();

  constructor(
    parent: HTMLElement,
    onPlay: (options: MatchOptions) => void,
    onWardrobe: () => void,
    onGrimoire: () => void,
    onFriend: () => void,
    onTraining: () => void,
    onQuick: () => void,
    private readonly audio: AudioEngine,
    onProfile: () => void,
    /** Dice una frase de tu maestro si existe su voz (`voice.…`). */
    private readonly onVoice: (key: string) => void = () => {},
  ) {
    this.restore();
    this.root = el('div', 'menu');
    this.root.innerHTML = `
      <div class="menu-camp"></div>
      <div class="menu-veil"></div>
      <small class="menu-version"></small>
      <aside class="menu-card menu-wizard-card">
        <button type="button" class="menu-portrait" aria-label="Abrir el Vestidor"></button>
        <strong class="menu-wizard-name"></strong>
        <span class="menu-wizard-affinity"><span class="menu-affinity-icon"></span><span class="menu-affinity-text"></span></span>
        <button type="button" class="secondary menu-wizard menu-profile">${MENU_ICONS.profile}<span>Perfil</span></button>
        <button type="button" class="secondary menu-wizard menu-wardrobe">${MENU_ICONS.wardrobe}<span>Vestidor</span></button>
      </aside>
      <header class="menu-title">
        <h1><img class="menu-logo" src="/logo.webp" alt="Crisol de Ysmar" width="658" height="288" decoding="async" /></h1>
        <p class="menu-tagline">${TAGLINE}</p>
      </header>
      <section class="menu-center">
        <div class="menu-tabs" role="tablist" aria-label="Modo"></div>
        <div class="menu-options">
          <div class="menu-option menu-size"></div>
          <div class="menu-option menu-rules"><span class="menu-option-label">Al caer</span></div>
          <div class="menu-option menu-level"><span class="menu-option-label">IA</span></div>
        </div>
        <button type="button" class="primary menu-play">${MENU_ICONS.star}<span>Entrar al Crisol</span>${MENU_ICONS.star}</button>
        <div class="menu-extra">
          <button type="button" class="secondary menu-quick">${MENU_ICONS.quick}<span>Partida rápida</span></button>
          <button type="button" class="secondary menu-friend">${MENU_ICONS.friend}<span>Con amigos</span></button>
          <button type="button" class="secondary menu-training">${MENU_ICONS.training}<span>Entrenamiento</span></button>
        </div>
      </section>
      <aside class="menu-side">
        <button type="button" class="menu-card menu-grimoire menu-story" hidden>
          ${MENU_ICONS.story}
          <span class="menu-grimoire-text"><strong>Historia</strong><span class="menu-story-state"></span></span>
          ${MENU_ICONS.chevron}
        </button>
        <button type="button" class="menu-card menu-grimoire menu-book">
          ${MENU_ICONS.grimoire}
          <span class="menu-grimoire-text"><strong>Grimorio</strong><span class="menu-grimoire-count"></span></span>
          <span class="menu-grimoire-new" hidden></span>
          ${MENU_ICONS.chevron}
        </button>
        <div class="menu-card menu-sound">
          <div class="menu-sound-head">${MENU_ICONS.soundAll}<strong>Sonido</strong></div>
          <div class="menu-sound-options"></div>
        </div>
      </aside>`;
    parent.append(this.root);
    query(this.root, '.menu-version').textContent =
      typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
    this.wizardName = query(this.root, '.menu-wizard-name');
    this.wizardAffinity = query(this.root, '.menu-affinity-text');
    this.affinityIcon = query(this.root, '.menu-affinity-icon');
    this.portrait = query(this.root, '.menu-portrait');
    this.grimoireCount = query(this.root, '.menu-grimoire-count');
    this.grimoireNew = query(this.root, '.menu-grimoire-new');
    this.camp = query(this.root, '.menu-camp');
    // El mago 3D se dibuja en el lienzo, detrás del menú: la ilustración le deja una ventana.
    new ResizeObserver(() => this.fitCampWindow()).observe(this.portrait);
    window.addEventListener('resize', () => this.fitCampWindow());
    this.tagline = query(this.root, '.menu-tagline');
    // Tocar a tu maestro le saca otra frase.
    this.tagline.addEventListener('click', () => this.speak(true));
    this.side = query(this.root, '.menu-side');
    new HomeScreenInvite(this.side, this.root);
    query(this.root, '.menu-wardrobe').addEventListener('click', onWardrobe);
    query(this.root, '.menu-profile').addEventListener('click', onProfile);
    this.portrait.addEventListener('click', onWardrobe);
    query(this.root, '.menu-book').addEventListener('click', onGrimoire);
    this.storyCard = query(this.root, '.menu-story');
    this.storyState = query(this.root, '.menu-story-state');
    this.storyCard.addEventListener('click', () => this.onStory());

    const soundOptions = query(this.root, '.menu-sound-options');
    for (const choice of SOUND_CHOICES) {
      const button = el('button', 'menu-sound-option');
      button.type = 'button';
      button.dataset.id = choice.id;
      button.setAttribute('aria-label', choice.label);
      button.title = choice.label;
      button.innerHTML = choice.icon;
      button.addEventListener('click', () => {
        this.audio.muted = choice.id === 'off';
        if (choice.id !== 'off') this.audio.musicOn = choice.id === 'all';
        this.refresh();
      });
      soundOptions.append(button);
    }

    const tabs = query(this.root, '.menu-tabs');
    for (const tab of TABS) {
      const button = el('button', 'menu-tab');
      button.type = 'button';
      button.dataset.id = tab.id;
      button.setAttribute('role', 'tab');
      button.innerHTML = `${tab.icon}<span>${tab.title}</span>`;
      button.addEventListener('click', () => {
        this.modeId = this.lastSize.get(tab.id) ?? tab.sizes[0]?.modeId ?? 'duel';
        this.refresh();
      });
      tabs.append(button);
    }

    // Tamaño, regla al caer y dificultad de la IA: una sola fila de desplegables, de alto fijo,
    // para que elegir "Todos contra todos" no empuje las pestañas sobre el subtítulo.
    const center = query(this.root, '.menu-center');
    const sizeBox = query(this.root, '.menu-size');
    for (const tab of TABS) {
      if (tab.sizes.length < 2) continue;
      const picker = new Dropdown({
        title: tab.title,
        host: center,
        options: tab.sizes.map((size) => ({ id: size.modeId, label: size.label })),
        onPick: (id) => {
          this.modeId = id;
          this.refresh();
        },
      });
      sizeBox.append(picker.root);
      this.sizePickers.set(tab.id, picker);
    }
    this.rulesBox = query(this.root, '.menu-rules');
    this.rulePicker = new Dropdown({
      title: 'Al caer',
      host: center,
      options: DEATH_RULES.map((rule) => ({ id: rule.id, label: rule.title })),
      onPick: (id) => {
        const rule = DEATH_RULES.find((r) => r.id === id);
        if (rule) this.deathRule = rule.id;
        this.refresh();
      },
    });
    this.rulesBox.append(this.rulePicker.root);
    this.levelPicker = new Dropdown({
      title: 'Dificultad de la IA',
      host: center,
      options: BOT_LEVELS.map((level) => ({ id: level, label: BOT_LEVEL_NAMES[level] })),
      onPick: (id) => {
        const level = BOT_LEVELS.find((l) => l === id);
        if (level) this.botLevel = level;
        this.refresh();
      },
    });
    query(this.root, '.menu-level').append(this.levelPicker.root);
    query(this.root, '.menu-friend').addEventListener('click', onFriend);
    query(this.root, '.menu-quick').addEventListener('click', onQuick);
    query(this.root, '.menu-training').addEventListener('click', onTraining);
    query(this.root, '.menu-play').addEventListener('click', () => {
      this.save();
      onPlay(this.options);
    });
    this.refresh();
  }

  get options(): MatchOptions {
    const choice = MODES.find((m) => m.id === this.modeId) ?? MODES[0];
    const mode = choice?.mode ?? { kind: 'duel' };
    return {
      mode,
      // En el 1v1 no hay Vidas: el mejor de 3 ya es la segunda oportunidad.
      deathRule: mode.kind === 'duel' ? 'out' : this.deathRule,
      affinity: this.affinity,
      botLevel: this.botLevel,
    };
  }

  /** Por dónde vas en la Historia ("Acto 1"); null la esconde (sin Linaje todavía). */
  setStory(state: string | null): void {
    this.storyCard.hidden = state === null;
    this.storyState.textContent = state ?? '';
  }

  /** Dónde va el mago en 3D, o null si el menú no está a la vista. */
  get portraitRect(): DOMRect | null {
    if (this.root.hidden) return null;
    return this.portrait.getBoundingClientRect();
  }

  /** Cuántas páginas nuevas del Grimorio faltan por leer (0 esconde la marca). */
  setGrimoireNew(count: number): void {
    this.grimoireNew.hidden = count === 0;
    this.grimoireNew.textContent = count > 99 ? '99+' : String(count);
    this.grimoireNew.setAttribute(
      'aria-label',
      count === 1 ? '1 página nueva' : `${count} páginas nuevas`,
    );
  }

  /** Muestra quién eres, tu Afinidad y cuánto llevas del Grimorio. */
  setIdentity(profile: Profile, known: number, total: number): void {
    this.affinity = profile.affinity;
    const element = ELEMENTS.find((e) => e.id === profile.affinity);
    this.wizardName.textContent = profile.name || 'Hechicero sin nombre';
    this.wizardAffinity.textContent = element ? `Afinidad: ${element.name}` : 'Sin Afinidad';
    this.affinityIcon.innerHTML = profile.affinity ? elementIcon(profile.affinity) : '';
    this.affinityIcon.style.setProperty('--icon-color', element?.color ?? 'var(--gold)');
    this.grimoireCount.textContent = `${known} de ${total}`;
    this.school = profile.school;
    this.showCamp(profile.school);
    const linaje = ELEMENTS.find((e) => e.id === profile.school);
    if (linaje) this.root.style.setProperty('--linaje', linaje.color);
    else this.root.style.removeProperty('--linaje');
    this.speak();
  }

  /**
   * El campamento de tu Linaje: bajo el logo, tu maestro dice algo distinto cada vez que vuelves
   * al menú (o lo tocas). Sin Linaje queda el lema del juego.
   */
  private speak(aloud = false): void {
    this.tagline.classList.toggle('master', this.school !== null);
    if (!this.school) {
      this.tagline.textContent = TAGLINE;
      return;
    }
    const master = masterOf(this.school);
    const lines = master.lines.camp;
    let next = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && next === this.campLine) next = (next + 1) % lines.length;
    this.campLine = next;
    // En voz alta solo si lo tocaste: volver al menú no debería hablarte cada vez.
    if (aloud) this.onVoice(`voice.${this.school}.camp.${next}`);
    const quote = el('q', 'menu-tagline-quote', lines[next] ?? '');
    const name = el('span', 'menu-tagline-master', master.name.split(',')[0] ?? master.name);
    this.tagline.replaceChildren(quote, name);
  }

  set visible(value: boolean) {
    if (!value) Dropdown.closeAll();
    this.root.hidden = !value;
    if (value) this.fitCampWindow();
  }

  /**
   * El fondo ilustrado del campamento de tu Linaje (`public/campamento/<elemento>.webp`). Si no
   * existe, o mientras carga, se ve el Crisol 3D de siempre.
   */
  private showCamp(school: ElementId | null): void {
    if (school === this.campFor) return;
    this.campFor = school;
    this.root.classList.remove('has-camp');
    if (!school) return;
    const url = `/campamento/${school}.webp`;
    const image = new Image();
    image.onload = () => {
      if (this.campFor !== school) return;
      this.camp.style.backgroundImage = `url("${url}")`;
      this.root.classList.add('has-camp');
      this.fitCampWindow();
    };
    image.src = url;
  }

  /** La ventana en la ilustración por donde se ve tu mago (que vive en el lienzo de atrás). */
  private fitCampWindow(): void {
    if (this.root.hidden) return;
    const root = this.root.getBoundingClientRect();
    const rect = this.portrait.getBoundingClientRect();
    const style = this.camp.style;
    style.setProperty('--portrait-x', `${rect.left - root.left}px`);
    style.setProperty('--portrait-y', `${rect.top - root.top}px`);
    style.setProperty('--portrait-w', `${rect.width}px`);
    style.setProperty('--portrait-h', `${rect.height}px`);
  }

  private refresh(): void {
    const sound: SoundChoice = this.audio.muted ? 'off' : this.audio.musicOn ? 'all' : 'effects';
    for (const button of this.root.querySelectorAll<HTMLElement>('.menu-sound-option')) {
      button.classList.toggle('selected', button.dataset.id === sound);
    }
    const tab = TABS.find((t) => t.sizes.some((size) => size.modeId === this.modeId)) ?? TABS[0];
    if (tab) this.lastSize.set(tab.id, this.modeId);
    for (const button of this.root.querySelectorAll<HTMLElement>('.menu-tab')) {
      const selected = button.dataset.id === tab?.id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    }
    // El tamaño solo se pregunta en equipos y todos contra todos.
    for (const [tabId, picker] of this.sizePickers) {
      const shown = tabId === tab?.id;
      picker.root.hidden = !shown;
      if (shown) picker.value = this.modeId;
    }
    const duel = (MODES.find((m) => m.id === this.modeId)?.mode.kind ?? 'duel') === 'duel';
    query(this.root, '.menu-size').hidden = duel;
    this.rulesBox.hidden = DEATH_RULES.length < 2 || duel;
    this.rulePicker.value = this.deathRule;
    this.levelPicker.value = this.botLevel;
  }

  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        modeId?: string;
        deathRule?: string;
        botLevel?: string;
      };
      if (MODES.some((m) => m.id === saved.modeId) && saved.modeId) this.modeId = saved.modeId;
      const rule = DEATH_RULES.find((r) => r.id === saved.deathRule);
      if (rule) this.deathRule = rule.id;
      const level = BOT_LEVELS.find((l) => l === saved.botLevel);
      if (level) this.botLevel = level;
    } catch {
      // Sin almacenamiento (modo privado): se usan los valores por defecto.
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ modeId: this.modeId, deathRule: this.deathRule, botLevel: this.botLevel }),
      );
    } catch {
      // No es grave: solo se pierde el recuerdo de la elección.
    }
  }
}
