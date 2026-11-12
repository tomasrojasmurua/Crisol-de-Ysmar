import { ELEMENTS, SPELL_NAMES } from '@crisol/content';
import { type ElementId, type GameRules, isElementId, type Wizard } from '@crisol/core';
import { el } from '../ui/dom';
import { CAST_ICON, DUEL_ICON, elementIcon, LAMENT_ICON, UNDO_ICON } from '../ui/icons';
import type { PlayerInput } from './PlayerInput';

/** Radio del joystick si todavía no se pudo medir en pantalla. */
const JOYSTICK_RADIUS = 56;
/** Bajo esta fracción del radio el dedo no mueve al mago: evita que tiemble al apoyar el pulgar. */
const DEAD_ZONE = 0.12;
const DRAG_THRESHOLD = 22;
/**
 * Mantener ✦ al menos este tiempo y arrastrar elige hasta dónde llega un hechizo de suelo. Un
 * toque o un arrastre rápido siguen como siempre (sobre el objetivo o lo más lejos), para no
 * frenar el combate.
 */
const HOLD_TO_PLACE_MS = 260;
/** Arrastre (en px) que lleva un hechizo de suelo hasta lo más lejos que alcanza. */
const FULL_REACH_DRAG = 120;
/** Lo que dura el destello de un botón cuando no hay un `pointerup` que lo apague. */
const PRESS_MS = 140;
const KEY_ELEMENTS = ['1', '2', '3', '4', '5'] as const;

/**
 * Controles en pantalla. Pulgar izquierdo: joystick que aparece donde tocas.
 * Pulgar derecho: arco de elementos para tejer y botón central para lanzar
 * (tocar apunta solo al rival, arrastrar elige la dirección), Deshacer y el botón de duelo.
 * También acepta teclado para probar en computador (Q es el botón de duelo).
 */
export class TouchControls {
  private readonly elementButtons = new Map<ElementId, HTMLButtonElement>();
  private readonly slots: HTMLElement[] = [];
  private readonly keys = new Set<string>();
  private readonly root: HTMLElement;
  private pad: HTMLElement | null = null;
  private castButton: HTMLButtonElement | null = null;
  private duelButton: HTMLButtonElement | null = null;
  private duelOn = false;
  /** El botón de duelo: fija al mejor puesto o pasa al siguiente rival (lo conecta main). */
  onDuelButton: () => void = () => {};
  private lastWeaveKey = '';
  /** Cuántos lugares rotó el Mal de ojo los botones de elementos (0: en su lugar). */
  private shift = 0;
  private lastHeld = '';
  private lastSpectre: boolean | null = null;
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
      this.input.reachPreview = null;
    }
  }

  /** Enciende el botón de duelo mientras la cámara está en duelo. */
  set dueling(value: boolean) {
    if (value === this.duelOn || !this.duelButton) return;
    this.duelOn = value;
    this.duelButton.classList.toggle('active', value);
    this.duelButton.setAttribute('aria-label', value ? 'Cambiar de rival' : 'Fijar un rival');
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
      if (spectre !== this.lastSpectre) {
        this.lastSpectre = spectre;
        this.castButton.innerHTML = spectre ? LAMENT_ICON : CAST_ICON;
        this.castButton.setAttribute(
          'aria-label',
          spectre ? 'Lanzar el Lamento' : 'Lanzar el conjuro',
        );
      }
      // Un hechizo copiado o robado sale en el próximo lanzamiento: se anuncia en el botón.
      const held = !spectre && wizard.held ? SPELL_NAMES[wizard.held.spell] : '';
      if (held !== this.lastHeld) {
        this.lastHeld = held;
        this.castButton.dataset.held = held;
        this.castButton.classList.toggle('held', held !== '');
        this.pad?.classList.toggle('holding', held !== '');
      }
    }
    this.applyHex(wizard.statuses.hexed?.power ?? 0);
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
      // Con algo tejido, la estrella de Lanzar se enciende: se sabe de un vistazo si hay conjuro.
      this.castButton?.classList.toggle('ready', weave.length > 0);
      this.slots.forEach((slot, i) => {
        const element = weave[i];
        if ((slot.dataset.element ?? '') !== (element ?? '')) {
          slot.dataset.element = element ?? '';
          slot.innerHTML = element ? elementIcon(element) : '';
        }
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
    let radius = JOYSTICK_RADIUS;
    let zoneLeft = 0;
    let zoneTop = 0;
    const placeBase = (): void => {
      base.style.left = `${originX - zoneLeft}px`;
      base.style.top = `${originY - zoneTop}px`;
    };

    zone.addEventListener('pointerdown', (event) => {
      if (pointerId !== null) return;
      event.preventDefault();
      pointerId = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      const rect = zone.getBoundingClientRect();
      zoneLeft = rect.left;
      zoneTop = rect.top;
      // El tamaño cambia con la pantalla (ver --stick en el CSS).
      radius = base.offsetWidth / 2 || JOYSTICK_RADIUS;
      originX = event.clientX;
      originY = event.clientY;
      placeBase();
      base.classList.add('active');
    });
    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      let dx = event.clientX - originX;
      let dy = event.clientY - originY;
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        // Si el dedo se pasa del borde, la base lo sigue: cambiar de dirección es inmediato.
        originX = event.clientX - (dx / len) * radius;
        originY = event.clientY - (dy / len) * radius;
        placeBase();
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const amount = Math.min(1, len / radius);
      const strength = amount < DEAD_ZONE ? 0 : (amount - DEAD_ZONE) / (1 - DEAD_ZONE);
      const scale = len > 0 ? strength / Math.min(len, radius) : 0;
      this.input.move = { right: dx * scale, up: -dy * scale };
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      knob.style.transform = '';
      base.classList.remove('active');
      base.style.left = '';
      base.style.top = '';
      this.input.move = { right: 0, up: 0 };
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  }

  private buildWeavePad(): void {
    const pad = el('div', 'weave-pad');
    this.pad = pad;
    pad.append(el('div', 'weave-arc'));
    ELEMENTS.forEach((element, index) => {
      const button = el('button', 'element-button');
      button.type = 'button';
      button.dataset.element = element.id;
      button.style.setProperty('--color', element.color);
      button.style.setProperty('--index', String(index));
      button.setAttribute('aria-label', `Tejer ${element.name}`);
      button.innerHTML = elementIcon(element.id);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.input.push({ type: 'weave', element: element.id });
        flash(button);
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
    cast.innerHTML = CAST_ICON;
    this.castButton = cast;
    this.bindCast(cast);

    const cancel = el('button', 'cancel-button');
    cancel.type = 'button';
    cancel.setAttribute('aria-label', 'Deshacer el tejido');
    cancel.innerHTML = UNDO_ICON;
    cancel.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.input.push({ type: 'cancel' });
      flash(cancel);
      navigator.vibrate?.(6);
    });

    const duel = el('button', 'duel-button');
    duel.type = 'button';
    duel.setAttribute('aria-label', 'Fijar un rival');
    duel.innerHTML = DUEL_ICON;
    duel.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      flash(duel);
      this.onDuelButton();
    });
    this.duelButton = duel;

    pad.append(slotRow, cast, cancel, duel);
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
    let startTime = 0;
    /** El alcance elegido, si se mantuvo lo suficiente y se arrastró. */
    const reachOf = (event: PointerEvent): number | null => {
      if (performance.now() - startTime < HOLD_TO_PLACE_MS) return null;
      const len = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (len < DRAG_THRESHOLD) return null;
      return Math.min(1, (len - DRAG_THRESHOLD) / (FULL_REACH_DRAG - DRAG_THRESHOLD));
    };
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
      startTime = performance.now();
      button.classList.add('pressed');
    });
    button.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      this.input.aimPreview = dragOf(event);
      this.input.reachPreview = reachOf(event);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      button.classList.remove('pressed');
      this.input.aimPreview = null;
      this.input.reachPreview = null;
      const cancelled = event.type === 'pointercancel';
      const aim = cancelled ? null : dragOf(event);
      const reach = cancelled || !aim ? null : reachOf(event);
      this.input.push(reach === null ? { type: 'cast', aim } : { type: 'cast', aim, reach });
      navigator.vibrate?.(15);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }

  /** Mal de ojo: los botones de elementos cambian de lugar mientras dura. */
  private applyHex(shift: number): void {
    const next = Math.round(shift) % ELEMENTS.length;
    if (next === this.shift) return;
    this.shift = next;
    this.pad?.classList.toggle('hexed', next !== 0);
    ELEMENTS.forEach((element, index) => {
      const button = this.elementButtons.get(element.id);
      button?.style.setProperty('--index', String((index + next) % ELEMENTS.length));
    });
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.repeat || !this.enabled) return;
      const key = event.key.toLowerCase();
      this.keys.add(key);
      const slot = KEY_ELEMENTS.indexOf(key as (typeof KEY_ELEMENTS)[number]);
      // Con el Mal de ojo, cada tecla teje el elemento que quedó en su lugar.
      const count = ELEMENTS.length;
      const elementIndex = slot < 0 ? -1 : (slot - this.shift + count) % count;
      const element = ELEMENTS[elementIndex]?.id;
      if (elementIndex >= 0 && element && isElementId(element)) {
        this.input.push({ type: 'weave', element });
      } else if (key === ' ') {
        this.input.push({ type: 'cast', aim: null });
      } else if (key === 'x' || key === 'backspace') {
        this.input.push({ type: 'cancel' });
      } else if (key === 'q') {
        this.onDuelButton();
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

/** Destello corto al tocar un botón: la respuesta se ve en el mismo cuadro. */
function flash(button: HTMLElement): void {
  button.classList.remove('pressed');
  void button.offsetWidth;
  button.classList.add('pressed');
  window.setTimeout(() => button.classList.remove('pressed'), PRESS_MS);
}
