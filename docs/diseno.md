# Diseño del juego

El documento de diseño original está copiado en
[traspaso/referencia/diseno-original.md](traspaso/referencia/diseno-original.md), y el de cada hechizo
en [traspaso/referencia/rediseno-hechizos.md](traspaso/referencia/rediseno-hechizos.md). Lo que sigue
es lo vigente.

## Decisiones clave

- **Pilares:** la magia se construye, descubrir es progresar, duelos con estrategia.
- **Plataforma:** juego web que se abre desde un enlace de WhatsApp, celular en horizontal.
- **Cámara:** tercera persona sobre el hombro con fijación de objetivo (elegida en el Hito 1 frente a la vista 3/4).
  Gira hacia el rival solo si está a menos de 18 m; si no, conserva su dirección.
- **Mapa:** 40 m de radio. Una plaza de piedra al centro (donde cierra la Convergencia), una
  jungla alrededor con senderos y diez campamentos de bestias, dos por elemento, en espejo para
  que ningún lado tenga ventaja. Los árboles, rocas y ruinas tapan el paso, los conjuros y la vista:
  a un rival en la jungla solo lo ves si alguien de tu equipo lo tiene cerca y a la vista.
- **Campamentos:** dos bestias cada uno; un campamento vacío se vuelve a poblar a los 45 segundos
  (si sigue dentro de la zona). A los 40 segundos de Caza despierta el **Guardián del Crisol** en la plaza:
  vencerlo da una Esencia de cada elemento.
- **Elementos:** Brasa, Tormenta, Marea, Raíz y Umbra, en un pentágono: cada uno combina con sus
  vecinos y choca con los dos de enfrente.
- **Tejido:** de 1 a 3 elementos, el orden importa, 155 conjuros base. Cada tejido es un hechizo
  propio con su efecto y su visual: 5 básicos, 25 de 2 elementos y 125 Grandes hechizos de 3 (estos
  llegan por tandas; ya hay 70: daño, control, movilidad y terreno en la primera; invocaciones,
  apoyo, refuerzo y estados en la segunda; y mapa vivo, información, sigilo y transformaciones en
  la tercera. Mientras tanto, un tejido de 3 sin Gran hechizo lanza el eco del hechizo de sus dos
  primeros).
  El tejido es visible para el rival y ninguno sale en menos de 0,15 s, para que se alcance a ver aunque haya lag. Cada elemento tiene su propia fatiga.
- **Jungla viva:** el Incendio forestal quema árboles y el Brote de árbol los planta; los cambios
  duran hasta el fin de la ronda.
- **Partida:** mejor de 3 rondas de 3 minutos (Caza, Convergencia y Duelo final, un minuto cada una). Modos 1v1,
  2v2, 3v3 y todos contra todos hasta 6. Al morir: modo Espectro o 3 Vidas, según la sala.
- **PvE primero:** hechiceros de la IA con las mismas reglas que un jugador.
- **Bestias neutrales** dan Esencia o se vinculan como familiares. **Glifos** entre rondas y
  **Presagios** por partida.
- **Afinidad:** el elemento elegido se cansa 25% más lento y sus opuestos 15% más rápido; además
  transforma la apariencia del hechicero.
- **Progresión:** variedad, no poder. Grimorio, maestría, desafíos y rivalidades entre amigos.
- **Arte:** fantasía oscura estilizada; la magia es lo único con color intenso.
- **Audio:** cada elemento es una nota y un tejido suena como un acorde.
- **Mundo:** Ysmar, sostenido por la Trama de cinco hilos; los vencedores del Crisol la retejen.
