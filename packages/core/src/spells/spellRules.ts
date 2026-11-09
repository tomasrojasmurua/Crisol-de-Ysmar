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

  // Grandes hechizos, segunda tanda: invocaciones, apoyo, refuerzo y estados.

  /** Brasa → Brasa → Raíz: un ave de fuego va y vuelve quemando todo lo que cruza. */
  readonly ashBird: SweeperSpell;
  /** Brasa → Raíz → Tormenta: chispas que giran a tu alrededor y salen al rival que se acerque. */
  readonly wanderingSparks: SummonSpell & {
    readonly count: number;
    readonly orbitRadius: number;
    readonly seekRange: number;
    readonly damage: number;
    readonly speed: number;
  };
  /** Brasa → Raíz → Umbra: un gólem que se pone delante tuyo y estalla al caer. */
  readonly magmaGolem: SummonSpell & {
    readonly damage: number;
    readonly blastRadius: number;
    readonly speed: number;
    /** A qué distancia de ti se planta, del lado del rival. */
    readonly guardDistance: number;
  };
  /** Marea → Raíz → Raíz: un elemental de hielo que congela al primer rival que toca. */
  readonly glacier: SummonSpell & {
    readonly damage: number;
    readonly speed: number;
    readonly seekRange: number;
  };
  /** Raíz → Tormenta → Tormenta: un enjambre persigue al rival, lo frena y le tapa la vista. */
  readonly swarm: SummonSpell & {
    readonly speed: number;
    readonly range: number;
    readonly coneDot: number;
    /** A qué distancia del rival lo estorba. */
    readonly reach: number;
  };
  /** Raíz → Raíz → Tormenta: bestias de raíz cargan en fila y enraízan a quien atropellan. */
  readonly rootPack: SweeperSpell & { readonly halfWidth: number; readonly rootTicks: number };
  /** Raíz → Raíz → Raíz: un árbol gigante que ataja proyectiles y golpea alrededor. */
  readonly ancientTree: SummonSpell & {
    readonly distance: number;
    readonly damage: number;
    readonly reach: number;
    readonly intervalTicks: number;
  };
  /** Umbra → Umbra → Tormenta: un clon tuyo que pelea solo. */
  readonly shadowTwin: SummonSpell & {
    readonly speed: number;
    /** A qué distancia del rival se queda para disparar. */
    readonly keepDistance: number;
    readonly damage: number;
    readonly boltSpeed: number;
    readonly boltRange: number;
    readonly intervalTicks: number;
  };
  /** Raíz → Umbra → Brasa: una planta que se traga al primer rival que se acerca. */
  readonly carnivore: SummonSpell & {
    readonly distance: number;
    readonly reach: number;
    readonly swallowTicks: number;
    readonly damage: number;
  };
  /** Brasa → Marea → Raíz: una fuente donde tú y tus aliados tejen más rápido. */
  readonly hotSpring: AreaSpell;
  /** Tormenta → Marea → Tormenta: tú y tus aliados cercanos corren más rápido. */
  readonly tailwind: { readonly radius: number; readonly hasteTicks: number };
  /** Marea → Brasa → Marea: una burbuja que absorbe daño, sobre un aliado o sobre ti. */
  readonly bubble: {
    readonly range: number;
    readonly coneDot: number;
    readonly shield: number;
    readonly durationTicks: number;
  };
  /** Marea → Brasa → Raíz: revives al instante a un aliado caído. */
  readonly lifeWater: { readonly range: number; readonly hpFraction: number };
  /** Marea → Marea → Raíz: una lluvia que cura y limpia a tus aliados. */
  readonly healingRain: AreaSpell & { readonly healPerSecond: number };
  /** Marea → Umbra → Raíz: le pasas vida tuya a un aliado. */
  readonly sacrifice: { readonly range: number; readonly amount: number };
  /** Raíz → Raíz → Marea: flores que curan al aliado que las pisa. */
  readonly garden: {
    readonly count: number;
    readonly spread: number;
    readonly radius: number;
    readonly durationTicks: number;
    readonly heal: number;
  };
  /** Umbra → Brasa → Raíz: tus golpes curan a tu aliado (la duración la da el estado `linked`). */
  readonly lifeLink: Record<string, never>;
  /** Brasa → Brasa → Umbra: ardes, quemas alrededor y te curas con ese daño. */
  readonly immolation: {
    readonly radius: number;
    readonly durationTicks: number;
    readonly damagePerSecond: number;
    readonly intervalTicks: number;
  };
  /** Tormenta → Marea → Raíz: nada entra cerca de ti, ni magos ni proyectiles. */
  readonly stormEye: { readonly radius: number; readonly durationTicks: number };
  /** Marea → Raíz → Marea: te limpias y no te entran estados (lo da el estado `warded`). */
  readonly purify: Record<string, never>;
  /** Umbra → Marea → Tormenta: una ola que te cura por cada mago que atraviesa. */
  readonly soulTide: SweeperSpell & { readonly heal: number };
  /** Brasa → Umbra → Brasa: tejer le quema al rival (lo da el estado `combusting`). */
  readonly combustion: { readonly range: number; readonly coneDot: number };
  /** Tormenta → Umbra → Umbra: el rival va más lento y tú más rápido. */
  readonly speedTheft: {
    readonly range: number;
    readonly coneDot: number;
    readonly durationTicks: number;
  };
  /** Marea → Brasa → Umbra: proyectil que deja al rival recibiendo más daño (estado `exposed`). */
  readonly acid: ProjectileSpell;
  /** Marea → Marea → Brasa: nube donde los rivales tejen más lento (estado `sluggish`). */
  readonly mist: AreaSpell;
  /** Umbra → Umbra → Umbra: todos los rivales solo ven de cerca. */
  readonly eclipse: { readonly durationTicks: number };
  /** Umbra → Marea → Raíz: daño en el tiempo que contagia (estado `plague`). */
  readonly plague: { readonly range: number; readonly coneDot: number };

  // Grandes hechizos, tercera tanda: mapa vivo, información, sigilo y transformaciones.

  /** Brasa → Tormenta → Raíz: Un fuego avanza y quema los árboles: abre senderos en la jungla por el resto de la ronda. */
  readonly forestFire: SweeperSpell & { readonly halfWidth: number };
  /** Raíz → Brasa → Brasa: La bestia apuntada pelea para ti por un rato. */
  readonly tameBeast: {
    readonly range: number;
    readonly coneDot: number;
    readonly durationTicks: number;
  };
  /** Raíz → Brasa → Raíz: Un árbol nuevo que queda toda la ronda; dos por mago como mucho. */
  readonly treeSprout: {
    readonly range: number;
    readonly radius: number;
    readonly maxPerWizard: number;
  };
  /** Tormenta → Marea → Brasa: Ves cuánto le falta a cada elemento del rival para descansar (estado `insight`). */
  readonly barometer: Record<string, never>;
  /** Tormenta → Raíz → Umbra: Ves a todos los rivales del mapa y corres más (estado `hunting`). */
  readonly hunter: Record<string, never>;
  /** Raíz → Tormenta → Umbra: Marcas al rival apuntado: tu equipo lo ve aunque se meta en la jungla (estado `tracked`). */
  readonly track: { readonly range: number; readonly coneDot: number };
  /** Umbra → Tormenta → Raíz: Un ojo de sombra en un punto: tu equipo ve todo a su alrededor. */
  readonly sentinel: SummonSpell & { readonly range: number; readonly sightRadius: number };
  /** Brasa → Marea → Umbra: Una niebla donde los rivales no ven y tus golpes te curan (estado `leeching`). */
  readonly crimsonMist: AreaSpell;
  /** Marea → Tormenta → Raíz: Te quita marcas y rastros y te saca del minimapa rival (estado `unseen`). */
  readonly erasingRain: Record<string, never>;
  /** Marea → Umbra → Tormenta: Tres copias tuyas que se mueven como tú; la verdadera es la que teje. */
  readonly mirage: SummonSpell & { readonly count: number; readonly spread: number };
  /** Raíz → Raíz → Umbra: Un bosquecillo: adentro tu equipo es invisible y los rivales quedan débiles. */
  readonly cursedGrove: AreaSpell;
  /** Raíz → Umbra → Marea: Tu equipo dentro no aparece en el minimapa rival (estado `unseen`). */
  readonly mossCarpet: AreaSpell;
  /** Umbra → Tormenta → Umbra: El rival ve elementos falsos en tu tejido (estado `disguised`). */
  readonly weaveIllusion: Record<string, never>;
  /** Umbra → Raíz → Umbra: Eres invisible solo para el rival apuntado (estado `shadowed`). */
  readonly borrowedShadow: { readonly range: number; readonly coneDot: number };
  /** Brasa → Marea → Marea: Eres magma: lento, no te frenan ni enraízan y dejas el suelo ardiendo (estado `magma`). */
  readonly magmaForm: { readonly trailRadius: number; readonly trailTicks: number };
  /** Marea → Tormenta → Tormenta: Eres una ola: muy rápido y empapas a quien cruzas, pero no tejes (estado `surfing`). */
  readonly surf: Record<string, never>;
  /** Raíz → Tormenta → Raíz: Te enraízas: no te mueves ni te controlan y tus hechizos llegan más lejos (estado `deepRooted`). */
  readonly deepRoots: Record<string, never>;
  /** Umbra → Raíz → Tormenta: Eres una pantera: rápida, con zarpazos que roban vida, pero no tejes (estado `panther`). */
  readonly shadowPanther: Record<string, never>;

  // Grandes hechizos, cuarta tanda: terreno, detonadores, tiempo, copias, contrahechizos y más.

  /** Brasa → Brasa → Marea: un volcán que corta el paso y lanza rocas ardientes alrededor. */
  readonly eruption: {
    readonly range: number;
    readonly radius: number;
    readonly durationTicks: number;
    readonly damage: number;
    readonly rockRadius: number;
    readonly rockDelayTicks: number;
    readonly intervalTicks: number;
    readonly throwRadius: number;
  };
  /** Brasa → Tormenta → Brasa: una esfera que explota cuando un hechizo tuyo la toca. */
  readonly solarGrenade: {
    readonly range: number;
    readonly radius: number;
    readonly durationTicks: number;
    readonly damage: number;
    readonly blastRadius: number;
  };
  /** Brasa → Tormenta → Tormenta: cada hechizo te da un salto corto (estado `propelled`). */
  readonly propulsion: Record<string, never>;
  /** Brasa → Tormenta → Marea: una tormenta que lanza rayos a los rivales adentro. */
  readonly monsoon: AreaSpell & { readonly damage: number; readonly intervalTicks: number };
  /** Brasa → Marea → Brasa: tu próximo hechizo de daño pega el doble (estado `forged`). */
  readonly forge: Record<string, never>;
  /** Brasa → Marea → Tormenta: vapor que rompe escudos y no deja tenerlos (estado `scalded`). */
  readonly scald: ConeSpell;
  /** Brasa → Raíz → Brasa: una semilla que explota al recibir un golpe (estado `emberSeed`). */
  readonly emberSeed: { readonly range: number; readonly coneDot: number };
  /** Brasa → Raíz → Marea: una columna de humo que nadie atraviesa con la vista. */
  readonly bonfireSmoke: AreaSpell;
  /** Brasa → Raíz → Raíz: una fogata donde tu equipo descansa los elementos (estado `kindled`). */
  readonly bonfire: AreaSpell;
  /** Brasa → Umbra → Raíz: si el marcado cae o queda muy herido, descansas y te curas. */
  readonly ashHunger: { readonly range: number; readonly coneDot: number; readonly heal: number };
  /** Brasa → Umbra → Umbra: tu próximo hechizo sale dos veces (estado `echoing`). */
  readonly burningEcho: Record<string, never>;
  /** Tormenta → Brasa → Brasa: tus próximos hechizos salen sin canalizar (estado `overcharged`). */
  readonly overload: Record<string, never>;
  /** Tormenta → Brasa → Tormenta: atraes los proyectiles y te dan escudo (estado `attracting`). */
  readonly humanRod: Record<string, never>;
  /** Tormenta → Brasa → Raíz: armado un rato, cancela el tejido del rival y lo aturde (estado `primed`). */
  readonly shortCircuit: { readonly range: number; readonly stunTicks: number };
  /** Tormenta → Brasa → Umbra: cansa el último elemento que usaron los rivales cercanos. */
  readonly thunderclap: { readonly radius: number; readonly fatigueTicks: number };
  /** Tormenta → Tormenta → Raíz: tres tótems unidos por rayos que aturden a quien cruza. */
  readonly totemCircle: {
    readonly range: number;
    readonly spread: number;
    readonly durationTicks: number;
    readonly stunTicks: number;
    readonly halfWidth: number;
  };
  /** Tormenta → Tormenta → Umbra: intocable, saltas golpeando a los rivales cercanos. */
  readonly thousandSteps: {
    readonly damage: number;
    readonly range: number;
    readonly hops: number;
    readonly intervalTicks: number;
  };
  /** Tormenta → Marea → Marea: un camino de hielo donde todos se deslizan sin girar. */
  readonly iceTrack: {
    readonly length: number;
    readonly halfWidth: number;
    readonly durationTicks: number;
    readonly slideSpeed: number;
  };
  /** Tormenta → Marea → Umbra: una ráfaga que apaga invocaciones, trampas y zonas rivales. */
  readonly gale: { readonly range: number; readonly coneDot: number };
  /** Tormenta → Raíz → Brasa: un rayo que diriges mientras te quedas quieto. */
  readonly guidedBolt: {
    readonly damage: number;
    readonly speed: number;
    readonly radius: number;
    readonly durationTicks: number;
    /** Cuánto gira hacia el dedo en cada paso, de 0 a 1. */
    readonly turnRate: number;
  };
  /** Tormenta → Raíz → Tormenta: un cable por el que tu equipo viaja rápido. */
  readonly zipline: {
    readonly length: number;
    readonly durationTicks: number;
    readonly speed: number;
    readonly grab: number;
  };
  /** Tormenta → Raíz → Marea: tu equipo y tus invocaciones actúan más rápido adentro. */
  readonly acceleratedGrowth: AreaSpell;
  /** Tormenta → Raíz → Raíz: activa a la vez tus trampas, esferas e invocaciones cercanas. */
  readonly powerGrid: { readonly radius: number; readonly damage: number; readonly reach: number };
  /** Tormenta → Umbra → Brasa: vuelves a donde estabas hace 3 s, con la vida de entonces. */
  readonly rewind: { readonly sampleTicks: number; readonly samples: number };
  /** Tormenta → Umbra → Marea: el rival queda detenido en el tiempo (estado `halted`). */
  readonly instant: { readonly range: number; readonly coneDot: number };
  /** Tormenta → Umbra → Raíz: une a dos rivales; si se separan, quedan aturdidos. */
  readonly linkBolt: {
    readonly range: number;
    readonly coneDot: number;
    readonly durationTicks: number;
    readonly maxGap: number;
    readonly stunTicks: number;
  };
  /** Marea → Tormenta → Brasa: si acierta, robas una Esencia o, si no tiene, descanso. */
  readonly siphon: ProjectileSpell;
  /** Marea → Tormenta → Marea: nadie salta ni se teletransporta adentro (estado `grounded`). */
  readonly deluge: AreaSpell;
  /** Marea → Tormenta → Umbra: copias el último hechizo del rival para lanzarlo tú. */
  readonly reflection: { readonly heldTicks: number };
  /** Marea → Marea → Umbra: devuelves los proyectiles (estado `mirroring`). */
  readonly waterMirror: Record<string, never>;
  /** Marea → Raíz → Tormenta: hojas en el suelo; tocando una saltas a otra. */
  readonly lilyPads: {
    readonly count: number;
    readonly spread: number;
    readonly radius: number;
    readonly durationTicks: number;
  };
  /** Marea → Raíz → Umbra: si caes pronto, vuelves (estado `rebirth`). Una vez por ronda. */
  readonly rebirth: Record<string, never>;
  /** Marea → Umbra → Marea: el daño te llega de a poco (estado `depth`). */
  readonly depth: Record<string, never>;
  /** Marea → Umbra → Umbra: vacía el tejido rival y no deja repetir (estado `forgetful`). */
  readonly oblivionMist: { readonly radius: number };
  /** Raíz → Brasa → Tormenta: polen que explota si lo toca un hechizo con Brasa. */
  readonly pollen: AreaSpell & { readonly damage: number };
  /** Raíz → Brasa → Marea: un hongo que tapa la vista y suelta esporas al golpearlo. */
  readonly giantMushroom: SummonSpell & {
    readonly range: number;
    readonly sporeRadius: number;
    readonly slowTicks: number;
  };
  /** Raíz → Brasa → Umbra: quien te pega recibe la mitad de vuelta (estado `thorny`). */
  readonly nettle: Record<string, never>;
  /** Raíz → Marea → Brasa: tus invocaciones cercanas tienen más vida y daño un rato. */
  readonly fertilize: {
    readonly radius: number;
    readonly durationTicks: number;
    readonly multiplier: number;
  };
  /** Raíz → Marea → Tormenta: cada hechizo que lanzas cura a tu equipo (estado `dewy`). */
  readonly dew: Record<string, never>;
  /** Raíz → Marea → Marea: secas el agua cercana y te curas por cada cosa. */
  readonly drought: { readonly radius: number; readonly healPerItem: number };
  /** Raíz → Marea → Raíz: el daño que recibe tu aliado o tú se reparte (estado `grafted`). */
  readonly graft: { readonly range: number; readonly coneDot: number };
  /** Raíz → Marea → Umbra: las curaciones del rival le hacen daño (estado `rotting`). */
  readonly rot: { readonly range: number; readonly coneDot: number };
  /** Raíz → Umbra → Raíz: los rivales adentro no descansan (estado `withered`). */
  readonly wither: AreaSpell;
  /** Raíz → Umbra → Umbra: te quedas el próximo hechizo del rival (estado `robbed`). */
  readonly pickpocket: {
    readonly range: number;
    readonly coneDot: number;
    readonly heldTicks: number;
  };
  /** Umbra → Brasa → Brasa: si al rival le queda poca vida, cae al instante. */
  readonly fatalShadow: {
    readonly range: number;
    readonly coneDot: number;
    readonly threshold: number;
  };
  /** Umbra → Brasa → Marea: los botones del rival cambian de lugar (estado `hexed`). */
  readonly evilEye: { readonly range: number; readonly coneDot: number };
  /** Umbra → Brasa → Umbra: tú y el rival no pueden hacerse daño (estado `oath`). */
  readonly oath: { readonly range: number; readonly coneDot: number };
  /** Umbra → Tormenta → Brasa: lanzas tu sombra y puedes teletransportarte a ella. */
  readonly thrownShadow: { readonly distance: number; readonly durationTicks: number };
  /** Umbra → Marea → Brasa: los rivales del cono no hacen daño (estado `muted`). */
  readonly lament: { readonly range: number; readonly coneDot: number };
  /** Umbra → Marea → Marea: los proyectiles cercanos quedan flotando (estado `wailing`). */
  readonly abyssWail: Record<string, never>;
  /** Umbra → Marea → Umbra: si tienes menos vida que el rival, intercambian el porcentaje. */
  readonly transfusion: { readonly range: number; readonly coneDot: number };
  /** Umbra → Raíz → Brasa: un muñeco: el daño que le haces lo recibe el rival marcado. */
  readonly voodooDoll: SummonSpell & {
    readonly range: number;
    readonly coneDot: number;
    readonly distance: number;
  };
  /** Umbra → Raíz → Marea: golpes fuertes y caídas cercanas te dan Esencia (estado `harvesting`). */
  readonly soulHarvest: Record<string, never>;
  /** Umbra → Raíz → Raíz: una planta escondida que silencia y revela a quien la pisa. */
  readonly mandrake: {
    readonly range: number;
    readonly radius: number;
    readonly durationTicks: number;
    readonly armTicks: number;
    readonly silenceTicks: number;
  };
  /** Umbra → Umbra → Raíz: si caes o quedas muy herido, el marcado recibe daño (estado `vengeful`). */
  readonly vengeance: { readonly range: number; readonly coneDot: number };
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
