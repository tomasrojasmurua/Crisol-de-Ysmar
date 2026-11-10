import type { AudioEngine } from '../audio/AudioEngine';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

type SoundChoice = 'all' | 'effects' | 'off';
const SOUND_CHOICES: readonly { id: SoundChoice; label: string; icon: string }[] = [
  { id: 'all', label: 'Música y efectos', icon: MENU_ICONS.soundAll },
  { id: 'effects', label: 'Solo efectos', icon: MENU_ICONS.soundEffects },
  { id: 'off', label: 'Silencio', icon: MENU_ICONS.soundOff },
];

/**
 * Pausa: un botón chico arriba a la derecha y una ventana con Continuar, ajustes (sonido y
 * datos de rendimiento) y volver al menú. Contra la IA la partida se detiene de verdad; en
 * red sigue corriendo (el servidor no espera a nadie) y la ventana lo avisa.
 */
export class PauseMenu {
  private readonly button: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly onlineNote: HTMLElement;
  private readonly diagnosticsToggle: HTMLInputElement;
  private online = false;

  constructor(
    parent: HTMLElement,
    private readonly audio: AudioEngine,
    private readonly handlers: {
      readonly onPause: (paused: boolean) => void;
      readonly onMenu: () => void;
      readonly onDiagnostics: (on: boolean) => void;
    },
    diagnostics: boolean,
  ) {
    this.button = el('button', 'pause-button') as HTMLButtonElement;
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'Pausa');
    this.button.innerHTML = MENU_ICONS.pause;
    this.button.hidden = true;
    this.button.addEventListener('click', () => this.open());

    this.overlay = el('div', 'pause');
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <div class="pause-panel">
        <h2>Pausa</h2>
        <p class="pause-note" hidden>En línea la partida sigue mientras estás aquí.</p>
        <button type="button" class="primary pause-resume">Continuar</button>
        <div class="pause-settings">
          <span class="pause-label">Sonido</span>
          <div class="menu-sound-options pause-sound"></div>
          <label class="pause-toggle">
            <input type="checkbox" class="pause-diagnostics" />
            <span>Mostrar datos de rendimiento <small>(FPS y conexión)</small></span>
          </label>
        </div>
        <button type="button" class="secondary pause-menu">${MENU_ICONS.leave}<span>Salir al menú principal</span></button>
      </div>`;
    parent.append(this.button, this.overlay);
    this.onlineNote = query(this.overlay, '.pause-note');
    this.diagnosticsToggle = query(this.overlay, '.pause-diagnostics') as HTMLInputElement;
    this.diagnosticsToggle.checked = diagnostics;
    this.diagnosticsToggle.addEventListener('change', () =>
      this.handlers.onDiagnostics(this.diagnosticsToggle.checked),
    );

    const sound = query(this.overlay, '.pause-sound');
    for (const choice of SOUND_CHOICES) {
      const option = el('button', 'menu-sound-option');
      option.type = 'button';
      option.dataset.id = choice.id;
      option.setAttribute('aria-label', choice.label);
      option.title = choice.label;
      option.innerHTML = choice.icon;
      option.addEventListener('click', () => {
        this.audio.muted = choice.id === 'off';
        if (choice.id !== 'off') this.audio.musicOn = choice.id === 'all';
        this.refreshSound();
      });
      sound.append(option);
    }
    query(this.overlay, '.pause-resume').addEventListener('click', () => this.close());
    query(this.overlay, '.pause-menu').addEventListener('click', () => {
      this.close();
      this.handlers.onMenu();
    });
  }

  /** Visible durante una partida; `online` dice si la pausa detiene o no el juego. */
  setAvailable(available: boolean, online: boolean): void {
    this.button.hidden = !available;
    this.online = online;
    if (!available && this.isOpen) this.close();
  }

  set training(value: boolean) {
    this.button.classList.toggle('training', value);
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(): void {
    if (this.isOpen || this.button.hidden) return;
    this.onlineNote.hidden = !this.online;
    this.refreshSound();
    this.overlay.hidden = false;
    this.handlers.onPause(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.overlay.hidden = true;
    this.handlers.onPause(false);
  }

  private refreshSound(): void {
    const current: SoundChoice = this.audio.muted ? 'off' : this.audio.musicOn ? 'all' : 'effects';
    for (const option of this.overlay.querySelectorAll<HTMLElement>('.menu-sound-option')) {
      option.classList.toggle('selected', option.dataset.id === current);
    }
  }
}
