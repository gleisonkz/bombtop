"""Register compact paw contacts on the immutable packed candidate for review."""
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
script = ROOT.parents[1] / "apps/client/scripts/build-carry-anchors.py"
spec = importlib.util.spec_from_file_location("carry_tracker", script)
tracker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tracker)
SEEDS = (((62, 93), (117, 93)), ((101, 91),), ((59, 94), (122, 94)))
SIDE = {
    12: ((101, 91), (102, 92), (110, 97), (134, 101)),
    15: ((103, 94), (121, 99), (132, 104), (138, 106), (130, 104), (130, 102)),
}


def main():
    atlas = Image.open(ROOT / "pikachu-candidate.png")
    preview = Image.new("RGBA", (1080, 6 * 184), (48, 54, 63, 255))
    points = {"frameW": 180, "frameH": 164, "rows": {}}
    for row in range(11, 17):
        direction = (row - 11) % 3
        count = 4 if row < 14 else 6
        reference = atlas.crop((0, (11 + direction) * 164, 180, (12 + direction) * 164))
        poses = []
        for col in range(count):
            frame = atlas.crop((col * 180, row * 164, (col + 1) * 180, (row + 1) * 164))
            palms = []
            for seed in SEEDS[direction]:
                if direction == 1:
                    point = SIDE[row][col]
                else:
                    point, _ = tracker.track(tracker.rgba(reference), tracker.rgba(frame),
                                             (seed[0], seed[1] * 180 / 164))
                x, y = map(round, point)
                rgba = np.asarray(frame)
                choices = []
                for py in range(max(0, y - 5), min(164, y + 6)):
                    for px in range(max(0, x - 5), min(180, x + 6)):
                        red, green, blue, alpha = map(int, rgba[py, px])
                        if alpha > 128 and red > 140 and green > 100 and blue < 110:
                            choices.append(((px - x) ** 2 + (py - y) ** 2, px, py))
                if not choices:
                    raise ValueError(f"No animal-paw pixels near {row}/{col}: {point}")
                _, x, y = min(choices)
                palms.append([x, y])
            poses.append(palms)
            preview.alpha_composite(frame, (col * 180, (row - 11) * 184 + 20))
            draw = ImageDraw.Draw(preview)
            draw.text((col * 180 + 2, (row - 11) * 184 + 2), f"{row}/{col}", fill="white")
            for x, y in palms:
                draw.ellipse((col * 180 + x - 2, (row - 11) * 184 + 18 + y,
                              col * 180 + x + 2, (row - 11) * 184 + 22 + y), fill="magenta")
        points["rows"][str(row)] = poses
    (ROOT / "palms.json").write_text(json.dumps(points, indent=2) + "\n")
    preview.convert("RGB").save(ROOT / "palm-review.png")


if __name__ == "__main__":
    main()
