#!/bin/bash
# Instala el servidor de salas de Santiago en una máquina nueva (Debian o Ubuntu).
# Se pega entero como "secuencia de comandos de inicio" al crear la VM en Google Cloud (ver
# docs/servidor-santiago.md). Se puede correr de nuevo sin problema: deja todo igual.
#
# Qué hace:
#   1. Instala Node 22 y Caddy (Caddy saca el certificado HTTPS solo).
#   2. Baja el servidor (sala.mjs) que publica GitHub y lo deja corriendo como servicio.
#   3. Cada 2 minutos revisa si hay una versión nueva; la instala solo cuando no hay nadie
#      conectado (o tras 30 minutos esperando), para no cortar una partida.
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

cat >"$DIR/actualizar.sh" <<'UPDATE'
#!/bin/bash
# Baja la versión nueva del servidor si la hay y reinicia cuando no hay nadie jugando.
set -euo pipefail
REPO="tomasrojasmurua/Crisol-de-Ysmar"
DIR=/opt/sala
cd "$DIR"
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
chmod +x "$DIR/actualizar.sh"

cat >/etc/systemd/system/sala.service <<UNIT
[Unit]
Description=Salas del Crisol de Ysmar
After=network-online.target

[Service]
User=sala
WorkingDirectory=$DIR
Environment=PORT=8080
ExecStart=/usr/bin/node $DIR/sala.mjs
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

systemctl daemon-reload
"$DIR/actualizar.sh" || true
systemctl enable --now sala sala-actualizar.timer
echo "Listo: https://$HOST/health"
