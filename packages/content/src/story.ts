import {
  type BotLevel,
  ELEMENT_IDS,
  type ElementId,
  type GameMode,
  neighborsOf,
  opposingOf,
} from '@crisol/core';
import { ELEMENTS } from './elements';
import { OMENS } from './glyphs';
import { masterOf } from './masters';
import {
  MASTER_STORIES,
  type MasterLine,
  SONG_CHORUS,
  SONG_OPENING,
  STORY_VILLAGES,
} from './storyText';

/**
 * El modo Historia: escenas de texto entre combates contra la IA, armadas para tu Linaje. El
 * guion es el del documento de la Historia; aquí se arma, para cada Linaje, la lista de lo que
 * pasa en orden (`storyFor`). Quién te toca depende del pentágono: Arel es de tu primer Linaje
 * aliado, el aprendiz que vuelve de tu primer rival, y en el acto 2 pasan los cuatro maestros
 * vecinos y opuestos.
 *
 * Por ahora llega hasta el final del acto 2 (combate 9). El acto 3, el Guardián y los finales
 * vienen después.
 */

/** Cómo se muestra una línea. */
export type StoryLineStyle =
  /** Alguien habla: `who` y su color. */
  | 'say'
  /** Lo que se ve (cursiva). */
  | 'see'
  /** Versos de la canción, separados por saltos de línea. */
  | 'sing'
  /** La voz que cuenta, sin nombre ("Ysmar cuelga de cinco hilos."). */
  | 'tell'
  /** Un murmullo: sola, pálida, sobre negro. */
  | 'murmur'
  /** Un título a pantalla completa (el de un acto); `who` es el subtítulo. */
  | 'title'
  /** El logo del juego, el mismo del menú; `text` es su nombre, para lectores de pantalla. */
  | 'logo';

export interface StoryLine {
  readonly style: StoryLineStyle;
  readonly text: string;
  readonly who?: string;
  readonly color?: string;
  /** El retrato de quien habla o canta (`public/historia/retratos/<retrato>.webp`). */
  readonly portrait?: string;
  /**
   * Desde esta línea, la ilustración de fondo (`public/historia/escenas/<fondo>.webp`); vacío
   * la quita. Cada escena empieza sin fondo.
   */
  readonly backdrop?: string;
}

/** Un mago de un combate de la Historia. */
export interface StorySeat {
  readonly name: string;
  /** Su Linaje: teje su set y tiene su Afinidad. null: un aprendiz cualquiera. */
  readonly school: ElementId | null;
  /** Un maestro: su cara es la de su arquetipo. */
  readonly master: boolean;
}

export interface StoryScene {
  readonly kind: 'scene';
  /** Fijo: el progreso guardado cuelga de él. */
  readonly id: string;
  readonly act: number;
  readonly lines: readonly StoryLine[];
}

export interface StoryFight {
  readonly kind: 'fight';
  readonly id: string;
  readonly act: number;
  /** Del 1 al 12. */
  readonly number: number;
  readonly title: string;
  readonly mode: GameMode;
  /** Dónde se pelea: la plaza del Crisol o la jungla. */
  readonly arena: 'plaza' | 'jungle';
  readonly botLevel: BotLevel;
  /** El Presagio del combate, o null: sin Presagio. */
  readonly omenId: string | null;
  /** Tus compañeros, en orden (vacío si peleas solo). */
  readonly allies: readonly StorySeat[];
  /** Los demás magos, en orden. */
  readonly foes: readonly StorySeat[];
  /** Los dos primeros rivales pelean primero entre ellos (una cuenta pendiente). */
  readonly feud: boolean;
  /** Glifos con que empiezan los rivales: la ventaja de un maestro. */
  readonly foeGlyphs: number;
}

export type StoryBeat = StoryScene | StoryFight;

/** Continuaciones por acto: al perder con ninguna, se vuelve al inicio del acto. */
export const STORY_CONTINUES = 3;

const GOLD = '#d8bf8a';
const PALE = '#b9b2a4';

/** Quién aparece en cada ilustración de fondo: su retrato no se muestra encima. */
const BACKDROP_CAST: Readonly<Record<string, readonly string[]>> = {
  '04-posada': ['cantor'],
  '05-arel-pajaro': ['arel'],
  '09-libros-rival': ['rival'],
  '10-cuenta-pendiente': ['vesk', 'musgo'],
  '21-plaza-duelo': ['rival'],
  '22-luz-arel': ['arel'],
  '25-cinta-mesa': ['rival'],
  '26-vesk': ['vesk'],
  '27-iskel': ['iskel'],
  '28-dorn': ['dorn'],
  '29-madre-musgo': ['musgo'],
  '30-velado': ['velado'],
  '32-cinta-arena': ['rival'],
  '33-espera-jungla': ['rival'],
  '34-cenizal': ['vesk'],
  '35-velgar': ['iskel'],
  '36-hondamar': ['dorn'],
  '37-anvel': ['musgo'],
  '38-ossel': ['velado'],
  '40-vesk-se-va': ['vesk', 'musgo'],
};

/** El campamento de cada maestro afuera del Crisol, de fondo en sus duelos del acto 2. */
const CAMP_BACKDROP: Readonly<Record<ElementId, string>> = {
  brasa: '26-vesk',
  tormenta: '27-iskel',
  marea: '28-dorn',
  raiz: '29-madre-musgo',
  umbra: '30-velado',
};

/** La salida de tu aldea, con tu maestro esperándote en el camino (preludio). */
const EXIT_BACKDROP: Readonly<Record<ElementId, string>> = {
  brasa: '34-cenizal',
  tormenta: '35-velgar',
  marea: '36-hondamar',
  raiz: '37-anvel',
  umbra: '38-ossel',
};

const DUEL: GameMode = { kind: 'duel' };
const PAIRS: GameMode = { kind: 'teams', size: 2 };

function colorOf(element: ElementId): string {
  return ELEMENTS.find((e) => e.id === element)?.color ?? GOLD;
}

/** "Vesk, la Salamandra" → "Vesk"; "Madre Musgo" queda igual. */
function shortName(element: ElementId): string {
  const name = masterOf(element).name;
  return name.split(',')[0] ?? name;
}

function omenOf(element: ElementId): string | null {
  return OMENS.find((omen) => omen.element === element)?.id ?? null;
}

/** La Historia de un Linaje, de principio a fin, en orden. */
export function storyFor(school: ElementId): readonly StoryBeat[] {
  const [ally1, ally2] = neighborsOf(school);
  const [rival1, rival2] = opposingOf(school);
  const home = STORY_VILLAGES[school];
  const rivalVillage = STORY_VILLAGES[rival1];
  const rival = rivalVillage.rival;
  const own = MASTER_STORIES[school];

  /** Cambia las marcas del guion: {aldea}, {rival}, {maestro}, {cinta}, {mimaestro} y {tumaestro}. */
  const fill = (text: string): string =>
    text
      .replaceAll('{aldea}', home.village)
      .replaceAll('{rival}', rival)
      .replaceAll('{maestro}', shortName(school))
      .replaceAll('{mimaestro}', own.mine)
      .replaceAll('{tumaestro}', own.mine.replace('mi ', 'tu '))
      .replaceAll('{cinta}', rivalVillage.color)
      // "Dile a El Velado" → "Dile al Velado".
      .replaceAll(' a El ', ' al ')
      .replaceAll(' de El ', ' del ');

  const say = (who: string, color: string, text: string): StoryLine => ({
    style: 'say',
    who,
    color,
    text: fill(text),
  });
  const see = (text: string): StoryLine => ({ style: 'see', text: fill(text) });
  const tell = (text: string): StoryLine => ({ style: 'tell', text: fill(text) });
  const murmur = (text: string): StoryLine => ({ style: 'murmur', text });
  const sing = (verses: readonly string[], who?: string, color?: string): StoryLine => ({
    style: 'sing',
    text: verses.join('\n'),
    ...(who ? { who } : {}),
    ...(color ? { color } : {}),
  });
  const title = (text: string, sub?: string): StoryLine => ({
    style: 'title',
    text,
    ...(sub ? { who: sub } : {}),
  });

  /** Cambia la ilustración de fondo desde esta línea. */
  const at = (backdrop: string, line: StoryLine): StoryLine => ({ ...line, backdrop });

  const you = (text: string): StoryLine => say('Tú', colorOf(school), text);
  const crisol = (text: string): StoryLine => say('Crisol', GOLD, text);
  const cantor = (text: string): StoryLine => say('Cantor', PALE, text);
  const rivalSays = (text: string): StoryLine => say(rival, colorOf(rival1), text);
  const master = (element: ElementId, text: string): StoryLine =>
    say(shortName(element), colorOf(element), text);

  /** Las líneas de un maestro tal como están en `storyText.ts`. */
  const masterLines = (element: ElementId, lines: readonly MasterLine[]): StoryLine[] =>
    lines.map((line) =>
      'say' in line
        ? master(element, line.say)
        : 'see' in line
          ? see(line.see)
          : 'you' in line
            ? you(line.you)
            : sing(STORY_VILLAGES[element].stanza, shortName(element), colorOf(element)),
    );

  const apprentice = (name: string, element: ElementId | null): StorySeat => ({
    name,
    school: element,
    master: false,
  });
  const masterSeat = (element: ElementId): StorySeat => ({
    name: shortName(element),
    school: element,
    master: true,
  });
  const nobody = (): StorySeat => apprentice('', null);

  const scene = (id: string, act: number, lines: readonly StoryLine[]): StoryScene => ({
    kind: 'scene',
    id,
    act,
    lines,
  });
  const fight = (
    number: number,
    act: number,
    name: string,
    mode: GameMode,
    botLevel: BotLevel,
    seats: { readonly allies?: readonly StorySeat[]; readonly foes: readonly StorySeat[] },
    extra: Partial<Pick<StoryFight, 'arena' | 'omenId' | 'feud' | 'foeGlyphs'>> = {},
  ): StoryFight => ({
    kind: 'fight',
    id: `combate-${number}`,
    act,
    number,
    title: name,
    mode,
    // Como en las demás partidas, el 1v1 es en la plaza y lo demás en la jungla; la cuenta
    // pendiente del combate 7 también es en la plaza.
    arena: extra.arena ?? (mode.kind === 'duel' ? 'plaza' : 'jungle'),
    botLevel,
    omenId: extra.omenId ?? null,
    allies: seats.allies ?? [],
    foes: seats.foes,
    feud: extra.feud ?? false,
    foeGlyphs: extra.foeGlyphs ?? 0,
  });

  // Cada maestro del acto 2: antes, el reproche si eres de un Linaje rival, y su estrofa.
  const duelBefore = (element: ElementId, rivalToYou: boolean, inCamp = true): StoryLine[] => [
    inCamp
      ? at(CAMP_BACKDROP[element], master(element, MASTER_STORIES[element].before))
      : master(element, MASTER_STORIES[element].before),
    ...(rivalToYou ? [master(element, MASTER_STORIES[element].grudge)] : []),
  ];
  const duelAfter = (element: ElementId): StoryLine[] => [
    at(CAMP_BACKDROP[element], master(element, MASTER_STORIES[element].beaten)),
    ...masterLines(element, MASTER_STORIES[element].verse),
  ];

  const vesk: ElementId = 'brasa';
  const musgo: ElementId = 'raiz';
  const arel = STORY_VILLAGES[ally1];
  const ally = STORY_VILLAGES[ally2];
  const allySays = (text: string): StoryLine => say('Aliado', colorOf(ally2), text);

  // Quién tiene retrato: el Cantor, el aprendiz que vuelve, Arel y los maestros.
  const portraits = new Map<string, string>([
    ['Cantor', 'cantor'],
    [rival, 'rival'],
    ['Arel', 'arel'],
    ...ELEMENT_IDS.map((element): [string, string] => [
      shortName(element),
      MASTER_STORIES[element].portrait,
    ]),
  ]);
  // Si quien habla ya está en la ilustración de fondo, no se repite su retrato.
  const withPortraits = (beat: StoryBeat): StoryBeat => {
    if (beat.kind !== 'scene') return beat;
    let backdrop = '';
    const lines = beat.lines.map((line) => {
      backdrop = line.backdrop ?? backdrop;
      const portrait = line.who ? portraits.get(line.who) : undefined;
      const shown = portrait && !BACKDROP_CAST[backdrop]?.includes(portrait);
      return shown ? { ...line, portrait } : line;
    });
    return { ...beat, lines };
  };

  const beats: StoryBeat[] = [
    // ---------- Preludio ----------
    scene('preludio', 1, [
      at(
        '01-huida',
        see(
          'Negro. Un nudo de luz palpita en la oscuridad. Una figura joven, de espaldas, lo mira. Detrás de ella, una voz de niño:',
        ),
      ),
      say('Voz', PALE, 'Vete. Yo sostengo.'),
      see('La figura corre. No se le ve la cara.'),
      see('Cinco hilos de colores cruzan el cielo, tensos.'),
      tell('Ysmar cuelga de cinco hilos.'),
      tell('Nadie recuerda quién los tejió.'),
      at('02-ronda', see(`{aldea}, al amanecer. ${home.custom}`)),
      see('En la plaza, unos niños juegan a la ronda y cantan:'),
      sing(home.stanza),
      sing(SONG_CHORUS),
      see(
        'Al terminar la vuelta, uno de los niños sale de la ronda y se sienta afuera. Nadie lo mira. Así se juega.',
      ),
      see('El cielo cruje. Uno de los hilos tiembla y se afloja.'),
      tell('Esta noche se aflojaron otra vez.'),
      tell('Es la tercera este año.'),
      at(EXIT_BACKDROP[school], see('{maestro} te espera a la salida de la aldea.')),
      master(school, own.farewell),
      you('¿Qué pasa con los que pierden?'),
      master(school, own.dodge),
      at(
        '03-crisol-afuera',
        see(
          'El Crisol a lo lejos: un anillo de piedra en un valle negro, con cinco luces que suben al cielo.',
        ),
      ),
      crisol('Vengan. Tejan. Que el más fuerte reteje la Trama.'),
      { style: 'logo', text: 'Crisol de Ysmar' },
      at('', title('Acto 1', 'El llamado')),
    ]),

    // ---------- Acto 1 · El llamado ----------
    scene('combate-1-antes', 1, [
      at(
        '21-plaza-duelo',
        see(
          'La plaza del Crisol. {rival} te espera al otro lado, jugando con una cinta {cinta} entre los dedos.',
        ),
      ),
      crisol('Primer duelo. Que la Trama mire.'),
      rivalSays('¿De {aldea}? Allá todavía creen que esto es un honor.'),
      rivalSays('Otro más que viene a quedarse.'),
      you('¿Quedarme dónde?'),
      rivalSays('Ah. No te contaron. Mejor así.'),
    ]),
    fight(1, 1, rival, DUEL, 'apprentice', { foes: [apprentice(rival, rival1)] }),
    scene('combate-1-despues', 1, [
      at('21-plaza-duelo', rivalSays('Suerte de novato.')),
      see('Se va. A medio camino se da vuelta, como si fuera a preguntar algo. No pregunta.'),
    ]),
    scene('la-posada', 1, [
      at(
        '04-posada',
        see(
          'Esa noche. Una posada de piedra a las puertas del Crisol, llena de aprendices de las cinco aldeas que no se hablan entre ellos.',
        ),
      ),
      see('En un rincón, un viejo con un laúd gastado canta para nadie:'),
      sing(SONG_OPENING, 'Cantor', PALE),
      cantor('¿Tú de dónde eres? No, no me digas. Cántame la tuya.'),
      see('Tarareas la estrofa de {aldea}. Él cierra los ojos.'),
      cantor('Esa me faltaba bien cantada. Gracias.'),
      you('¿Para qué las junta?'),
      cantor('Una canción que nadie termina es una deuda. Alguien tiene que cobrarla.'),
    ]),
    scene('combate-2-antes', 1, [
      at(
        '05-arel-pajaro',
        see(`Arel, ${arel.from}, te enseña un pájaro de madera tallado a mano.`),
      ),
      say(
        'Arel',
        colorOf(ally1),
        'Es para mi hermano chico. Le prometí que se lo llevaba de vuelta.',
      ),
      say('Arel', colorOf(ally1), 'Nuestras aldeas son aliadas. Aquí no. No es personal.'),
      you('Tampoco para mí.'),
    ]),
    fight(2, 1, 'Arel', DUEL, 'apprentice', { foes: [apprentice('Arel', ally1)] }),
    scene('combate-2-despues', 1, [
      at(
        '22-luz-arel',
        see(
          `Arel cae. Una luz ${arel.color} sube hacia el centro del Crisol, con el pájaro todavía en la mano, y se apaga.`,
        ),
      ),
      crisol('Uno menos.'),
      at(
        '23-lugar-vacio',
        see('Esa noche, en la posada, su lugar en la mesa queda vacío. Nadie pregunta por él.'),
      ),
      murmur('¿Le llegó el pájaro?'),
    ]),
    scene('combate-3-antes', 1, [
      at(
        '24-jungla-bestia',
        see(
          `La jungla. Tu aliado, ${ally.from}, tararea la misma melodía que conoces, pero con otra letra.`,
        ),
      ),
      sing(ally.stanza, 'Aliado', colorOf(ally2)),
      you('Esa canción la conozco distinta.'),
      allySays('¿Distinta? Es la de siempre. La canta todo el mundo.'),
      crisol('Se abre la jungla. Lo que vive en ella también tiene hambre.'),
      see('Entre los árboles se mueve una bestia. Tu aliado la mira:'),
      allySays(
        'Mi abuela decía que son hebras que se le caen a la Trama. Mi abuela decía muchas cosas.',
      ),
    ]),
    fight(3, 1, 'Dos aprendices, con un aliado', PAIRS, 'duelist', {
      allies: [apprentice('Aliado', ally2)],
      foes: [nobody(), nobody()],
    }),
    scene('combate-3-despues', 1, [
      at('23-lugar-vacio', you('El de la otra noche. Arel. ¿Lo conocías?')),
      allySays('¿Quién?'),
      you('El del pájaro. Se sentaba contigo.'),
      allySays('…No sé de quién me hablas.'),
      see('Lo dice de verdad.'),
      murmur('No me acuerdo de mi cara.'),
    ]),
    scene('combate-4-antes', 1, [
      at(
        '06-criba',
        see('Cuatro aprendices en la jungla. Uno es {rival}, que canta para burlarse de ti.'),
      ),
      crisol('La criba. Quedan los que deban quedar.'),
      sing(rivalVillage.stanza, rival, colorOf(rival1)),
      rivalSays('¿Tampoco te la sabías? En mi aldea la saben hasta los niños.'),
      you('¿Cada aldea tiene la suya?'),
      rivalSays('Pregúntale a {tumaestro}. Si te contesta, me avisas.'),
    ]),
    fight(4, 1, 'La criba', { kind: 'ffa', players: 4 }, 'duelist', {
      foes: [apprentice(rival, rival1), nobody(), nobody()],
    }),
    scene('combate-4-despues', 1, [
      at(
        '06-criba',
        see('Caen dos aprendices y sus luces suben. {rival} queda de pie, a duras penas.'),
      ),
      rivalSays('Sigo aquí. No te acostumbres.'),
      at(
        '25-cinta-mesa',
        see(
          'Esa noche, en la posada, {rival} se sienta a tu lado sin mirarte. Deja la cinta sobre la mesa.',
        ),
      ),
      rivalSays('Mi hermana entró el año pasado. Mara. Usaba una de estas.'),
      you('¿Y volvió?'),
      see('{rival} guarda la cinta. No contesta.'),
      murmur('¿Alguien vio mi cinta? Era de mi color.'),
    ]),
    scene('el-libro', 1, [
      at(
        '07-libro',
        see(
          'Esa misma noche, {maestro} abre el libro de tu campamento, con los nombres de esta temporada. Dos se están borrando mientras miras. Uno es Arel.',
        ),
      ),
      you('¿Qué le pasa a tu libro?'),
      ...masterLines(school, own.book),
      at('08-maestros', title('Acto 2', 'Las cinco versiones')),
    ]),

    // ---------- Acto 2 · Las cinco versiones ----------
    scene('combate-5-antes', 2, duelBefore(ally1, false)),
    fight(5, 2, shortName(ally1), DUEL, 'duelist', { foes: [masterSeat(ally1)] }),
    scene('combate-5-despues', 2, [
      ...duelAfter(ally1),
      master(ally1, 'Dile a {maestro} que todavía me debe una.'),
      you('¿Conoces a {mimaestro}?'),
      master(ally1, 'Desde antes de las canas. Anda, que se hace tarde.'),
      at(
        '04-posada',
        see(
          'Esa noche, en la posada, el Cantor te pide la estrofa que acabas de oír. La anota en el cuero de su laúd, junto a otras.',
        ),
      ),
    ]),
    scene('combate-6-antes', 2, duelBefore(rival1, true)),
    fight(6, 2, shortName(rival1), DUEL, 'master', { foes: [masterSeat(rival1)] }),
    scene('combate-6-despues', 2, [
      ...duelAfter(rival1),
      at(
        '04-posada',
        see(
          `${shortName(rival1)} se va sin despedirse. En la posada, le cuentas al Cantor las versiones que llevas.`,
        ),
      ),
      cantor('Cada aldea dice que ella era suya.'),
      cantor('Eso solo se dice de los muertos que uno dejó solos.'),
      you('¿Quién era?'),
      cantor('Pregúntale a la estrofa que falta.'),
      murmur('Mamá, ya voy. Ya voy.'),
    ]),
    scene('la-posada-mas-tarde', 2, [
      at(
        '04-posada',
        see(
          'Más tarde, {rival} entra empapado y se sienta frente a ti sin pedir permiso. Trae la cinta amarrada en la muñeca.',
        ),
      ),
      rivalSays('Cada campamento tiene un libro con los nombres.'),
      rivalSays('A mí no me dejan mirarlos. A ti sí.'),
      you('¿Por qué yo?'),
      rivalSays('Porque tú todavía preguntas. Yo ya solo busco.'),
      at(
        '09-libros-rival',
        see(
          'Esa noche recorren juntos los campamentos dormidos. En cada libro hay nombres que se borran. El de Mara no está en ninguno.',
        ),
      ),
      see('Al amanecer, {rival} se ríe de cansancio, no de burla.'),
      rivalSays('Mañana sigo solo. No te acostumbres.'),
      see('Esta vez lo dice sin creérselo.'),
    ]),
    scene('combate-7-antes', 2, [
      at(
        '10-cuenta-pendiente',
        see(
          'La plaza del Crisol, de noche. Vesk y Madre Musgo llegan por lados opuestos. Ninguna te mira a ti.',
        ),
      ),
      crisol('Tres en la arena. Que la Trama mire.'),
      master(vesk, 'Treinta años sin cruzarnos. Y nos junta un aprendiz.'),
      master(musgo, 'No nos juntó nada. Viniste a buscar a quién culpar.'),
      master(vesk, 'Como siempre.'),
      school === vesk
        ? master(vesk, 'Hoy no te voy a cuidar. A ella tampoco.')
        : school === musgo
          ? master(musgo, 'Hoy no soy tu maestra, mijo. Defiéndete.')
          : see('Ninguna te defiende: eres lo que quedó al medio.'),
    ]),
    fight(
      7,
      2,
      'La cuenta pendiente',
      { kind: 'ffa', players: 3 },
      'master',
      { foes: [masterSeat(vesk), masterSeat(musgo)] },
      { feud: true, arena: 'plaza' },
    ),
    scene('combate-7-despues', 2, [
      // Sobre negro, con los retratos grandes de las dos: la ilustración 10 salió igual que la
      // criba y está por rehacerse.
      at('', see('Las dos quedan de rodillas, sin aire.')),
      master(musgo, 'Tú cortaste.'),
      master(vesk, 'Y tú no hiciste nada.'),
      master(musgo, 'Tiré de él hasta que me sangraron las manos.'),
      master(vesk, 'Yo también tengo manos. Mira lo que hicieron.'),
      see('Se dan cuenta de que estás ahí. Se callan al mismo tiempo.'),
      you('¿De quién hablan?'),
      master(vesk, 'De nadie.'),
      at('40-vesk-se-va', see('Se va.')),
      master(musgo, 'De alguien que ya no está, mijo. Ve a dormir.'),
      murmur('Hermana, no tires más. Duele.'),
    ]),
    scene('combate-8-antes', 2, duelBefore(ally2, false)),
    fight(8, 2, shortName(ally2), DUEL, 'master', { foes: [masterSeat(ally2)] }, { foeGlyphs: 1 }),
    scene('combate-8-despues', 2, [
      ...duelAfter(ally2),
      at(
        '41-fogata-maestro',
        see(`Junto a la fogata, ${shortName(ally2)} habla sin mirarte, como para sí.`),
      ),
      master(ally2, 'La última vez que alguien llegó al centro éramos cinco.'),
      see('Se corrige, muy bajo:'),
      master(ally2, 'Seis.'),
      you('¿Seis?'),
      master(ally2, 'Duerme.'),
      at(
        '31-muro-respira',
        see(
          'Esa noche, junto al muro del Crisol, crees oír algo. Como alguien que respira con esfuerzo.',
        ),
      ),
      murmur('No corran. No corran.'),
    ]),
    scene('combate-9-antes', 2, [
      at(
        '33-espera-jungla',
        see(
          '{rival} te espera en la entrada de la jungla. Trae los ojos rojos y la cinta amarrada en la muñeca.',
        ),
      ),
      rivalSays('Encontré su nombre. En el último libro, casi borrado.'),
      rivalSays('Dicen que el que gana reteje la Trama. Si gano, la traigo de vuelta.'),
      rivalSays('Hoy peleo contigo.'),
      // Habla en la entrada de la jungla, no en su campamento.
      ...duelBefore(rival2, true, false),
    ]),
    fight(
      9,
      2,
      `${shortName(rival2)} y su aprendiz`,
      PAIRS,
      'master',
      {
        allies: [apprentice(rival, rival1)],
        foes: [masterSeat(rival2), apprentice('', rival2)],
      },
      { omenId: omenOf(rival2) },
    ),
    scene('combate-9-despues', 2, [
      at('32-cinta-arena', see('Ganan. {rival} se ríe por primera vez, una risa de niño.')),
      rivalSays('Ganamos. ¿Viste? Gana—'),
      see(
        `Una luz {cinta} sube desde su pecho. {rival} se mira las manos. Sube hacia el centro del Crisol y se apaga. La cinta cae en la arena.`,
      ),
      crisol('Uno menos.'),
      see(`${shortName(rival2)} se queda mirando el lugar vacío.`),
      ...masterLines(rival2, MASTER_STORIES[rival2].shaken),
      you('¿Ustedes sabían que se quedan?'),
      master(rival2, 'Todos los maestros lo sabemos. Los mandamos sabiendo.'),
      you('¿Y por qué ahora se lleva también a los que ganan?'),
      master(rival2, 'Desde aquella noche tiene más hambre. Pregúntale a {tumaestro} qué noche.'),
      ...masterLines(rival2, MASTER_STORIES[rival2].verse),
      see('Recoges la cinta.'),
      murmur('¿Mara? ¿Eres tú?'),
      at('', title('Acto 3', 'El corazón')),
      tell('El acto 3 llega pronto.'),
    ]),
  ];
  return beats.map(withPortraits);
}
