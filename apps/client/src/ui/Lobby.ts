import { type GameMode, playerCount } from '@crisol/core';
import {
  BEST_OF,
  isValidRoomCode,
  type PlayerInfo,
  ROOM_CODE_LENGTH,
  ROOM_MODES,
  ROUND_MINUTES,
  type RoomSettings,
  sameMode,
} from '@crisol/protocol';
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
      return `Libre de ${mode.players}`;
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

/** Una fila de ajustes: su título y sus opciones. */
interface SettingRow {
  readonly title: string;
  readonly options: readonly {
    readonly label: string;
    readonly pick: (s: RoomSettings) => RoomSettings;
    readonly chosen: (s: RoomSettings) => boolean;
    /** Si no se puede elegir con la gente que ya está (un modo con menos puestos). */
    readonly fits?: (people: number) => boolean;
  }[];
}

const SETTING_ROWS: readonly SettingRow[] = [
  {
    title: 'Modo',
    options: ROOM_MODES.map((mode) => ({
      label: modeChip(mode),
      pick: (s) => ({ ...s, mode }),
      chosen: (s) => sameMode(s.mode, mode),
      fits: (people) => playerCount(mode) >= people,
    })),
  },
  {
    title: 'Tiempo por ronda',
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
    title: 'Glifos entre rondas',
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
  private readonly settingButtons: {
    readonly button: HTMLButtonElement;
    readonly option: SettingRow['options'][number];
  }[] = [];
  private settings: RoomSettings | null = null;
  private readonly roster: HTMLElement;
  private readonly modeTitle: HTMLElement;
  private readonly beginButton: HTMLButtonElement;
  private link = '';
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
              <button type="button" class="secondary lobby-copy">${MENU_ICONS.copy}<span class="lobby-copy-text">Copiar enlace</span></button>
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
    for (const row of SETTING_ROWS) {
      const line = el('div', 'lobby-setting');
      line.append(el('span', 'lobby-setting-title', row.title));
      const chips = el('div', 'lobby-setting-options');
      for (const option of row.options) {
        const button = el('button', 'lobby-chip', option.label) as HTMLButtonElement;
        button.type = 'button';
        button.addEventListener('click', () => {
          if (this.settings) this.onSettings(option.pick(this.settings));
        });
        chips.append(button);
        this.settingButtons.push({ button, option });
      }
      line.append(chips);
      settingsBox.append(line);
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
          this.copyText.textContent = 'Enlace copiado';
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
    this.root.hidden = false;
    this.choose.hidden = false;
    this.waiting.hidden = true;
    this.joinError.hidden = true;
    this.codeInput.value = recentCode;
  }

  /** Ya estás en una sala: muestra el código y cómo invitar. */
  showRoom(code: string): void {
    this.root.hidden = false;
    this.choose.hidden = true;
    this.waiting.hidden = false;
    this.codeLabel.textContent = code;
    this.link = `${location.origin}${location.pathname}?sala=${code}`;
    this.updateShare();
    this.copyText.textContent = 'Copiar enlace';
    this.status.textContent = 'Conectando…';
    this.roster.replaceChildren();
    this.modeTitle.textContent = '';
    this.beginButton.hidden = true;
    this.beginButton.disabled = false;
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
  ): void {
    const mode = settings.mode;
    this.settings = settings;
    this.modeName = modeLabel(mode);
    const host = players.find((p) => p.id === hostId);
    const isHost = me === hostId;
    for (const { button, option } of this.settingButtons) {
      button.classList.toggle('selected', option.chosen(settings));
      const fits = option.fits?.(players.length) ?? true;
      // Solo quien creó la sala cambia los ajustes; los demás los ven igual.
      button.disabled = !isHost || !fits;
      button.classList.toggle('locked', !isHost);
    }
    this.updateShare();
    const total = playerCount(mode);
    this.modeTitle.textContent = `${this.modeName} · ${players.length} de ${total}`;
    const teams = mode.kind === 'teams';
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
    this.status.textContent = text;
  }

  hide(): void {
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
