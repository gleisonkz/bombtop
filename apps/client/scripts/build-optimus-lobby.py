"""Optimus's lobby animation: his eyes flare, he crouches glowing blue and bursts into plates and sparks, his truck
drives off the card in a rush of speed lines and exhaust, swings back in from the other side and brakes in a cloud of
dust, bursts back into him, and he rises with his fist raised high, the Matrix shining in his chest.

His poses are PixelLab frames ("Optimus Prime HD"): his rotation (FRAMES_DIR/../rot/south.png), the crouching template
(FRAMES_DIR/crouch/south/<i>.png) and the fist raised from our own skeletons (FRAMES_DIR/fist/south/<i>.png); the truck
is the side row of public/sprites/truck.png (build-truck.py), its wheels turning. Writes FRAMES_DIR/lobby/south/<i>.png for
build-lobby-image.py.
Usage: python build-optimus-lobby.py FRAMES_DIR"""
import math, sys
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 320, 212
GROUND = 196
MID = W // 2
BLUE = [(220, 245, 255), (127, 208, 255), (58, 160, 255)]
PLATES = [(216, 38, 46), (36, 86, 200), (200, 204, 214), (138, 144, 153)]
DUST = (196, 176, 140)
EXHAUST = (140, 140, 150)


def feet(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def matrix(fx, x, y, r):
    """The Matrix of Leadership shining in his chest: a blue halo round a white core."""
    d = ImageDraw.Draw(fx)
    glow(fx, x, y, r * 2.2, BLUE[1], 255)
    d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8], fill=(*BLUE[0], 200))
    d.ellipse([x - r * 0.45, y - r * 0.4, x + r * 0.45, y + r * 0.4], fill=(255, 255, 255, 240))


def glow(fx, x, y, r, color, alpha):
    """A soft round glow: rings fading out from its middle."""
    d = ImageDraw.Draw(fx)
    for k in range(6, 0, -1):
        rr = r * k / 6
        d.ellipse([x - rr, y - rr * 0.9, x + rr, y + rr * 0.9], fill=(*color, int(alpha * (1 - k / 7) * 0.5)))


def sparkle(fx, x, y, size, alpha=255):
    d = ImageDraw.Draw(fx)
    d.line([x - size, y, x + size, y], fill=(*BLUE[0], alpha))
    d.line([x, y - size, x, y + size], fill=(*BLUE[0], alpha))
    d.point((x, y), fill=(255, 255, 255, alpha))


def burst(fx, x, y, t, seed=0):
    """Plates and sparks flying out from (x,y), `t` (0..1) of the way."""
    d = ImageDraw.Draw(fx)
    for k in range(22):
        a = k / 22 * math.tau + seed + (k % 3) * 0.3
        r = 12 + t * (60 + (k * 17) % 40)
        px, py = x + math.cos(a) * r, y + math.sin(a) * r * 0.7 + t * t * 30
        s = 2 + (k % 3)
        c = PLATES[k % len(PLATES)]
        d.rectangle([px - s, py - s * 0.7, px + s, py + s * 0.7], fill=(*c, int(255 * (1 - t * 0.6))), outline=(20, 20, 30, int(255 * (1 - t * 0.6))))
    for k in range(14):
        a = k / 14 * math.tau + seed * 2
        r0, r1 = 8 + t * 50, 18 + t * 70
        d.line([x + math.cos(a) * r0, y + math.sin(a) * r0 * 0.8, x + math.cos(a) * r1, y + math.sin(a) * r1 * 0.8], fill=(*BLUE[k % 3], int(255 * (1 - t))), width=2)


def flash(fx, x, y, r, alpha):
    glow(fx, x, y, r, (255, 255, 255), alpha)
    glow(fx, x, y, r * 0.5, BLUE[0], alpha)


def speed_lines(fx, x, y, back, n=5, alpha=200):
    """Lines streaming behind something moving toward +x (`back` = which way behind is)."""
    d = ImageDraw.Draw(fx)
    for k in range(n):
        yy = y - 10 - k * 13
        x0 = x + back * (6 + (k * 11) % 20)
        d.line([x0, yy, x0 + back * (30 + (k * 23) % 30), yy], fill=(255, 255, 255, alpha), width=2)


def puff(fx, x, y, r, color, alpha):
    d = ImageDraw.Draw(fx)
    for k, (ox, oy) in enumerate(((0, 0), (-r * 0.7, r * 0.3), (r * 0.7, r * 0.2), (0, -r * 0.5))):
        rr = r * (0.8 + 0.1 * k)
        d.ellipse([x + ox - rr, y + oy - rr, x + ox + rr, y + oy + rr], fill=(*color, alpha))


def main():
    src = Path(sys.argv[1])
    rest = Image.open(src.parent / "rot" / "south.png").convert("RGBA")
    crouch = lambda i: Image.open(src / "crouch" / "south" / f"{i}.png").convert("RGBA")
    fist = lambda i: Image.open(src / "fist" / "south" / f"{i}.png").convert("RGBA")
    sheet = Image.open(Path(__file__).resolve().parent.parent / "public" / "sprites" / "truck.png").convert("RGBA")
    wheels = []
    for f in range(4):
        cell = sheet.crop((f * 128, 0, f * 128 + 128, 96))
        cell = cell.crop(cell.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())
        wheels.append(cell.resize((cell.width * 2, cell.height * 2), Image.NEAREST))
    truck = wheels[0]
    spin = iter(range(1000))
    ground, middle = feet(rest), body_middle(rest)
    # where his chest (the Matrix) and eyes are on a standing frame (fitted on his rotation)
    chest = (MID + 94 - middle, GROUND - (ground - 96))
    eyes = [(MID + 79 - middle, GROUND - (ground - 50)), (MID + 106 - middle, GROUND - (ground - 50))]
    body = (MID, GROUND - 70)

    def robot(im):
        canvas = Image.new("RGBA", (W, H))
        canvas.paste(im, (round(MID - body_middle(im)), GROUND - feet(im)), im)
        return canvas

    def truck_at(x):
        canvas = Image.new("RGBA", (W, H))
        im = wheels[next(spin) % 4]
        canvas.paste(im, (round(x - im.width / 2), GROUND - im.height + 2), im)
        return canvas

    frames = []

    def frame(base, *effects, under=()):
        fx_under = Image.new("RGBA", (W, H))
        for e in under:
            e(fx_under)
        fx = Image.new("RGBA", (W, H))
        for e in effects:
            e(fx)
        out = Image.new("RGBA", (W, H))
        out.alpha_composite(fx_under)
        out.alpha_composite(base)
        out.alpha_composite(fx)
        frames.append(out)

    # 0-1: standing, his eyes flare
    frame(robot(rest))
    frame(robot(rest), lambda f: [sparkle(f, x, y, 4) for x, y in eyes], under=[lambda f: glow(f, *body, 40, BLUE[1], 120)])
    # 2-4: down into a crouch, the energon glow swelling, sparks crackling
    for n, i in enumerate((1, 2, 3)):
        frame(robot(crouch(i)), lambda f, n=n: [sparkle(f, MID + math.cos(k * 2.1 + n) * (30 + n * 8), GROUND - 50 + math.sin(k * 1.7 + n) * 30, 3) for k in range(3 + n)],
              under=[lambda f, n=n: glow(f, MID, GROUND - 50, 46 + n * 14, BLUE[1], 140 + n * 30)])
    # 5: he bursts into plates and sparks, his truck in his place
    frame(truck_at(MID), lambda f: burst(f, MID, GROUND - 50, 0.25), lambda f: flash(f, MID, GROUND - 50, 70, 200))
    frame(truck_at(MID + 6), lambda f: burst(f, MID, GROUND - 50, 0.6), lambda f: flash(f, MID, GROUND - 50, 50, 90))
    # 7-8: off it drives, out of the card to the right, speed lines and exhaust behind it
    for n, x in enumerate((MID + 50, MID + 140)):
        frame(truck_at(x), lambda f, x=x: speed_lines(f, x - truck.width / 2, GROUND, -1),
              under=[lambda f, x=x, n=n: [puff(f, x - truck.width / 2 - 14 - k * 16, GROUND - 60 - k * 6, 5 + k * 2, EXHAUST, 150 - k * 40) for k in range(3)]])
    # 9-11: back in from the left, braking hard in a cloud of dust
    frame(truck_at(MID - 190), lambda f: speed_lines(f, MID - 190 - truck.width / 2, GROUND, -1))
    frame(truck_at(MID - 90), lambda f: speed_lines(f, MID - 90 - truck.width / 2, GROUND, -1))
    frame(truck_at(MID - 8), under=[lambda f: [puff(f, MID - truck.width / 2 + 10 - k * 18, GROUND - 6 - k * 3, 8 + k * 3, DUST, 170 - k * 40) for k in range(4)]])
    # 12: he bursts back out of the truck, crouched
    frame(robot(crouch(3)), lambda f: burst(f, MID, GROUND - 50, 0.35, seed=1), lambda f: flash(f, MID, GROUND - 50, 60, 170))
    # 13-15: he rises and raises his fist high; the Matrix glows in his chest, his eyes shine
    frame(robot(crouch(1)), lambda f: burst(f, MID, GROUND - 50, 0.8, seed=1))
    for n, i in enumerate((3, 6)):
        frame(robot(fist(i)), lambda f, n=n: (matrix(f, *chest, 6 + n * 2), [sparkle(f, x, y, 3 + n) for x, y in eyes]))

    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    for n, im in enumerate(frames):
        im.save(out / f"{n}.png")
    print(f"{len(frames)} frames -> {out}")


if __name__ == "__main__":
    main()
