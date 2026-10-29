"""Retarget COCO pose coordinates onto A1 anatomy. Never changes image pixels."""
import copy
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
CHAINS = [("NECK", f"{side} {part}", parent)
          for side in ("RIGHT", "LEFT")
          for part, parent in (("SHOULDER", "NECK"), ("ELBOW", f"{side} SHOULDER"),
                               ("ARM", f"{side} ELBOW"), ("HIP", "NECK"),
                               ("KNEE", f"{side} HIP"), ("LEG", f"{side} KNEE"))]
HEAD = ("NOSE", "RIGHT EYE", "LEFT EYE", "RIGHT EAR", "LEFT EAR")
REFERENCES = {}
for direction in ("south", "east", "north"):
    points = json.loads((ROOT / "skeletons" / f"reference-{direction}.json").read_text())["keypoints"]
    REFERENCES[direction] = {p["label"]: {**p, "x": p["x"] * 128, "y": p["y"] * 160} for p in points}


def read_pose(name, width=146, height=192):
    data = json.loads((ROOT / "skeletons" / f"pose-{name}.json").read_text())
    return {p["label"]: {**p, "x": p["x"] * width, "y": p["y"] * height} for p in data["keypoints"]}


def vector(points, a, b):
    return points[b]["x"] - points[a]["x"], points[b]["y"] - points[a]["y"]


def dist(points, a, b):
    return math.hypot(*vector(points, a, b))


def normalize(points, direction):
    result = []
    for name, p in points.items():
        k = {"label": name, "x": round(p["x"] / 128, 7), "y": round(p["y"] / 160, 7),
             "z_index": round(p.get("z_index", 0) * 2)}
        if direction == "north" and name in ("NOSE", "RIGHT EYE", "LEFT EYE"):
            k.update(depth=64, z_index=-30)
        result.append(k)
    return result


def retarget(pose, direction, baseline, grounded):
    ref = REFERENCES[direction]
    ref_ankle = (ref["RIGHT LEG"]["y"] + ref["LEFT LEG"]["y"]) / 2
    base_ankle = (baseline["RIGHT LEG"]["y"] + baseline["LEFT LEG"]["y"]) / 2
    scale = (ref_ankle - ref["NECK"]["y"]) / (base_ankle - baseline["NECK"]["y"])
    out = copy.deepcopy(pose)
    out["NECK"]["x"] = ref["NECK"]["x"] + (pose["NECK"]["x"] - baseline["NECK"]["x"]) * scale
    out["NECK"]["y"] = ref["NECK"]["y"] + (pose["NECK"]["y"] - baseline["NECK"]["y"]) * scale
    for _, name, parent in CHAINS:
        dx, dy = vector(pose, parent, name)
        length = math.hypot(dx, dy)
        if length < .1:
            dx, dy = vector(ref, parent, name)
            length = math.hypot(dx, dy)
        ratio = dist(ref, parent, name) / length
        out[name]["x"] = out[parent]["x"] + dx * ratio
        out[name]["y"] = out[parent]["y"] + dy * ratio
    # Pose can tilt the head, but never supplies old eye/ear spacing or head size.
    target = vector(pose, "NECK", "NOSE")
    rest = vector(baseline, "NECK", "NOSE")
    angle = math.atan2(target[1], target[0]) - math.atan2(rest[1], rest[0])
    if grounded and abs(angle) > .45:
        angle = max(-.45, min(.45, angle))
    cs, sn = math.cos(angle), math.sin(angle)
    for name in HEAD:
        dx, dy = vector(ref, "NECK", name)
        out[name]["x"] = out["NECK"]["x"] + dx * cs - dy * sn
        out[name]["y"] = out["NECK"]["y"] + dx * sn + dy * cs
    desired = max(ref["RIGHT LEG"]["y"], ref["LEFT LEG"]["y"]) + (
        max(pose["RIGHT LEG"]["y"], pose["LEFT LEG"]["y"]) -
        max(baseline["RIGHT LEG"]["y"], baseline["LEFT LEG"]["y"])) * scale
    # Register the posed skeleton to its ground contact, leaving room for boots.
    # This translates coordinates only; body segment lengths remain unchanged.
    desired = min(145, desired)
    shift = desired - max(out["RIGHT LEG"]["y"], out["LEFT LEG"]["y"])
    for p in out.values():
        p["y"] += shift
    for _, name, parent in CHAINS:
        if abs(dist(out, parent, name) - dist(ref, parent, name)) > 1e-6:
            raise ValueError(f"Bone length drift: {name}")
    if any(not 1 <= p["x"] <= 127 or not 1 <= p["y"] <= 158 for p in out.values()):
        raise ValueError("Retargeted joints leave the native canvas: " + str([
            (name, round(p["x"], 2), round(p["y"], 2)) for name, p in out.items()
            if not 1 <= p["x"] <= 127 or not 1 <= p["y"] <= 158]))
    return normalize(out, direction)


def main():
    folder = ROOT / "retargeted"
    folder.mkdir(exist_ok=True)
    requests = ROOT / "requests"
    requests.mkdir(exist_ok=True)
    baselines = {di: read_pose(f"r{r:02d}-c00") for di, r in (("south", 0), ("east", 1), ("north", 2))}
    actions = ("idle", "idle", "idle", "walk", "walk", "walk", "recoil", "fall",
               "gesture", "gesture", "gesture", "held stance", "held stance", "held stance",
               "held walk", "held walk", "held walk", "celebrate")
    records = []
    for row, count in enumerate(COUNTS):
        direction = "east" if row in (1, 4, 9, 12, 15) else "north" if row in (2, 5, 10, 13, 16) else "south"
        frames = []
        poses = []
        for col in range(count):
            name = f"r{row:02d}-c{col:02d}"
            try:
                points = retarget(read_pose(name), direction, baselines[direction], row != 7)
            except ValueError as exc:
                raise ValueError(f"{name}: {exc}") from exc
            (folder / f"{name}.json").write_text(json.dumps(points, indent=2) + "\n")
            frames.append(points)
            poses.append(name)
        args = {"action": actions[row], "description": "Goku A1, black swept hair, black eyes, plain orange gi with identical navy blue undershirt sash wristbands and boots, bare empty hands, single isolated character",
                "direction": direction, "view": "side", "template_id": "mannequin", "no_background": True,
                "seed": 202610370, "first_frame_keypoints": normalize(REFERENCES[direction], direction), "keypoints": frames}
        (requests / f"row{row:02d}.json").write_text(json.dumps(args, indent=2) + "\n")
        records.append({"row": row, "direction": direction, "poses": poses, "request": f"requests/row{row:02d}.json"})
    (ROOT / "pose-contract.json").write_text(json.dumps(records, indent=2) + "\n")
    # Menu/transformation is the same A1 body; only a derived hair-colour state changes.
    menu = [retarget(read_pose(f"lobby-{i}", 128, 207), "south",
                     read_pose("lobby-0", 128, 207), True) for i in range(8)]
    (folder / "lobby.json").write_text(json.dumps(menu, indent=2) + "\n")
    print("108 pose skeletons + 8 menu skeletons retargeted to fixed A1 bone lengths")


if __name__ == "__main__":
    main()
