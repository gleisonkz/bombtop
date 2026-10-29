"""Twelve Super Saiyan pose skeletons; same A1 proportions, no image edits."""
import copy
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = json.loads((ROOT / "retargeted/lobby.json").read_text())
REF = {k["label"]: k for k in json.loads((ROOT / "skeletons/reference-south.json").read_text())["keypoints"]}


def pixels(frame):
    return {k["label"]: {**k, "x": k["x"] * 128, "y": k["y"] * 160} for k in frame}


def length(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def blend(a, b, t):
    a, b = pixels(a), pixels(b)
    result = copy.deepcopy(a)
    for name in result:
        for axis in ("x", "y"):
            result[name][axis] = a[name][axis] * (1 - t) + b[name][axis] * t
    for side in ("LEFT", "RIGHT"):
        for child, parent in (("SHOULDER", "NECK"), ("ELBOW", f"{side} SHOULDER"),
                              ("ARM", f"{side} ELBOW"), ("HIP", "NECK"),
                              ("KNEE", f"{side} HIP"), ("LEG", f"{side} KNEE")):
            child = f"{side} {child}"
            dx, dy = result[child]["x"] - result[parent]["x"], result[child]["y"] - result[parent]["y"]
            canonical = math.hypot((REF[child]["x"] - REF[parent]["x"]) * 128,
                                   (REF[child]["y"] - REF[parent]["y"]) * 160)
            scale = canonical / math.hypot(dx, dy)
            result[child]["x"] = result[parent]["x"] + dx * scale
            result[child]["y"] = result[parent]["y"] + dy * scale
    return normalized(result)


def normalized(points):
    return [{**p, "x": round(p["x"] / 128, 7), "y": round(p["y"] / 160, 7)} for p in points.values()]


def effort(frame):
    points = pixels(frame)
    for name, point in points.items():
        if "KNEE" not in name and "LEG" not in name:
            point["y"] += 3
    for side in ("LEFT", "RIGHT"):
        hip, knee, ankle = (points[f"{side} {part}"] for part in ("HIP", "KNEE", "LEG"))
        upper = math.hypot((REF[f"{side} HIP"]["x"] - REF[f"{side} KNEE"]["x"]) * 128,
                           (REF[f"{side} HIP"]["y"] - REF[f"{side} KNEE"]["y"]) * 160)
        lower = math.hypot((REF[f"{side} LEG"]["x"] - REF[f"{side} KNEE"]["x"]) * 128,
                           (REF[f"{side} LEG"]["y"] - REF[f"{side} KNEE"]["y"]) * 160)
        dx, dy = ankle["x"] - hip["x"], ankle["y"] - hip["y"]
        distance = math.hypot(dx, dy)
        along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
        across = math.sqrt(max(0, upper * upper - along * along))
        candidates = [(hip["x"] + dx / distance * along + sign * -dy / distance * across,
                       hip["y"] + dy / distance * along + sign * dx / distance * across) for sign in (-1, 1)]
        knee["x"], knee["y"] = min(candidates, key=lambda p: (p[0] - knee["x"]) ** 2 + (p[1] - knee["y"]) ** 2)
    return normalized(points)


deep = effort(SOURCE[3])
frames = [SOURCE[0], blend(SOURCE[0], SOURCE[1], .5), SOURCE[1], SOURCE[2], SOURCE[3], deep,
          deep, blend(SOURCE[3], SOURCE[4], .5), SOURCE[4], SOURCE[5], SOURCE[6], SOURCE[7]]
(ROOT / "retargeted/transform12.json").write_text(json.dumps(frames, indent=2) + "\n")
print("12 transform skeletons: anticipation, effort, gold transition, recovery, firm final stance")
