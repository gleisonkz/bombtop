"""Match Lantern palette and derive attachment metadata from the new poses."""
import argparse
import colorsys
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/lantern/redraw"
CLIENT = ROOT / "apps/client"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def skin(pixel):
    red, green, blue, alpha = pixel
    return alpha > 128 and red > 35 and red > green * 1.25 and red > blue * 1.25


def skin_groups(image):
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if skin(image.getpixel((x, y)))}
    groups = []
    while remaining:
        seed = remaining.pop()
        stack, group = [seed], [seed]
        while stack:
            x, y = stack.pop()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                point = (x + dx, y + dy)
                if point in remaining:
                    remaining.remove(point)
                    stack.append(point)
                    group.append(point)
        groups.append(group)
    return sorted(groups, key=len, reverse=True)


def head_box(image):
    groups = skin_groups(image)
    if not groups:
        raise ValueError("Lantern pose has no visible skin/head")
    xs, ys = zip(*max(groups, key=len))
    return [max(0, min(xs) - 3), max(0, min(ys) - 3),
            min(image.width, max(xs) + 4), min(image.height, max(ys) + 7)]


def harmonize(mapping):
    missing = [pose for pose in mapping["unique_poses"]
               if not (ART / "generated" / f"{pose}.png").exists()]
    if missing:
        raise ValueError(f"PixelLab poses are still pending: {', '.join(missing)}")
    original = ART / "raw"
    original.mkdir(exist_ok=True)
    head_bounds, changed = {}, 0
    ramp = ((5, 40, 35), (10, 75, 70), (17, 112, 83),
            (18, 120, 89), (52, 162, 107), (88, 186, 135))
    for pose in mapping["unique_poses"]:
        path = ART / "generated" / f"{pose}.png"
        backup = original / path.name
        if not backup.exists():
            shutil.copyfile(path, backup)
        image = Image.open(backup).convert("RGBA")
        box = head_box(image)
        head_bounds[pose] = box
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                red, green, blue, alpha = pixels[x, y]
                if not alpha or box[0] <= x < box[2] and box[1] <= y < box[3]:
                    continue
                hue, saturation, _ = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
                if 90 <= hue * 360 < 145 and saturation > 0.3:
                    luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) * 0.52
                    color = min(ramp, key=lambda c: abs(
                        c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 - luminance))
                    pixels[x, y] = (*color, alpha)
                    changed += 1
        image.save(path)
    write(ART / "head-bounds.json", head_bounds)
    print(json.dumps({"palette_pixels_matched_to_A1": changed, "poses": len(head_bounds)}))


def derive(mapping):
    report = read(ART / "report.json")
    heads = read(ART / "head-bounds.json")
    old = read(ART / "before-carry.json")
    protection = {"frameW": 132, "frameH": 164, "rows": [[[] for _ in range(9)] for _ in range(18)]}
    palms = {"frameW": 132, "frameH": 164, "rows": {}}
    for cell in mapping["cells"]:
        row, column, pose = (cell[key] for key in ("row", "col", "pose"))
        left, top, right, bottom = heads[pose]
        protection["rows"][row][column] = [dict(left=left, top=top, right=right, bottom=bottom)]
        if not 11 <= row <= 16:
            continue
        image = Image.open(ART / "generated" / f"{pose}.png").convert("RGBA")
        socket = old["rows"][str(row)][column]
        seeds = [[socket["x"] + 1, socket["y"] + 1]]
        if socket["span"]:
            seeds = [[socket["x"] + 1 - socket["span"] / 2, socket["y"] + 1],
                     [socket["x"] + 1 + socket["span"] / 2, socket["y"] + 1]]
        points = []
        for sx, sy in seeds:
            choices = [(x, y) for y in range(max(0, int(sy) - 16), min(164, int(sy) + 17))
                       for x in range(max(0, int(sx) - 16), min(132, int(sx) + 17))
                       if skin(image.getpixel((x, y)))]
            if not choices:
                raise ValueError(f"{pose}: no palm skin near {(sx, sy)}")
            points.append(list(min(choices, key=lambda p: (p[0] - sx) ** 2 + (p[1] - sy) ** 2)))
        palms["rows"].setdefault(str(row), []).append(points)
    first = heads[mapping["cells"][0]["pose"]]
    menu = report["rows"][17]
    metadata = {"width": 1188, "height": 2952, "frameW": 132, "frameH": 164,
                "anchorX": 68.5, "anchorY": 158, "bodyH": report["bodyH"],
                "scale": round(150 * 0.145 / report["bodyH"], 8),
                "menuBodyH": menu["bounds"][0][3] - menu["bounds"][0][1],
                "menuBounds": [menu["union"][0], menu["union"][2]],
                "portraitCrop": [first[0], first[1], first[2] - first[0], first[3] - first[1]]}
    write(ART / "native-palms.json", palms)
    write(ART / "paint-regions.json", protection)
    write(ART / "runtime-metadata.json", metadata)
    return metadata, protection


def derive_approved(mapping):
    """Measure the approved native PNGs; never change their artwork."""
    images = {pose: Image.open(ART / "raw" / f"{pose}.png").convert("RGBA")
              for pose in mapping["unique_poses"]}
    if any(image.size != (128, 160) for image in images.values()):
        raise ValueError("Approved native frames must be 128x160")
    heads, measured = {}, {}
    for pose, image in images.items():
        points = read(ART / "skeletons" / f"{pose}.json")["keypoints"]
        neck = next(point for point in points if point["label"] == "NECK")
        left, top, right, bottom = head_box(image)
        if 11 <= int(pose[1:3]) <= 16:
            # Raised fists may touch the scalp. Keep the protection rectangle
            # on the head rather than including the green wrist cuffs.
            left = max(left, int(neck["x"] * 128) - 30)
            right = min(right, int(neck["x"] * 128) + 31)
            bottom = min(bottom, int(neck["y"] * 160) + 6)
        heads[pose] = [left + 2, top + 2, right + 2, bottom + 2]
        row = int(pose[1:3])
        if not 11 <= row <= 16:
            continue
        if (row - 11) % 3 == 1:
            # In profile only one hand is visible. Its disconnected skin
            # component is smaller than the head and larger than face details.
            groups = skin_groups(image)
            hand = groups[1]
            center = (sum(x for x, _ in hand) / len(hand),
                      sum(y for _, y in hand) / len(hand))
            palm = min(hand, key=lambda p: (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2)
            measured[pose] = [[palm[0] + 2, palm[1] + 2]]
            continue
        wrists = sorted((point for point in points if point["label"] in ("LEFT ARM", "RIGHT ARM")),
                        key=lambda point: point["x"])
        palms = []
        for index, wrist in enumerate(wrists):
            sx, sy = wrist["x"] * 128, wrist["y"] * 160 - 6
            candidates = [(x, y) for y in range(max(0, int(sy) - 12), min(160, int(sy) + 13))
                          for x in range(max(0, int(sx) - 12), min(128, int(sx) + 13))
                          if skin(image.getpixel((x, y)))
                          and (x < neck["x"] * 128 - 22 if index == 0
                               else x > neck["x"] * 128 + 22)]
            if not candidates:
                raise ValueError(f"{pose}: no visible hand near wrist {index}")
            x, y = min(candidates, key=lambda p: (p[0] - sx) ** 2 + (p[1] - sy) ** 2)
            palms.append([x + 2, y + 2])
        measured[pose] = palms
    protection = {"frameW": 132, "frameH": 164, "rows": [[[] for _ in range(9)] for _ in range(18)]}
    palms = {"frameW": 132, "frameH": 164, "rows": {}}
    bounds = [[] for _ in range(18)]
    for cell in mapping["cells"]:
        row, col, pose = (cell[key] for key in ("row", "col", "pose"))
        box = images[pose].getchannel("A").getbbox()
        bounds[row].append([value + 2 for value in box])
        left, top, right, bottom = heads[pose]
        protection["rows"][row][col] = [dict(left=left, top=top, right=right, bottom=bottom)]
        if 11 <= row <= 16:
            palms["rows"].setdefault(str(row), []).append(measured[pose])
    first = bounds[0][0]
    head = heads[mapping["cells"][0]["pose"]]
    height = max(box[3] - box[1] for row in bounds[:3] for box in row)
    metadata = {"width": 1188, "height": 2952, "frameW": 132, "frameH": 164,
                "anchorX": (first[0] + first[2]) / 2, "anchorY": first[3],
                "bodyH": height, "scale": round(150 * 0.145 / height, 8),
                "menuBodyH": bounds[17][0][3] - bounds[17][0][1],
                "menuBounds": [min(box[0] for box in bounds[17]), max(box[2] for box in bounds[17])],
                "portraitCrop": [head[0], head[1], head[2] - head[0], head[3] - head[1]]}
    write(ART / "head-bounds.json", heads)
    write(ART / "native-palms.json", palms)
    write(ART / "paint-regions.json", protection)
    write(ART / "runtime-metadata.json", metadata)
    return metadata, protection


def promote(metadata, protection):
    shutil.copyfile(ART / "candidate.png", CLIENT / "public/sprites/lantern.png")
    write(CLIENT / "src/render/lantern-paint-regions.json", protection)
    path = CLIENT / "src/render/score-portraits.json"
    profiles = read(path)
    profiles["lantern"]["frame"] = [132, 164]
    profiles["lantern"]["crop"] = metadata["portraitCrop"]
    write(path, profiles)
    path = CLIENT / "src/ui/cast-animation-bounds.json"
    bounds = read(path)
    bounds["lantern"] = metadata["menuBounds"]
    path.write_text("{\n" + ",\n".join(f"  {json.dumps(name)}: {json.dumps(value)}"
                                           for name, value in bounds.items()) + "\n}\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harmonize", action="store_true")
    parser.add_argument("--promote", action="store_true")
    parser.add_argument("--approved", action="store_true", help="Measure/promote the approved skeleton redraw without editing pixels")
    args = parser.parse_args()
    if args.approved and args.harmonize:
        parser.error("Approved artwork cannot be palette-harmonized")
    mapping = read(ART / "pose-map.json")
    if args.approved:
        ART = ROOT / "concept/lantern/restart-skeleton"
    if args.harmonize:
        harmonize(mapping)
    else:
        metadata, protection = derive_approved(mapping) if args.approved else derive(mapping)
        if args.promote:
            promote(metadata, protection)
        print(json.dumps(metadata))
