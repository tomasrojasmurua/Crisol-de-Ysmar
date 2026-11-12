# Prompt inicial para otra cuenta de Claude

Copia el bloque de abajo y pégalo como primer mensaje en la otra cuenta de Claude, con el
repositorio `tomasrojasmurua/crisol-de-ysmar` conectado (GitHub con acceso de escritura).

```text
Hola. Vengo de otra cuenta de Claude donde seguimos construyendo mi videojuego, y quiero continuar
aquí. El proyecto es Crisol de Ysmar: un duelo de hechiceros para celular (solo en horizontal),
jugado en el navegador desde un enlace de WhatsApp, donde la magia se teje combinando cinco
elementos (Brasa, Tormenta, Marea, Raíz y Umbra). Se juega contra la IA y en red con amigos.
El código está en GitHub: tomasrojasmurua/crisol-de-ysmar, rama main (al día hasta el PR #78).

Antes de hacer nada, lee en este orden:
1. docs/traspaso/README.md (decisiones, estado, qué sigue, pendientes y cómo trabajo)
2. CLAUDE.md y CONTRIBUTING.md (reglas del código)
3. docs/diseno.md y docs/arquitectura.md
4. Lo que necesites de docs/traspaso/referencia/ (combos, glifos y los documentos originales)

Cómo trabajamos:
- Háblame en español, claro y sin jerga innecesaria.
- Todo texto del juego, comentarios y documentación van en español; el código en inglés.
- El juego es 100% original: nada de nombres, criaturas ni arte de otros juegos.
- Antes de proponer un cambio corre pnpm check. Un PR por frente a main; apenas el CI esté en
  verde, fusiónalo tú y cuéntame en pocas líneas qué cambió, con el enlace.
- Para decisiones grandes, dame opciones con tu recomendación y preguntas numeradas.
- Lo claro, hazlo sin preguntar; si decides algo por tu cuenta, dímelo en una línea.
- Si cambia el estado, los eventos o los ajustes de sala, sube PROTOCOL_VERSION.
- Nada puede tapar los botones en el celular; revisa la interfaz a 844×390.
- Tengo ChatGPT, Meshy, Mixamo y ElevenLabs para generar arte y audio si me pasas los prompts.

Dónde quedamos: congelamos contenido nuevo para afinar lo que hay. El siguiente frente es
"Listo para los 5": una prueba en red con unos 5 amigos (yo juego en iPhone; varios tienen Android
de gama media y uno con mala conexión suele crear la sala). Quiero que el feedback sea de mejoras y
no de caídas. El plan está en docs/traspaso/README.md, sección "Lo que sigue".

Cuando termines de leer, confírmame en pocas líneas qué entendiste y propón el orden de las
entregas del frente "Listo para los 5", con preguntas numeradas si necesitas que decida algo.
```
