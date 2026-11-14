# Servidor de salas de Santiago

## Por qué existe

Las Salas de Cloudflare (Durable Objects) no se crean en Sudamérica: aunque el código pide
`locationHint: 'sam'`, Cloudflare las manda al este de Norteamérica
([documentación](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
Desde Chile eso son 150 a 250 ms de ida y vuelta, y fue el lag que se sintió en la primera prueba
con amigos (14 de noviembre de 2026).

El servidor de Santiago corre **las mismas Salas** (`apps/server/src/roomHost.ts`) en Node, en una
máquina de Google Cloud en Santiago (`southamerica-west1`). El juego web, la página y el registro
de errores (D1) siguen en Cloudflare.

## Piezas

| Pieza                              | Qué hace                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `apps/server/src/roomHost.ts`      | La Sala, sin saber dónde corre. La usan Cloudflare (`room.ts`) y Santiago. |
| `apps/server/node/main.ts`         | El servidor Node: `/health`, `/api/rooms` y el socket de cada sala.        |
| `scripts/sala/instalar.sh`         | Deja una máquina nueva lista: Node 22, Caddy (HTTPS) y el servicio `sala`. |
| CI (`ci.yml`, solo `main`)         | Arma `sala.mjs` y lo sube a la versión `sala` de GitHub (Releases).        |
| `apps/client/src/net/serverUrl.ts` | `SANTIAGO_URL`: si tiene dirección, las salas van ahí.                     |

La máquina revisa cada 2 minutos si hay un `sala.mjs` nuevo y lo instala **solo cuando no hay nadie
conectado** (o tras 30 minutos esperando). Así publicar un cambio no corta una partida. Si sube
`PROTOCOL_VERSION`, quien abra el juego en esos minutos verá "recarga la página" hasta que la
máquina se actualice.

## Crear la máquina (una vez)

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) con una cuenta de Google,
   crear un proyecto (por ejemplo `crisol`) y activar la facturación (las cuentas nuevas traen
   US$300 de crédito por 90 días).
2. Abrir **Cloud Shell** (el ícono `>_` arriba a la derecha) y pegar:

   ```bash
   gcloud services enable compute.googleapis.com
   gcloud compute addresses create crisol-sala --region=southamerica-west1
   gcloud compute firewall-rules create crisol-web --allow=tcp:80,tcp:443 --target-tags=crisol-sala || true
   gcloud compute instances create crisol-sala \
     --zone=southamerica-west1-a --machine-type=e2-micro \
     --image-family=debian-12 --image-project=debian-cloud \
     --address=crisol-sala --tags=crisol-sala \
     --metadata=startup-script='curl -fsSL https://raw.githubusercontent.com/tomasrojasmurua/Crisol-de-Ysmar/main/scripts/sala/instalar.sh | bash'
   gcloud compute addresses describe crisol-sala --region=southamerica-west1 --format='value(address)'
   ```

3. La última línea muestra la IP (por ejemplo `34.176.10.20`). A los 3 o 4 minutos,
   `https://34-176-10-20.sslip.io/health` debe responder `{"ok":true,…}`.
4. Poner esa dirección en `SANTIAGO_URL` (hoy: `https://34-176-182-249.sslip.io`) (`apps/client/src/net/serverUrl.ts`) y publicar.

Costo aproximado: unos US$12 al mes (máquina e2-micro, disco e IP fija); el tráfico de una prueba
con 6 amigos son centavos.

## Si algo falla

- **El juego no conecta:** abrir el juego con `?sala=cloudflare` al final de la dirección usa las
  Salas de Cloudflare (con más lag, pero andan). Para todos: dejar `SANTIAGO_URL` vacío y publicar.
- **Ver qué pasa en la máquina:** en Cloud Shell,
  `gcloud compute ssh crisol-sala --zone=southamerica-west1-a` y luego
  `sudo journalctl -u sala -n 50` (servidor) o `sudo journalctl -u sala-actualizar -n 20`.
- **Probarla con celulares simulados:**
  `SALA=https://34-176-10-20.sslip.io pnpm exec vitest run --config apps/server/red/vitest.config.ts`.
- Los errores de las Salas de Santiago llegan al mismo registro (D1) con el celular
  "servidor Santiago". El resumen de cada partida dice qué servidor de salas usó.
