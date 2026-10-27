"""Retarget pose coordinates onto the approved rig; never edit sprite pixels."""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


mapping = read(HERE / "pose-map.json")
uploads = read(HERE / "reference/uploads.json")
head_labels = {"NOSE", "LEFT EYE", "RIGHT EYE", "LEFT EAR", "RIGHT EAR"}
references = {direction: read(HERE / "skeletons" / f"reference-{direction}-padded.json")["keypoints"]
              for direction in ("south", "east", "north")}


def old_points(pose, direction):
    meta = mapping["poses"][pose]
    points = {point["label"]: (point["x"] * meta["width"], point["y"] * meta["height"])
              for point in read(HERE / "skeletons" / f"{pose}.json")["keypoints"]}
    if direction == "north":
        # The estimator can reverse ankles independently from the hips, or
        # switch anatomical sides mid-clip. Back-view paired joints must use
        # one consistent image-side convention before computing motion deltas.
        for joint in ("SHOULDER", "ELBOW", "ARM", "HIP", "KNEE", "LEG"):
            left, right = "LEFT " + joint, "RIGHT " + joint
            if points[left][0] > points[right][0]:
                points[left], points[right] = points[right], points[left]
    return points


def reference_points(direction):
    return {point["label"]: dict(point, z_index=round(point["z_index"] * 2))
            for point in references[direction]}


def retarget(pose, direction, neutral):
    old, rest = old_points(pose, direction), old_points(neutral, direction)
    ref = reference_points(direction)
    height_old = sum(rest[label][1] for label in ("LEFT LEG", "RIGHT LEG")) / 2 - rest["NECK"][1]
    height_new = (sum(ref[label]["y"] * 192 for label in ("LEFT LEG", "RIGHT LEG")) / 2
                  - ref["NECK"]["y"] * 192)
    motion_scale = min(1.5, max(0.5, height_new / height_old))
    result = {}
    for label, point in ref.items():
        result[label] = dict(point,
                             x=point["x"] + (old[label][0] - rest[label][0]) * motion_scale / 192,
                             y=point["y"] + (old[label][1] - rest[label][1]) * motion_scale / 192)
    angle = 0
    if mapping["poses"][pose]["sheet"] == "gameplay" and mapping["poses"][pose]["row"] in (6, 7):
        angle = (math.atan2(old["NOSE"][1] - old["NECK"][1], old["NOSE"][0] - old["NECK"][0])
                 - math.atan2(rest["NOSE"][1] - rest["NECK"][1], rest["NOSE"][0] - rest["NECK"][0]))
    for label in head_labels:
        dx, dy = ref[label]["x"] - ref["NECK"]["x"], ref[label]["y"] - ref["NECK"]["y"]
        result[label].update(x=result["NECK"]["x"] + dx * math.cos(angle) - dy * math.sin(angle),
                             y=result["NECK"]["y"] + dx * math.sin(angle) + dy * math.cos(angle))
    if direction == "north":
        for label in head_labels:
            hidden = label == "NOSE" or "EYE" in label
            result[label].update(depth=16 if hidden else 140, z_index=-20 if hidden else 4)
    for point in result.values():
        if not 0 <= point["x"] <= 1 or not 0 <= point["y"] <= 1:
            raise ValueError(f"{pose}: joint outside generation canvas: {point}")
    return list(result.values())


actions = ["idle breathing", "idle breathing", "idle breathing", "walking in place", "walking in place",
           "walking in place", "stunned recoil, blink in pain", "defeated falling backward, eyes closed",
           "hand to lips then blow kiss, no heart", "hand to lips then blow kiss, no heart",
           "hand to lips then blow kiss, no heart", "empty raised hands ready to carry",
           "empty raised hand ready to carry", "empty raised hands ready to carry",
           "walking with empty raised hands", "walking with empty raised hand", "walking with empty raised hands"]
requests = []
for row, action in enumerate(actions):
    direction = "east" if row in (1, 4, 9, 12, 15) else "north" if row in (2, 5, 10, 13, 16) else "south"
    poses = [pose for pose in mapping["unique_poses"] if mapping["poses"][pose]["sheet"] == "gameplay"
             and mapping["poses"][pose]["row"] == row]
    requests.append(dict(name=f"gameplay-{row:02}", sheet="gameplay", row=row, direction=direction,
                         action=action, poses=poses, neutral={"south": "g-r00-c00", "east": "g-r01-c00", "north": "g-r02-c00"}[direction]))
for sheet, prefix in (("lobby", "l"), ("victory", "v")):
    poses = [pose for pose in mapping["unique_poses"] if mapping["poses"][pose]["sheet"] == sheet]
    for index in range(0, len(poses), 8):
        action = ("touch cheek and hair, empty hands, no effects" if sheet == "lobby"
                  else "jump for joy and wave empty hand, no flag or effects")
        requests.append(dict(name=f"{sheet}-{index // 8}", sheet=sheet, row=0, direction="south",
                             action=action, poses=poses[index:index + 8], neutral=f"{prefix}-c00"))
for request in requests:
    direction = request["direction"]
    request["first_frame_url"] = uploads[direction]
    reference = reference_points(direction)
    if direction == "north":
        for label in head_labels:
            hidden = label == "NOSE" or "EYE" in label
            reference[label].update(depth=16 if hidden else 140, z_index=-20 if hidden else 4)
    request["first_frame_keypoints"] = list(reference.values())
    request["keypoints"] = [retarget(pose, direction, request["neutral"]) for pose in request["poses"]]
    while len(request["keypoints"]) < 3:
        request["keypoints"].append(request["keypoints"][0])
    request["output_count"] = len(request["keypoints"])
(HERE / "requests.json").write_text(json.dumps(requests, indent=2) + "\n", encoding="utf-8")
print(f"Prepared {len(requests)} clips covering {sum(len(r['poses']) for r in requests)} unique source poses")
