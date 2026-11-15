#!/bin/bash
# Prepara los efectos y la música de ElevenLabs para el juego (ver docs/audio.md):
#
#   scripts/audio-prepare.sh <carpeta con los .mp3 nombrados por clave>
#
# Recorta silencios, nivela el volumen por tipo de sonido y deja la música en bucle sin costura.
# Escribe en apps/client/public/audio/. Necesita ffmpeg y python3.
set -e
SRC=$(cd "${1:?Falta la carpeta con los .mp3}" && pwd)
OUT=$(cd "$(dirname "$0")/../apps/client/public/audio" && pwd)
TMP=$(mktemp -d)
trap 'rm -r "$TMP"' EXIT

target() {
  case "$1" in
    note.*|untie) echo -24 ;;
    click) echo -27 ;;
    confirm|summonGone) echo -23 ;;
    *) echo -20 ;;
  esac
}

for f in "$SRC"/*.mp3; do
  [ -e "$f" ] || continue
  name=$(basename "$f" .mp3)
  case "$name" in music.* | voice.*) continue ;; esac
  # Fuera el silencio del principio (latencia) y del final.
  ffmpeg -loglevel error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse" "$TMP/$name.wav"
  mean=$(ffmpeg -i "$TMP/$name.wav" -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]*' | cut -d' ' -f2)
  t=$(target "$name")
  gain=$(python3 -c "print(round($t - ($mean), 1))")
  # Fundido corto al final para que no corte en seco; limitador para que nada sature.
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$name.wav")
  fade=$(python3 -c "d=$dur; print(round(max(0, d-0.06),3))")
  ffmpeg -loglevel error -y -i "$TMP/$name.wav" -af "volume=${gain}dB,alimiter=limit=0.89:level=false,afade=t=out:st=$fade:d=0.06,apad=pad_dur=0.02" -ar 44100 -ac 1 -b:a 96k "$OUT/$name.mp3"
  printf "%-20s mean %6s -> %s (gain %s dB) %.2fs\n" "$name" "$mean" "$t" "$gain" "$dur"
done

for f in "$SRC"/music.*.mp3; do
  [ -e "$f" ] || continue
  name=$(basename "$f" .mp3)
  # Bucle sin costura: el final se funde con los primeros 2 s, que se quitan del principio.
  ffmpeg -loglevel error -y -i "$f" -i "$f" -filter_complex "[1:a]atrim=0:2,asetpts=PTS-STARTPTS[head];[0:a]atrim=2,asetpts=PTS-STARTPTS[body];[body][head]acrossfade=d=2:c1=tri:c2=tri,loudnorm=I=-18:TP=-1.5:LRA=11" -ar 44100 -ac 2 -b:a 112k "$OUT/$name.mp3"
  echo "$name $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp3")s"
done
