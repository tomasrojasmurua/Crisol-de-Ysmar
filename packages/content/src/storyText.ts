import type { ElementId } from '@crisol/core';

/**
 * Las tablas del guion de la Historia que cambian según el Linaje: aldeas, estrofas, el aprendiz
 * que vuelve y la escena de cada maestro. El guion completo está en el documento de la Historia;
 * aquí va tal cual, para que `story.ts` arme las escenas de cada Linaje con estas piezas.
 */

/** Lo que cada Linaje pone en la historia. */
export interface StoryVillage {
  /** La aldea: Cenizal, Velgar… */
  readonly village: string;
  /** "de Cenizal", "de la Hondamar"… Para "Arel, de Velgar". */
  readonly from: string;
  /** Lo que se ve en la aldea al partir (preludio). */
  readonly custom: string;
  /** Su estrofa de la canción, verso por verso. */
  readonly stanza: readonly string[];
  /** El aprendiz que vuelve, si es de este Linaje. */
  readonly rival: string;
  /** El color de su cinta y de su luz ("una cinta roja", "una luz roja"). */
  readonly color: string;
}

export const STORY_VILLAGES: Readonly<Record<ElementId, StoryVillage>> = {
  brasa: {
    village: 'Cenizal',
    from: 'de Cenizal',
    custom:
      'En cada puerta arde una brasa en un cuenco de piedra. Algunas están apagadas, y nadie se para frente a esas casas.',
    stanza: [
      'Hubo un tiempo sin fogones;',
      'el fuego andaba sin casa,',
      'ardían el mar y el monte.',
      'Ella le enseñó a ser brasa.',
    ],
    rival: 'Kiro',
    color: 'roja',
  },
  tormenta: {
    village: 'Velgar',
    from: 'de Velgar',
    custom:
      'Una cama vacía, todavía tibia. Alguien partió de madrugada sin despedirse, como se hace siempre.',
    stanza: [
      'Anduvo sola en las cumbres',
      'con el viento por posada;',
      'robó un hilo a la tormenta',
      'y lo ató a la madrugada.',
    ],
    rival: 'Lío',
    color: 'blanca',
  },
  marea: {
    village: 'Hondamar',
    from: 'de Hondamar',
    custom:
      'Con la marea baja suenan campanas desde el agua. Un pescador tira una piedra al mar sin decir nada.',
    stanza: [
      'Bajo el mar duerme una aldea',
      'con su campana callada;',
      'allí nació la que teje,',
      'y allí quedó, olvidada.',
    ],
    rival: 'Neva',
    color: 'azul',
  },
  raiz: {
    village: 'Anvel',
    from: 'de Anvel',
    custom:
      'En la mesa de tu casa sobra una silla. Junto a la puerta, un árbol joven recién plantado.',
    stanza: [
      'Sentó cinco hilos a la mesa,',
      'cada hebra con su hermana;',
      'y a las que no se hablaban',
      'las juntó en la misma lana.',
    ],
    rival: 'Tamo',
    color: 'verde',
  },
  umbra: {
    village: 'Ossel',
    from: 'de Ossel',
    custom: 'Nadie dice tu nombre al despedirte. Tu madre te toca la frente y dice: "Tú".',
    stanza: [
      'Hizo un nudo con sus manos',
      'donde no llega mirada.',
      'Si te llama por tu nombre,',
      'tú no le contestes nada.',
    ],
    rival: 'Sael',
    color: 'violeta',
  },
};

/** La apertura de la canción, la de los viajeros. */
export const SONG_OPENING: readonly string[] = [
  'Cinco aldeas, cinco cantos,',
  'y una sola es la tonada;',
  'cada cual canta la suya',
  'y ninguna está acabada.',
];

/** El estribillo, igual en las cinco aldeas. */
export const SONG_CHORUS: readonly string[] = [
  'Que no se suelte la Trama,',
  'que nadie corte la hebra;',
  'mientras ella no se rinda,',
  'su abrazo nos queda.',
];

/** Una línea de una escena, antes de saber quién la dice (`me`: el maestro de la escena). */
export type MasterLine =
  | { readonly say: string }
  | { readonly see: string }
  | { readonly you: string }
  | { readonly sing: true };

/** Lo que dice y hace un maestro en la Historia, según el momento. */
export interface MasterStory {
  /** "mi maestra" o "mi maestro", para cuando el aprendiz habla de él. */
  readonly mine: string;
  /** Preludio: cómo te despide en la salida de la aldea. */
  readonly farewell: string;
  /** Preludio: qué contesta a "¿Qué pasa con los que pierden?". */
  readonly dodge: string;
  /** Fin del acto 1: qué hace cuando le preguntas por su libro. */
  readonly book: readonly MasterLine[];
  /** Acto 2, antes de pelear contigo. */
  readonly before: string;
  /** Acto 2, si eres de un Linaje rival al suyo: lo que le pasó a su aldea. */
  readonly grudge: string;
  /** Acto 2, al perder: reconoce que ganaste. */
  readonly beaten: string;
  /** Acto 2, después: canta su estrofa (`sing`) y cuenta su parte. */
  readonly verse: readonly MasterLine[];
  /** Combate 9: al ver que el Crisol se llevó al aprendiz que ganó. */
  readonly shaken: readonly MasterLine[];
}

export const MASTER_STORIES: Readonly<Record<ElementId, MasterStory>> = {
  brasa: {
    mine: 'mi maestra',
    farewell: 'El Crisol llama. Vas tú. No me hagas arrepentirme.',
    dodge: 'No pierdas y no tendrás que saberlo.',
    book: [{ say: 'Nada. Ciérralo.' }, { see: 'Lo cierra ella, de un golpe.' }],
    before: 'Sobreviviste a la criba. Veamos si ardes o solo humeas.',
    grudge: 'Hace tres inviernos ganó tu gente. Ese año Cenizal comió ceniza.',
    beaten: 'Bah. Ganaste.',
    verse: [
      { see: 'Se sienta y canta bajo, sin mirarte:' },
      { sing: true },
      { say: 'Era de Cenizal, que no te cuenten otra cosa. Le enseñó al fuego a quedarse quieto.' },
      { say: 'Y no le digas a Musgo que me ganaste. Le daría gusto.' },
    ],
    shaken: [{ say: 'Eso no pasa. Ganó. A los que ganan nunca se los lleva.' }],
  },
  tormenta: {
    mine: 'mi maestro',
    farewell: 'El Crisol llama y alguien tiene que ir. Felicidades: eres alguien.',
    dodge: 'Vuelven a casa. Más o menos.',
    book: [{ say: 'La tinta de ahora es mala. Ja.' }, { see: 'No se ríe.' }],
    before: '¡El de la criba! Te vi correr. Ahora corre de mí.',
    grudge:
      'La última vez que ganaron los tuyos se cerraron los pasos. Un año entero sin poder irnos.',
    beaten: 'Me ganaste justo cuando me ponía serio.',
    verse: [
      { see: 'Silba y canta:' },
      { sing: true },
      { say: 'Era de Velgar, obvio. Nadie le roba a la tormenta si no nació arriba.' },
      { say: '¿Dorn sigue escribiendo de noche? Dile que duerma alguna vez.' },
    ],
    shaken: [
      { say: 'No. No, no. Esa no es la regla.' },
      { see: 'Por primera vez no tiene nada que decir.' },
    ],
  },
  marea: {
    mine: 'mi maestro',
    farewell: 'El Crisol llama. Ya escribí tu nombre. Haz que valga la tinta.',
    dodge: 'Los anoto. Siempre los anoto.',
    book: [
      { say: 'Pasa cada temporada. Los vuelvo a escribir. Se vuelven a ir.' },
      { see: 'Tiene los dedos negros de tinta.' },
    ],
    before: 'Tu nombre ya está en mi libro. Veremos con qué tinta.',
    grudge: 'Hace dos inviernos ganaron los tuyos. El mar subió hasta la capilla.',
    beaten: 'Anotado: me ganaste.',
    verse: [
      { see: 'Abre el libro en la primera página. Un solo nombre, en letra antigua: Ithra.' },
      { sing: true },
      { say: 'Era de la Hondamar de abajo, la que nadie fue a buscar.' },
      { see: 'Pasa una hoja. Un nombre escrito cinco veces, con cinco letras distintas: Nilo.' },
      { you: '¿Por qué cinco veces?' },
      { say: 'Porque nadie quiso ser el único en recordarlo.' },
      { see: 'Cierra el libro.' },
    ],
    shaken: [
      {
        see: 'Abre el libro. Escribe el nombre de {rival}. La tinta empieza a borrarse antes de secarse.',
      },
    ],
  },
  raiz: {
    mine: 'mi maestra',
    farewell: 'El Crisol llama, mijo. Abrígate. Y vuelve.',
    dodge: 'No vas a perder. No te crié para eso.',
    book: [
      { say: 'Vete a dormir, mijo.' },
      { see: 'Al otro día hay dos árboles nuevos junto a la carpa.' },
    ],
    before: 'No eres de los míos, mijo, pero igual te voy a cuidar. A coscorrones.',
    grudge: 'Ganaron los tuyos y ardió medio bosque. Planté cuarenta árboles ese otoño. Cuarenta.',
    beaten: 'Así se crece.',
    verse: [
      { see: 'Te cura una herida en la rodilla mientras canta:' },
      { sing: true },
      { say: 'Era de Anvel, mijo. Ponía la mesa igual que nosotros.' },
      { say: 'Mi hermano chico también se raspaba ahí.' },
      { you: '¿Tienes un hermano?' },
      { say: 'Tenía. Come.' },
    ],
    shaken: [{ say: 'Ven acá.' }, { see: 'Te abraza fuerte, demasiado tiempo.' }],
  },
  umbra: {
    mine: 'mi maestro',
    farewell: 'El Crisol llama. Te elegí antes de que supieras caminar.',
    dodge: 'Guarda esa pregunta. La vas a necesitar.',
    book: [{ say: 'Ahora lo viste. Los demás nunca lo ven.' }],
    before: 'Te miro desde el primer duelo. Haces preguntas.',
    grudge: 'Cada vez que ganan los tuyos, la grieta se traga una calle de Ossel.',
    beaten: 'Interesante.',
    verse: [
      { see: 'Susurra:' },
      { sing: true },
      { say: 'Cada aldea jura que era suya. ¿Sabes cuál fue a buscarla? Ninguna.' },
      { say: 'Vesk siempre llega antes de tiempo. Una vez eso nos costó caro.' },
    ],
    shaken: [{ say: 'Tiene más hambre de la que creíamos.' }],
  },
};
