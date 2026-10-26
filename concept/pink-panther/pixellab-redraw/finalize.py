"""Select PixelLab frames, pack native art and promote only Panther metadata."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
CLIENT = PROJECT / "apps/client"
ANCHORS = {"south": [100, 160], "east": [98, 160], "north": [97, 157]}


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def image(path):
    with Image.open(path) as source:
        return source.convert("RGBA")


def palm(im, box):
    points = []
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            red, green, blue, alpha = im.getpixel((x, y))
            if alpha > 200 and red > 150 and red > green * 1.15 and blue > 90:
                points.append((x, y))
    if not points:
        raise ValueError(f"No visible pink glove in {box}")
    top = min(y for _, y in points)
    hand = [(x, y) for x, y in points if top + 3 <= y <= top + 11]
    if not hand:
        hand = points
    center = (sum(x for x, _ in hand) / len(hand), sum(y for _, y in hand) / len(hand))
    x, y = min(hand, key=lambda p: (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2)
    return {"x": x, "y": y}


def make_row(name, clip, indices, direction):
    anchor = list(ANCHORS[direction])
    directory = ROOT / "generated" / clip
    shift = [0, 0]
    if clip.startswith("carry-idle"):
        original = image(ROOT / "generated" / ("carry-walk-" + direction) / "frame_010.png").getbbox()
        reference = image(directory / "frame_000.png").getbbox()
        shift = [reference[0] - original[0], reference[1] - original[1]]
        anchor = [anchor[0] + shift[0], anchor[1] + shift[1]]
    frames = []
    for index in indices:
        path = directory / f"frame_{index:03}.png"
        frame = {"path": path.relative_to(ROOT).as_posix()}
        if name.startswith("carry"):
            im = image(path)
            boxes = ([(125, 5, min(im.width, 180), 90)] if direction == "east" else
                     [(12, 5, 78, 90), (120, 5, min(im.width, 175), 90)])
            boxes = [[x1 + shift[0], y1 + shift[1], min(im.width, x2 + shift[0]),
                      min(im.height, y2 + shift[1])] for x1, y1, x2, y2 in boxes]
            frame["palms"] = [palm(im, box) for box in boxes]
        frames.append(frame)
    return {"name": name, "anchor": anchor, "frames": frames}


def select():
    rows = []
    for action, count in (("idle", 4), ("walk", 6)):
        for direction, view in zip(("south", "east", "north"), ("down", "side", "up")):
            rows.append(make_row(action + "." + view, action + "-" + direction,
                                 list(range(count)), direction))
    rows.append(make_row("stun", "stun-south", [0, 1, 2, 3, 4, 6], "south"))
    rows.append(make_row("death", "death-south", [0, 2, 3, 4, 5, 7, 8], "south"))
    for action, clip, indices in (("cast", "sneak", list(range(1, 7))),
                                  ("carryIdle", "carry-idle", list(range(1, 5))),
                                  ("carryWalk", "carry-walk", list(range(7, 13)))):
        for direction, view in zip(("south", "east", "north"), ("down", "side", "up")):
            rows.append(make_row(action + "." + view, clip + "-" + direction, indices, direction))
    lobby = make_row("lobby", "lobby-south", list(range(15)), "south")
    lobby["frames"].append({"hold": 14})
    lobby["note"] = "14 generated poses, source resting pose and one explicit final rest hold."
    rows.append(lobby)
    write(ROOT / "manifest.json", {"character_id": read(ROOT / "submitted.json")["character_id"],
          "approved_reference": "../pixellab-preview/option-2.png", "pixel_scale": 1,
          "effect_policy": "character poses only, no baked effects or props", "rows": rows})


def promote():
    report = read(ROOT / "candidate-report.json")
    shutil.copyfile(ROOT / "candidate.png", CLIENT / "public/sprites/panther.png")
    shutil.copyfile(ROOT / "candidate-lobby.png", CLIENT / "public/sprites/panther-lobby.png")
    palms = {"frameW": report["frameW"], "frameH": report["frameH"], "rows": {}}
    for row in report["rows"][11:17]:
        palms["rows"][str(row["row"])] = [
            [[point["x"], point["y"]] for point in frame["palms"]] for frame in row["frames"]]
    write(ROOT / "palms.json", palms)
    path = CLIENT / "src/render/carry-anchors.json"
    sockets = read(path)
    sockets["characters"]["panther"] = {
        "frameW": report["frameW"], "frameH": report["frameH"], "rows": {
            row: [{"x": round(sum(x for x, _ in grip) / len(grip), 3),
                   "y": round(sum(y for _, y in grip) / len(grip), 3),
                   "span": abs(grip[-1][0] - grip[0][0])} for grip in frames]
            for row, frames in palms["rows"].items()}}
    write(path, sockets)
    path = CLIENT / "src/render/score-portraits.json"
    portraits = read(path)
    portraits["panther"].update(frame=[report["frameW"], report["frameH"]], crop=[83, 78, 60, 44])
    write(path, portraits)
    path = CLIENT / "src/ui/cast-animation-bounds.json"
    bounds = read(path)
    lobby_bounds = [frame["bounds"] for frame in report["lobby"]["frames"]]
    bounds["panther"] = [min(box[0] for box in lobby_bounds), max(box[2] for box in lobby_bounds)]
    path.write_text("{\n" + ",\n".join(f"  {json.dumps(key)}: {json.dumps(value)}"
                                        for key, value in bounds.items()) + "\n}\n")
    standing = report["rows"][0]["frames"][0]["bounds"]
    body_height = standing[3] - standing[1]
    write(ROOT / "runtime.json", {"frameW": report["frameW"], "frameH": report["frameH"],
          "width": report["width"], "height": report["height"], "anchorX": 112,
          "anchorY": 208, "bodyH": body_height, "scale": round(141 * .152 / body_height, 8),
          "lobby": {"width": report["lobby"]["width"], "height": report["lobby"]["height"],
                    "bodyH": body_height}, "horizontalBounds": bounds["panther"]})
    print(json.dumps(read(ROOT / "runtime.json")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    select()
    subprocess.run([sys.executable, str(ROOT / "pack.py"), "--manifest", str(ROOT / "manifest.json"),
                    "--output", str(ROOT / "candidate.png")], check=True)
    if args.promote:
        promote()
