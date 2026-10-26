import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image


SCRIPT = Path(__file__).with_name("pack-ground-effects.py")
SPEC = importlib.util.spec_from_file_location("pack_ground_effects", SCRIPT)
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class GroundEffectsTests(unittest.TestCase):
    def setUp(self):
        self.sheet = Image.open(PACK.OUTPUT).convert("RGBA")

    def frame(self, row, frame):
        return self.sheet.crop((frame * 128, row * 128, (frame + 1) * 128, (row + 1) * 128))

    def test_grid_and_reproducible_export(self):
        self.assertEqual(self.sheet.size, (768, 256))
        self.assertEqual(self.sheet.tobytes(), PACK.build_sheet().tobytes())

    def test_all_twelve_frames_are_isolated_and_distinct(self):
        for row in range(2):
            hashes = set()
            for frame in range(6):
                image = self.frame(row, frame)
                alpha = np.asarray(image)[:, :, 3]
                self.assertGreater(np.count_nonzero(alpha > 64), 1000)
                self.assertLessEqual(int(alpha[:2].max()), 8)
                self.assertLessEqual(int(alpha[-2:].max()), 8)
                self.assertLessEqual(int(alpha[:, :2].max()), 8)
                self.assertLessEqual(int(alpha[:, -2:].max()), 8)
                hashes.add(image.tobytes())
            self.assertEqual(len(hashes), 6)

    def test_loop_silhouettes_keep_a_stable_anchor_and_size(self):
        for row in range(2):
            bounds, centers = [], []
            for frame in range(6):
                alpha = np.asarray(self.frame(row, frame))[:, :, 3].astype(float)
                ys, xs = np.where(alpha > 32)
                bounds.append((xs.max() - xs.min(), ys.max() - ys.min()))
                y, x = np.mgrid[:128, :128]
                centers.append(((x * alpha).sum() / alpha.sum(), (y * alpha).sum() / alpha.sum()))
            self.assertLessEqual(float(np.ptp(np.asarray(bounds), axis=0).max()), 3)
            self.assertLessEqual(float(np.ptp(np.asarray(centers), axis=0).max()), 1.5)

    def test_teleport_vortex_and_protection_marker_have_distinct_centers(self):
        for frame in range(6):
            portal = np.asarray(self.frame(0, frame))
            guard = np.asarray(self.frame(1, frame))
            self.assertGreaterEqual(int(portal[64, 64, 3]), 200)
            self.assertLessEqual(int(guard[64, 64, 3]), 16)

    def test_animation_survives_the_gameplay_draw_size(self):
        for row in range(2):
            frames = {self.frame(row, frame).resize((14, 14), Image.Resampling.LANCZOS).tobytes() for frame in range(6)}
            self.assertEqual(len(frames), 6)


if __name__ == "__main__":
    unittest.main()
