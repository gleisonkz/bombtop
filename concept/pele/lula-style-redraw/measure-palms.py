"""Register inspected dense palm interiors directly from immutable raw frames.

No packed atlas is read and no source pixels are modified. Coordinates are
pixel centers in 192x192 cells, with raw 128x160 sources at (32,16).
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SEQUENCES = [(11, "carryIdle-south", range(4)),
             (12, "carryIdle-east", range(4)),
             (13, "carryIdle-north", range(4)),
             (14, "carryWalk-south", range(1, 7)),
             (15, "carryWalk-east", range(1, 7)),
             (16, "carryWalk-north", range(1, 7))]


def brown(pixel):
    r, g, b, a = pixel
    return a >= 240 and 65 <= r <= 215 and 25 <= g <= 140 and 20 <= b <= 105 and r > g * 1.3 and g >= b


def palm(image, seed):
    """Find a dense 5x5 brown patch in a visually bounded hand-only window.

    Seeds describe palm interiors, never the head/arm. The bounded search and
    distance tie-break prevent drift down the wrist or onto thin fingers.
    """
    sx, sy = seed
    candidates = []
    for y in range(sy - 4, sy + 5):
        for x in range(sx - 4, sx + 5):
            if not brown(image.getpixel((x, y))):
                continue
            density = sum(brown(image.getpixel((x + dx, y + dy)))
                          for dy in range(-2, 3) for dx in range(-2, 3))
            distance = (x - sx) ** 2 + (y - sy) ** 2
            candidates.append((density - distance * 0.15, density, x, y))
    if not candidates:
        raise ValueError(f"No brown palm near {seed}")
    _, density, x, y = max(candidates)
    if density < 12:
        raise ValueError(f"Palm patch too thin at {(x, y)}: {density}/25")
    return [x + 32.5, y + 16.5], density


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=ROOT / "generated")
    parser.add_argument("--output-dir", type=Path, default=ROOT)
    args = parser.parse_args()
    result = {"frameW": 192, "frameH": 192, "rows": {}}
    evidence = []
    review = Image.new("RGBA", (192 * 6, 216 * 6), (48, 54, 63, 255))
    draw = ImageDraw.Draw(review)
    for line, (row, name, selected) in enumerate(SEQUENCES):
        result["rows"][str(row)] = []
        for col, index in enumerate(selected):
            path = args.source_root / name / f"{index:02}.png"
            image = Image.open(path)
            if image.mode != "RGBA" or image.size != (128, 160):
                raise ValueError(f"Unexpected raw image: {path}: {image.mode} {image.size}")
            seeds = [(95, 38)] if name.endswith("east") else [(25, 35), (103, 35)]
            measured = [palm(image, seed) for seed in seeds]
            points = [point for point, _ in measured]
            result["rows"][str(row)].append(points)
            ox, oy = col * 192, line * 216 + 24
            review.alpha_composite(image, (ox + 32, oy + 16))
            draw.text((ox + 3, oy - 22), f"r{row} c{col} {name}/{index:02}", fill="white")
            for x, y in points:
                px, py = ox + x, oy + y
                draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill="#ff49c7")
            evidence.append({"row": row, "column": col,
                             "source": f"generated/{name}/{index:02}.png",
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                             "palms": points, "brownPixelsIn5x5": [n for _, n in measured],
                             "alphaBounds": image.getchannel("A").getbbox()})
    assert len(evidence) == 30
    assert sum(len(e["palms"]) for e in evidence) == 50
    args.output_dir.mkdir(parents=True, exist_ok=True)
    qa = args.output_dir / "qa"
    qa.mkdir(exist_ok=True)
    (args.output_dir / "palms.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    review.save(args.output_dir / "palm-review.png")
    (qa / "palm-measurements.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print("Registered 50 dense palm centers across 30 raw poses; rows 11..16.")


if __name__ == "__main__":
    main()
