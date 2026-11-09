import { ELEMENTS } from '@crisol/content';
import { type ElementId, type GameRules, isElementId, type Wizard } from '@crisol/core';
import { el } from '../ui/dom';
import type { PlayerInput } from './PlayerInput';

const JOYSTICK_RADIUS = 56;
const DRAG_THRESHOLD = 22;
const KEY_ELEMENTS = ['1', '2', '3', '4', '5'] as const;

/**
 * Controles en pantalla. Pulgar izquierdo: joystick que aparece donde tocas.
 * Pulgar derecho: arco de elementos para tejer y botón central para lanzar
 * (tocar apunta solo al rival, arrastrar elige la dirección).
 * También acepta teclado para probar en computador.
 */
export class TouchControls {
  private readonly elementButtons = new Map<ElementId, HTMLButtonElement>();
  private readonly slots: HTMLElement[] = [];
  private readonly keys = new Set<string>();
  private readonly root: HTMLElement;
  private pad: HTMLElement | null = null;
  private castButton: HTMLButtonElement | null = null;
  private lastWeaveKey = '';
  /** Mientras está apagado (menú, pantalla final) no acepta teclas. */
  enabled = false;

  constructor(
    parent: HTMLElement,
    private readonly input: PlayerInput,
  ) {
    this.root = el('div', 'controls');
    parent.append(this.root);
    this.buildJoystick();
    this.buildWeavePad();
    this.bindKeyboard();
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
    this.enabled = value;
    if (!value) {
      this.input.move = { right: 0, up: 0 };
      this.input.aimPreview = null;
    }
  }

  /**
   * Refleja el estado del mago: cansancio de cada elemento y tejido actual.
   * Como espectro solo queda el botón central, que lanza el Lamento.
   */
  render(wizard: Wizard, rules: GameRules, spectre: boolean): void {
    this.pad?.classList.toggle('spectre', spectre);
    if (this.castButton) {
      const cooldown =
        spectre && wizard.fallen
          ? wizard.fallen.hauntCooldown / rules.death.spectre.hauntCooldownTicks
          : 0;
      this.castButton.style.setProperty('--fatigue', cooldown.toFixed(2));
      this.castButton.textContent = spectre ? '☾' : '✦';
    }
    for (const [element, button] of this.elementButtons) {
      const fatigue = wizard.fatigue[element] / rules.weave.fatigueTicks;
      const value = fatigue.toFixed(2);
      if (button.dataset.fatigue !== value) {
        button.dataset.fatigue = value;
        button.style.setProperty('--fatigue', value);
        button.classList.toggle('tired', fatigue > 0);
      }
    }
    const weave = wizard.channel?.weave ?? wizard.weave;
    const key = weave.join('>') + (wizard.channel ? '*' : '');
    if (key !== this.lastWeaveKey) {
      this.lastWeaveKey = key;
      this.slots.forEach((slot, i) => {
        const element = weave[i];
        slot.dataset.element = element ?? '';
        slot.classList.toggle('channeling', Boolean(wizard.channel));
      });
    }
  }

  private buildJoystick(): void {
    const zone = el('div', 'joystick-zone');
    const base = el('div', 'joystick-base');
    const knob = el('div', 'joystick-knob');
    base.append(knob);
    zone.append(base);
    this.root.append(zone);

    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;

    zone.addEventListener('pointerdown', (event) => {
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      const rect = zone.getBoundingClientRect();
      originX = event.clientX;
      originY = event.clientY;
      base.style.left = `${originX - rect.left}px`;
      base.style.top = `${originY - rect.top}px`;
      base.classList.add('active');
    });
    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      let dx = event.clientX - originX;
      let dy = event.clientY - originY;
      const len = Math.hypot(dx, dy);
      if (len > JOYSTICK_RADIUS) {
        dx = (dx / len) * JOYSTICK_RADIUS;
        dy = (dy / len) * JOYSTICK_RADIUS;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.move = { right: dx / JOYSTICK_RADIUS, up: -dy / JOYSTICK_RADIUS };
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      knob.style.transform = '';
      base.classList.remove('active');
      this.input.move = { right: 0, up: 0 };
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  }

  private buildWeavePad(): void {
    const pad = el('div', 'weave-pad');
    this.pad = pad;
    ELEMENTS.forEach((element, index) => {
      const button = el('button', 'element-button');
      button.type = 'button';
      button.dataset.element = element.id;
      button.style.setProperty('--color', element.color);
      button.style.setProperty('--index', String(index));
      button.setAttribute('aria-label', `Tejer ${element.name}`);
      button.innerHTML = `<span class="element-name">${element.name}</span>`;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.input.push({ type: 'weave', element: element.id });
        navigator.vibrate?.(8);
      });
      this.elementButtons.set(element.id, button);
      pad.append(button);
    });

    const slotRow = el('div', 'weave-slots');
    for (let i = 0; i < 3; i++) {
      const slot = el('span', 'weave-slot');
      this.slots.push(slot);
      slotRow.append(slot);
    }

    const cast = el('button', 'cast-button');
    cast.type = 'button';
    cast.setAttribute('aria-label', 'Lanzar el conjuro');
    cast.textContent = '✦';
    this.castButton = cast;
    this.bindCast(cast);

    const cancel = el('button', 'cancel-button');
    cancel.type = 'button';
    cancel.setAttribute('aria-label', 'Deshacer el tejido');
    cancel.textContent = '✕';
    cancel.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.input.push({ type: 'cancel' });
    });

    pad.append(slotRow, cast, cancel);
    this.root.append(pad);

    // Los colores de los espacios del tejido se leen de las variables de cada elemento.
    for (const element of ELEMENTS) {
      this.root.style.setProperty(`--color-${element.id}`, element.color);
    }
  }

  private bindCast(button: HTMLButtonElement): void {
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    const dragOf = (event: PointerEvent) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const len = Math.hypot(dx, dy);
      return len < DRAG_THRESHOLD ? null : { right: dx / len, up: -dy / len };
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerId = event.pointerId;
      button.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
    });
    button.addEventListener('pointermove', (event) => {
      if (event.pointerId === pointerId) this.input.aimPreview = dragOf(event);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      this.input.aimPreview = null;
      this.input.push({ type: 'cast', aim: event.type === 'pointercancel' ? null : dragOf(event) });
      navigator.vibrate?.(15);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.repeat || !this.enabled) return;
      const key = event.key.toLowerCase();
      this.keys.add(key);
      const elementIndex = KEY_ELEMENTS.indexOf(key as (typeof KEY_ELEMENTS)[number]);
      const element = ELEMENTS[elementIndex]?.id;
      if (elementIndex >= 0 && element && isElementId(element)) {
        this.input.push({ type: 'weave', element });
      } else if (key === ' ') {
        this.input.push({ type: 'cast', aim: null });
      } else if (key === 'x' || key === 'backspace') {
        this.input.push({ type: 'cancel' });
      }
      this.updateKeyboardMove();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
      this.updateKeyboardMove();
    });
  }

  private updateKeyboardMove(): void {
    const has = (...names: string[]) => names.some((name) => this.keys.has(name));
    const right = Number(has('d', 'arrowright')) - Number(has('a', 'arrowleft'));
    const up = Number(has('w', 'arrowup')) - Number(has('s', 'arrowdown'));
    const len = Math.hypot(right, up) || 1;
    this.input.move = { right: right / len, up: up / len };
  }
}
