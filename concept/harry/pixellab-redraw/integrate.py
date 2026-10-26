"""Select native PixelLab frames and derive Harry-only attachment metadata."""
import argparse
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
CLIENT = PROJECT / "apps/client"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def image(path):
    return Image.open(path).convert("RGBA")


def anchor(path):
    im = image(path)
    bottom = im.getbbox()[3]
    points = [(x, y) for y in range(bottom - 4, bottom) for x in range(im.width)
              if im.getpixel((x, y))[3] > 128]
    return [round((min(x for x, _ in points) + max(x for x, _ in points) + 1) / 2), bottom]


def select(name, action, indices):
    folder = "cleaned" if (ROOT / "cleaned" / action).exists() else "frames"
    paths = [f"{folder}/{action}/{index}.png" for index in indices]
    for path in paths:
        if image(ROOT / path).getbbox() is None:
            raise ValueError(f"Empty frame: {path}")
    return {"name": name, "frames": paths, "anchor": anchor(ROOT / f"frames/{action}/0.png"),
            "source_action": action, "source_indices": indices}


def skin(color):
    red, green, blue, alpha = color
    return alpha > 200 and red > 110 and green > 65 and blue > 30 and red > green * 1.08 and green > blue * 0.95


def palms(im, direction):
    candidates = {(x, y) for y in range(min(44, im.height)) for x in range(im.width)
                  if skin(im.getpixel((x, y))) and (direction == "east" or x < 65 or x > 105)}
    components = []
    while candidates:
        start = candidates.pop()
        stack, points = [start], [start]
        while stack:
            x, y = stack.pop()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                point = (x + dx, y + dy)
                if point in candidates:
                    candidates.remove(point); stack.append(point); points.append(point)
        if len(points) >= 5:
            components.append(points)
    components.sort(key=len, reverse=True)
    if len(components) < (1 if direction == "east" else 2):
        raise ValueError("Raised palms could not be located")
    selected = components[:2]
    centers = []
    for points in selected:
        cx, cy = sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points)
        centers.append(min(points, key=lambda point: (point[0] - cx) ** 2 + (point[1] - cy) ** 2))
    centers.sort()
    return [centers[-1]] if direction == "east" else centers


def prepare():
    rows = []
    for prefix, action, indices in (("idle", "idle", list(range(4))),
                                    ("walk", "walk", list(range(1, 7)))):
        for view, direction in (("down", "south"), ("side", "east"), ("up", "north")):
            rows.append(select(f"{prefix}.{view}", f"{action}-{direction}", indices))
    rows.extend((select("stun", "stun", list(range(1, 7))), select("death", "death", list(range(7)))))
    for view, direction in (("down", "south"), ("side", "east"), ("up", "north")):
        rows.append(select(f"cast.{view}", f"cast-{direction}", list(range(9))))
    for prefix, action, indices in (("carryIdle", "carry-idle", list(range(4))),
                                    ("carryWalk", "carry-loop", list(range(1, 7)))):
        for view, direction in (("down", "south"), ("side", "east"), ("up", "north")):
            row = select(f"{prefix}.{view}", f"{action}-{direction}", indices)
            row["palms"] = [[list(point) for point in palms(image(ROOT / path), direction)] for path in row["frames"]]
            rows.append(row)
    lobby = select("lobby", "lobby", [0, 2, 3, 4, 5, 6, 7, 8])
    victory = select("victory", "victory", [0, *range(2, 17)])
    manifest = {"source_root": ".", "character_id": "b221a997-bdcf-4894-a052-7ee1a1c41985",
                "approved_reference": "../pixellab-preview-v2/option-1.png", "pixel_scale": 1,
                "rows": rows, "lobby": lobby, "victory": victory,
                "effects": "character poses only; game renders effects separately"}
    write(ROOT / "manifest.json", manifest)
    print("Selected 100 gameplay, 8 lobby and 16 victory frames.")


def promote():
    manifest, report = read(ROOT / "manifest.json"), read(ROOT / "report.json")
    backup = ROOT / "before-redraw"
    backup.mkdir(exist_ok=True)
    for source in (CLIENT / "public/sprites/harry.png", CLIENT / "src/render/score-portraits.json",
                   CLIENT / "src/render/carry-anchors.json", CLIENT / "src/ui/cast-animation-bounds.json"):
        if not (backup / source.name).exists():
            shutil.copyfile(source, backup / source.name)
    palms_data = {"frameW": 224, "frameH": 224, "rows": {}}
    for index, row in enumerate(manifest["rows"]):
        if "palms" not in row:
            continue
        dx, dy = report["rows"][index]["offset"]
        palms_data["rows"][str(index)] = [[[x + dx, y + dy] for x, y in frame] for frame in row["palms"]]
    write(ROOT / "palms.json", palms_data)
    lobby = image(ROOT / "harry-lobby-candidate.png")
    boxes = [lobby.crop((i * 224, 0, (i + 1) * 224, 224)).getbbox() for i in range(8)]
    bounds = [min(box[0] for box in boxes), max(box[2] for box in boxes)]
    front = image(ROOT / manifest["rows"][0]["frames"][0])
    top = front.getbbox()[1]
    head = front.crop((0, top, front.width, top + 64)).getbbox()
    dx, dy = report["rows"][0]["offset"]
    crop = [head[0] + dx - 2, top + dy - 2, head[2] - head[0] + 4, 68]
    portraits_path = CLIENT / "src/render/score-portraits.json"
    portraits = read(portraits_path)
    portraits["harry"].update(frame=[224, 224], crop=crop)
    write(portraits_path, portraits)
    bounds_path = CLIENT / "src/ui/cast-animation-bounds.json"
    all_bounds = read(bounds_path)
    all_bounds["harry"] = bounds
    bounds_path.write_text("{\n" + ",\n".join(f"  {json.dumps(name)}: {json.dumps(value)}" for name, value in all_bounds.items()) + "\n}\n")
    for source, target in (("harry-candidate.png", "harry.png"),
                           ("harry-lobby-candidate.png", "harry-lobby-pixellab.png"),
                           ("harry-victory-candidate.png", "harry-victory-pixellab.png")):
        shutil.copyfile(ROOT / source, CLIENT / "public/sprites" / target)
    metadata = {"bodyH": report["bodyH"], "scale": round(157 * 0.137 / report["bodyH"], 8),
                "menuBodyH": report["lobby"]["bodyH"], "horizontalBounds": bounds,
                "portraitCrop": crop, "frame": [224, 224], "anchor": [111.5, 211]}
    write(ROOT / "runtime-metadata.json", metadata)
    print(json.dumps(metadata))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    promote() if args.promote else prepare()
