"""Pelé's lobby animation: keepy-uppy, the ball bouncing off one knee then the other, a last touch sending it up out of
the card; it comes back down and he jumps to head it away, in a shower of green and yellow confetti.

His poses are PixelLab frames ("Pele HD") posed from our own skeletons: the knees raised in turn
(FRAMES_DIR/juggle/south/<i>.png) and the header (FRAMES_DIR/header/south/<i>.png); where his knees and head are comes
from the same skeletons (E:/pele-src/kp/juggle-south.json, header-south.json). The ball is public/sprites/ball.png. The
jump is lifted here (the skeleton keeps his feet down). Writes FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py.
Usage: python build-pele-lobby.py FRAMES_DIR"""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
KP = Path("E:/pele-src/kp")
W, H = 300, 240
GROUND = 226
MID = W // 2
CONFETTI = [(255, 210, 40), (20, 150, 60), (40, 90, 200), (255, 255, 255)]
JUMP = [0, 0, 0, 12, 24, 22, 10, 0]  # the jump's height per header frame, px
HIT = 4  # the header frame the ball meets his forehead


def feet(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def main():
    src = Path(sys.argv[1])
    juggle = lambda i: Image.open(src / "juggle" / "south" / f"{i}.png").convert("RGBA")
    header = lambda i: Image.open(src / "header" / "south" / f"{i}.png").convert("RGBA")
    ball = Image.open(HERE.parent / "public" / "sprites" / "ball.png").convert("RGBA")
    ball = ball.crop(ball.getchannel("A").getbbox())
    ball = ball.resize((ball.width * 3 // 2, ball.height * 3 // 2), Image.NEAREST)
    knees = json.load(open(KP / "juggle-south.json"))["frames"]
    heads = json.load(open(KP / "header-south.json"))["frames"]
    first = juggle(0)
    ground, middle = feet(first), body_middle(first)
    ox, oy = MID - middle, GROUND - ground  # where the 180 px frame lands on the canvas

    def place(im, lift=0):
        canvas = Image.new("RGBA", (W, H))
        canvas.paste(im, (round(ox), round(oy - lift)), im)
        return canvas

    def put_ball(canvas, x, y, turn=0):
        # a quarter turn at a time: pixel art smears when rotated by other angles
        b = [ball, ball.transpose(Image.ROTATE_90), ball.transpose(Image.ROTATE_180), ball.transpose(Image.ROTATE_270)][turn % 4]
        canvas.alpha_composite(b, (round(x - b.width / 2), round(y - b.height / 2)))

    frames = []
    # 0-7: keepy-uppy: the ball rises off the knee that is up and drops onto the next
    for i in range(8):
        canvas = place(juggle(i))
        k = {q["label"]: q for q in knees[i]}
        side = "RIGHT" if i in (0, 1, 2, 6, 7) else "LEFT"
        kx, ky = k[f"{side} KNEE"]["x"] * 180 + ox, k[f"{side} KNEE"]["y"] * 180 + oy
        up = [0.2, 0.0, 0.7, 0.9, 0.1, 0.6, 0.8, 3.5][i]  # how high the ball is over the knee (the last touch sends it way up)
        put_ball(canvas, kx, ky - 8 - up * 40, turn=i)
        frames.append(canvas)
    # 8-15: the ball drops back out of the sky onto his forehead as he springs up, and is nodded away; confetti rains
    for n in range(8):
        canvas = place(header(n), JUMP[n])
        k = {q["label"]: q for q in heads[n]}
        brow = (k["RIGHT EYE"]["y"] + k["LEFT EYE"]["y"]) / 2 * 180 + oy - JUMP[n] - 34  # the top of his head
        r = ball.height / 2
        if n <= HIT:  # falling onto the spot his head will be when it meets it
            t = n / HIT
            hit = (sum(q["y"] for q in heads[HIT] if "EYE" in q["label"]) / 2 * 180 + oy - JUMP[HIT] - 34) - r
            put_ball(canvas, MID + 4 * (1 - t), -r + (hit + r) * t * t, turn=n)
        elif n < 7:  # nodded up and away
            put_ball(canvas, MID + 14 * (n - HIT), brow - r - 45 * (n - HIT), turn=n)
        if n > HIT:
            d = ImageDraw.Draw(canvas)
            for c in range(28):
                x = (c * 53 + n * 7) % W
                y = (c * 37) % 120 + (n - HIT - 1) * 18 - 20
                if 0 <= y < GROUND - 10:
                    col = CONFETTI[c % len(CONFETTI)]
                    w = 2 + (c + n) % 2
                    d.rectangle([x, y, x + w, y + 1 + (c + n) % 3], fill=(*col, 255))
        frames.append(canvas)

    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    for n, im in enumerate(frames):
        im.save(out / f"{n}.png")
    print(f"{len(frames)} frames -> {out}")


if __name__ == "__main__":
    main()
