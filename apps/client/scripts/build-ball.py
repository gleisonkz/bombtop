"""Pelé's soccer ball (public/sprites/ball.png): a PixelLab pixflux image (SRC/ball/0.png), cropped to the ball and
cleared of the shadow PixelLab drew under it (only its round body kept), centered on a 32x32 cell (BALL in render/sprites.ts; the renderer spins it).
Usage: python build-ball.py SRC public/sprites/ball.png"""
import sys
from pathlib import Path
from PIL import Image

SIZE = 32


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    im = Image.open(src / "ball" / "0.png").convert("RGBA")
    # the ball's round body: its solid pixels' width is its diameter, taken from the top down
    x0, y0, x1, _ = im.getchannel("A").point(lambda v: 255 if v > 200 else 0).getbbox()
    r = (x1 - x0) / 2
    cx, cy = (x0 + x1) / 2, y0 + r
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > (r + 0.5) ** 2:
                px[x, y] = (0, 0, 0, 0)
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())
    cell = Image.new("RGBA", (SIZE, SIZE))
    cell.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    cell.save(out)
    print(out, im.size)


if __name__ == "__main__":
    main()
