import { ELEMENTS, MAP_DECOR } from '@crisol/content';
import type { GameRules, MatchState, Vec2, Wizard } from '@crisol/core';
import { el } from './dom';
import type { WizardBadge } from './Hud';

/** Lado del minimapa en píxeles de pantalla. */
const SIZE = 112;
/** Cuánto tiempo queda marcado dónde se vio a un rival por última vez, en segundos. */
const LAST_SEEN_SECONDS = 4;

const elementHex = (id: string): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

/**
 * El minimapa: la plaza, los senderos, la jungla, los campamentos y la zona. Gira con la
 * cámara, así "arriba" en el minimapa es "arriba" en el joystick. Los rivales solo aparecen
 * mientras alguien de tu equipo los ve; después queda un rastro que se apaga.
 */
export class Minimap {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement;
  private readonly lastSeen = new Map<number, { pos: Vec2; time: number }>();
  private readonly ratio = Math.min(window.devicePixelRatio || 1, 2);

  constructor(
    parent: HTMLElement,
    private rules: GameRules,
  ) {
    this.root = el('div', 'minimap');
    this.root.hidden = true;
    this.canvas = el('canvas', 'minimap-canvas');
    this.canvas.width = SIZE * this.ratio;
    this.canvas.height = SIZE * this.ratio;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Sin contexto 2D para el minimapa');
    this.ctx = ctx;
    this.root.append(this.canvas);
    parent.append(this.root);
    this.background = this.drawBackground();
  }

  /** Cambia de mapa (plaza o jungla) y vuelve a dibujar el fondo. */
  setRules(rules: GameRules): void {
    if (rules.map === this.rules.map && rules.arenaRadius === this.rules.arenaRadius) return;
    this.rules = rules;
    this.background = this.drawBackground();
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Olvida los rastros de la ronda anterior. */
  reset(): void {
    this.lastSeen.clear();
  }

  update(
    state: MatchState,
    player: Wizard,
    forward: Vec2,
    seen: ReadonlySet<number>,
    badges: ReadonlyMap<number, WizardBadge>,
    time: number,
  ): void {
    const ctx = this.ctx;
    const radius = this.rules.arenaRadius;
    const px = this.ratio;
    const half = (SIZE * px) / 2;
    const k = (half - 2 * px) / radius;
    const right = { x: -forward.z, z: forward.x };
    const unit = 1 / k; // un píxel del canvas, en metros

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE * px, SIZE * px);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - px, 0, Math.PI * 2);
    ctx.clip();
    // Del mundo a la pantalla: la cámara mira hacia arriba.
    ctx.setTransform(k * right.x, -k * forward.x, k * right.z, -k * forward.z, half, half);
    ctx.drawImage(this.background, -radius, -radius, radius * 2, radius * 2);

    // La zona segura.
    ctx.strokeStyle = 'rgba(243, 223, 176, 0.75)';
    ctx.lineWidth = 1.4 * px * unit;
    ctx.beginPath();
    ctx.arc(0, 0, state.zoneRadius, 0, Math.PI * 2);
    ctx.stroke();

    // La jungla de esta ronda: ceniza donde pasó el Incendio y árboles nuevos del Brote.
    ctx.fillStyle = 'rgba(70, 58, 50, 0.9)';
    for (const b of state.burnedTrees) {
      ctx.beginPath();
      ctx.arc(b.x, b.z, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of state.spells) {
      if (s.kind !== 'grownTree') continue;
      ctx.fillStyle = '#0c140e';
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.z, s.radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Campamentos: llenos si su bestia sigue ahí.
    for (const camp of this.rules.map.camps) {
      const alive = state.beasts.some(
        (b) => Math.hypot(b.home.x - camp.x, b.home.z - camp.z) < 3 && b.hp > 0,
      );
      ctx.globalAlpha = alive ? 0.95 : 0.35;
      ctx.fillStyle = elementHex(camp.element);
      ctx.beginPath();
      ctx.arc(camp.x, camp.z, 2.4 * px * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Bestias que salieron a perseguir a alguien.
    for (const beast of state.beasts) {
      if (beast.guardian && beast.hp > 0) {
        // El Guardián: grande y con borde dorado, siempre a la vista.
        ctx.fillStyle = elementHex(beast.element);
        this.dot(beast.pos, 3.6 * px * unit);
        ctx.strokeStyle = '#f3dfb0';
        ctx.lineWidth = 1.4 * px * unit;
        ctx.stroke();
        continue;
      }
      if (beast.hp <= 0 || Math.hypot(beast.pos.x - beast.home.x, beast.pos.z - beast.home.z) < 3)
        continue;
      ctx.fillStyle = elementHex(beast.element);
      this.dot(beast.pos, 1.6 * px * unit);
    }

    // Santuarios.
    for (const shrine of state.shrines) {
      ctx.fillStyle = shrine.team === null ? '#f3dfb0' : teamOf(state, shrine.team, badges);
      const s = 2.6 * px * unit;
      ctx.beginPath();
      ctx.moveTo(shrine.pos.x, shrine.pos.z - s);
      ctx.lineTo(shrine.pos.x + s, shrine.pos.z);
      ctx.lineTo(shrine.pos.x, shrine.pos.z + s);
      ctx.lineTo(shrine.pos.x - s, shrine.pos.z);
      ctx.closePath();
      ctx.fill();
    }

    // Magos: aliados siempre; rivales si se ven, y si no, dónde se los vio.
    for (const wizard of state.wizards) {
      if (wizard.id === player.id) continue;
      const color = badges.get(wizard.id)?.color ?? '#fff';
      if (wizard.team === player.team) {
        ctx.globalAlpha = wizard.hp > 0 ? 1 : 0.4;
        ctx.fillStyle = color;
        this.dot(wizard.pos, 2.4 * px * unit);
        continue;
      }
      if (seen.has(wizard.id) && wizard.hp > 0) {
        this.lastSeen.set(wizard.id, { pos: { ...wizard.pos }, time });
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        this.dot(wizard.pos, 2.6 * px * unit);
        ctx.strokeStyle = '#0b0a10';
        ctx.lineWidth = 0.8 * px * unit;
        ctx.stroke();
        continue;
      }
      const memory = this.lastSeen.get(wizard.id);
      if (!memory) continue;
      const age = time - memory.time;
      if (age > LAST_SEEN_SECONDS || age < 0) {
        this.lastSeen.delete(wizard.id);
        continue;
      }
      ctx.globalAlpha = 0.7 * (1 - age / LAST_SEEN_SECONDS);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2 * px * unit;
      ctx.beginPath();
      ctx.arc(memory.pos.x, memory.pos.z, 2.4 * px * unit, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Tú: una flecha que siempre apunta hacia arriba, como la cámara.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = half + k * (right.x * player.pos.x + right.z * player.pos.z);
    const sy = half - k * (forward.x * player.pos.x + forward.z * player.pos.z);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0b0a10';
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 5 * px);
    ctx.lineTo(sx + 3.6 * px, sy + 3.6 * px);
    ctx.lineTo(sx, sy + 2 * px);
    ctx.lineTo(sx - 3.6 * px, sy + 3.6 * px);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private dot(pos: Vec2, r: number): void {
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.z, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** La parte que no cambia: suelo, plaza, senderos y obstáculos. Se dibuja una vez. */
  private drawBackground(): HTMLCanvasElement {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const radius = this.rules.arenaRadius;
    const k = size / 2 / radius;
    ctx.setTransform(k, 0, 0, k, size / 2, size / 2);

    ctx.fillStyle = 'rgba(22, 30, 24, 0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Los senderos solo existen en la jungla.
    if (this.rules.map.camps.length > 0) this.drawPaths(ctx, radius);

    ctx.fillStyle = 'rgba(92, 86, 80, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, MAP_DECOR.plazaRadius, 0, Math.PI * 2);
    ctx.fill();

    for (const o of this.rules.map.obstacles) {
      ctx.fillStyle =
        o.kind === 'tree' ? '#0c140e' : o.kind === 'brazier' ? '#c9a86a' : 'rgba(30, 28, 27, 1)';
      ctx.beginPath();
      ctx.arc(o.x, o.z, o.kind === 'tree' ? o.radius * 1.6 : o.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(243, 223, 176, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 0.4, 0, Math.PI * 2);
    ctx.stroke();
    return canvas;
  }

  private drawPaths(ctx: CanvasRenderingContext2D, radius: number): void {
    ctx.strokeStyle = 'rgba(150, 128, 98, 0.55)';
    ctx.lineWidth = MAP_DECOR.ringPath.to - MAP_DECOR.ringPath.from;
    ctx.beginPath();
    ctx.arc(0, 0, (MAP_DECOR.ringPath.to + MAP_DECOR.ringPath.from) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = MAP_DECOR.pathHalfWidth * 1.6;
    for (const angle of MAP_DECOR.pathAngles) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * MAP_DECOR.plazaRadius, Math.sin(angle) * MAP_DECOR.plazaRadius);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.stroke();
    }
  }
}

function teamOf(state: MatchState, team: number, badges: ReadonlyMap<number, WizardBadge>): string {
  const member = state.wizards.find((w) => w.team === team);
  return (member && badges.get(member.id)?.color) ?? '#f3dfb0';
}
