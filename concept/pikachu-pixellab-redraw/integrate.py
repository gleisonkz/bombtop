"""Install the accepted candidate and update only Pikachu-owned metadata."""
import hashlib
import json
from pathlib import Path
import re
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent
CLIENT = ROOT.parents[1] / "apps/client"


def update_json(path, key, value):
    data = json.loads(path.read_text(encoding="utf-8"))
    data[key] = value
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    candidate = ROOT / "pikachu-candidate.png"
    target = CLIENT / "public/sprites/pikachu.png"
    before = ROOT / "before-integration/pikachu.png"
    digest = lambda path: hashlib.sha256(path.read_bytes()).digest()
    if digest(target) not in (digest(before), digest(candidate)):
        raise ValueError("Production Pikachu changed during generation; compare before replacing")
    shutil.copyfile(candidate, target)
    sprites = CLIENT / "src/render/sprites.ts"
    source = sprites.read_text(encoding="utf-8")
    match = re.search(r"^  pikachu: \{.*?^  \},", source, re.M | re.S)
    if not match:
        raise ValueError("Pikachu runtime layout not found")
    block = re.sub(r'url: "[^"]+"', 'url: "sprites/pikachu.png?v=20261026-approved-paws-v3"', match[0], count=1)
    block = re.sub(r"bodyH: \d+", "bodyH: 129", block, count=1)
    sprites.write_text(source[:match.start()] + block + source[match.end():], encoding="utf-8")
    image = Image.open(candidate)
    boxes = [image.crop((col * 180, 17 * 164, (col + 1) * 180, 18 * 164)).getchannel("A").getbbox()
             for col in range(8)]
    bounds = [min(box[0] for box in boxes), max(box[2] for box in boxes)]
    update_json(CLIENT / "src/ui/cast-animation-bounds.json", "pikachu", bounds)
    update_json(CLIENT / "src/render/score-portraits.json", "pikachu", {
        "frame": [180, 164], "crop": [43, 28, 86, 73], "url": "sprites/pikachu.png",
        "outline": [[43, 28], [129, 28], [129, 76], [124, 76], [123, 88],
                    [119, 95], [108, 100], [80, 100], [68, 96], [61, 89],
                    [59, 80], [58, 70], [43, 60]],
    })
    print(f"Installed {target.name}; lobby bounds {bounds}; bodyH=129")


if __name__ == "__main__":
    main()
