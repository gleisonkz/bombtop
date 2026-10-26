"""Read-only structural checks; image authoring is exclusively Pixelart MCP."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
path = ROOT / "apps/client/public/sprites/picanha-pixel.png"
image = Image.open(path).convert("RGBA")
assert image.size == (256, 64), image.size
alpha = sorted(set(image.getchannel("A").getdata()))
assert alpha == [0, 255], alpha
frames = [image.crop((i * 64, 0, (i + 1) * 64, 64)) for i in range(4)]
hashes = [hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames]
assert len(set(hashes)) == 4, hashes
body = frames[0].crop((0, 25, 64, 64)).tobytes()
assert all(frame.crop((0, 25, 64, 64)).tobytes() == body for frame in frames)
for frame in frames:
    assert frame.getbbox() is not None
    assert all(frame.getpixel((x, y))[3] == 0 for x in range(64) for y in [0, 63])
    assert all(frame.getpixel((x, y))[3] == 0 for y in range(64) for x in [0, 63])
report = {
    "size": list(image.size), "frameSize": [64, 64], "frames": 4,
    "alphaValues": alpha, "uniqueFrames": len(set(hashes)),
    "sha256RgbaFrames": hashes, "bounds": [frame.getbbox() for frame in frames],
    "fixedMeatBody": True, "transparentFrameBorders": True,
}
Path(__file__).with_name("picanha-qa.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
