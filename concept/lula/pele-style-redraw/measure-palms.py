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


def skin(pixel):
    r, g, b, a = pixel
    return a >= 240 and 175 <= r <= 255 and 95 <= g <= 210 and 65 <= b <= 165 and r - g >= 25 and g - b >= 15


# Seeds inspected on each immutable selected pose; no atlas-based inference.
SEEDS = {
    "carryIdle-south": [[(25,39),(102,39)]] * 4,
    "carryIdle-east": [[(102,42)],[(99,40)],[(94,38)],[(94,38)]],
    "carryIdle-north": [[(27,39),(101,39)],[(28,39),(100,39)],[(35,34),(91,34)],[(36,33),(91,33)]],
    "carryWalk-south": [[(27,39),(101,39)],[(27,40),(101,40)],[(26,39),(102,39)],[(25,37),(104,37)],[(27,39),(103,39)],[(27,41),(104,41)]],
    "carryWalk-east": [[(99,42)],[(99,42)],[(99,42)],[(99,42)],[(99,42)],[(99,42)]],
    "carryWalk-north": [[(31,40),(97,40)],[(33,40),(95,40)],[(36,38),(92,38)],[(35,39),(93,39)],[(32,40),(97,40)],[(29,41),(100,41)]],
}


def palm(image, seed):
    """Find a dense 5x5 light-tan skin patch in a visually bounded hand-only window.

    Seeds describe palm interiors, never the head/arm. The bounded search and
    distance tie-break prevent drift down the wrist or onto thin fingers.
    """
    sx, sy = seed
    candidates = []
    for y in range(sy - 2, sy + 3):
        for x in range(sx - 2, sx + 3):
            if not skin(image.getpixel((x, y))):
                continue
            density = sum(skin(image.getpixel((x + dx, y + dy)))
                          for dy in range(-2, 3) for dx in range(-2, 3))
            distance = (x - sx) ** 2 + (y - sy) ** 2
            candidates.append((density - distance * 0.35, density, x, y))
    if not candidates:
        raise ValueError(f"No light-tan palm near {seed}")
    _, density, x, y = max(candidates)
    if density < 5:
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
            seeds = SEEDS[name][col]
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
                             "palms": points, "rawPalmPixelCenters": [[x - 32, y - 16] for x, y in points],
                             "searchSeeds": seeds, "searchRadius": 2, "skinPixelsIn5x5": [n for _, n in measured],
                             "alphaBounds": image.getchannel("A").getbbox(),
                             "sourceSize": list(image.size), "sourceMode": image.mode,
                             "densePalmAccepted": all(n >= 12 for _, n in measured)})
    assert len(evidence) == 30
    assert sum(len(e["palms"]) for e in evidence) == 50
    args.output_dir.mkdir(parents=True, exist_ok=True)
    qa = args.output_dir / "qa"
    qa.mkdir(exist_ok=True)
    (args.output_dir / "palms.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    review.save(args.output_dir / "palm-review.png")
    (qa / "carry-palm-measurements.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(f"Registered 50 visible palm points across 30 raw poses; {sum(not e['densePalmAccepted'] for e in evidence)} poses require occlusion review.")


if __name__ == "__main__":
    main()
