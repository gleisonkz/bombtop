"""Validate reviewed scoreboard regions against the current original character PNGs."""
import json
from pathlib import Path
import re
import unittest

import numpy as np
from PIL import Image, ImageDraw

CLIENT = Path(__file__).resolve().parents[1]
PROFILES = json.loads((CLIENT / "src/render/score-portraits.json").read_text())


class ScorePortraitTests(unittest.TestCase):
    def test_all_eighteen_profiles_match_current_sheet_and_preserve_visible_heads(self):
        source = (CLIENT / "src/render/sprites.ts").read_text(encoding="utf-8")
        self.assertEqual(len(PROFILES), 18)
        for name, profile in PROFILES.items():
            with self.subTest(character=name):
                block = re.search(r"^  " + name + r": \{(.*?)(?=^  \},)", source, re.M | re.S)[1]
                url = re.search(r'url: "([^"?]+)', block)[1]
                self.assertEqual(profile["url"], url)
                frame = [int(re.search(key + r": (\d+)", block)[1]) for key in ("frameW", "frameH")]
                self.assertEqual(profile["frame"], frame)
                image = Image.open(CLIENT / "public" / url).convert("RGBA")
                x, y, w, h = profile["crop"]
                self.assertGreaterEqual(min(x, y), 0)
                self.assertLessEqual(x + w, frame[0])
                self.assertLessEqual(y + h, frame[1])
                mask = Image.new("L", tuple(frame), 255)
                if "outline" in profile:
                    mask = Image.new("L", tuple(frame))
                    ImageDraw.Draw(mask).polygon([tuple(point) for point in profile["outline"]], fill=255)
                alpha = np.asarray(image.crop((0, 0, *frame)))[:, :, 3]
                visible = (alpha[y:y+h, x:x+w] > 32) & (np.asarray(mask)[y:y+h, x:x+w] > 0)
                self.assertGreater(int(visible.sum()), 200)
                ys, xs = np.where(visible)
                width, height = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
                box = profile.get("box", (13, 13))
                scale = min(box[0] / width, box[1] / height)
                self.assertLessEqual(width * scale, box[0] + 0.000001)
                self.assertLessEqual(height * scale, box[1] + 0.000001)
                self.assertGreaterEqual(profile.get("bottom", 14.5) - height * scale, 0.499999)
                offset = -5 - max(0, (width * scale - 13) / 2)
                self.assertGreater(3 - (offset + width * scale / 2), 1)

    def test_reviewed_chins_and_identity_details_stay_inside_the_crop(self):
        landmarks = {"lula": (96, 92), "pikachu": (94, 94), "donatello": (139, 133), "bomber": (57, 101), "naruto": (48, 62)}
        for name, point in landmarks.items():
            with self.subTest(character=name):
                profile = PROFILES[name]
                x, y, w, h = profile["crop"]
                self.assertTrue(x <= point[0] < x + w and y <= point[1] < y + h)
                mask = Image.new("L", tuple(profile["frame"]), 255)
                if "outline" in profile:
                    mask = Image.new("L", tuple(profile["frame"]))
                    ImageDraw.Draw(mask).polygon([tuple(p) for p in profile["outline"]], fill=255)
                self.assertEqual(mask.getpixel(point), 255)
                original = Image.open(CLIENT / "public" / profile["url"]).convert("RGBA")
                self.assertGreater(original.getpixel(point)[3], 32)


if __name__ == "__main__":
    unittest.main()
