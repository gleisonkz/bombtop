"""Generate eased in-between COCO poses. PixelLab draws every output frame."""
import copy
import json
import math
from pathlib import Path
from transform import blend

ROOT = Path(__file__).resolve().parent
source = json.loads((ROOT / "retargeted/transform12.json").read_text())
for phase in (0, 1):
    request = json.loads((ROOT / "requests" / ("lobby0.json" if phase == 0 else "gold-final.json")).read_text(encoding="utf-8-sig"))
    frames = []
    for index in range(12):
        t = index / 11
        position = 5 * (.5 - .5 * math.cos(math.pi * t))
        a = min(4, math.floor(position))
        points = blend(source[phase * 6 + a], source[phase * 6 + a + 1], position - a)
        by_name = {p["label"]: p for p in points}
        neck = by_name["NECK"]
        # Restrained head follow-through, with the canonical eye/ear spacing.
        angle = -.10 * t if phase == 0 else -.10 * (1 - t) + .025 * math.sin(math.pi * t)
        cs, sn = math.cos(angle), math.sin(angle)
        for name in ("NOSE", "LEFT EYE", "RIGHT EYE", "LEFT EAR", "RIGHT EAR"):
            p = by_name[name]
            dx, dy = (p["x"] - neck["x"]) * 128, (p["y"] - neck["y"]) * 160
            p["x"] = neck["x"] + (dx * cs - dy * sn) / 128
            p["y"] = neck["y"] + (dx * sn + dy * cs) / 160
        sway = (.7 * math.sin(t * math.pi * 3) * math.sin(t * math.pi)) / 128
        for point in points:
            point["x"] = round(point["x"] + sway, 7)
        frames.append(points)
    request.update(keypoints=frames, seed=202610391)
    if phase == 0:
        request["description"] = "Goku A1, sharp determined brows, clenched fists, strained expression, plain orange gi with identical navy undershirt sash wristbands boots, solid isolated character"
    (ROOT / "requests" / f"fluid-{'black' if phase == 0 else 'gold'}.json").write_text(json.dumps(request, indent=2) + "\n")
print("24 eased pose skeletons, with fixed A1 anatomy and head follow-through")
