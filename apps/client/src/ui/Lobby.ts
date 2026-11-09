import { isValidRoomCode, type PlayerInfo, ROOM_CODE_LENGTH } from '@crisol/protocol';
import { el, query } from './dom';

/**
 * Jugar con un amigo: creas una sala y lo invitas por WhatsApp, o entras con su código.
 * Mientras esperas, muestra el código grande para dictarlo.
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
  private link = '';

  constructor(
    parent: HTMLElement,
    private readonly onCreate: () => void,
    private readonly onJoin: (code: string) => void,
    private readonly onCancel: () => void,
  ) {
    this.root = el('div', 'lobby');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="lobby-panel">
        <h2>Jugar con un amigo</h2>
        <div class="lobby-choose">
          <p class="lobby-hint">Un duelo 1 contra 1, al mejor de 3 rondas.</p>
          <button type="button" class="primary lobby-create">Crear sala</button>
          <div class="lobby-join">
            <input class="lobby-code-input" maxlength="${ROOM_CODE_LENGTH}" autocapitalize="characters"
              autocomplete="off" spellcheck="false" placeholder="CÓDIGO" aria-label="Código de la sala" />
            <button type="button" class="secondary lobby-join-button">Unirme</button>
          </div>
          <p class="lobby-error" hidden></p>
        </div>
        <div class="lobby-waiting" hidden>
          <p class="lobby-hint">Código de la sala</p>
          <p class="lobby-code"></p>
          <a class="primary lobby-share" target="_blank" rel="noopener">Invitar por WhatsApp</a>
          <button type="button" class="secondary lobby-copy">Copiar enlace</button>
          <p class="lobby-status">Conectando…</p>
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

  /** La pantalla para crear o unirse. */
  showChoice(): void {
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
    const text = `¡Te desafío a un duelo en el Crisol de Ysmar! Entra aquí: ${this.link}`;
    this.share.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    this.copy.textContent = 'Copiar enlace';
    this.status.textContent = 'Conectando…';
  }

  /** Quiénes están en la sala. */
  setPlayers(players: readonly PlayerInfo[], me: number): void {
    const other = players.find((p) => p.id !== me);
    this.status.textContent = other
      ? `${other.name} entró: ¡empieza el duelo!`
      : 'Esperando a tu amigo…';
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
