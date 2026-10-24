"""Harry's patronus, a silver stag galloping: public/sprites/patronus.png (SHEETS-free, PATRONUS in render/sprites.ts).

The stag is a PixelLab image (create_image_pixflux, "glowing translucent silver-blue ghostly stag patronus galloping,
side view facing right"): SRC. Its eye came out red; it is made the pale blue of the rest, and the whole stag a touch
brighter, since the renderer draws it see-through over the arena.
Usage: python build-patronus.py SRC public/sprites/patronus.png"""
import sys
import numpy as np
from PIL import Image

a = np.array(Image.open(sys.argv[1]).convert("RGBA")).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
red = (al > 0) & (r > g + 40) & (r > b + 40)
a[red, :3] = (235, 248, 255)
a[..., :3] = np.clip(a[..., :3] * 1.08 + 8, 0, 255)
Image.fromarray(a.astype(np.uint8), "RGBA").save(sys.argv[2])
print("ok")
