#!/usr/bin/env python3
"""Genera los íconos de la app desde docs/arte/icono/icono-original.webp (ver docs/arte/icono/README.md).

    python3 scripts/icono.py

Necesita Pillow. Escribe en apps/client/public/.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/arte/icono/icono-original.webp"
OUT = ROOT / "apps/client/public"

# Radio del borde exterior del marco dorado del arte, en fracción del lado (medido en el original).
FRAME_RADIUS = 300 / 1254
# Los íconos de Android (maskable) van sin el marco: el sistema recorta un círculo y el marco se
# vería cortado. Se recorta por dentro del marco.
MASKABLE_INSET = 40 / 1254


def fill_corners(img: Image.Image) -> Image.Image:
    """Tapa el negro de las esquinas (fuera del marco) estirando el dorado del marco hacia afuera.

    iOS recorta con su propio redondeo, que no calza exacto con el del arte: sin esto quedaría una
    cuña negra en cada esquina.
    """
    out = img.copy()
    src, dst = img.load(), out.load()
    n = img.size[0]
    r = round(n * FRAME_RADIUS)
    edge = round(n * 10 / 1254)
    for ox, oy, sx, sy in [(0, 0, 1, 1), (n - 1, 0, -1, 1), (0, n - 1, 1, -1), (n - 1, n - 1, -1, -1)]:
        cx, cy = ox + sx * r, oy + sy * r
        for j in range(r):
            for i in range(r):
                x, y = ox + sx * i, oy + sy * j
                d = math.hypot(x - cx, y - cy)
                if d > r - edge * 1.4:
                    k = (r - edge * 1.6) / d
                    dst[x, y] = src[int(cx + (x - cx) * k), int(cy + (y - cy) * k)]
    for t in range(edge - 2):
        for x in range(r, n - r):
            dst[x, t] = src[x, edge]
            dst[x, n - 1 - t] = src[x, n - 1 - edge]
            dst[t, x] = src[edge, x]
            dst[n - 1 - t, x] = src[n - 1 - edge, x]
    return out


def rounded(img: Image.Image, size: int) -> Image.Image:
    """Esquinas transparentes como las de iOS, para la pestaña del navegador."""
    small = img.resize((size, size), Image.LANCZOS).convert("RGBA")
    big = size * 8
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), round(big * 0.2237), fill=255)
    small.putalpha(mask.resize((size, size), Image.LANCZOS))
    return small


def main() -> None:
    art = Image.open(SOURCE).convert("RGB")
    n = art.size[0]
    full = fill_corners(art)
    inset = round(n * MASKABLE_INSET)
    maskable = art.crop((inset, inset, n - inset, n - inset))

    for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        full.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    maskable.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png", optimize=True)
    for size in (32, 48):
        rounded(full, size).save(OUT / f"favicon-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
