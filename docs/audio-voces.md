# Voces: el Crisol y los maestros

Las voces del juego, para generar en ElevenLabs. Son seis voces: el Crisol, que dice los momentos
de la partida, y los cinco maestros, que te reciben, comentan cada resultado y te hablan en el
menú. Quiénes son está en [lore.md](lore.md).

**El juego ya sabe usarlas.** Cada frase es un archivo; si no existe, esa frase simplemente no
suena (las voces no tienen versión sintetizada). Se puede avanzar de a poco: con el Crisol y una
frase por momento de cada maestro ya se siente la diferencia.

## Cómo generarlas

1. En _Voice Design_, crea cada voz con su descripción (abajo). Guarda la que más te guste.
2. En _Text to Speech_, genera cada frase con su voz: estabilidad cerca de 50%, un archivo por
   frase, `.mp3`, sin silencio al inicio ni al final.
3. Nombra cada archivo como dice la tabla (por ejemplo `voice.crisol.round1.mp3`) y tráelos. Yo
   los copio a `apps/client/public/audio/` y los anoto en `manifest.json`.

Las descripciones van en inglés porque ElevenLabs las entiende mejor; las frases van en español.

## Las seis voces

**El Crisol** (`voice.crisol.…`): no es una persona, es la arena viva, el nudo de la Trama.

```text
Ancient, genderless, deep resonant voice, as if a living stone arena were speaking. Slow, measured and solemn, with a faint metallic echo and a soft layered whisper underneath. Speaks Spanish with a neutral Latin American accent. Not evil and not theatrical: an old presence that judges.
```

**Vesk, la Salamandra** (Brasa, `voice.brasa.…`)

```text
Middle-aged woman, raspy and hot-tempered voice, impatient, brutally honest, dry humor. A slight hiss on the s sounds, like a lizard. Speaks Spanish with a neutral Latin American accent. Fast and sharp delivery, never shouting.
```

**Hermano Iskel** (Tormenta, `voice.tormenta.…`)

```text
Adult man, relaxed and amused mountain monk. Light, airy voice, always on the verge of a laugh, unhurried and playful. Speaks Spanish with a neutral Latin American accent.
```

**Dorn, el que guarda los nombres** (Marea, `voice.marea.…`)

```text
Old man, soft and melancholic low voice, like a gentle keeper of graves by the sea. Slow, kind and a little sad, with long pauses. Speaks Spanish with a neutral Latin American accent.
```

**Madre Musgo** (Raíz, `voice.raiz.…`)

```text
Elderly woman, warm and protective grandmother voice, earthy and affectionate, scolds lovingly. Speaks Spanish with a Chilean accent. Cozy, close and unhurried.
```

**El Velado** (Umbra, `voice.umbra.…`)

```text
Androgynous hushed whisper, very close to the ear, ironic and quietly amused, calm and secretive. Speaks Spanish with a neutral Latin American accent. Never raises the voice.
```

## El Crisol: los momentos de la partida

| Archivo                        | Cuándo suena                     | Texto                           |
| ------------------------------ | -------------------------------- | ------------------------------- |
| `voice.crisol.round1.mp3`      | Empieza la ronda 1               | Primera ronda.                  |
| `voice.crisol.round2.mp3`      | Empieza la ronda 2               | Segunda ronda.                  |
| `voice.crisol.round3.mp3`      | Empieza la ronda 3 o siguientes  | Ronda decisiva.                 |
| `voice.crisol.convergence.mp3` | Empieza la Convergencia          | El Crisol se cierra.            |
| `voice.crisol.final.mp3`       | Empieza el Duelo final           | Duelo final.                    |
| `voice.crisol.sudden.mp3`      | Empieza la muerte súbita         | Muerte súbita. Solo uno saldrá. |
| `voice.crisol.firstFall.mp3`   | Cae el primer mago de la ronda   | El primer hilo se corta.        |
| `voice.crisol.roundWon.mp3`    | Alguien gana la ronda            | Último en pie.                  |
| `voice.crisol.victory.mp3`     | Ganas la partida                 | Victoria. La Trama te escucha.  |
| `voice.crisol.defeat.mp3`      | Pierdes la partida               | Tu hilo se ha cortado.          |
| `voice.crisol.draw.mp3`        | Empate                           | Ningún hilo prevalece.          |
| `voice.crisol.discover.mp3`    | Descubres un hechizo nuevo       | Un nuevo tejido.                |
| `voice.crisol.guardian.mp3`    | Despierta el Guardián (en pausa) | Despierto.                      |

Al terminar la partida, el Crisol dice el resultado y, apenas termina, tu maestro lo comenta.

## Los maestros: sus frases

Una fila por archivo. Si te da flojera hacerlas todas, empieza por la bienvenida y la primera
frase de cada momento (las que terminan en `.0`); las que falten no suenan.

La tabla sale de `packages/content/src/masters.ts` con `npx tsx scripts/voice-lines.ts`: si
cambias una frase, vuelve a correrlo.

<!-- frases -->

### Vesk, la Salamandra · `voice.brasa.…`

| Archivo                       | Cuándo                            | Texto                                                          |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `voice.brasa.welcome.mp3`     | Al tocar su Linaje en la elección | ¿Otro aprendiz? Muéstrame que ardes, o vuelve a tu aldea.      |
| `voice.brasa.win.0.mp3`       | Ganaste                           | Bien. Eso fue fuego. No te acostumbres a que te felicite.      |
| `voice.brasa.win.1.mp3`       | Ganaste                           | Así se quema. Mañana, más fuerte.                              |
| `voice.brasa.win.2.mp3`       | Ganaste                           | Ganaste. Que lo recuerden: para eso se gana.                   |
| `voice.brasa.closeWin.0.mp3`  | Ganaste en la ronda decisiva      | Casi te apagan. Casi. Eso es lo que te hace peligroso.         |
| `voice.brasa.closeWin.1.mp3`  | Ganaste en la ronda decisiva      | Ganaste por un pelo chamuscado. Sirve igual.                   |
| `voice.brasa.loss.0.mp3`      | Perdiste                          | ¿Perdiste? Bien. Ahora sabes cuánto pesa la ceniza.            |
| `voice.brasa.loss.1.mp3`      | Perdiste                          | Tibio. Y nadie recuerda a los tibios.                          |
| `voice.brasa.loss.2.mp3`      | Perdiste                          | Dudaste. El fuego no duda.                                     |
| `voice.brasa.closeLoss.0.mp3` | Perdiste en la ronda decisiva     | Ardiste bien y perdiste igual. Pasa. Que no pase dos veces.    |
| `voice.brasa.closeLoss.1.mp3` | Perdiste en la ronda decisiva     | Te faltó una chispa. Una. Búscala.                             |
| `voice.brasa.draw.0.mp3`      | Empate                            | ¿Empate? El fuego no empata. Otra vez.                         |
| `voice.brasa.camp.0.mp3`      | En el menú, al tocar su frase     | Nadie recuerda a los tibios. Ni a los lentos, agrego yo.       |
| `voice.brasa.camp.1.mp3`      | En el menú, al tocar su frase     | El Meteoro se esquiva. No se lo tires a alguien que corre.     |
| `voice.brasa.camp.2.mp3`      | En el menú, al tocar su frase     | Marea quiere que todo vuelva a ser como antes. Antes era peor. |
| `voice.brasa.camp.3.mp3`      | En el menú, al tocar su frase     | Los de Anvel lloran cada árbol que quemo. Que planten menos.   |
| `voice.brasa.camp.4.mp3`      | En el menú, al tocar su frase     | El Crisol no te debe nada. Gánatelo.                           |

### Hermano Iskel · `voice.tormenta.…`

| Archivo                          | Cuándo                            | Texto                                                          |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `voice.tormenta.welcome.mp3`     | Al tocar su Linaje en la elección | Bienvenido. No te pongas cómodo: aquí nadie se queda quieto.   |
| `voice.tormenta.win.0.mp3`       | Ganaste                           | Ni te vieron pasar. Así me gusta.                              |
| `voice.tormenta.win.1.mp3`       | Ganaste                           | Rápido y sin drama. El cielo aprueba.                          |
| `voice.tormenta.win.2.mp3`       | Ganaste                           | Ganaste. Ahora sigue moviéndote, que esto no termina.          |
| `voice.tormenta.closeWin.0.mp3`  | Ganaste en la ronda decisiva      | Uf, qué ventolera. Ganaste, y hasta yo me despeiné.            |
| `voice.tormenta.closeWin.1.mp3`  | Ganaste en la ronda decisiva      | Por poco. Lo bueno del viento: siempre cambia.                 |
| `voice.tormenta.loss.0.mp3`      | Perdiste                          | Te alcanzaron porque te quedaste quieto. Clásico.              |
| `voice.tormenta.loss.1.mp3`      | Perdiste                          | El rayo no pide permiso. Tú esperaste.                         |
| `voice.tormenta.loss.2.mp3`      | Perdiste                          | Perdiste. Respira, y vuelve a correr.                          |
| `voice.tormenta.closeLoss.0.mp3` | Perdiste en la ronda decisiva     | Estuvo cerca. Una vuelta más rápida y era tuya.                |
| `voice.tormenta.closeLoss.1.mp3` | Perdiste en la ronda decisiva     | Te faltó un salto. Uno solo. Ja.                               |
| `voice.tormenta.draw.0.mp3`      | Empate                            | Empate. El cielo se encogió de hombros.                        |
| `voice.tormenta.camp.0.mp3`      | En el menú, al tocar su frase     | En Velgar no hay reyes. Hay viento, y gente que se mueve.      |
| `voice.tormenta.camp.1.mp3`      | En el menú, al tocar su frase     | Si te tiran algo lento, no lo pares: no estés ahí.             |
| `voice.tormenta.camp.2.mp3`      | En el menú, al tocar su frase     | El Velado dice que lo sabe todo. Yo digo que no sabe bailar.   |
| `voice.tormenta.camp.3.mp3`      | En el menú, al tocar su frase     | Raíz quiere un lugar para todos. Yo, que nadie tenga uno fijo. |
| `voice.tormenta.camp.4.mp3`      | En el menú, al tocar su frase     | Paso no es huir. Bueno, sí es huir. Pero con estilo.           |

### Dorn, el que guarda los nombres · `voice.marea.…`

| Archivo                       | Cuándo                            | Texto                                                          |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `voice.marea.welcome.mp3`     | Al tocar su Linaje en la elección | Llegaste. Escribiré tu nombre: el mar no olvida a nadie.       |
| `voice.marea.win.0.mp3`       | Ganaste                           | Anoto tu victoria junto a las de los que vinieron antes.       |
| `voice.marea.win.1.mp3`       | Ganaste                           | El agua esperó, y el agua ganó. Como siempre.                  |
| `voice.marea.win.2.mp3`       | Ganaste                           | Hoy el mar recordará tu nombre con cariño.                     |
| `voice.marea.closeWin.0.mp3`  | Ganaste en la ronda decisiva      | Por una ola. Las mejores victorias se ganan por una ola.       |
| `voice.marea.closeWin.1.mp3`  | Ganaste en la ronda decisiva      | Casi te arrastra la corriente. "Casi" no va en mi libro.       |
| `voice.marea.loss.0.mp3`      | Perdiste                          | Anoté tu derrota. Al mar le gusta que alguien lleve la cuenta. |
| `voice.marea.loss.1.mp3`      | Perdiste                          | Los que cayeron antes también perdieron así. Y volvieron.      |
| `voice.marea.loss.2.mp3`      | Perdiste                          | La marea baja. Siempre vuelve a subir.                         |
| `voice.marea.closeLoss.0.mp3` | Perdiste en la ronda decisiva     | Tan cerca que dolió. Lo anoto con letra pequeña.               |
| `voice.marea.closeLoss.1.mp3` | Perdiste en la ronda decisiva     | El agua no olvida su cauce. Tú no olvides este.                |
| `voice.marea.draw.0.mp3`      | Empate                            | Empate. El mar no sabe qué escribir.                           |
| `voice.marea.camp.0.mp3`      | En el menú, al tocar su frase     | Llevo los nombres de todos los que cayeron aquí. Son muchos.   |
| `voice.marea.camp.1.mp3`      | En el menú, al tocar su frase     | Antes de que los hilos se aflojaran, Ysmar era otro.           |
| `voice.marea.camp.2.mp3`      | En el menú, al tocar su frase     | Brasa quema lo que no entiende. Por eso lo quema todo.         |
| `voice.marea.camp.3.mp3`      | En el menú, al tocar su frase     | El orden importa al tejer. También al recordar.                |
| `voice.marea.camp.4.mp3`      | En el menú, al tocar su frase     | Algunos nombres se borran solos de mi libro. No debería pasar. |

### Madre Musgo · `voice.raiz.…`

| Archivo                      | Cuándo                            | Texto                                                         |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------- |
| `voice.raiz.welcome.mp3`     | Al tocar su Linaje en la elección | Ven, mijo, siéntate. Aquí nadie crece solo.                   |
| `voice.raiz.win.0.mp3`       | Ganaste                           | ¡Eso, mijo! Así se crece.                                     |
| `voice.raiz.win.1.mp3`       | Ganaste                           | Ganaste. Que no se te suban los humos, que te podo.           |
| `voice.raiz.win.2.mp3`       | Ganaste                           | Raíces firmes. Estoy orgullosa.                               |
| `voice.raiz.closeWin.0.mp3`  | Ganaste en la ronda decisiva      | Aguantaste. Eso hacemos en Anvel: aguantar.                   |
| `voice.raiz.closeWin.1.mp3`  | Ganaste en la ronda decisiva      | Por poco, pero de pie. Así me gusta.                          |
| `voice.raiz.loss.0.mp3`      | Perdiste                          | Nadie crece solo, mijo. Ni siquiera tú.                       |
| `voice.raiz.loss.1.mp3`      | Perdiste                          | Hoy te arrancaron. Mañana echas raíces más hondas.            |
| `voice.raiz.loss.2.mp3`      | Perdiste                          | Perdiste. Ven, que te curo y vuelves a salir.                 |
| `voice.raiz.closeLoss.0.mp3` | Perdiste en la ronda decisiva     | Casi, mijo, casi. El bosque tampoco creció en un día.         |
| `voice.raiz.closeLoss.1.mp3` | Perdiste en la ronda decisiva     | Aguantaste harto. Un poco más y era tuya.                     |
| `voice.raiz.draw.0.mp3`      | Empate                            | Empate. Nadie se cae, nadie crece. Otra.                      |
| `voice.raiz.camp.0.mp3`      | En el menú, al tocar su frase     | ¿Comiste algo, mijo? En el Crisol nadie te va a convidar.     |
| `voice.raiz.camp.1.mp3`      | En el menú, al tocar su frase     | En Anvel cada árbol tiene nombre. Y cada incendio, también.   |
| `voice.raiz.camp.2.mp3`      | En el menú, al tocar su frase     | Si un elemento se cansa, teje otro. Un bosque no es una raíz. |
| `voice.raiz.camp.3.mp3`      | En el menú, al tocar su frase     | Tormenta corre de todo. Algún día va a tener que quedarse.    |
| `voice.raiz.camp.4.mp3`      | En el menú, al tocar su frase     | Los hilos crujen de noche. Antes no crujían.                  |

### El Velado · `voice.umbra.…`

| Archivo                       | Cuándo                            | Texto                                                           |
| ----------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `voice.umbra.welcome.mp3`     | Al tocar su Linaje en la elección | Te estaba esperando. Desde antes de que decidieras venir.       |
| `voice.umbra.win.0.mp3`       | Ganaste                           | Ganaste. Nadie sabrá cómo. Así debe ser.                        |
| `voice.umbra.win.1.mp3`       | Ganaste                           | Bien hecho. Lo vi todo. Ellos no vieron nada.                   |
| `voice.umbra.win.2.mp3`       | Ganaste                           | Una victoria limpia. Casi demasiado visible.                    |
| `voice.umbra.closeWin.0.mp3`  | Ganaste en la ronda decisiva      | Por poco. Pero el poco también es nuestro.                      |
| `voice.umbra.closeWin.1.mp3`  | Ganaste en la ronda decisiva      | Casi te ven venir. Casi.                                        |
| `voice.umbra.loss.0.mp3`      | Perdiste                          | Te vi perder. Nadie más lo vio. Todavía.                        |
| `voice.umbra.loss.1.mp3`      | Perdiste                          | Te mostraste demasiado. La sombra no se muestra.                |
| `voice.umbra.loss.2.mp3`      | Perdiste                          | Perder también enseña. Sobre todo a quien observa.              |
| `voice.umbra.closeLoss.0.mp3` | Perdiste en la ronda decisiva     | Tan cerca. Interesante. Lo recordaré.                           |
| `voice.umbra.closeLoss.1.mp3` | Perdiste en la ronda decisiva     | Faltó un instante de oscuridad. Uno.                            |
| `voice.umbra.draw.0.mp3`      | Empate                            | Empate. Nadie ganó. Nadie sabe quién lo decidió.                |
| `voice.umbra.camp.0.mp3`      | En el menú, al tocar su frase     | Los hilos no se aflojan solos. Pero eso no te lo dije yo.       |
| `voice.umbra.camp.1.mp3`      | En el menú, al tocar su frase     | Que te vean tejer es un regalo para el rival. No regales.       |
| `voice.umbra.camp.2.mp3`      | En el menú, al tocar su frase     | En Ossel aprendemos a leer el tejido ajeno antes que el propio. |
| `voice.umbra.camp.3.mp3`      | En el menú, al tocar su frase     | Tormenta grita libertad. Nosotros la tenemos, en silencio.      |
| `voice.umbra.camp.4.mp3`      | En el menú, al tocar su frase     | El Crisol tiene hambre. ¿Nunca te preguntaste de qué?           |

<!-- /frases -->
