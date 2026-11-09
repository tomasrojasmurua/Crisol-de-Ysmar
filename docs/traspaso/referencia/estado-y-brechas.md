# Crisol de Ysmar: estado, brechas y mejoras

Copia del documento de Claude del 9 de noviembre de 2026 (autor: Tomás Rojas Murúa), escrito
después del PR #9. Desde entonces entraron los PRs #10 a #17 (hechizos propios, 70 Grandes
hechizos, rondas de 3 minutos), pero el diagnóstico de red, audio y arte sigue vigente.

## Resumen

El juego contra la IA está completo y bien construido, pero **el multijugador todavía no existe**:
la Sala en Cloudflare solo responde saludos y pings. Como la fluidez del multijugador es la
prioridad, el siguiente gran paso es el Hito 2, y el núcleo ya está preparado para eso.

- **Lo que juega a favor:** simular un paso de 6 magos cuesta 0,03 ms (el presupuesto es 2 ms), el
  núcleo es determinista y los magos ya reciben intenciones de un controlador intercambiable.
- **Lo que hay que resolver:** el estado completo pesa unos 8,5 KB en JSON. Mandarlo 20 veces por
  segundo serían unos 170 KB/s por celular, demasiado para datos móviles. Hay que enviar solo lo que
  cambia, en binario y comprimido, para bajar a 1 o 2 KB por envío.
- **Lo que más falta de la visión:** jugar con amigos, audio (no hay ningún sonido), arte real (todo
  es geometría generada por código), familiares, rivalidades, maestría y el lore dentro del juego.
- **Las herramientas de Tomás** rinden más en audio (ElevenLabs), personajes y bestias en 3D (Meshy +
  Mixamo) y arte 2D de interfaz y Grimorio (ChatGPT).

## Qué teníamos (tras el PR #9)

Publicado en [crisol-de-ysmar.pages.dev](https://crisol-de-ysmar.pages.dev). Núcleo puro y
determinista, reglas y números en `content`, y un mapa de dependencias que CI hace cumplir.

| Área                 | Estado | Detalle                                                                                           |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Tejido y combate     | Listo  | 5 elementos, 155 conjuros con nombre, el orden importa, fatiga por elemento                       |
| Partida              | Listo  | Duelo, 2v2, 3v3, todos contra todos de 4 o 6; mejor de 3; fases, zona, Espectro o Vidas, revivir  |
| Variedad             | Listo  | Bestias con Esencia, santuarios, Glifos entre rondas, Presagios                                   |
| Identidad            | Listo  | Vestidor con nombre y piezas, Afinidad que transforma al mago, Grimorio en el celular             |
| Mapa                 | Listo  | 40 m de radio, plaza, jungla que tapa la vista, 10 campamentos que reaparecen, Guardián, minimapa |
| Bots                 | Listo  | Tejen con las mismas reglas, rodean obstáculos con A*, cazan; no logran vencer al Guardián        |
| Cámara y controles   | Listo  | Sobre el hombro, joystick izquierdo, arco de elementos a la derecha                               |
| Gráficas             | Básico | Geometría hecha por código, con resplandor, sombras suaves y partículas                           |
| Audio                | Falta  | No hay ningún sonido                                                                              |
| Multijugador         | Falta  | La Sala acepta conexiones y responde saludos y pings; nada más                                    |
| Perfiles en servidor | Falta  | Perfil y Grimorio viven solo en el navegador                                                      |

Medidas en una partida de 6 bots: un paso de simulación cuesta 0,03 ms de promedio y 1,2 ms en el
peor caso; los bots, 0,04 ms. El juego descarga 216 KB comprimidos, muy por debajo de 5 MB.

## Qué falta frente a la visión original

| Lo que diseñamos                                                    | Estado                           | Importancia |
| ------------------------------------------------------------------- | -------------------------------- | ----------- |
| Salas por enlace de WhatsApp, con bots que llenan los puestos       | No existe                        | Crítica     |
| Predicción local y corrección suave                                 | No existe                        | Crítica     |
| Reconexión de 60 s con la IA a cargo                                | No existe                        | Crítica     |
| Sala ubicada en Sudamérica                                          | Pendiente (nota en el código)    | Alta        |
| Perfil guardado en el servidor y código de respaldo                 | Solo en el navegador             | Alta        |
| Audio: el tejido suena como un acorde, sonido posicional, vibración | No hay audio                     | Alta        |
| Rivalidades y resumen de partida con Revancha                       | No existe                        | Alta        |
| Fantasía oscura con magos y bestias de verdad                       | Formas simples hechas por código | Media       |
| Vincular bestias como familiares                                    | No existe                        | Media       |
| Maestría por elemento y desafíos                                    | No existe                        | Media       |
| Conjuros secretos que rompen la gramática                           | No existe                        | Media       |
| Lore de Ysmar dentro del juego                                      | Solo en el documento de diseño   | Media       |
| Ajuste de calidad para teléfonos antiguos                           | No existe                        | Media       |
| Torre del hechicero como menú principal                             | Menú simple                      | Baja        |

Dos detalles del mapa para revisar jugando: si 40 m de radio se sienten bien con 2 jugadores, y si el
Guardián es demasiado duro, ya que los bots nunca lo vencen.

## Plan para un multijugador fluido (Hito 2)

Cuatro entregas, cada una jugable con amigos. La Sala corre el mismo núcleo que hoy corre el celular
y es la única verdad; los celulares solo envían intenciones.

1. **Sala jugable (la base).** Crear sala, compartir el enlace con el menú nativo del celular
   (WhatsApp listo), sala de espera con los magos de todos, bots que llenan los puestos vacíos y la
   partida corriendo en el servidor a 30 pasos por segundo.
2. **Fluidez.**
   - **Tu mago responde al instante:** el celular simula tu propio movimiento y el inicio del tejido
     sin esperar al servidor, y corrige con suavidad si difiere.
   - **Los demás se ven suaves:** se dibujan unos 100 ms en el pasado, interpolando entre dos estados
     recibidos.
   - **Mensajes livianos:** el mapa y lo que no cambia no se envían; posiciones en enteros cortos;
     solo lo que cambió desde el último estado confirmado; formato binario. Meta: menos de 2 KB por
     envío y menos de 40 KB/s por celular.
   - **Solo lo que puedes ver:** el servidor no envía rivales ocultos en la jungla. Ahorra datos y
     evita trampas, porque hoy esa decisión la toma el celular.
   - **Resistencia a pérdidas:** cada envío de intenciones repite las 3 últimas.
3. **Robustez en celular.** Sala ubicada en Sudamérica (`locationHint`), reconexión de 60 s con la IA
   manejando a tu mago, manejo de cuando sales a WhatsApp o entra una llamada (hoy el juego no
   detecta que la pestaña quedó oculta) y la Sala sin dormirse mientras hay partida.
4. **Herramientas para medir.** Un modo de prueba que simula 150 ms de retraso y 5% de pérdida, y un
   indicador de ping y pérdida en pantalla.

**La fluidez también es dibujo.** Si el celular baja de 60 a 35 cuadros, se siente igual que el lag.
Hoy el juego usa sombras suaves, resplandor y hasta el doble de resolución en todos los teléfonos.
Propuesta: tres niveles de calidad que se eligen solos según los cuadros de los primeros segundos.

**Lo que se necesita de Tomás:** probar en su celular y en el de 2 o 3 amigos, con datos móviles, y
contar qué modelos de teléfono usan.

## Otras mejoras propuestas

- **Resumen para WhatsApp.** Al final, una imagen con el ganador, tu conjuro estrella y el marcador de
  la rivalidad ("Tomás 12, Pedro 9"), lista para compartir.
- **Revancha de un toque.** Misma sala, mismos jugadores, nuevo Presagio, sin volver al menú.
- **Repeticiones gratis.** Con el núcleo determinista, la semilla y las intenciones bastan para
  revivir una partida. Sirve para ver la jugada final y depurar la red.
- **Vincular familiares.** Debilitar una bestia rara y atarla con un tejido especial.
- **Conjuros secretos.** Diez o quince combinaciones exactas con pistas borrosas en el Grimorio.
- **Lore dentro del juego.** Cada bestia y conjuro descubierto desbloquea una página corta sobre
  Ysmar, la Trama y sus órdenes.
- **Maestría y desafíos guardados en el servidor**, junto con el perfil, usando D1.
- **Mapa según cantidad de jugadores.** Cerrar parte de la jungla con niebla cuando hay 2 jugadores.
- **Guía del primer minuto.** Tres tejidos guiados al entrar por primera vez.

## Lo que Tomás puede aportar con sus herramientas

El audio es donde más rinde, porque hoy no hay nada y no compite con la red. Los modelos 3D suben el
nivel, pero hay que cuidar su peso. Para cada pedido, Claude le pasa los prompts exactos con la guía
de estilo.

| Herramienta          | Qué aportar                                                                                                                                                | Formato y límites                                                       | Prioridad |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| ElevenLabs (efectos) | Una nota por elemento que suene bien en acorde; un sonido de lanzamiento por familia; impactos; rugidos de bestias y del Guardián; sonidos de menú         | MP3 u OGG, mono, menos de 2 s cada uno, unos 40 en total                | 1         |
| ElevenLabs (música)  | Tres pistas en bucle, una por fase, en la misma tonalidad                                                                                                  | 60 a 90 s cada una, OGG                                                 | 1         |
| ElevenLabs (voz)     | Un narrador en español para avisos: "Convergencia", "El Guardián despierta", "Ronda final"                                                                 | Frases cortas, misma voz siempre                                        | 2         |
| Meshy                | Un cuerpo base de hechicero; 3 capuchas o sombreros, 3 focos; 5 bestias; el Guardián                                                                       | GLB, ~6.000 triángulos por mago y 4.000 por bestia, texturas de 1024 px | 2         |
| Mixamo               | Animaciones: quieto, correr, tejer, lanzar, recibir golpe, caer, revivir, victoria                                                                         | Mismo esqueleto, sin piel ("without skin") salvo la primera             | 2         |
| ChatGPT (imágenes)   | Arte conceptual; íconos de los 5 elementos; ilustraciones del Grimorio; fondo del menú; marco del resumen de WhatsApp; texturas de piedra, musgo y corteza | PNG cuadrado; texturas de 1024 px sin costura                           | 3         |
| ChatGPT (texto)      | Ampliar el lore: órdenes de cada elemento, regiones, páginas del Grimorio                                                                                  | Español, siempre 100% original                                          | 3         |

Dos avisos: Mixamo solo anima cuerpos humanoides, así que las bestias de cuatro patas se animan con
el auto-rigging de Meshy o por código. Y hay que revisar la licencia del plan de Meshy.

## Orden recomendado

1. **Sala jugable:** enlace de WhatsApp, sala de espera y partida en el servidor. En paralelo, Tomás
   genera el paquete de sonidos.
2. **Fluidez:** predicción, interpolación, mensajes livianos y niveles de calidad. Aquí se integra el
   audio.
3. **Robustez en celular:** Sala en Sudamérica, reconexión y salidas a WhatsApp.
4. **Lo social:** resumen para WhatsApp, Revancha, rivalidades y perfil en el servidor.
5. **Arte 3D:** mago base de Meshy con animaciones de Mixamo, luego bestias y Guardián.
6. **Profundidad:** conjuros secretos, familiares, maestría y páginas de lore.

Pendientes que quedaron abiertos:

- [ ] Tomás: decir si se parte por la Sala jugable (después se decidió atacar primero las debilidades).
- [ ] Tomás: contar qué teléfonos usan sus amigos.
- [ ] Claude: entregar los prompts del paquete de sonidos.
