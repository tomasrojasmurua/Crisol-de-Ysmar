import { type GameMode, playerCount } from '@crisol/core';
import { isValidRoomCode, type PlayerInfo, ROOM_CODE_LENGTH } from '@crisol/protocol';
import { el, query } from './dom';

/** Cómo se llama un modo en la sala de espera. */
export function modeLabel(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return 'Duelo 1 contra 1';
    case 'teams':
      return `${mode.size} contra ${mode.size}`;
    case 'ffa':
      return `Libre de ${mode.players}`;
  }
}

/**
 * Jugar con amigos: creas una sala del modo elegido en el menú y los invitas por WhatsApp, o
 * entras con su código. Mientras esperas, muestra el código grande para dictarlo y quiénes
 * están; quien creó la sala puede empezar sin esperar a que se llene (la IA ocupa el resto).
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
  private readonly hint: HTMLElement;
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
  ) {
    this.root = el('div', 'lobby');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="lobby-panel">
        <h2>Jugar con amigos</h2>
        <div class="lobby-choose">
          <p class="lobby-hint lobby-choose-hint"></p>
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
            <p class="lobby-hint">Código de la sala</p>
            <p class="lobby-code"></p>
            <a class="primary lobby-share" target="_blank" rel="noopener">Invitar por WhatsApp</a>
            <button type="button" class="secondary lobby-copy">Copiar enlace</button>
          </div>
          <div class="lobby-people">
            <p class="lobby-mode"></p>
            <ul class="lobby-roster"></ul>
            <p class="lobby-status">Conectando…</p>
            <button type="button" class="primary lobby-begin" hidden>Empezar ya</button>
          </div>
        </div>
        <button type="button" class="secondary lobby-cancel">Volver</button>
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
    this.hint = query(this.root, '.lobby-choose-hint');
    this.roster = query(this.root, '.lobby-roster');
    this.modeTitle = query(this.root, '.lobby-mode');
    this.beginButton = query(this.root, '.lobby-begin') as HTMLButtonElement;
    this.beginButton.addEventListener('click', () => {
      this.beginButton.disabled = true;
      this.onBegin();
    });

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
          this.copy.textContent = 'Enlace copiado';
        },
        () => {
          this.copy.textContent = this.link;
        },
      );
    });
    query(this.root, '.lobby-cancel').addEventListener('click', () => this.onCancel());
  }

  /** La pantalla para crear o unirse. `mode` es el que está elegido en el menú. */
  showChoice(mode: GameMode): void {
    this.hint.textContent = `Creas una sala de ${modeLabel(mode)} (cámbialo en el menú). Si entras con un código, juegas el modo de esa sala.`;
    this.root.hidden = false;
    this.choose.hidden = false;
    this.waiting.hidden = true;
    this.joinError.hidden = true;
    this.codeInput.value = '';
  }

  /** Ya estás en una sala: muestra el código y cómo invitar. */
  showRoom(code: string): void {
    this.root.hidden = false;
    this.choose.hidden = true;
    this.waiting.hidden = false;
    this.codeLabel.textContent = code;
    this.link = `${location.origin}${location.pathname}?sala=${code}`;
    this.updateShare();
    this.copy.textContent = 'Copiar enlace';
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
  setPlayers(players: readonly PlayerInfo[], me: number, mode: GameMode, hostId: number): void {
    this.modeName = modeLabel(mode);
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
              [tag, p.id === hostId ? 'crea la sala' : ''].filter(Boolean).join(' · '),
            ),
          );
          if (teams) item.dataset.team = String(p.team);
          return item;
        }),
    );
    const free = total - players.length;
    const host = players.find((p) => p.id === hostId);
    const isHost = me === hostId;
    this.beginButton.hidden = !isHost || free <= 0;
    this.beginButton.textContent =
      free === 1 ? 'Empezar ya (la IA ocupa 1 puesto)' : `Empezar ya (la IA ocupa ${free} puestos)`;
    if (free <= 0) this.status.textContent = '¡Sala llena: empieza la partida!';
    else if (mode.kind === 'duel' && players.length === 1)
      this.status.textContent = 'Esperando a tu amigo…';
    else if (isHost) this.status.textContent = `Faltan ${free}. Empieza cuando quieras.`;
    else
      this.status.textContent = `Faltan ${free}. Esperando a que ${host?.name ?? 'quien creó la sala'} empiece.`;
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
