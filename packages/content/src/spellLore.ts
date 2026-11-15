import type { SpellId } from '@crisol/core';

/**
 * Una línea de lore por hechizo, para el Grimorio: la nota que dejó en el margen el maestro del
 * primer elemento del tejido (Brasa la escribe Vesk, Marea Dorn…), con su voz. Cuenta un pedazo
 * de Ysmar y, de vez en cuando, del misterio de los hilos (ver `docs/lore.md`). Nunca dice qué
 * contrarresta qué: eso lo descubre el jugador. Se escriben por tandas; los que faltan no
 * muestran nota.
 */
export const SPELL_LORE: Readonly<Partial<Record<SpellId, string>>> = {
  // Los cinco básicos
  spark: 'En Cenizal los niños aprenden la Chispa antes que a hablar. Se nota.',
  step: 'Lo primero que enseñamos en Velgar. Lo segundo: no volver a donde estabas.',
  splash:
    'Los pescadores de Hondamar lo usaban contra las gaviotas. Después llegaron pájaros peores.',
  sap: 'Savia de los árboles viejos de Anvel. Pídeles permiso antes, mijo.',
  claw: 'Nadie sabe de qué bestia es la Zarpa. En Ossel preferimos que siga así.',
  // Linaje de Brasa
  fireball: 'Lenta, sí. Por eso, cuando llega, nadie la olvida.',
  fireRain: 'Castiga al que corre. En Cenizal no huimos, y esta lluvia nos lo recuerda.',
  meteor: 'Dicen que el volcán de Cenizal nació de un Meteoro que nadie esquivó.',
  // Linaje de Tormenta
  chainLightning: 'Salta de uno a otro, como un chisme en Velgar. Nunca se queda con nadie.',
  comet: 'Te vas y dejas fuego detrás. La mejor despedida que conozco.',
  lightningRod: 'Lo clavas y te vas. El rayo hace el resto; yo me tomo un té.',
  tempest: 'Tres saltos y tres truenos. En Velgar lo llamamos saludar.',
  blizzard: 'El viento de las cumbres desvía flechas, hechizos y malas ideas.',
  // Linaje de Marea
  iceAge: 'Hondamar se congeló así una vez, entera. Anoté cada nombre que quedó bajo el hielo.',
  spring: 'El agua de Hondamar recuerda a quien la bebe. Por eso cura: te reconoce.',
  // Linaje de Raíz
  garden: 'Se planta para los tuyos. En Anvel nadie come solo, y nadie sana solo.',
  spores: 'Hongos del fondo de Anvel. Debilitan al que estorba y alimentan al bosque.',
  // Linaje de Umbra
  drain: 'Un hilo, como los de la Trama. Tirar de él es más fácil de lo que dicen.',
  blinding: 'Le quitamos al rival lo que más quiere: ver. Lo demás viene solo.',
  shackle: 'Un grillete que no se ve hasta que intentas irte. Como casi todo en Ossel.',
};
