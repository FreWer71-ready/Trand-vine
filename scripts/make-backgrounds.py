#!/usr/bin/env python3
"""Skapar appens fotolika bakgrunder (oskarpa ljus, toningar, filmkorn).

Kör: python3 scripts/make-backgrounds.py   (kräver numpy och Pillow)
Bilderna är mörka med flit: skärmen är alltid på och text ska gå att läsa ovanpå.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 720, 1280
OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "mobile", "assets", "backgrounds")


def gradient(stops):
    """Lodrät toning. stops = [(läge 0–1, (r, g, b)), …]."""
    y = np.linspace(0, 1, H)
    pos = [s[0] for s in stops]
    rgb = [np.interp(y, pos, [s[1][i] for s in stops]) for i in range(3)]
    return np.repeat(np.stack(rgb, axis=1)[:, None, :], W, axis=1)


def glow(img, cx, cy, radius, color, strength):
    """Mjukt ljussken (additivt)."""
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - cx * W) ** 2 + (yy - cy * H) ** 2) / (radius * W)
    return img + np.exp(-d * d * 2.2)[..., None] * np.array(color) * strength


def bokeh(img, rng, n, colors, rmin, rmax, band=(0.0, 1.0), strength=0.5, blur=3):
    """Oskarpa ljuspunkter, som lampor bakom fokus i ett foto."""
    layer = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(n):
        r = rng.uniform(rmin, rmax) * W
        x, y = rng.uniform(-0.1, 1.1) * W, rng.uniform(*band) * H
        c = colors[rng.integers(len(colors))]
        a = int(255 * rng.uniform(0.25, 1.0) * strength)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*c, a), outline=(*c, min(255, a + 40)), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return img + np.asarray(layer, dtype=np.float64)


def hills(img, rng, rows):
    """Mörka, mjuka åsar – vingårdens kullar i motljus."""
    x = np.linspace(0, 1, W)
    yy = np.arange(H)[:, None]
    for base, amp, color, soft in rows:
        line = base + amp * (np.sin(x * rng.uniform(3, 6) + rng.uniform(0, 6)) * 0.6 + np.sin(x * rng.uniform(8, 14) + rng.uniform(0, 6)) * 0.25)
        mask = np.clip((yy - line[None, :] * H) / soft, 0, 1)[..., None]
        img = img * (1 - mask) + np.array(color) * mask
    return img


def finish(img, rng, name, vignette=0.55, grain=5.0):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    img = img * (1 - vignette * np.clip(d - 0.35, 0, 1) ** 1.6)[..., None]
    img = img + rng.normal(0, grain, (H, W, 1))  # filmkorn, döljer också ränder i toningen
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out.save(os.path.join(OUT, f"{name}.jpg"), quality=72, optimize=True, progressive=True)


def cellar(rng):
    """Källarvalv i levande ljus."""
    img = gradient([(0, (10, 7, 5)), (0.55, (26, 16, 10)), (1, (8, 6, 5))])
    img = glow(img, 0.72, 0.42, 0.75, (255, 150, 60), 0.30)
    img = glow(img, 0.15, 0.80, 0.50, (190, 90, 40), 0.14)
    warm = [(255, 190, 110), (255, 150, 70), (230, 120, 60), (255, 215, 150)]
    img = bokeh(img, rng, 26, warm, 0.05, 0.13, (0.15, 0.75), 0.16, 5)
    img = bokeh(img, rng, 40, warm, 0.012, 0.035, (0.25, 0.65), 0.45, 2)
    finish(img, rng, "cellar")


def vineyard(rng):
    """Vingård i skymning."""
    img = gradient([(0, (9, 13, 30)), (0.30, (45, 34, 62)), (0.47, (150, 72, 52)), (0.56, (232, 140, 66)), (0.62, (60, 34, 30)), (1, (8, 8, 8))])
    img = glow(img, 0.36, 0.555, 0.42, (255, 190, 110), 0.55)
    img = glow(img, 0.36, 0.555, 0.09, (255, 235, 190), 0.8)
    img = hills(img, rng, [(0.57, 0.012, (58, 34, 40), 26), (0.63, 0.020, (30, 22, 24), 22), (0.72, 0.028, (14, 13, 12), 30)])
    img = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float64)
    img = bokeh(img, rng, 14, [(255, 200, 130), (255, 160, 90)], 0.006, 0.014, (0.66, 0.74), 0.5, 1.5)  # ljus från gården
    finish(img, rng, "vineyard", vignette=0.5)


def glass(rng):
    """Rödvin i motljus."""
    img = gradient([(0, (14, 4, 8)), (0.5, (58, 10, 22)), (1, (10, 3, 6))])
    img = glow(img, 0.30, 0.35, 0.60, (200, 30, 50), 0.30)
    img = glow(img, 0.80, 0.70, 0.45, (255, 120, 70), 0.14)
    reds = [(220, 50, 70), (255, 110, 90), (170, 20, 50), (255, 180, 140)]
    img = bokeh(img, rng, 22, reds, 0.06, 0.16, (0.05, 0.95), 0.15, 6)
    img = bokeh(img, rng, 30, reds, 0.015, 0.04, (0.2, 0.8), 0.38, 2)
    finish(img, rng, "glass")


def oak(rng):
    """Ekfat och bärnsten."""
    img = gradient([(0, (12, 9, 6)), (0.45, (46, 30, 14)), (1, (9, 7, 5))])
    img = glow(img, 0.5, 0.30, 0.70, (230, 160, 70), 0.24)
    amber = [(240, 180, 90), (200, 130, 60), (255, 215, 140)]
    img = bokeh(img, rng, 18, amber, 0.07, 0.18, (0.0, 0.6), 0.13, 7)
    img = bokeh(img, rng, 24, amber, 0.012, 0.03, (0.15, 0.5), 0.35, 2)
    finish(img, rng, "oak")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for i, scene in enumerate([cellar, vineyard, glass, oak]):
        scene(np.random.default_rng(71 + i))
