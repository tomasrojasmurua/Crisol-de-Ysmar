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
  /** Brasa → Marea: coraza que absorbe y estalla al romperse o terminar. */
  readonly obsidian: {
    readonly shield: number;
    readonly durationTicks: number;
    readonly damage: number;
    readonly blastRadius: number;
  };
  /** Brasa → Raíz: una llama que persigue al rival más cercano y explota al tocarlo. */
  readonly wisp: SummonSpell & {
    readonly damage: number;
    readonly speed: number;
    readonly seekRange: number;
  };
  /** Brasa → Umbra: marca que estalla con una parte del daño que el rival recibió mientras duró. */
  readonly ignite: {
    readonly fraction: number;
    readonly range: number;
    readonly coneDot: number;
    readonly durationTicks: number;
  };
  /** Tormenta → Marea: torbellino que frena a los rivales y desvía sus proyectiles. */
  readonly blizzard: AreaSpell & {
    /** Ángulo con que tuerce un proyectil rival, en radianes. */
    readonly deflectAngle: number;
  };
  /** Tormenta → Raíz: poste que da un rayo al rival más cercano cada tanto. */
  readonly lightningRod: SummonSpell & {
    readonly distance: number;
    readonly damage: number;
    readonly range: number;
    readonly intervalTicks: number;
  };
  /** Tormenta → Umbra: apareces detrás del rival y lo silencias. */
  readonly shadowStep: {
    readonly range: number;
    readonly coneDot: number;
    /** Cuánto detrás de él apareces. */
    readonly behind: number;
  };
  /** Marea → Tormenta: un río que apura a los aliados a favor y frena a los rivales. */
  readonly current: {
    readonly length: number;
    readonly halfWidth: number;
    readonly durationTicks: number;
  };
  /** Marea → Marea: muro corto que solo frena a los rivales y sus proyectiles. */
  readonly iceWall: {
    readonly distance: number;
    readonly halfLength: number;
    readonly thickness: number;
    readonly durationTicks: number;
  };
  /** Marea → Raíz: fuente a tus pies que cura a ti y tus aliados. */
  readonly spring: AreaSpell & { readonly healPerSecond: number };
  /** Raíz → Tormenta: liana que te lleva a un árbol, una roca o un rival (y lo enraíza). */
  readonly vine: {
    readonly range: number;
    readonly speed: number;
    readonly rootTicks: number;
  };
  /** Raíz → Marea: criatura que te sigue, pega de cerca y ataja proyectiles. */
  readonly mossGuardian: SummonSpell & {
    readonly damage: number;
    readonly speed: number;
    readonly attackRange: number;
    readonly attackCooldownTicks: number;
    readonly aggroRange: number;
    readonly followDistance: number;
  };
  /** Raíz → Umbra: nube que debilita a los rivales (los números están en el estado `weak`). */
  readonly spores: AreaSpell;
  /** Umbra → Tormenta: te vuelves invisible un momento y un doble corre por ti. */
  readonly decoy: SummonSpell & { readonly veilTicks: number; readonly speed: number };
  /** Umbra → Marea: proyectil de sombra que ciega (los números están en el estado `blind`). */
  readonly blinding: ProjectileSpell;
  /** Umbra → Raíz: ata al rival a su lugar; si se aleja, queda enraizado y recibe daño. */
  readonly shackle: {
    readonly range: number;
    readonly coneDot: number;
    readonly durationTicks: number;
    readonly leash: number;
    readonly damage: number;
    readonly rootTicks: number;
  };
}

/** Un efecto en el suelo, a cierta distancia de quien lo lanza (0: a sus pies). */
export interface AreaSpell {
  readonly range: number;
  readonly radius: number;
  readonly durationTicks: number;
}

/** Algo que se invoca y se puede destruir a golpes. */
export interface SummonSpell {
  readonly hp: number;
  readonly radius: number;
  readonly durationTicks: number;
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
