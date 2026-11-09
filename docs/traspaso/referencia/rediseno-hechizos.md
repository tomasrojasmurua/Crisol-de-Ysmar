# Rediseño de hechizos

Copia del documento de Claude del 9 de noviembre de 2026 (autor: Tomás Rojas Murúa). Es la referencia de cada hechizo; los números finales viven en `packages/content`.

## Auditoría: qué pasa hoy

Tienes razón: de los 155 tejidos, solo 60 se comportan distinto; los otros 95 cambian únicamente números. Lo medí agrupando cada tejido por forma, estados que aplica y si lleva Tormenta.

- **Cinco comportamientos, no 155.** El primer elemento elige la forma (Dardo, Salto, Muro, Trampa, Marca). Los elementos siguientes solo multiplican daño, velocidad y alcance, y suman uno de cuatro estados.
- **Modificadores que no hacen nada.** Muro + Marea, Trampa + Raíz y Marca + Umbra repiten el estado que la forma ya pone. El Muro ignora velocidad y alcance, así que "Muro de trueno" es un Muro con 10% más de daño.
- **Repetir un elemento solo pega más fuerte.** Brasa-Brasa-Brasa es un Dardo con más daño, nada más.
- **Dos estados son el mismo.** Quemadura y Maldición son ambas daño por segundo.
- **Casi no hay combos.** Existen dos interacciones y una castiga combinar: Marea apaga la Quemadura que tú mismo pusiste.
- **El pentágono no se usa.** "Vecinos combinan, opuestos chocan" está en el diseño, pero el código de conjuros nunca lo mira.
- **Lo visual tampoco distingue.** El color sale de la forma. Los elementos 2 y 3 solo se ven como chispitas alrededor del Dardo; en Muro, Trampa, Salto y Marca no se ven.

## Versión 2: cada combinación es un hechizo propio

Dejo atrás forma + verbo. Ahora cada par de elementos es un hechizo diseñado a mano, con su efecto y su visual, y los cinco hechizos que empiezan con un mismo elemento cumplen cinco funciones distintas. Raíz primero puede ser un muro, una seguidilla de espinas, un gancho, una invocación o un debilitamiento, según lo que venga después.

Tomo como base los arquetipos clásicos de los MOBA (golpe en área, levantar por los aires, teletransporte, gancho, torreta, invisibilidad, silencio, inmunidad breve), con nombres y aspecto propios de Ysmar.

| Largo del tejido | Qué es                                                                     | Canalización | Cuántos |
| ---------------- | -------------------------------------------------------------------------- | ------------ | ------- |
| 1 elemento       | **Básico**: un golpe rápido y sencillo de cada elemento.                   | 0,1 s        | 5       |
| 2 elementos      | **Hechizo propio**: el corazón del juego. Efecto, rol y visual únicos.     | 0,3 s        | 25      |
| 3 elementos      | **Gran hechizo**: más lento y decisivo. Cada orden es un hechizo distinto. | 0,6 s        | 125     |

Los tipos son los que nombraste: **daño**, **control**, **movilidad**, **invocación**, **refuerzo** (escudos, curas, inmunidad), **estado** (debilitar al rival), y dos que salen solos del mapa: **terreno** (muros y zonas) y **sigilo**.

## Mapa de los 25 hechizos

Fila = primer elemento, columna = segundo. Ninguna fila repite tipo dos veces, salvo Marea, que tiene dos refuerzos muy distintos (curar y volverse inmune).

| Primero \ Segundo | Brasa                       | Tormenta              | Marea                          | Raíz                        | Umbra                   |
| ----------------- | --------------------------- | --------------------- | ------------------------------ | --------------------------- | ----------------------- |
| **Brasa**         | Bola ígnea · daño           | Cometa · movilidad    | Obsidiana · refuerzo           | Fuego fatuo · invocación    | Ignición · estado       |
| **Tormenta**      | Rayo en cadena · daño       | Destello · movilidad  | Ventisca · terreno             | Pararrayos · invocación     | Paso sombrío · control  |
| **Marea**         | Géiser · control            | Corriente · movilidad | Muro de hielo · terreno        | Manantial · refuerzo        | Ataúd helado · refuerzo |
| **Raíz**          | Estampida de espinas · daño | Liana · movilidad     | Guardián de musgo · invocación | Muralla de raíces · terreno | Esporas · estado        |
| **Umbra**         | Drenaje · daño              | Señuelo · invocación  | Ceguera · estado               | Grillete · control          | Velo · sigilo           |

Tus cuatro ejemplos están: el géiser es Marea → Brasa, la invisibilidad es Umbra → Umbra, la seguidilla de raíces es Raíz → Brasa y el muro divisorio es Raíz → Raíz.

## Los hechizos en detalle

Los números son un punto de partida; vida del mago: 180. Irían en `packages/content` y los ajustamos jugando.

### Básicos (1 elemento)

| Hechizo              | Qué hace                                          | Cuándo lo eliges                          | Cómo se ve                       |
| -------------------- | ------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| Brasa · **Chispa**   | Dardo rápido: 10 de daño y quema 2 s.             | Castigar a distancia sin gastar mucho.    | Chispa naranja con estela corta. |
| Tormenta · **Paso**  | Te desplazas 4 m hacia donde apuntas.             | Esquivar algo que viene.                  | Destello celeste.                |
| Marea · **Salpicón** | Cono de 3 m: 6 de daño y 30% más lento por 1,5 s. | Sacarte de encima a quien te persigue.    | Abanico de agua.                 |
| Raíz · **Savia**     | Te curas 15 en 3 s.                               | Entre peleas.                             | Hojas que giran a tu alrededor.  |
| Umbra · **Zarpa**    | Golpe instantáneo a 6 m: 6 de daño y robas 6.     | Rematar algo que se esconde tras su muro. | Garra violeta.                   |

### Brasa primero

| Hechizo                        | Qué hace                                                                                                                 | Cuándo lo eliges                                              | Cómo se ve                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------ |
| Brasa → Brasa · **Bola ígnea** | Proyectil lento y grande que explota en 3 m: 30 de daño y quema.                                                         | Contra rivales quietos o juntos, justo después de un control. | Esfera que crece y estalla en anillo de fuego.   |
| Brasa → Tormenta · **Cometa**  | Te lanzas 8 m y dejas un rastro de fuego por 3 s que quema a quien lo pise.                                              | Entrar a la pelea, o huir y cortarle el paso.                 | Te envuelves en llamas; el suelo queda ardiendo. |
| Brasa → Marea · **Obsidiana**  | Coraza que absorbe 40 por 4 s; al romperse o terminar, estalla en 2,5 m con 15 de daño.                                  | Aguantar un intercambio de cerca.                             | Placas negras con grietas que brillan.           |
| Brasa → Raíz · **Fuego fatuo** | Invoca una llama que persigue al rival más cercano por 6 s y explota al tocarlo (20). Se esquiva o se apaga de un golpe. | Presionar mientras haces otra cosa, o sacarlo de la jungla.   | Llama azul y naranja que flota.                  |
| Brasa → Umbra · **Ignición**   | Marca al rival 3 s; al terminar, explota con el 40% de todo el daño que recibió en ese tiempo.                           | Abrir una ráfaga: todo lo que le pegues después rinde más.    | Brasa negra que late sobre su pecho y crece.     |

### Tormenta primero

| Hechizo                               | Qué hace                                                                                                    | Cuándo lo eliges                                          | Cómo se ve                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Tormenta → Brasa · **Rayo en cadena** | Rayo instantáneo a 9 m que salta a dos blancos más cercanos: 18, 12 y 8.                                    | Contra grupos y campamentos.                              | Arco blanco en zigzag.                                 |
| Tormenta → Tormenta · **Destello**    | Te teletransportas 7 m al instante, incluso a través de árboles y rocas.                                    | Escapar seguro o perseguir por la jungla.                 | Desapareces en una chispa y apareces con un trueno.    |
| Tormenta → Marea · **Ventisca**       | Torbellino fijo de 3,5 m por 4 s: rivales dentro 40% más lentos y los proyectiles que lo cruzan se desvían. | Defender una posición contra dardos.                      | Remolino de nieve y viento.                            |
| Tormenta → Raíz · **Pararrayos**      | Poste por 8 s que da un rayo de 5 al rival más cercano a 7 m cada segundo. Cae con dos golpes.              | Tomar un santuario o un campamento.                       | Tótem de madera con punta eléctrica.                   |
| Tormenta → Umbra · **Paso sombrío**   | Apareces detrás de un rival a 6 m y lo silencias 1,2 s: no puede tejer.                                     | Cortar un conjuro de 3 elementos que te están preparando. | Te deshaces en humo eléctrico y apareces a su espalda. |

### Marea primero

| Hechizo                           | Qué hace                                                                                                                            | Cuándo lo eliges                                   | Cómo se ve                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Marea → Brasa · **Géiser**        | Marcas un punto a 8 m; tras 0,6 s de aviso brota un géiser hirviente de 2 m que levanta por los aires 1 s a quien esté encima (12). | Predecir hacia dónde va, o rematar a un enraizado. | Círculo que burbujea y luego columna de agua y vapor. |
| Marea → Tormenta · **Corriente**  | Río de 10 m por 4 s: tú y tus aliados a favor corren 50% más rápido; los rivales que lo cruzan van lentos.                          | Perseguir, huir o llegar antes a un santuario.     | Franja de agua con espuma que corre.                  |
| Marea → Marea · **Muro de hielo** | Muro de 5 m que bloquea paso y proyectiles por 4 s.                                                                                 | Cortar un dardo o separar a dos rivales.           | Bloques de hielo que se astillan al terminar.         |
| Marea → Raíz · **Manantial**      | Fuente de 3 m por 5 s que cura 6 por segundo a ti y a tus aliados.                                                                  | Ganar una pelea larga en un punto.                 | Charco luminoso con plantas de agua.                  |
| Marea → Umbra · **Ataúd helado**  | Te congelas 1,5 s: no recibes daño ni estados, pero no actúas. Al salir quedas limpio.                                              | Sobrevivir a una ráfaga o esperar ayuda.           | Bloque de hielo oscuro con tu silueta adentro.        |

### Raíz primero

| Hechizo                                 | Qué hace                                                                                                                     | Cuándo lo eliges                            | Cómo se ve                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Raíz → Brasa · **Estampida de espinas** | Cinco brotes de espinas avanzan en línea 10 m, uno cada 0,1 s; cada uno golpea 2 m alrededor (8 cada uno).                   | Castigar a quien huye por un sendero.       | Raíces que revientan del suelo en fila.       |
| Raíz → Tormenta · **Liana**             | Lanzas una liana a 9 m. Si toca un árbol o una roca, vuelas hacia ahí; si toca a un rival, vas hacia él y lo enraízas 0,8 s. | Moverte por la jungla, o entrar a la pelea. | Liana verde que se tensa.                     |
| Raíz → Marea · **Guardián de musgo**    | Invocas por 10 s una criatura de 60 de vida que te sigue, pega de cerca y se pone delante de los proyectiles.                | Ganar presión en un uno contra uno.         | Bestia baja de piedra y musgo.                |
| Raíz → Raíz · **Muralla de raíces**     | Golpeas el suelo y brota una muralla de 8 m por 5 s, de lado a donde miras. Bloquea paso y proyectiles de todos.             | Partir el campo en dos o separar un 2v2.    | Raíces gruesas que suben y sacuden la cámara. |
| Raíz → Umbra · **Esporas**              | Nube de 3 m por 4 s: los rivales dentro quedan Débiles, hacen 30% menos daño por 3 s.                                        | Ganar un intercambio de golpes.             | Nube verde y violeta.                         |

### Umbra primero

| Hechizo                        | Qué hace                                                                                                                 | Cuándo lo eliges                      | Cómo se ve                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------- |
| Umbra → Brasa · **Drenaje**    | Atas un hilo a un rival a 7 m: le robas 8 por segundo hasta 3 s. Se corta si se aleja a más de 9 m o pasa tras un árbol. | Recuperar vida mientras peleas.       | Hilo violeta que late hacia ti.                                  |
| Umbra → Tormenta · **Señuelo** | Quedas invisible 1,5 s y un doble tuyo corre hacia donde apuntas.                                                        | Engañar y escapar.                    | Una copia tuya, con tu ropa, que se deshace al recibir un golpe. |
| Umbra → Marea · **Ceguera**    | Proyectil de sombra: el rival tocado solo ve 3 m a su alrededor por 3 s y se le apaga el minimapa.                       | Antes de ir por él en la jungla.      | Niebla negra en su cabeza; en su pantalla, todo oscuro.          |
| Umbra → Raíz · **Grillete**    | Atas al rival a su lugar por 4 s. Si se aleja más de 4 m, queda enraizado 1,5 s y recibe 15.                             | Obligarlo a pelear y no dejarlo huir. | Cadena violeta clavada al suelo.                                 |
| Umbra → Umbra · **Velo**       | Invisible 4 s: te ven solo a 2 m o si te pegan. El primer hechizo que lances desde el velo hace 30% más.                 | Emboscar o desaparecer.               | Te deshaces en humo; un brillo leve para quien está cerca.       |

## Grandes hechizos: los 125 de 3 elementos

Cada orden de tres elementos es un hechizo propio, así que Brasa → Marea → Raíz y Raíz → Marea → Brasa no se parecen en nada. Tardan 0,6 s en tejerse y cansan los tres elementos: son el golpe decisivo de un duelo.

**La regla:** cada hechizo tiene que completar la frase "es el único que…". Si dos se parecen, uno se cambia.

### Los 20 tipos

| Tipo           | Qué hace                                                      | Ejemplos                                        |
| -------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Daño           | Hiere directo, en línea, en área o con retraso.               | Meteoro, Lanza del cielo, Llama negra           |
| Control        | Le quita al rival moverse, tejer o actuar.                    | Era de hielo, Pesadilla, Planta carnívora       |
| Movilidad      | Te lleva de un lugar a otro.                                  | Tempestad, Fantasma, Portal                     |
| Invocación     | Crea algo que actúa solo.                                     | Árbol ancestral, Enjambre, Gólem de magma       |
| Refuerzo       | Te protege a ti: escudos, inmunidad, curas.                   | Inmolación, Purificación, Ojo del huracán       |
| Estado         | Debilita al rival por un rato.                                | Ácido, Combustión, Robo de velocidad            |
| Terreno        | Cambia el suelo por unos segundos: muros, zonas.              | Erupción, Manglar, Anillo de zarzas             |
| Sigilo         | Te esconde o te disfraza.                                     | Bosque maldito, Espejismo, Sombra prestada      |
| Contrahechizo  | Corta, roba o borra los hechizos del rival.                   | Cortocircuito, Hurto, Bruma del olvido          |
| Fatiga         | Cansa los elementos del rival o descansa los tuyos.           | Estruendo, Hoguera, Marchitar                   |
| Copia          | Usa un hechizo que no es tuyo, o el tuyo dos veces.           | Reflejo, Eco ardiente                           |
| Transformación | Te vuelve otra cosa, con reglas propias.                      | Forma de magma, Surf, Pantera de sombra         |
| Tiempo         | Rebobina, detiene o acelera.                                  | Retroceso, Instante, Profundidad                |
| Detonador      | Prepara algo que otro hechizo hace estallar.                  | Granada solar, Polen, Muñeco vudú               |
| Mapa vivo      | Cambia la jungla para toda la ronda.                          | Incendio forestal, Brote de árbol, Domar bestia |
| Información    | Te deja ver lo que está oculto.                               | Cazador, Centinela, Barómetro                   |
| Anti           | Apaga un tipo de magia: curas, escudos, saltos, invocaciones. | Escaldar, Diluvio, Vendaval                     |
| Apoyo          | Ayuda a un aliado: protegerlo, curarlo, revivirlo.            | Burbuja, Agua de vida, Injerto                  |
| Carga          | No hace nada ahora y potencia lo que viene.                   | Forja, Sobrecarga, Rocío                        |
| Redirección    | Devuelve o atrapa lo que te lanzan.                           | Espejo de agua, Llanto del abismo               |

Además hay subtipos pequeños: represalia (castiga a quien te pega), ejecución (remata) y economía (Esencia).

### Brasa primero

| Tejido                      | Hechizo               | Tipo           | Qué hace                                                                                                    |
| --------------------------- | --------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Brasa → Brasa → Brasa       | **Meteoro**           | daño           | Tras 1,5 s de aviso cae en 5 m: 60 de daño.                                                                 |
| Brasa → Brasa → Tormenta    | **Lluvia de fuego**   | daño           | Por 4 s cae fuego sobre cada rival que se mueva a 10 m; quedarse quieto lo salva.                           |
| Brasa → Brasa → Marea       | **Erupción**          | terreno        | Un volcán pequeño por 6 s que bloquea el paso y lanza rocas ardientes alrededor.                            |
| Brasa → Brasa → Raíz        | **Ave de ceniza**     | invocación     | Un ave de fuego vuela 12 m y vuelve, quemando todo lo que cruza.                                            |
| Brasa → Brasa → Umbra       | **Inmolación**        | refuerzo       | Por 5 s ardes: quemas a todo a 2,5 m y te curas con ese daño.                                               |
| Brasa → Tormenta → Brasa    | **Granada solar**     | detonador      | Una esfera queda en el suelo 6 s; explota (40 en 3 m) cuando cualquier hechizo tuyo la toca.                |
| Brasa → Tormenta → Tormenta | **Propulsión**        | movilidad      | Por 4 s, cada hechizo que lanzas te da un salto corto hacia donde apuntas y deja fuego atrás.               |
| Brasa → Tormenta → Marea    | **Monzón**            | terreno        | Tormenta de 6 m por 5 s que lanza rayos a los rivales adentro.                                              |
| Brasa → Tormenta → Raíz     | **Incendio forestal** | mapa vivo      | Un fuego avanza hacia donde miras y quema los árboles: abre senderos en la jungla por el resto de la ronda. |
| Brasa → Tormenta → Umbra    | **Cometa negro**      | movilidad      | Proyectil que, si acierta, te lleva junto al rival y lo silencia 1 s.                                       |
| Brasa → Marea → Brasa       | **Forja**             | carga          | No hace nada al lanzarlo: tu próximo hechizo de daño en 6 s hace el doble.                                  |
| Brasa → Marea → Tormenta    | **Escaldar**          | anti           | Cono de vapor que rompe todos los escudos del rival y le impide tener escudos por 4 s.                      |
| Brasa → Marea → Marea       | **Forma de magma**    | transformación | Por 5 s eres magma: lento, inmune a ralentizar y enraizar, y dejas suelo ardiendo al caminar.               |
| Brasa → Marea → Raíz        | **Fuente termal**     | apoyo          | Zona de 4 m por 6 s: tú y tus aliados tejen 40% más rápido.                                                 |
| Brasa → Marea → Umbra       | **Niebla carmesí**    | sigilo         | Niebla de 7 m por 5 s: nadie ve a más de 2 m y tú robas vida con cada golpe.                                |
| Brasa → Raíz → Brasa        | **Semilla de fuego**  | represalia     | Pones una semilla en un aliado o en ti por 8 s: al recibir un golpe, explota alrededor (40 en 3 m).         |
| Brasa → Raíz → Tormenta     | **Chispas errantes**  | invocación     | Tres chispas giran a tu alrededor 8 s y salen disparadas al primer rival que se acerque a 4 m.              |
| Brasa → Raíz → Marea        | **Humo de hoguera**   | terreno        | Una columna de humo de 4 m por 8 s que nadie puede ver a través.                                            |
| Brasa → Raíz → Raíz         | **Hoguera**           | fatiga         | Fogata por 20 s: tú y tus aliados cerca descansan los elementos el doble de rápido.                         |
| Brasa → Raíz → Umbra        | **Gólem de magma**    | invocación     | Un gólem por 12 s que se pone delante tuyo y explota al caer.                                               |
| Brasa → Umbra → Brasa       | **Combustión**        | estado         | Por 5 s, cada hechizo que el rival teja le hace 10 de daño a él mismo.                                      |
| Brasa → Umbra → Tormenta    | **Paso de ascuas**    | movilidad      | Te teletransportas a cualquier suelo que esté ardiendo a 15 m.                                              |
| Brasa → Umbra → Marea       | **Llama negra**       | daño           | Proyectil que atraviesa muros, escudos e invocaciones.                                                      |
| Brasa → Umbra → Raíz        | **Hambre de ceniza**  | ejecución      | Marca a un rival: si cae en 8 s, descansas todos tus elementos y recuperas 30 de vida.                      |
| Brasa → Umbra → Umbra       | **Eco ardiente**      | copia          | Tu próximo hechizo sale dos veces: la segunda, 1 s después y desde el mismo lugar.                          |

### Tormenta primero

| Tejido                         | Hechizo                   | Tipo          | Qué hace                                                                                       |
| ------------------------------ | ------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| Tormenta → Brasa → Brasa       | **Sobrecarga**            | carga         | Tus próximos 3 hechizos en 5 s salen sin canalizar.                                            |
| Tormenta → Brasa → Tormenta    | **Orbe errático**         | daño          | Un orbe lento avanza 12 m y da rayos a todo rival a 4 m mientras pasa.                         |
| Tormenta → Brasa → Marea       | **Pararrayos humano**     | redirección   | Por 3 s atraes hacia ti los proyectiles rivales a 6 m, y cada uno te da escudo en vez de daño. |
| Tormenta → Brasa → Raíz        | **Cortocircuito**         | contrahechizo | Si el rival a 8 m está tejiendo, su hechizo se cancela y queda aturdido 1 s.                   |
| Tormenta → Brasa → Umbra       | **Estruendo**             | fatiga        | Los rivales a 6 m tienen cansado por 5 s el último elemento que usaron.                        |
| Tormenta → Tormenta → Brasa    | **Lanza del cielo**       | daño          | Tras 0,5 s cae un rayo en línea de 14 m: 45 de daño.                                           |
| Tormenta → Tormenta → Tormenta | **Tempestad**             | movilidad     | Tres destellos de 6 m en 4 s; cada llegada descarga 10 en 2 m.                                 |
| Tormenta → Tormenta → Marea    | **Huracán**               | control       | Un tornado avanza lento y levanta por los aires 1 s a quien toca.                              |
| Tormenta → Tormenta → Raíz     | **Círculo de tótems**     | invocación    | Tres pararrayos unidos por rayos; quien cruza una línea queda aturdido 0,8 s.                  |
| Tormenta → Tormenta → Umbra    | **Mil pasos**             | movilidad     | Te vuelves intocable 1,5 s y golpeas saltando entre hasta 4 rivales cercanos.                  |
| Tormenta → Marea → Brasa       | **Barómetro**             | información   | Por 10 s ves cuánto le falta a cada elemento del rival para descansar.                         |
| Tormenta → Marea → Tormenta    | **Viento de cola**        | apoyo         | Tú y tus aliados a 8 m corren 40% más rápido por 5 s.                                          |
| Tormenta → Marea → Marea       | **Pista de hielo**        | terreno       | Un camino de hielo de 12 m por 6 s: quien entra se desliza recto sin poder girar, tú incluido. |
| Tormenta → Marea → Raíz        | **Ojo del huracán**       | refuerzo      | Por 4 s nada entra a 2 m de ti: proyectiles y magos se detienen en el borde.                   |
| Tormenta → Marea → Umbra       | **Vendaval**              | anti          | Una ráfaga en cono apaga las invocaciones, trampas y zonas rivales que toca.                   |
| Tormenta → Raíz → Brasa        | **Relámpago guiado**      | daño          | Un rayo que diriges con el dedo durante 2 s mientras te quedas quieto.                         |
| Tormenta → Raíz → Tormenta     | **Tirolesa**              | apoyo         | Un cable de 14 m por 8 s: tú y tus aliados viajan rápido por él al tocarlo.                    |
| Tormenta → Raíz → Marea        | **Crecimiento acelerado** | tiempo        | Zona de 5 m por 4 s donde tus aliados y tus invocaciones actúan 50% más rápido.                |
| Tormenta → Raíz → Raíz         | **Red eléctrica**         | detonador     | Activa al mismo tiempo todas tus trampas, minas e invocaciones a 12 m.                         |
| Tormenta → Raíz → Umbra        | **Cazador**               | información   | Por 6 s ves a todos los rivales del mapa y corres 30% más rápido.                              |
| Tormenta → Umbra → Brasa       | **Retroceso**             | tiempo        | Vuelves a donde estabas hace 3 s, con la vida que tenías entonces.                             |
| Tormenta → Umbra → Tormenta    | **Intercambio**           | movilidad     | Cambias de lugar con cualquier mago, aliado o rival, que veas a 12 m.                          |
| Tormenta → Umbra → Marea       | **Instante**              | tiempo        | El rival queda detenido en el tiempo 1,5 s: no se mueve, no actúa y no recibe daño.            |
| Tormenta → Umbra → Raíz        | **Rayo de enlace**        | control       | Une a dos rivales con un rayo por 4 s; si se separan a más de 6 m, ambos quedan aturdidos 1 s. |
| Tormenta → Umbra → Umbra       | **Robo de velocidad**     | estado        | Por 4 s el rival va 40% más lento y tú 40% más rápido.                                         |

### Marea primero

| Tejido                      | Hechizo              | Tipo           | Qué hace                                                                                       |
| --------------------------- | -------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| Marea → Brasa → Brasa       | **Hervidero**        | terreno        | El suelo en 5 m empieza a hervir; quien siga encima a los 3 s recibe 50.                       |
| Marea → Brasa → Tormenta    | **Chorro de vapor**  | movilidad      | Te impulsas 7 m hacia atrás y el chorro quema hacia adelante.                                  |
| Marea → Brasa → Marea       | **Burbuja**          | apoyo          | Encierras a un aliado, o a ti, en una burbuja que absorbe 60 por 4 s.                          |
| Marea → Brasa → Raíz        | **Agua de vida**     | apoyo          | Revives al instante a un aliado caído a 8 m, con 30% de vida.                                  |
| Marea → Brasa → Umbra       | **Ácido**            | estado         | El rival tocado recibe 30% más daño de todo por 4 s.                                           |
| Marea → Tormenta → Brasa    | **Sifón**            | economía       | Si acierta, le robas al rival una Esencia.                                                     |
| Marea → Tormenta → Tormenta | **Surf**             | transformación | Por 5 s eres una ola: corres 80% más rápido y atraviesas magos, pero no tejes.                 |
| Marea → Tormenta → Marea    | **Diluvio**          | anti           | Zona de 8 m por 6 s donde nadie puede saltar ni teletransportarse.                             |
| Marea → Tormenta → Raíz     | **Lluvia que borra** | sigilo         | Te quita marcas, rastros y revelaciones, y te saca del minimapa rival por 8 s.                 |
| Marea → Tormenta → Umbra    | **Reflejo**          | copia          | Copias el último hechizo que lanzó el rival y lo puedes lanzar tú en los próximos 8 s.         |
| Marea → Marea → Brasa       | **Vaho**             | estado         | Nube de 6 m por 5 s: los rivales adentro tejen 50% más lento.                                  |
| Marea → Marea → Tormenta    | **Maremoto**         | control        | Una ola gigante cruza el campo y deja 70% más lento a quien toca.                              |
| Marea → Marea → Marea       | **Era de hielo**     | control        | Tras 0,8 s de aviso, todo rival a 6 m queda congelado 1,2 s.                                   |
| Marea → Marea → Raíz        | **Lluvia de vida**   | apoyo          | Lluvia de 8 m por 6 s: cada segundo cura y limpia estados de tus aliados.                      |
| Marea → Marea → Umbra       | **Espejo de agua**   | redirección    | Por 3 s devuelves los proyectiles a quien los lanzó.                                           |
| Marea → Raíz → Brasa        | **Manglar**          | terreno        | Un muro de manglar de 6 m que frena proyectiles pero deja pasar a los magos.                   |
| Marea → Raíz → Tormenta     | **Nenúfares**        | movilidad      | Cuatro hojas en el suelo por 10 s; tocando una, saltas al instante a otra.                     |
| Marea → Raíz → Marea        | **Purificación**     | refuerzo       | Te limpias de todo estado y quedas inmune a estados por 3 s, pudiendo actuar.                  |
| Marea → Raíz → Raíz         | **Glaciar vivo**     | invocación     | Un elemental de hielo por 10 s que congela 1 s al primer rival que toca.                       |
| Marea → Raíz → Umbra        | **Renacer**          | tiempo         | Si caes en los próximos 6 s, vuelves con 40% de vida ahí mismo. Una vez por ronda.             |
| Marea → Umbra → Brasa       | **Ahogo**            | control        | Canalizas 2 s sobre un rival a 6 m; si no sale del alcance, queda silenciado 2 s y recibe 30.  |
| Marea → Umbra → Tormenta    | **Espejismo**        | sigilo         | Tres copias tuyas aparecen y se mueven como tú por 4 s; la verdadera es la que lanza hechizos. |
| Marea → Umbra → Marea       | **Profundidad**      | tiempo         | Por 5 s el daño que recibes no llega de golpe: se reparte en los 5 s siguientes.               |
| Marea → Umbra → Raíz        | **Sacrificio**       | apoyo          | Le pasas 40 de tu vida a un aliado a 10 m.                                                     |
| Marea → Umbra → Umbra       | **Bruma del olvido** | contrahechizo  | A los rivales a 6 m se les vacía el tejido y no pueden repetir su último hechizo por 6 s.      |

### Raíz primero

| Tejido                     | Hechizo                | Tipo           | Qué hace                                                                                                    |
| -------------------------- | ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Raíz → Brasa → Brasa       | **Domar bestia**       | mapa vivo      | La bestia de la jungla que golpees pelea para ti por 20 s.                                                  |
| Raíz → Brasa → Tormenta    | **Polen**              | detonador      | Nube de polen de 5 m por 6 s; si la toca un hechizo con Brasa, explota: 50 de daño.                         |
| Raíz → Brasa → Marea       | **Hongo gigante**      | terreno        | Crece un hongo de 3 m que tapa la vista; al golpearlo suelta esporas que ralentizan.                        |
| Raíz → Brasa → Raíz        | **Brote de árbol**     | mapa vivo      | Haces crecer un árbol a 10 m que queda toda la ronda. Máximo 2 por mago.                                    |
| Raíz → Brasa → Umbra       | **Ortiga**             | represalia     | Por 6 s, quien te pegue recibe de vuelta la mitad del daño.                                                 |
| Raíz → Tormenta → Brasa    | **Catapulta de raíz**  | movilidad      | Una raíz te lanza en arco 12 m por encima de todo; al caer enraízas a quien esté a 3 m.                     |
| Raíz → Tormenta → Tormenta | **Enjambre**           | invocación     | Un enjambre persigue al rival por 5 s, lo ralentiza y le tapa parte de la vista.                            |
| Raíz → Tormenta → Marea    | **Siembra**            | control        | Siembra seis trampas en un área al instante.                                                                |
| Raíz → Tormenta → Raíz     | **Raíces profundas**   | transformación | Te enraízas tú mismo 4 s: no te mueves, pero eres inmune a control y tus hechizos llegan 50% más lejos.     |
| Raíz → Tormenta → Umbra    | **Huella**             | información    | Por 15 s ves el rastro del rival marcado, aunque esté en la jungla.                                         |
| Raíz → Marea → Brasa       | **Fertilizar**         | carga          | Tus invocaciones a 8 m tienen el doble de vida y daño por 6 s.                                              |
| Raíz → Marea → Tormenta    | **Rocío**              | carga          | Por 6 s, cada hechizo que lanzas cura 8 a tus aliados cercanos.                                             |
| Raíz → Marea → Marea       | **Sequía**             | anti           | Secas todo a 8 m: deshaces muros de hielo, charcos, pantanos y escudos de agua, y te curas por cada uno.    |
| Raíz → Marea → Raíz        | **Injerto**            | apoyo          | Te unes a un aliado por 6 s: el daño que recibe cualquiera se reparte entre los dos.                        |
| Raíz → Marea → Umbra       | **Podredumbre**        | estado         | Por 5 s, cada curación que reciba el rival le hace daño en vez de curarlo.                                  |
| Raíz → Raíz → Brasa        | **Anillo de zarzas**   | terreno        | Un anillo de espinas ardientes de 6 m encierra a quien quede adentro por 4 s.                               |
| Raíz → Raíz → Tormenta     | **Manada de raíces**   | invocación     | Cuatro bestias de raíz cargan en línea y enraízan a quien atropellan.                                       |
| Raíz → Raíz → Marea        | **Jardín**             | apoyo          | Cinco flores en el suelo; un aliado que pisa una se cura 20.                                                |
| Raíz → Raíz → Raíz         | **Árbol ancestral**    | invocación     | Un árbol gigante por 15 s que bloquea proyectiles y golpea en área cada 2 s, enraizando.                    |
| Raíz → Raíz → Umbra        | **Bosque maldito**     | sigilo         | Brota un bosquecillo que tapa la vista; adentro eres invisible y los rivales quedan débiles.                |
| Raíz → Umbra → Brasa       | **Planta carnívora**   | control        | Una planta por 10 s traga al primer rival que se acerca, lo deja 1,5 s fuera de juego y lo escupe con daño. |
| Raíz → Umbra → Tormenta    | **Paso entre árboles** | movilidad      | Entras en un árbol y sales por otro árbol a hasta 20 m.                                                     |
| Raíz → Umbra → Marea       | **Alfombra de musgo**  | sigilo         | Zona de 6 m por 8 s: tu equipo adentro no aparece en el minimapa rival.                                     |
| Raíz → Umbra → Raíz        | **Marchitar**          | fatiga         | Zona de 6 m por 6 s donde los rivales no descansan sus elementos.                                           |
| Raíz → Umbra → Umbra       | **Hurto**              | contrahechizo  | El próximo hechizo que lance el rival en 6 s no sale: te lo quedas tú para lanzarlo.                        |

### Umbra primero

| Tejido                      | Hechizo               | Tipo           | Qué hace                                                                                          |
| --------------------------- | --------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Umbra → Brasa → Brasa       | **Sombra fatal**      | ejecución      | Si el rival tiene menos de 25% de vida, cae al instante; si no, no pasa nada.                     |
| Umbra → Brasa → Tormenta    | **Portal**            | movilidad      | Dos portales por 8 s, uno a tus pies y otro a 12 m: cualquiera que entra sale por el otro.        |
| Umbra → Brasa → Marea       | **Mal de ojo**        | estado         | Por 5 s, al rival se le cambian de lugar los botones de los elementos.                            |
| Umbra → Brasa → Raíz        | **Vínculo vital**     | apoyo          | Por 6 s, cada golpe que das cura lo mismo a tu aliado más cercano.                                |
| Umbra → Brasa → Umbra       | **Juramento**         | control        | Por 3 s, ni tú ni el rival marcado pueden hacerse daño. Sirve para sacarlo de la pelea en un 2v2. |
| Umbra → Tormenta → Brasa    | **Sombra lanzada**    | movilidad      | Lanzas tu sombra 10 m; en los próximos 4 s puedes volver a tocar para teletransportarte a ella.   |
| Umbra → Tormenta → Tormenta | **Fantasma**          | movilidad      | Por 4 s atraviesas magos, muros y árboles caminando.                                              |
| Umbra → Tormenta → Marea    | **Abismo**            | control        | Tras un aviso, un vórtice de 4 m silencia 1,5 s a todos los rivales adentro.                      |
| Umbra → Tormenta → Raíz     | **Centinela**         | información    | Un ojo de sombra por 60 s en un punto: ves todo a 8 m a su alrededor.                             |
| Umbra → Tormenta → Umbra    | **Ilusión de tejido** | sigilo         | Por 8 s el rival ve elementos falsos en tu tejido.                                                |
| Umbra → Marea → Brasa       | **Lamento**           | contrahechizo  | Los rivales en un cono de 6 m no pueden lanzar hechizos de daño por 3 s.                          |
| Umbra → Marea → Tormenta    | **Marea de almas**    | refuerzo       | Una ola recorre 12 m y te cura 10 por cada mago que atraviesa.                                    |
| Umbra → Marea → Marea       | **Llanto del abismo** | redirección    | Por 5 s los proyectiles a 3 m de ti quedan flotando; al terminar salen hacia donde apuntas.       |
| Umbra → Marea → Raíz        | **Plaga**             | estado         | 10 de daño por segundo por 4 s, y salta a cualquier rival que se acerque a 2 m.                   |
| Umbra → Marea → Umbra       | **Transfusión**       | tiempo         | Si tienes menos vida que el rival, intercambian el porcentaje de vida. Una vez por ronda.         |
| Umbra → Raíz → Brasa        | **Muñeco vudú**       | detonador      | Un muñeco por 6 s: todo el daño que le hagas lo recibe el rival marcado.                          |
| Umbra → Raíz → Tormenta     | **Pantera de sombra** | transformación | Por 6 s eres una pantera: rápida, con zarpazos que roban vida, pero sin tejer.                    |
| Umbra → Raíz → Marea        | **Cosecha de almas**  | economía       | Cada bestia o mago que caiga a 10 m en 15 s te da una Esencia.                                    |
| Umbra → Raíz → Raíz         | **Mandrágora**        | control        | Una planta escondida que grita al pisarla: silencia 2 s y revela a quien la pisó.                 |
| Umbra → Raíz → Umbra        | **Sombra prestada**   | sigilo         | Por 6 s eres invisible solo para el rival marcado.                                                |
| Umbra → Umbra → Brasa       | **Pira de almas**     | daño           | Marca hasta 3 rivales; a los 2 s cada uno recibe 25 más 10% de la vida que le falta.              |
| Umbra → Umbra → Tormenta    | **Gemelo sombrío**    | invocación     | Un clon tuyo de 40 de vida pelea solo por 8 s con golpes básicos.                                 |
| Umbra → Umbra → Marea       | **Pesadilla**         | control        | El rival se duerme 2 s; despierta si recibe daño.                                                 |
| Umbra → Umbra → Raíz        | **Venganza**          | represalia     | Si caes en los próximos 6 s, el rival marcado recibe 60 de daño.                                  |
| Umbra → Umbra → Umbra       | **Eclipse**           | estado         | Por 5 s los rivales solo ven 4 m en todo el campo; tu equipo ve normal.                           |

## Elegir bien gana duelos

Como cada elemento se cansa al usarlo, gastar Marea en un Géiser te deja sin Ataúd helado por unos segundos. Esa es la decisión de fondo: qué te guardas y qué gastas ahora.

### Respuestas a lo que te hacen

| Te pasa esto                              | Respondes con                               | Por qué funciona                                              |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Ves el círculo de un Géiser bajo tus pies | Paso, Destello o Liana                      | Tienes 0,6 s para salir.                                      |
| Te ponen Ignición                         | Ataúd helado u Obsidiana                    | No recibes daño, así que la explosión queda en nada.          |
| Te están Drenando                         | Muralla de raíces o Destello                | El hilo se corta sin línea de visión o con distancia.         |
| Te lanzan Bola ígnea o Rayo en cadena     | Muro de hielo, Ventisca o Guardián de musgo | Bloquean o desvían; el Rayo salta al Guardián.                |
| Te ponen Grillete                         | Paso sombrío o Destello hacia el rival      | Te acercas en vez de alejarte y lo castigas.                  |
| El rival está con Velo                    | Rayo en cadena o Fuego fatuo                | Ambos buscan blanco solos: el rayo salta y la llama persigue. |

### Combos de ejemplo

1. **Atrapar y reventar:** Liana (lo enraíza) → Géiser (no puede salir del círculo) → Bola ígnea mientras está en el aire.
2. **Emboscada en la jungla:** Ceguera → Velo → Ignición desde el velo → Estampida de espinas: la Ignición devuelve parte de todo eso.
3. **Tomar un santuario:** Pararrayos + Guardián de musgo sobre el santuario, y Muralla de raíces para que no entren por tu lado.
4. **Duelo largo:** Esporas (te pega menos) → Drenaje → Manantial si se alarga.
5. **Huir con todo:** Señuelo hacia un lado → Corriente hacia el otro → Muro de hielo detrás de ti.

## Multijugador fluido

La Sala decide todo, tu mago se predice en tu celular y los demás se ven unos 100 ms atrás. Los 30 hechizos están pensados para eso:

- **Nadie te arrastra por el suelo.** El Géiser te levanta en el lugar, sin moverte de lado. Los únicos desplazamientos son los tuyos (Paso, Destello, Cometa, Liana, Paso sombrío), y esos se predicen en tu celular sin tirones.
- **Lo invisible no se envía.** Si un rival está con Velo, la Sala no manda su posición, igual que hoy con la jungla. El Señuelo viaja como un mago más, así nadie puede hacer trampa para distinguirlo.
- **Pocas cosas en el mundo.** Como máximo una invocación de cada tipo por mago (Fuego fatuo, Pararrayos, Guardián), con un comportamiento simple en el núcleo.
- **Golpes instantáneos con cuidado.** Rayo en cadena, Zarpa y Paso sombrío los resuelve la Sala; si con lag se sienten injustos, se agrega compensación de lag para esos tres.
- **Todo en el núcleo determinista.** Reglas en `packages/core`, números en `packages/content`, y los bots juegan con lo mismo.

Tres Grandes hechizos mueven a otro mago: Intercambio, Pista de hielo y Portal. Son saltos de una vez o un deslizamiento recto que tu celular puede predecir, así que no deberían dar tirones, pero son los primeros que probaría con lag real. Los que cambian la pantalla del rival (Ceguera, Eclipse, Mal de ojo, Ilusión de tejido) se resuelven en la Sala: el celular del afectado no recibe lo que no debe ver.

## Decisiones abiertas

- [ ] **La lista completa.** Marca o comenta en el documento los hechizos que no te convenzan; los cambio sin tocar el resto.
- [ ] **Efectos sobre la pantalla del rival.** Ceguera, Eclipse, Mal de ojo e Ilusión de tejido le cambian lo que ve. Son muy únicos, pero pueden frustrar; es tu llamada.
- [ ] **El peso de los Grandes hechizos.** Propongo que su único costo sea cansar los tres elementos y tardar 0,6 s. La alternativa es sumarles un enfriamiento propio.
- [ ] **Las reacciones de la versión 1.** Quedan fuera; los combos salen de los propios hechizos.

## Plan por tandas

1. **Base:** cada hechizo pasa a ser una definición propia en el núcleo, con sus números en `packages/content`. Los 5 básicos y 10 hechizos de 2 elementos jugables con su visual, para que los pruebes.
2. **Los otros 15 de 2 elementos** y los bots usándolos con criterio.
3. **Grandes hechizos, primera tanda:** los que usan piezas que ya existen para entonces (daño, control, movilidad, terreno).
4. **Segunda tanda:** invocaciones, apoyo, refuerzo y estados.
5. **Tercera tanda:** mapa vivo, información, sigilo y transformaciones.
6. **Cuarta tanda:** tiempo, copia, contrahechizo, detonadores, anti, carga y redirección, que son los que más piezas nuevas necesitan.

Mientras un Gran hechizo no esté hecho, ese tejido lanza el hechizo de sus dos primeros elementos, así el juego siempre funciona. Lo ya descubierto en el Grimorio se conserva porque se guarda por tejido.

No choca con el PR #10 (cámara, luz y HUD). Igual partiría la rama después de que se fusione.
