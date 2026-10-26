"""Install Bugs option 1 and update only its existing runtime metadata."""
import hashlib
import json
from pathlib import Path
import re
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent
CLIENT = ROOT.parents[2] / "apps/client"


def update_json(path, key, value):
    data = json.loads(path.read_text(encoding="utf-8"))
    data[key] = value
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    candidate = ROOT / "bugs-candidate.png"
    target = CLIENT / "public/sprites/bugs.png"
    before = ROOT / "before-integration/bugs.png"
    current_hash = hashlib.sha256(target.read_bytes()).digest()
    permitted = [hashlib.sha256(path.read_bytes()).digest() for path in (before, candidate)]
    receipt = ROOT / "installed-sha256.txt"
    if receipt.is_file():
        permitted.append(bytes.fromhex(receipt.read_text().strip()))
    if current_hash not in permitted:
        raise ValueError("Production Bugs changed during generation; inspect before replacing")
    image = Image.open(candidate)
    if image.mode != "RGBA" or image.size != (1728, 3456):
        raise ValueError("Candidate does not satisfy the approved grid")
    sprites = CLIENT / "src/render/sprites.ts"
    text = sprites.read_text(encoding="utf-8")
    match = re.search(r"^  bugs: \{.*?^  \},", text, re.M | re.S)
    if not match:
        raise ValueError("Bugs runtime block not found")
    block = match[0]
    fields = {"width": 1728, "height": 3456, "frameW": 192, "frameH": 192,
              "anchorX": 96, "anchorY": 163, "bodyH": 127, "scale": 0.17}
    for field, value in fields.items():
        block, count = re.subn(r"(?m)^    " + field + r": [\d.]+,", f"    {field}: {value},", block)
        if count != 1:
            raise ValueError(f"Expected exactly one Bugs {field}")
    block = re.sub(r'url: "[^"]+"', 'url: "sprites/bugs.png?v=20261026-option1-v2"', block, count=1)
    shutil.copyfile(candidate, target)
    receipt.write_text(hashlib.sha256(candidate.read_bytes()).hexdigest() + "\n")
    sprites.write_text(text[:match.start()] + block + text[match.end():], encoding="utf-8")
    boxes = [image.crop((col * 192, 17 * 192, (col + 1) * 192, 18 * 192)).getchannel("A").getbbox()
             for col in range(8)]
    bounds = [min(box[0] for box in boxes), max(box[2] for box in boxes)]
    update_json(CLIENT / "src/ui/cast-animation-bounds.json", "bugs", bounds)
    update_json(CLIENT / "src/render/score-portraits.json", "bugs", {
        "frame": [192, 192], "crop": [75, 35, 46, 69], "url": "sprites/bugs.png",
        "box": [13, 15], "bottom": 15.5,
    })
    menu = CLIENT / "src/ui/cast-layout.ts"
    menu.write_text(re.sub(r"\bbugs: \d+", "bugs: 127", menu.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"Installed Bugs option 1: {image.size}; menu alpha bounds={bounds}")


if __name__ == "__main__":
    main()
