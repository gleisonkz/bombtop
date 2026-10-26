"""Promote the packed Donatello and update only its reviewed JSON profiles."""
import json
from pathlib import Path
import shutil

from PIL import Image

ART = Path(__file__).resolve().parent
ROOT = ART.parents[2]
CLIENT = ROOT / "apps/client"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    manifest = read(ART / "manifest.json")
    image = Image.open(ART / "donatello-candidate.png").convert("RGBA")
    if list(image.size) != manifest["size"] or manifest["frame_count"] != 111:
        raise ValueError("Incomplete candidate")
    frame_width, frame_height = manifest["cell"]
    palms = {"frameW": frame_width, "frameH": frame_height, "rows": {}}
    for row in manifest["rows"][11:17]:
        palms["rows"][str(row["row"])] = [
            [[x + 0.5, y + 0.5] for x, y in frame] for frame in row["palms"]]
    write(ART / "palms.json", palms)
    portraits_path = CLIENT / "src/render/score-portraits.json"
    portraits = read(portraits_path)
    left, top, right, bottom = manifest["rows"][0]["headbounds"][0]
    portraits["donatello"] = {"frame": [frame_width, frame_height], "crop": [left, top, right - left, bottom - top],
                              "url": "sprites/donatello.png"}
    write(portraits_path, portraits)
    bounds_path = CLIENT / "src/ui/cast-animation-bounds.json"
    bounds = read(bounds_path)
    lobby = manifest["rows"][17]["bounds"]
    bounds["donatello"] = [min(box[0] for box in lobby), max(box[2] for box in lobby)]
    bounds_path.write_text("{\n" + ",\n".join(f"  {json.dumps(name)}: {json.dumps(value)}"
                                             for name, value in bounds.items()) + "\n}\n")
    shutil.copyfile(ART / "donatello-candidate.png", CLIENT / "public/sprites/donatello.png")
    print("Promoted 111 Donatello frames; portrait, menu bounds and 50 palm coordinates updated.")


if __name__ == "__main__":
    main()
