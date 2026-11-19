# Diseño del juego

El documento de diseño original está copiado en
[traspaso/referencia/diseno-original.md](traspaso/referencia/diseno-original.md), y el de cada hechizo
en [traspaso/referencia/rediseno-hechizos.md](traspaso/referencia/rediseno-hechizos.md). Lo que sigue
es lo vigente.

## Decisiones clave

- **Pilares:** la magia se construye, descubrir es progresar, duelos con estrategia.
- **Plataforma:** juego web que se abre desde un enlace de WhatsApp, celular **solo en horizontal**
  (en vertical una pantalla pide girarlo; en Android se fija la orientación y se pasa a pantalla
  completa al entrar a jugar). Ninguna pieza del HUD puede quedar encima de un botón.
- **Cámara:** tercera persona sobre el hombro con fijación de objetivo (elegida en el Hito 1 frente a la vista 3/4).
  Sin nada fijado no gira sola; se gira arrastrando el dedo. Tocar a un rival o una bestia (o el
  botón de duelo, el de las cuatro esquinas) entra en **duelo** (también se puede tocar una invocación rival): la cámara lo mantiene siempre al
  frente, el joystick pasa a rodearlo y un anillo brillante lo marca en el suelo. El botón pasa al siguiente
  rival de izquierda a derecha; arrastrar para mirar suelta el duelo. Se termina solo si el
  blanco cae, se esconde o pasa de 20 m.
  Gira hacia el rival solo si está a menos de 18 m; si no, conserva su dirección.
- **Mapa:** el 1v1 se juega solo en la plaza (17 m de radio, sin jungla ni bestias), para que el
  duelo empiece de inmediato. De 2v2 en adelante, el mapa completo de 40 m de radio: una plaza
  de piedra al centro (donde cierra la Convergencia), una jungla alrededor con senderos y diez campamentos de bestias, dos por elemento, en espejo para
  que ningún lado tenga ventaja. Los árboles, rocas y ruinas tapan el paso, los conjuros y la vista:
  a un rival en la jungla solo lo ves si alguien de tu equipo lo tiene cerca y a la vista.
- **Campamentos:** dos bestias cada uno; un campamento vacío se vuelve a poblar a los 45 segundos
  (si sigue dentro de la zona). El **Guardián del Crisol** (despierta en la plaza a los 40 s de
  Caza y da una Esencia de cada elemento) está en pausa hasta probar con gente.
- **Elementos:** Brasa, Tormenta, Marea, Raíz y Umbra, en un pentágono: cada uno combina con sus
  vecinos y choca con los dos de enfrente.
- **Tejido:** de 1 a 3 elementos, el orden importa, 155 conjuros base. Cada tejido es un hechizo
  propio con su efecto y su visual: 5 básicos, 25 de 2 elementos y los 125 Grandes hechizos de 3,
  completos desde la cuarta tanda (daño, control, movilidad y terreno en la primera; invocaciones,
  apoyo, refuerzo y estados en la segunda; mapa vivo, información, sigilo y transformaciones en la
  tercera; y terreno, detonadores, tiempo, copias, contrahechizos y represalias en la cuarta).
  Algunos Grandes hechizos guardan un hechizo ajeno (Reflejo, Hurto): sale en el próximo
  lanzamiento, tejas lo que tejas.
  El tejido es visible para el rival y ninguno sale en menos de 0,17 s, para que se alcance a ver aunque haya lag. Cada elemento tiene su propia fatiga: descansa 3 s después de usarlo, y 4,5 s si fue un doble (Brasa → Brasa, Tormenta → Tormenta…), que gasta un solo elemento y pega más que el básico.
- **Jungla viva:** el Incendio forestal quema árboles y el Brote de árbol los planta; los cambios
  duran hasta el fin de la ronda.
- **Partida:** mejor de 3 rondas sin reloj (Caza, Convergencia y Duelo final, un minuto cada una, y
  luego muerte súbita: la zona se cierra del todo y su daño sube hasta que alguien cae). Modos 1v1,
  2v2, 3v3 y todos contra todos hasta 6. Al morir quedas fuera de la ronda y miras a quienes siguen
  (las 3 Vidas son opcionales de 2v2 en adelante, apagadas por defecto; el Espectro se eliminó en
  noviembre de 2026). Hay un **modo entrenamiento** contra un muñeco, con un
  panel que muestra lo que estás tejiendo y qué hace. El Grimorio muestra solo lo descubierto y, al
  tocar un conjuro, qué hace.
- **Recordar las recetas** (los amigos hacían un hechizo y después no lo podían repetir):
  - **Lo que tejes:** en partida, abajo al centro y solo en tu pantalla, el nombre del hechizo que
    vas a lanzar, para corregir con ✕ antes de lanzar. Si todavía no lo descubres cambia al color
    de la Trama y dice "Nuevo", sin nombre: el nombre se gana lanzándolo.
  - **Tu bolsillo:** desde la ficha del Grimorio se marcan hasta 3 hechizos; en partida su receta se
    ve bajo tu vida. Es solo un recordatorio: se teje igual, con los botones.
  - **La receta de dos elementos** (`packages/content/src/recipes.ts`): el primer elemento dice de
    qué está hecho y el segundo, qué hace. Brasa golpea, Tormenta te mueve, Marea protege o
    estorba, Raíz se queda en el campo y Umbra engaña o maldice. El Grimorio muestra siempre los
    cinco de cada pestaña con lo que hacen (los no descubiertos sin nombre) y, en partida, un
    hechizo nuevo de dos elementos dice "Nuevo · Te mueve". En los Grandes el tercero es sorpresa.
- **PvE primero:** hechiceros de la IA con las mismas reglas que un jugador.
- **Dificultades de la IA:** Aprendiz, Duelista y Maestro (`packages/content/src/bots.ts`). Cambian
  qué tan rápido piensan, la puntería, cuánto esquivan proyectiles y avisos en el suelo, si se
  corren al ver un Gran hechizo, cuánto se repiten y cuánto recuerdan dónde estabas si los ciegan
  (ninguna se queda quieta). Se eligen en el menú y en la sala; el Entrenamiento usa Aprendiz.
- **Bestias neutrales** dan Esencia (los familiares quedan para después de probar con gente). **Glifos** entre rondas y
  **Presagios** por partida.
- **Afinidad:** el elemento elegido se cansa 25% más lento y sus opuestos 15% más rápido; además
  transforma la apariencia del hechicero.
- **Progresión:** variedad, no poder. Grimorio, maestría, desafíos y rivalidades entre amigos.
- **Arte:** fantasía oscura estilizada; la magia es lo único con color intenso.
- **Audio:** cada elemento es una nota y un tejido suena como un acorde.
- **Mundo:** Ysmar, sostenido por la Trama de cinco hilos; los vencedores del Crisol la retejen. Todo el lore está en [lore.md](lore.md).

## Lectura del combate

- **El tejido flota sobre la cabeza** en tres huecos, de izquierda a derecha en el orden tejido y
  siempre de frente a la cámara. Los huecos vacíos dicen cuánto falta. Al canalizar, los orbes se
  juntan y crecen hasta que el hechizo sale.
- **Silueta de familia en el suelo** mientras se canaliza (y medio segundo después), con el color
  del primer elemento: cuña (ataque), anillos (zona), flechas (movimiento), pentágono (invocación)
  y columna (aura). Las familias viven en `packages/content/src/families.ts`.
- **Para qué sirve cada hechizo**, en un ícono y una palabra junto al nombre: Daño (espada),
  Control (cadena), Cura (cruz), Apoyo (escudo) y Movimiento (doble flecha). Sale al descubrirlo,
  en el Grimorio y en la ficha del entrenamiento. Viven en `packages/content/src/intents.ts`.
- **Anillo de bando en el suelo** bajo todo conjuro que queda en el campo (zonas, avisos redondos,
  tornados, campos e invocaciones): verde agua si es tuyo o de tu equipo, carmesí y latiendo si
  es de un rival (en todos contra todos, todo lo ajeno es rival). El Señuelo, el Gemelo y el
  Espejismo no llevan, para no delatarse. Es una malla fina por conjuro, sin luces ni partículas.
- **Reacciones entre estados** (`packages/content/src/rules.ts`, `interactions.combos`): un golpe
  cuyo tejido empieza con un elemento, sobre un estado de otro, provoca algo extra. Sale una por
  golpe y su nombre flota sobre el blanco. También están en el Grimorio, pestaña Reacciones.

| Reacción      | Golpe de | Sobre      | Efecto                                   |
| ------------- | -------- | ---------- | ---------------------------------------- |
| Conducción    | Tormenta | Empapado   | +20% y aturde 0,6 s; seca el agua        |
| Quiebre       | Tormenta | Congelado  | +50% y rompe el hielo                    |
| Leña          | Brasa    | Enraizado  | +25% y quema 3 s                         |
| Vapor         | Marea    | Quemándose | +20%, apaga el fuego y quita escudos 3 s |
| Brasa maldita | Umbra    | Quemándose | +20% y el fuego se vuelve maldición      |
| Lodazal       | Raíz     | Empapado   | Enraíza 1 s; seca el agua                |

### Choque de tejidos

Lo único que se desarma son **proyectiles** rivales en el aire (Chispa, Bola de fuego, Ceguera,
Llama negra, Cometa negro, Ácido, Sifón). Lo que cae del cielo, como el Meteoro, se esquiva
moviéndose. Los desarma cualquier hechizo tuyo cuyo **primer elemento sea opuesto** al suyo en el
pentágono y que lo **toque**: otro proyectil, o el área de un cono o una explosión al lanzarse
(un Salpicón hacia la Chispa que viene). Un cono o una explosión alcanza también al proyectil
que va a pasar por su área en los próximos 0,2 s (`clash.lookaheadTicks`): la Chispa vuela tan
rápido que sin esto habría que acertar a una ventana de dos cuadros. Iguales o vecinos se cruzan
sin chocar.

- Mismo número de elementos: se deshacen. Con más elementos, el tuyo gana; con menos, el
  proyectil sigue debilitado, más chico, con el daño rebajado en tu proporción (1 contra 2: queda
  la mitad; 1 contra 3: dos tercios; 2 contra 3: un tercio).
- Se apunta a mano (arrastrando ✦): es una mecánica avanzada. Para que sea posible en el celular,
  chocan con medio metro más de margen que el que tienen para pegarle a un mago
  (`interactions.clash.margin`). No es una reacción ni cuenta para el Grimorio.

## La mejor jugada

Al terminar cada ronda, bajo el aviso de quién la ganó, sale **la jugada de la ronda**; en la
pantalla final, sobre los cuadros de cada mago, **la jugada de la partida**. Dicen quién, con qué
hechizos (los últimos antes del último golpe) y qué logró: daño, derribos, a cuántos rivales,
reacciones, cuánto duró y si cerró la ronda.

- **Qué es una jugada:** una ráfaga de golpes de un mago a magos rivales, sin pausas de más de 2 s y
  de a lo más 5 s. El daño que gotea (quemaduras, zonas) suma pero no la alarga.
- **Cómo se elige:** 1 punto por punto de daño, 60 por derribo, 20 por cada rival alcanzado además
  del primero, 12 por reacción y 25 si su derribo cerró la ronda. En empate, la que pasó antes.
  Los números están en `packages/content/src/highlights.ts`; la cuenta, en
  `packages/core/src/match/highlights.ts`.
- **En red la elige la Sala** y la manda con la pausa y con el resultado: todos ven la misma.
- **Repetición:** al terminar la partida, la jugada de la partida se repite sola (unos 5 a 8 s, la
  cámara sobre el hombro de quien la hizo, con Saltar); después aparece el resultado, con un botón
  para verla de nuevo. Si tu celular no alcanzó a guardarla (estabas fuera de la app), se repite el
  desenlace: los últimos 5 s. Las rondas muestran solo su tarjeta: repetirlas alargaría la pausa
  de todos. Cómo se guarda sin costo, en `docs/arquitectura.md`, "Repetición".

## Linajes

Uno por elemento, con nombre simple: "Linaje de Brasa", "Linaje de Tormenta", etc.
(`packages/content/src/schools.ts`). El jugador elige uno para siempre al crear su hechicero, justo
antes del tutorial. El linaje solo destaca 4 hechizos de partida (y Paso) y fija la Afinidad
inicial, que después se puede cambiar en el Vestidor; no bloquea nada. El Grimorio abre en la
pestaña del elemento del linaje con la sección "Linaje de X" arriba.

Cada set es autosuficiente: daño, control, curarse o escapar. La regla de balance: Duelistas que
solo tejen su set, con la Afinidad en su elemento, ganan entre 45% y 55% contra los otros cuatro
linajes (`pnpm escuelas`). Hoy: Brasa ≈ 52%, Tormenta ≈ 48%, Marea ≈ 50%, Raíz ≈ 49%, Umbra ≈ 51%.
Hay contras duros a propósito (Raíz gana ~72% a Umbra; Umbra ~63% a Marea y Tormenta). Si se toca
un set, la Afinidad o el balance de uno de sus hechizos, hay que volver a medir.

| Linaje   | Hechizos                                      | Combo que enseña   |
| -------- | --------------------------------------------- | ------------------ |
| Brasa    | Chispa, Bola ígnea, Lluvia de fuego, Meteoro  | Blanco quieto      |
| Tormenta | Rayo en cadena, Cometa, Pararrayos, Tempestad | Tormenta eléctrica |
| Marea    | Salpicón, Ventisca, Pararrayos, Era de hielo  | Quiebre            |
| Raíz     | Savia, Grillete, Manantial, Jardín            | Atado y a salvo    |
| Umbra    | Zarpa, Drenaje, Ceguera, Esporas              | Hilo a ciegas      |

## Historia

El modo arcade para un jugador: escenas de texto entre combates contra la IA, armadas para tu
Linaje (`packages/content/src/story.ts`; las tablas por aldea y por maestro, en `storyText.ts`).
El guion completo y aprobado está en el documento de la Historia; el código lo copia tal cual.
Quién te toca sale del pentágono: el aprendiz que vuelve es de tu primer Linaje rival, Arel del
primer aliado, y en el acto 2 pasan los maestros de tus dos aliados y tus dos rivales, más la
cuenta pendiente de Vesk y Madre Musgo (los dos rivales se buscan entre ellos: `focus` del bot).

- Las escenas avanzan de a una línea por toque, sin partida corriendo detrás. Lo ya visto se puede
  saltar. Antes de cada combate hay una tarjeta con el modo, la IA y las continuaciones.
- 3 continuaciones por acto: perder gasta una y reintenta el mismo combate; sin ninguna, se vuelve
  al inicio del acto. Al ganar, "Seguir" lleva a la escena de después.
- El avance vive en `crisol.historia` (viaja en el respaldo).
- Por partes: ya están el preludio y los actos 1 y 2 (combates 1 a 9). Faltan el acto 3, el
  Guardián como jefe, los gólems, el mapa del corazón, los finales y las imágenes.

## Camino del Linaje

El modo para un jugador: diez duelos contra la IA, en orden, cada uno con una regla distinta, y el
último contra tu maestro (`packages/content/src/path.ts`). Sin historia ni reloj: es para volver un
rato y avanzar un paso. Se abre desde la tarjeta "Camino" del menú (dice cuántos pasos llevas) y
cada paso lo presenta tu maestro con sus frases. Se avanza en orden; los superados se repiten. Al
terminar, el resultado dice si se superó el paso y por qué no; "Otra vez" repite el paso y
"Camino" vuelve a la lista. El avance vive en `crisol.camino` (viaja en el respaldo).

| Paso | Nombre           | Qué cambia                                                         |
| ---- | ---------------- | ------------------------------------------------------------------ |
| 1    | Primer duelo     | 1v1 contra un Aprendiz                                             |
| 2    | Lo que te enseñé | Aprendiz; gana tejiendo solo los hechizos de tu Linaje (y Paso)    |
| 3    | Sin tus rivales  | Aprendiz; solo aparecen tu elemento y sus dos aliados              |
| 4    | El otro lado     | Duelista que solo teje el set de tu primer Linaje rival            |
| 5    | Codo a codo      | 2v2 de Duelistas, con un aliado de la IA                           |
| 6    | Mal presagio     | Duelista del segundo Linaje rival, con el Presagio de su elemento  |
| 7    | Mil hilos        | Duelista; gana usando al menos 6 hechizos distintos                |
| 8    | Todos contra ti  | Todos contra todos de 4, Duelistas                                 |
| 9    | Sin un rasguño   | Duelista; gana sin perder ninguna ronda                            |
| 10   | Tu maestro       | 1v1 contra tu maestro (su cara y su nombre), en dificultad Maestro |

El Guardián sigue en pausa, así que el final es tu maestro. Los premios (hechizos o piezas del
Vestidor por superar pasos) se conversan cuando estén los personajes definitivos: cada paso tiene
un id fijo y `PathProgress.add` dice cuándo se supera por primera vez, que es donde se enchufan.
El desafío diario se descartó.

## Tutorial

En Entrenamiento, por capítulos que se pueden repetir (`apps/client/src/game/Tutorial.ts`), armados
para el linaje del jugador: el duelo, moverse, la cámara (mirar, fijar, saltar entre rivales,
soltar), tu elemento (su básico, deshacer y el descanso), tejer los hechizos del linaje, el Gran
hechizo (si el linaje trae uno), esquivar con Paso, apuntar, el combo del linaje (que se
entrega al Grimorio), el Grimorio y un examen contra un Aprendiz del linaje siguiente que solo
teje su set. "Más técnicas" (choque y meteoro, estados y reacciones) quedan como capítulos
opcionales en Entrenamiento. La primera vez parte del principio; después se elige el capítulo.

La barra de botones se abre de a poco: al empezar solo hay movimiento y cámara; cada elemento,
✦, deshacer y el botón de duelo aparecen con un destello en el paso que los usa, y el botón del
que habla la guía brilla. Cada nombre de elemento en la guía lleva su ícono. En entrenamiento y
tutorial siempre se ven números de daño rojos, pequeños y breves (y palabras como Atrapado o Ciego
para los estados); en partidas son una opción de Pausa.

Los pasos que se hacen jugando piden hechizos y combos concretos (los del linaje), no "cualquiera", para no adelantar el resto del Grimorio. La guía va
arriba al centro y casi siempre recogida en una línea: la orden corta, los signos y la cuenta. Cada
paso nuevo aparece desplegado con la explicación y se recoge solo al empezar a jugar o a los 6 s;
tocar la línea la despliega. Los pasos de solo leer quedan desplegados con su botón Siguiente.
En "La cámara" el muñeco se acerca a tiro para poder fijarlo, y en "Saltar entre rivales" aparece
un segundo muñeco a su lado que se va al terminar el capítulo (fuera de esa parte está caído,
escondido y en su propio equipo, así nada lo apunta). En "Defenderse" el muñeco muestra la Brasa medio segundo antes de soltar la Chispa y la lanza a
donde estás, sin adelantarse: así se esquiva caminando, como se enseña.

## Vestidor

Todo es cosmético salvo la Afinidad. Las piezas viven en `packages/content/src/appearance.ts` y se
arman en `apps/client/src/render/wizard/` (una función por tipo de pieza; al final las mallas se
juntan por material para gastar pocas llamadas de dibujo).

En pantalla hay tres pestañas (Mago, Aspecto y Ropa) y cada ajuste es **una sola fila con un
desplegable** (`ui/Dropdown.ts`) y flechas ‹ › para probar alternativas una por una; la lista abierta
cubre el panel, nunca al mago. El panel ocupa la altura completa a la derecha y no cambia de tamaño,
y la cámara encuadra al mago entero en la franja libre de la izquierda según la proporción de la
pantalla. La sala de amigos usa los mismos desplegables para sus ajustes (un solo "Modo" con los
siete modos), así ningún menú obliga a deslizar en un celular horizontal.

| Pieza   | Opciones                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Linaje  | Humano, orejas largas, lagarto, lobo, zorro, cuervo, carnero, sapo, calavera, autómata                                                         |
| Ropa    | Túnica, hábito de monje, vestido de bruja, manto de secta, pieles de chamán, coraza, harapos, cuello alto                                      |
| Cabeza  | Capucha honda, capucha abierta, sombrero, sombrero torcido, diadema, gorro de cresta, turbante, corona de hueso, yelmo, tocado de plumas, nada |
| Rostro  | Nada, barba larga, bigote, máscara de hueso, velo, runas pintadas, vendas                                                                      |
| Capa    | Sin capa, corta, larga, raída                                                                                                                  |
| Foco    | Báculo, cetro, orbe, grimorio, linterna, hoz, cuenco, varita                                                                                   |
| Colores | 12 de ropa, 8 de adornos y metal, 14 de piel, escamas o pelaje                                                                                 |

- **Combinaciones:** la barba solo crece en humanos, orejas largas y carneros; el bigote, en los dos
  primeros. Con capucha honda la cara queda en sombra y solo asoman el hocico, el pico, los cuernos,
  la máscara de hueso o la barba.
- **Arquetipos:** 13 hechiceros armados de una vez (bruja del pantano, monje de la cumbre, sectario
  del abismo, mago lagarto, brujo lobo, chamán carnero, nigromante, autómata errante, cuervo
  vidente, zorro peregrino, sapo alquimista, tejedora de la Trama y el clásico) y un botón Al azar.
- Los perfiles guardados antes conservan su aspecto: las piezas nuevas toman el valor de siempre.
