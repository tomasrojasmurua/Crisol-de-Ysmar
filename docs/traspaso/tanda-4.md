# Grandes hechizos, tanda 4

Con esta tanda están los **125 Grandes hechizos**: cada uno de los 155 tejidos tiene su hechizo propio
y ya no quedan ecos. Entraron los 55 que faltaban, en un solo PR como pidió Tomás, para probarlos
juntos en un 1v1.

Los textos de partida vienen del documento [Rediseño de hechizos](referencia/rediseno-hechizos.md).
Los números van en `packages/content/src/spells.ts` (los hechizos) y `packages/content/src/rules.ts`
(los estados) y se ajustan jugando.

## Cómo se juega cada uno

Valores de partida. "Cono" quiere decir que el hechizo busca al rival hacia donde apuntas.

| Tejido                      | Hechizo                   | Qué hace hoy                                                                                     |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Brasa → Brasa → Marea       | **Erupción**              | Volcán a 8 m por 6 s: corta el paso y cada 0,7 s lanza una roca de 15 que quema.                 |
| Brasa → Tormenta → Brasa    | **Granada solar**         | Esfera a 8 m por 6 s; explota (40 en 3 m) cuando la toca un hechizo tuyo.                        |
| Brasa → Tormenta → Tormenta | **Propulsión**            | 4 s: cada hechizo que lanzas te da un salto de 3 m hacia donde apuntas y deja fuego.             |
| Brasa → Tormenta → Marea    | **Monzón**                | Tormenta de 6 m a 8 m por 5 s: un rayo de 12 por segundo a cada rival adentro.                   |
| Brasa → Marea → Brasa       | **Forja**                 | Tu próximo hechizo de daño en 6 s hace el doble.                                                 |
| Brasa → Marea → Tormenta    | **Escaldar**              | Cono de vapor de 6 m: 10, rompe escudos (Burbuja y Obsidiana sin estallar) y 4 s sin escudos.    |
| Brasa → Raíz → Brasa        | **Semilla de fuego**      | En un aliado a 10 m o en ti, 8 s: al recibir un golpe, explota (40 en 3 m).                      |
| Brasa → Raíz → Marea        | **Humo de hoguera**       | Columna de 4 m a 6 m por 8 s: quien está adentro no ve afuera ni lo ven desde afuera.            |
| Brasa → Raíz → Raíz         | **Hoguera**               | Fogata de 3 m por 20 s: tu equipo cerca descansa los elementos el doble de rápido.               |
| Brasa → Umbra → Raíz        | **Hambre de ceniza**      | Marca 8 s: si el rival cae **o baja de 25%**, descansas todo y recuperas 30.                     |
| Brasa → Umbra → Umbra       | **Eco ardiente**          | Tu próximo hechizo en 10 s sale dos veces: la segunda 1 s después y desde el mismo lugar.        |
| Tormenta → Brasa → Brasa    | **Sobrecarga**            | Tus próximos 3 hechizos en 5 s salen con el aviso mínimo de 0,17 s.                              |
| Tormenta → Brasa → Tormenta | **Pararrayos humano**     | 3 s: atraes los proyectiles rivales a 6 m y cada uno te da escudo en vez de daño.                |
| Tormenta → Brasa → Raíz     | **Cortocircuito**         | Si un rival a 8 m está tejiendo, se le cancela y queda 1 s aturdido.                             |
| Tormenta → Brasa → Umbra    | **Estruendo**             | Los rivales a 6 m quedan 5 s cansados del último elemento que usaron.                            |
| Tormenta → Tormenta → Raíz  | **Círculo de tótems**     | Tres tótems unidos por rayos por 6 s; quien cruza una línea queda 0,8 s aturdido.                |
| Tormenta → Tormenta → Umbra | **Mil pasos**             | Intocable 1,5 s; saltas 4 veces golpeando con 14 a los rivales a 8 m.                            |
| Tormenta → Marea → Marea    | **Pista de hielo**        | Camino de 12 m por 6 s: quien entra se desliza recto hasta el final, tú incluido.                |
| Tormenta → Marea → Umbra    | **Vendaval**              | Cono de 9 m que apaga invocaciones, trampas y zonas rivales.                                     |
| Tormenta → Raíz → Brasa     | **Relámpago guiado**      | Un rayo de 35 que diriges 2 s con el pulgar de moverte; mientras tanto no caminas.               |
| Tormenta → Raíz → Tormenta  | **Tirolesa**              | Cable de 14 m por 8 s: sales por él al instante y tu equipo viaja rápido al tocarlo.             |
| Tormenta → Raíz → Marea     | **Crecimiento acelerado** | 5 m por 4 s a tus pies: tu equipo teje y corre más rápido; tus invocaciones atacan antes.        |
| Tormenta → Raíz → Raíz      | **Red eléctrica**         | Activa a la vez tus trampas, Granadas, Mandrágoras e invocaciones a 12 m (rayos de 12).          |
| Tormenta → Umbra → Brasa    | **Retroceso**             | Vuelves a donde estabas hace 3 s, con la vida que tenías entonces.                               |
| Tormenta → Umbra → Marea    | **Instante**              | El rival queda 1,5 s detenido en el tiempo: no se mueve, no actúa y no recibe daño.              |
| Tormenta → Umbra → Raíz     | **Rayo de enlace**        | Une a dos rivales 4 s; **con uno solo, lo une a ti**. Si se separan a más de 6 m, se aturde 1 s. |
| Marea → Tormenta → Brasa    | **Sifón**                 | Dardo de 8: roba una Esencia; **si el rival no tiene, le cansa un elemento y te descansa uno**.  |
| Marea → Tormenta → Marea    | **Diluvio**               | Zona de 8 m por 6 s donde nadie puede saltar ni teletransportarse.                               |
| Marea → Tormenta → Umbra    | **Reflejo**               | Copias el último hechizo del rival: sale en tu próximo lanzamiento en 8 s.                       |
| Marea → Marea → Umbra       | **Espejo de agua**        | 3 s: devuelves los proyectiles a quien los lanzó.                                                |
| Marea → Raíz → Tormenta     | **Nenúfares**             | Cuatro hojas en rombo por 10 s; pisando una saltas a la que tengas más adelante.                 |
| Marea → Raíz → Umbra        | **Renacer**               | Si caes en 6 s, vuelves ahí mismo con 40% de vida. Una vez por ronda.                            |
| Marea → Umbra → Marea       | **Profundidad**           | 5 s: el daño que recibes no llega de golpe; se reparte en los 5 s siguientes.                    |
| Marea → Umbra → Umbra       | **Bruma del olvido**      | Los rivales a 6 m pierden su tejido y no pueden repetir su último hechizo por 6 s.               |
| Raíz → Brasa → Tormenta     | **Polen**                 | Nube de 5 m a 7 m por 6 s; si la toca un hechizo con Brasa (de quien sea), explota con 50.       |
| Raíz → Brasa → Marea        | **Hongo gigante**         | Hongo de 3 m por 10 s que tapa vista y paso; al golpearlo frena a los rivales cercanos.          |
| Raíz → Brasa → Umbra        | **Ortiga**                | 6 s: quien te pegue recibe de vuelta la mitad del daño.                                          |
| Raíz → Marea → Brasa        | **Fertilizar**            | Tus invocaciones a 8 m tienen el doble de vida y daño por 6 s.                                   |
| Raíz → Marea → Tormenta     | **Rocío**                 | 6 s: cada hechizo que lanzas cura 8 a tu equipo cercano, a ti incluido.                          |
| Raíz → Marea → Marea        | **Sequía**                | Secas el agua a 8 m (muros de hielo, charcos, nieblas, burbujas, mojados) y te curas 8 por cada. |
| Raíz → Marea → Raíz         | **Injerto**               | Te unes a un aliado 6 s y el daño se reparte. **Solo con aliados**: en 1v1 se pierde.            |
| Raíz → Marea → Umbra        | **Podredumbre**           | 5 s: cada curación que reciba el rival le hace daño.                                             |
| Raíz → Umbra → Raíz         | **Marchitar**             | Zona de 6 m por 6 s donde los rivales no descansan sus elementos.                                |
| Raíz → Umbra → Umbra        | **Hurto**                 | El próximo hechizo del rival en 6 s no sale: te lo quedas para tu próximo lanzamiento.           |
| Umbra → Brasa → Brasa       | **Sombra fatal**          | Si el rival tiene menos de 25% de vida, cae al instante; si no, no pasa nada.                    |
| Umbra → Brasa → Marea       | **Mal de ojo**            | 5 s: al rival se le corren de lugar los botones de elementos (y las teclas 1-5).                 |
| Umbra → Brasa → Umbra       | **Juramento**             | 3 s: ni tú ni el rival marcado pueden hacerse daño.                                              |
| Umbra → Tormenta → Brasa    | **Sombra lanzada**        | Tu sombra vuela 10 m; en 4 s, tocar ✦ sin tejer te lleva a ella.                                 |
| Umbra → Marea → Brasa       | **Réquiem**               | Cono de 6 m: por 3 s, los hechizos de esos rivales no hacen daño ni queman.                      |
| Umbra → Marea → Marea       | **Llanto del abismo**     | 5 s: los proyectiles a 3 m quedan flotando; al terminar salen hacia donde miras, ya tuyos.       |
| Umbra → Marea → Umbra       | **Transfusión**           | Si tienes menos vida que el rival, intercambian el porcentaje. Una vez por ronda.                |
| Umbra → Raíz → Brasa        | **Muñeco vudú**           | Un muñeco frente a ti por 6 s: todo el daño que le hagas lo recibe el rival marcado.             |
| Umbra → Raíz → Marea        | **Cosecha de almas**      | 15 s: cada caída a 10 m te da Esencia, **y también cada golpe tuyo de 15 o más (hasta 3)**.      |
| Umbra → Raíz → Raíz         | **Mandrágora**            | Planta escondida para el rival; al pisarla grita: silencia 2 s y lo deja a la vista.             |
| Umbra → Umbra → Raíz        | **Venganza**              | Marca 6 s: si caes **o bajas de 20%**, el rival marcado recibe 45.                               |

Lo marcado en negrita se adaptó para que sirva en el 1v1 en la plaza (decisión de Tomás: opción B).
En la plaza no hay bestias, así que nadie tiene Esencia, y cuando alguien cae se acaba la ronda:
el premio de Hambre de ceniza y de Venganza llegaba tarde.

## Decisiones que tomó Claude en el camino

1. **Pararrayos humano** quedó en **Tormenta → Brasa → Tormenta**. El documento lo ponía en
   Tormenta → Brasa → Marea, pero ese tejido ya era el Orbe errático desde la tanda 1 (el documento
   original ponía el Orbe en Tormenta → Brasa → Tormenta). Para no mover un hechizo que ya conocen,
   el nuevo usa el tejido libre.
2. **Reflejo y Hurto** no agregan un botón: el hechizo guardado sale en tu **próximo lanzamiento**,
   tejas lo que tejas (con el tiempo de canalizar de lo que tejiste). El botón ✦ muestra su nombre.
3. **Sombra lanzada** usa ✦ sin tejer para saltar a la sombra.
4. **Relámpago guiado** se dirige con el joystick: mientras dura, el mago no camina.
5. **Instante** usa un estado propio (`halted`), igual al Ataúd helado pero sobre el rival.
6. **Réquiem** (en el documento, Lamento; se cambió para no confundirlo con el lamento del
   Espectro): además de no hacer daño, los hechizos de quien lo tiene no queman ni maldicen.
7. **Mal de ojo** es un estado del núcleo (`hexed`, con cuántos lugares rotan los botones). Lo
   resuelve la pantalla de quien lo sufre, así que con la Sala solo hay que enviar el estado.
   Los bots no lo sienten.
8. Las **reacciones a los golpes** (Ortiga, Semilla de fuego, Venganza, Hambre de ceniza, Renacer,
   Cosecha) se resuelven al final de cada paso, leyendo los eventos `hit`. Lo que impide el daño
   (Juramento, Instante, Mil pasos, Profundidad, Injerto) va dentro de `dealDamage`.
9. El **Retroceso** necesita recordar dónde estuvo cada mago: guarda 6 muestras (cada 0,5 s) por
   mago. Son 18 números más por mago en el estado que viajará por la red.

## Para decidir jugando

- **Juramento** e **Injerto** son de equipo; en 1v1 Juramento solo sirve para ganar tiempo.
- **Sombra fatal** y **Transfusión** cambian una ronda de golpe: vigilar si se sienten injustas.
- **Mal de ojo**: probar si en el celular se entiende o frustra demasiado.
