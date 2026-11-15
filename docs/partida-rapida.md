# Partida rápida

Para que un desconocido pueda entrar y jugar al tiro, sin amigos ni código de sala. El botón
**Partida rápida** del menú lleva a una sala pública del servidor de Santiago.

## Reglas

- Siempre **todos contra todos de 4** con IA **Duelista** (`QUICK_ROOM_SETTINGS` en
  `packages/protocol/src/settings.ts`). Nadie cambia los ajustes y la sala no crece. Funciona igual
  con 1, 2, 3 o 4 personas.
- La partida **empieza sola 10 s después de que entra el primero** (`QUICK_START_TICKS` en
  `apps/server/src/duel.ts`), o apenas llegan 4. La IA ocupa los puestos libres. Quien llegó
  primero puede tocar "Empezar ya".
- Si alguien llega mientras va la **primera ronda**, toma el mago de un bot (igual que un amigo que
  llega tarde).
- En la sala de espera, quien se va suelta su lugar de inmediato (en las salas de amigos lo
  conserva un minuto). Si se van todos, la cuenta parte de cero con el próximo que llegue.
- La partida se juega igual que cualquier otra en red: mejor de 3, Glifos, Presagio y revancha.

## Cómo se elige la sala

`POST /api/quick` en el servidor de Santiago responde `{ roomCode }`:

1. una Partida rápida que esté esperando gente con puestos libres;
2. si no hay, una que vaya en su primera ronda con un mago de la IA que tomar;
3. si tampoco hay, una sala nueva, marcada pública antes de que llegue nadie (así dos que piden a
   la vez caen juntos). Si nadie llega a conectarse, se borra como cualquier sala vacía.

El celular entra a esa sala con `quick: true` en el `hello`. Una sala vacía que recibe ese
`hello` también queda pública. Así funciona el respaldo de Cloudflare (`?sala=cloudflare`), que
no tiene un lugar común donde ver qué salas esperan gente y por eso crea siempre una sala nueva:
juegas con la IA. Una sala de amigos con gente adentro nunca se vuelve pública.

La lista de jugadores (`players`) lleva `quick` y `startsIn` (ms que faltan). La sala de espera
muestra "Empieza en 7 s" sin código de sala, sin invitar y sin ajustes.

Si el servidor no responde en 6 s, se juega lo mismo (todos contra todos de 4) contra la IA en el
celular, con el aviso "No pudimos conectar con el servidor".

## Pendiente

- Si dos llegan a la vez al último bot de una partida en curso, el segundo ve "no quedan lugares"
  y tiene que volver a tocar Partida rápida. Con poca gente no debería pasar.
