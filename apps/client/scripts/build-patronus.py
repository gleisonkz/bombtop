"""Harry's patronus, a silver stag galloping: public/sprites/patronus.png (PATRONUS in render/sprites.ts).

PixelLab images (create_image_pixflux, then animate_image "galloping in place" for 8 frames each), one row per view:
SRC/side (facing right; its frame 0, the still with a puff under it, is left out), SRC/down (running at us) and
SRC/up (running away). Every frame is fitted into a 96px cell with its feet on one line (PATRONUS.anchorY), its eye made
the pale blue of the rest where it came out red, and the whole stag a touch brighter (the renderer draws it see-through).
Usage: python build-patronus.py SRC public/sprites/patronus.png"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

CELL, FRAMES, FEET = 96, 8, 84


def clean(im):
    a = np.array(im.convert("RGBA")).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    red = (al > 0) & (r > g + 40) & (r > b + 40)
    a[red, :3] = (235, 248, 255)
    a[..., :3] = np.clip(a[..., :3] * 1.08 + 8, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def fit(im):
    """The stag in a cell, its lowest pixel on FEET, centered."""
    bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    cell = Image.new("RGBA", (CELL, CELL))
    if bb:
        part = im.crop(bb)
        cell.alpha_composite(part, ((CELL - part.width) // 2, FEET - part.height))
    return cell


src = Path(sys.argv[1])
sheet = Image.new("RGBA", (CELL * FRAMES, CELL * 3))
for row, view in enumerate(("side", "down", "up")):
    for f in range(FRAMES):
        sheet.alpha_composite(fit(clean(Image.open(src / view / f"{f + 1}.png"))), (f * CELL, row * CELL))
sheet.save(sys.argv[2])
print("ok", sheet.size)
