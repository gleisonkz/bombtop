"""Static's lobby animation: he charges sparks between his hands, jumps onto his flying disc (a steel
manhole cover with a violet glow under it) and surfs on it over the ground, crackling, then hops off.

His poses are PixelLab frames ("Static Shock HD v3", animate_with_skeleton_v3 with our own keypoints, feet on the
rest baseline: FRAMES_DIR/lobby14/south/<i>.png); this script lifts him off the ground, draws the disc under his feet,
its shadow, the arcs between disc and ground and the sparks between his hands, as pixel art (no blending), and writes
the finished frames to FRAMES_DIR/lobby/south/<i>.png for build-character-sheet.py.
Usage: python build-static-lobby.py FRAMES_DIR"""
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw

TOP = 40  # room added over the 180px canvas for the lift
LIFT = [0, 0, 0, 14, 26, 22, 26, 28, 30, 28, 26, 24, 26, 12]
# where the disc is, from under his feet (px, + right), or None: flies in from the right, off to the left
DISC_X = [None, None, None, 46, 14, 0, 0, 0, 0, 0, 0, 0, 0, -40]
# his hands in the charging frames (fractions of the 180px canvas, from the keypoints)
HANDS = {1: ((0.44, 0.615), (0.56, 0.615)), 2: ((0.33, 0.61), (0.67, 0.61))}

OUTLINE = (12, 10, 18, 255)
STEEL = [(58, 64, 78, 255), (92, 100, 116, 255), (138, 146, 160, 255), (196, 202, 212, 255)]
VIOLET = [(120, 84, 230, 255), (185, 164, 255, 255), (244, 240, 255, 255)]
SHADOW = (20, 18, 30, 110)


def feet(im):
    return im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()[3]


def ellipse(d, cx, cy, rx, ry, fill):
    d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=fill)


def disc(d, cx, cy, tick):
    """The manhole cover seen from a little above: outlined steel ellipse, a rim, a grid, rivets, glow beneath."""
    ellipse(d, cx, cy + 4, 34, 7, VIOLET[0])  # the glow under it
    ellipse(d, cx, cy + 3, 30, 5, VIOLET[1])
    ellipse(d, cx, cy + 2, 37, 10, OUTLINE)
    ellipse(d, cx, cy + 2, 35, 8, STEEL[0])  # its edge
    ellipse(d, cx, cy, 35, 8, OUTLINE)
    ellipse(d, cx, cy, 34, 7, STEEL[2])
    ellipse(d, cx, cy, 29, 5, STEEL[1])
    for k in range(-3, 4):  # the cast grid
        x = cx + k * 7
        h = 5 * math.sqrt(max(0.0, 1 - (k * 7 / 29) ** 2))
        d.line([(x, cy - h), (x, cy + h)], fill=STEEL[0])
    d.line([(cx - 28, cy), (cx + 28, cy)], fill=STEEL[0])
    for a in range(8):  # rivets round the rim, one glinting
        t = a / 8 * 2 * math.pi + tick * 0.2
        d.point((round(cx + math.cos(t) * 31.5), round(cy + math.sin(t) * 6)), fill=STEEL[3])
    d.line([(cx - 20, cy - 6), (cx + 6, cy - 6)], fill=STEEL[3])  # the light from the top left


def arc(d, x0, y0, x1, y1, rng, width=1):
    """A crackling zigzag from (x0,y0) to (x1,y1), a white core inside a violet glow."""
    n = max(2, round(math.hypot(x1 - x0, y1 - y0) / 5))
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        pts.append((x0 + (x1 - x0) * t + rng.uniform(-3, 3), y0 + (y1 - y0) * t + rng.uniform(-2, 2)))
    pts.append((x1, y1))
    d.line(pts, fill=VIOLET[0], width=width + 4)
    d.line(pts, fill=VIOLET[1], width=width + 2)
    d.line(pts, fill=VIOLET[2], width=width)


def main():
    src = Path(sys.argv[1])
    frames = [Image.open(src / "lobby14" / "south" / f"{i}.png").convert("RGBA") for i in range(len(LIFT))]
    w, h = frames[0].size
    ground = feet(frames[0])  # his feet at rest
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for i, (body, lift, dx) in enumerate(zip(frames, LIFT, DISC_X)):
        rng = random.Random(i * 7 + 3)
        im = Image.new("RGBA", (w, h + TOP))
        d = ImageDraw.Draw(im)
        gy = ground + TOP  # the ground line on the new canvas
        cx = w // 2
        # its shadow on the ground, smaller the higher he flies
        if dx is not None or lift:
            s = 1 - min(lift, 24) / 60
            sx = cx + (dx or 0)
            ellipse(d, sx, gy - 1, 26 * s, 5 * s, SHADOW)
        behind = Image.new("RGBA", im.size)
        bd = ImageDraw.Draw(behind)
        if dx is not None:
            dy = gy - lift - 1 if dx == 0 else gy - lift - 6
            if dx == 0:  # arcs from under the disc down to the ground
                for k in range(4):
                    x0 = cx + rng.randint(-26, 26)
                    arc(bd, x0, dy + 6, x0 + rng.randint(-12, 12), gy - 1, rng)
            disc(bd, cx + dx, dy, i)
        im.alpha_composite(behind)
        im.alpha_composite(body, (0, TOP - lift))
        front = ImageDraw.Draw(im)
        if i in HANDS:
            (ax, ay), (bx, by) = HANDS[i]
            for _ in range(2 + i):
                arc(front, ax * w, ay * h + TOP, bx * w, by * h + TOP, rng)
            for (hx, hy) in HANDS[i]:  # a ball of light in each hand
                ellipse(front, hx * w, hy * h + TOP, 3 + i, 3 + i, VIOLET[1])
                ellipse(front, hx * w, hy * h + TOP, 1 + i, 1 + i, VIOLET[2])
        if i == 5:  # landing on the disc: a burst of bolts out of its rim
            for k in range(8):
                a = k / 8 * 2 * math.pi + 0.3
                x0, y0 = cx + math.cos(a) * 34, gy - lift + math.sin(a) * 8
                arc(front, x0, y0, x0 + math.cos(a) * 16, y0 + math.sin(a) * 10, rng)
        if dx == 0:  # stray sparks round him while he surfs
            for _ in range(3):
                x, y = cx + rng.choice([-1, 1]) * rng.randint(30, 46), gy - lift - rng.randint(16, 80)
                front.line([(x - 3, y), (x + 3, y)], fill=VIOLET[1])
                front.line([(x, y - 3), (x, y + 3)], fill=VIOLET[1])
                front.point((x, y), fill=VIOLET[2])
        # pixel art: no half-transparent edges except the shadow
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if 0 < a < 255 and (r, g, b) != SHADOW[:3]:
                    px[x, y] = (r, g, b, 255 if a >= 128 else 0)
        im.save(out / f"{i}.png")
    print(f"{len(LIFT)} frames -> {out}")


main()
