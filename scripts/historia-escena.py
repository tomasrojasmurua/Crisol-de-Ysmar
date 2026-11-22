#!/usr/bin/env python3
"""Prepara una ilustración de la Historia para el juego.

Recorta al centro a 3:2, la deja en 1280×853, le pone el mismo grano y la misma viñeta que a
las demás y la guarda como webp de menos de 150 KB en `apps/client/public/historia/escenas`.

Uso: python3 scripts/historia-escena.py <original.png> <nombre>   (ej.: 21-plaza-duelo)
"""

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "apps/client/public/historia/escenas"
SIZE = (1280, 853)
MAX_BYTES = 150_000
# Fijo, para que el grano sea el mismo cada vez que se rehace una imagen.
SEED = 7


def crop_3x2(img: Image.Image) -> Image.Image:
    w, h = img.size
    target = 3 / 2
    if w / h > target:
        nw = round(h * target)
        left = (w - nw) // 2
        return img.crop((left, 0, left + nw, h))
    nh = round(w / target)
    top = (h - nh) // 2
    return img.crop((0, top, w, top + nh))


def finish(img: Image.Image) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32) / 255.0
    h, w, _ = arr.shape
    # Viñeta suave: los bordes bajan hasta un 28 %, y el tercio inferior un poco más oscuro.
    y, x = np.mgrid[0:h, 0:w]
    dx = (x - w / 2) / (w / 2)
    dy = (y - h / 2) / (h / 2)
    dist = np.sqrt(dx**2 * 0.8 + dy**2)
    vignette = 1 - 0.28 * np.clip((dist - 0.45) / 0.85, 0, 1) ** 1.6
    bottom = 1 - 0.12 * np.clip((y / h - 0.66) / 0.34, 0, 1)
    arr *= (vignette * bottom)[..., None]
    # Grano de lienzo, monocromo y fino.
    rng = np.random.default_rng(SEED)
    grain = rng.normal(0, 0.018, (h, w))[..., None]
    arr = np.clip(arr + grain, 0, 1)
    return Image.fromarray((arr * 255).astype(np.uint8))


def save_webp(img: Image.Image, path: Path) -> int:
    for quality in range(82, 40, -4):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=quality, method=6)
        if buf.tell() <= MAX_BYTES:
            path.write_bytes(buf.getvalue())
            return buf.tell()
    raise SystemExit(f"{path.name}: no baja de 150 KB")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, name = Path(sys.argv[1]), sys.argv[2]
    img = crop_3x2(Image.open(src).convert("RGB")).resize(SIZE, Image.LANCZOS)
    size = save_webp(finish(img), OUT_DIR / f"{name}.webp")
    print(f"{name}.webp  {size // 1000} KB")


if __name__ == "__main__":
    main()
