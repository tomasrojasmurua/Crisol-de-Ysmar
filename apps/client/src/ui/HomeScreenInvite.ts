import {
  carryProgressInUrl,
  clearProgressFromUrl,
  markAdded,
  shouldInvite,
  snoozeInvite,
} from '../platform/homeScreen';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

/** El botón Compartir de Safari: un cuadrado con una flecha hacia arriba. */
const SHARE_ICON =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M8 9H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2"/>' +
  '<path d="M12 15V3M8 7l4-4 4 4"/></svg>';

/**
 * En iPhone, una tarjeta discreta en el menú (bajo Sonido) invita a agregar el juego a la
 * pantalla de inicio para que Safari no borre el progreso. Al tocarla se explica cómo, y
 * mientras la explicación está abierta la dirección lleva el progreso para el ícono nuevo.
 */
export class HomeScreenInvite {
  private readonly card: HTMLButtonElement;
  private readonly sheet: HTMLElement;

  constructor(side: HTMLElement, overlayParent: HTMLElement) {
    this.card = el('button', 'menu-card menu-home');
    this.card.type = 'button';
    this.card.innerHTML = `
      ${MENU_ICONS.keep}
      <span class="menu-home-text"><strong>Guarda tu progreso</strong><span>Agrégalo a inicio</span></span>`;
    this.card.hidden = !shouldInvite(Date.now());
    this.card.addEventListener('click', () => this.open());
    side.append(this.card);

    this.sheet = el('div', 'home-invite');
    this.sheet.hidden = true;
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Agregar a la pantalla de inicio');
    this.sheet.innerHTML = `
      <div class="home-invite-card">
        <header class="home-invite-head">
          <h2>Guarda tu progreso</h2>
          <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
        </header>
        <p class="home-invite-why">Safari puede borrar tu Grimorio, tus combos y tu mago si pasas
          unos días sin jugar. Desde la pantalla de inicio quedan a salvo y el Crisol se abre a
          pantalla completa.</p>
        <ol class="home-invite-steps">
          <li><span class="home-invite-num">1</span><span>Con esta ventana abierta, toca
            <b class="home-invite-share">${SHARE_ICON}Compartir</b> en Safari (si no lo ves,
            toca primero <b>···</b>).</span></li>
          <li><span class="home-invite-num">2</span><span>Elige <b>Agregar a inicio</b>; puede
            estar más abajo en la lista.</span></li>
          <li><span class="home-invite-num">3</span><span>Juega desde el ícono nuevo: tu progreso
            de hoy se va contigo.</span></li>
        </ol>
        <div class="home-invite-actions">
          <button type="button" class="secondary home-invite-later">Ahora no</button>
          <button type="button" class="primary home-invite-done">Ya lo agregué</button>
        </div>
      </div>`;
    overlayParent.append(this.sheet);
    query(this.sheet, '.grimoire-card-close').addEventListener('click', () => this.close());
    this.sheet.addEventListener('click', (event) => {
      if (event.target === this.sheet) this.close();
    });
    query(this.sheet, '.home-invite-later').addEventListener('click', () => {
      snoozeInvite(Date.now());
      this.card.hidden = true;
      this.close();
    });
    query(this.sheet, '.home-invite-done').addEventListener('click', () => {
      markAdded();
      this.card.hidden = true;
      this.close();
    });
  }

  private open(): void {
    // Lo último guardado, justo ahora: el ícono se crea con esta dirección.
    carryProgressInUrl();
    this.sheet.hidden = false;
  }

  private close(): void {
    this.sheet.hidden = true;
    clearProgressFromUrl();
  }
}
