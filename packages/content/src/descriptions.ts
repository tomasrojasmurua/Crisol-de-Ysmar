import type { SpellId } from '@crisol/core';

/**
 * Qué hace cada hechizo, en una frase, para el Grimorio y el modo entrenamiento. Sale del
 * documento de diseño (y de `docs/traspaso/tanda-4.md` para la cuarta tanda). Los números exactos
 * los muestra el juego leyendo las reglas, así que si se ajusta el balance, cambia esta frase solo
 * si cambia lo que el hechizo hace.
 */
export const SPELL_DESCRIPTIONS: Readonly<Record<SpellId, string>> = {
  spark: 'Dardo rápido: 10 de daño y quema 2 s.',
  step: 'Te desplazas 4 m hacia donde apuntas.',
  splash: 'Cono de 3 m: 6 de daño y 30% más lento por 1,5 s.',
  sap: 'Te curas 15 en 3 s.',
  claw: 'Golpe instantáneo a 6 m: 6 de daño y robas 6.',
  fireball: 'Proyectil lento y grande que explota en 3 m: 30 de daño y quema.',
  comet: 'Te lanzas 8 m y dejas un rastro de fuego por 3 s que quema a quien lo pise.',
  blink: 'Te teletransportas 7 m al instante, incluso a través de árboles y rocas.',
  chainLightning: 'Rayo instantáneo a 9 m que salta a dos blancos más cercanos: 18, 12 y 8.',
  geyser:
    'Marcas un punto a 8 m; tras 0,6 s de aviso brota un géiser hirviente de 2 m que levanta por los aires 1 s a quien esté encima (12).',
  iceCoffin:
    'Te congelas 1,5 s: no recibes daño ni estados, pero no actúas. Al salir quedas limpio.',
  thornRush:
    'Cinco brotes de espinas avanzan en línea 10 m, uno cada 0,1 s; cada uno golpea 2 m alrededor (8 cada uno).',
  rootWall:
    'Golpeas el suelo y brota una muralla de 8 m por 5 s, de lado a donde miras. Bloquea paso y proyectiles de todos.',
  veil: 'Invisible 4 s: te ven solo a 2 m o si te pegan. El primer hechizo que lances desde el velo hace 30% más.',
  drain:
    'Atas un hilo a un rival a 7 m: le robas 8 por segundo hasta 3 s. Se corta si se aleja a más de 9 m o pasa tras un árbol.',
  obsidian:
    'Coraza que absorbe 40 por 4 s; al romperse o terminar, estalla en 2,5 m con 15 de daño.',
  wisp: 'Invoca una llama que persigue al rival más cercano por 6 s y explota al tocarlo (20). Se esquiva o se apaga de un golpe.',
  ignite:
    'Marca al rival 3 s; al terminar, explota con el 40% de todo el daño que recibió en ese tiempo.',
  blizzard:
    'Torbellino fijo de 3,5 m por 4 s: rivales dentro 40% más lentos y los proyectiles que lo cruzan se desvían.',
  lightningRod:
    'Poste por 8 s que da un rayo de 5 al rival más cercano a 7 m cada segundo. Cae con dos golpes.',
  shadowStep: 'Apareces detrás de un rival a 6 m y lo silencias 1,2 s: no puede tejer.',
  current:
    'Río de 10 m por 4 s: tú y tus aliados a favor corren 50% más rápido; los rivales que lo cruzan van lentos.',
  iceWall: 'Muro de 5 m que bloquea paso y proyectiles por 4 s.',
  spring: 'Fuente de 3 m por 5 s que cura 6 por segundo a ti y a tus aliados.',
  vine: 'Lanzas una liana a 9 m. Si toca un árbol o una roca, vuelas hacia ahí; si toca a un rival, vas hacia él y lo enraízas 0,8 s.',
  mossGuardian:
    'Invocas por 10 s una criatura de 60 de vida que te sigue, pega de cerca y se pone delante de los proyectiles.',
  spores: 'Nube de 3 m por 4 s: los rivales dentro quedan Débiles, hacen 30% menos daño por 3 s.',
  decoy: 'Quedas invisible 1,5 s y un doble tuyo corre hacia donde apuntas.',
  blinding:
    'Proyectil de sombra: el rival tocado solo ve 3 m a su alrededor por 3 s y se le apaga el minimapa.',
  shackle:
    'Atas al rival a su lugar por 4 s. Si se aleja más de 4 m, queda enraizado 1,5 s y recibe 15.',
  meteor: 'Tras 1,5 s de aviso cae en 5 m: 60 de daño.',
  fireRain: 'Por 4 s cae fuego sobre cada rival que se mueva a 10 m; quedarse quieto lo salva.',
  blackFlame: 'Proyectil que atraviesa muros, escudos e invocaciones.',
  emberStride: 'Te teletransportas a cualquier suelo que esté ardiendo a 15 m.',
  darkComet: 'Proyectil que, si acierta, te lleva junto al rival y lo silencia 1 s.',
  skySpear: 'Tras 0,5 s cae un rayo en línea de 14 m: 45 de daño.',
  tempest: 'Tres destellos de 6 m en 4 s; cada llegada descarga 10 en 2 m.',
  hurricane: 'Un tornado avanza lento y levanta por los aires 1 s a quien toca.',
  swap: 'Cambias de lugar con cualquier mago, aliado o rival, que veas a 12 m.',
  erraticOrb: 'Un orbe lento avanza 12 m y da rayos a todo rival a 4 m mientras pasa.',
  iceAge: 'Tras 0,8 s de aviso, todo rival a 6 m queda congelado 1,2 s.',
  cauldron: 'El suelo en 5 m empieza a hervir; quien siga encima a los 3 s recibe 50.',
  steamJet: 'Te impulsas 7 m hacia atrás y el chorro quema hacia adelante.',
  drown:
    'Canalizas 2 s sobre un rival a 6 m; si no sale del alcance, queda silenciado 2 s y recibe 30.',
  mangrove: 'Un muro de manglar de 6 m que frena proyectiles pero deja pasar a los magos.',
  tidalWave: 'Una ola gigante cruza el campo y deja 70% más lento a quien toca.',
  rootCatapult:
    'Una raíz te lanza en arco 12 m por encima de todo; al caer enraízas a quien esté a 3 m.',
  sowing: 'Siembra seis trampas en un área al instante.',
  thornRing: 'Un anillo de espinas ardientes de 6 m encierra a quien quede adentro por 4 s.',
  treeStride: 'Entras en un árbol y sales por otro árbol a hasta 20 m.',
  soulPyre: 'Marca hasta 3 rivales; a los 2 s cada uno recibe 25 más 10% de la vida que le falta.',
  portal:
    'Dos portales por 8 s, uno a tus pies y otro a 12 m: cualquiera que entra sale por el otro.',
  phantom: 'Por 4 s atraviesas magos, muros y árboles caminando.',
  abyss: 'Tras un aviso, un vórtice de 4 m silencia 1,5 s a todos los rivales adentro.',
  nightmare: 'El rival se duerme 2 s; despierta si recibe daño.',
  ashBird: 'Un ave de fuego vuela 12 m y vuelve, quemando todo lo que cruza.',
  wanderingSparks:
    'Tres chispas giran a tu alrededor 8 s y salen disparadas al primer rival que se acerque a 4 m.',
  magmaGolem: 'Un gólem por 12 s que se pone delante tuyo y explota al caer.',
  glacier: 'Un elemental de hielo por 10 s que congela 1 s al primer rival que toca.',
  swarm: 'Un enjambre persigue al rival por 5 s, lo ralentiza y le tapa parte de la vista.',
  rootPack: 'Cuatro bestias de raíz cargan en línea y enraízan a quien atropellan.',
  ancientTree:
    'Un árbol gigante por 15 s que bloquea proyectiles y golpea en área cada 2 s, enraizando.',
  shadowTwin: 'Un clon tuyo de 40 de vida pelea solo por 8 s con golpes básicos.',
  carnivore:
    'Una planta por 10 s traga al primer rival que se acerca, lo deja 1,5 s fuera de juego y lo escupe con daño.',
  hotSpring: 'Zona de 4 m por 6 s: tú y tus aliados tejen 40% más rápido.',
  tailwind: 'Tú y tus aliados a 8 m corren 40% más rápido por 5 s.',
  bubble: 'Encierras a un aliado, o a ti, en una burbuja que absorbe 60 por 4 s.',
  lifeWater: 'Revives al instante a un aliado caído a 8 m, con 30% de vida.',
  healingRain: 'Lluvia de 8 m por 6 s: cada segundo cura y limpia estados de tus aliados.',
  sacrifice: 'Le pasas 40 de tu vida a un aliado a 10 m.',
  garden: 'Cinco flores en el suelo; un aliado que pisa una se cura 20.',
  lifeLink: 'Por 6 s, cada golpe que das cura lo mismo a tu aliado más cercano.',
  immolation: 'Por 5 s ardes: quemas a todo a 2,5 m y te curas con ese daño.',
  stormEye: 'Por 4 s nada entra a 2 m de ti: proyectiles y magos se detienen en el borde.',
  purify: 'Te limpias de todo estado y quedas inmune a estados por 3 s, pudiendo actuar.',
  soulTide: 'Una ola recorre 12 m y te cura 10 por cada mago que atraviesa.',
  combustion: 'Por 5 s, cada hechizo que el rival teja le hace 10 de daño a él mismo.',
  speedTheft: 'Por 4 s el rival va 40% más lento y tú 40% más rápido.',
  acid: 'El rival tocado recibe 30% más daño de todo por 4 s.',
  mist: 'Nube de 6 m por 5 s: los rivales adentro tejen 50% más lento.',
  eclipse: 'Por 5 s los rivales solo ven 4 m en todo el campo; tu equipo ve normal.',
  plague: '10 de daño por segundo por 4 s, y salta a cualquier rival que se acerque a 2 m.',
  forestFire:
    'Un fuego avanza hacia donde miras y quema los árboles: abre senderos en la jungla por el resto de la ronda.',
  tameBeast: 'La bestia de la jungla que golpees pelea para ti por 20 s.',
  treeSprout: 'Haces crecer un árbol a 10 m que queda toda la ronda. Máximo 2 por mago.',
  barometer: 'Por 10 s ves cuánto le falta a cada elemento del rival para descansar.',
  hunter: 'Por 6 s ves a todos los rivales del mapa y corres 30% más rápido.',
  track: 'Por 15 s ves el rastro del rival marcado, aunque esté en la jungla.',
  sentinel: 'Un ojo de sombra por 60 s en un punto: ves todo a 8 m a su alrededor.',
  crimsonMist: 'Niebla de 7 m por 5 s: nadie ve a más de 2 m y tú robas vida con cada golpe.',
  erasingRain: 'Te quita marcas, rastros y revelaciones, y te saca del minimapa rival por 8 s.',
  mirage:
    'Tres copias tuyas aparecen y se mueven como tú por 4 s; la verdadera es la que lanza hechizos.',
  cursedGrove:
    'Brota un bosquecillo que tapa la vista; adentro eres invisible y los rivales quedan débiles.',
  mossCarpet: 'Zona de 6 m por 8 s: tu equipo adentro no aparece en el minimapa rival.',
  weaveIllusion: 'Por 8 s el rival ve elementos falsos en tu tejido.',
  borrowedShadow: 'Por 6 s eres invisible solo para el rival marcado.',
  magmaForm:
    'Por 5 s eres magma: lento, inmune a ralentizar y enraizar, y dejas suelo ardiendo al caminar.',
  surf: 'Por 5 s eres una ola: corres 80% más rápido y atraviesas magos, pero no tejes.',
  deepRoots:
    'Te enraízas tú mismo 4 s: no te mueves, pero eres inmune a control y tus hechizos llegan 50% más lejos.',
  shadowPanther: 'Por 6 s eres una pantera: rápida, con zarpazos que roban vida, pero sin tejer.',
  eruption: 'Volcán a 8 m por 6 s: corta el paso y cada 0,7 s lanza una roca de 15 que quema.',
  solarGrenade: 'Esfera a 8 m por 6 s; explota (40 en 3 m) cuando la toca un hechizo tuyo.',
  propulsion:
    '4 s: cada hechizo que lanzas te da un salto de 3 m hacia donde apuntas y deja fuego.',
  monsoon: 'Tormenta de 6 m a 8 m por 5 s: un rayo de 12 por segundo a cada rival adentro.',
  forge: 'Tu próximo hechizo de daño en 6 s hace el doble.',
  scald:
    'Cono de vapor de 6 m: 10, rompe escudos (Burbuja y Obsidiana sin estallar) y 4 s sin escudos.',
  emberSeed: 'En un aliado a 10 m o en ti, 8 s: al recibir un golpe, explota (40 en 3 m).',
  bonfireSmoke:
    'Columna de 4 m a 6 m por 8 s: quien está adentro no ve afuera ni lo ven desde afuera.',
  bonfire: 'Fogata de 3 m por 20 s: tu equipo cerca descansa los elementos el doble de rápido.',
  ashHunger: 'Marca 8 s: si el rival cae o baja de 25%, descansas todo y recuperas 30.',
  burningEcho:
    'Tu próximo hechizo en 10 s sale dos veces: la segunda 1 s después y desde el mismo lugar.',
  overload: 'Tus próximos 3 hechizos en 5 s salen con el aviso mínimo de 0,17 s.',
  humanRod: '3 s: atraes los proyectiles rivales a 6 m y cada uno te da escudo en vez de daño.',
  shortCircuit:
    'Armado 2 s: el primer rival a 8 m que teja (o ya esté tejiendo) lo pierde y queda 1 s aturdido.',
  thunderclap: 'Los rivales a 6 m quedan 5 s cansados del último elemento que usaron.',
  totemCircle: 'Tres tótems unidos por rayos por 6 s; quien cruza una línea queda 0,8 s aturdido.',
  thousandSteps: 'Intocable 1,5 s; saltas 4 veces golpeando con 14 a los rivales a 8 m.',
  iceTrack: 'Camino de 12 m por 6 s: quien entra se desliza recto hasta el final, tú incluido.',
  gale: 'Cono de 9 m que apaga invocaciones, trampas y zonas rivales.',
  guidedBolt: 'Un rayo de 35 que diriges 2 s con el pulgar de moverte; mientras tanto no caminas.',
  zipline: 'Cable de 14 m por 8 s: sales por él al instante y tu equipo viaja rápido al tocarlo.',
  acceleratedGrowth:
    '5 m por 4 s a tus pies: tu equipo teje y corre más rápido; tus invocaciones atacan antes.',
  powerGrid:
    'Activa a la vez tus trampas, Granadas, Mandrágoras e invocaciones a 12 m (rayos de 12).',
  rewind: 'Vuelves a donde estabas hace 3 s, con la vida que tenías entonces.',
  instant: 'El rival queda 1,5 s detenido en el tiempo: no se mueve, no actúa y no recibe daño.',
  linkBolt:
    'Une a dos rivales 4 s; con uno solo, lo une a ti. Si se separan a más de 6 m, se aturde 1 s.',
  siphon:
    'Dardo de 8: roba una Esencia; si el rival no tiene, le cansa un elemento y te descansa uno.',
  deluge: 'Zona de 8 m por 6 s donde nadie puede saltar ni teletransportarse.',
  reflection: 'Copias el último hechizo del rival: sale en tu próximo lanzamiento en 8 s.',
  waterMirror: '3 s: devuelves los proyectiles a quien los lanzó.',
  lilyPads: 'Cuatro hojas en rombo por 10 s; pisando una saltas a la que tengas más adelante.',
  rebirth: 'Si caes en 6 s, vuelves ahí mismo con 40% de vida. Una vez por ronda.',
  depth: '5 s: el daño que recibes no llega de golpe; se reparte en los 5 s siguientes.',
  oblivionMist:
    'Los rivales a 6 m pierden su tejido y no pueden repetir su último hechizo por 6 s.',
  pollen:
    'Nube de 5 m a 7 m por 6 s; si la toca un hechizo con Brasa (de quien sea), explota con 50.',
  giantMushroom:
    'Hongo de 3 m por 10 s que tapa vista y paso; al golpearlo frena a los rivales cercanos.',
  nettle: '6 s: quien te pegue recibe de vuelta la mitad del daño.',
  fertilize: 'Tus invocaciones a 8 m tienen el doble de vida y daño por 6 s.',
  dew: '6 s: cada hechizo que lanzas cura 8 a tu equipo cercano, a ti incluido.',
  drought:
    'Secas el agua a 8 m (muros de hielo, charcos, nieblas, burbujas, mojados) y te curas 8 por cada.',
  graft: 'Te unes a un aliado 6 s y el daño se reparte. Solo con aliados: en 1v1 se pierde.',
  rot: '5 s: cada curación que reciba el rival le hace daño.',
  wither: 'Zona de 6 m por 6 s donde los rivales no descansan sus elementos.',
  pickpocket:
    'El próximo hechizo del rival en 6 s no sale: te lo quedas para tu próximo lanzamiento.',
  fatalShadow:
    'Si el rival tiene menos de 25%, cae al instante (con la Profundidad, de a poco); si no, nada.',
  evilEye: '5 s: al rival se le corren de lugar los botones de elementos (y las teclas 1-5).',
  oath: '3 s: ni tú ni el rival marcado pueden hacerse daño.',
  thrownShadow: 'Tu sombra vuela 10 m; en 4 s, tocar ✦ sin tejer te lleva a ella.',
  lament: 'Cono de 6 m: por 3 s, los hechizos de esos rivales no hacen daño ni queman.',
  abyssWail:
    '5 s: los proyectiles a 3 m quedan flotando; al terminar salen hacia donde miras, ya tuyos.',
  transfusion: 'Si tienes menos vida que el rival, intercambian el porcentaje. Una vez por ronda.',
  voodooDoll:
    'Un muñeco frente a ti por 6 s: todo el daño que le hagas lo recibe el rival marcado.',
  soulHarvest:
    '15 s: cada caída a 10 m te da Esencia, y también cada golpe tuyo de 15 o más (hasta 3).',
  mandrake: 'Planta escondida para el rival; al pisarla grita: silencia 2 s y lo deja a la vista.',
  vengeance: 'Marca 6 s: si caes o bajas de 20%, el rival marcado recibe 45.',
};
