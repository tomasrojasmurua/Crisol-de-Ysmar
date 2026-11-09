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

  // Grandes hechizos (3 elementos), primera tanda.

  /** Brasa → Brasa → Brasa: tras el aviso cae del cielo y deja el suelo ardiendo. */
  readonly meteor: StrikeSpell & {
    readonly range: number;
    readonly scorchRadius: number;
    readonly scorchTicks: number;
  };
  /** Brasa → Brasa → Tormenta: cae fuego sobre cada rival cercano que se mueva. */
  readonly fireRain: {
    readonly damage: number;
    readonly radius: number;
    readonly durationTicks: number;
    readonly intervalTicks: number;
    /** El fuego que cae deja un charco ardiendo de este tamaño. */
    readonly scorchRadius: number;
    readonly scorchTicks: number;
  };
  /** Brasa → Umbra → Marea: proyectil que atraviesa muros, escudos e invocaciones. */
  readonly blackFlame: ProjectileSpell;
  /** Brasa → Umbra → Tormenta: te teletransportas a un suelo que esté ardiendo. */
  readonly emberStride: { readonly range: number };
  /** Brasa → Tormenta → Umbra: si acierta, te lleva junto al rival y lo silencia. */
  readonly darkComet: ProjectileSpell & {
    /** A qué distancia del rival apareces. */
    readonly beside: number;
  };
  /** Tormenta → Tormenta → Brasa: tras un instante cae un rayo en línea. */
  readonly skySpear: {
    readonly damage: number;
    readonly length: number;
    readonly halfWidth: number;
    readonly delayTicks: number;
  };
  /** Tormenta → Tormenta → Tormenta: tres destellos seguidos que descargan al llegar. */
  readonly tempest: {
    readonly jumps: number;
    readonly distance: number;
    readonly intervalTicks: number;
    readonly damage: number;
    readonly radius: number;
  };
  /** Tormenta → Tormenta → Marea: un tornado lento que levanta por los aires a quien toca. */
  readonly hurricane: SweeperSpell;
  /** Tormenta → Umbra → Tormenta: cambias de lugar con cualquier mago a la vista. */
  readonly swap: { readonly range: number; readonly coneDot: number };
  /** Tormenta → Brasa → Marea: un orbe lento que da rayos a quien pase cerca. */
  readonly erraticOrb: SweeperSpell & {
    readonly zapRange: number;
    readonly intervalTicks: number;
  };
  /** Marea → Marea → Marea: tras el aviso, congela a todos los rivales alrededor. */
  readonly iceAge: StrikeSpell;
  /** Marea → Brasa → Brasa: el suelo hierve y quema mucho a quien siga encima. */
  readonly cauldron: StrikeSpell & { readonly range: number };
  /** Marea → Brasa → Tormenta: te impulsas hacia atrás y el chorro quema hacia adelante. */
  readonly steamJet: DashSpell & ConeSpell;
  /** Marea → Umbra → Brasa: agua que sube por el rival; si no escapa, lo silencia y lo daña. */
  readonly drown: {
    readonly damage: number;
    readonly range: number;
    readonly coneDot: number;
    readonly breakRange: number;
    readonly durationTicks: number;
    readonly silenceTicks: number;
  };
  /** Marea → Raíz → Brasa: muro que frena proyectiles pero deja pasar a los magos. */
  readonly mangrove: {
    readonly distance: number;
    readonly halfLength: number;
    readonly thickness: number;
    readonly durationTicks: number;
  };
  /** Marea → Marea → Tormenta: una ola ancha cruza el campo y empapa a quien toca. */
  readonly tidalWave: SweeperSpell & { readonly halfWidth: number };
  /** Raíz → Tormenta → Brasa: una raíz te lanza en arco y enraízas al caer. */
  readonly rootCatapult: DashSpell & {
    readonly radius: number;
    readonly damage: number;
    readonly rootTicks: number;
  };
  /** Raíz → Tormenta → Marea: siembra trampas que enraízan al primero que las pise. */
  readonly sowing: {
    readonly range: number;
    readonly count: number;
    /** Qué tan lejos del centro quedan las trampas de alrededor. */
    readonly spread: number;
    readonly radius: number;
    readonly armTicks: number;
    readonly durationTicks: number;
    readonly damage: number;
  };
  /** Raíz → Raíz → Brasa: anillo de espinas ardientes que no deja entrar ni salir. */
  readonly thornRing: AreaSpell;
  /** Raíz → Umbra → Tormenta: entras en un árbol y sales por otro. */
  readonly treeStride: {
    /** Qué tan cerca de un árbol tienes que estar. */
    readonly entryRange: number;
    readonly range: number;
    readonly coneDot: number;
  };
  /** Umbra → Umbra → Brasa: marca rivales que arden según la vida que les falta. */
  readonly soulPyre: {
    readonly damage: number;
    readonly missingFraction: number;
    readonly range: number;
    readonly targets: number;
    readonly delayTicks: number;
  };
  /** Umbra → Brasa → Tormenta: dos portales unidos. */
  readonly portal: {
    readonly range: number;
    readonly radius: number;
    readonly durationTicks: number;
  };
  /** Umbra → Tormenta → Tormenta: atraviesas todo (la duración la da el estado `phased`). */
  readonly phantom: Record<string, never>;
  /** Umbra → Tormenta → Marea: tras el aviso, un vórtice silencia a todos adentro. */
  readonly abyss: StrikeSpell & { readonly range: number; readonly silenceTicks: number };
  /** Umbra → Umbra → Marea: el rival se duerme (la duración la da el estado `asleep`). */
  readonly nightmare: { readonly range: number; readonly coneDot: number };
}

/** Un golpe con aviso: cae en un círculo tras unos pasos. */
export interface StrikeSpell {
  readonly damage: number;
  readonly radius: number;
  readonly delayTicks: number;
}

/** Algo que avanza solo por el campo y golpea al pasar. */
export interface SweeperSpell {
  readonly damage: number;
  readonly speed: number;
  readonly range: number;
  readonly radius: number;
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
