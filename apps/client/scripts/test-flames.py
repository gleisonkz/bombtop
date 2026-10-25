import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image
from scipy import ndimage


SCRIPT = Path(__file__).with_name("build-flames.py")
SPEC = importlib.util.spec_from_file_location("build_flames", SCRIPT)
flames = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(flames)


class FlameAtlasTest(unittest.TestCase):
    def test_smooth_contours_and_shading_match_the_hd_arena(self):
        sheet = Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA")
        pixels = np.asarray(sheet)
        self.assertGreater(len(sheet.getcolors(sheet.width * sheet.height)), 32)
        self.assertTrue(np.any((pixels[:, :, 3] > 0) & (pixels[:, :, 3] < 255)))
        self.assertGreaterEqual(int(pixels[64, 64, 3]), 240)

    def test_center_and_arm_share_the_same_join_profile(self):
        sheet = np.asarray(Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA"))
        for frame in range(5):
            x = frame * 128
            center_join = sheet[128:256, x + 127]
            for row in range(1, 6):
                join = sheet[row * 128:(row + 1) * 128, x]
                np.testing.assert_array_equal(center_join, join, err_msg=f"Pinched join at stage {frame}, row {row}")
            for row in range(1, 5):
                join = sheet[row * 128:(row + 1) * 128, x + 127]
                np.testing.assert_array_equal(center_join, join)

    def test_junction_has_more_luminous_mass_than_the_arm(self):
        sheet = np.asarray(Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA"))
        for frame in range(4):
            x = frame * 128
            center = sheet[:128, x:x + 128]
            arm = sheet[128:256, x:x + 128]
            center_hot = np.sum((center[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722])) * (center[:, :, 3] / 255)) * (20 / 16) ** 2
            arm_hot = np.sum((arm[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722])) * (arm[:, :, 3] / 255))
            self.assertGreaterEqual(center_hot, arm_hot * 1.25)

    def test_every_arm_connects_its_left_and_right_edges(self):
        sheet = np.asarray(Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA"))
        for frame in range(5):
            for row in range(1, 5):
                alpha = sheet[row * 128:(row + 1) * 128, frame * 128:(frame + 1) * 128, 3]
                labels, _ = ndimage.label(alpha >= 64)
                left = set(labels[:, 0]) - {0}
                right = set(labels[:, -1]) - {0}
                self.assertTrue(left & right, (frame, row, "Disconnected connector"))

    def test_committed_atlas_matches_its_builder(self):
        actual = Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA")
        self.assertEqual(actual.tobytes(), flames.build_sheet().tobytes())

    def test_four_distinct_arm_variants(self):
        sheet = Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA")
        self.assertEqual(sheet.size, (640, 768))
        for frame in range(5):
            variants = {sheet.crop((frame * 128, row * 128, (frame + 1) * 128, (row + 1) * 128)).tobytes() for row in range(1, 5)}
            self.assertEqual(len(variants), 4)

    def test_joined_core_survives_all_stages(self):
        sheet = flames.build_sheet()
        self.assertEqual(sheet.size, (640, 768))
        for frame in range(flames.FRAMES):
            for row in range(flames.ROWS):
                cell = sheet.crop((frame * 128, row * 128, (frame + 1) * 128, (row + 1) * 128))
                pixels = np.asarray(cell)
                joins = [pixels[64, 0, 3]] if row != 0 else [pixels[64, 64, 3]]
                if row not in (0, flames.ROWS - 1):
                    joins.append(pixels[64, -1, 3])
                self.assertTrue(all(alpha >= 220 for alpha in joins), (frame, row, joins))
                self.assertLessEqual(int(pixels[0, 0, 3]), 16)

    def test_every_variant_pair_connects_at_gameplay_size_and_mixed_ages(self):
        sheet = Image.open(flames.ROOT / "public/sprites/flames.png").convert("RGBA")
        for left_stage in range(5):
            for right_stage in range(5):
                for left_row in range(1, 5):
                    for right_row in range(1, 6):
                        strip = Image.new("RGBA", (32, 16))
                        for x, frame, row in ((0, left_stage, left_row), (16, right_stage, right_row)):
                            cell = sheet.crop((frame * 128, row * 128, (frame + 1) * 128, (row + 1) * 128))
                            strip.alpha_composite(cell.resize((16, 16), Image.Resampling.LANCZOS), (x, 0))
                        alpha = np.asarray(strip)[:, :, 3]
                        labels, _ = ndimage.label(alpha >= 32, structure=np.ones((3, 3)))
                        left = set(labels[:, 0]) - {0}
                        right = set(labels[:, 24]) - {0}
                        self.assertTrue(left & right, (left_stage, right_stage, left_row, right_row))

    def test_stages_are_distinct(self):
        sheet = flames.build_sheet()
        for row in range(flames.ROWS):
            frames = {sheet.crop((f * 128, row * 128, (f + 1) * 128, (row + 1) * 128)).tobytes() for f in range(5)}
            self.assertEqual(len(frames), 5)


if __name__ == "__main__":
    unittest.main()
