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
  El tejido es visible para el rival y ninguno sale en menos de 0,17 s, para que se alcance a ver aunque haya lag. Cada elemento tiene su propia fatiga.
- **Jungla viva:** el Incendio forestal quema árboles y el Brote de árbol los planta; los cambios
  duran hasta el fin de la ronda.
- **Partida:** mejor de 3 rondas sin reloj (Caza, Convergencia y Duelo final, un minuto cada una, y
  luego muerte súbita: la zona se cierra del todo y su daño sube hasta que alguien cae). Modos 1v1,
  2v2, 3v3 y todos contra todos hasta 6. Al morir quedas fuera de la ronda y miras a quienes siguen
  (las 3 Vidas son opcionales de 2v2 en adelante, apagadas por defecto; el Espectro se eliminó en
  noviembre de 2026). Hay un **modo entrenamiento** contra un muñeco, con un
  panel que muestra lo que estás tejiendo y qué hace. El Grimorio muestra solo lo descubierto y, al
  tocar un conjuro, qué hace.
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
- **Mundo:** Ysmar, sostenido por la Trama de cinco hilos; los vencedores del Crisol la retejen.

## Lectura del combate

- **El tejido flota sobre la cabeza** en tres huecos, de izquierda a derecha en el orden tejido y
  siempre de frente a la cámara. Los huecos vacíos dicen cuánto falta. Al canalizar, los orbes se
  juntan y crecen hasta que el hechizo sale.
- **Silueta de familia en el suelo** mientras se canaliza (y medio segundo después), con el color
  del primer elemento: cuña (ataque), anillos (zona), flechas (movimiento), pentágono (invocación)
  y columna (aura). Las familias viven en `packages/content/src/families.ts`.
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

## Tutorial

En Entrenamiento, por capítulos que se pueden repetir (`apps/client/src/game/Tutorial.ts`): el
duelo (cómo se gana), moverse, la cámara, los 5 elementos, el descanso, tejer, apuntar,
defenderse (el muñeco ataca con Chispas y Meteoros: esquivar, Muro de hielo, choque de tejidos y
salir del círculo), estados y reacciones, combos (entrega Brasa maldita, Quiebre y Amarre), el
Grimorio y un examen contra la IA Aprendiz. La primera vez parte del principio; después se elige
el capítulo. Cada capítulo se puede saltar, y los terminados quedan marcados en el celular.

## Vestidor

Todo es cosmético salvo la Afinidad. Las piezas viven en `packages/content/src/appearance.ts` y se
arman en `apps/client/src/render/wizard/` (una función por tipo de pieza; al final las mallas se
juntan por material para gastar pocas llamadas de dibujo).

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
