"""Derive Spider-only attachment/color metadata from the packed candidate.

Run the rig and packer first. --promote copies the verified atlas and updates
only Spider entries in shared JSON files; all other characters are preserved.
"""
import argparse
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/spider/pixellab"
CLIENT = ROOT / "apps/client"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def eye_regions(image):
    pixels = image.load()
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if pixels[x, y][3] > 128 and min(pixels[x, y][:3]) >= 120
                 and max(pixels[x, y][:3]) - min(pixels[x, y][:3]) < max(pixels[x, y][:3]) * 0.35}
    components = []
    while remaining:
        seed = remaining.pop()
        queue, points = [seed], [seed]
        while queue:
            x, y = queue.pop()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                point = (x + dx, y + dy)
                if point in remaining:
                    remaining.remove(point)
                    queue.append(point)
                    points.append(point)
        if len(points) >= 8:
            components.append(points)
    components.sort(key=len, reverse=True)
    if not components:
        return []
    first = components[0]
    center = (sum(x for x, _ in first) / len(first), sum(y for _, y in first) / len(first))
    regions = []
    for component in components[:2]:
        xs, ys = zip(*component)
        if abs(sum(xs) / len(xs) - center[0]) > 40 or abs(sum(ys) / len(ys) - center[1]) > 25:
            continue
        regions.append({"left": max(0, min(xs) - 2), "top": max(0, min(ys) - 2),
                        "right": min(image.width, max(xs) + 3), "bottom": min(image.height, max(ys) + 3)})
    return regions


def derive():
    manifest = read(ART / "manifest.json")
    report = read(ART / "candidate-report.json")
    image = Image.open(ART / "spider-candidate.png").convert("RGBA")
    if image.size != (1170, 2898) or report["frame_counts"] != [len(row["frames"]) for row in manifest["rows"]]:
        raise ValueError("Candidate does not match complete Spider manifest")
    palms = {"frameW": 130, "frameH": 161, "rows": {}}
    protection = {"frameW": 130, "frameH": 161, "rows": []}
    for row, placement in zip(manifest["rows"], report["rows"]):
        index = placement["row"]
        regions = []
        for column in range(9):
            cell = image.crop((column * 130, index * 161, (column + 1) * 130, (index + 1) * 161))
            regions.append(eye_regions(cell) if index not in (2, 5, 10, 13, 16) else [])
        protection["rows"].append(regions)
        if "palms" in row:
            dx, dy = placement["offset"]
            palms["rows"][str(index)] = [[[x * 2 + 0.5 + dx, y * 2 + 0.5 + dy] for x, y in frame]
                                         for frame in row["palms"]]
    cells = [image.crop((column * 130, 17 * 161, (column + 1) * 130, 18 * 161)) for column in range(8)]
    boxes = [cell.getbbox() for cell in cells]
    bounds = [min(box[0] for box in boxes), max(box[2] for box in boxes)]
    wrist = manifest["rows"][10]["wrist"]
    offset = report["rows"][10]["offset"]
    up = [wrist[0] * 2 + offset[0] - 64.5, wrist[1] * 2 + offset[1] - 155]
    metadata = {"bodyH": report["bodyH"], "scale": round(152 * 0.139 / report["bodyH"], 8),
                "menuBodyH": cells[0].getbbox()[3] - cells[0].getbbox()[1],
                "horizontalBounds": bounds, "portraitCrop": [32, 36, 56, 64],
                "muzzle": {"down": [44.5, -57], "side": [42.5, -55], "up": up}}
    write(ART / "rigged/palms.json", palms)
    write(ART / "spider-paint-regions.json", protection)
    write(ART / "runtime-metadata.json", metadata)
    return metadata, protection


def promote(metadata, protection):
    shutil.copyfile(ART / "spider-candidate.png", CLIENT / "public/sprites/spider.png")
    write(CLIENT / "src/render/spider-paint-regions.json", protection)
    portraits_path = CLIENT / "src/render/score-portraits.json"
    portraits = read(portraits_path)
    portraits["spider"]["crop"] = metadata["portraitCrop"]
    write(portraits_path, portraits)
    bounds_path = CLIENT / "src/ui/cast-animation-bounds.json"
    bounds = read(bounds_path)
    bounds["spider"] = metadata["horizontalBounds"]
    bounds_path.write_text("{\n" + ",\n".join(f"  {json.dumps(name)}: {json.dumps(value)}"
                                               for name, value in bounds.items()) + "\n}\n", encoding="utf-8")
    manifest_path = ART / "manifest.json"
    manifest = read(manifest_path)
    manifest["status"] = "complete-promoted"
    write(manifest_path, manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    metadata, protection = derive()
    if args.promote:
        promote(metadata, protection)
    print(json.dumps(metadata))


if __name__ == "__main__":
    main()
