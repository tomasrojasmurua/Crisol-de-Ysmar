import type { GameRules, Wizard } from '@crisol/core';
import { CAMERA_LABELS, type CameraMode } from '../camera/cameraRigs';

/** Barras de vida, botón de cámara, ayuda inicial y pantalla de resultado. */
export class Hud {
  private readonly playerBar: HTMLElement;
  private readonly rivalBar: HTMLElement;
  private readonly cameraButton: HTMLButtonElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly hint: HTMLElement;
  private lastPlayerHp = -1;
  private lastRivalHp = -1;

  constructor(
    root: HTMLElement,
    onToggleCamera: () => void,
    private readonly onRematch: () => void,
  ) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-top">
        <div class="health"><span>Tú</span><div class="bar"><div class="fill" data-who="player"></div></div></div>
        <button type="button" class="camera-button"></button>
        <div class="health rival"><span>Rival</span><div class="bar"><div class="fill" data-who="rival"></div></div></div>
      </div>
      <p class="hint">Teje con los elementos · ✦ lanza</p>
      <div class="result" hidden>
        <h2></h2>
        <button type="button" class="rematch">Revancha</button>
      </div>`,
    );
    this.playerBar = query(root, '[data-who="player"]');
    this.rivalBar = query(root, '[data-who="rival"]');
    this.cameraButton = query(root, '.camera-button');
    this.result = query(root, '.result');
    this.resultTitle = query(root, '.result h2');
    this.hint = query(root, '.hint');
    this.cameraButton.addEventListener('click', onToggleCamera);
    query(root, '.rematch').addEventListener('click', () => this.onRematch());
  }

  setCamera(mode: CameraMode): void {
    this.cameraButton.textContent = `Cámara: ${CAMERA_LABELS[mode]}`;
  }

  update(player: Wizard, rival: Wizard, rules: GameRules): void {
    if (player.hp !== this.lastPlayerHp) {
      this.lastPlayerHp = player.hp;
      this.playerBar.style.width = `${(player.hp / rules.wizard.maxHp) * 100}%`;
    }
    if (rival.hp !== this.lastRivalHp) {
      this.lastRivalHp = rival.hp;
      this.rivalBar.style.width = `${(rival.hp / rules.wizard.maxHp) * 100}%`;
    }
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }

  showResult(winnerTeam: number, playerTeam: number): void {
    this.resultTitle.textContent =
      winnerTeam === playerTeam ? 'Victoria' : winnerTeam < 0 ? 'Empate' : 'Derrota';
    this.result.hidden = false;
  }

  hideResult(): void {
    this.result.hidden = true;
  }
}

function query<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta el elemento ${selector}`);
  return element;
}
