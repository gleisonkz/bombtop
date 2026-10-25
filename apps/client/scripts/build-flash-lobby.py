"""The flash's lobby animation: he crouches crackling with the Speed Force, vanishes in a flash of light, streaks across
the card one way and back the other (afterimages trailing him, speed lines, a bolt), skids to a stop and gives a thumbs up.

His poses are PixelLab frames ("Flash HD", animate_with_skeleton_v3 with our own keypoints, feet on the rest baseline):
FRAMES_DIR/lobby6/south/<i>.png (rest, crouched ready, skidding hard, skidding less, hands on hips, thumbs up) and
FRAMES_DIR/lobby5/east/<i>.png (four sprint frames, a skid). This script places them, adds the afterimages, sparks,
speed lines and dust as pixel art, and writes the finished frames to FRAMES_DIR/lobby/south/<i>.png for
build-character-sheet.py.
Usage: python build-flash-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

YELLOW = [(255, 214, 40, 255), (255, 244, 170, 255), (255, 255, 255, 255)]
RED = (226, 46, 40, 255)
DUST = [(214, 200, 176, 255), (176, 160, 136, 255)]

# (pose, x offset, afterimages trailing it: [(dx, alpha)]); pose = ("s", i) south pose, ("e", i) sprint east,
# ("w", i) the sprint mirrored, or None (gone, only the streak left)
FRAMES = [
    (("s", 0), 0, []),
    (("s", 1), 0, []),
    (("s", 1), 0, [(-4, 110), (4, 110)]),  # vibrating
    (None, 0, []),  # vanished in a flash
    (None, 0, []),
    (("e", 0), -72, [(-22, 120), (-44, 60)]),
    (("e", 1), -26, [(-22, 120), (-44, 60)]),
    (("e", 2), 20, [(-22, 120), (-44, 60)]),
    (("e", 3), 66, [(-22, 120), (-44, 60)]),
    (None, 0, []),
    (("w", 0), 72, [(22, 120), (44, 60)]),
    (("w", 1), 26, [(22, 120), (44, 60)]),
    (("s", 2), 0, [(18, 120), (36, 60)]),  # skidding in from the right
    (("s", 3), 0, []),
    (("s", 4), 0, []),
    (("s", 5), 0, []),
]


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def ghost(im, alpha):
    """An afterimage: the body flattened to red and yellow, see-through."""
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if a > 128:
                dst[x, y] = (YELLOW[0] if g > 150 and r > 200 else RED)[:3] + (alpha,)
    return out


def bolt(d, x0, y0, x1, y1, rng, width=1):
    n = max(2, round(math.hypot(x1 - x0, y1 - y0) / 6))
    pts = [(x0, y0)] + [(x0 + (x1 - x0) * i / n + rng.uniform(-2, 2), y0 + (y1 - y0) * i / n + rng.uniform(-3, 3)) for i in range(1, n)] + [(x1, y1)]
    d.line(pts, fill=YELLOW[0], width=width + 2)
    d.line(pts, fill=YELLOW[2], width=width)


def speed_lines(d, w, y_mid, rng, x_from, x_to, n=6):
    for k in range(n):
        y = y_mid + rng.randint(-34, 34)
        a, b = sorted((x_from + rng.randint(-10, 10), x_to + rng.randint(-10, 10)))
        d.line([(a, y), (b, y)], fill=RED if k % 2 else YELLOW[0], width=2)


def main():
    src = Path(sys.argv[1])
    south = [Image.open(src / "lobby6" / "south" / f"{i}.png").convert("RGBA") for i in range(6)]
    east = [Image.open(src / "lobby5" / "east" / f"{i}.png").convert("RGBA") for i in range(5)]
    w, h = south[0].size
    ground = feet(south[0])
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for i, (pose, dx, trail) in enumerate(FRAMES):
        rng = random.Random(i * 11 + 5)
        im = Image.new("RGBA", (w, h))
        d = ImageDraw.Draw(im)
        mid = ground - 50  # the middle of his body
        body = None
        if pose:
            kind, k = pose
            body = south[k] if kind == "s" else east[k] if kind == "e" else ImageOps.mirror(east[k])
            body_y = ground - feet(body)  # every pose's feet on the same ground
        if pose and pose[0] in "ew":  # speed lines behind him as he streaks across
            back = -1 if pose[0] == "e" else 1
            speed_lines(d, w, mid, rng, w // 2 + dx + back * 20, w // 2 + dx + back * 110)
        if i in (3, 4, 9):  # gone: a bolt and speed lines right across the card
            speed_lines(d, w, mid, rng, 0, w, n=8 if i != 4 else 5)
            bolt(d, 0, mid + rng.randint(-10, 10), w, mid + rng.randint(-10, 10), rng, 2)
        if i == 3:  # the flash of light where he stood
            for r, c in ((26, YELLOW[0]), (18, YELLOW[1]), (10, YELLOW[2])):
                d.ellipse([w // 2 - r, mid - r, w // 2 + r, mid + r], fill=c)
        for tdx, a in trail:
            im.alpha_composite(ghost(body, a), (dx + tdx, body_y))
        if body is not None:
            im.alpha_composite(body, (dx, body_y))
        d = ImageDraw.Draw(im)
        if i in (1, 2):  # the Speed Force crackling round him
            for _ in range(2 + i):
                a = rng.uniform(0, 2 * math.pi)
                x0, y0 = w // 2 + math.cos(a) * 30, mid + math.sin(a) * 40
                bolt(d, x0, y0, x0 + rng.randint(-12, 12), y0 + rng.randint(-12, 12), rng)
        if i in (12, 13):  # dust kicked up by the skid
            for _ in range(5 if i == 12 else 3):
                x, y, r = w // 2 + rng.randint(-10, 40), ground - rng.randint(0, 8), rng.randint(3, 6)
                d.ellipse([x - r, y - r, x + r, y + r], fill=DUST[rng.randint(0, 1)])
        if i == 15:  # a glint off the thumbs up
            gx, gy = int(w * 0.70), int(h * 0.42)
            d.line([(gx - 5, gy), (gx + 5, gy)], fill=YELLOW[2])
            d.line([(gx, gy - 5), (gx, gy + 5)], fill=YELLOW[2])
            d.point((gx, gy), fill=YELLOW[0])
        im.save(out / f"{i}.png")
    print(f"{len(FRAMES)} frames -> {out}")


main()
