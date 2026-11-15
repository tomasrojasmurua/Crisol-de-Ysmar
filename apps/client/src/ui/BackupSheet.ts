import { formatBackupCode } from '@crisol/protocol';
import { type FoundBackup, heroName, type ProfileBackup } from '../platform/backup';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

/**
 * Tu respaldo: una tarjeta chica en el menú (bajo Sonido; sin el código a la vista, que las capturas
 * del menú se comparten) y una ventana con tu código de
 * respaldo, para copiarlo, y un campo para traer a un hechicero desde otro celular. La primera
 * vez que se abre el juego, el Vestidor ofrece lo mismo ("¿Ya tienes un hechicero?").
 */
export class BackupSheet {
  private readonly card: HTMLButtonElement;
  private readonly sheet: HTMLElement;
  private readonly own: HTMLElement;
  private readonly codeText: HTMLElement;
  private readonly status: HTMLElement;
  private readonly copy: HTMLButtonElement;
  private readonly input: HTMLInputElement;
  private readonly search: HTMLButtonElement;
  private readonly message: HTMLElement;
  private readonly confirm: HTMLElement;
  private readonly confirmText: HTMLElement;
  private found: Extract<FoundBackup, { kind: 'found' }> | null = null;

  constructor(
    side: HTMLElement,
    overlayParent: HTMLElement,
    private readonly backup: ProfileBackup,
  ) {
    this.card = el('button', 'menu-card menu-home menu-backup');
    this.card.type = 'button';
    this.card.innerHTML = `
      ${MENU_ICONS.keep}
      <span class="menu-home-text"><strong>Tu respaldo</strong><span>Ver tu código</span></span>`;
    this.card.addEventListener('click', () => this.open(false));
    side.append(this.card);

    this.sheet = el('div', 'home-invite backup-sheet');
    this.sheet.hidden = true;
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Tu respaldo');
    this.sheet.innerHTML = `
      <div class="home-invite-card backup-card">
        <header class="home-invite-head">
          <h2 class="backup-title">Tu respaldo</h2>
          <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
        </header>
        <section class="backup-own">
          <p class="home-invite-why">Tu hechicero se guarda solo en el Crisol. Con este código lo
            recuperas en otro celular o si este se borra. Guárdalo y no lo compartas.</p>
          <div class="backup-code-row">
            <strong class="backup-code"></strong>
            <button type="button" class="secondary backup-copy">Copiar</button>
          </div>
          <p class="backup-status"></p>
        </section>
        <section class="backup-restore">
          <p class="backup-restore-title">¿Vienes de otro celular? Escribe tu código:</p>
          <div class="backup-code-row">
            <input type="text" class="backup-input" maxlength="16" autocomplete="off"
              autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" />
            <button type="button" class="primary backup-search">Buscar</button>
          </div>
          <p class="backup-message" role="status"></p>
          <div class="backup-confirm" hidden>
            <p class="backup-confirm-text"></p>
            <div class="home-invite-actions">
              <button type="button" class="secondary backup-cancel">Cancelar</button>
              <button type="button" class="primary backup-adopt">Traerlo</button>
            </div>
          </div>
        </section>
      </div>`;
    overlayParent.append(this.sheet);
    this.own = query(this.sheet, '.backup-own');
    this.codeText = query(this.sheet, '.backup-code');
    this.status = query(this.sheet, '.backup-status');
    this.copy = query(this.sheet, '.backup-copy');
    this.input = query<HTMLInputElement>(this.sheet, '.backup-input');
    this.search = query(this.sheet, '.backup-search');
    this.message = query(this.sheet, '.backup-message');
    this.confirm = query(this.sheet, '.backup-confirm');
    this.confirmText = query(this.sheet, '.backup-confirm-text');

    query(this.sheet, '.grimoire-card-close').addEventListener('click', () => this.close());
    this.sheet.addEventListener('click', (event) => {
      if (event.target === this.sheet) this.close();
    });
    this.copy.addEventListener('click', () => void this.copyCode());
    this.search.addEventListener('click', () => void this.lookUp());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.lookUp();
    });
    this.input.addEventListener('input', () => this.reset());
    query(this.sheet, '.backup-cancel').addEventListener('click', () => this.reset());
    query(this.sheet, '.backup-adopt').addEventListener('click', () => this.adopt());
    backup.onChange = () => this.refresh();
    this.refresh();
  }

  /** `restoreOnly`: la primera vez, sin hechicero propio, solo se ofrece traer uno. */
  open(restoreOnly: boolean): void {
    this.own.hidden = restoreOnly;
    query(this.sheet, '.backup-title').textContent = restoreOnly
      ? 'Trae tu hechicero'
      : 'Tu respaldo';
    this.input.value = '';
    this.reset();
    this.refresh();
    this.sheet.hidden = false;
    // Si el progreso cambió hace poco, se respalda ya, para que el estado sea el de ahora.
    if (!restoreOnly) void this.backup.sync();
  }

  close(): void {
    this.sheet.hidden = true;
    this.input.blur();
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  private refresh(): void {
    const code = formatBackupCode(this.backup.code);
    this.codeText.textContent = code;
    const savedAt = this.backup.savedAt;
    this.status.textContent = savedAt
      ? `Respaldado ${describeWhen(Date.now() - savedAt)}.`
      : 'Todavía no se respalda: se hará apenas haya conexión.';
  }

  private async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(formatBackupCode(this.backup.code));
      this.copy.textContent = 'Copiado';
    } catch {
      // Sin portapapeles (algunos navegadores): se selecciona para copiarlo a mano.
      const range = document.createRange();
      range.selectNodeContents(this.codeText);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
    setTimeout(() => {
      this.copy.textContent = 'Copiar';
    }, 2000);
  }

  private reset(): void {
    this.found = null;
    this.confirm.hidden = true;
    this.message.textContent = '';
    this.search.disabled = false;
  }

  private async lookUp(): Promise<void> {
    this.reset();
    this.input.blur();
    this.search.disabled = true;
    this.message.textContent = 'Buscando…';
    const result = await this.backup.find(this.input.value);
    this.search.disabled = false;
    if (result.kind !== 'found') {
      this.message.textContent = MISSES[result.kind];
      return;
    }
    if (result.code === this.backup.code) {
      this.message.textContent = 'Ese es el código de este celular.';
      return;
    }
    this.found = result;
    this.message.textContent = '';
    const name = heroName(result.entries) || 'un hechicero sin nombre';
    this.confirmText.textContent = this.own.hidden
      ? `Encontramos a ${name}. ¿Lo traemos a este celular?`
      : `Encontramos a ${name}. Reemplazará al hechicero de este celular con su Grimorio y sus combos.`;
    this.confirm.hidden = false;
  }

  private adopt(): void {
    if (!this.found) return;
    this.backup.adopt(this.found);
    // Todo (Grimorio, perfil, tutorial…) se lee al abrir: se abre de nuevo con lo traído.
    location.reload();
  }
}

const MISSES: Record<Exclude<FoundBackup['kind'], 'found'>, string> = {
  invalid: 'Ese código no está bien escrito: son 12 letras y números, como K7QF-M9XA-2RHT.',
  missing: 'No encontramos un hechicero con ese código.',
  offline: 'No pudimos conectarnos. Revisa tu señal e inténtalo de nuevo.',
};

/** "hace un momento", "hace 5 minutos", "hace 2 horas", "hace 3 días". */
export function describeWhen(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
