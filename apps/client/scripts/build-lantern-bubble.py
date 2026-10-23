"""The green lantern's bubble in HD: rows form (willed into being: sparks rushing in, a ring of light swelling into the
sphere), loop (the bubble held: a bright fresnel rim, a honeycomb of energy drifting over the sphere, ripples running
round its edge, a white shine top left, sparkles), pop (it gives way: a flash, the shell cracking into shards flying
out, fading). FRAMES columns of 192x192 (a 48-unit design grid at 4 px per unit, computed at 2x and scaled down).
Usage: python build-lantern-bubble.py public/sprites/lantern-bubble.png preview.png  (needs Pillow, numpy, scipy)"""
import math, random, sys
import numpy as np
from PIL import Image
from scipy import ndimage

U, PX, SS = 48, 4, 2
N = U * PX * SS
K = N / U
C = U / 2
R = 19.0  # the sphere's radius, in units
FRAMES = {"form": 8, "loop": 12, "pop": 8}
STOPS = [  # (energy, rgb): deep emerald to the white-hot rim
    (0.00, (8, 90, 30)),
    (0.25, (30, 170, 60)),
    (0.50, (80, 235, 100)),
    (0.75, (170, 255, 170)),
    (1.00, (250, 255, 245)),
]
GLOW = np.array((90, 255, 120))

ys, xs = np.mgrid[0:N, 0:N]
X, Y = (xs + 0.5) / K - C, (ys + 0.5) / K - C
D = np.hypot(X, Y)
A = np.arctan2(Y, X)


def hexes(u, v, size):
    """Distance to the nearest edge of a honeycomb of cells `size` across: 0 on an edge, up to ~0.5 in a cell's middle."""
    q = (u * math.sqrt(3) / 3 - v / 3) / size
    r = v * 2 / 3 / size
    # cube coordinates rounded to the nearest cell
    x, z = q, r
    y = -x - z
    rx, ry, rz = np.round(x), np.round(y), np.round(z)
    dx, dy, dz = np.abs(rx - x), np.abs(ry - y), np.abs(rz - z)
    fx = np.where((dx > dy) & (dx > dz), -ry - rz, rx)
    fz = np.where(~((dx > dy) & (dx > dz)) & ~(dy > dz), -rx - ry, rz)
    fy = -fx - fz
    m = np.maximum(np.maximum(np.abs(x - fx), np.abs(y - fy)), np.abs(z - fz))
    return 0.5 - m


def sphere(t, r=R, flicker=1.0):
    """The bubble at phase t (0..1 over the loop): its energy per pixel."""
    rho = D / r
    inside = rho < 1
    z = np.sqrt(np.clip(1 - rho**2, 0, 1))
    fres = (1 - z) ** 2.2  # brighter toward the rim, as light through a thin shell
    # a honeycomb wrapped on the sphere, drifting round it
    u = X / (0.45 + 0.55 * z) + 9 * t
    v = Y / (0.45 + 0.55 * z) - 4 * t
    cells = np.clip(1 - hexes(u, v, 3.2) / 0.07, 0, 1) * (0.25 + 0.75 * fres) * 0.55
    # ripples running round the rim
    ripple = (0.5 + 0.5 * np.cos(5 * A - 2 * math.pi * t * 2)) * np.exp(-((rho - 0.93) ** 2) / 0.004) * 0.5
    rim = np.exp(-((rho - 0.985) ** 2) / 0.0012) * 1.05
    body = 0.05 + fres * 0.8 + cells + ripple
    e = np.where(inside, body, rim * 0) + rim
    # the shine: a white crescent top left and a small dot lower right
    sh = np.exp(-(((X + r * 0.42) ** 2) / (r * 0.16) ** 2 + ((Y + r * 0.45) ** 2) / (r * 0.09) ** 2))
    sh2 = np.exp(-(((X - r * 0.48) ** 2 + (Y - r * 0.5) ** 2) / (r * 0.07) ** 2))
    e = e + (sh * 1.1 + sh2 * 0.8) * inside
    # sparkles twinkling on the shell
    rnd = random.Random(11)
    for k in range(7):
        a, s = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.55, 0.95)
        ph = (t * 2 + k / 7) % 1
        b = max(0.0, math.sin(ph * math.pi)) ** 3
        px, py = math.cos(a) * r * s, math.sin(a) * r * s
        L = 0.4 + 1.6 * b
        star = np.maximum(
            np.clip(1 - np.abs(X - px) / L, 0, 1) * np.clip(1 - np.abs(Y - py) / 0.18, 0, 1),
            np.clip(1 - np.abs(Y - py) / L, 0, 1) * np.clip(1 - np.abs(X - px) / 0.18, 0, 1),
        )
        e = np.maximum(e, star * 1.2 * b)
    return e * flicker, inside


def form(f):
    """Willed into being: sparks rush in from all round, a ring of light swells out to the sphere, which fills in."""
    k = f / (FRAMES["form"] - 1)
    r = R * (0.25 + 0.75 * k**0.7)
    e, inside = sphere(0, r)
    e = e * (0.35 + 0.65 * k)
    ring = np.exp(-((D - r) ** 2) / (0.6 + 1.2 * (1 - k))) * (1.3 - 0.4 * k)
    flash = np.clip(1 - D / (3 + 6 * (1 - k)), 0, 1) * (1 - k) * 1.4
    rnd = random.Random(3)
    sparks = np.full(X.shape, 0.0)
    for _ in range(16):
        a = rnd.uniform(0, 2 * math.pi)
        dist = R * 1.3 * (1 - k) + r * k
        px, py = math.cos(a) * dist, math.sin(a) * dist
        along = X * math.cos(a) + Y * math.sin(a)
        across = -X * math.sin(a) + Y * math.cos(a)
        streak = np.clip(1 - np.abs(across) / 0.45, 0, 1) * np.clip(1 - np.abs(along - dist - 2.0) / 2.6, 0, 1)
        sparks = np.maximum(sparks, streak * (1 - k * 0.6))
    return np.maximum(np.maximum(e, ring), np.maximum(flash, sparks)), 1.0


def pop(f):
    """It gives way: a flash on the shell, which cracks into shards flying out and fading."""
    k = f / (FRAMES["pop"] - 1)
    fade = (1 - k) ** 0.9
    e, inside = sphere(0.3, R, 1.0 - k)
    e = e * (1 - k) ** 2
    ring = np.exp(-((D - R * (1 + 0.35 * k)) ** 2) / (0.5 + 2 * k)) * (1.4 - k)
    rnd = random.Random(9)
    shards = np.full(X.shape, 0.0)
    for _ in range(22):
        a, s = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.85, 1.05)
        dist = R * s * (1 + 0.6 * k)
        px, py = math.cos(a) * dist, math.sin(a) * dist
        rot = a + rnd.uniform(-0.6, 0.6) + k * rnd.uniform(-2, 2)
        along = (X - px) * math.cos(rot) + (Y - py) * math.sin(rot)
        across = -(X - px) * math.sin(rot) + (Y - py) * math.cos(rot)
        L = rnd.uniform(1.4, 2.8)
        tri = np.clip(1 - np.abs(across) / (1.1 * (1 - (along + L) / (2 * L)) + 0.08), 0, 1) * ((np.abs(along) < L) * 1.0)
        shards = np.maximum(shards, tri * 1.1)
    return np.maximum(np.maximum(e, ring), shards), fade


def color(h):
    """Energy to RGBA: a smooth ramp, an alpha fading in with it, and a soft green glow round everything."""
    col = np.zeros(h.shape + (3,))
    hh = np.clip(h, 0, 1)
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        f = np.clip((hh - t0) / (t1 - t0), 0, 1)[..., None]
        seg = (hh >= t0) & (hh <= t1)
        col = np.where(seg[..., None], np.array(c0) * (1 - f) + np.array(c1) * f, col)
    alpha = np.clip(h * 1.15, 0, 1) ** 0.9
    glow = ndimage.gaussian_filter(np.clip(h, 0, 1), sigma=K * 1.2) * 1.4
    ga = np.clip(glow, 0, 0.6) * (1 - alpha)
    rgb = (col * alpha[..., None] + GLOW * ga[..., None]) / np.maximum(alpha + ga, 1e-6)[..., None]
    return np.dstack([rgb, np.clip(alpha + ga, 0, 1) * 255])


def draw(kind, frame):
    if kind == "loop":
        h, fade = sphere(frame / FRAMES["loop"])[0], 1.0
    else:
        h, fade = (form if kind == "form" else pop)(frame)
    rgba = color(h)
    rgba[..., 3] *= fade
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")
    return img.resize((U * PX, U * PX), Image.LANCZOS)


S = U * PX
ROWS = list(FRAMES)
sheet = Image.new("RGBA", (S * max(FRAMES.values()), S * len(ROWS)))
for row, kind in enumerate(ROWS):
    for f in range(FRAMES[kind]):
        sheet.paste(draw(kind, f), (f * S, row * S))
sheet.save(sys.argv[1])
if len(sys.argv) > 2:  # preview on grass, a character (argv[3], optional) standing inside
    prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
    if len(sys.argv) > 3:
        who = Image.open(sys.argv[3]).convert("RGBA")
        who = who.resize((who.width * S // 260, who.height * S // 260), Image.LANCZOS)
        for row, kind in enumerate(ROWS):
            for f in range(FRAMES[kind]):
                prev.alpha_composite(who, (f * S + (S - who.width) // 2, row * S + (S - who.height) // 2 + 6))
    prev.alpha_composite(sheet)
    prev.save(sys.argv[2])
