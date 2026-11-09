# Crisol de Ysmar — Documento de diseño

Copia del documento de Claude del 9 de noviembre de 2026 (autor: Tomás Rojas Murúa), escrito antes
del Hito 0.

> **Qué quedó superado desde entonces** (lo vigente está en `docs/diseno.md` y en
> `docs/traspaso/README.md`):
> - Las rondas son de **3 minutos** (un minuto por fase), no de 6.
> - La **gramática del tejido** (primer elemento = forma, siguientes = efectos) se reemplazó por un
>   hechizo propio para cada tejido. Ver `rediseno-hechizos.md`.
> - La cámara quedó **sobre el hombro**; la vista 3/4 se probó y se descartó en el Hito 1.
> - El tejido se lanza tocando ✦ (o arrastrando desde ✦), no deslizando desde el arco.
> - Se aprobó jugar el 1v1 en la plaza sin jungla y pausar familiares, Guardián y 3 Vidas.

## Visión y pilares

Un duelo de hechiceros para celular en el que la magia se teje en tiempo real combinando cinco
elementos, jugado entre amigos que entran a la sala con un enlace de WhatsApp. "Crisol de Ysmar" es
un título de trabajo.

- **La magia se construye.** No hay una lista fija de hechizos: el conjuro sale de la mezcla de
  elementos que tejes.
- **Descubrir es progresar.** Se mejora encontrando combinaciones, sinergias y secretos que nadie
  explicó.
- **Duelos con estrategia.** Se gana enfrentando a otros hechiceros, leyendo su tejido y respondiendo
  mejor.

El juego es 100% original: toma la idea de cinco elementos con personalidad, pero sus nombres,
hechizos, criaturas y mundo son propios.

## Plataforma, cámara y controles

Es un juego web que se abre directo desde el enlace, sin instalar nada, jugado con el celular en
horizontal. Más adelante se puede empaquetar como app.

**Cámara: tercera persona elevada** (unos 35 a 40° detrás del mago), para que el jugador se sienta
protagonista y enfrente a sus rivales cara a cara.

- La cámara gira sola hacia donde caminas, así que no hace falta un tercer dedo.
- Con un toque te fijas en un objetivo y la cámara encuadra el duelo.
- Hay indicadores en el borde de la pantalla para lo que pasa a tu espalda.
- La cámara es una pieza intercambiable en el código: en el primer prototipo se prueba también la
  vista 3/4 y se decide jugando.

**Controles**

- Pulgar izquierdo: joystick para moverse.
- Pulgar derecho: un arco con los 5 elementos. Tocas hasta 3 para tejer y deslizas para lanzar en una
  dirección, con asistencia de puntería suave.
- Con un gesto se cancela el tejido, y con eso también se puede amagar.

## Elementos, tejido y fatiga

Cada hechicero maneja los mismos cinco elementos y teje conjuros de 1, 2 o 3 elementos, pudiendo
repetirlos. El orden importa, así que hay 155 conjuros base (5 de un elemento, 25 de dos y 125 de
tres).

| Elemento | Tema          | Rol en combate                | Nota del acorde |
| -------- | ------------- | ----------------------------- | --------------- |
| Brasa    | Fuego         | Daño directo y quemaduras     | Por definir     |
| Marea    | Agua y hielo  | Control, ralentizar y escudos | Por definir     |
| Raíz     | Naturaleza    | Curación, trampas y bestias   | Por definir     |
| Tormenta | Rayo y viento | Movilidad y encadenar         | Por definir     |
| Umbra    | Sombra        | Maldiciones y robo de vida    | Por definir     |

**Reglas del tejido**

1. **El tejido se ve.** Los orbes de tus elementos giran alrededor de tus manos y el rival puede
   leerlos. Se puede amagar, cancelar o cambiar a último momento.
2. **Velocidad contra poder.** Un conjuro de 1 elemento sale casi instantáneo, uno de 2 tarda un poco
   y uno de 3 es devastador pero te deja vulnerable mientras lo tejes.
3. **El orden y la repetición cambian la forma.** Por ejemplo, Brasa + Tormenta es un rayo que
   incendia, y Marea + Marea + Umbra es una prisión de hielo negro.
4. **Interacciones entre elementos.** Marea apaga Brasa, Tormenta se conduce por el agua, Raíz atrapa
   a quien está en el suelo y Umbra roba vida a quien está maldito.
5. **Fatiga por elemento.** Después de usar un elemento, este se enfría unos segundos. No hay barra
   de maná general.

Gramática del tejido (propuesta, luego reemplazada): el primer elemento define la forma del conjuro,
por ejemplo Brasa es un proyectil, Marea un muro, Raíz una trampa, Tormenta un salto y Umbra una
marca. Los elementos siguientes le agregan efectos. Algunas combinaciones exactas romperán la regla
con un conjuro secreto, que es lo que se descubre en el Grimorio.

## Estructura de partida

Una partida es al mejor de 3 rondas de unos 6 minutos cada una, así que dura entre 12 y 18 minutos.
Gana la ronda el último hechicero o equipo en pie.

**Ritmo de una ronda**

1. **Caza (minutos 0 a 2):** la arena está abierta. Se cazan bestias, se vinculan familiares y puede
   haber escaramuzas.
2. **Convergencia (minutos 2 a 4):** la arena empieza a cerrarse y aparecen santuarios que se pueden
   disputar y que dan poder.
3. **Duelo final (minutos 4 a 6):** la zona queda chica y el enfrentamiento es inevitable.

**Entre rondas** cada jugador elige 1 de 3 Glifos. El que perdió la ronda elige primero o recibe una
opción extra, para que nadie quede fuera demasiado pronto.

**Modos** (los rivales que falten los ocupan hechiceros de la IA)

| Modo               | Jugadores               |
| ------------------ | ----------------------- |
| Duelo              | 1 contra 1              |
| Equipos            | 2 contra 2 o 3 contra 3 |
| Todos contra todos | Hasta 6                 |

**Qué pasa al morir:** se elige al crear la sala.

- **Espectro:** sigues jugando como un espíritu débil. Puedes marcar enemigos, entregar Esencia a tus
  aliados o molestar un poco a tus rivales.
- **Vidas:** tienes 3 vidas por ronda y reapareces en el borde de la arena.

En equipos, un aliado caído puede ser revivido por sus compañeros en pocos segundos.

**PvE primero:** el juego parte enfrentándote a hechiceros de la IA que usan las mismas reglas que
un jugador. El PvP llega cuando se reemplaza la IA por personas, sin cambiar las reglas.

## Bestias, Glifos y Presagios

Estos tres sistemas hacen que cada partida sea distinta; ninguno reemplaza al duelo como forma de
ganar.

**Bestias neutrales.** Habitan la arena y no toman partido. Cada una pertenece a un elemento.

- **Cazarlas:** al matarla deja Esencia de su elemento, que potencia los conjuros que lo usan hasta
  el final de la ronda.
- **Vincularlas:** a las bestias raras se las debilita y se las ata con un conjuro especial. Te
  acompañan como familiar y tienen una habilidad propia.

**Glifos.** Modificadores que cambian cómo funcionan las combinaciones. Se eligen entre rondas y
también se pueden encontrar en santuarios. Ejemplos: "tus conjuros de 3 elementos rebotan" o "Brasa
deja el suelo en llamas".

**Presagios.** Cada partida trae un modificador global al azar que afecta a todos. Ejemplos:
"Tormenta eterna: los rayos encadenan el doble" o "Luna de Umbra: todos roban vida".

## Afinidad y balance

Antes de cada partida, cada jugador elige una Afinidad: su elemento se cansa un 25% más lento y los
dos elementos opuestos un 15% más rápido. Ningún elemento queda prohibido.

Los cinco elementos forman un pentágono (orden en el círculo: Brasa, Tormenta, Marea, Raíz, Umbra):
cada uno combina con sus dos vecinos y choca con los dos de enfrente. La Afinidad se ve en el
hechicero, así que el rival sabe por dónde va a atacar y puede prepararse.

**Cómo se mantiene el balance**

- **Simulación:** como la IA usa las mismas reglas que un jugador, se juegan miles de partidas de
  bots contra bots para medir cuánto gana cada Afinidad.
- **Meta:** cada Afinidad debe ganar entre el 45 y el 55% de las veces. Lo mismo se mide para
  conjuros y Glifos.
- **Ajuste sin código:** daño, tiempos de tejido, fatiga y bonificaciones viven en tablas de datos.
- **Porcentajes iniciales:** el 25% y el 15% son el punto de partida; la simulación dirá si hay que
  moverlos.

## Multijugador, salas y perfiles

Solo hay salas privadas entre amigos, con jugadores en Chile. El emparejamiento público queda para
mucho más adelante.

**Cómo se entra a una sala**

1. Tocas "Crear sala" y eliges el modo y la regla de muerte (Espectro o Vidas).
2. Tocas "Invitar" y se abre el menú de compartir del celular con WhatsApp listo, con un enlace corto
   como `juego.com/s/K7QF`.
3. Tu amigo abre el enlace. Si es su primera vez, elige nombre y personaje, y ya está dentro.
4. Los puestos vacíos los ocupan hechiceros de la IA.

**Cómo funciona la red**

- **Servidor que manda:** decide todo lo que pasa en la partida. Los celulares solo envían
  intenciones, como moverse o lanzar un tejido. Es justo y evita trampas.
- **Predicción local:** tu mago responde al instante en tu pantalla y el servidor corrige solo si
  hace falta.
- **Reconexión:** tienes 60 segundos para volver si sales de la app o te entra una llamada. Mientras
  tanto la IA controla a tu mago.

**Perfiles sin cuenta**

- El celular guarda una llave invisible y con ella el servidor guarda tus estadísticas, rivalidades
  y desbloqueos.
- Un "código de respaldo" opcional, en forma de enlace que puedes mandarte por WhatsApp, recupera tu
  perfil si cambias de celular o borras el navegador.

## Progresión y rejugabilidad

Regla de oro: lo que se desbloquea da variedad, no poder. Quien juega más no gana por tener mejores
números, sino por jugar mejor.

| Sistema               | Qué es                                                                               | Qué da                                                                       |
| --------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Grimorio              | Libro con los conjuros descubiertos, con páginas en blanco y borrosas que dan pistas | Descubrimiento y conjuros ocultos que solo aparecen bajo ciertas condiciones |
| Maestría por elemento | Usar un elemento le sube el nivel                                                    | Apariencias de conjuros y variantes igual de fuertes                         |
| Desafíos              | Metas como "gana una ronda usando solo Umbra"                                        | Cosméticos y títulos                                                         |
| Rivalidades           | Historial entre amigos, por ejemplo "Tomás 12, Pedro 9"                              | Conjuro estrella, némesis y resumen de cada partida                          |
| Glifos y Presagios    | Modificadores dentro de la partida                                                   | Builds y partidas que nunca se repiten igual                                 |

Descubrir un conjuro por primera vez tiene su propia celebración en pantalla. Las rivalidades y los
resúmenes están pensados para comentarse en el grupo de WhatsApp.

## Personalización del hechicero

El hechicero se arma por piezas y después la Afinidad lo transforma antes de cada partida.

- **Piezas:** rostro, piel, sombrero o capucha, túnica, báculo o foco, colores, aura, animación de
  victoria y color de los orbes al tejer.
- **Acceso:** las piezas básicas están disponibles desde el inicio. Las más llamativas se ganan con
  maestría y desafíos.
- **Todo es cosmético:** ninguna pieza cambia el poder del hechicero.

| Afinidad | Transformación visible                                                         |
| -------- | ------------------------------------------------------------------------------ |
| Brasa    | Grietas incandescentes en la piel, túnica humeante, brasas que caen al caminar |
| Marea    | Escarcha en el rostro, ropa empapada, aliento visible de frío                  |
| Raíz     | Corteza y musgo sobre el cuerpo, astas que brotan, flores a tu paso            |
| Tormenta | Pelo flotando, runas que chisporrotean sobre la piel, ojos brillantes          |
| Umbra    | Cuerpo que se deshace en humo, ojos huecos, una sombra que se mueve sola       |

## Arte, audio y menús

**Dirección de arte: fantasía oscura estilizada.** Proporciones realistas, colores apagados (piedra,
ceniza, niebla) e iluminación dramática. Lo único con color intenso es la magia, para que un conjuro
siempre se distinga en medio de la pelea.

- Meta técnica: 60 cuadros por segundo en un Android de gama media, con un ajuste de calidad para
  teléfonos más antiguos.
- **Imágenes con ChatGPT:** Claude entrega los prompts con una guía de estilo fija y Tomás genera las
  imágenes. Sirven para arte conceptual, texturas, íconos de conjuros, ilustraciones del Grimorio,
  retratos de bestias, pantallas de carga y fondos de menú.
- Los modelos 3D de magos y bestias usan formas sencillas y bien iluminadas. Las imágenes generadas
  sirven de referencia para herramientas que pasan de imagen a 3D.

**Audio: el tejido suena.** Cada elemento es una nota y una combinación forma un acorde, así que se
puede escuchar lo que teje el rival.

- La música se intensifica en cada fase de la ronda.
- El sonido es posicional, para oír a alguien que se acerca por detrás.
- La vibración acompaña los impactos y el final de cada tejido.

**Menús.** El menú principal es la torre del hechicero, con las secciones Jugar, Grimorio, Vestidor,
Rivalidades y Ajustes.

1. Abres el enlace. La primera vez eliges nombre y personaje.
2. Entras a la sala y ves a los magos de tus amigos. Cada uno elige su Afinidad y se ve la
   transformación.
3. Se juega la partida.
4. Resumen: conjuro estrella, rivalidad actualizada y un botón grande de "Revancha".

## Lore: semilla del mundo

El mundo es propio y apunta a una profundidad comparable a la de los grandes juegos de fantasía
(planos, culturas, bestias con historia), sin tomar criaturas, lugares ni personajes de ninguno.

**Premisa (propuesta):** el mundo de **Ysmar** está sostenido por **la Trama**, un tejido de cinco
hilos elementales. Cada era, la Trama se desgasta, y desde las ruinas de una ciudad antigua emerge
**el Crisol**, una arena viva. Los hechiceros que vencen en el Crisol ganan el derecho de **retejer**
un hilo del mundo a su manera. Las bestias son criaturas nacidas de hilos sueltos, y por eso cazarlas
entrega su Esencia.

**Cómo se amarra con el juego**

- "Tejer" es literalmente lo que hace un hechicero en Ysmar.
- La Afinidad representa con qué hilo se ha unido el hechicero, y por eso lo transforma.
- Cada arena puede ser una región distinta de Ysmar, con sus propias bestias y Presagios.

**Por desarrollar** en una "biblia del mundo" aparte:

- [ ] Una orden o cultura por elemento, con su historia, su ciudad y su estética.
- [ ] El bestiario: nombre, elemento, comportamiento y leyenda de cada bestia.
- [ ] Las regiones que se convierten en arenas.
- [ ] La historia de las eras pasadas: quién retejió qué y qué consecuencias dejó.

## Infraestructura y próximos pasos

El juego corre sobre Cloudflare y el código vive en GitHub, que lo publica automáticamente. Para un
grupo de amigos el costo debería ser nulo o muy bajo.

El celular descarga el juego desde Pages, le pide al Worker crear o cargar la sala y después habla
en tiempo real con la Sala (Durable Object). La Sala guarda resultados y rivalidades en D1; los
archivos pesados van en R2.

**Principio clave del código:** las reglas del juego (tejido, conjuros, fatiga, daño) viven en un
único núcleo compartido que no sabe nada de gráficos ni de red. El mismo núcleo corre en la Sala (la
verdad), en el celular (la predicción) y en la simulación de balance (bots contra bots). Un mago no
sabe si lo controla un dedo, la IA o la red.
