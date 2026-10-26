"""Regression checks for Goku's registered lobby transformation artwork."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image


SPEC = importlib.util.spec_from_file_location("pack_goku_lobby", Path(__file__).with_name("pack-goku-lobby.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class GokuLobbyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with Image.open(PACK.OUTPUT) as image:
            cls.sheet = image.copy()
        cls.frames = [cls.sheet.crop((i * 192, 0, (i + 1) * 192, 207)) for i in range(16)]

    def test_runtime_contract_and_reproducible_export(self):
        self.assertEqual(self.sheet.mode, "RGBA")
        self.assertEqual(self.sheet.size, (3072, 207))
        self.assertEqual(self.sheet.tobytes(), PACK.build_sheet().tobytes())
        self.assertLess(PACK.OUTPUT.stat().st_size, 4 * 1024 * 1024)

    def test_frames_are_populated_and_isolated_with_transparent_gutters(self):
        for index, frame in enumerate(self.frames):
            alpha = np.asarray(frame)[:, :, 3]
            self.assertGreater(np.count_nonzero(alpha > 64), 3500, index)
            self.assertEqual(int(alpha[:2].max()), 0, index)
            self.assertEqual(int(alpha[-2:].max()), 0, index)
            self.assertEqual(int(alpha[:, :2].max()), 0, index)
            self.assertEqual(int(alpha[:, -2:].max()), 0, index)

    def test_boot_anchor_stays_registered_without_scaling_each_pose(self):
        for index, frame in enumerate(self.frames):
            pixels = np.asarray(frame).astype(float)
            blue = (pixels[:, :, 2] > pixels[:, :, 0] * 1.25) & (pixels[:, :, 2] > pixels[:, :, 1] * 1.05)
            blue &= pixels[:, :, 3] > 160
            blue[:175] = False
            ys, xs = np.where(blue)
            self.assertGreater(len(xs), 30, index)
            self.assertLessEqual(abs((xs.min() + xs.max()) / 2 - 96), 2, index)
            self.assertLessEqual(abs(int(ys.max()) - 192), 1, index)

    def test_gold_hair_changes_back_to_black_before_the_loop_ends(self):
        # Sample the interior of the hair, clear of the surrounding aura.
        def hair(index):
            return np.asarray(self.frames[index]).astype(float)[55:90, 70:125]

        def gold_count(pixels):
            return np.count_nonzero((pixels[:, :, 0] > 140) & (pixels[:, :, 1] > 90) &
                                    (pixels[:, :, 2] < pixels[:, :, 1] * 0.85) & (pixels[:, :, 3] > 128))

        self.assertGreater(gold_count(hair(7)), gold_count(hair(0)) + 400)
        self.assertLess(gold_count(hair(14)), gold_count(hair(7)) / 3)

    def test_action_frames_are_distinct_and_resting_loop_closes_exactly(self):
        self.assertEqual(len({frame.tobytes() for frame in self.frames[:-1]}), 15)
        self.assertEqual(self.frames[-1].tobytes(), self.frames[0].tobytes())


if __name__ == "__main__":
    unittest.main()
