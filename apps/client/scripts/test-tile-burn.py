"""Production grid, preservation and animation checks for the complete tile atlas."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

CLIENT = Path(__file__).resolve().parents[1]
CONCEPT = CLIENT.parents[1] / "concept/tiles"
SPEC = importlib.util.spec_from_file_location("pack_tile_burn", Path(__file__).with_name("pack_tile_burn.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class TileBurnTests(unittest.TestCase):
    def setUp(self):
        self.sheet = Image.open(CLIENT / "public/sprites/tiles.png").convert("RGBA")

    def test_complete_atlas_preserves_all_nine_static_tiles(self):
        self.assertEqual(self.sheet.size, (1920, 128))
        original = Image.open(CONCEPT / "tiles-before-burn.png").convert("RGBA")
        self.assertEqual(self.sheet.crop((0, 0, 1152, 128)).tobytes(), original.crop((0, 0, 1152, 128)).tobytes())

    def test_six_rgba_frames_are_distinct_and_reproducible(self):
        frames = PACK.burning()
        self.assertEqual(len(frames), 6)
        self.assertEqual(len({frame.tobytes() for frame in frames}), 6)
        for index, frame in enumerate(frames):
            self.assertEqual(frame.mode, "RGBA")
            self.assertEqual(frame.size, (128, 128))
            self.assertEqual(frame.tobytes(), self.sheet.crop(((9 + index) * 128, 0, (10 + index) * 128, 128)).tobytes())

    def test_full_size_brick_footprint_and_ash_dissipation(self):
        frames = [np.asarray(frame) for frame in PACK.burning()]
        for index, min_width in enumerate((120, 115)):
            y, x = np.where(frames[index][:, :, 3] > 128)
            self.assertGreaterEqual(int(x.max() - x.min() + 1), min_width)
            self.assertGreaterEqual(int(y.max() - y.min() + 1), 120)
            self.assertGreater(float(frames[index][:, :, 3].sum()), 128 * 128 * 255 * 0.7)
        baselines = [int(np.where(frame[:, :, 3] > 128)[0].max()) for frame in frames]
        self.assertLessEqual(max(baselines) - min(baselines), 3)
        self.assertLess(float(frames[-1][:, :, 3].sum()), float(frames[1][:, :, 3].sum()) * 0.3)
        # The final phase must not retain a yellow flame or opaque oval floor shadow.
        ash = frames[-1]
        hot = (ash[:, :, 0] > 220) & (ash[:, :, 1] > 170) & (ash[:, :, 3] > 100)
        self.assertLess(int(hot.sum()), 30)


if __name__ == "__main__":
    unittest.main()
