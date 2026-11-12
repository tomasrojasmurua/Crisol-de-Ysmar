# Combos en el Grimorio — Crisol de Ysmar

Copia del documento del Project de Claude (decisiones del 11 y 12 de noviembre de 2026), al día
con el tutorial nuevo (PR #78). Catálogo en `packages/content/src/combos.ts` (fuente de verdad del
texto que ve el jugador).

**Total: 84 = 6 reacciones + 78 seguidillas. Todos cuentan** (confirmados en la simulación).

## Historial

- PR #60: catálogo, `ComboLog` (aciertos y Mis combos en el celular), sección Combos del Grimorio. Reacciones renombradas a `REACTION_TEXT`.
- PR #61: `ComboDetector` reconoce las seguidillas en partida; nombre en oro sobre el blanco; el acierto suma solo en partidas.
- PR #62: Caer dormido pasa a combo de pareja; entra Sueño tras el muro.
- PR #63: primer tutorial en Entrenamiento; entrega Brasa maldita, Quiebre y Amarre.
- PR #64: resueltos los dudosos: Apagón (dormirlo estando aturdido), Orbe y cadena (ahora Grillete → Orbe), Imán y espejo → Escudo y hoguera, Jaula prestada → Jaula y respiro, y exigencias reales en Venganza y regreso, Sacrificio y transfusión, Escudo compartido y Aliado bomba.
- PR #65 (frente «Apuntar»): mantener ✦ ≥ 0,26 s y arrastrar elige dónde cae un hechizo de suelo (34 hechizos, `PLACED_SPELLS`); toque o arrastre rápido siguen como antes. Con esto cuentan Cambio de cielo y Plato servido.
- PR #66: tercera tanda (8 combos de aguantar, devolver y escapar).
- PR #67: esos combos piden una condición real: dos rivales distintos atacándote, o un rival encerrado en tu Anillo de zarzas. Nuevo aviso `attacked` en el núcleo.
- PR #78: el tutorial pasa a 12 capítulos; los 3 combos se entregan al terminar el capítulo «Combos» (Brasa maldita y Quiebre se enseñan en «Estados y reacciones», Amarre en «Combos»).

## Decisiones

- Sección aparte en el Grimorio. Guía, no recompensa: sin efecto extra; el premio es descubrirlo.
- Las reacciones son combos (misma sección).
- Ritmo puesto por las mecánicas existentes; sin temporizador de combo.
- Desbloqueo: 3 aciertos en partidas (5 los marcados ×5). Antes de eso no aparece nada del combo; la sección dice cuántos faltan. Entrenamiento muestra el nombre pero no suma.
- Combos de equipo: el acierto cuenta para cada jugador que puso un paso.
- Mis combos: nombre, hasta 4 hechizos conocidos y una nota.
- Tutorial: entrega los 3 primeros; en el tutorial los elementos descansan de verdad.
- Si un combo no cuadra en la simulación, se ajusta o se reemplaza; no se cambia el balance.
- **Los combos útiles contra varios rivales van mezclados con los demás, sin etiqueta ni texto que lo sugiera** (Tomás, 2026-11-12): descubrir cómo usar los hechizos contra varios es mérito del jugador. Sí llevan condición de detección: dos rivales distintos te atacaron (aunque sin hacerte daño), o tienes a un rival encerrado en tus zarzas.
- El choque de tejidos **no** es una reacción ni un combo: es una mecánica que enseña el tutorial.
- Apuntar: no debe entorpecer el combate rápido (toque = como siempre).

## Cómo se ve en el Grimorio

- Íconos de los elementos de cada hechizo con flecha entre pasos.
- Reacciones con el mismo formato: hechizo de ejemplo → círculo punteado con el ícono del elemento ("cualquier hechizo de ese elemento") y la regla corta debajo.
- Descansos no se marcan. Círculo punteado vacío = cualquier hechizo. Pasos del aliado con marca de dos figuras. El hechizo robado también se muestra con íconos.

## Cómo se detecta

- En el celular, con los eventos que ya emite la simulación (`cast`, `release`, `hit`, `combo`, `attacked`) y el estado de los magos.
- Pasos en orden, sin otro hechizo tuyo entre medio, ≤ 8 s entre pasos; `release` sin `cast` antes no es paso (repeticiones del Eco).
- Remate (`COMBO_DETECT`): golpe (con estado mirado justo antes), reacción, lanzamiento, o un estado sin daño (`status`). Golpes < 1 no rematan salvo `trickle`. Plazo 4,5 s salvo `window`.
- Condiciones propias (`ComboCheck`): `shackledOrb`, `sleepWhileStunned`, `priorBigHit`, `selfGain`, `sharedShield`, `seedOnAlly`, `ringActive` (anillo en pie con un rival adentro), `selfShield`, `twoAttackers` (dos rivales distintos te atacaron desde 3 s antes del primer paso).
- `attacked`: el núcleo lo emite cuando un ataque rival alcanza a un mago sin hacerle daño (escudo, Ataúd, Mil pasos, Espejo, Pararrayos).
- Pruebas: `ComboDetector.test.ts` (cada combo sale en una escena; los que piden algo del rival, de un aliado o de apuntar tienen escena propia), `Tutorial.test.ts`, `placed.test.ts`.

## Reglas del juego que dan forma al catálogo

1. Cada elemento usado descansa 3 s.
2. La reacción la decide el primer elemento del tejido.
3. Las zonas no reaccionan.
4. Una reacción por golpe.
5. El Muñeco vudú es del equipo rival.
6. La Granada solar estalla con cualquier hechizo tuyo; el Polen con cualquier Brasa.
7. Un golpe despierta al dormido; la Pesadilla no hace daño.
8. Con Pararrayos y Espejo a la vez, gana el Pararrayos (el proyectil se vuelve escudo). Con Llanto y Pararrayos, el Llanto retiene lo que el Pararrayos atrae.
9. El Cortocircuito prefiere al objetivo seleccionado si está tejiendo.
10. Con el Injerto el daño se reparte y pasa por los escudos de cada uno.

## Catálogo (resumen)

Reacciones: Brasa maldita, Quiebre (tutorial), Leña, Vapor, Lodazal, Conducción.

Seguidillas: Amarre (tutorial) · Raíz y hoguera · Cometa helado · Vapor y quiebre · Sueño y lanza · Sueño tras el muro · Por los aires · Caída en raíces · Puñalada ígnea · Olla cerrada · Tierra firme · Reloj de arena · Luz en la pesadilla · Sueño guiado · Apagón · Abrazo del río · Enjambre y ahogo · Río de sangre · Vuelo de regreso · Silencio entre espinas · Grito y lanza · Cadena rota · Lluvia a ciegas · Pista falsa · Ojo que todo lo ve · Invierno eterno · Forja paciente · Emboscada · Corrosión eléctrica · Siesta explosiva · Detonador a ciegas · Cambio de olla · Jaula y respiro · Abrazo ardiente · Bomba viviente · Llegar acorazado · Atado al volcán · Atado a la tormenta · Orbe y cadena · Quieto o quemado · Olla con cerco · Olla contra el muro · Tobogán · Campo eléctrico · Sol helado · Detonador · Caer con el meteoro · Cambio de cielo · Doble cielo · Muñeco y meteoro · Tras la muralla · Hurto devuelto · Tu propia arma · Escudo y hoguera · Tormenta de vuelta · Hambre y verdugo · Venganza y regreso · Corona de fuego · Tormenta en la niebla · Puerta propia · Gemelo abonado · Guardián abonado · Plato servido · Caer dormido (pareja) · Ácido compartido · Polen ajeno · Aliado bomba · Separar a los enlazados · Sacrificio y transfusión · Escudo compartido · Coraza y mil pasos · Hielo y fuga · Espejo y salto · Olvido y fuga · Trueno y lluvia · Cosecha en el anillo · Aguante · Doble y respiro.

## Pendientes

- Probar en celular real el tutorial nuevo y el gesto de mantener y arrastrar ✦.
- Mejorar la guía visual de los hechizos de dirección (frente «Apuntar»).
