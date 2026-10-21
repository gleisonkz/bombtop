"""Goku's Kamehameha in HD: rows orb (the ball of ki at his hands) / body (the beam, tiles seamlessly
along x) / head (where it stops: the join on the left), FRAMES columns of 128x128 (a 32-unit design grid
at 4 px per unit, computed at 2x and scaled down). The frames loop: the energy flows along the beam.
Usage: python build-kamehameha.py public/sprites/kamehameha.png preview.png  (needs Pillow, numpy, scipy)
Body and head point right; the renderer rotates them."""
import math, random, sys
import numpy as np
from PIL import Image
from scipy import ndimage

U, PX, SS, FRAMES = 32, 4, 2, 8
N = U * PX * SS
K = N / U
C = U / 2
STOPS = [  # (energy, rgb): deep blue rim to the white-hot core
    (0.00, (14, 34, 128)),
    (0.14, (28, 86, 226)),
    (0.36, (64, 160, 255)),
    (0.60, (140, 222, 255)),
    (0.82, (220, 248, 255)),
    (1.00, (255, 255, 255)),
]
GLOW = np.array((90, 190, 255))

rnd = random.Random(11)
# Periodic 2D noise: integer wave numbers along x repeat every tile, so beam tiles join seamlessly.
WAVES = [(rnd.randint(1, 4), rnd.randint(-3, 3), rnd.uniform(0, 6.3), rnd.uniform(0.4, 1.0)) for _ in range(8)]
WSUM = sum(a for *_, a in WAVES)

ys, xs = np.mgrid[0:N, 0:N]
X, Y = (xs + 0.5) / K, (ys + 0.5) / K


def noise(x, y, t):
    """Flows along +x as t grows (one full loop over the frames)."""
    v = sum(a * np.sin(2 * math.pi * (k * x + l * y) / U + ph - t * k) for k, l, ph, a in WAVES)
    return v / WSUM


def beam(x, y, t, w=6.5):
    """The beam's energy: a band round y = C with rippling edges, brighter toward its middle,
    two strands of ki spiralling round it and streaks flowing along it."""
    edge = w + 0.7 * np.sin(2 * math.pi * x / U * 2 - t * 2) + 0.5 * np.sin(2 * math.pi * x / U * 3 + t * 3) + 0.9 * noise(x, y, t)
    h = 1 - np.abs(y - C) / np.maximum(edge, 1e-6)
    wob = 0.6 * noise(x, y * 0.3, t)
    strands = sum(
        np.exp(-(((y - C) - w * (0.55 + 0.1 * np.sin(t + p)) * np.sin(2 * math.pi * x / U - t + p + wob)) ** 2) / 0.45)
        for p in (0, 2.1)
    )
    streaks = np.clip(noise(x * 2, y * 3, t * 2), 0, 1) * 0.3
    return np.where(h > 0, np.clip(h, 0, None) ** 0.8 + 0.16 * strands * (h > 0.2) + streaks * h, h)


def orb(x, y, cx, r, t, spikes=9):
    """A ball of ki, its edge rippling as it turns."""
    d = np.hypot(x - cx, y - C)
    ang = np.arctan2(y - C, x - cx)
    rr = r * (1 + 0.05 * np.sin(ang * spikes + t * 2) + 0.04 * np.sin(ang * (spikes + 4) - t * 3) + 0.07 * noise(x, y, t))
    return 1 - d / np.maximum(rr, 1e-6)


def sparks(t, cx, spread, count, seed):
    """Little bright flecks thrown off the energy, a few units long, scattered round (cx, C)."""
    r = random.Random(seed)
    h = np.full(X.shape, -1.0)
    for _ in range(count):
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(spread * 0.6, spread)
        px, py = cx + math.cos(a) * dist, C + math.sin(a) * dist * 0.8
        if not (1 < px < U - 1 and 1 < py < U - 1):
            continue
        L = r.uniform(0.8, 1.8)
        dx, dy = math.cos(a), math.sin(a)
        along = (X - px) * dx + (Y - py) * dy
        across = -(X - px) * dy + (Y - py) * dx
        h = np.maximum(h, np.where(np.abs(along) < L, 0.9 - np.abs(across) / 0.35, -1))
    return h


def color(h):
    """Energy to RGBA: a smooth ramp, an alpha fading in over the rim, and a soft glow round it."""
    col = np.zeros(h.shape + (3,))
    hh = np.clip(h, 0, 1) ** 1.25
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        f = np.clip((hh - t0) / (t1 - t0), 0, 1)[..., None]
        seg = (hh >= t0) & (hh <= t1)
        col = np.where(seg[..., None], np.array(c0) * (1 - f) + np.array(c1) * f, col)
    alpha = np.clip(h / 0.06, 0, 1)
    glow = ndimage.gaussian_filter(np.clip(h, 0, 1), sigma=K * 1.6, mode="wrap") * 1.6
    ga = np.clip(glow, 0, 0.75) * (1 - alpha)
    rgb = (col * alpha[..., None] + GLOW * ga[..., None]) / np.maximum(alpha + ga, 1e-6)[..., None]
    return np.dstack([rgb, np.clip(alpha + ga, 0, 1) * 255])


def draw(kind, frame):
    t = 2 * math.pi * frame / FRAMES
    if kind == "body":
        h = beam(X, Y, t)
    elif kind == "orb":
        h = np.maximum(orb(X, Y, C, 8.5, t) * 1.25, sparks(t, C, 13, 6, frame))
    else:
        cx = U * 0.55
        h = np.maximum(np.where(X <= cx, beam(X, Y, t), -1), orb(X, Y, cx, 10.5, t, 11) * 1.3)
        h = np.maximum(h, sparks(t, cx, 15, 9, 100 + frame))
    img = Image.fromarray(np.clip(color(h), 0, 255).astype(np.uint8), "RGBA")
    return img.resize((U * PX, U * PX), Image.LANCZOS)


S = U * PX
ROWS = ["orb", "body", "head"]
sheet = Image.new("RGBA", (S * FRAMES, S * len(ROWS)))
for row, kind in enumerate(ROWS):
    for f in range(FRAMES):
        sheet.paste(draw(kind, f), (f * S, row * S))
sheet.save(sys.argv[1])
if len(sys.argv) > 2:  # preview: orb, 3 body tiles and the head per frame, on grass
    prev = Image.new("RGBA", (S * 5, S * FRAMES), (47, 107, 58, 255))
    for f in range(FRAMES):
        cell = lambda r: sheet.crop((f * S, r * S, (f + 1) * S, (r + 1) * S))
        for i in range(1, 4):
            prev.alpha_composite(cell(1), (i * S, f * S))
        prev.alpha_composite(cell(2), (4 * S, f * S))
        prev.alpha_composite(cell(0), (S // 2, f * S))
    prev.save(sys.argv[2])
