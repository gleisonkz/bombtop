"""Explosion flame sheet in HD: rows center / mid / end, FRAMES columns of 128x128 (a 32-unit
design grid at 4 px per unit, computed at 2x and scaled down).
Usage: python build-flames.py public/sprites/flames.png preview.png  (needs Pillow, numpy)
Mid and end point right (end tip on the right); the renderer rotates them.
The noise is periodic in x so neighbouring tiles join seamlessly."""
import math, random, sys
import numpy as np
from PIL import Image

U, PX, SS, FRAMES = 32, 4, 2, 5
N = U * PX * SS
K = N / U
C = U / 2
STOPS = [  # (heat, rgb): smooth gradient from the dark rim to the white-hot core
    (0.00, (110, 18, 8)),
    (0.16, (214, 52, 28)),
    (0.40, (255, 122, 26)),
    (0.64, (255, 210, 63)),
    (0.84, (255, 248, 210)),
    (1.00, (255, 255, 240)),
]
# Per frame: band half-width at the joins, core boost, flicker phase.
LIFE = [(7.5, 1.35, 0.0), (11.5, 1.15, 0.9), (10.5, 1.0, 2.1), (8.0, 0.85, 3.3), (5.0, 0.68, 4.4)]

rnd = random.Random(7)
# Periodic 2D noise: integer wave numbers repeat every tile, so joins line up.
WAVES = [(rnd.randint(1, 4), rnd.randint(-3, 3), rnd.uniform(0, 6.3), rnd.uniform(0.4, 1.0)) for _ in range(7)]
WSUM = sum(a for *_, a in WAVES)

ys, xs = np.mgrid[0:N, 0:N]
X, Y = (xs + 0.5) / K, (ys + 0.5) / K

def noise(x, y, t):
    v = sum(a * np.sin(2 * math.pi * (k * x + l * y) / U + ph + t * (1 + k)) for k, l, ph, a in WAVES)
    return v / WSUM

def wave(x, phase):
    return 0.9 * np.sin(2 * math.pi * x / U * 2 + phase) + 0.6 * np.sin(2 * math.pi * x / U * 3 - phase * 1.7)

def band(x, y, w, phase):
    half = w + wave(x, phase) * 0.6 + noise(x, y, phase) * w * 0.28
    h = np.where(half > 0, 1 - np.abs(y - C) / np.maximum(half, 1e-6), -1)
    return np.where(h > 0, h + 0.12 * noise(x * 2, y, phase * 2), h)

def color(h):
    """Heat to RGBA: a smooth ramp, and an alpha that fades in over the rim."""
    col = np.zeros(h.shape + (3,))
    hh = np.clip(h, 0, 1) ** 1.7  # keep the white core small, most of the flame orange and yellow
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        f = np.clip((hh - t0) / (t1 - t0), 0, 1)[..., None]
        seg = (hh >= t0) & (hh <= t1)
        col = np.where(seg[..., None], np.array(c0) * (1 - f) + np.array(c1) * f, col)
    alpha = np.clip(h / 0.05, 0, 1) * 255
    return np.dstack([col, alpha])

def draw(kind, frame):
    w, boost, phase = LIFE[frame]
    if kind == "mid":
        h = band(X, Y, w, phase)
    elif kind == "end":
        cx = U * 0.62 - (11.5 - w) * 0.6
        r = w * 1.05 + noise(X, Y, phase) * w * 0.3
        bulb = np.where(r > 0, 1 - np.hypot(X - cx, Y - C) / np.maximum(r, 1e-6), -1)
        h = np.maximum(np.where(X <= cx, band(X, Y, w, phase), -1), bulb)
    else:
        h = np.maximum(band(X, Y, w, phase), band(Y, X, w, phase + 1.3))
        r = w * 1.6 + w * 0.22 * np.sin(phase * 2 + np.arctan2(Y - C, X - C) * 6)
        h = np.maximum(h, 1 - np.hypot(X - C, Y - C) / r)
    h = np.where(h > 0, h * boost, h)
    img = Image.fromarray(np.clip(color(h), 0, 255).astype(np.uint8), "RGBA")
    return img.resize((U * PX, U * PX), Image.LANCZOS)

S = U * PX
sheet = Image.new("RGBA", (S * FRAMES, S * 3))
for row, kind in enumerate(["center", "mid", "end"]):
    for f in range(FRAMES):
        sheet.paste(draw(kind, f), (f * S, row * S))
sheet.save(sys.argv[1])
if len(sys.argv) > 2:  # preview: a cross of range 2 per frame, on grass
    prev = Image.new("RGBA", (FRAMES * S * 5, S * 5), (47, 107, 58, 255))
    for f in range(FRAMES):
        def put(kind, gx, gy, rot):
            r = ["center", "mid", "end"].index(kind)
            tile = sheet.crop((f * S, r * S, (f + 1) * S, (r + 1) * S)).rotate(rot)
            prev.alpha_composite(tile, (f * S * 5 + gx * S, gy * S))
        put("center", 2, 2, 0)
        put("mid", 3, 2, 0); put("end", 4, 2, 0)
        put("mid", 1, 2, 180); put("end", 0, 2, 180)
        put("mid", 2, 1, 90); put("end", 2, 0, 90)
        put("mid", 2, 3, 270); put("end", 2, 4, 270)
    prev.resize((prev.width // 4, prev.height // 4), Image.LANCZOS).save(sys.argv[2])
