#!/bin/bash
# Instala el servidor de salas de Santiago en una máquina nueva (Debian o Ubuntu).
# Se pega entero como "secuencia de comandos de inicio" al crear la VM en Google Cloud (ver
# docs/servidor-santiago.md). Se puede correr de nuevo sin problema: deja todo igual.
#
# Qué hace:
#   1. Instala Node 22 y Caddy (Caddy saca el certificado HTTPS solo).
#   2. Baja el servidor (sala.mjs) que publica GitHub y lo deja corriendo como servicio.
#   3. Cada 2 minutos revisa si hay una versión nueva; la instala solo cuando no hay nadie
#      conectado (o tras 30 minutos esperando), para no cortar una partida. Si cambió este mismo
#      archivo en main, lo vuelve a correr (así la máquina se mantiene al día sin entrar a ella).
#   4. Cada minuto vigila que el servidor conteste; si no contesta 3 veces seguidas, lo reinicia.
#   5. Deja 1 GB de memoria de intercambio (la e2-micro trae solo 1 GB).
set -euo pipefail

REPO="tomasrojasmurua/Crisol-de-Ysmar"
DIR=/opt/sala

if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# Memoria de intercambio: si un día se llena la memoria, se pone lento en vez de caerse.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile &&
    echo '/swapfile none swap sw 0 0' >>/etc/fstab || true
fi

id sala >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin sala
mkdir -p "$DIR"

# La dirección pública: IP con guiones en sslip.io (34-176-10-20.sslip.io), sin comprar dominio.
IP=$(curl -fs -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip ||
  curl -fs https://api.ipify.org)
HOST="${IP//./-}.sslip.io"
echo "$HOST" >"$DIR/direccion.txt"

cat >/etc/caddy/Caddyfile <<CADDY
$HOST {
  reverse_proxy 127.0.0.1:8080
}
CADDY
systemctl reload caddy || systemctl restart caddy

# Se escribe aparte y se mueve: este script puede estar corriendo actualizar.sh en este momento.
cat >"$DIR/actualizar.nuevo" <<'UPDATE'
#!/bin/bash
# Baja la versión nueva del servidor si la hay y reinicia cuando no hay nadie jugando.
set -euo pipefail
REPO="tomasrojasmurua/Crisol-de-Ysmar"
DIR=/opt/sala
cd "$DIR"
# Si cambió la instalación en main (vigilancia, servicio…), se vuelve a correr. Queda anotada
# antes, para no repetirla si falla a medias.
if curl -fsL -o instalar.nuevo "https://raw.githubusercontent.com/$REPO/main/scripts/sala/instalar.sh"; then
  SUM=$(sha256sum instalar.nuevo | cut -d' ' -f1)
  if [ "$SUM" != "$(cat instalar.sha 2>/dev/null || true)" ]; then
    echo "$SUM" >instalar.sha
    bash instalar.nuevo || true
  fi
fi
# Cuándo se publicó el sala.mjs de la versión "sala" (una consulta chica a GitHub).
STAMP=$(curl -fs "https://api.github.com/repos/$REPO/releases/tags/sala" |
  grep -o '"updated_at": *"[^"]*"' | tail -1 || true)
[ -n "$STAMP" ] || exit 0
if [ "$STAMP" != "$(cat version.txt 2>/dev/null || true)" ]; then
  curl -fsL -o nuevo.mjs "https://github.com/$REPO/releases/download/sala/sala.mjs"
  echo "$STAMP" >pendiente.txt
fi
[ -f nuevo.mjs ] || exit 0
PLAYERS=$(curl -fs http://127.0.0.1:8080/health | grep -o '"players":[0-9]*' | cut -d: -f2 || echo 0)
WAITED=$(($(date +%s) - $(stat -c %Y nuevo.mjs)))
if [ ! -f sala.mjs ] || [ "${PLAYERS:-0}" = 0 ] || [ "$WAITED" -gt 1800 ]; then
  mv nuevo.mjs sala.mjs
  mv pendiente.txt version.txt
  chown sala:sala sala.mjs
  systemctl restart sala
fi
UPDATE
chmod +x "$DIR/actualizar.nuevo"
mv "$DIR/actualizar.nuevo" "$DIR/actualizar.sh"

cat >"$DIR/vigilar.nuevo" <<'WATCH'
#!/bin/bash
# Si el servidor no contesta 3 minutos seguidos (colgado, no caído: de eso se encarga systemd),
# se reinicia. Las partidas en curso se pierden, pero los celulares vuelven a entrar solos.
DIR=/opt/sala
if curl -fs -m 5 http://127.0.0.1:8080/health >/dev/null; then
  echo 0 >"$DIR/fallas.txt"
  exit 0
fi
FAILS=$(($(cat "$DIR/fallas.txt" 2>/dev/null || echo 0) + 1))
echo "$FAILS" >"$DIR/fallas.txt"
if [ "$FAILS" -ge 3 ]; then
  echo "El servidor no contesta hace $FAILS minutos: se reinicia"
  echo 0 >"$DIR/fallas.txt"
  systemctl restart sala
fi
WATCH
chmod +x "$DIR/vigilar.nuevo"
mv "$DIR/vigilar.nuevo" "$DIR/vigilar.sh"

# Cuántas salas caben según la máquina (medido en docs/carga.md). Se cambia de máquina y, al
# reiniciar, esto se vuelve a calcular solo.
TYPE=$(curl -fs -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/machine-type | sed 's#.*/##' || true)
case "$TYPE" in
  e2-micro | "") MAX_SALAS=2 ;;
  e2-small) MAX_SALAS=5 ;;
  e2-medium) MAX_SALAS=10 ;;
  *) MAX_SALAS=20 ;;
esac

cat >/etc/systemd/system/sala.service <<UNIT
[Unit]
Description=Salas del Crisol de Ysmar
After=network-online.target
# Nunca deja de intentar levantarlo, aunque se caiga muchas veces seguidas.
StartLimitIntervalSec=0

[Service]
User=sala
WorkingDirectory=$DIR
Environment=PORT=8080
# Cuántas salas jugando a la vez antes de mandar las nuevas a Cloudflare (docs/carga.md).
Environment=MAX_SALAS=$MAX_SALAS
ExecStart=/usr/bin/node --max-old-space-size=512 $DIR/sala.mjs
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/sala-actualizar.service <<UNIT
[Unit]
Description=Busca una versión nueva de las salas

[Service]
Type=oneshot
ExecStart=$DIR/actualizar.sh
UNIT

cat >/etc/systemd/system/sala-actualizar.timer <<UNIT
[Unit]
Description=Busca una versión nueva de las salas cada 2 minutos

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
UNIT

cat >/etc/systemd/system/sala-vigilar.service <<UNIT
[Unit]
Description=Revisa que las salas contesten

[Service]
Type=oneshot
ExecStart=$DIR/vigilar.sh
UNIT

cat >/etc/systemd/system/sala-vigilar.timer <<UNIT
[Unit]
Description=Revisa que las salas contesten cada minuto

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
# La primera vez baja el servidor; si ya corría, actualizar.sh lo deja como está.
[ -f "$DIR/sala.mjs" ] || "$DIR/actualizar.sh" || true
systemctl enable --now sala sala-actualizar.timer sala-vigilar.timer
echo "Listo: https://$HOST/health"
