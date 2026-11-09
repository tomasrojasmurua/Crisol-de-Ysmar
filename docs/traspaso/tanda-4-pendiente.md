# Grandes hechizos pendientes (tanda 4)

Hay 70 de 125 Grandes hechizos en `main` (hasta el PR #17). Faltan estos 55. Mientras no existan, el tejido lanza el eco del hechizo de sus dos primeros elementos.

Los textos vienen del documento [Rediseño de hechizos](referencia/rediseno-hechizos.md). Son el punto de partida: los números finales van en `packages/content` y se ajustan jugando. La lista se calculó comparando ese documento con `SPELL_NAMES` en `packages/content/src/grimoire.ts`.

Por tipo: tiempo (6), terreno (5), detonador (4), movilidad (4), carga (4), anti (4), contrahechizo (4), represalia (3), fatiga (3), redirección (3), control (3), ejecución (2), copia (2), apoyo (2), economía (2), estado (2), invocación (1), daño (1).

| Tejido                      | Hechizo                   | Tipo          | Qué hace                                                                                                 |
| --------------------------- | ------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Brasa → Brasa → Marea       | **Erupción**              | terreno       | Un volcán pequeño por 6 s que bloquea el paso y lanza rocas ardientes alrededor.                         |
| Brasa → Tormenta → Brasa    | **Granada solar**         | detonador     | Una esfera queda en el suelo 6 s; explota (40 en 3 m) cuando cualquier hechizo tuyo la toca.             |
| Brasa → Tormenta → Tormenta | **Propulsión**            | movilidad     | Por 4 s, cada hechizo que lanzas te da un salto corto hacia donde apuntas y deja fuego atrás.            |
| Brasa → Tormenta → Marea    | **Monzón**                | terreno       | Tormenta de 6 m por 5 s que lanza rayos a los rivales adentro.                                           |
| Brasa → Marea → Brasa       | **Forja**                 | carga         | No hace nada al lanzarlo: tu próximo hechizo de daño en 6 s hace el doble.                               |
| Brasa → Marea → Tormenta    | **Escaldar**              | anti          | Cono de vapor que rompe todos los escudos del rival y le impide tener escudos por 4 s.                   |
| Brasa → Raíz → Brasa        | **Semilla de fuego**      | represalia    | Pones una semilla en un aliado o en ti por 8 s: al recibir un golpe, explota alrededor (40 en 3 m).      |
| Brasa → Raíz → Marea        | **Humo de hoguera**       | terreno       | Una columna de humo de 4 m por 8 s que nadie puede ver a través.                                         |
| Brasa → Raíz → Raíz         | **Hoguera**               | fatiga        | Fogata por 20 s: tú y tus aliados cerca descansan los elementos el doble de rápido.                      |
| Brasa → Umbra → Raíz        | **Hambre de ceniza**      | ejecución     | Marca a un rival: si cae en 8 s, descansas todos tus elementos y recuperas 30 de vida.                   |
| Brasa → Umbra → Umbra       | **Eco ardiente**          | copia         | Tu próximo hechizo sale dos veces: la segunda, 1 s después y desde el mismo lugar.                       |
| Tormenta → Brasa → Brasa    | **Sobrecarga**            | carga         | Tus próximos 3 hechizos en 5 s salen sin canalizar.                                                      |
| Tormenta → Brasa → Marea    | **Pararrayos humano**     | redirección   | Por 3 s atraes hacia ti los proyectiles rivales a 6 m, y cada uno te da escudo en vez de daño.           |
| Tormenta → Brasa → Raíz     | **Cortocircuito**         | contrahechizo | Si el rival a 8 m está tejiendo, su hechizo se cancela y queda aturdido 1 s.                             |
| Tormenta → Brasa → Umbra    | **Estruendo**             | fatiga        | Los rivales a 6 m tienen cansado por 5 s el último elemento que usaron.                                  |
| Tormenta → Tormenta → Raíz  | **Círculo de tótems**     | invocación    | Tres pararrayos unidos por rayos; quien cruza una línea queda aturdido 0,8 s.                            |
| Tormenta → Tormenta → Umbra | **Mil pasos**             | movilidad     | Te vuelves intocable 1,5 s y golpeas saltando entre hasta 4 rivales cercanos.                            |
| Tormenta → Marea → Marea    | **Pista de hielo**        | terreno       | Un camino de hielo de 12 m por 6 s: quien entra se desliza recto sin poder girar, tú incluido.           |
| Tormenta → Marea → Umbra    | **Vendaval**              | anti          | Una ráfaga en cono apaga las invocaciones, trampas y zonas rivales que toca.                             |
| Tormenta → Raíz → Brasa     | **Relámpago guiado**      | daño          | Un rayo que diriges con el dedo durante 2 s mientras te quedas quieto.                                   |
| Tormenta → Raíz → Tormenta  | **Tirolesa**              | apoyo         | Un cable de 14 m por 8 s: tú y tus aliados viajan rápido por él al tocarlo.                              |
| Tormenta → Raíz → Marea     | **Crecimiento acelerado** | tiempo        | Zona de 5 m por 4 s donde tus aliados y tus invocaciones actúan 50% más rápido.                          |
| Tormenta → Raíz → Raíz      | **Red eléctrica**         | detonador     | Activa al mismo tiempo todas tus trampas, minas e invocaciones a 12 m.                                   |
| Tormenta → Umbra → Brasa    | **Retroceso**             | tiempo        | Vuelves a donde estabas hace 3 s, con la vida que tenías entonces.                                       |
| Tormenta → Umbra → Marea    | **Instante**              | tiempo        | El rival queda detenido en el tiempo 1,5 s: no se mueve, no actúa y no recibe daño.                      |
| Tormenta → Umbra → Raíz     | **Rayo de enlace**        | control       | Une a dos rivales con un rayo por 4 s; si se separan a más de 6 m, ambos quedan aturdidos 1 s.           |
| Marea → Tormenta → Brasa    | **Sifón**                 | economía      | Si acierta, le robas al rival una Esencia.                                                               |
| Marea → Tormenta → Marea    | **Diluvio**               | anti          | Zona de 8 m por 6 s donde nadie puede saltar ni teletransportarse.                                       |
| Marea → Tormenta → Umbra    | **Reflejo**               | copia         | Copias el último hechizo que lanzó el rival y lo puedes lanzar tú en los próximos 8 s.                   |
| Marea → Marea → Umbra       | **Espejo de agua**        | redirección   | Por 3 s devuelves los proyectiles a quien los lanzó.                                                     |
| Marea → Raíz → Tormenta     | **Nenúfares**             | movilidad     | Cuatro hojas en el suelo por 10 s; tocando una, saltas al instante a otra.                               |
| Marea → Raíz → Umbra        | **Renacer**               | tiempo        | Si caes en los próximos 6 s, vuelves con 40% de vida ahí mismo. Una vez por ronda.                       |
| Marea → Umbra → Marea       | **Profundidad**           | tiempo        | Por 5 s el daño que recibes no llega de golpe: se reparte en los 5 s siguientes.                         |
| Marea → Umbra → Umbra       | **Bruma del olvido**      | contrahechizo | A los rivales a 6 m se les vacía el tejido y no pueden repetir su último hechizo por 6 s.                |
| Raíz → Brasa → Tormenta     | **Polen**                 | detonador     | Nube de polen de 5 m por 6 s; si la toca un hechizo con Brasa, explota: 50 de daño.                      |
| Raíz → Brasa → Marea        | **Hongo gigante**         | terreno       | Crece un hongo de 3 m que tapa la vista; al golpearlo suelta esporas que ralentizan.                     |
| Raíz → Brasa → Umbra        | **Ortiga**                | represalia    | Por 6 s, quien te pegue recibe de vuelta la mitad del daño.                                              |
| Raíz → Marea → Brasa        | **Fertilizar**            | carga         | Tus invocaciones a 8 m tienen el doble de vida y daño por 6 s.                                           |
| Raíz → Marea → Tormenta     | **Rocío**                 | carga         | Por 6 s, cada hechizo que lanzas cura 8 a tus aliados cercanos.                                          |
| Raíz → Marea → Marea        | **Sequía**                | anti          | Secas todo a 8 m: deshaces muros de hielo, charcos, pantanos y escudos de agua, y te curas por cada uno. |
| Raíz → Marea → Raíz         | **Injerto**               | apoyo         | Te unes a un aliado por 6 s: el daño que recibe cualquiera se reparte entre los dos.                     |
| Raíz → Marea → Umbra        | **Podredumbre**           | estado        | Por 5 s, cada curación que reciba el rival le hace daño en vez de curarlo.                               |
| Raíz → Umbra → Raíz         | **Marchitar**             | fatiga        | Zona de 6 m por 6 s donde los rivales no descansan sus elementos.                                        |
| Raíz → Umbra → Umbra        | **Hurto**                 | contrahechizo | El próximo hechizo que lance el rival en 6 s no sale: te lo quedas tú para lanzarlo.                     |
| Umbra → Brasa → Brasa       | **Sombra fatal**          | ejecución     | Si el rival tiene menos de 25% de vida, cae al instante; si no, no pasa nada.                            |
| Umbra → Brasa → Marea       | **Mal de ojo**            | estado        | Por 5 s, al rival se le cambian de lugar los botones de los elementos.                                   |
| Umbra → Brasa → Umbra       | **Juramento**             | control       | Por 3 s, ni tú ni el rival marcado pueden hacerse daño. Sirve para sacarlo de la pelea en un 2v2.        |
| Umbra → Tormenta → Brasa    | **Sombra lanzada**        | movilidad     | Lanzas tu sombra 10 m; en los próximos 4 s puedes volver a tocar para teletransportarte a ella.          |
| Umbra → Marea → Brasa       | **Lamento**               | contrahechizo | Los rivales en un cono de 6 m no pueden lanzar hechizos de daño por 3 s.                                 |
| Umbra → Marea → Marea       | **Llanto del abismo**     | redirección   | Por 5 s los proyectiles a 3 m de ti quedan flotando; al terminar salen hacia donde apuntas.              |
| Umbra → Marea → Umbra       | **Transfusión**           | tiempo        | Si tienes menos vida que el rival, intercambian el porcentaje de vida. Una vez por ronda.                |
| Umbra → Raíz → Brasa        | **Muñeco vudú**           | detonador     | Un muñeco por 6 s: todo el daño que le hagas lo recibe el rival marcado.                                 |
| Umbra → Raíz → Marea        | **Cosecha de almas**      | economía      | Cada bestia o mago que caiga a 10 m en 15 s te da una Esencia.                                           |
| Umbra → Raíz → Raíz         | **Mandrágora**            | control       | Una planta escondida que grita al pisarla: silencia 2 s y revela a quien la pisó.                        |
| Umbra → Umbra → Raíz        | **Venganza**              | represalia    | Si caes en los próximos 6 s, el rival marcado recibe 60 de daño.                                         |

Reglas que la tanda debe respetar: ningún tejido sale en menos de 5 pasos (unos 0,17 s, PR #16), los de 3 elementos canalizan 0,6 s y cansan sus tres elementos, y los que cambian la pantalla del rival (Mal de ojo) se resuelven en la Sala pensando en el multijugador.
