import {
  type ElementId,
  type EntityId,
  type GameEvent,
  isElementId,
  MAX_WEAVE_LENGTH,
  type MatchState,
  SPELL_WEAVES,
  type SpellId,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { PlayerAction } from '../input/PlayerInput';
import { AudioEngine } from './AudioEngine';
import { Music, type MusicMood } from './Music';
import { SoundBank, type SoundKey } from './SoundBank';
import { CENTER, type Placement, Synth } from './Synth';

/** A esta distancia (m) un sonido ya baja a la mitad. */
const HALF_DISTANCE = 9;
/** Más lejos que esto, no suena. */
const MAX_DISTANCE = 45;
/** El tejido de los demás suena más bajo que el tuyo: se oye, pero no tapa. */
const OTHER_WEAVE_GAIN = 0.45;
/** Golpes de este tamaño o más suenan pesados. */
const HEAVY_HIT = 14;

/**
 * El sonido de la partida: escucha los eventos del núcleo y los tejidos que se ven, y decide qué
 * suena y desde dónde. El oyente es tu mago (o a quien miras si caíste), orientado como la cámara.
 */
export class GameAudio {
  readonly engine = new AudioEngine();
  private readonly synth = new Synth(this.engine);
  private readonly bank = new SoundBank(this.engine);
  private readonly music = new Music(this.engine, this.bank);
  private listener: Vec2 = { x: 0, z: 0 };
  private right: Vec2 = { x: 1, z: 0 };
  private playerId: EntityId = -1;
  /** Largo del tejido visible de cada mago en el cuadro anterior. */
  private readonly weaveLengths = new Map<EntityId, number>();

  /** Música según el momento: portada, fase de la ronda o silencio. */
  setMood(mood: MusicMood): void {
    this.music.set(mood);
  }

  /** Dónde está el oyente y hacia dónde mira la cámara. */
  setListener(pos: Vec2, forward: Vec2, playerId: EntityId): void {
    this.listener = pos;
    this.right = { x: -forward.z, z: forward.x };
    this.playerId = playerId;
  }

  /** Al empezar una ronda: olvida los tejidos anteriores para no sonar de golpe. */
  reset(): void {
    this.weaveLengths.clear();
  }

  /**
   * Lo que tocaste: tus notas suenan en el acto, sin esperar al paso de simulación ni al
   * servidor. `wizard` es tu mago tal como se ve (con la predicción local).
   */
  playerAction(action: PlayerAction, wizard: Wizard | null): void {
    if (!wizard || wizard.hp <= 0 || wizard.fallen) return;
    const weave = wizard.weave;
    if (action.type === 'weave' && weave.length < MAX_WEAVE_LENGTH && !wizard.channel) {
      const element = action.element;
      this.sound(`note.${element}`, CENTER, () => this.synth.note(element, CENTER));
    } else if (action.type === 'cancel' && weave.length > 0) {
      this.sound('untie', CENTER, () => this.synth.untie(CENTER));
    } else if (action.type === 'cast' && weave.length > 0 && !wizard.channel) {
      this.synth.chord(weave, CENTER, weave.length === MAX_WEAVE_LENGTH);
    }
  }

  /** El tejido de los demás, que se ve: cada elemento nuevo suena con su nota, más bajo. */
  watchWeave(wizard: Wizard, pos: Vec2, hidden: boolean): void {
    if (wizard.id === this.playerId) return;
    const before = this.weaveLengths.get(wizard.id) ?? 0;
    const now = wizard.weave.length;
    this.weaveLengths.set(wizard.id, now);
    if (now <= before || hidden) return;
    const element = wizard.weave[now - 1];
    if (!element) return;
    const place = this.at(pos, OTHER_WEAVE_GAIN);
    this.sound(`note.${element}`, place, () => this.synth.note(element, place));
  }

  /** Lo que pasó en el último paso. */
  onEvents(events: readonly GameEvent[], state: MatchState): void {
    const wizardPos = (id: EntityId): Vec2 | undefined =>
      state.wizards.find((w) => w.id === id)?.pos;
    for (const event of events) {
      switch (event.type) {
        case 'cast': {
          // Tu acorde ya sonó al tocar ✦.
          if (event.wizardId === this.playerId) break;
          const pos = wizardPos(event.wizardId);
          const place = pos ? this.at(pos, 0.7) : null;
          if (place) this.synth.chord(event.weave, place, event.weave.length === MAX_WEAVE_LENGTH);
          break;
        }
        case 'release': {
          const pos = wizardPos(event.wizardId);
          const element = elementOf(event.spell);
          const place = event.wizardId === this.playerId ? CENTER : pos ? this.at(pos) : null;
          if (place) {
            this.sound(`release.${element}`, place, () => this.synth.whoosh(element, place));
          }
          break;
        }
        case 'burst': {
          const element = elementOf(event.spell);
          const place = this.at(event.pos);
          this.sound(`burst.${element}`, place, () =>
            this.synth.boom(element, place, event.radius),
          );
          break;
        }
        case 'line': {
          const mid = { x: (event.from.x + event.to.x) / 2, z: (event.from.z + event.to.z) / 2 };
          const place = this.at(mid);
          this.sound('zap', place, () => this.synth.zap(place, 1.6));
          break;
        }
        case 'chain':
        case 'zap': {
          const from = event.type === 'chain' ? event.points[0] : event.from;
          const place = from ? this.at(from) : CENTER;
          this.sound('zap', place, () => this.synth.zap(place));
          break;
        }
        case 'blink': {
          const place = event.wizardId === this.playerId ? CENTER : this.at(event.from);
          this.sound('blink', place, () => this.synth.blink(place));
          break;
        }
        case 'vine': {
          const pos = wizardPos(event.wizardId);
          const place = pos ? this.at(pos) : CENTER;
          this.sound('vine', place, () => this.synth.whoosh('raiz', place, 0.6));
          break;
        }
        case 'hit':
          this.onHit(event, wizardPos(event.targetId));
          break;
        case 'beastHit':
          if (event.sourceId === this.playerId) {
            this.sound('confirm', CENTER, () => this.synth.confirm({ gain: 0.6, pan: 0 }));
          }
          break;
        case 'blocked': {
          const place = this.at(event.pos);
          this.sound('clang', place, () => this.synth.clang(place));
          break;
        }
        case 'fizzle': {
          const pos = wizardPos(event.wizardId);
          const place = event.wizardId === this.playerId ? CENTER : pos ? this.at(pos) : null;
          if (place) this.sound('fizzle', place, () => this.synth.fizzle(place));
          break;
        }
        case 'summonGone': {
          const place = this.at(event.pos, 0.6);
          this.sound('summonGone', place, () => this.synth.fizzle(place));
          break;
        }
        case 'beastSlain': {
          const pos = state.beasts.find((b) => b.id === event.beastId)?.pos;
          const place = event.killerId === this.playerId ? CENTER : pos ? this.at(pos) : null;
          if (place) {
            this.sound('beastSlain', place, () =>
              this.synth.bell(place, event.guardian ? 196 : 392, 0.18),
            );
          }
          break;
        }
        case 'guardianAwake':
          this.sound('guardianAwake', CENTER, () => this.synth.roar({ gain: 0.8, pan: 0 }));
          break;
        case 'shrinesAppear':
          this.sound('shrinesAppear', CENTER, () => this.synth.bell(CENTER, 293.66, 0.14, 2.4));
          break;
        case 'shrineClaimed':
          this.sound('shrineClaimed', CENTER, () => this.synth.bell(CENTER, 440, 0.16, 2));
          break;
        case 'defeated': {
          const mine = event.wizardId === this.playerId;
          const pos = wizardPos(event.wizardId);
          const place = mine ? CENTER : pos ? this.at(pos, 0.9) : null;
          if (place) {
            this.sound('defeated', place, () => this.synth.gong(place, mine ? 55 : 73, 3));
          }
          break;
        }
        case 'phase':
          this.onPhase(event.phase);
          break;
        default:
          break;
      }
    }
  }

  /** Remate de la partida. */
  finish(win: boolean): void {
    this.music.set('silent');
    this.sound(win ? 'victory' : 'defeat', CENTER, () => this.synth.fanfare(win));
  }

  /** Descubriste un hechizo nuevo del Grimorio. */
  discover(): void {
    this.sound('discover', CENTER, () => this.synth.bell(CENTER, 523.25, 0.16, 2.2));
  }

  /** Un botón de la interfaz. */
  click(): void {
    this.sound('click', CENTER, () => this.synth.click());
  }

  private onPhase(phase: 'hunt' | 'convergence' | 'final'): void {
    this.music.set(phase);
    if (phase === 'convergence') {
      this.sound('phase.convergence', CENTER, () => this.synth.gong(CENTER, 98, 2.5));
    } else if (phase === 'final') {
      this.sound('phase.final', CENTER, () => this.synth.gong(CENTER, 65.4, 4));
    }
  }

  private onHit(event: Extract<GameEvent, { type: 'hit' }>, targetPos: Vec2 | undefined): void {
    const heavy = event.amount >= HEAVY_HIT;
    if (event.targetId === this.playerId) {
      this.sound(heavy ? 'hurtHeavy' : 'hurt', CENTER, () => this.synth.hurt(CENTER, heavy));
    } else if (event.sourceId === this.playerId) {
      this.sound('confirm', CENTER, () => this.synth.confirm(CENTER));
    } else if (targetPos && event.form !== 'zone') {
      const place = this.at(targetPos, 0.5);
      this.sound('hurt', place, () => this.synth.hurt(place, heavy));
    }
  }

  /** Volumen y lado de algo que pasa en `pos`, visto desde el oyente. */
  private at(pos: Vec2, gain = 1): Placement {
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const distance = Math.hypot(dx, dz);
    if (distance > MAX_DISTANCE) return { gain: 0, pan: 0 };
    const falloff = 1 / (1 + distance / HALF_DISTANCE);
    const side = distance > 0.5 ? (dx * this.right.x + dz * this.right.z) / distance : 0;
    return { gain: gain * falloff, pan: side * 0.8 };
  }

  /** El archivo de ElevenLabs si está; si no, el sintetizado. */
  private sound(key: SoundKey, place: Placement, fallback: () => void): void {
    if (!this.bank.play(key, place)) fallback();
  }
}

/** El elemento que le da color a un hechizo: el primero de su tejido. */
function elementOf(spell: SpellId): ElementId {
  const first = SPELL_WEAVES[spell]?.[0];
  return first && isElementId(first) ? first : 'brasa';
}
