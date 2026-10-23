"""Penelope's lobby animation: a touch-up before the race. She opens her compact and looks in its mirror (a glint runs
over it), dabs powder on her cheeks and nose (a little cloud of it drifting up), snaps it shut, fluffs her ponytail
(sparkles), then blows a kiss at us: a heart flies up out of her hand with two little ones after it.

Her poses are PixelLab frames ("Penelope HD 2", animate_with_skeleton_v3 with our own keypoints; the compact and the
puff are PixelLab's): FRAMES_DIR/lobby15/south/<i>.png. This script draws the glint, the powder, the sparkles and the
hearts over them as pixel art, on a canvas with room above her for the hearts, and writes the finished frames to
FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py. The hearts are red, out of her sheet's player-color hues
(SHEETS.penelope.hues, the pink of her suit and helmet).
Usage: python build-penelope-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image

TOP = 30  # room added above the 180px canvas for the hearts
HEART = [(120, 10, 16), (230, 30, 40), (255, 120, 126), (255, 255, 255)]  # outline, fill, light, shine
SPARK = [(255, 255, 255), (255, 236, 150)]
POWDER = [(255, 244, 236), (255, 214, 214)]

# (her pose, effects)
FRAMES = [(0, ()), (1, ("glint",)), (2, ("glint",)), (3, ("powder",)), (4, ("powder", "glint")), (5, ("powder",)),
          (6, ("powder", "glint")), (7, ("snap",)), (8, ("hair",)), (9, ("hair",)), (10, ()), (11, ()),
          (12, ("kiss",)), (13, ("kiss",)), (14, ("kiss",)), (0, ("kiss",))]


def heart(a, cx, cy, size, alpha=255):
    """A pixel heart `size` px wide centred on (cx, cy): outlined, a lighter lobe, a white shine."""
    h, w = a.shape[:2]
    r = size / 2
    y, x = np.mgrid[:h, :w]
    u = (x - cx) / r * 1.2
    v = -(y - cy) / r * 1.2 + 0.2
    inside = (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0
    ring = np.zeros_like(inside)
    ring[1:-1, 1:-1] = inside[1:-1, 1:-1] & ~(inside[:-2, 1:-1] & inside[2:, 1:-1] & inside[1:-1, :-2] & inside[1:-1, 2:])
    fill = inside & ~ring
    a[fill] = (*HEART[1], alpha)
    a[fill & (u < -0.15) & (v > 0.35)] = (*HEART[2], alpha)
    a[fill & ((u + 0.55) ** 2 + (v - 0.75) ** 2 < 0.05)] = (*HEART[3], alpha)
    a[ring] = (*HEART[0], alpha)


def sparkle(a, cx, cy, n, color=0):
    """A four-pointed twinkle, arms `n` px long."""
    c = (*SPARK[color], 255)
    for k in range(-n, n + 1):
        for (px, py) in ((cx + k, cy), (cx, cy + k)):
            if 0 <= py < a.shape[0] and 0 <= px < a.shape[1]:
                a[py, px] = c
    if n >= 3:
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            a[cy + dy, cx + dx] = (*SPARK[1], 255)


def compact(im):
    """The middle of her open compact (the pink disc held up in her left hand), or None."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    pink = (al > 0) & (r > 200) & (g < 140) & (b > 100) & (b < 190)
    pink[:, :100] = False
    pink[:74] = False
    pink[100:] = False
    pink[:, 126:] = False
    ys, xs = np.nonzero(pink)
    return (int(xs.mean()), int(ys.mean())) if len(xs) > 12 else None


def hand_out(im):
    """The far end of the hand she throws the kiss with: the leftmost drawn pixel below her pigtail top."""
    al = np.array(im)[..., 3]
    ys, xs = np.nonzero(al[60:110] > 0)
    k = xs.argmin()
    return int(xs[k]), int(ys[k]) + 60


def main():
    src = Path(sys.argv[1])
    poses = [Image.open(src / "lobby15" / "south" / f"{i}.png").convert("RGBA") for i in range(15)]
    w, h = poses[0].size
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    kiss_from = hand_out(poses[13])
    for i, (pose, fx) in enumerate(FRAMES):
        rng = random.Random(i * 7 + 3)
        im = Image.new("RGBA", (w, h + TOP))
        im.alpha_composite(poses[pose], (0, TOP))
        a = np.array(im)
        if "glint" in fx:
            c = compact(poses[pose])
            if c:
                sparkle(a, c[0] - 3, c[1] - 4 + TOP, 3 + i % 2 * 2)
        if "powder" in fx:
            # a puff of powder off her cheek, rising and spreading frame to frame
            for k in range(10 + (i - 3) * 3):
                x = 86 + rng.randint(-14 - (i - 3) * 2, 14 + (i - 3) * 2)
                y = 80 - rng.randint(0, 10 + (i - 3) * 6) + TOP
                c = (*POWDER[k % 2], 255)
                a[y:y + 2, x:x + 2] = c
                if k % 4 == 0:
                    a[y - 1, x] = a[y + 2, x + 1] = c
        if "snap" in fx:
            sparkle(a, 113, 84 + TOP, 3, 1)
        if "hair" in fx:
            for (x, y, n) in ((40, 56, 3), (34, 78, 2), (48, 40, 2)) if i == 8 else ((36, 50, 2), (30, 70, 3), (46, 88, 2)):
                sparkle(a, x, y + TOP, n, 1 if n == 2 else 0)
        if "kiss" in fx:
            t = i - 12  # 0..3
            hx, hy = kiss_from
            hy += TOP
            if t == 0:
                heart(a, hx + 12, hy - 6, 11)
            else:
                # the kiss floats up toward the middle, growing; two little ones after it
                heart(a, hx + 8 + t * 10, hy - 14 - t * 20, 15 + t * 3)
                heart(a, hx + 2 + t * 5, hy - 4 - t * 11, 9)
                if t >= 2:
                    heart(a, hx + 18 + (t - 2) * 6, hy + 2 - (t - 2) * 12, 7)
                sparkle(a, hx + 26 + t * 8, hy - 24 - t * 14, 3, t % 2)
                sparkle(a, hx - 2 + t * 3, hy - 22 - t * 8, 2)
        Image.fromarray(a, "RGBA").save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
