"""Thor's lobby animation: he raises Mjolnir to the sky, a bolt of lightning comes down onto it, he stands crackling
with it, then swings the hammer down onto the ground: a flash, a shockwave and lightning running out along the
ground, dust and stones thrown up.

His poses are PixelLab frames ("Thor HD", animate_with_skeleton_v3 with our own keypoints, feet on the rest baseline):
FRAMES_DIR/lobby6/south/<i>.png (rest, hammer coming up, hammer raised high, the same in a wide stance) and
FRAMES_DIR/slam4/south/<i>.png (a second try for the slam, the first having torn his cape: rest, hammer out at his
side, swinging down (a blur), struck down crouched, his cape flung out). PixelLab smeared the struck hammer's head
into a grey blob under him, so that frame gets the head out of his rest frame in its place (hammer_head). This script draws the
lightning, glow, shockwave, dust and stones as pixel art and writes the finished frames to FRAMES_DIR/lobby/south/<i>.png
for build-lobby-image.py.
The lightning is cyan and white, out of his sheet's player-color hues (SHEETS.thor.hues, 205-226).
Usage: python build-thor-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

TOP = 40  # room added over the 180px canvas: the bolt comes down from above the card
BOLT = [(30, 150, 220, 255), (90, 215, 250, 255), (255, 255, 255, 255)]  # glow, edge, core (hue ~195-200)
DUST = [(200, 190, 172, 255), (160, 150, 134, 255)]
ROCK = [(110, 98, 86, 255), (150, 136, 118, 255)]
HAMMER_UP = (0.335, 0.17)  # the raised hammer's head, fractions of the 180px canvas (read off PixelLab's frames)
HAMMER_DOWN = (0.30, 0.0)  # the struck hammer's head: x fraction, its foot this far under the ground line (px)

# (pose: ("u", i) lobby6 or ("s", i) slam4, effects)
FRAMES = [
    (("u", 0), ""),
    (("u", 1), ""),
    (("u", 2), "spark"),
    (("u", 2), "strike flash"),
    (("u", 3), "strike crackle glow"),
    (("u", 3), "crackle glow"),
    (("u", 3), "crackle glow"),
    (("s", 1), "crackle"),
    (("s", 2), "smear crackle"),
    (("s", 3), "impact ring1 groundbolts dust2"),
    (("s", 3), "ring2 groundbolts dust1"),
    (("s", 3), "ring3 dust0"),
    (("s", 3), ""),
    (("s", 3), ""),
    (("s", 1), ""),
    (("u", 0), ""),
]


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def zigzag(x0, y0, x1, y1, rng, step=7, jit=4):
    n = max(2, round(math.hypot(x1 - x0, y1 - y0) / step))
    return [(x0, y0)] + [(x0 + (x1 - x0) * i / n + rng.uniform(-jit, jit), y0 + (y1 - y0) * i / n + rng.uniform(-jit / 2, jit / 2))
                         for i in range(1, n)] + [(x1, y1)]


def bolt(d, pts, width=1):
    d.line(pts, fill=BOLT[0], width=width + 4)
    d.line(pts, fill=BOLT[1], width=width + 2)
    d.line(pts, fill=BOLT[2], width=width)


def glow(d, x, y, r):
    for k, c in ((1.0, BOLT[0]), (0.7, BOLT[1]), (0.4, BOLT[2])):
        d.ellipse([x - r * k, y - r * k, x + r * k, y + r * k], fill=c)


CUBE = (63, 119, 85, 142)  # the hammer's head in his rest frame (lobby6/0), on the 180px canvas
WOOD = [(40, 24, 16, 255), (122, 74, 42, 255)]


def cube(rest):
    """The hammer's head out of his rest frame: its silver pixels and the one-pixel dark outline round them."""
    a = np.array(rest.crop(CUBE))
    rgb = a[..., :3].astype(int)
    silver = (a[..., 3] > 0) & (rgb.max(axis=2) - rgb.min(axis=2) < 30) & (rgb.max(axis=2) > 90)
    line = (a[..., 3] > 0) & (rgb.max(axis=2) < 40) & ndimage.binary_dilation(silver, np.ones((3, 3), bool))
    a[~(silver | line)] = 0
    return Image.fromarray(a, "RGBA")


def hammer_head(im, head, cx, foot):
    """The struck frame's hammer: the grey blob PixelLab left under his hand taken out, the head from his rest frame
    standing on the ground in its place, and the handle from his fist down into it."""
    a = np.array(im)
    rgb = a[..., :3].astype(int)
    h, w = a.shape[:2]
    blob = (a[..., 3] > 0) & (rgb.max(axis=2) - rgb.min(axis=2) < 30) & (rgb.max(axis=2) > 70)
    blob[: int(h * 0.76)] = False
    blob[:, int(w * 0.45):] = False
    a[blob] = 0
    a[foot + 1:, : int(w * 0.45)] = 0  # and its dark rim, under the ground line
    out = Image.fromarray(a, "RGBA")
    d = ImageDraw.Draw(out)
    top = foot - head.height
    d.line([(cx, top - 12), (cx, top + 3)], fill=WOOD[0], width=4)
    d.line([(cx, top - 11), (cx, top + 3)], fill=WOOD[1], width=2)
    out.alpha_composite(head, (cx - head.width // 2, top + 1))
    return out


def main():
    src = Path(sys.argv[1])
    up = [Image.open(src / "lobby6" / "south" / f"{i}.png").convert("RGBA") for i in range(4)]
    slam = [Image.open(src / "slam4" / "south" / f"{i}.png").convert("RGBA") for i in range(4)]
    w, h = up[0].size
    base = feet(up[0])
    slam[3] = hammer_head(slam[3], cube(up[0]), round(HAMMER_DOWN[0] * w), base + round(HAMMER_DOWN[1]))
    ground = base + TOP
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    hx, hy = HAMMER_UP[0] * w, HAMMER_UP[1] * h + TOP
    sx = HAMMER_DOWN[0] * w  # the struck hammer
    for i, ((kind, k), fx) in enumerate(FRAMES):
        rng = random.Random(i * 17 + 3)
        body = (up if kind == "u" else slam)[k]
        im = Image.new("RGBA", (w, h + TOP))
        back = ImageDraw.Draw(im)
        if "glow" in fx:  # the hammer full of lightning
            glow(back, hx, hy, 13 + (i % 2) * 3)
        for r in (("ring1", 34, 6), ("ring2", 52, 9), ("ring3", 66, 11)):  # the shockwave along the ground, behind his feet
            if r[0] in fx:
                back.ellipse([sx - r[1], ground - r[2], sx + r[1] + 30, ground + r[2] // 2], outline=BOLT[1], width=2)
        im.alpha_composite(body, (0, TOP))
        d = ImageDraw.Draw(im)
        if "spark" in fx:
            for t in range(4):
                a = t * math.pi / 2 + 0.4
                d.line([(hx, hy), (hx + math.cos(a) * 7, hy + math.sin(a) * 7)], fill=BOLT[2])
        if "strike" in fx:  # the bolt from the sky onto the hammer, a branch off it
            pts = zigzag(hx + 26, 0, hx, hy - 6, rng, 8, 9)
            bolt(d, pts, 2 if "flash" in fx else 1)
            mid = pts[len(pts) // 2]
            bolt(d, zigzag(mid[0], mid[1], mid[0] + 18, mid[1] + 14, rng, 6, 4))
        if "flash" in fx:
            glow(d, hx, hy, 14)
        if "crackle" in fx:  # arcs crackling over him
            for _ in range(3):
                x0, y0 = rng.randint(w // 2 - 36, w // 2 + 36), rng.randint(TOP + 92, ground - 10)  # under his beard
                bolt(d, zigzag(x0, y0, x0 + rng.randint(-16, 16), y0 + rng.randint(-18, 18), rng, 5, 4), 0)
        if "smear" in fx:  # the hammer swung down, a streak behind it
            for k2, c in enumerate((BOLT[1], BOLT[2])):
                d.arc([sx - 30 + k2 * 3, TOP + 40 + k2 * 3, sx + 40 - k2 * 3, ground + 20 - k2 * 3], 180, 260, fill=c, width=3 - k2)
        if "impact" in fx:  # the flash where it struck
            glow(d, sx, ground - 8, 20)
        if "groundbolts" in fx:  # lightning running out along the ground both ways
            for side in (-1, 1):
                ex = sx + side * rng.randint(40, 70) + (30 if side > 0 else 0)
                bolt(d, zigzag(sx, ground - 4, ex, ground - rng.randint(0, 8), rng, 7, 5), 1)
        for lvl in ("dust2", "dust1", "dust0"):
            if lvl in fx:
                n = int(lvl[-1])
                for side in (-1, 1):
                    for j in range(2 + n):
                        x = sx + 6 + side * (22 + j * 10 + (2 - n) * 8)
                        y = ground - rng.randint(2, 6 + 4 * n) - (2 - n) * 6
                        r = 3 + n + rng.randint(0, 2)
                        d.ellipse([x - r, y - r, x + r, y + r], fill=DUST[j % 2])
                if n == 2:  # stones thrown up
                    for _ in range(5):
                        x, y = sx + rng.randint(-30, 40), ground - rng.randint(18, 46)
                        d.rectangle([x, y, x + 2, y + 2], fill=ROCK[rng.randint(0, 1)])
        im.save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
