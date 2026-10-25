"""Naruto's lobby animation: Shadow Clone Jutsu. He makes the hand seal, chakra swirling round his hands, two puffs of
smoke burst beside him and clear on two clones; the three of them strike poses (fist up, thumb up), then the clones
vanish in smoke and he is left giving a thumbs up.

His poses are PixelLab frames ("Naruto HD", animate_with_skeleton_v3 with our own keypoints, feet on the rest baseline):
FRAMES_DIR/lobby6/south/<i>.png (rest, hands coming together, the seal in a wide stance, fist pumped up with a hand on
his hip, thumb up with a hand on his hip, the seal again). The clones are the same poses beside him (the one on the
left mirrored, so both strike outward), a little behind; this script places them and draws the smoke and the chakra
as pixel art, and writes the finished frames to FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py.
The smoke is grey and the chakra cyan, out of his sheet's player-color hues (SHEETS.naruto.hues, 205-232).
Usage: python build-naruto-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

SIDE = 56  # how far beside him the clones stand
BACK = 6  # how much higher (further back) they stand
PAD = 60  # room added at each side of the 180px canvas
SMOKE = [(96, 98, 112), (198, 200, 208), (236, 237, 240), (255, 255, 255)]  # outline, shade, fill, light
CHAKRA = [(40, 190, 235, 255), (190, 245, 255, 255)]

# (his pose, clones' pose or None, smoke at the clones: None / "pop" / "big" / "thin" / "wisp", chakra)
FRAMES = [
    (0, None, None, False),
    (1, None, None, False),
    (2, None, None, True),
    (5, None, "pop", True),
    (2, None, "big", False),
    (2, 2, "thin", False),
    (2, 2, "wisp", False),
    (3, 4, None, False),
    (3, 4, None, False),
    (4, 3, None, False),
    (4, 3, None, False),
    (4, None, "big", False),
    (4, None, "thin", False),
    (4, None, "wisp", False),
    (0, None, None, False),
    (0, None, None, False),
]


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def puff(shape, cx, base, stage, rng):
    """A cartoon smoke cloud standing on `base`, centered on cx, as an RGBA array (no blending but its fading stages)."""
    h, w = shape
    y, x = np.ogrid[:h, :w]
    circles = []
    if stage == "pop":
        circles = [(cx, base - 60, 16), (cx - 10, base - 50, 11), (cx + 11, base - 52, 12), (cx, base - 74, 10)]
    elif stage == "big":
        for k in range(9):
            a = k / 9 * 2 * math.pi + rng.uniform(-0.2, 0.2)
            circles.append((cx + math.cos(a) * 26, base - 62 + math.sin(a) * 44, rng.uniform(15, 21)))
        circles.append((cx, base - 62, 30))
    elif stage == "thin":  # a smaller cloud, drifting off upward
        for k in range(6):
            a = k / 6 * 2 * math.pi + 0.4
            circles.append((cx + math.cos(a) * 17, base - 86 + math.sin(a) * 26, rng.uniform(11, 14)))
        circles.append((cx, base - 86, 16))
    elif stage == "wisp":  # its last little puff, high up
        circles = [(cx - 6, base - 116, 7), (cx + 5, base - 118, 8), (cx, base - 125, 6)]
    mask = np.zeros(shape, bool)
    shade = np.zeros(shape, bool)
    light = np.zeros(shape, bool)
    for (px, py, r) in circles:
        c = (x - px) ** 2 + (y - py) ** 2 <= r * r
        mask |= c
        shade |= c & ((x - px + r * 0.3) ** 2 + (y - py + r * 0.45) ** 2 > (r * 0.95) ** 2)
        light |= (x - px + r * 0.35) ** 2 + (y - py + r * 0.35) ** 2 <= (r * 0.3) ** 2
    out = np.zeros((h, w, 4), np.uint8)
    alpha = {"pop": 255, "big": 255, "thin": 230, "wisp": 200}[stage]
    out[mask] = (*SMOKE[2], alpha)
    out[mask & shade] = (*SMOKE[1], alpha)
    out[mask & light & ~shade] = (*SMOKE[3], alpha)
    ring = ndimage.binary_dilation(mask, np.ones((3, 3), bool)) & ~mask
    out[ring] = (*SMOKE[0], alpha)
    # inner outlines where one round lobe overlaps another: the outline of each circle's lower right inside the cloud
    return out


def chakra(d, cx, cy, i):
    """A swirl of chakra round his sealed hands: short arcs and sparks."""
    for k in range(4):
        a0 = k * math.pi / 2 + i * 0.9
        r = 14 + 3 * (k % 2)
        pts = [(cx + math.cos(a0 + t * 0.25) * r, cy + math.sin(a0 + t * 0.25) * r * 0.7) for t in range(5)]
        d.line(pts, fill=CHAKRA[0], width=2)
        d.point((round(pts[-1][0]), round(pts[-1][1])), fill=CHAKRA[1])


def main():
    src = Path(sys.argv[1])
    poses = [Image.open(src / "lobby6" / "south" / f"{i}.png").convert("RGBA") for i in range(6)]
    w, h = poses[0].size
    ground = feet(poses[0])
    W = w + 2 * PAD
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for i, (me, clones, smoke, glow) in enumerate(FRAMES):
        rng = random.Random(i * 5 + 2)
        im = Image.new("RGBA", (W, h))
        if clones is not None:
            left, right = ImageOps.mirror(poses[clones]), poses[clones]
            im.alpha_composite(left, (PAD - SIDE, -BACK))
            im.alpha_composite(right, (PAD + SIDE, -BACK))
        body = poses[me]
        if i in (8, 10):  # a little bounce in the pose
            body = body.crop((0, 0, w, h - 1))
            im.alpha_composite(body, (PAD, 1))
        else:
            im.alpha_composite(body, (PAD, 0))
        if smoke:
            for cx in (W // 2 - SIDE, W // 2 + SIDE):
                layer = Image.fromarray(puff((h, W), cx, ground - BACK + 2, smoke, rng), "RGBA")
                im.alpha_composite(layer)
        if glow:
            chakra(ImageDraw.Draw(im), W // 2, round(h * 0.57), i)
        im.save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
