"""Validate the native stun atlas and its replayable pixel source."""
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "apps/client/public/sprites/stun-effects-pixel-v2.png"


class StunAtlasTest(unittest.TestCase):
    def setUp(self):
        self.image = Image.open(ART)

    def test_twelve_unique_native_frames(self):
        self.assertEqual(self.image.mode, "RGBA")
        self.assertEqual(self.image.size, (768, 32))
        frames = [self.image.crop((i * 64, 0, (i + 1) * 64, 32)) for i in range(12)]
        self.assertEqual(len({frame.tobytes() for frame in frames}), 12)
        for frame in frames:
            left, top, right, bottom = frame.getbbox()
            self.assertGreaterEqual(min(left, top, 64 - right, 32 - bottom), 2)

    def test_binary_alpha_and_restricted_palette(self):
        self.assertEqual(set(self.image.getchannel("A").getdata()), {0, 255})
        self.assertLessEqual(len(self.image.getcolors()), 8)

    def test_source_replays_exact_art(self):
        source = json.loads((ROOT / "concept/stun/source-v2.json").read_text())
        expected = bytearray(768 * 32 * 4)
        for operation in source["operations"]:
            for point in operation["params"]["pixels"]:
                at = (point["y"] * 768 + point["x"]) * 4
                rgb = bytes.fromhex(point["color"][1:])
                expected[at:at + 4] = rgb + b"\xff"
        self.assertEqual(bytes(expected), self.image.tobytes())


if __name__ == "__main__":
    unittest.main()
