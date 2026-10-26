"""Focused regression checks for packed-frame palm tracking and carry metadata."""
import importlib.util
import json
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("carry_anchors", Path(__file__).with_name("build-carry-anchors.py"))
ANCHORS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ANCHORS)


class CarryAnchorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.reports = ANCHORS.build()

    def test_tracks_known_translation_instead_of_inventing_motion(self):
        reference = np.zeros((180, 180, 4), dtype=np.float32)
        rng = np.random.default_rng(7)
        reference[43:58, 63:78] = rng.random((15, 15, 4))
        target = np.zeros_like(reference)
        target[40:55, 68:83] = reference[43:58, 63:78]
        point, report = ANCHORS.track(reference, target, (70, 50))
        self.assertEqual(point, (75, 47))
        self.assertEqual(report["error"], 0)

    def test_transparent_rgb_does_not_affect_matching(self):
        first = np.zeros((20, 20, 4), dtype=np.uint8)
        second = first.copy()
        second[:, :, :3] = 255
        np.testing.assert_array_equal(ANCHORS.rgba(Image.fromarray(first)), ANCHORS.rgba(Image.fromarray(second)))

    def test_covers_all_540_sockets_in_native_cell_units(self):
        characters = self.data["characters"]
        self.assertEqual(set(characters), set(ANCHORS.SEEDS))
        count = 0
        for name, character in characters.items():
            self.assertEqual(set(character["rows"]), {str(row) for row in range(11, 17)})
            for row, expected in zip(range(11, 17), ANCHORS.COUNTS):
                sockets = character["rows"][str(row)]
                self.assertEqual(len(sockets), expected)
                for socket in sockets:
                    self.assertEqual(set(socket), {"x", "y", "span"})
                    self.assertGreaterEqual(socket["x"], 0)
                    self.assertLess(socket["x"], character["frameW"])
                    self.assertGreaterEqual(socket["y"], 0)
                    self.assertLess(socket["y"], character["frameH"])
                    self.assertGreaterEqual(socket["span"], 0)
                    self.assertEqual(socket["span"] == 0, row in (12, 15))
                count += len(sockets)
        self.assertEqual(count, 540)

    def test_reference_frame_preserves_inspected_seed_conversion(self):
        for name, directions in ANCHORS.SEEDS.items():
            character = self.data["characters"][name]
            for direction, seeds in enumerate(directions):
                socket = character["rows"][str(11 + direction)][0]
                x = sum(p[0] for p in seeds) / len(seeds) * character["frameW"] / 180
                y = sum(p[1] for p in seeds) / len(seeds) * character["frameH"] / 180
                self.assertAlmostEqual(socket["x"], x, places=3)
                self.assertAlmostEqual(socket["y"], y, places=3)

    def test_spider_rig_palms_match_visible_gloves_in_every_carry_frame(self):
        image = Image.open(ANCHORS.CLIENT / "public/sprites/spider.png").convert("RGBA")
        profile = self.data["characters"]["spider"]
        for row, frames in ANCHORS.SPIDER_PALMS["rows"].items():
            for column, palms in enumerate(frames):
                socket = profile["rows"][row][column]
                self.assertAlmostEqual(socket["x"], sum(point[0] for point in palms) / len(palms), places=3)
                self.assertAlmostEqual(socket["y"], sum(point[1] for point in palms) / len(palms), places=3)
                for x, y in palms:
                    self.assertLess(y, 50, "Overhead glove must not drift down to the elbow")
                    self.assertGreater(image.getpixel((column * 130 + int(x), int(row) * 161 + int(y)))[3], 128)

    def test_every_remaining_flag_has_explicit_review_or_occlusion(self):
        unresolved = []
        for report in self.reports:
            if report["flags"]:
                self.assertIn("review", report, report)
            if "occluded-palm" in report["flags"]:
                unresolved.append((report["character"], report["row"], report["frame"], report["palm"]))
        self.assertEqual(unresolved, [])

    def test_checked_in_json_is_reproducible(self):
        expected = json.dumps(self.data, indent=2, allow_nan=False) + "\n"
        self.assertEqual(ANCHORS.OUTPUT.read_text(encoding="utf-8"), expected)


if __name__ == "__main__":
    unittest.main()
