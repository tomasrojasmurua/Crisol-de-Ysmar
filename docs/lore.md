# Lore de Ysmar

La base de todos los textos del juego: menús, Grimorio, tutorial y voces. Lo acordó Tomás el 15 de
noviembre de 2026. Si un texto nuevo contradice este documento, manda este documento (o se cambia
aquí primero).

## Tono

**Un mundo solemne con personajes cercanos.** Lo que está en juego es serio, quién controla
Ysmar, y el arte es fantasía oscura donde solo la magia tiene color. Pero quienes le hablan al
jugador (su maestro, la voz del Crisol) tienen opinión y humor seco. El mundo es grave; nadie le
habla al jugador como un libro de historia.

- Frases cortas. Nada de párrafos de lore: el mundo se cuenta de a una línea.
- El humor sale de los personajes, nunca se burla del mundo.
- Todo nombre es inventado para Ysmar.

## La premisa

Ysmar se sostiene en **la Trama**, cinco hilos que lo tejen todo. Cuando los hilos se aflojan, **el
Crisol** despierta y llama a las aldeas. Cada aldea manda a sus aprendices a combatir, y quienes
triunfan retejen la Trama a favor de los suyos y deciden el futuro de Ysmar.

**El jugador es un aprendiz recién llegado al Crisol** que representa a su aldea y busca volverse
un hechicero capaz de decidir quién controlará Ysmar.

## El Crisol

El Crisol es **el nudo donde se juntan los cinco hilos de la Trama**: el primer lugar que se tejió
en Ysmar. No es una persona, pero tiene voluntad. No toma partido; le importa que se teja bien.
Habla poco y sin cara, como una presencia vieja que juzga.

- **El Guardián del Crisol** (el jefe en pausa) es su cuerpo: lo que levanta cuando quiere pelear
  él mismo.

## El misterio

Nadie sabe por qué los hilos se aflojan. **Esa pregunta mueve la historia:** mientras el jugador
averigua qué le pasa al Crisol, los Linajes combaten por controlar Ysmar.

La sospecha que se revela de a poco (en las líneas del Grimorio, en lo que dice el Crisol) es que
el propio Crisol afloja los hilos porque necesita que los magos vengan a pelear. Nunca se dice de
una vez.

## Los cinco Linajes

Cada elemento es un **Linaje**: una aldea con su gente, sus creencias, su estilo de magia y lo que
haría con Ysmar si gana. Los Linajes siguen el pentágono de los elementos: cada uno tiene **dos
aliados** (sus vecinos) y **dos rivales** (los de enfrente). Por eso ningún Linaje puede gobernar
solo, y por eso existe el Crisol.

| Linaje   | Aldea                  | Lema                                      | Si gana                                                          | Aliados          | Rivales          |
| -------- | ---------------------- | ----------------------------------------- | ---------------------------------------------------------------- | ---------------- | ---------------- |
| Brasa    | Cenizal, volcánica     | "Nadie recuerda a los tibios."            | Quema lo viejo para forjar algo nuevo.                           | Umbra y Tormenta | Marea y Raíz     |
| Tormenta | Las cumbres de Velgar  | "Somos libres porque nunca nos quedamos." | Nadie vuelve a gobernar a nadie.                                 | Brasa y Marea    | Raíz y Umbra     |
| Marea    | Hondamar, costa helada | "El agua no olvida su cauce."             | Ysmar vuelve a ser lo que fue antes de que la Trama se aflojara. | Tormenta y Raíz  | Umbra y Brasa    |
| Raíz     | El bosque de Anvel     | "Lo que crece junto no se arranca."       | Todas las aldeas tienen un lugar, aunque sea a la fuerza.        | Marea y Umbra    | Brasa y Tormenta |
| Umbra    | La grieta de Ossel     | "Nadie ve la mano que mueve el hilo."     | Nadie sabe que gobiernan, y así nadie los derriba.               | Raíz y Brasa     | Tormenta y Marea |

Las rivalidades tienen razón: Brasa quiere destruir lo que Marea quiere conservar, Tormenta
desprecia lo que Umbra hace en secreto, y Raíz no perdona que Brasa queme sus bosques.

En el juego se dicen "Linaje de Brasa", "Linaje de Tormenta"… En el código siguen siendo `School`
(`packages/content/src/schools.ts`).

## Los maestros

Cada Linaje tiene un maestro que recibe al aprendiz y le comenta cada partida. Su cara es un
arquetipo del Vestidor. Sus frases viven en `packages/content/src/masters.ts`.

| Linaje   | Maestro                         | Arquetipo           | Cómo es                                                             |
| -------- | ------------------------------- | ------------------- | ------------------------------------------------------------------- |
| Brasa    | Vesk, la Salamandra             | Mago lagarto        | Impaciente y brutalmente honesta; solo respeta los resultados.      |
| Tormenta | Hermano Iskel                   | Monje de la cumbre  | Tranquilo, se ríe de todo y nunca está donde lo dejaste.            |
| Marea    | Dorn, el que guarda los nombres | Nigromante          | Melancólico; habla de los caídos como de viejos amigos.             |
| Raíz     | Madre Musgo                     | Bruja del pantano   | Cálida y protectora; te reta como una abuela ("mijo").              |
| Umbra    | El Velado                       | Sectario del abismo | Nunca dice su nombre; susurra con ironía y sabe más de lo que dice. |

**La tejedora de la Trama** queda reservada para el misterio: la única que sabe algo de por qué
se aflojan los hilos.

Hoy el maestro te recibe al tocar su Linaje en la elección y dice una línea en la pantalla de
resultado (victoria, derrota, reñida o empate).

## Cómo se vive en el juego (planeado)

La dirección acordada; lo que no dice "hecho" no existe todavía.

- **Tu maestro** (hecho: elección y resultado). Falta que te guíe en el tutorial.
- **La voz del Crisol.** Solo en momentos clave: al empezar, en muerte súbita y en la victoria.
  Puede ser el narrador de ElevenLabs que ya estaba planeado.
- **Una línea de lore por hechizo** en el Grimorio, escrita como nota de tu maestro. Descubrir un
  hechizo también descubre un pedazo de Ysmar y del misterio.
- **El menú como un lugar:** el campamento de tu Linaje a las puertas del Crisol.
- **Quién controla Ysmar:** las victorias de un grupo de amigos suman para su Linaje ("Umbra
  controla Ysmar este mes"). Necesita el perfil guardado en el servidor.

## Por decidir

- Si las aldeas tienen más lugares con nombre (para mapas o menús).
