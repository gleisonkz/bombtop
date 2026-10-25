"""Penelope's victory animation: she crouches, jumps for joy with her arms up (a burst of sparkles), lands with a foot
kicked up behind her and waves a checkered race flag over her head, hearts and sparkles floating up round her.

Her poses are PixelLab frames ("Penelope HD 2", animate_with_skeleton_v3 with our own keypoints, her raised hand left
empty): FRAMES_DIR/victory15/south/<i>.png. This script draws the flag in her raised hand (a pole and a checkered
cloth rippling out to the side), the sparkles and the hearts as pixel art, on a canvas with room above and beside
her, and writes the finished frames to FRAMES_DIR/victory/south/<i>.png for build-lobby-image.py (kind victory).
The hearts are red and the flag black and white, out of her sheet's player-color hues (SHEETS.penelope.hues).
Usage: python build-penelope-victory.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

PAD = 40  # room added above and at each side of the 180px canvas
POLE = [(70, 44, 28), (150, 104, 60), (230, 196, 80)]  # outline, wood, gold tip
CLOTH = [(24, 24, 32), (250, 250, 250), (180, 180, 196)]  # black, white, white in shade
OUT = (16, 16, 22)
FLAG_FROM = 6  # first frame with the flag in her hand
HEART = [(120, 10, 16), (230, 30, 40), (255, 120, 126), (255, 255, 255)]
SPARK = [(255, 255, 255), (255, 236, 150)]


def hand(im):
    """Middle of her raised glove: the white pixels at her right (our left) above her waist."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    glove = (al > 0) & (r > 190) & (g > 190) & (b > 190)
    glove[:30] = False
    glove[90:] = False
    glove[:, 46:] = False
    ys, xs = np.nonzero(glove)
    return int(xs.mean()), int(ys.mean())


def flag(im, hx, hy, i):
    """The pole up from her fist, the checkered cloth flying out to our left off its top, rippling frame to frame."""
    d = ImageDraw.Draw(im)
    top = (hx - 4, hy - 46)
    d.line([(hx + 1, hy + 4), top], fill=POLE[0], width=4)
    d.line([(hx + 1, hy + 4), top], fill=POLE[1], width=2)
    d.ellipse([top[0] - 3, top[1] - 3, top[0] + 2, top[1] + 2], fill=POLE[2], outline=POLE[0])
    w, h, sq = 40, 26, 6.5
    phase = i * 1.3
    a = np.array(im)
    cells = np.zeros(a.shape[:2], bool)
    for u in range(w):
        wave = math.sin(u / 7 - phase) * (2 + u / 10)
        x = top[0] - 2 - u
        for v in range(h):
            y = int(round(top[1] + 2 + v + wave - u * 0.12))
            if not (0 <= y < a.shape[0] and 0 <= x < a.shape[1]):
                continue
            dark = (int(u / sq) + int(v / sq)) % 2 == 0
            shade = math.cos(u / 7 - phase) < -0.4
            a[y, x] = (*(CLOTH[0] if dark else CLOTH[2] if shade else CLOTH[1]), 255)
            cells[y, x] = True
    ring = np.zeros_like(cells)
    ring[1:-1, 1:-1] = ~cells[1:-1, 1:-1] & (cells[:-2, 1:-1] | cells[2:, 1:-1] | cells[1:-1, :-2] | cells[1:-1, 2:])
    a[ring] = (*OUT, 255)
    return Image.fromarray(a, "RGBA")


def heart(a, cx, cy, size):
    h, w = a.shape[:2]
    r = size / 2
    y, x = np.mgrid[:h, :w]
    u = (x - cx) / r * 1.2
    v = -(y - cy) / r * 1.2 + 0.2
    inside = (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0
    ring = np.zeros_like(inside)
    ring[1:-1, 1:-1] = inside[1:-1, 1:-1] & ~(inside[:-2, 1:-1] & inside[2:, 1:-1] & inside[1:-1, :-2] & inside[1:-1, 2:])
    fill = inside & ~ring
    a[fill] = (*HEART[1], 255)
    a[fill & (u < -0.15) & (v > 0.35)] = (*HEART[2], 255)
    a[fill & ((u + 0.55) ** 2 + (v - 0.75) ** 2 < 0.05)] = (*HEART[3], 255)
    a[ring] = (*HEART[0], 255)


def sparkle(a, cx, cy, n, color=0):
    c = (*SPARK[color], 255)
    for k in range(-n, n + 1):
        for (px, py) in ((cx + k, cy), (cx, cy + k)):
            if 0 <= py < a.shape[0] and 0 <= px < a.shape[1]:
                a[py, px] = c
    if n >= 3:
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            a[cy + dy, cx + dx] = (*SPARK[1], 255)


def main():
    src = Path(sys.argv[1])
    poses = [Image.open(src / "victory15" / "south" / f"{i}.png").convert("RGBA") for i in range(15)]
    w, h = poses[0].size
    out = src / "victory" / "south"
    out.mkdir(parents=True, exist_ok=True)
    order = list(range(15)) + [14]
    for k, i in enumerate(order):
        rng = random.Random(k * 11 + 5)
        im = Image.new("RGBA", (w + 2 * PAD, h + PAD))
        im.alpha_composite(poses[i], (PAD, PAD))
        if i >= FLAG_FROM:
            hx, hy = hand(poses[i])
            im = flag(im, hx + PAD, hy + PAD, k)
        a = np.array(im)
        cx = PAD + w // 2
        if 2 <= i <= 5:
            # a burst of sparkles round her as she jumps
            t = i - 2
            for s in range(8):
                ang = s / 8 * 2 * math.pi + 0.3
                r = 40 + t * 9
                sparkle(a, int(cx + math.cos(ang) * r), int(PAD + 80 + math.sin(ang) * r * 0.8), 3 if (s + t) % 2 else 2, s % 2)
        if i >= FLAG_FROM:
            # hearts floating up at her other side, sparkles twinkling round
            for j in range(3):
                life = (k - FLAG_FROM + j * 3) % 9
                heart(a, cx + 46 + j * 7 - life % 3, PAD + 100 - j * 4 - life * 10, 9 + life // 3 * 3)
            for _ in range(3):
                sparkle(a, cx + rng.randint(-60, 64), PAD + rng.randint(10, 110), rng.choice((2, 3)), rng.randint(0, 1))
        Image.fromarray(a, "RGBA").save(out / f"{k}.png")
    print(f"{len(order)} frames -> {out}")


main()
