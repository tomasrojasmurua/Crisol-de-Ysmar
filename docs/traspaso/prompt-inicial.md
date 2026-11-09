# Prompt inicial para la cuenta nueva

Copia el bloque de abajo y pégalo como primer mensaje en la cuenta nueva de Claude, una vez que
tenga el repositorio `tomasrojasmurua/crisol-de-ysmar` conectado.

```text
Hola. Vengo de otra cuenta de Claude donde construimos juntos un videojuego, y quiero seguir aquí.
El proyecto es Crisol de Ysmar: un duelo de hechiceros para celular, jugado en el navegador desde
un enlace de WhatsApp, donde la magia se teje combinando cinco elementos (Brasa, Tormenta, Marea,
Raíz y Umbra). El código está en GitHub: tomasrojasmurua/crisol-de-ysmar, rama main.

Antes de hacer nada, lee en este orden:
1. docs/traspaso/README.md (visión, decisiones, estado, qué sigue y cómo trabajo)
2. CLAUDE.md y CONTRIBUTING.md (reglas del código)
3. docs/diseno.md y docs/arquitectura.md
4. Lo que necesites de docs/traspaso/referencia/ (copias de los documentos de diseño originales)

Cómo trabajamos:
- Háblame en español. Todo texto del juego, comentarios y documentación van en español; el código en inglés.
- El juego es 100% original: nada de nombres, criaturas ni arte de otros juegos.
- Antes de proponer un cambio corre pnpm check. Todo entra por PR a main.
- Cuando un PR esté listo, mándame el enlace y un resumen corto. Yo respondo "merge" y tú lo fusionas.
- Para decisiones grandes, dame opciones con tu recomendación y preguntas numeradas.
- Lo más importante para mí es la fluidez del multijugador. Tengo ChatGPT, Meshy, Mixamo y ElevenLabs
  para generar arte y audio si me pasas los prompts.

Dónde quedamos: main está al día hasta el PR #17. Hay 70 de 125 Grandes hechizos y el multijugador
todavía no existe. Yo ya aprobé el plan de debilidades: el siguiente cambio es dejar el 1v1 en la
plaza sin jungla y pausar familiares, Guardián y el modo 3 Vidas. Después queda la tanda 4 de Grandes
hechizos (docs/traspaso/tanda-4.md) y luego el Hito 2 (multijugador).

Cuando termines de leer, confírmame en pocas líneas qué entendiste del estado actual y propón por
dónde partir.
```
