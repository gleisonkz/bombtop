"""Explosion flame sheet: rows center / mid / end, FRAMES columns of 32x32.
# Usage: python build-flames.py public/sprites/flames.png preview.png  (needs Pillow)
Mid and end point right (end tip on the right); the renderer rotates them.
Edges are periodic in x so neighbouring tiles join seamlessly."""
import math, sys
from PIL import Image

N, FRAMES = 32, 5
C = (N - 1) / 2
PALETTE = [  # (heat threshold, rgba)
    (0.00, (110, 18, 8, 255)),    # outline
    (0.16, (214, 52, 28, 255)),   # red
    (0.40, (255, 122, 26, 255)),  # orange
    (0.64, (255, 210, 63, 255)),  # yellow
    (0.84, (255, 248, 210, 255)), # core
]
# Per frame: band half-width at the joins, core boost, flicker phase.
LIFE = [(7.5, 1.35, 0.0), (11.5, 1.15, 0.9), (10.5, 1.0, 2.1), (8.0, 0.85, 3.3), (5.0, 0.68, 4.4)]

import random
rnd = random.Random(7)
# Periodic 2D noise: integer wave numbers repeat every tile, so joins line up.
WAVES = [(rnd.randint(1, 4), rnd.randint(-3, 3), rnd.uniform(0, 6.3), rnd.uniform(0.4, 1.0)) for _ in range(7)]
def noise(x, y, t):
    v = sum(a * math.sin(2 * math.pi * (k * x + l * y) / N + ph + t * (1 + k)) for k, l, ph, a in WAVES)
    return v / sum(a for *_, a in WAVES)

def color(h):
    if h <= 0: return (0, 0, 0, 0)
    c = PALETTE[0][1]
    for t, rgba in PALETTE:
        if h >= t: c = rgba
    return c

def wave(x, phase):
    # periodic over the tile so joins line up; small, flickering
    return 0.9 * math.sin(2 * math.pi * x / N * 2 + phase) + 0.6 * math.sin(2 * math.pi * x / N * 3 - phase * 1.7)

def band(x, y, w, phase):
    half = w + wave(x, phase) * 0.6 + noise(x, y, phase) * w * 0.28
    h = 1 - abs(y - C) / half if half > 0 else -1
    # hot streaks flowing along the arm
    return h + 0.12 * noise(x * 2, y, phase * 2) if h > 0 else h

def draw(kind, frame):
    w, boost, phase = LIFE[frame]
    img = Image.new("RGBA", (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            if kind == "mid":
                h = band(x, y, w, phase)
            elif kind == "end":
                # full width at the join (x=0), then a round bulb for a tip
                cx = N * 0.62 - (11.5 - w) * 0.6
                if x <= cx:
                    h = band(x, y, w, phase)
                else:
                    r = w * 1.05 + noise(x, y, phase) * w * 0.3
                    h = 1 - math.hypot(x - cx, y - C) / r if r > 0 else -1
            else:  # center: both bands plus a round fireball
                h = max(band(x, y, w, phase), band(y, x, w, phase + 1.3))
                r = w * 1.6 + w * 0.22 * math.sin(phase * 2 + math.atan2(y - C, x - C) * 6)
                h = max(h, 1 - math.hypot(x - C, y - C) / r)
            px[x, y] = color(h * boost if h > 0 else h)
    return img

sheet = Image.new("RGBA", (N * FRAMES, N * 3))
for row, kind in enumerate(["center", "mid", "end"]):
    for f in range(FRAMES):
        sheet.paste(draw(kind, f), (f * N, row * N))
sheet.save(sys.argv[1])
# preview: a cross of range 2 per frame, scaled up, on grass
prev = Image.new("RGBA", (FRAMES * N * 5, N * 5), (47, 107, 58, 255))
for f in range(FRAMES):
    def put(kind, gx, gy, rot):
        tile = sheet.crop((f * N, ["center", "mid", "end"].index(kind) * N, (f + 1) * N, (["center", "mid", "end"].index(kind) + 1) * N)).rotate(rot)
        prev.alpha_composite(tile, (f * N * 5 + gx * N, gy * N))
    put("center", 2, 2, 0)
    put("mid", 3, 2, 0); put("end", 4, 2, 0)
    put("mid", 1, 2, 180); put("end", 0, 2, 180)
    put("mid", 2, 1, 90); put("end", 2, 0, 90)
    put("mid", 2, 3, 270); put("end", 2, 4, 270)
prev.resize((prev.width * 2, prev.height * 2), Image.NEAREST).save(sys.argv[2])
