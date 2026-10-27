"""Continuous fall poses on A1 bones. Coordinates only, never image edits."""
import copy
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REF = json.loads((ROOT / "skeletons/reference-east.json").read_text())["keypoints"]
REST = {p["label"]: {**p, "x": p["x"] * 128, "y": p["y"] * 160} for p in REF}


def length(a, b):
    return math.hypot(REST[a]["x"] - REST[b]["x"], REST[a]["y"] - REST[b]["y"])


def place(points, name, parent, angle):
    radius = length(name, parent)
    points[name]["x"] = points[parent]["x"] + radius * math.cos(math.radians(angle))
    points[name]["y"] = points[parent]["y"] + radius * math.sin(math.radians(angle))


def rotate(points, name, angle):
    dx, dy = REST[name]["x"] - REST["NECK"]["x"], REST[name]["y"] - REST["NECK"]["y"]
    cs, sn = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    points[name]["x"] = points["NECK"]["x"] + dx * cs - dy * sn
    points[name]["y"] = points["NECK"]["y"] + dx * sn + dy * cs


frames = []
roots = [(63.6, 93.1), (60, 95), (55, 101), (53, 111), (54, 119), (55, 124), (55, 124)]
body_angles = [0, -10, -25, -42, -65, -80, -80]
head_angles = [0, -8, -20, -35, -45, -60, -60]
for i in range(7):
    out = copy.deepcopy(REST)
    out["NECK"]["x"], out["NECK"]["y"] = roots[i]
    for side in ("RIGHT", "LEFT"):
        for part in ("SHOULDER", "HIP"):
            rotate(out, f"{side} {part}", body_angles[i])
        arm = [95, 70, 30, 20, 5, 20, 40] if side == "RIGHT" else [100, 100, 60, 25, 5, -10, -15]
        hand = [80, 40, 0, -10, 10, 20, 25] if side == "RIGHT" else [100, 90, 45, 15, 0, -10, -15]
        knee = [95, 105, 120, 80, 55, 45, 50] if side == "RIGHT" else [95, 90, 75, 65, 60, 60, 60]
        ankle = [100, 65, 40, 30, 20, 0, -5] if side == "RIGHT" else [95, 100, 90, 65, 45, 30, 25]
        for name, parent, angles in (("ELBOW", "SHOULDER", arm), ("ARM", "ELBOW", hand),
                                     ("KNEE", "HIP", knee), ("LEG", "KNEE", ankle)):
            place(out, f"{side} {name}", f"{side} {parent}", angles[i])
    for name in ("NOSE", "RIGHT EYE", "LEFT EYE", "RIGHT EAR", "LEFT EAR"):
        rotate(out, name, head_angles[i])
    # A fixed floor for boots; no stature scaling or per-frame image transforms.
    shift = 141.5 - max(out["LEFT LEG"]["y"], out["RIGHT LEG"]["y"])
    for name, point in out.items():
        point["y"] += shift
        point["x"] /= 128
        point["y"] /= 160
        point["z_index"] = round(point.get("z_index", 0) * 2)
        if name.startswith("RIGHT") and any(k in name for k in ("HIP", "KNEE", "LEG", "ELBOW", "ARM")):
            point.update(depth=190, z_index=12)
        elif name.startswith("LEFT") and any(k in name for k in ("HIP", "KNEE", "LEG", "ELBOW", "ARM")):
            point.update(depth=150, z_index=8)
    if any(not 0 < k["x"] < 1 or not 0 < k["y"] < 1 for k in out.values()):
        raise ValueError("Fall joint outside canvas")
    frames.append(list(out.values()))
request = {"action": "recline", "description": "Goku A1, complete solid outlined body, black spiky hair, plain orange gi with identical navy undershirt sash wristbands boots, visible complete limbs, isolated character",
           "direction": "east", "view": "side", "template_id": "mannequin", "no_background": True,
           "seed": 202610390, "first_frame_keypoints": [{**p, "z_index": round(p.get("z_index", 0) * 2)} for p in REF],
           "keypoints": frames}
(ROOT / "requests/death-continuous.json").write_text(json.dumps(request, indent=2) + "\n")
print("7 continuous fall skeletons on exact A1 bones")
