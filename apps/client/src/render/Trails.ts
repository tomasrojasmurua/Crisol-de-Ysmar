import * as THREE from 'three';

/** Cuántas estelas a la vez y cuántos puntos guarda cada una. */
const MAX_TRAILS = 32;
const POINTS = 14;
/** Cada cuánto se guarda un punto nuevo (segundos): la estela mide lo mismo a cualquier FPS. */
const STEP = 1 / 60;
/** Lo que tarda en apagarse la estela de un proyectil que ya no existe. */
const FADE_SECONDS = 0.18;

interface Trail {
  readonly points: THREE.Vector3[];
  /** Dónde se guardó el último punto: con pocos FPS, los puntos intermedios se rellenan. */
  readonly last: THREE.Vector3;
  readonly color: THREE.Color;
  readonly width: number;
  /** Tormenta: la estela tiembla como un rayo. */
  readonly jagged: boolean;
  /** Segundos desde que se guardó el último punto. */
  since: number;
  seen: boolean;
  /** 1 mientras el proyectil vive; baja a 0 cuando desaparece. */
  life: number;
}

/**
 * Estelas de los proyectiles: una cinta brillante que se afina y se apaga hacia la cola.
 * Todas comparten una sola malla (una llamada de dibujo) y se arman en cada cuadro con pocos
 * números; nada se crea ni se destruye mientras se juega.
 */
export class Trails {
  private readonly trails = new Map<number, Trail>();
  private readonly positions = new Float32Array(MAX_TRAILS * POINTS * 2 * 3);
  private readonly colors = new Float32Array(MAX_TRAILS * POINTS * 2 * 3);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(
    THREE.DynamicDrawUsage,
  );
  private readonly colorAttribute = new THREE.BufferAttribute(this.colors, 3).setUsage(
    THREE.DynamicDrawUsage,
  );
  private readonly mesh: THREE.Mesh;
  private readonly side = new THREE.Vector3();
  private readonly tint = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const index: number[] = [];
    for (let t = 0; t < MAX_TRAILS; t++) {
      for (let i = 0; i < POINTS - 1; i++) {
        const a = (t * POINTS + i) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
        fog: false,
      }),
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** El proyectil `id` está en `pos` este cuadro. */
  track(
    id: number,
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    width: number,
    jagged: boolean,
  ): void {
    if (!this.mesh.visible) return;
    let trail = this.trails.get(id);
    if (!trail) {
      if (this.trails.size >= MAX_TRAILS) return;
      const start = new THREE.Vector3(x, y, z);
      trail = {
        points: Array.from({ length: POINTS }, () => start.clone()),
        last: start.clone(),
        color: color.clone(),
        width,
        jagged,
        since: 0,
        seen: true,
        life: 1,
      };
      this.trails.set(id, trail);
    }
    trail.seen = true;
    trail.life = 1;
    // La cabeza sigue al proyectil en todo momento; el resto avanza a paso fijo.
    trail.points[0]?.set(x, y, z);
  }

  /** Con gráficos livianos las estelas no se arman ni se dibujan. */
  set enabled(value: boolean) {
    this.mesh.visible = value;
    if (!value) this.trails.clear();
  }

  /** Arma la cinta de este cuadro. Lo que no se vio en `track` se va apagando. */
  update(deltaSeconds: number): void {
    if (!this.mesh.visible) return;
    let slot = 0;
    for (const [id, trail] of this.trails) {
      if (!trail.seen) {
        trail.life -= deltaSeconds / FADE_SECONDS;
        if (trail.life <= 0) {
          this.trails.delete(id);
          continue;
        }
      }
      trail.seen = false;
      trail.since += deltaSeconds;
      const steps = Math.min(POINTS - 1, Math.floor(trail.since / STEP));
      trail.since -= Math.floor(trail.since / STEP) * STEP;
      const head = trail.points[0];
      if (steps > 0 && head) {
        // Corre la cola y rellena los pasos de este cuadro entre el último punto y la cabeza.
        for (let i = POINTS - 1; i > steps; i--) {
          const from = trail.points[i - steps];
          if (from) trail.points[i]?.copy(from);
        }
        for (let j = 1; j <= steps; j++) {
          trail.points[j]?.lerpVectors(head, trail.last, j / steps);
        }
        trail.last.copy(head);
      }
      this.write(slot, trail);
      slot++;
    }
    // Lo que sobra queda en negro: con mezcla aditiva, el negro no se ve.
    this.colors.fill(0, slot * POINTS * 6);
    this.positionAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
  }

  private write(slot: number, trail: Trail): void {
    const base = slot * POINTS * 6;
    for (let i = 0; i < POINTS; i++) {
      const p = trail.points[i];
      const next = trail.points[Math.min(POINTS - 1, i + 1)];
      const prev = trail.points[Math.max(0, i - 1)];
      if (!p || !next || !prev) continue;
      // De lado: perpendicular a la dirección de avance, sobre el plano del suelo.
      this.side.set(prev.z - next.z, 0, next.x - prev.x);
      const len = this.side.length();
      if (len > 1e-5) this.side.multiplyScalar(1 / len);
      else this.side.set(1, 0, 0);
      const along = 1 - i / (POINTS - 1);
      const width = trail.width * (0.2 + 0.8 * along) * trail.life;
      const shake = trail.jagged && i > 0 ? Math.sin(i * 2.7 + p.x * 3.1) * trail.width * 0.9 : 0;
      const cx = p.x + this.side.x * shake;
      const cz = p.z + this.side.z * shake;
      const o = base + i * 6;
      this.positions[o] = cx + this.side.x * width;
      this.positions[o + 1] = p.y;
      this.positions[o + 2] = cz + this.side.z * width;
      this.positions[o + 3] = cx - this.side.x * width;
      this.positions[o + 4] = p.y;
      this.positions[o + 5] = cz - this.side.z * width;
      this.tint.copy(trail.color).multiplyScalar(along * along * trail.life);
      for (const k of [0, 3]) {
        this.colors[o + k] = this.tint.r;
        this.colors[o + k + 1] = this.tint.g;
        this.colors[o + k + 2] = this.tint.b;
      }
    }
  }
}
