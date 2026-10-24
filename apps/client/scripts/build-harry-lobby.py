"""Harry's lobby and victory animations.

Lobby: he swirls his wand overhead (PixelLab's own trails of light round it), points it out and shouts the spell, and
his patronus, the silver stag, bounds across the card in front of him leaving sparkles, which fade as he lowers it.
Victory: he jumps for joy and snatches the golden snitch out of the air: it flits in, is caught in his raised fist, and
its wings keep fluttering out of it.

His poses are PixelLab frames ("Harry Potter HD v3b", v3 animations): FRAMES_DIR/lobby9/south/<i>.png (wand swirl)
and FRAMES_DIR/victory9/south/<i>.png (a jump, a fist raised with nothing in it), plus his rotation
(FRAMES_DIR/../rot/south.png). The stag is public/sprites/patronus.png (build-patronus.py); the snitch and sparkles are
drawn here as pixel art. Writes FRAMES_DIR/lobby/south/<i>.png and FRAMES_DIR/victory/south/<i>.png for
build-lobby-image.py (one canvas each, his feet on one ground line).
Usage: python build-harry-lobby.py FRAMES_DIR"""
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
W, H = 300, 240
GROUND = 226
MID = W // 2
SPARK = [(255, 255, 255), (200, 236, 255), (150, 210, 255)]
GOLD = [(120, 80, 10), (230, 180, 40), (255, 230, 120), (255, 255, 230)]  # outline, body, light, shine
WING = [(150, 150, 160), (240, 240, 245)]


def feet(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def put(a, x, y, c, alpha=255):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < a.shape[1] and 0 <= y < a.shape[0] and alpha > 0:
        if a[y, x, 3] == 0 or alpha >= 255:
            a[y, x] = (*c, alpha)
        else:
            k = alpha / 255
            a[y, x, :3] = (1 - k) * a[y, x, :3] + k * np.array(c)
            a[y, x, 3] = max(a[y, x, 3], alpha)


def sparkle(a, x, y, size, alpha=255):
    put(a, x, y, SPARK[0], alpha)
    for d in range(1, size + 1):
        c = SPARK[min(d, 2)]
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            put(a, x + dx, y + dy, c, int(alpha * (1 - d / (size + 1))))


def snitch(a, x, y, flap):
    """The golden snitch at (x,y): a little gold ball, its silver wings up or down (`flap`)."""
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            r = math.hypot(dx, dy)
            if r <= 3.2:
                c = GOLD[0] if r > 2.4 else GOLD[2] if dx + dy < -1 else GOLD[1]
                put(a, x + dx, y + dy, c)
    put(a, x - 1, y - 1, GOLD[3])
    lift = -3 if flap else 2
    for s in (-1, 1):
        for k in range(1, 7):
            yy = y - 1 + lift * k / 6
            put(a, x + s * (3 + k), yy, WING[1])
            put(a, x + s * (3 + k), yy + 1, WING[0])


def stag_on(a, stag, x, y, alpha):
    """The stag with its feet at (x,y), added as light."""
    s = np.array(stag).astype(float)
    h, w = s.shape[:2]
    x0, y0 = int(x - w / 2), int(y - h * 0.88)
    for yy in range(h):
        for xx in range(w):
            al = s[yy, xx, 3] * alpha
            if al < 8:
                continue
            put(a, x0 + xx, y0 + yy, tuple(int(v) for v in s[yy, xx, :3]), int(min(255, al)))


def place(im, ground, middle, dx=0, dy=0):
    canvas = Image.new("RGBA", (W, H))
    canvas.paste(im, (round(MID + dx - middle), GROUND - ground + dy), im)
    return canvas


def main():
    src = Path(sys.argv[1])
    lobby = lambda i: Image.open(src / "lobby9" / "south" / f"{i}.png").convert("RGBA")
    victory = lambda i: Image.open(src / "victory9" / "south" / f"{i}.png").convert("RGBA")
    rest = Image.open(src.parent / "rot" / "south.png").convert("RGBA")
    stag = Image.open(HERE.parent / "public" / "sprites" / "patronus.png").convert("RGBA")
    stag = stag.resize((stag.width * 6 // 5, stag.height * 6 // 5), Image.NEAREST)  # about his height

    # lobby: swirl (0-4), the shout held while the stag bounds across in front of him (5-12), the wand lowered (13-15)
    lg, lm = feet(lobby(0)), body_middle(lobby(0))
    rg, rm = feet(rest), body_middle(rest)
    frames = []
    for n in range(16):
        if n < 5:
            im = place(lobby(n), lg, lm)
        elif n < 13:
            im = place(lobby(8), lg, lm)
        else:
            im = place(rest, rg, rm)
        a = np.array(im).astype(float)
        if 5 <= n < 13:
            t = (n - 5) / 7
            sx = -40 + t * (W + 80)
            sy = GROUND + 6 - abs(math.sin(t * math.pi * 3)) * 18
            for k in range(1, 6):  # its trail
                tt = t - k * 0.035
                sparkle(a, -40 + tt * (W + 80) - 6, GROUND - 8 - abs(math.sin(tt * math.pi * 3)) * 18 + (k % 3) * 4, 2 if k < 3 else 1, int(255 * (1 - k / 6)))
            stag_on(a, stag, sx, sy, 0.95)
        if n >= 13:  # the light it left, fading
            fade = 1 - (n - 12) / 4
            for k in range(7):
                sparkle(a, 40 + k * 36, GROUND - 30 - (k * 13) % 40 - (n - 12) * 4, 1 + k % 2, int(255 * fade))
        frames.append(Image.fromarray(a.astype(np.uint8), "RGBA"))
    write(src / "lobby" / "south", frames)

    # victory: the jump (0-3) with the snitch flitting in from the top right, caught (4), then held up, wings fluttering
    vg, vm = feet(victory(0)), body_middle(victory(0))
    order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 8, 7, 8, 7, 8, 8]
    frames = []
    for n, i in enumerate(order):
        im = place(victory(i), vg, vm)
        a = np.array(im).astype(float)
        fist = raised_fist(im)
        if n < 4:
            t = n / 4
            fx, fy = raised_fist(place(victory(4), vg, vm))
            x = W - 30 + (fx - (W - 30)) * t + math.sin(t * 9) * 10
            y = 30 + (fy - 30) * t
            snitch(a, x, y, n % 2 == 0)
            sparkle(a, x + 9, y - 3, 1, 200)
        elif fist:
            snitch(a, fist[0], fist[1] - 4, n % 2 == 0)
            if n % 3 == 0:
                sparkle(a, fist[0] + 8, fist[1] - 10, 2, 230)
        frames.append(Image.fromarray(a.astype(np.uint8), "RGBA"))
    write(src / "victory" / "south", frames)


def raised_fist(im):
    """The top of the highest skin blob on the left half (his free hand, raised): where the snitch sits."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (al > 0) & (r > 200) & (g > 150) & (b > 120) & (r > b + 25)
    skin[:, MID - 26:] = False  # off his face
    ys, xs = np.nonzero(skin)
    if not len(ys):
        return None
    top = ys.min()
    row = xs[ys <= top + 2]
    return (row.min() + row.max()) / 2, top


def write(out, frames):
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    for n, im in enumerate(frames):
        im.save(out / f"{n}.png")
    print(f"{len(frames)} frames -> {out}")


if __name__ == "__main__":
    main()
