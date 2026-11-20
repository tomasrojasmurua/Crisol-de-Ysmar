import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addRimLight, addSurfaceShading } from './rim';

/** Altura del centro de la cabeza en los linajes de cabeza redonda. */
export const HEAD_Y = 1.74;

/**
 * Los materiales y el cuerpo donde se arma un hechicero. Cada pieza del Vestidor agrega mallas
 * con `solid` (opacas, con sombra, se vuelven humo con el Velo) o `glow` (ojos, gemas: brillan
 * y siguen viéndose con el Velo). Al final `merge` junta las mallas por material para gastar
 * pocas llamadas de dibujo aunque el mago tenga muchas piezas.
 */
export class ModelKit {
  readonly robe: THREE.MeshStandardMaterial;
  readonly trim: THREE.MeshStandardMaterial;
  readonly skin: THREE.MeshStandardMaterial;
  /** Tela clara para drapeados, turbantes y vendas: la túnica aclarada. */
  readonly cloth: THREE.MeshStandardMaterial;
  /** Capas y cuellos altos: se ven por los dos lados. */
  readonly cape: THREE.MeshStandardMaterial;
  readonly bone: THREE.MeshStandardMaterial;
  readonly horn: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
  readonly fur: THREE.MeshStandardMaterial;
  readonly hair: THREE.MeshStandardMaterial;
  readonly beard: THREE.MeshStandardMaterial;
  readonly dark: THREE.MeshBasicMaterial;
  /** Runas pintadas: brillan suave, del color del bando. */
  readonly paint: THREE.MeshBasicMaterial;
  /**
   * Adornos, piel, hueso, cuerno, madera, pelo, barba, tela clara y huecos oscuros se dibujan
   * juntos con este material: cada vértice lleva su color, su aspereza, su brillo metálico y
   * cuánto contorno de bando recibe. Así un mago con diez piezas de cinco materiales distintos
   * cuesta una llamada de dibujo (y una de sombra) en vez de cinco.
   */
  readonly surface = new THREE.MeshStandardMaterial({ vertexColors: true });
  readonly solids: THREE.Mesh[] = [];

  constructor(
    readonly body: THREE.Group,
    readonly staff: THREE.Group,
    colors: { readonly robe: string; readonly trim: string; readonly skin: string },
    readonly crystal: THREE.MeshBasicMaterial,
    readonly eye: THREE.MeshBasicMaterial,
    readonly radius: number,
  ) {
    const robe = new THREE.Color(colors.robe);
    this.robe = new THREE.MeshStandardMaterial({ color: robe, roughness: 0.85 });
    this.trim = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.trim),
      roughness: 0.45,
      metalness: 0.45,
    });
    this.skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.skin),
      roughness: 0.75,
    });
    this.cloth = new THREE.MeshStandardMaterial({
      color: robe.clone().lerp(new THREE.Color('#d9ccb0'), 0.4),
      roughness: 0.9,
    });
    this.cape = new THREE.MeshStandardMaterial({
      color: robe.clone().multiplyScalar(0.7),
      roughness: 0.9,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    this.bone = new THREE.MeshStandardMaterial({ color: '#d6cdb6', roughness: 0.7 });
    this.horn = new THREE.MeshStandardMaterial({ color: '#3a322a', roughness: 0.6 });
    this.wood = new THREE.MeshStandardMaterial({ color: '#3b2a1d', roughness: 0.7 });
    this.fur = new THREE.MeshStandardMaterial({ color: '#4d3a2a', roughness: 1 });
    this.hair = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.9 });
    this.beard = new THREE.MeshStandardMaterial({ color: '#bdb6aa', roughness: 0.95 });
    this.dark = new THREE.MeshBasicMaterial({ color: '#050407' });
    this.paint = new THREE.MeshBasicMaterial({ color: eye.color.clone().multiplyScalar(0.55) });
  }

  /** Enciende el contorno de todas las telas, pieles y adornos con el color del bando. */
  applyRim(color: THREE.Color, strength: number): void {
    for (const material of [
      this.robe,
      this.trim,
      this.skin,
      this.cloth,
      this.cape,
      this.bone,
      this.horn,
      this.wood,
      this.fur,
      this.hair,
      this.beard,
      this.surface,
    ]) {
      addRimLight(material, color, strength);
    }
    addSurfaceShading(this.surface);
  }

  /** Cómo se ve una pieza dentro de `surface`, o `null` si conserva su propio material. */
  private surfaceLook(material: THREE.Material): SurfaceLook | null {
    if (material === this.dark)
      return { color: this.dark.color, roughness: 1, metalness: 0, rim: 0 };
    if (
      material instanceof THREE.MeshStandardMaterial &&
      [
        this.trim,
        this.skin,
        this.cloth,
        this.bone,
        this.horn,
        this.wood,
        this.fur,
        this.hair,
        this.beard,
      ].includes(material)
    ) {
      return {
        color: material.color,
        roughness: material.roughness,
        metalness: material.metalness,
        rim: 1,
      };
    }
    return null;
  }

  /** Una pieza opaca del cuerpo. */
  solid(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    at: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
    scale: readonly [number, number, number] = [1, 1, 1],
  ): THREE.Mesh {
    const mesh = place(new THREE.Mesh(geometry, material), at, rotation, scale);
    mesh.castShadow = true;
    this.solids.push(mesh);
    this.body.add(mesh);
    return mesh;
  }

  /** Una pieza que brilla (ojos, gemas, runas): no se vuelve humo ni da sombra. */
  glow(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    at: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
    scale: readonly [number, number, number] = [1, 1, 1],
  ): THREE.Mesh {
    const mesh = place(new THREE.Mesh(geometry, material), at, rotation, scale);
    this.body.add(mesh);
    return mesh;
  }

  /** Una pieza del foco (báculo, cetro…): se mueve con él. */
  held(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    at: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
    scale: readonly [number, number, number] = [1, 1, 1],
  ): THREE.Mesh {
    const mesh = place(new THREE.Mesh(geometry, material), at, rotation, scale);
    if (material !== this.crystal) {
      mesh.castShadow = true;
      this.solids.push(mesh);
    }
    this.staff.add(mesh);
    return mesh;
  }

  /** Un par de ojos que brillan del color del bando. */
  eyes(spread: number, y: number, z: number, size = 0.035): void {
    const geometry = new THREE.SphereGeometry(size, 8, 6);
    for (const side of [-1, 1]) this.glow(geometry, this.eye, [side * spread, y, z]);
  }

  /**
   * Junta en una sola malla las piezas de `group` que comparten material, y en otra todas las
   * que van en `surface`. Las piezas marcadas con `userData.keep` quedan sueltas.
   */
  fuse(group: THREE.Group): void {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || child.userData.keep) continue;
      const own = child.material as THREE.Material;
      const material = this.surfaceLook(own) ? this.surface : own;
      const list = groups.get(material) ?? [];
      list.push(child);
      groups.set(material, list);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2 && material !== this.surface) continue;
      const painted = material === this.surface;
      const geometries = meshes.map((mesh) => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== 'position' && name !== 'normal' && (painted || name !== 'uv'))
            geometry.deleteAttribute(name);
        }
        const look = painted ? this.surfaceLook(mesh.material as THREE.Material) : null;
        if (look) paintSurface(geometry, look);
        return geometry.applyMatrix4(mesh.matrix);
      });
      const merged = mergeGeometries(geometries, false);
      for (const geometry of geometries) geometry.dispose();
      if (!merged) continue;
      const opaque = meshes.some((m) => this.solids.includes(m));
      for (const mesh of meshes) {
        mesh.removeFromParent();
        const at = this.solids.indexOf(mesh);
        if (at >= 0) this.solids.splice(at, 1);
      }
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = opaque;
      if (opaque) this.solids.push(mesh);
      group.add(mesh);
    }
  }

  /**
   * Junta las piezas del cuerpo (sin tocar el foco, que se mueve aparte y se junta con
   * `fuse(staff)`). Devuelve las mallas opacas que quedaron, para el humo del Velo.
   */
  merge(): THREE.Mesh[] {
    this.fuse(this.body);
    return this.solids.filter((mesh) => !mesh.userData.keep);
  }
}

interface SurfaceLook {
  readonly color: THREE.Color;
  readonly roughness: number;
  readonly metalness: number;
  /** Cuánto contorno de bando recibe (0 en los huecos oscuros). */
  readonly rim: number;
}

/** Escribe en cada vértice el color y el acabado de la pieza (ver `addSurfaceShading`). */
function paintSurface(geometry: THREE.BufferGeometry, look: SurfaceLook): void {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const surface = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors.set([look.color.r, look.color.g, look.color.b], i * 3);
    surface.set([look.roughness, look.metalness, look.rim], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('surface', new THREE.BufferAttribute(surface, 3));
}

function place(
  mesh: THREE.Mesh,
  at: readonly [number, number, number],
  rotation: readonly [number, number, number],
  scale: readonly [number, number, number],
): THREE.Mesh {
  mesh.position.set(at[0], at[1], at[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  return mesh;
}

/** Ruido fijo y repetible (sin azar) para bordes deshilachados. */
export function jitter(i: number, amount: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amount;
}

/** Deshilacha el borde de abajo de una malla: baja y sube los vértices más bajos. */
export function frayBottom(geometry: THREE.BufferGeometry, below: number, amount: number): void {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y > below) continue;
    const angle = Math.atan2(position.getX(i), position.getZ(i));
    position.setY(i, y + Math.abs(jitter(Math.round(angle * 9), amount)));
  }
  geometry.computeVertexNormals();
}
