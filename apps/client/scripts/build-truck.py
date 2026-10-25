"""Optimus's truck (public/sprites/truck.png): PixelLab pixflux images of his red semi cab in a flat side profile facing
right (SRC/prof2/0.png), from the front (SRC/down/0.png) and from the back (SRC/up3/0.png), cropped, brought to one
height and laid one view per row in 128x96 cells, the wheels on y = 90 (TRUCK in render/sprites.ts). Each row holds
FRAMES frames driving: the side view's wheels turn (each hub rotated a step a frame) and the cab rocks a pixel on its
springs; seen head-on or from behind, the whole truck rocks.
Usage: python build-truck.py SRC public/sprites/truck.png"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

W, H, GROUND = 128, 96, 90
FRAMES = 4
# view folder, height on the sheet (the side view stands as tall as the cab seen head-on)
VIEWS = [("prof2", 60), ("down", 64), ("up3", 64)]
# the side profile's wheels in its source image: centers and the radius of the hub that turns
WHEELS = [(20, 62), (39, 62), (101, 62)]
HUB = 6.5
# above this source row the cab rides on its springs (rocks); below, the wheels and chassis
SPRINGS = 50


def spin(a, cx, cy, angle):
    """The hub round (cx,cy) of RGBA array `a` turned by `angle` (nearest pixel)."""
    out = a.copy()
    c, s = np.cos(angle), np.sin(angle)
    r = int(HUB) + 1
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy > HUB * HUB:
                continue
            sx, sy = round(cx + c * dx + s * dy), round(cy - s * dx + c * dy)
            out[y, x] = a[sy, sx]
    return out


def side_frames(im):
    a = np.array(im)
    frames = []
    for f in range(FRAMES):
        b = a.copy()
        for cx, cy in WHEELS:
            b = spin(b, cx, cy, -f * np.pi / 2 / FRAMES)  # a quarter turn per cycle: the hubs look the same every 90 degrees
        if f % 2:
            body = b[:SPRINGS].copy()
            b[: SPRINGS - 1] = np.where(body[1:, ..., 3:4] > 0, body[1:], b[: SPRINGS - 1])  # the cab up a pixel
        frames.append(Image.fromarray(b))
    return frames


def place(sheet, im, r, f, tall, dy=0):
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())
    k = tall / im.height
    im = im.resize((min(W, round(im.width * k)), tall), Image.NEAREST)
    sheet.alpha_composite(im, (f * W + (W - im.width) // 2, r * H + GROUND - im.height - dy))


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    sheet = Image.new("RGBA", (W * FRAMES, H * len(VIEWS)))
    for r, (folder, tall) in enumerate(VIEWS):
        im = Image.open(src / folder / "0.png").convert("RGBA")
        if folder == "prof2":
            for f, frame in enumerate(side_frames(im)):
                place(sheet, frame, r, f, tall)
        else:
            for f in range(FRAMES):
                place(sheet, im, r, f, tall, dy=f % 2)
    sheet.save(out)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
