import type { ElementId } from '@crisol/core';

/** Lo que dice un maestro al terminar una serie, según cómo salió. */
export interface MasterLines {
  /** Al tocar su Linaje en la elección: cómo te recibe. */
  readonly welcome: string;
  readonly win: readonly string[];
  readonly loss: readonly string[];
  /** Ganaste en la ronda decisiva (el rival quedó a una ronda). */
  readonly closeWin: readonly string[];
  /** Perdiste en la ronda decisiva. */
  readonly closeLoss: readonly string[];
  readonly draw: readonly string[];
}

/**
 * El maestro de un Linaje: quien recibe al aprendiz y le comenta cada partida. Su cara es uno
 * de los arquetipos del Vestidor. El tono está en `docs/lore.md`: el mundo es grave, los
 * maestros tienen opinión y humor seco. Frases cortas: caben en una línea a 844×390.
 */
export interface Master {
  readonly element: ElementId;
  readonly name: string;
  /** El arquetipo del Vestidor que le da la cara (`ARCHETYPES`). */
  readonly archetype: string;
  /** Cómo es, en pocas palabras (para quien escriba más líneas). */
  readonly personality: string;
  readonly lines: MasterLines;
}

export const MASTERS: readonly Master[] = [
  {
    element: 'brasa',
    name: 'Vesk, la Salamandra',
    archetype: 'lagarto',
    personality: 'Impaciente y brutalmente honesta; solo respeta los resultados.',
    lines: {
      welcome: '¿Otro aprendiz? Muéstrame que ardes, o vuelve a tu aldea.',
      win: [
        'Bien. Eso fue fuego. No te acostumbres a que te felicite.',
        'Así se quema. Mañana, más fuerte.',
        'Ganaste. Que lo recuerden: para eso se gana.',
      ],
      loss: [
        '¿Perdiste? Bien. Ahora sabes cuánto pesa la ceniza.',
        'Tibio. Y nadie recuerda a los tibios.',
        'Dudaste. El fuego no duda.',
      ],
      closeWin: [
        'Casi te apagan. Casi. Eso es lo que te hace peligroso.',
        'Ganaste por un pelo chamuscado. Sirve igual.',
      ],
      closeLoss: [
        'Ardiste bien y perdiste igual. Pasa. Que no pase dos veces.',
        'Te faltó una chispa. Una. Búscala.',
      ],
      draw: ['¿Empate? El fuego no empata. Otra vez.'],
    },
  },
  {
    element: 'tormenta',
    name: 'Hermano Iskel',
    archetype: 'monje',
    personality: 'Tranquilo, se ríe de todo y nunca está donde lo dejaste.',
    lines: {
      welcome: 'Bienvenido. No te pongas cómodo: aquí nadie se queda quieto.',
      win: [
        'Ni te vieron pasar. Así me gusta.',
        'Rápido y sin drama. El cielo aprueba.',
        'Ganaste. Ahora sigue moviéndote, que esto no termina.',
      ],
      loss: [
        'Te alcanzaron porque te quedaste quieto. Clásico.',
        'El rayo no pide permiso. Tú esperaste.',
        'Perdiste. Respira, y vuelve a correr.',
      ],
      closeWin: [
        'Uf, qué ventolera. Ganaste, y hasta yo me despeiné.',
        'Por poco. Lo bueno del viento: siempre cambia.',
      ],
      closeLoss: [
        'Estuvo cerca. Una vuelta más rápida y era tuya.',
        'Te faltó un salto. Uno solo. Ja.',
      ],
      draw: ['Empate. El cielo se encogió de hombros.'],
    },
  },
  {
    element: 'marea',
    name: 'Dorn, el que guarda los nombres',
    archetype: 'nigromante',
    personality:
      'Melancólico; habla de los caídos como de viejos amigos y lleva la cuenta de todo.',
    lines: {
      welcome: 'Llegaste. Escribiré tu nombre: el mar no olvida a nadie.',
      win: [
        'Anoto tu victoria junto a las de los que vinieron antes.',
        'El agua esperó, y el agua ganó. Como siempre.',
        'Hoy el mar recordará tu nombre con cariño.',
      ],
      loss: [
        'Anoté tu derrota. Al mar le gusta que alguien lleve la cuenta.',
        'Los que cayeron antes también perdieron así. Y volvieron.',
        'La marea baja. Siempre vuelve a subir.',
      ],
      closeWin: [
        'Por una ola. Las mejores victorias se ganan por una ola.',
        'Casi te arrastra la corriente. "Casi" no va en mi libro.',
      ],
      closeLoss: [
        'Tan cerca que dolió. Lo anoto con letra pequeña.',
        'El agua no olvida su cauce. Tú no olvides este.',
      ],
      draw: ['Empate. El mar no sabe qué escribir.'],
    },
  },
  {
    element: 'raiz',
    name: 'Madre Musgo',
    archetype: 'bruja',
    personality: 'Cálida y protectora; te reta como una abuela.',
    lines: {
      welcome: 'Ven, mijo, siéntate. Aquí nadie crece solo.',
      win: [
        '¡Eso, mijo! Así se crece.',
        'Ganaste. Que no se te suban los humos, que te podo.',
        'Raíces firmes. Estoy orgullosa.',
      ],
      loss: [
        'Nadie crece solo, mijo. Ni siquiera tú.',
        'Hoy te arrancaron. Mañana echas raíces más hondas.',
        'Perdiste. Ven, que te curo y vuelves a salir.',
      ],
      closeWin: [
        'Aguantaste. Eso hacemos en Anvel: aguantar.',
        'Por poco, pero de pie. Así me gusta.',
      ],
      closeLoss: [
        'Casi, mijo, casi. El bosque tampoco creció en un día.',
        'Aguantaste harto. Un poco más y era tuya.',
      ],
      draw: ['Empate. Nadie se cae, nadie crece. Otra.'],
    },
  },
  {
    element: 'umbra',
    name: 'El Velado',
    archetype: 'sectario',
    personality: 'Nunca dice su nombre; habla en susurros y con ironía. Sabe más de lo que dice.',
    lines: {
      welcome: 'Te estaba esperando. Desde antes de que decidieras venir.',
      win: [
        'Ganaste. Nadie sabrá cómo. Así debe ser.',
        'Bien hecho. Lo vi todo. Ellos no vieron nada.',
        'Una victoria limpia. Casi demasiado visible.',
      ],
      loss: [
        'Te vi perder. Nadie más lo vio. Todavía.',
        'Te mostraste demasiado. La sombra no se muestra.',
        'Perder también enseña. Sobre todo a quien observa.',
      ],
      closeWin: ['Por poco. Pero el poco también es nuestro.', 'Casi te ven venir. Casi.'],
      closeLoss: ['Tan cerca. Interesante. Lo recordaré.', 'Faltó un instante de oscuridad. Uno.'],
      draw: ['Empate. Nadie ganó. Nadie sabe quién lo decidió.'],
    },
  },
];

/** El maestro de un Linaje. */
export function masterOf(element: ElementId): Master {
  const master = MASTERS.find((m) => m.element === element);
  if (!master) throw new Error(`Falta el maestro de ${element}`);
  return master;
}
