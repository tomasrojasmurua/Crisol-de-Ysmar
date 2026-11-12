import type { ComboId, ElementId, SpellId, StatusId } from '@crisol/core';

/**
 * Un paso de un combo, tal como se dibuja en el Grimorio:
 * - `spell`: un hechizo justo (sus signos).
 * - `element`: cualquier hechizo de ese elemento (círculo punteado con el signo adentro).
 * - `any`: cualquier hechizo, como el que robaste con Hurto (círculo punteado vacío).
 * `ally` marca el paso que pone el compañero en los combos de equipo.
 */
export type ComboStep =
  | { readonly spell: SpellId; readonly ally?: true }
  | { readonly element: ElementId; readonly ally?: true }
  | { readonly any: true; readonly ally?: true };

export interface Combo {
  readonly id: string;
  readonly name: string;
  /** ★ básico, ★★ intermedio, ★★★ avanzado. */
  readonly level: 1 | 2 | 3;
  /** Aciertos en partidas para que aparezca en el Grimorio. */
  readonly needed: 3 | 5;
  readonly steps: readonly ComboStep[];
  readonly detail: string;
  /** Si es una reacción entre estados: el juego ya la detecta con su evento. */
  readonly reaction?: ComboId;
  /** Lo entrega el tutorial (mientras no exista, viene desbloqueado). */
  readonly tutorial?: true;
  /** Combo de equipo: el acierto cuenta para cada jugador que puso un paso. */
  readonly team?: true;
  /**
   * Todavía no se pudo confirmar con la simulación (ver `ComboDetector.test.ts`): queda en el
   * catálogo, pero el detector no lo cuenta.
   */
  readonly unverified?: true;
}

const s = (spell: SpellId): ComboStep => ({ spell });
const anyOf = (element: ElementId): ComboStep => ({ element });
const ANY: ComboStep = { any: true };

/**
 * El catálogo cerrado de combos: 6 reacciones y 78 seguidillas de hechizos. Solo documenta
 * sinergias que ya existen en el juego; acertarlos no da nada extra, el premio es descubrirlos.
 * Ver `claude/crisol-combos-grimorio.md` en el proyecto para las reglas que les dan forma.
 */
export const COMBOS: readonly Combo[] = [
  // ---------- Reacciones: el primer hechizo es un ejemplo de cómo poner el estado ----------
  {
    id: 'brasa-maldita',
    name: 'Brasa maldita',
    level: 1,
    needed: 3,
    steps: [s('spark'), anyOf('umbra')],
    detail: 'Umbra sobre quien arde: el fuego se vuelve maldición que te devuelve vida.',
    reaction: 'ashenCurse',
    tutorial: true,
  },
  {
    id: 'quiebre',
    name: 'Quiebre',
    level: 1,
    needed: 3,
    steps: [s('iceAge'), anyOf('tormenta')],
    detail: 'Tormenta sobre congelado: rompe el hielo con 50% más.',
    reaction: 'shatter',
    tutorial: true,
  },
  {
    id: 'lena',
    name: 'Leña',
    level: 1,
    needed: 3,
    steps: [s('vine'), anyOf('brasa')],
    detail: 'Brasa sobre enraizado: 25% más y vuelve a quemar.',
    reaction: 'kindling',
  },
  {
    id: 'vapor',
    name: 'Vapor',
    level: 1,
    needed: 3,
    steps: [s('spark'), anyOf('marea')],
    detail: 'Marea sobre quien arde: apaga el fuego y lo deja sin escudos 3 s.',
    reaction: 'steam',
  },
  {
    id: 'lodazal',
    name: 'Lodazal',
    level: 1,
    needed: 3,
    steps: [s('tidalWave'), anyOf('raiz')],
    detail: 'Raíz sobre empapado: enraiza 1 s.',
    reaction: 'mire',
  },
  {
    id: 'conduccion',
    name: 'Conducción',
    level: 2,
    needed: 3,
    steps: [s('tidalWave'), anyOf('tormenta')],
    detail:
      'Tormenta sobre empapado: aturde 0,6 s y pega 20% más. La ola del Maremoto tarda en llegar si el rival está lejos: la Tormenta alcanza a descansar.',
    reaction: 'conduction',
  },

  // ---------- Básico del tutorial ----------
  {
    id: 'amarre',
    name: 'Amarre',
    level: 1,
    needed: 3,
    steps: [s('vine'), s('splash')],
    detail:
      'La Liana te lleva al rival y lo enraíza; a quemarropa, el Salpicón lo deja lento para que no escape.',
    tutorial: true,
  },

  // ---------- Reacciones encadenadas ----------
  {
    id: 'raiz-y-hoguera',
    name: 'Raíz y hoguera',
    level: 3,
    needed: 5,
    steps: [s('rootPack'), s('fireball'), s('claw')],
    detail: 'Leña sobre el enraizado y luego Brasa maldita sobre la quemadura.',
  },
  {
    id: 'cometa-helado',
    name: 'Cometa helado',
    level: 3,
    needed: 5,
    steps: [s('darkComet'), s('iceAge'), s('chainLightning')],
    detail:
      'El Cometa te deja a su lado y lo silencia; cuando cae el hielo, Tormenta y Brasa ya descansaron.',
  },
  {
    id: 'vapor-y-quiebre',
    name: 'Vapor y quiebre',
    level: 3,
    needed: 3,
    steps: [s('spark'), s('iceAge'), s('tempest')],
    detail: 'Vapor y congelado en el mismo golpe; la primera llegada de la Tempestad lo quiebra.',
  },

  // ---------- Control y golpe ----------
  {
    id: 'sueno-y-lanza',
    name: 'Sueño y lanza',
    level: 2,
    needed: 3,
    steps: [s('nightmare'), s('skySpear')],
    detail: 'Dormido 2 s: la Lanza tarda 1,1 s en caer y pega 45.',
  },
  {
    id: 'por-los-aires',
    name: 'Por los aires',
    level: 2,
    needed: 3,
    steps: [s('hurricane'), s('fireball')],
    detail: 'Un segundo por los aires: la Bola ígnea, lenta, alcanza a llegar.',
  },
  {
    id: 'caida-en-raices',
    name: 'Caída en raíces',
    level: 2,
    needed: 3,
    steps: [s('geyser'), s('rootPack')],
    detail: 'Por los aires y, al caer, enraizado 1,5 s.',
  },
  {
    id: 'caer-dormido',
    name: 'Caer dormido',
    level: 3,
    needed: 3,
    steps: [{ spell: 'rootCatapult', ally: true }, s('nightmare'), s('skySpear')],
    detail:
      'Un aliado lo enraíza con la Catapulta; tú lo duermes y, con Tormenta y Brasa sin gastar, la Lanza le cae dormido.',
    team: true,
  },
  {
    id: 'sueno-tras-el-muro',
    name: 'Sueño tras el muro',
    level: 2,
    needed: 3,
    steps: [s('rootWall'), s('nightmare'), s('chainLightning')],
    detail: 'La muralla le cierra el paso, se duerme y el Rayo en cadena lo despierta de golpe.',
  },
  {
    id: 'punalada-ignea',
    name: 'Puñalada ígnea',
    level: 2,
    needed: 3,
    steps: [s('shadowStep'), s('fireball')],
    detail: 'Apareces a su espalda y queda silenciado 1,2 s: la Bola ígnea no falla.',
  },
  {
    id: 'olla-cerrada',
    name: 'Olla cerrada',
    level: 2,
    needed: 5,
    steps: [s('cauldron'), s('rootPack')],
    detail: 'Enraizado los últimos 1,5 s del hervor: no sale de la olla.',
  },
  {
    id: 'tierra-firme',
    name: 'Tierra firme',
    level: 2,
    needed: 3,
    steps: [s('deluge'), s('meteor')],
    detail: 'Bajo el Diluvio nadie salta ni se teletransporta: sale del meteoro caminando.',
  },
  {
    id: 'reloj-de-arena',
    name: 'Reloj de arena',
    level: 3,
    needed: 3,
    steps: [s('instant'), s('meteor')],
    detail: 'El meteoro cae poco después de que despierta.',
  },

  // ---------- Potenciar y preparar ----------
  {
    id: 'invierno-eterno',
    name: 'Invierno eterno',
    level: 3,
    needed: 5,
    steps: [s('burningEcho'), s('iceAge'), s('chainLightning')],
    detail: 'Congelado más de 2 s seguidos, y el rayo lo quiebra.',
  },
  {
    id: 'forja-paciente',
    name: 'Forja paciente',
    level: 2,
    needed: 5,
    steps: [s('forge'), s('skySpear')],
    detail: 'Con la Forja, y tras el descanso de Brasa, la Lanza del cielo pega 90.',
  },
  {
    id: 'emboscada',
    name: 'Emboscada',
    level: 2,
    needed: 3,
    steps: [s('veil'), s('chainLightning')],
    detail: 'Desde el Velo, el Rayo en cadena pega 30% más y sale al instante.',
  },
  {
    id: 'corrosion-electrica',
    name: 'Corrosión eléctrica',
    level: 2,
    needed: 3,
    steps: [s('acid'), s('tempest')],
    detail: 'Tres llegadas de la Tempestad sobre quien recibe 30% más.',
  },

  // ---------- Zonas, trampas y cuerpo a cuerpo ----------
  {
    id: 'siesta-explosiva',
    name: 'Siesta explosiva',
    level: 3,
    needed: 3,
    steps: [s('pollen'), s('nightmare'), s('spark')],
    detail: 'Dormido junto al Polen: la Chispa lo hace estallar. Pide Afinidad Brasa.',
  },
  {
    id: 'detonador-a-ciegas',
    name: 'Detonador a ciegas',
    level: 3,
    needed: 3,
    steps: [s('solarGrenade'), s('blinding')],
    detail: 'La Ceguera toca la granada y la hace estallar mientras él no ve.',
  },
  {
    id: 'cambio-de-olla',
    name: 'Cambio de olla',
    level: 3,
    needed: 5,
    steps: [s('cauldron'), s('swap')],
    detail: 'Hervidero bajo tus pies e Intercambio: él queda hirviendo.',
  },
  {
    id: 'jaula-y-respiro',
    name: 'Jaula y respiro',
    level: 2,
    needed: 3,
    steps: [s('thornRing'), s('sap')],
    detail:
      'Encierras al rival en el Anillo de zarzas: si sale, se quema. Mientras tanto te alejas y te curas con la Savia.',
  },
  {
    id: 'abrazo-ardiente',
    name: 'Abrazo ardiente',
    level: 2,
    needed: 3,
    steps: [s('immolation'), s('vine')],
    detail: 'Tu aura de fuego encima del rival enraizado.',
  },
  {
    id: 'bomba-viviente',
    name: 'Bomba viviente',
    level: 2,
    needed: 3,
    steps: [s('emberSeed'), s('shadowStep')],
    detail: 'Con la Semilla de fuego encima, apareces a su lado: si te pega, explota con 40.',
  },
  {
    id: 'llegar-acorazado',
    name: 'Llegar acorazado',
    level: 2,
    needed: 3,
    steps: [s('obsidian'), s('vine')],
    detail: 'Entras protegido y lo enraízas dentro del estallido.',
  },

  // ---------- En equipo ----------
  {
    id: 'acido-compartido',
    name: 'Ácido compartido',
    level: 2,
    needed: 3,
    steps: [{ spell: 'acid', ally: true }, ANY],
    detail: 'El Ácido de un aliado y, dentro de 4 s, el golpe más fuerte del otro.',
    team: true,
  },
  {
    id: 'polen-ajeno',
    name: 'Polen ajeno',
    level: 2,
    needed: 3,
    steps: [{ spell: 'pollen', ally: true }, anyOf('brasa')],
    detail: 'El Polen de un aliado estalla con cualquier Brasa, incluso la del rival.',
    team: true,
  },
  {
    id: 'aliado-bomba',
    name: 'Aliado bomba',
    level: 2,
    needed: 3,
    steps: [s('emberSeed')],
    detail: 'Semilla de fuego sobre un aliado que entra al cuerpo a cuerpo.',
    team: true,
  },

  // ---------- Control y golpe (segunda tanda) ----------
  {
    id: 'luz-en-la-pesadilla',
    name: 'Luz en la pesadilla',
    level: 2,
    needed: 3,
    steps: [s('wisp'), s('nightmare')],
    detail: 'La llama lo persigue mientras duerme y explota al llegar.',
  },
  {
    id: 'sueno-guiado',
    name: 'Sueño guiado',
    level: 2,
    needed: 3,
    steps: [s('nightmare'), s('guidedBolt')],
    detail: 'Diriges los 35 del relámpago sobre alguien que no se mueve.',
  },
  {
    id: 'apagon',
    name: 'Apagón',
    level: 3,
    needed: 3,
    steps: [s('shortCircuit'), s('nightmare')],
    detail: 'Si teje cerca, pierde el hechizo, queda aturdido 1 s y lo duermes.',
  },
  {
    id: 'abrazo-del-rio',
    name: 'Abrazo del río',
    level: 2,
    needed: 3,
    steps: [s('vine'), s('drown')],
    detail: 'Enraizado a tu lado, no alcanza a salir del Ahogo.',
  },
  {
    id: 'enjambre-y-ahogo',
    name: 'Enjambre y ahogo',
    level: 2,
    needed: 3,
    steps: [s('swarm'), s('drown')],
    detail: 'Lento y pegado al enjambre, no escapa del Ahogo.',
  },
  {
    id: 'rio-de-sangre',
    name: 'Río de sangre',
    level: 2,
    needed: 3,
    steps: [s('current'), s('drain')],
    detail: 'Él va lento en el río y tú rápido: el hilo del Drenaje no se corta.',
  },
  {
    id: 'vuelo-de-regreso',
    name: 'Vuelo de regreso',
    level: 2,
    needed: 3,
    steps: [s('speedTheft'), s('ashBird')],
    detail: 'Lento 4 s: el ave lo quema a la ida y a la vuelta.',
  },
  {
    id: 'silencio-entre-espinas',
    name: 'Silencio entre espinas',
    level: 2,
    needed: 3,
    steps: [s('abyss'), s('thornRing')],
    detail: 'Silenciado, no puede saltar fuera del anillo.',
  },
  {
    id: 'grito-y-lanza',
    name: 'Grito y lanza',
    level: 2,
    needed: 3,
    steps: [s('mandrake'), s('skySpear')],
    detail: 'Cuando pisa la Mandrágora queda silenciado 2 s y a la vista: cae la Lanza.',
  },
  {
    id: 'cadena-rota',
    name: 'Cadena rota',
    level: 3,
    needed: 5,
    steps: [s('linkBolt'), s('blink'), s('spark')],
    detail: 'Te alejas más de 6 m de un salto: queda aturdido 1 s y la Chispa lo alcanza.',
  },
  {
    id: 'lluvia-a-ciegas',
    name: 'Lluvia a ciegas',
    level: 2,
    needed: 3,
    steps: [s('blinding'), s('meteor')],
    detail: 'Ciego, no ve venir el meteoro.',
  },
  {
    id: 'pista-falsa',
    name: 'Pista falsa',
    level: 2,
    needed: 3,
    steps: [s('decoy'), s('meteor')],
    detail: 'Mientras persigue a tu doble, el meteoro cae donde va.',
  },
  {
    id: 'ojo-que-todo-lo-ve',
    name: 'Ojo que todo lo ve',
    level: 2,
    needed: 3,
    steps: [s('hunter'), s('meteor')],
    detail: 'Lo encuentras aunque se esconda en la jungla.',
  },

  // ---------- Atar y castigar (Grillete: si se aleja más de 4 m, enraizado y 15) ----------
  {
    id: 'atado-al-volcan',
    name: 'Atado al volcán',
    level: 2,
    needed: 3,
    steps: [s('eruption'), s('shackle')],
    detail: 'Las rocas caen a hasta 5 m del volcán: atado, no sale de ahí.',
  },
  {
    id: 'atado-a-la-tormenta',
    name: 'Atado a la tormenta',
    level: 2,
    needed: 3,
    steps: [s('monsoon'), s('shackle')],
    detail: 'La tormenta mide 6 m: atado al centro, se queda adentro.',
  },
  {
    id: 'orbe-y-cadena',
    name: 'Orbe y cadena',
    level: 2,
    needed: 3,
    steps: [s('shackle'), s('erraticOrb')],
    detail: 'Lo atas con el Grillete y le mandas el orbe encima: si se aparta, queda enraizado.',
  },
  {
    id: 'quieto-o-quemado',
    name: 'Quieto o quemado',
    level: 2,
    needed: 3,
    steps: [s('fireRain'), s('shackle')],
    detail: 'Moverse lo quema y alejarse lo enraíza.',
  },

  // ---------- Ollas y trampas de terreno ----------
  {
    id: 'olla-con-cerco',
    name: 'Olla con cerco',
    level: 3,
    needed: 5,
    steps: [s('totemCircle'), s('cauldron')],
    detail: 'Para salir del hervor cruza una línea de tótems y queda aturdido.',
  },
  {
    id: 'olla-contra-el-muro',
    name: 'Olla contra el muro',
    level: 2,
    needed: 3,
    steps: [s('rootWall'), s('cauldron')],
    detail: 'La muralla le cierra la salida más corta del hervor.',
  },
  {
    id: 'tobogan',
    name: 'Tobogán',
    level: 3,
    needed: 3,
    steps: [s('iceTrack'), s('meteor')],
    detail: 'Quien entra se desliza hasta el final sin poder frenar: ahí cae el meteoro.',
  },
  {
    id: 'campo-electrico',
    name: 'Campo eléctrico',
    level: 2,
    needed: 3,
    steps: [s('sowing'), s('powerGrid')],
    detail: 'Detonas a la vez todas las trampas cerca de él.',
  },

  // ---------- Detonar y desde el cielo ----------
  {
    id: 'sol-helado',
    name: 'Sol helado',
    level: 2,
    needed: 3,
    steps: [s('solarGrenade'), s('iceAge')],
    detail: 'La Era de hielo lo congela y hace estallar la granada (40) en el mismo momento.',
  },
  {
    id: 'detonador',
    name: 'Detonador',
    level: 2,
    needed: 3,
    steps: [s('solarGrenade'), s('powerGrid')],
    detail: 'La haces estallar a distancia cuando él pasa.',
  },
  {
    id: 'caer-con-el-meteoro',
    name: 'Caer con el meteoro',
    level: 2,
    needed: 3,
    steps: [s('meteor'), s('emberStride')],
    detail: 'El cráter arde 4 s: te teletransportas encima.',
  },
  {
    id: 'cambio-de-cielo',
    name: 'Cambio de cielo',
    level: 3,
    needed: 5,
    steps: [s('meteor'), s('swap')],
    detail: 'Meteoro sobre ti y cambias de lugar justo antes de que caiga.',
  },
  {
    id: 'doble-cielo',
    name: 'Doble cielo',
    level: 3,
    needed: 5,
    steps: [s('burningEcho'), s('meteor')],
    detail: 'El segundo meteoro cae 1 s después en el mismo lugar: esquivar el primero no basta.',
  },
  {
    id: 'muneco-y-meteoro',
    name: 'Muñeco y meteoro',
    level: 3,
    needed: 5,
    steps: [s('voodooDoll'), s('meteor')],
    detail: 'El muñeco no se mueve: los 60 le llegan enteros al marcado.',
  },
  {
    id: 'tras-la-muralla',
    name: 'Tras la muralla',
    level: 2,
    needed: 3,
    steps: [s('rootWall'), s('blackFlame')],
    detail: 'Tu muralla lo frena todo menos la Llama negra, que la atraviesa.',
  },

  // ---------- Robar y devolver ----------
  {
    id: 'hurto-devuelto',
    name: 'Hurto devuelto',
    level: 2,
    needed: 3,
    steps: [s('pickpocket'), ANY],
    detail: 'Le robas un hechizo y se lo lanzas: su gran hechizo, contra él.',
  },
  {
    id: 'tu-propia-arma',
    name: 'Tu propia arma',
    level: 2,
    needed: 3,
    steps: [s('reflection'), ANY],
    detail: 'Copias su hechizo y se lo devuelves.',
  },
  {
    id: 'escudo-y-hoguera',
    name: 'Escudo y hoguera',
    level: 3,
    needed: 3,
    steps: [s('humanRod'), s('immolation')],
    detail:
      'El Pararrayos convierte en escudo los proyectiles que te lanzan; con ese escudo te metes entre ellos ardiendo y te curas con el fuego.',
  },
  {
    id: 'tormenta-de-vuelta',
    name: 'Tormenta de vuelta',
    level: 3,
    needed: 3,
    steps: [s('abyssWail'), s('humanRod')],
    detail: 'Atraes sus proyectiles, quedan flotando y salen hacia él ya tuyos.',
  },

  // ---------- Rematar y sobrevivir ----------
  {
    id: 'hambre-y-verdugo',
    name: 'Hambre y verdugo',
    level: 3,
    needed: 5,
    steps: [s('ashHunger'), s('fatalShadow')],
    detail: 'Al bajarlo de 25% descansas todo y la Sombra fatal lo remata al instante.',
  },
  {
    id: 'venganza-y-regreso',
    name: 'Venganza y regreso',
    level: 3,
    needed: 5,
    steps: [s('vengeance'), s('rewind')],
    detail: 'Al bajar de 20%, él recibe 45 y tú vuelves a la vida que tenías hace 3 s.',
  },
  {
    id: 'corona-de-fuego',
    name: 'Corona de fuego',
    level: 2,
    needed: 3,
    steps: [s('stormEye'), s('immolation')],
    detail: 'Nada entra a 2 m y tu fuego llega a 2,5: quien se acerca se queda quemándose.',
  },
  {
    id: 'tormenta-en-la-niebla',
    name: 'Tormenta en la niebla',
    level: 2,
    needed: 3,
    steps: [s('crimsonMist'), s('tempest')],
    detail: 'Nadie ve a más de 2 m y cada llegada de la Tempestad te devuelve vida.',
  },
  {
    id: 'puerta-propia',
    name: 'Puerta propia',
    level: 2,
    needed: 3,
    steps: [s('treeSprout'), s('treeStride')],
    detail: 'Tu propio árbol como salida, donde lo quieras.',
  },

  // ---------- Invocaciones ----------
  {
    id: 'gemelo-abonado',
    name: 'Gemelo abonado',
    level: 2,
    needed: 3,
    steps: [s('shadowTwin'), s('fertilize')],
    detail: 'El doble de vida y de daño para tu clon.',
  },
  {
    id: 'guardian-abonado',
    name: 'Guardián abonado',
    level: 2,
    needed: 3,
    steps: [s('mossGuardian'), s('fertilize')],
    detail: 'Tras el descanso de Raíz y Marea, tu guardián se vuelve más fuerte.',
  },
  {
    id: 'plato-servido',
    name: 'Plato servido',
    level: 3,
    needed: 3,
    steps: [s('carnivore'), s('swap')],
    detail: 'Te paras junto a la planta, cambias de lugar y él queda al lado de su boca.',
  },

  // ---------- En equipo (segunda tanda) ----------
  {
    id: 'separar-a-los-enlazados',
    name: 'Separar a los enlazados',
    level: 2,
    needed: 3,
    steps: [s('linkBolt'), { any: true, ally: true }],
    detail:
      'Rayo de enlace sobre dos rivales y un aliado aleja a uno (Huracán, Géiser, Corriente…): ambos quedan aturdidos 1 s.',
    team: true,
  },
  {
    id: 'sacrificio-y-transfusion',
    name: 'Sacrificio y transfusión',
    level: 3,
    needed: 5,
    steps: [s('sacrifice'), s('transfusion')],
    detail: 'Le das vida a tu aliado y luego le cambias el porcentaje al rival.',
    team: true,
  },
  {
    id: 'escudo-compartido',
    name: 'Escudo compartido',
    level: 2,
    needed: 3,
    steps: [s('graft'), s('bubble')],
    detail: 'El daño se reparte y la burbuja absorbe la parte de los dos.',
    team: true,
  },
  // ---------- Tercera tanda: aguantar, devolver y escapar ----------
  {
    id: 'coraza-y-mil-pasos',
    name: 'Coraza y mil pasos',
    level: 3,
    needed: 3,
    steps: [s('obsidian'), s('thousandSteps')],
    detail:
      'La Obsidiana aguanta los golpes y, cuando te rodean, saltas intocable golpeando a todos a 8 m.',
  },
  {
    id: 'hielo-y-fuga',
    name: 'Hielo y fuga',
    level: 2,
    needed: 3,
    steps: [s('iceCoffin'), s('blink')],
    detail: 'Te congelas sin recibir daño mientras te pegan y, al salir, te teletransportas lejos.',
  },
  {
    id: 'espejo-y-salto',
    name: 'Espejo y salto',
    level: 2,
    needed: 3,
    steps: [s('waterMirror'), s('blink')],
    detail: 'Devuelves todo lo que te lanzan y después te escapas con el Destello.',
  },
  {
    id: 'olvido-y-fuga',
    name: 'Olvido y fuga',
    level: 2,
    needed: 3,
    steps: [s('oblivionMist'), s('blink')],
    detail:
      'Los que te rodean pierden lo que estaban tejiendo y tú te vas antes de que vuelvan a tejer.',
  },
  {
    id: 'trueno-y-lluvia',
    name: 'Trueno y lluvia',
    level: 2,
    needed: 3,
    steps: [s('thunderclap'), s('healingRain')],
    detail: 'El Trueno cansa a los que tienes cerca de su último elemento y la lluvia te cura.',
  },
  {
    id: 'cosecha-en-el-anillo',
    name: 'Cosecha en el anillo',
    level: 3,
    needed: 3,
    steps: [s('thornRing'), s('soulTide')],
    detail:
      'Encierras a varios en las zarzas y la Ola de almas los atraviesa: te cura por cada uno.',
  },
  {
    id: 'aguante',
    name: 'Aguante',
    level: 2,
    needed: 3,
    steps: [s('depth'), s('sap')],
    detail: 'Con la Profundidad el daño te llega de a poco, y la Savia te cura mientras tanto.',
  },
  {
    id: 'doble-y-respiro',
    name: 'Doble y respiro',
    level: 2,
    needed: 3,
    steps: [s('decoy'), s('sap')],
    detail: 'Te vuelves invisible, tu doble se los lleva y tú te curas.',
  },
];

/**
 * Cómo se reconoce en partida que un combo de hechizos salió (las reacciones ya tienen su
 * evento). Los pasos se leen de los hechizos que lanzas ('release'), en orden y sin otro hechizo
 * tuyo entre medio; el combo cuenta cuando ocurre el remate:
 * - `hit` (por defecto): golpeas a un mago rival después del último paso. Con `status`, solo si
 *   el rival tenía ese estado justo antes del golpe (dormido, en el aire, enraizado…).
 * - `reaction`: sale esa reacción, tuya, después del último paso.
 * - `cast`: basta con lanzar el último paso (cuando el remate no es un golpe: invocar, cambiar
 *   de lugar, volver atrás).
 * - `status`: un rival recibe el estado `status` después del último paso (cuando el remate es
 *   un estado sin daño, como dormirlo).
 */
export interface ComboDetect {
  readonly finish?: 'hit' | 'reaction' | 'cast' | 'status';
  readonly status?: StatusId;
  readonly reaction?: ComboId;
  /** El remate es un hilo que quita de a poco (Drenaje): cuenta cualquier golpe, por chico. */
  readonly trickle?: true;
  /** Lo que además tiene que cumplirse para que el combo cuente (ver `ComboCheck`). */
  readonly check?: ComboCheck;
  /** Plazo propio para el remate, en segundos, si tarda más que `finishWindow`. */
  readonly window?: number;
}

/**
 * Condiciones propias de algunos combos, que el detector revisa en la partida:
 * - `shackledOrb`: el rival tiene tu Grillete y tu Orbe errático lo está alcanzando.
 * - `sleepWhileStunned`: el rival se duerme estando aturdido (la Pesadilla no hace daño).
 * - `priorBigHit`: entre el primer paso y el último le hiciste un golpe de 40 o más (los 45 de
 *   la Venganza).
 * - `selfGain`: tu vida sube con el último paso (la Transfusión de verdad te cambió el
 *   porcentaje).
 * - `sharedShield`: te pegan y la burbuja de tu aliado injertado absorbe su parte.
 * - `seedOnAlly`: la Semilla de fuego que explota la llevaba un aliado, no tú.
 * - `ringActive`: tu Anillo de zarzas sigue en pie y encierra a un rival.
 * - `twoAttackers`: dos rivales distintos te atacaron (aunque no te hicieran daño) desde poco antes
 *   del primer paso hasta el último.
 * - `selfShield`: tenías escudo cuando tu fuego lo alcanzó.
 */
export type ComboCheck =
  | 'shackledOrb'
  | 'sleepWhileStunned'
  | 'priorBigHit'
  | 'selfGain'
  | 'sharedShield'
  | 'seedOnAlly'
  | 'ringActive'
  | 'twoAttackers'
  | 'selfShield';

/** Plazos del detector, en segundos. */
export const COMBO_TIMING = {
  /** Lo más que puede pasar entre un paso y el siguiente (cubre el descanso de un elemento). */
  maxGap: 8,
  /** Lo más que puede tardar el remate después del último paso (vuelo, aviso, cuenta). */
  finishWindow: 4.5,
  /**
   * Daño mínimo para que un golpe cuente como remate: así no rematan los tics de una quemadura
   * o de una zona que dejó un paso anterior.
   */
  minHit: 1,
} as const;

/** Lo que no se dice aquí es un `hit` sin estado. */
export const COMBO_DETECT: Readonly<Record<string, ComboDetect>> = {
  amarre: { status: 'root' },
  'raiz-y-hoguera': { finish: 'reaction', reaction: 'ashenCurse' },
  'cometa-helado': { finish: 'reaction', reaction: 'shatter' },
  'vapor-y-quiebre': { finish: 'reaction', reaction: 'shatter' },
  'invierno-eterno': { finish: 'reaction', reaction: 'shatter' },
  'sueno-y-lanza': { status: 'asleep' },
  'por-los-aires': { status: 'airborne' },
  'caer-dormido': { status: 'asleep' },
  'sueno-tras-el-muro': { status: 'asleep' },
  'punalada-ignea': { status: 'silenced' },
  'luz-en-la-pesadilla': { status: 'asleep' },
  'sueno-guiado': { status: 'asleep' },
  'rio-de-sangre': { trickle: true },
  'vuelo-de-regreso': { status: 'slow' },
  // Las zarzas queman al cruzarlas: el remate es una quemadura.
  'silencio-entre-espinas': { status: 'silenced', trickle: true },
  'grito-y-lanza': { status: 'silenced' },
  'lluvia-a-ciegas': { status: 'blind' },
  'caer-con-el-meteoro': { finish: 'cast' },
  'venganza-y-regreso': { finish: 'cast', check: 'priorBigHit' },
  'puerta-propia': { finish: 'cast' },
  'gemelo-abonado': { finish: 'cast' },
  'guardian-abonado': { finish: 'cast' },
  'separar-a-los-enlazados': { finish: 'cast' },
  'sacrificio-y-transfusion': { finish: 'cast', check: 'selfGain' },
  // Remata cuando te pegan y la burbuja de tu aliado absorbe su parte.
  'escudo-compartido': { finish: 'hit', check: 'sharedShield' },
  apagon: { finish: 'status', status: 'asleep', check: 'sleepWhileStunned' },
  'orbe-y-cadena': { check: 'shackledOrb', trickle: true },
  'aliado-bomba': { check: 'seedOnAlly' },
  'jaula-y-respiro': { finish: 'cast', check: 'ringActive' },
  'escudo-y-hoguera': { check: 'selfShield', trickle: true },
  // Aguantar, devolver y escapar: cuentan si dos rivales distintos te estaban atacando, o si
  // tienes a uno encerrado en las zarzas.
  'coraza-y-mil-pasos': { check: 'twoAttackers' },
  'hielo-y-fuga': { finish: 'cast', check: 'twoAttackers' },
  'espejo-y-salto': { finish: 'cast', check: 'twoAttackers' },
  'olvido-y-fuga': { finish: 'cast', check: 'twoAttackers' },
  'trueno-y-lluvia': { finish: 'cast', check: 'twoAttackers' },
  'cosecha-en-el-anillo': { finish: 'cast', check: 'ringActive' },
  aguante: { finish: 'cast', check: 'twoAttackers' },
  'doble-y-respiro': { finish: 'cast', check: 'twoAttackers' },
  // El Llanto suelta los proyectiles recién al terminar (5 s).
  'tormenta-de-vuelta': { window: 7 },
};

/**
 * Los que el detector todavía no puede distinguir de otra jugada parecida. Quedan en el
 * catálogo, pero no cuentan.
 */
export const COMBO_UNDETECTABLE: ReadonlySet<string> = new Set();
