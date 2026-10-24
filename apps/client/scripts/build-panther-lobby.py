"""The pink panther's lobby animation: he tiptoes in from the left on the tips of his toes, paws before his chest (his
sneak), turns to us, puts a finger to his lips ("shh...") and gives us a sly, heavy-lidded look.

His poses are PixelLab frames ("Pink Panther HD 4"): the side tiptoe posed from our own skeletons
(FRAMES_DIR/sneak/east/<i>.png), his rotation (FRAMES_DIR/../rot/south.png) and a v3 animation going "shh"
(FRAMES_DIR/shh/south/<i>.png, its first frame the rotation). This script lays them on one canvas, the feet on one
ground line, sliding the tiptoe in across it, takes out the floor shadow PixelLab drew under him, and writes the
finished frames to FRAMES_DIR/lobby/south/<i>.png for build-lobby-image.py.
Usage: python build-panther-lobby.py FRAMES_DIR"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

W, H = 300, 212
GROUND = 196  # where his feet stand
MID = W // 2
TIPTOE_FROM = -95  # how far left of the middle the tiptoe starts

# (source, frame, x offset from the middle)
FRAMES = [("sneak", i, round(TIPTOE_FROM * (1 - i / 6))) for i in range(6)] + [("rot", 0, 0)] + [("shh", i, 0) for i in range(2, 11)]


def no_floor_shadow(im):
    """The grays low in the frame (PixelLab's floor shadow) go."""
    a = np.array(im.convert("RGBA")).astype(int)
    alpha = a[..., 3] > 0
    if not alpha.any():
        return im
    ys = np.nonzero(alpha)[0]
    low = np.zeros_like(alpha)
    low[ys.max() - int((ys.max() - ys.min()) * 0.2):] = True
    rgb = a[..., :3]
    gray = (rgb.max(-1) - rgb.min(-1) < 36) & (rgb.mean(-1) > 110) & (rgb.mean(-1) < 215)
    a[alpha & low & gray] = 0
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def feet(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    """Middle of the body's widest solid columns (as build-character-sheet.py takes it)."""
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def main():
    src = Path(sys.argv[1])
    load = {
        "sneak": lambda i: Image.open(src / "sneak" / "east" / f"{i}.png"),
        "rot": lambda i: Image.open(src.parent / "rot" / "south.png"),
        "shh": lambda i: Image.open(src / "shh" / "south" / f"{i}.png"),
    }
    # each source is placed by its first frame (standing), so a row moves only as its poses move
    first = {k: no_floor_shadow(f(0).convert("RGBA")) for k, f in load.items()}
    place = {k: (feet(im), body_middle(im)) for k, im in first.items()}
    out = src / "lobby" / "south"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    for n, (kind, i, dx) in enumerate(FRAMES):
        im = no_floor_shadow(load[kind](i).convert("RGBA"))
        ground, middle = place[kind]
        canvas = Image.new("RGBA", (W, H))
        canvas.paste(im, (round(MID + dx - middle), GROUND - ground), im)  # paste: the tiptoe starts partly off the canvas
        canvas.save(out / f"{n}.png")
    print(f"{len(FRAMES)} frames -> {out}")


if __name__ == "__main__":
    main()
