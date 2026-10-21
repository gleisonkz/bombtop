"""Naruto's Rasengan in HD: rows orb (the spinning ball of chakra in his hand) / burst (where it strikes,
expanding and fading), FRAMES columns of 128x128 (a 32-unit design grid at 4 px per unit, computed at 2x
and scaled down). The orb's frames loop as it spins; the burst plays once.
Usage: python build-rasengan.py public/sprites/rasengan.png preview.png  (needs Pillow, numpy, scipy)"""
import math, random, sys
import numpy as np
from PIL import Image
from scipy import ndimage

U, PX, SS, FRAMES = 32, 4, 2, 8
N = U * PX * SS
K = N / U
C = U / 2
STOPS = [  # (energy, rgb): deep blue rim to the white-hot core
    (0.00, (20, 60, 170)),
    (0.20, (40, 120, 240)),
    (0.45, (90, 190, 255)),
    (0.70, (180, 236, 255)),
    (1.00, (255, 255, 255)),
]
GLOW = np.array((110, 200, 255))

ys, xs = np.mgrid[0:N, 0:N]
X, Y = (xs + 0.5) / K, (ys + 0.5) / K
D = np.hypot(X - C, Y - C)
A = np.arctan2(Y - C, X - C)


def swirl(t, arms=3, twist=0.55):
    """Spiral streaks of wind wound round the center, turning with t (one turn over the frames per arm)."""
    return 0.5 + 0.5 * np.cos(arms * (A - twist * D) - t)


def orb(t, r=9.0):
    """The ball: bright toward its middle, its spiral streaks lighter, a thin ring of wind round its edge."""
    rr = r * (1 + 0.04 * np.sin(A * 7 + t * 3))
    h = 1 - D / rr
    core = np.clip(h, 0, None) ** 0.7
    streaks = swirl(t) ** 6 * np.clip(h + 0.2, 0, 1) * 0.55
    ring = np.exp(-((D - r * 1.12) ** 2) / 0.5) * (0.35 + 0.35 * swirl(-t * 1.5, 5, 0.2))
    return np.maximum(np.where(h > 0, core + streaks, h), ring * 0.9 - 0.02)


def burst(f):
    """The strike: a flash, then a ring of wind thrown out wider and thinner, with flecks, fading."""
    k = f / (FRAMES - 1)
    r = 5 + 10 * k
    fade = (1 - k) ** 0.8
    flash = (1 - D / (10 * (1 - k) ** 1.5 + 0.5)) * 1.3
    ring = np.exp(-((D - r) ** 2) / (0.8 + 2 * k)) * (0.65 + 0.35 * swirl(f * 0.9, 4, 0.25)) * 1.1
    rnd = random.Random(7)
    flecks = np.full(X.shape, -1.0)
    for _ in range(14):
        a, s = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.7, 1.15)
        px, py = C + math.cos(a) * r * s, C + math.sin(a) * r * s
        L = 0.6 + 1.6 * fade
        along = (X - px) * math.cos(a) + (Y - py) * math.sin(a)
        across = -(X - px) * math.sin(a) + (Y - py) * math.cos(a)
        flecks = np.maximum(flecks, np.where(np.abs(along) < L, 0.9 - np.abs(across) / 0.3, -1))
    return np.maximum(np.maximum(flash, ring), flecks), fade


def color(h):
    """Energy to RGBA: a smooth ramp, an alpha fading in over the rim, and a soft glow round it."""
    col = np.zeros(h.shape + (3,))
    hh = np.clip(h, 0, 1) ** 1.2
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        f = np.clip((hh - t0) / (t1 - t0), 0, 1)[..., None]
        seg = (hh >= t0) & (hh <= t1)
        col = np.where(seg[..., None], np.array(c0) * (1 - f) + np.array(c1) * f, col)
    alpha = np.clip(h / 0.06, 0, 1)
    glow = ndimage.gaussian_filter(np.clip(h, 0, 1), sigma=K * 1.4) * 1.6
    ga = np.clip(glow, 0, 0.7) * (1 - alpha)
    rgb = (col * alpha[..., None] + GLOW * ga[..., None]) / np.maximum(alpha + ga, 1e-6)[..., None]
    return np.dstack([rgb, np.clip(alpha + ga, 0, 1) * 255])


def draw(kind, frame):
    h, fade = (orb(2 * math.pi * frame / FRAMES), 1) if kind == "orb" else burst(frame)
    rgba = color(h)
    rgba[..., 3] *= fade
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")
    return img.resize((U * PX, U * PX), Image.LANCZOS)


S = U * PX
ROWS = ["orb", "burst"]
sheet = Image.new("RGBA", (S * FRAMES, S * len(ROWS)))
for row, kind in enumerate(ROWS):
    for f in range(FRAMES):
        sheet.paste(draw(kind, f), (f * S, row * S))
sheet.save(sys.argv[1])
if len(sys.argv) > 2:  # preview on grass
    prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
    prev.alpha_composite(sheet)
    prev.save(sys.argv[2])
