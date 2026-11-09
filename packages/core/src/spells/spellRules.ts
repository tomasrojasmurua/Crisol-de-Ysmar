/**
 * Los números de cada hechizo propio. Viven en `packages/content`; el núcleo solo declara su forma.
 * Tiempos en pasos (30 por segundo), distancias en metros, daño en puntos de vida.
 */
export interface SpellRules {
  /** Brasa: dardo rápido que quema. */
  readonly spark: ProjectileSpell;
  /** Tormenta: desplazamiento corto. */
  readonly step: DashSpell;
  /** Marea: cono de agua que ralentiza. */
  readonly splash: ConeSpell;
  /** Raíz: curación en el tiempo (la cantidad la da el estado `regen`). */
  readonly sap: Record<string, never>;
  /** Umbra: golpe instantáneo que roba vida. */
  readonly claw: ConeSpell & { readonly lifesteal: number };
  /** Brasa → Brasa: proyectil lento que explota en área. */
  readonly fireball: ProjectileSpell & { readonly blastRadius: number };
  /** Brasa → Tormenta: te lanzas dejando un rastro de fuego. */
  readonly comet: DashSpell & {
    readonly trailRadius: number;
    readonly trailTicks: number;
    /** Cada cuántos pasos del salto queda un trozo de rastro. */
    readonly trailEvery: number;
  };
  /** Tormenta → Tormenta: teletransporte instantáneo, también a través de árboles. */
  readonly blink: { readonly distance: number };
  /** Tormenta → Brasa: rayo que salta de blanco en blanco. */
  readonly chainLightning: {
    readonly damages: readonly number[];
    readonly range: number;
    readonly coneDot: number;
    readonly bounceRange: number;
  };
  /** Marea → Brasa: tras un aviso, un géiser levanta por los aires. */
  readonly geyser: {
    readonly damage: number;
    readonly range: number;
    readonly radius: number;
    readonly delayTicks: number;
  };
  /** Marea → Umbra: te congelas e ignoras todo (la duración la da el estado `stasis`). */
  readonly iceCoffin: Record<string, never>;
  /** Raíz → Brasa: brotes de espinas que avanzan en línea. */
  readonly thornRush: {
    readonly damage: number;
    readonly bursts: number;
    readonly spacing: number;
    readonly radius: number;
    readonly intervalTicks: number;
  };
  /** Raíz → Raíz: muralla que corta el paso y los proyectiles de todos. */
  readonly rootWall: {
    readonly distance: number;
    readonly halfLength: number;
    readonly thickness: number;
    readonly durationTicks: number;
  };
  /** Umbra → Umbra: invisibilidad (sus números están en el estado `veiled`). */
  readonly veil: Record<string, never>;
  /** Umbra → Brasa: hilo que roba vida mientras dure. */
  readonly drain: {
    readonly damagePerSecond: number;
    readonly range: number;
    readonly coneDot: number;
    readonly breakRange: number;
    readonly durationTicks: number;
  };
}

export interface ProjectileSpell {
  readonly damage: number;
  readonly speed: number;
  readonly range: number;
  readonly radius: number;
}

export interface DashSpell {
  readonly distance: number;
  readonly durationTicks: number;
}

export interface ConeSpell {
  readonly damage: number;
  readonly range: number;
  /** Coseno mínimo entre la dirección apuntada y el blanco. */
  readonly coneDot: number;
}
