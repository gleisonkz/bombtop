"""Harry's lobby and victory animations.

Lobby: he raises his wand, its tip lighting up, swirls it overhead leaving a silver trail, thrusts it out in a burst of
mist, and his patronus, the silver stag, bounds out and gallops once round him (behind him at the back of its loop),
then bursts into sparkles that drift up as he lowers the wand.
Victory: he jumps for joy and snatches the golden snitch out of the air: it flits in, is caught in his raised fist, and
its wings keep fluttering out of it.

His poses are PixelLab frames ("Harry Potter HD v3b"): FRAMES_DIR/lobby8/south/<i>.png (the wand raised and swirled,
posed from our own skeletons), his spell's thrust (FRAMES_DIR/cast/south), FRAMES_DIR/victory9/south/<i>.png (a jump, a
fist raised with nothing in it; a v3 animation) and his rotation (FRAMES_DIR/../rot/south.png). The stag galloping is
FRAMES_DIR/../stag/side (build-patronus.py's source); the wand's light, the trail, the mist, the sparkles and the snitch
are drawn here as pixel art. Writes FRAMES_DIR/lobby/south/<i>.png and FRAMES_DIR/victory/south/<i>.png for
build-lobby-image.py (one canvas each, his feet on one ground line).
Usage: python build-harry-lobby.py FRAMES_DIR"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
KP = Path("E:/Projetos/bombtop-src/harry/kp")  # our own skeletons (make.py), for where the wand's tip is
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


def over(a, b):
    """b drawn over a (both float RGBA arrays)."""
    ab = b[..., 3:4] / 255
    out = a.copy()
    out[..., :3] = b[..., :3] * ab + a[..., :3] * (1 - ab)
    out[..., 3] = np.maximum(a[..., 3], b[..., 3])
    return out


def draw_stag(a, x, y, behind, leftward, frame, alpha):
    """A gallop frame of the stag with its feet at (x,y), facing the way it runs; smaller behind him (farther off)."""
    im = frame.transpose(Image.FLIP_LEFT_RIGHT) if leftward else frame
    if behind:
        im = im.resize((im.width * 4 // 5, im.height * 4 // 5), Image.NEAREST)
    stag_on(a, im, x, y, alpha)


def orb(a, x, y, r, alpha=1.0):
    """A glowing ball of light: a pale blue halo round a white core."""
    for dy in range(-int(r * 2.2), int(r * 2.2) + 1):
        for dx in range(-int(r * 2.2), int(r * 2.2) + 1):
            d = math.hypot(dx, dy)
            if d <= r * 0.55:
                put(a, x + dx, y + dy, (255, 255, 255), int(255 * alpha))
            elif d <= r:
                put(a, x + dx, y + dy, (200, 236, 255), int(240 * alpha))
            elif d <= r * 2.2:
                put(a, x + dx, y + dy, (150, 210, 255), int(110 * alpha * (1 - (d - r) / (r * 1.2))))


def ribbon(a, pts, alpha=1.0):
    """A thick silver trail through `pts` (newest last), fading toward its oldest end."""
    for k in range(1, len(pts)):
        (x0, y0), (x1, y1) = pts[k - 1], pts[k]
        f = k / (len(pts) - 1)
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for s in range(steps + 1):
            x, y = x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps
            put(a, x, y, (255, 255, 255), int(255 * alpha * f))
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(a, x + ox, y + oy, (180, 225, 255), int(200 * alpha * f))


def wand_tip(im):
    """The wand's tip: its topmost dark-red pixel above his collar (the wand raised)."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    wood = (al > 0) & (r > 90) & (r < 150) & (g < 50) & (b < 45)
    ys, xs = np.nonzero(wood)
    if not len(ys):
        return None
    top = ys.min()
    return float(xs[ys == top].mean()), float(top) - 1


def hand(im):
    """His wand hand thrust out: the middle of the skin right of his face, below it."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (al > 0) & (r > 200) & (g > 150) & (b > 120) & (r > b + 25)
    ys, xs = np.nonzero(skin)
    if not len(ys):
        return None
    face_bottom = ys.min() + (ys.max() - ys.min()) * 0.45
    sel = (ys > face_bottom) & (xs > MID)
    if not sel.any():
        return None
    return float(xs[sel].mean()), float(ys[sel].min()) - 4


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

    # lobby: the wand raised, its tip lit, swirled overhead leaving a silver trail (0-4); thrust out in a burst of mist
    # (5); the stag bounds out of it and gallops once round him, behind him at the back of the loop (6-12); it bursts
    # into sparkles drifting up as he lowers the wand (13-15)
    raise_ = lambda i: Image.open(src / "lobby8" / "south" / f"{i}.png").convert("RGBA")
    thrust = lambda i: Image.open(src / "cast" / "south" / f"{i}.png").convert("RGBA")
    gallop = [Image.open(src.parent / "stag" / "side" / f"{i}.png").convert("RGBA") for i in range(1, 9)]
    gallop = [g.resize((g.width * 6 // 5, g.height * 6 // 5), Image.NEAREST) for g in gallop]
    rg, rm = feet(raise_(0)), body_middle(raise_(0))
    tg, tm = feet(thrust(0)), body_middle(thrust(0))
    restg, restm = feet(rest), body_middle(rest)
    pose = [("r", 0), ("r", 1), ("r", 2), ("r", 3), ("r", 4), ("t", 3), ("t", 4), ("t", 5), ("t", 6), ("t", 7), ("t", 6), ("t", 5), ("t", 4),
            ("rest", 0), ("rest", 0), ("r", 0)]
    keys = {"r": json.load(open(KP / "lobby-south.json"))["frames"], "t": json.load(open(KP / "cast-south.json"))["frames"]}
    def tip_of(kind, i):
        """The wand's tip in pose `i` (raise or thrust), from our skeleton: on along his forearm past the hand."""
        k = {q["label"]: (q["x"] * 180, q["y"] * 180) for q in keys[kind][i]}
        (ex, ey), (wx, wy) = k["LEFT ELBOW"], k["LEFT ARM"]
        n = math.hypot(wx - ex, wy - ey) or 1
        g, m = (rg, rm) if kind == "r" else (tg, tm)
        reach = 14 if kind == "r" else 9
        return (MID - m + wx + (wx - ex) / n * reach, GROUND - g + wy + (wy - ey) / n * reach)
    frames = []
    for n, (k, i) in enumerate(pose):
        hero = place(raise_(i), rg, rm) if k == "r" else place(thrust(i), tg, tm) if k == "t" else place(rest, restg, restm)
        tip = tip_of(k, i) if (k == "r" and n > 0) or k == "t" else None
        a = np.zeros((H, W, 4))
        stag_at = None
        if 6 <= n <= 12:
            th = 0.25 - (n - 6) / 7 * 2 * math.pi  # once round, starting front-right, going behind him first
            sx, sy = MID + 92 * math.cos(th), GROUND + 4 + 16 * math.sin(th)
            behind = math.sin(th) < 0
            leftward = math.sin(th) > 0  # in front it runs left, behind it runs right
            stag_at = (sx, sy, behind, leftward, gallop[n % 8])
        if stag_at and stag_at[2]:
            draw_stag(a, *stag_at, alpha=0.7)
        a = over(a, np.array(hero).astype(float))
        if stag_at and not stag_at[2]:
            draw_stag(a, *stag_at, alpha=0.95)
        if 2 <= n <= 4 and tip:  # the swirl overhead: an arc of light round above his head, growing
            cx, cy, R = tip[0] - 18, tip[1] - 6, 24
            sweep = [(cx + R * math.cos(-math.pi * 0.1 - u * (n - 1) * 0.75), cy + R * 0.55 * math.sin(-math.pi * 0.1 - u * (n - 1) * 0.75)) for u in np.linspace(0, 1, 14)]
            ribbon(a, sweep[::-1], 0.95)
        if tip and n <= 12:
            orb(a, tip[0], tip[1], 2.2 + min(n, 5) * 0.5 + (1.5 if n == 5 else 0))
        if n == 5 and tip:  # the burst of silver mist the stag comes out of
            for k2 in range(14):
                ang = k2 / 14 * 2 * math.pi
                sparkle(a, tip[0] + math.cos(ang) * 14, tip[1] + math.sin(ang) * 8, 2, 220)
        if n >= 13:  # what is left of it, drifting up and fading
            fade = 1 - (n - 12) / 4
            for k2 in range(9):
                sparkle(a, MID - 100 + k2 * 25, GROUND - 20 - (k2 * 17) % 50 - (n - 12) * 8, 1 + k2 % 2, int(255 * fade))
        frames.append(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"))
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
