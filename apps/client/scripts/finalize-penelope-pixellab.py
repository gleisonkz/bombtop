"""Measure approved Penelope PNGs and promote them without changing any pixels."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/penelope/pixellab-redraw"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def feet(image):
    box = image.getchannel("A").getbbox()
    xs = [x for y in range(box[3] - 8, box[3]) for x in range(192)
          if image.getpixel((x, y))[3] >= 128]
    return [(min(xs) + max(xs) + 1) / 2, box[3]]


def glove(image, point):
    sx, sy = point["x"] * 192, point["y"] * 192
    candidates = [(x, y) for y in range(max(0, int(sy) - 18), min(192, int(sy) + 19))
                  for x in range(max(0, int(sx) - 18), min(192, int(sx) + 19))
                  if (lambda c: c[3] >= 128 and min(c[:3]) >= 165
                      and max(c[:3]) - min(c[:3]) <= 65)(image.getpixel((x, y)))]
    if not candidates:
        raise ValueError(f"No visible white glove near {(sx, sy)}")
    seed = min(candidates, key=lambda p: (p[0] - sx) ** 2 + (p[1] - sy) ** 2)
    local = [p for p in candidates if (p[0] - seed[0]) ** 2 + (p[1] - seed[1]) ** 2 <= 36]
    cx, cy = sum(p[0] for p in local) / len(local), sum(p[1] for p in local) / len(local)
    return list(min(local, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2))


def measure():
    mapping = read(ART / "pose-map.json")
    requests = read(ART / "requests.json")
    joints = {pose: {point["label"]: point for point in points}
              for request in requests for pose, points in zip(request["poses"], request["keypoints"])}
    images = {pose: Image.open(ART / "raw" / f"{pose}.png").convert("RGBA") for pose in mapping["unique_poses"]}
    if any(image.size != (192, 192) for image in images.values()):
        raise ValueError("Expected native 192x192 approved frames")
    palms = {"frameW": 192, "frameH": 192, "rows": {}}
    for cell in mapping["cells"]:
        if cell["sheet"] != "gameplay" or not 11 <= cell["row"] <= 16:
            continue
        pose, row = cell["pose"], cell["row"]
        labels = ["RIGHT ARM"] if (row - 11) % 3 == 1 else ["LEFT ARM", "RIGHT ARM"]
        points = sorted((glove(images[pose], joints[pose][label]) for label in labels), key=lambda p: p[0])
        palms["rows"].setdefault(str(row), []).append(points)
    cells = [cell for cell in mapping["cells"] if cell["sheet"] == "gameplay"]
    first = images[cells[0]["pose"]]
    anchor = feet(first)
    height = max(images[cell["pose"]].getbbox()[3] - images[cell["pose"]].getbbox()[1]
                 for cell in cells if cell["row"] < 3)
    neck = joints[cells[0]["pose"]]["NECK"]
    top = max(0, first.getbbox()[1] - 3)
    bottom = min(192, round(neck["y"] * 192) + 6)
    box = first.getchannel("A").crop((0, top, 192, bottom)).getbbox()
    crop = [max(0, box[0] - 2), top, min(192, box[2] + 2) - max(0, box[0] - 2), bottom - top]
    extra = {}
    for sheet in ("lobby", "victory"):
        poses = [cell["pose"] for cell in mapping["cells"] if cell["sheet"] == sheet]
        initial = images[poses[0]]
        bounds = [images[pose].getbbox() for pose in poses]
        extra[sheet] = {"anchorX": feet(initial)[0], "anchorY": feet(initial)[1],
                        "bodyH": initial.getbbox()[3] - initial.getbbox()[1],
                        "bounds": [min(b[0] for b in bounds), max(b[2] for b in bounds)]}
    muzzle = {}
    for direction, pose in (("down", "g-r08-c00"), ("side", "g-r09-c00"), ("up", "g-r10-c00")):
        nose = joints[pose]["NOSE"]
        if direction == "up":
            mx, my = nose["x"] * 192, images[pose].getbbox()[1] + 20
        else:
            mx, my = nose["x"] * 192, nose["y"] * 192 + 6
            if direction == "side":
                mx += 3
        muzzle[direction] = [round(mx - anchor[0], 2), round(my - anchor[1], 2)]
    hashes = {name: hashlib.sha256((ART / ("penelope-candidate.png" if name == "gameplay"
                                          else f"penelope-{name}-candidate.png")).read_bytes()).hexdigest()
              for name in ("gameplay", "lobby", "victory")}
    metadata = {"width": 1728, "height": 3264, "frameW": 192, "frameH": 192,
                "anchorX": anchor[0], "anchorY": anchor[1], "bodyH": height,
                "scale": round(148 * 0.145 / height, 8), "portraitCrop": crop,
                "menuBodyH": extra["lobby"]["bodyH"], "menuBounds": extra["lobby"]["bounds"],
                "lobby": extra["lobby"], "victory": extra["victory"], "muzzle": muzzle, "sha256": hashes}
    write(ART / "palms.json", palms)
    write(ART / "runtime-metadata.json", metadata)
    return metadata


def register_palms(client):
    path = client / "scripts/build-carry-anchors.py"
    text = path.read_text(encoding="utf-8")
    if "PENELOPE_PALMS =" not in text:
        text, count = re.subn(r"^(LANTERN_PALMS = [^\n]+)$",
                              r'\1\nPENELOPE_PALMS = json.loads((CLIENT.parents[1] / "concept/penelope/pixellab-redraw/palms.json").read_text(encoding="utf-8"))',
                              text, count=1, flags=re.M)
        if count != 1:
            raise ValueError("Expected the existing registered-palm loader")
    if '"penelope": tuple(' not in text:
        replacement = ('    "penelope": tuple(tuple((x * 180 / PENELOPE_PALMS["frameW"], y * 180 / PENELOPE_PALMS["frameH"])\n'
                       '                             for x, y in PENELOPE_PALMS["rows"][str(11 + direction)][0])\n'
                       '                       for direction in range(3)),')
        text, count = re.subn(r'^    "penelope": [^\n]+', lambda _: replacement, text, count=1, flags=re.M)
        if count != 1:
            raise ValueError("Expected exactly one Penelope palm seed profile")
    if '"penelope": PENELOPE_PALMS' not in text:
        if "registered = {" in text:
            text = text.replace("registered = {", 'registered = {"penelope": PENELOPE_PALMS, ', 1)
        elif 'if name in ("spider",' in text and "profile = {" in text:
            text = text.replace('if name in ("spider",', 'if name in ("penelope", "spider",', 1)
            text = text.replace("profile = {", 'profile = {"penelope": PENELOPE_PALMS, ', 1)
        else:
            raise ValueError("Registered-palm dispatch differs from the inspected runtime")
    path.write_text(text, encoding="utf-8")


def promote(target, meta):
    client = target / "apps/client"
    snapshot = ART / "integration-backups" / hashlib.sha256(str(target).encode()).hexdigest()[:10]
    paths = ["public/sprites/penelope.png", "public/sprites/penelope-lobby.png", "public/sprites/penelope-victory.png",
             "src/render/sprites.ts", "src/render/score-portraits.json", "src/render/carry-anchors.json",
             "src/ui/cast-layout.ts", "src/ui/cast-animation-bounds.json", "scripts/build-carry-anchors.py"]
    for relative in paths:
        source = client / relative
        backup = snapshot / relative
        if source.exists() and not backup.exists():
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, backup)
    for sheet in ("gameplay", "lobby", "victory"):
        suffix = "" if sheet == "gameplay" else "-" + sheet
        shutil.copyfile(ART / f"penelope{suffix}-candidate.png", client / f"public/sprites/penelope{suffix}.png")
    destination = target / "concept/penelope/pixellab-redraw"
    destination.mkdir(parents=True, exist_ok=True)
    if destination.resolve() != ART.resolve():
        for name in ("palms.json", "runtime-metadata.json"):
            shutil.copyfile(ART / name, destination / name)
    register_palms(client)
    profile_path = client / "src/render/score-portraits.json"
    profiles = read(profile_path)
    profiles["penelope"] = {"frame": [192, 192], "crop": meta["portraitCrop"], "url": "sprites/penelope.png"}
    write(profile_path, profiles)
    bounds_path = client / "src/ui/cast-animation-bounds.json"
    bounds = read(bounds_path)
    bounds["penelope"] = meta["menuBounds"]
    bounds_path.write_text("{\n" + ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in bounds.items()) + "\n}\n", encoding="utf-8")
    layout_path = client / "src/ui/cast-layout.ts"
    layout, count = re.subn(r"penelope:\s*\d+", f"penelope: {meta['menuBodyH']}", layout_path.read_text(encoding="utf-8"))
    if count != 1:
        raise ValueError("Expected exactly one Penelope menu height")
    layout_path.write_text(layout, encoding="utf-8")
    sheets_path = client / "src/render/sprites.ts"
    sheets = sheets_path.read_text(encoding="utf-8")
    block = re.search(r"  penelope: \{.*?\n  \},", sheets, re.S)
    if not block:
        raise ValueError("Penelope runtime profile not found")
    text = block[0]
    for key in ("width", "height", "frameW", "frameH", "anchorX", "anchorY", "bodyH", "scale"):
        text = re.sub(rf"\b{key}: [0-9.]+", f"{key}: {meta[key]}", text, count=1)
    text = re.sub(r'url: "sprites/penelope\.png[^\"]*"', f'url: "sprites/penelope.png?v=base3-{meta["sha256"]["gameplay"][:8]}"', text, count=1)
    for sheet in ("lobby", "victory"):
        item = meta[sheet]
        replacement = (f'{sheet}: {{ row: 0, frames: 16, bodyH: {item["bodyH"]}, image: {{ '
                       f'url: "sprites/penelope-{sheet}.png?v=base3-{meta["sha256"][sheet][:8]}", '
                       f'width: 3072, height: 192, frameW: 192, frameH: 192, '
                       f'anchorX: {item["anchorX"]}, anchorY: {item["anchorY"]} }} }},')
        text, count = re.subn(rf"{sheet}: \{{[^\n]+", replacement, text)
        if count != 1:
            raise ValueError(f"Expected one {sheet} override")
    text = re.sub(r"muzzle: \{[^\n]+", "muzzle: { " + ", ".join(f"{key}: {json.dumps(value)}" for key, value in meta["muzzle"].items()) + " },", text)
    text = text.replace("A touch-up in her compact mirror, powder, a fluff of her ponytail and a kiss blown at us (scripts/build-penelope-lobby.py).", "Approved option 3 presentation gestures, without baked props or effects.")
    text = text.replace("A jump for joy, then a checkered race flag waved over her head, hearts floating up (scripts/build-penelope-victory.py).", "Approved option 3 jump and wave, without baked props or effects.")
    sheets_path.write_text(sheets[:block.start()] + text + sheets[block.end():], encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true")
    parser.add_argument("--target", type=Path, default=ROOT)
    args = parser.parse_args()
    metadata = measure()
    if args.promote:
        promote(args.target.resolve(), metadata)
    print(json.dumps(metadata))
