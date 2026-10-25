"""Goku's lobby animation: he clenches his fists and powers up, his white ki flaring round him with the ground's pebbles
lifting, screams as a flash turns him Super Saiyan (golden hair, a golden flame aura crackling with lightning), holds
it, drops into his fighting stance and powers back down.

His poses are PixelLab frames ("Goku HD", animate_with_skeleton_v3 with our own keypoints, feet on the rest baseline):
FRAMES_DIR/lobby8/south/<i>.png (rest, fists at his hips, crouched lower, screaming with arms flung down and out, the
same higher, powered up standing wide, fighting stance, the same a little lower; at rest he is his still rotation,
FRAMES_DIR/rot/south.png, the same drawing on the same spot). This script turns his black hair gold
(super_saiyan), draws the aura, lightning, pebbles and the flash as pixel art, and writes the finished frames to
FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py.
The ki keeps out of his sheet's player-color hues (SHEETS.goku.hues, 205-235): white, gold, and a cyan for the lightning.
Usage: python build-goku-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

TOP = 34  # room added over the 180px canvas for the aura's flames
GOLD = [(206, 128, 10), (246, 186, 30), (255, 224, 80), (255, 246, 170)]  # dark to light
HAIR_LINE = (92, 46, 0, 255)  # the golden hair's outline (where black hair had black)
KI = [(196, 214, 220), (236, 246, 250), (255, 255, 255)]  # the white ki of his base form (grey, unsaturated)
BOLT = [(60, 205, 245, 255), (210, 250, 255, 255)]  # cyan glow, white core (hue ~195)
ROCK = [(120, 104, 88, 255), (164, 146, 124, 255)]

# (pose, aura: None / "ki" / "gold", aura size 0-3, golden hair, extras)
FRAMES = [
    (0, None, 0, False, ""),
    (1, "ki", 1, False, "rocks"),
    (2, "ki", 1, False, "rocks bolts"),
    (2, "ki", 2, False, "rocks bolts"),
    (3, None, 0, True, "flash"),
    (3, "gold", 3, True, "bolts ring"),
    (4, "gold", 3, True, "bolts"),
    (5, "gold", 3, True, ""),
    (5, "gold", 2, True, "bolts"),
    (6, "gold", 2, True, ""),
    (7, "gold", 2, True, "bolts"),
    (6, "gold", 2, True, ""),
    (7, "gold", 1, True, ""),
    (6, None, 0, False, "sparkles"),
    (6, None, 0, False, ""),
    (0, None, 0, False, ""),
]


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def clean(im):
    """Without the stray specks PixelLab leaves beside him: only clumps of 40+ pixels stay."""
    a = np.array(im)
    lab, n = ndimage.label(a[..., 3] > 0, np.ones((3, 3), bool))
    sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
    for k, size in enumerate(sizes, 1):
        if size < 40:
            a[lab == k] = 0
    return Image.fromarray(a, "RGBA")


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def flames(body, grow, tall, rng, phase):
    """The aura's shape: the body grown by `grow` px, its top licked up into flame tongues up to `tall` px."""
    m = ndimage.binary_dilation(body, disk(grow)) if grow else body.copy()
    h, w = m.shape
    lift = np.zeros(w)
    for _ in range(9):
        cx, half, top = rng.uniform(0, w), rng.uniform(4, 9), rng.uniform(0.5, 1) * tall
        xs = np.arange(w)
        lift = np.maximum(lift, top * np.clip(1 - np.abs(xs - cx) / half, 0, 1))
    lift = lift * (0.8 + 0.2 * np.sin(np.arange(w) * 0.7 + phase))
    out = m.copy()
    tops = np.where(m.any(axis=0), m.argmax(axis=0), h)
    for x in range(w):
        if tops[x] < h and lift[x] >= 1:
            out[max(0, tops[x] - int(lift[x])):tops[x], x] = True
    # tongues licking up the sides too: each side's edge rows shifted up
    side = ndimage.binary_dilation(m, np.ones((1, 3), bool)) & ~m
    for s in range(1, int(tall * 0.5)):
        out[:-s] |= side[s:] & (rng.random(side[s:].shape) < 0.9 - s / tall)
    return ndimage.binary_opening(out, np.ones((2, 2), bool)) | m


def egg(shape, cx, ground, k, phase=0.0):
    """The aura's flame body: an upright ellipse round him from his feet to over his head, k times its full size, its
    sides licking in and out."""
    h, w = shape
    ry = 84 * k
    cy = ground - ry + 4
    y, x = np.ogrid[:h, :w]
    rx = 44 * k * (1 + 0.07 * np.sin(y * 0.35 + phase) + 0.04 * np.sin(y * 0.9 - phase * 2))
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def aura(size, body, kind, rng, phase, ground):
    """Three bands of flame round the body (outer dark and see-through, inner light), as an RGBA layer, with streaks of
    light rising through it."""
    h, w = body.shape
    layer = np.zeros((h, w, 4), np.uint8)
    cols = GOLD if kind == "gold" else KI
    grow = [0, 5, 7, 8][size]
    tall = [0, 12, 24, 32][size]
    k = [0, 0, 0.88, 1.0][size] if kind == "gold" else 0
    base = body | egg(body.shape, w // 2, ground, k, phase) if k else body
    inside = body | egg(body.shape, w // 2, ground, k * 0.86, phase + 1) if k else body
    bands = [(flames(base, grow, tall, rng, phase), cols[-3], 215),
             (flames(inside, max(1, grow - 4), tall * 0.75, rng, phase + 1), cols[-2], 232),
             (flames(body, 3, tall * 0.3, rng, phase + 2), cols[-1], 220)]
    for mask, c, a in bands:
        layer[mask] = (*c[:3], a)
    outer = bands[0][0]
    for _ in range(4 * size):  # streaks of light rising through the flames
        x = int(rng.integers(w // 2 - 40, w // 2 + 40))
        y = int(rng.integers(0, h))
        n = int(rng.integers(6, 14))
        for yy in range(max(0, y - n), y):
            if outer[yy, x]:
                layer[yy, x] = (*cols[-1][:3], 255)
    return Image.fromarray(layer, "RGBA")


def skin(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return r > 190 and r - b > 40 and g > 120


def super_saiyan(im):
    """His black hair turned gold: the dark pixels of his head outside his face (and over his brows), filled with gold
    shaded lighter toward the top, their outline kept dark."""
    a = np.array(im).astype(int)
    alpha = a[..., 3] > 0
    ys = np.nonzero(alpha.any(axis=1))[0]
    top = ys[0]
    dark = alpha & (a[..., :3].sum(axis=2) < 110)
    cand = np.zeros_like(dark)
    for y in range(top, min(top + 76, a.shape[0])):
        sk = [x for x in range(a.shape[1]) if alpha[y, x] and skin(a[y, x])]
        for x in np.nonzero(dark[y])[0]:
            if y < top + 40 or not sk or x < min(sk) or x > max(sk):
                cand[y, x] = True
    lab, n = ndimage.label(cand)
    hair = np.zeros_like(cand)
    for k in range(1, n + 1):
        part = lab == k
        if part.sum() >= 25 and np.nonzero(part)[0].min() < top + 30:
            hair |= part
    # outline: hair pixels next to anything that is not hair
    inner = ndimage.binary_erosion(hair, np.ones((3, 3), bool), border_value=0)
    edge = hair & ~inner
    out = a.copy()
    yy, xx = np.nonzero(inner)
    hy0, hy1 = yy.min() if len(yy) else 0, yy.max() if len(yy) else 1
    for y, x in zip(yy, xx):
        t = (y - hy0) / max(1, hy1 - hy0)
        c = GOLD[3] if t < 0.18 else GOLD[2] if t < 0.5 else GOLD[1] if t < 0.85 else GOLD[0]
        # a darker band one pixel inside the outline, as PixelLab shades
        if not ndimage.binary_erosion(hair[max(0, y - 2):y + 3, max(0, x - 2):x + 3], np.ones((3, 3), bool)).any():
            c = GOLD[1] if c in (GOLD[3], GOLD[2]) else GOLD[0]
        out[y, x, :3] = c
    out[edge, :3] = HAIR_LINE[:3]
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def bolt(d, x0, y0, x1, y1, rng):
    n = max(2, round(math.hypot(x1 - x0, y1 - y0) / 5))
    pts = [(x0, y0)] + [(x0 + (x1 - x0) * i / n + rng.uniform(-3, 3), y0 + (y1 - y0) * i / n + rng.uniform(-3, 3)) for i in range(1, n)] + [(x1, y1)]
    d.line(pts, fill=BOLT[0], width=3)
    d.line(pts, fill=BOLT[1], width=1)


def opaque(im):
    """Pixel art: no half-transparent pixels but the aura's."""
    a = np.array(im)
    soft = (a[..., 3] > 0) & (a[..., 3] < 255)
    return a, soft


def main():
    src = Path(sys.argv[1])
    poses = [clean(Image.open(src / "lobby8" / "south" / f"{i}.png").convert("RGBA")) for i in range(8)]
    poses[0] = Image.open(src / "rot" / "south.png").convert("RGBA")  # his still rotation: the redraw left a red speck
    w, h = poses[0].size
    ground = feet(poses[0]) + TOP
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for i, (k, kind, size, gold, extra) in enumerate(FRAMES):
        rng = random.Random(i * 13 + 1)
        body = Image.new("RGBA", (w, h + TOP))
        pose = super_saiyan(poses[k]) if gold else poses[k]
        body.alpha_composite(pose, (0, TOP))
        mask = np.array(body)[..., 3] > 32
        im = Image.new("RGBA", body.size)
        if kind:
            im.alpha_composite(aura(size, mask, kind, np.random.default_rng(i), i * 1.7, ground))
        d = ImageDraw.Draw(im)
        cx = w // 2
        if "ring" in extra:  # the shock of the transformation along the ground
            d.ellipse([cx - 62, ground - 8, cx + 62, ground + 4], outline=GOLD[2], width=2)
        if "flash" in extra:  # the flash of the transformation, his body lit white
            for r, c in ((60, GOLD[1]), (48, GOLD[2]), (36, GOLD[3]), (24, (255, 255, 255))):
                d.ellipse([cx - r, ground - 70 - r, cx + r, ground - 70 + r], fill=c + (255,) if len(c) == 3 else c)
        im.alpha_composite(body)
        if "flash" in extra:
            a = np.array(im)
            lit = np.array(body)[..., 3] > 0
            a[lit, :3] = (a[lit, :3].astype(int) + 255 * 2) // 3
            im = Image.fromarray(a, "RGBA")
        d = ImageDraw.Draw(im)
        if "rocks" in extra:  # pebbles lifting off the ground round his feet
            for _ in range(4 + 2 * size):
                x = cx + rng.choice([-1, 1]) * rng.randint(24, 60)
                y = ground - rng.randint(0, 14 + 10 * size)
                r = rng.randint(1, 3)
                d.rectangle([x - r, y - r, x + r, y + r - 1], fill=ROCK[rng.randint(0, 1)])
                d.point((x - r, y - r), fill=ROCK[1])
        if "bolts" in extra:  # lightning crackling round him
            for _ in range(3):
                a = rng.uniform(-1, 1) + rng.choice([0, math.pi])  # off to his sides, clear of his face
                x0, y0 = cx + math.cos(a) * rng.randint(28, 42), ground - 70 + math.sin(a) * rng.randint(30, 60)
                x1, y1 = x0 + rng.choice([-1, 1]) * rng.randint(10, 20), y0 + rng.choice([-1, 1]) * rng.randint(14, 26)
                bolt(d, x0, y0, x1, y1, rng)
                bolt(d, x1, y1, x1 + rng.randint(-10, 10), y1 + rng.randint(-12, 12), rng)
        if "sparkles" in extra:  # the gold leaving his hair
            for _ in range(7):
                x, y = cx + rng.randint(-34, 34), ground - rng.randint(100, 150)
                d.line([(x - 2, y), (x + 2, y)], fill=GOLD[2] + (255,))
                d.line([(x, y - 2), (x, y + 2)], fill=GOLD[2] + (255,))
        im.save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
