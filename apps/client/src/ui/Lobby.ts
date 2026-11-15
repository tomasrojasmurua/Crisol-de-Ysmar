import { BOT_LEVEL_NAMES } from '@crisol/content';
import { BOT_LEVELS, type GameMode, playerCount } from '@crisol/core';
import {
  BEST_OF,
  isValidRoomCode,
  livesAllowed,
  type PlayerInfo,
  ROOM_CODE_LENGTH,
  ROOM_MODES,
  ROUND_MINUTES,
  type RoomSettings,
  sameMode,
} from '@crisol/protocol';
import { Dropdown } from './Dropdown';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

/** Cómo se llama un modo en la sala de espera. */
function modeLabel(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return 'Duelo 1 contra 1';
    case 'teams':
      return `${mode.size} contra ${mode.size}`;
    case 'ffa':
      return 'Todos contra todos';
  }
}

/** Nombre corto de un modo, para los botones de la sala. */
function modeChip(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return '1 vs 1';
    case 'teams':
      return `${mode.size} vs ${mode.size}`;
    case 'ffa':
      return `Libre de ${mode.players}`;
  }
}

/** Un ajuste de la sala: su título y sus alternativas, que van en un desplegable. */
interface SettingRow {
  readonly title: string;
  readonly options: readonly {
    readonly label: string;
    readonly pick: (s: RoomSettings) => RoomSettings;
    readonly chosen: (s: RoomSettings) => boolean;
    /** Si no se puede elegir con la gente que ya está (un modo con menos puestos). */
    readonly fits?: (people: number) => boolean;
  }[];
  /** Si el ajuste se muestra con estos ajustes y esta gente (las Vidas no salen en el 1v1). */
  readonly shown?: (s: RoomSettings, people: number) => boolean;
}

const SETTING_ROWS: readonly SettingRow[] = [
  {
    // Un solo desplegable para todos los modos: el todos contra todos ya dice cuántos magos.
    title: 'Modo',
    options: ROOM_MODES.map((mode) => ({
      label: modeChip(mode),
      pick: (s: RoomSettings) => ({ ...s, mode, lives: s.lives && livesAllowed(mode) }),
      chosen: (s: RoomSettings) => sameMode(s.mode, mode),
      fits: (people: number) => playerCount(mode) >= people,
    })),
  },
  {
    title: 'La zona se cierra en',
    options: ROUND_MINUTES.map((minutes) => ({
      label: `${minutes} min`,
      pick: (s) => ({ ...s, minutes }),
      chosen: (s) => s.minutes === minutes,
    })),
  },
  {
    title: 'Rondas',
    options: BEST_OF.map((bestOf) => ({
      label: bestOf === 1 ? 'A 1' : `Mejor de ${bestOf}`,
      pick: (s) => ({ ...s, bestOf }),
      chosen: (s) => s.bestOf === bestOf,
    })),
  },
  {
    title: 'Glifos',
    options: [true, false].map((glyphs) => ({
      label: glyphs ? 'Sí' : 'No',
      pick: (s) => ({ ...s, glyphs }),
      chosen: (s) => s.glyphs === glyphs,
    })),
  },
  {
    title: 'Presagio',
    options: [true, false].map((omen) => ({
      label: omen ? 'Sí' : 'No',
      pick: (s) => ({ ...s, omen }),
      chosen: (s) => s.omen === omen,
    })),
  },
  {
    title: 'Al caer',
    options: [false, true].map((lives) => ({
      label: lives ? '3 vidas' : 'Fuera',
      pick: (s) => ({ ...s, lives }),
      chosen: (s) => s.lives === lives,
    })),
    shown: (s) => livesAllowed(s.mode),
  },
  {
    title: 'IA en puestos libres',
    options: BOT_LEVELS.map((botLevel) => ({
      label: BOT_LEVEL_NAMES[botLevel],
      pick: (s) => ({ ...s, botLevel }),
      chosen: (s) => s.botLevel === botLevel,
    })),
    // Con la sala llena no hay puestos para la IA: la fila sobra.
    shown: (s, people) => playerCount(s.mode) > people,
  },
];

/**
 * Jugar con amigos: creas una sala y los invitas por WhatsApp, o entras con su código. En la sala
 * de espera todos ven el código, quiénes están y los ajustes (modo, tiempo por ronda, rondas,
 * Glifos y Presagio). Solo quien la creó los cambia y decide cuándo empezar: la IA ocupa los
 * puestos libres.
 */
export class Lobby {
  private readonly root: HTMLElement;
  private readonly choose: HTMLElement;
  private readonly waiting: HTMLElement;
  private readonly codeLabel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly codeInput: HTMLInputElement;
  private readonly joinError: HTMLElement;
  private readonly share: HTMLAnchorElement;
  private readonly copy: HTMLButtonElement;
  private readonly copyText: HTMLElement;
  private readonly settingLines: {
    readonly line: HTMLElement;
    readonly row: SettingRow;
    readonly picker: Dropdown;
  }[] = [];
  private settings: RoomSettings | null = null;
  private readonly roster: HTMLElement;
  private readonly modeTitle: HTMLElement;
  private readonly beginButton: HTMLButtonElement;
  private link = '';
  /** Partida rápida: sala pública, sin invitar ni ajustes, que empieza sola. */
  private quick = false;
  /** Cuándo empieza sola (`performance.now()`), o null si no corre la cuenta. */
  private startsAt: number | null = null;
  private countdown: ReturnType<typeof setInterval> | null = null;
  private modeName = 'Duelo 1 contra 1';

  constructor(
    parent: HTMLElement,
    private readonly onCreate: () => void,
    private readonly onJoin: (code: string) => void,
    private readonly onCancel: () => void,
    private readonly onBegin: () => void,
    private readonly onSettings: (settings: RoomSettings) => void,
  ) {
    this.root = el('div', 'lobby');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="lobby-panel">
        <h2 class="lobby-title">Jugar con amigos</h2>
        <div class="lobby-choose">
          <p class="lobby-hint">Crea una sala e invita a tus amigos: el modo, el tiempo y las rondas se eligen adentro, a la vista de todos.</p>
          <button type="button" class="primary lobby-create">Crear sala</button>
          <div class="lobby-join">
            <input class="lobby-code-input" maxlength="${ROOM_CODE_LENGTH}" autocapitalize="characters"
              autocomplete="off" spellcheck="false" placeholder="CÓDIGO" aria-label="Código de la sala" />
            <button type="button" class="secondary lobby-join-button">Unirme</button>
          </div>
          <p class="lobby-error" hidden></p>
        </div>
        <div class="lobby-waiting" hidden>
          <div class="lobby-invite">
            <p class="lobby-code-label">Código de sala</p>
            <p class="lobby-code"></p>
            <div class="lobby-invite-buttons">
              <a class="primary lobby-share" target="_blank" rel="noopener">WhatsApp</a>
              <button type="button" class="secondary lobby-copy" aria-label="Copiar enlace">${MENU_ICONS.copy}<span class="lobby-copy-text">Copiar</span></button>
            </div>
            <p class="lobby-mode"></p>
            <ul class="lobby-roster"></ul>
            <button type="button" class="secondary lobby-leave">${MENU_ICONS.leave}<span>Salir de la sala</span></button>
          </div>
          <div class="lobby-people">
            <div class="lobby-settings"></div>
            <p class="lobby-status">Conectando…</p>
            <button type="button" class="primary lobby-begin" hidden>Empezar</button>
          </div>
        </div>
        <button type="button" class="secondary lobby-cancel">${MENU_ICONS.back}<span>Volver</span></button>
      </div>`;
    parent.append(this.root);
    this.choose = query(this.root, '.lobby-choose');
    this.waiting = query(this.root, '.lobby-waiting');
    this.codeLabel = query(this.root, '.lobby-code');
    this.status = query(this.root, '.lobby-status');
    this.codeInput = query(this.root, '.lobby-code-input') as HTMLInputElement;
    this.joinError = query(this.root, '.lobby-error');
    this.share = query(this.root, '.lobby-share') as HTMLAnchorElement;
    this.copy = query(this.root, '.lobby-copy') as HTMLButtonElement;
    this.copyText = query(this.root, '.lobby-copy-text');
    this.roster = query(this.root, '.lobby-roster');
    this.modeTitle = query(this.root, '.lobby-mode');
    this.beginButton = query(this.root, '.lobby-begin') as HTMLButtonElement;
    this.beginButton.addEventListener('click', () => {
      this.beginButton.disabled = true;
      this.onBegin();
    });
    const settingsBox = query(this.root, '.lobby-settings');
    const panel = query(this.root, '.lobby-panel');
    for (const row of SETTING_ROWS) {
      const line = el('div', 'lobby-setting');
      line.append(el('span', 'lobby-setting-title', row.title));
      const picker = new Dropdown({
        title: row.title,
        host: panel,
        options: row.options.map((option, index) => ({ id: String(index), label: option.label })),
        onPick: (id) => {
          const option = row.options[Number(id)];
          if (this.settings && option) this.onSettings(option.pick(this.settings));
        },
      });
      line.append(picker.root);
      settingsBox.append(line);
      this.settingLines.push({ line, row, picker });
    }

    query(this.root, '.lobby-create').addEventListener('click', () => this.onCreate());
    query(this.root, '.lobby-join-button').addEventListener('click', () => this.tryJoin());
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      this.joinError.hidden = true;
    });
    this.codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.tryJoin();
      // Que las teclas del juego (1-5, espacio) no tejan mientras escribes.
      event.stopPropagation();
    });
    this.copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.link).then(
        () => {
          this.copyText.textContent = 'Copiado';
        },
        () => {
          this.copyText.textContent = this.link;
        },
      );
    });
    query(this.root, '.lobby-cancel').addEventListener('click', () => this.onCancel());
    query(this.root, '.lobby-leave').addEventListener('click', () => this.onCancel());
  }

  /** La pantalla para crear o unirse. `recentCode`, la última sala, queda escrita para volver. */
  showChoice(recentCode = ''): void {
    this.applyQuick(false);
    this.root.hidden = false;
    this.choose.hidden = false;
    this.waiting.hidden = true;
    this.joinError.hidden = true;
    this.codeInput.value = recentCode;
  }

  /**
   * Ya estás en una sala: muestra el código y cómo invitar. En la Partida rápida (`quick`) no se
   * invita ni se eligen ajustes: se ve quién llegó y cuánto falta para empezar.
   */
  showRoom(code: string, quick = false): void {
    this.applyQuick(quick);
    this.startsAt = null;
    this.root.hidden = false;
    this.choose.hidden = true;
    this.waiting.hidden = false;
    this.codeLabel.textContent = code;
    this.link = `${location.origin}${location.pathname}?sala=${code}`;
    this.updateShare();
    this.copyText.textContent = 'Copiar';
    this.status.textContent = 'Conectando…';
    this.roster.replaceChildren();
    this.modeTitle.textContent = '';
    this.beginButton.hidden = true;
    this.beginButton.disabled = false;
  }

  /** La Partida rápida no invita ni deja elegir ajustes: solo quién llegó y cuánto falta. */
  private applyQuick(quick: boolean): void {
    this.quick = quick;
    query(this.root, '.lobby-title').textContent = quick ? 'Partida rápida' : 'Jugar con amigos';
    for (const selector of ['.lobby-code-label', '.lobby-code', '.lobby-invite-buttons']) {
      query(this.root, selector).hidden = quick;
    }
    query(this.root, '.lobby-settings').hidden = quick;
  }

  private updateShare(): void {
    const text = `¡Te desafío en el Crisol de Ysmar (${this.modeName})! Entra aquí: ${this.link}`;
    this.share.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  /** Quiénes están en la sala, de qué equipo y quién puede empezar. */
  setPlayers(
    players: readonly PlayerInfo[],
    me: number,
    settings: RoomSettings,
    hostId: number,
    /** Si es una Partida rápida (la Sala lo dice: vale también al volver con `?sala=`). */
    quick = false,
    /** Partida rápida: cuándo empieza sola (`performance.now()`), o null. */
    startsAt: number | null = null,
  ): void {
    if (quick !== this.quick) this.applyQuick(quick);
    this.startsAt = startsAt;
    const mode = settings.mode;
    this.settings = settings;
    this.modeName = modeLabel(mode);
    const host = players.find((p) => p.id === hostId);
    const isHost = me === hostId;
    for (const { line, row, picker } of this.settingLines) {
      line.hidden = !(row.shown?.(settings, players.length) ?? true);
      picker.value = String(row.options.findIndex((option) => option.chosen(settings)));
      picker.setDisabled((id) => !(row.options[Number(id)]?.fits?.(players.length) ?? true));
      // Solo quien creó la sala cambia los ajustes; los demás los ven igual.
      picker.setLocked(!isHost);
    }
    this.updateShare();
    const total = playerCount(mode);
    // En la columna angosta, el todos contra todos va abreviado para no partirse en dos líneas.
    const shortName = mode.kind === 'ffa' ? 'Todos vs todos' : this.modeName;
    this.modeTitle.textContent = `${shortName} · ${players.length} de ${total}`;
    const teams = mode.kind === 'teams';
    // Con más de 3, la lista va en dos columnas para que "Salir" siga a la vista.
    this.roster.classList.toggle('many', players.length > 3);
    this.roster.replaceChildren(
      ...[...players]
        .sort((a, b) => (teams ? a.team - b.team : 0) || a.id - b.id)
        .map((p) => {
          const item = el('li', `lobby-player${p.id === me ? ' me' : ''}`);
          const tag = teams ? `Equipo ${p.team + 1}` : '';
          item.append(
            el('span', 'lobby-player-name', `${p.name}${p.id === me ? ' (tú)' : ''}`),
            el(
              'span',
              'lobby-player-tag',
              [tag, p.id === hostId ? 'Anfitrión' : '', p.connected ? '' : 'reconectando…']
                .filter(Boolean)
                .join(' · '),
            ),
          );
          item.classList.toggle('away', !p.connected);
          if (teams) item.dataset.team = String(p.team);
          return item;
        }),
    );
    const free = total - players.length;
    this.beginButton.hidden = !isHost;
    this.beginButton.disabled = false;
    this.beginButton.textContent =
      free <= 0
        ? 'Empezar'
        : free === 1
          ? 'Empezar (la IA ocupa 1 puesto)'
          : `Empezar (la IA ocupa ${free} puestos)`;
    if (this.quick) {
      // Cualquiera de los que esperan puede no querer esperar: quien llegó primero empieza ya.
      this.beginButton.textContent = 'Empezar ya';
      this.tickCountdown();
      this.countdown ??= setInterval(() => this.tickCountdown(), 250);
      return;
    }
    const who = host?.name ?? 'quien creó la sala';
    if (isHost) {
      this.status.textContent =
        free <= 0
          ? 'Sala llena. Empieza cuando quieras.'
          : `Faltan ${free}. Empieza cuando quieras.`;
    } else {
      this.status.textContent = `Esperando al anfitrión: ${who} elige los ajustes y empieza la partida.`;
    }
  }

  setStatus(text: string): void {
    this.stopCountdown();
    this.status.textContent = text;
  }

  /** Partida rápida: "Empieza en 7 s…", cada cuarto de segundo. */
  private tickCountdown(): void {
    if (this.root.hidden || !this.quick) {
      this.stopCountdown();
      return;
    }
    if (this.startsAt === null) {
      this.status.textContent = 'Buscando rivales…';
      return;
    }
    const seconds = Math.max(0, Math.ceil((this.startsAt - performance.now()) / 1000));
    this.status.textContent =
      seconds > 0 ? `Empieza en ${seconds} s. La IA ocupa los puestos libres.` : 'Empezando…';
  }

  private stopCountdown(): void {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
  }

  hide(): void {
    Dropdown.closeAll();
    this.stopCountdown();
    this.root.hidden = true;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  private tryJoin(): void {
    const code = this.codeInput.value.trim().toUpperCase();
    if (!isValidRoomCode(code)) {
      this.joinError.textContent = `El código tiene ${ROOM_CODE_LENGTH} letras o números`;
      this.joinError.hidden = false;
      return;
    }
    this.onJoin(code);
  }
}
