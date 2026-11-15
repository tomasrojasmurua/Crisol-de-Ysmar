# Cuántas salas aguanta el servidor, y qué pasa si se cae

Medido el 15 de noviembre de 2026 con la prueba de carga (`apps/server/red/carga.test.ts`): se
abren salas de a una con celulares livianos que se mueven y lanzan hechizos, hasta que la máquina
se atrasa. Cada sala corre el núcleo a 30 pasos por segundo, con la IA jugando los puestos vacíos.

## Resultado

Una sala de 4 (2 personas y 2 de la IA) gasta un **3 a 6 % de un núcleo** (más con más personas,
porque a cada una se le arma su propio estado). La memoria no es problema: unos 85 MB de base y
3 MB por sala. Cada celular recibe unos 15 a 23 KB/s.

Lo que limita es la CPU. Las máquinas chicas de Google (e2-micro, e2-small, e2-medium) son
**compartidas**: pueden usar el núcleo entero un rato ("ráfaga"), pero si lo usan todo el tiempo
quedan en una fracción. Una partida usa la CPU todo el tiempo, así que manda la fracción. Se
simuló cada máquina limitando la CPU del servidor a esa fracción:

| Máquina (Santiago)        | CPU que se puede usar siempre | Salas jugando bien | Precio al mes\* |
| ------------------------- | ----------------------------- | ------------------ | --------------- |
| **e2-micro** (la de hoy)  | 1/4 de núcleo                 | **2** (8 personas) | US$9            |
| e2-small                  | 1/2 núcleo                    | 5 a 6              | US$17           |
| e2-medium                 | 1 núcleo (en 2 a medias)      | 6 a 10             | US$35           |
| t2d-standard-1 (dedicada) | 1 núcleo entero, más rápido   | 20 o más           | US$44           |

\*Solo la máquina, en southamerica-west1 ([gcloud-compute.com](https://gcloud-compute.com/southamerica-west1.html));
el disco y la IP fija suman unos US$4. El tráfico es de centavos: unos 70 MB por persona por hora
de juego.

En la e2-micro, a la tercera sala el reloj de las Salas empieza a atrasarse (el ping sube de 0 a
75 ms dentro de la máquina y se pierden cuadros). Con la mitad de un núcleo aguanta 6 salas; con
un núcleo entero, 25 salas de 6 sin atrasarse.

Ojo: la prueba corrió en otra máquina con la CPU limitada; la de verdad puede andar algo mejor
(la ráfaga ayuda al principio). Para medirla de verdad: Actions → "Probar la carga del servidor de
salas" → Run workflow, cuando nadie esté jugando (ver más abajo).

## Qué hace el servidor cuando se llena

Cada máquina sabe cuántas salas le caben (`MAX_SALAS`, lo fija `scripts/sala/instalar.sh` según el
tipo de máquina: 2, 5, 10 o 20). También se da por llena si el reloj de las Salas se atrasa más de
30 ms. Llena, **las salas que juegan siguen ahí sin cortes**, y las nuevas se crean solas en
Cloudflare (con más lag, pero andan). `/health` dice `"full": true`.

## El respaldo en Cloudflare (automático)

- Al abrir el juego, el celular le pregunta a Santiago cómo está (`/health`, espera 2,5 s).
- **Sala nueva:** si Santiago contesta y no está lleno, la sala es de Santiago; si no, de
  Cloudflare.
- **El código dice dónde vive la sala:** los de Santiago empiezan con letra (`K7QF`) y los de
  Cloudflare con número (`7KQF`). Así el amigo que entra con el enlace o el código llega a la misma
  sala, aunque Santiago haya vuelto o se haya llenado entretanto.
- **Partida rápida:** se pide a Santiago; si no contesta o está lleno, a Cloudflare (que no junta
  desconocidos: cada uno juega con la IA hasta que alguien caiga en su sala).
- Si Santiago no contesta, un código con letra también se juega en Cloudflare, y ahí llegan los
  amigos mientras siga caído.
- Las reconexiones vuelven siempre al mismo servidor de la sala.
- Si Santiago se cae **en plena partida**, esa partida se pierde (vive en su memoria). Si vuelve
  en segundos (systemd lo levanta), los celulares ven "La sala se reinició y la partida se perdió";
  si no vuelve, ven que se perdió la conexión. Las salas siguientes ya van a Cloudflare.

`?sala=cloudflare` sigue forzando Cloudflare para ese celular (y sus salas nuevas son de Cloudflare).

## Vigilancia y reinicio automático

En la máquina (`scripts/sala/instalar.sh`):

- **systemd** levanta el servidor a los 2 s si se cae, sin límite de intentos.
- **Vigilante** (`sala-vigilar`, cada minuto): si `/health` no contesta 3 minutos seguidos (el
  servidor quedó colgado), lo reinicia.
- **1 GB de memoria de intercambio**: si un día se llena la memoria, se pone lento en vez de caerse.
- Google reinicia la máquina sola si falla el equipo donde corre.
- La máquina se mantiene al día sola: si cambia `instalar.sh` en main, lo vuelve a correr.

En GitHub (`vigilar-sala.yml`, cada 10 minutos): si Santiago no contesta, abre un aviso (issue)
"El servidor de salas no responde", que llega por correo, y lo cierra solo cuando vuelve.

## Pasos que necesitan tus manos en Google Cloud

Todo se pega en **Cloud Shell** (`>_` arriba a la derecha en
[console.cloud.google.com](https://console.cloud.google.com)).

### 1. Una vez: poner al día la máquina (2 minutos, cuando nadie juegue)

La máquina de hoy no sabe todavía actualizar su instalación sola. Esto lo deja hecho:

```bash
gcloud compute ssh crisol-sala --zone=southamerica-west1-a --command \
  'curl -fsSL https://raw.githubusercontent.com/tomasrojasmurua/Crisol-de-Ysmar/main/scripts/sala/instalar.sh | sudo bash'
```

### 2. Recomendado: alerta de Google por correo (gratis)

Más rápida y confiable que la de GitHub (revisa cada minuto desde varios lugares). Cambia
`TU_CORREO`:

```bash
gcloud services enable monitoring.googleapis.com
HOST=$(gcloud compute addresses describe crisol-sala --region=southamerica-west1 --format='value(address)' | tr . -).sslip.io
gcloud monitoring uptime create crisol-sala --resource-type=uptime-url \
  --resource-labels=host=$HOST --path=/health --protocol=https --period=1 --timeout=10
CANAL=$(gcloud beta monitoring channels create --display-name="Correo" --type=email \
  --channel-labels=email_address=TU_CORREO --format='value(name)')
gcloud alpha monitoring policies create --display-name="Salas de Santiago caídas" \
  --notification-channels=$CANAL --combiner=OR \
  --condition-display-name="No contesta" \
  --condition-filter='metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url"' \
  --if='< 1' --duration=180s --trigger-count=1 \
  --aggregation='{"alignmentPeriod":"60s","perSeriesAligner":"ALIGN_NEXT_OLDER","crossSeriesReducer":"REDUCE_COUNT_TRUE","groupByFields":["resource.label.host"]}'
```

Si algún comando falla, en la consola es: Monitoring → Uptime checks → Create (URL
`https://…sslip.io/health`, cada 1 minuto) y, al final del asistente, "Create alert" con tu correo.

### 3. Si llega más gente: agrandar la máquina (5 minutos sin servicio)

Mientras está apagada, las salas nuevas se van solas a Cloudflare. La IP no cambia (es fija).

```bash
gcloud compute instances stop crisol-sala --zone=southamerica-west1-a
gcloud compute instances set-machine-type crisol-sala --zone=southamerica-west1-a --machine-type=e2-small
gcloud compute instances start crisol-sala --zone=southamerica-west1-a
```

Cambia `e2-small` por `e2-medium` o `t2d-standard-1` según la tabla. Al arrancar, la máquina
calcula sola cuántas salas le caben.

## Medir la máquina de verdad

Actions → **"Probar la carga del servidor de salas"** → Run workflow (por defecto, salas de 4 con 2
personas y 2 de la IA, una cada 12 s, hasta 12). Mientras corre, la máquina se llena y las salas
nuevas de verdad se van a Cloudflare: correrla cuando nadie juegue. Las salas privadas no tienen el
tope `MAX_SALAS`, así que se ve hasta dónde llega la máquina. El resumen muestra, por escalón:
CPU, atraso del reloj (`atrasoP99`, sobre 30 ms es mucho), memoria, ping y cuadros tarde.

A mano, en tu computador, contra un servidor local:

```bash
pnpm --filter @crisol/server sala                     # en una terminal (MAX_SALAS=999 para no topar)
SALA=http://127.0.0.1:8080 pnpm exec vitest run --config apps/server/red/vitest.config.ts carga
```
