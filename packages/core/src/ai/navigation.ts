import { lineBlocked } from '../match/obstacles';
import { distance, normalize, sub, type Vec2 } from '../math/vec2';
import type { GameRules, Obstacle } from '../rules';

/** Lado de cada celda de la grilla de caminos, en metros. */
const CELL = 1;
/** Holgura alrededor de los obstáculos: el cuerpo del mago más un poco. */
const CLEARANCE = 0.75;

/** Una grilla que marca qué celdas se pueden pisar. Se arma una vez por mapa. */
interface NavGrid {
  readonly size: number;
  readonly origin: number;
  readonly walkable: Uint8Array;
}

const grids = new WeakMap<readonly Obstacle[], NavGrid>();

function gridFor(rules: GameRules): NavGrid {
  const cached = grids.get(rules.map.obstacles);
  if (cached) return cached;
  const origin = -rules.arenaRadius;
  const size = Math.ceil((rules.arenaRadius * 2) / CELL) + 1;
  const walkable = new Uint8Array(size * size);
  const limit = rules.arenaRadius - CLEARANCE;
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const x = origin + ix * CELL;
      const z = origin + iz * CELL;
      let ok = Math.hypot(x, z) <= limit;
      for (const o of rules.map.obstacles) {
        if (!ok) break;
        const r = o.radius + CLEARANCE;
        if ((x - o.x) ** 2 + (z - o.z) ** 2 < r * r) ok = false;
      }
      walkable[iz * size + ix] = ok ? 1 : 0;
    }
  }
  const grid = { size, origin, walkable };
  grids.set(rules.map.obstacles, grid);
  return grid;
}

/** La celda pisable más cercana a un punto (busca en espiral si cae dentro de un obstáculo). */
function cellOf(grid: NavGrid, p: Vec2): number {
  const cx = Math.round((p.x - grid.origin) / CELL);
  const cz = Math.round((p.z - grid.origin) / CELL);
  for (let ring = 0; ring < 6; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const x = cx + dx;
        const z = cz + dz;
        if (x < 0 || z < 0 || x >= grid.size || z >= grid.size) continue;
        if (grid.walkable[z * grid.size + x]) return z * grid.size + x;
      }
    }
  }
  return -1;
}

function pointOf(grid: NavGrid, cell: number): Vec2 {
  return {
    x: grid.origin + (cell % grid.size) * CELL,
    z: grid.origin + Math.floor(cell / grid.size) * CELL,
  };
}

/** Un montículo binario mínimo de celdas por costo. */
class Heap {
  private readonly items: number[] = [];
  private readonly costs: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, cost: number): void {
    this.items.push(item);
    this.costs.push(cost);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.costs[parent] ?? 0) <= cost) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0] ?? -1;
    const lastItem = this.items.pop() ?? -1;
    const lastCost = this.costs.pop() ?? 0;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.costs[0] = lastCost;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && (this.costs[l] ?? 0) < (this.costs[smallest] ?? 0))
          smallest = l;
        if (r < this.items.length && (this.costs[r] ?? 0) < (this.costs[smallest] ?? 0))
          smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const item = this.items[a] ?? 0;
    const cost = this.costs[a] ?? 0;
    this.items[a] = this.items[b] ?? 0;
    this.costs[a] = this.costs[b] ?? 0;
    this.items[b] = item;
    this.costs[b] = cost;
  }
}

const NEIGHBORS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** Camino de celdas de `from` a `to` con A*, o vacío si no hay. */
export function findPath(from: Vec2, to: Vec2, rules: GameRules): Vec2[] {
  const grid = gridFor(rules);
  const start = cellOf(grid, from);
  const goal = cellOf(grid, to);
  if (start < 0 || goal < 0) return [];
  const { size, walkable } = grid;
  const gx = goal % size;
  const gz = Math.floor(goal / size);
  const heuristic = (cell: number): number =>
    Math.hypot((cell % size) - gx, Math.floor(cell / size) - gz);

  const cost = new Float32Array(size * size).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(size * size).fill(-1);
  const open = new Heap();
  cost[start] = 0;
  open.push(start, heuristic(start));
  let expanded = 0;
  while (open.size > 0 && expanded < 4000) {
    const cell = open.pop();
    if (cell === goal) break;
    expanded++;
    const cx = cell % size;
    const cz = Math.floor(cell / size);
    const base = cost[cell] ?? 0;
    for (const [dx, dz, step] of NEIGHBORS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const next = nz * size + nx;
      if (!walkable[next]) continue;
      // En diagonal no se cortan esquinas de obstáculos.
      if (dx !== 0 && dz !== 0 && (!walkable[cz * size + nx] || !walkable[nz * size + cx]))
        continue;
      const candidate = base + step;
      if (candidate < (cost[next] ?? Number.POSITIVE_INFINITY)) {
        cost[next] = candidate;
        parent[next] = cell;
        open.push(next, candidate + heuristic(next));
      }
    }
  }
  if (parent[goal] === -1 && goal !== start) return [];
  const path: Vec2[] = [];
  for (let cell = goal; cell !== -1 && cell !== start; cell = parent[cell] ?? -1) {
    path.push(pointOf(grid, cell));
  }
  path.reverse();
  path.push(to);
  return path;
}

/**
 * Lleva a un bot hacia una meta rodeando obstáculos. Guarda el camino y lo recalcula
 * cada tanto o si la meta se movió; mientras la línea recta esté libre, va directo.
 */
export class Navigator {
  private path: Vec2[] = [];
  private goal: Vec2 | null = null;
  private age = 0;

  constructor(private readonly rules: GameRules) {}

  /** Dirección a seguir para llegar a `goal` desde `from`. */
  directionTo(from: Vec2, goal: Vec2): Vec2 {
    const obstacles = this.rules.map.obstacles;
    if (!lineBlocked(from, goal, obstacles, 0.5)) {
      this.path = [];
      return normalize(sub(goal, from));
    }
    this.age++;
    if (!this.goal || distance(this.goal, goal) > 2 || this.age > 45 || this.path.length === 0) {
      this.path = findPath(from, goal, this.rules);
      this.goal = goal;
      this.age = 0;
    }
    // Se queda con el punto más lejano del camino que ya se ve en línea recta.
    while (this.path.length > 1) {
      const next = this.path[1];
      if (!next || lineBlocked(from, next, obstacles, 0.5)) break;
      this.path.shift();
    }
    const waypoint = this.path[0];
    if (!waypoint) return normalize(sub(goal, from));
    if (distance(from, waypoint) < 0.6 && this.path.length > 1) this.path.shift();
    return normalize(sub(this.path[0] ?? goal, from));
  }
}
