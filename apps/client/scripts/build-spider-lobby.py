"""Spider-Man's lobby animation: he shoots a web line up out of the card, is yanked up after it and gone, swings back
in from the top on it across the card, lets go and lands in his three-point crouch (one hand on the ground, dust
flying), then stands.

His poses are PixelLab frames ("Spider-Man HD", animate_with_skeleton_v3 with our own keypoints, feet on the rest
baseline): FRAMES_DIR/lobby7/south/<i>.png (rest, one arm flung up shooting, both arms up holding on, swinging with his
knees tucked, landed in the crouch, the same lower, rising). PixelLab drew a web splat at his hands in some: it is taken
out (no_splats), the game's own web is drawn here. This script places him (lifting him off the card and swinging him
in), draws the web lines, the splat where one is shot and the landing's dust as pixel art, and writes the finished
frames to FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py.
Usage: python build-spider-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

TOP = 30  # room added over the 180px canvas: the web runs up out of the card
WEB = [(120, 124, 138, 255), (250, 250, 252, 255)]  # its outline, the strand
DUST = [(206, 196, 178, 255), (170, 160, 144, 255)]
# his fists in the poses that hold a web, as fractions of the 180px canvas (read off PixelLab's frames); swinging, the
# web is in his raised left fist (on the right of the card), clear of his head
HANDS = {1: [(0.24, 0.35)], 2: [(0.24, 0.34), (0.77, 0.34)], 3: [(0.79, 0.42)]}
ANCHOR = (0.6, -0.3)  # where the swing's web is stuck, over the card (fractions of the canvas, before TOP)

# (pose or None, x offset, lift, web: None / "shoot" (half way) / "up" / "swing", dust)
FRAMES = [
    (0, 0, 0, None, 0),
    (1, 0, 0, "shoot", 0),
    (1, 0, 0, "up", 0),
    (2, 0, 8, "up", 0),
    (2, 0, 46, "up", 0),
    (2, 0, 104, "up", 0),
    (None, 0, 0, None, 0),
    (3, -48, 58, "swing", 0),
    (3, -28, 28, "swing", 0),
    (3, -10, 9, "swing", 0),
    (4, 0, 0, None, 2),
    (5, 0, 0, None, 1),
    (5, 0, 0, None, 0),
    (5, 0, 0, None, 0),
    (6, 0, 0, None, 0),
    (0, 0, 0, None, 0),
]


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def no_splats(im):
    """Takes out the web splats and grey smudges PixelLab drew at his hands: small patches of white or grey that touch
    the outside (his eyes' whites are much bigger, and ringed in black)."""
    a = np.array(im)
    rgb = a[..., :3].astype(int)
    alpha = a[..., 3] > 0
    grey = alpha & (rgb.max(axis=2) - rgb.min(axis=2) < 40) & (rgb.max(axis=2) > 90)
    outside = ndimage.binary_dilation(~alpha, np.ones((3, 3), bool))
    lab, n = ndimage.label(grey)
    for k in range(1, n + 1):
        part = lab == k
        if part.sum() < 120 and (part & outside).any():
            a[part] = 0
    # what is left of a splat: specks no longer joined to him
    lab, n = ndimage.label(a[..., 3] > 0, np.ones((3, 3), bool))
    sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
    for k, size in enumerate(sizes, 1):
        if size < 40:
            a[lab == k] = 0
    return Image.fromarray(a, "RGBA")


def strand(d, a, b):
    d.line([a, b], fill=WEB[0], width=3)
    d.line([a, b], fill=WEB[1], width=1)


def splat(d, x, y, r):
    """Where a web line hits: a little star of strands."""
    for k in range(6):
        t = k / 6 * 2 * math.pi
        d.line([(x, y), (x + math.cos(t) * r, y + math.sin(t) * r)], fill=WEB[1])
    d.point((x, y), fill=WEB[0])


def main():
    src = Path(sys.argv[1])
    poses = [no_splats(Image.open(src / "lobby7" / "south" / f"{i}.png").convert("RGBA")) for i in range(7)]
    w, h = poses[0].size
    ground = feet(poses[0]) + TOP
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for i, (k, dx, lift, web, dust) in enumerate(FRAMES):
        rng = random.Random(i * 3 + 7)
        im = Image.new("RGBA", (w, h + TOP))
        d = ImageDraw.Draw(im)
        hands = [(x * w + dx, y * h + TOP - lift) for x, y in HANDS.get(k, [])]
        if web == "swing":
            ax, ay = ANCHOR[0] * w, ANCHOR[1] * h + TOP
            for hx, hy in hands:
                strand(d, (hx, hy), (ax, ay))
        if k is not None:
            im.alpha_composite(poses[k], (dx, TOP - lift))
        d = ImageDraw.Draw(im)
        if web in ("shoot", "up"):
            for hx, hy in hands:
                tx = hx - 18 if web == "up" else hx - 9
                ty = 0 if web == "up" else hy - (hy - 0) * 0.5
                strand(d, (hx, hy - 3), (tx, ty))
                if web == "shoot":
                    splat(d, tx, ty, 4)
        if k is None:  # gone: only his web, swinging over the card
            strand(d, (ANCHOR[0] * w, ANCHOR[1] * h + TOP), (w * 0.08, TOP + 56))
        if dust:  # the landing: dust thrown out to both sides and lines of impact
            for side in (-1, 1):
                for j in range(3 + dust):
                    x = w // 2 + side * (26 + j * 9 + rng.randint(0, 4))
                    y = ground - rng.randint(1, 4 + 3 * dust) - j
                    r = rng.randint(3, 5) + (dust - 1)
                    d.ellipse([x - r, y - r, x + r, y + r], fill=DUST[(j + dust) % 2])
            if dust == 2:
                for t in (-2.6, -2.2, -0.95, -0.55):
                    x0, y0 = w // 2 + math.cos(t) * 40, ground - 10 + math.sin(t) * 22
                    d.line([(x0, y0), (x0 + math.cos(t) * 10, y0 + math.sin(t) * 6)], fill=WEB[1], width=2)
        im.save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
