"""Image-contract checks for the supplied Pele sprite integration."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image


SPEC = importlib.util.spec_from_file_location("pack_pele", Path(__file__).with_name("pack-pele.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class PeleAtlasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with Image.open(PACK.OUTPUT) as image:
            cls.sheet = image.copy()
        with Image.open(PACK.SOURCE) as image:
            cls.source = image.convert("RGBA")

    def test_rgba_grid_and_reproducible_export(self):
        self.assertEqual(self.sheet.mode, "RGBA")
        self.assertEqual(self.sheet.size, (1440, 2880))
        self.assertEqual(self.sheet.tobytes(), PACK.build_sheet().tobytes())
        self.assertLess(PACK.OUTPUT.stat().st_size, 4 * 1024 * 1024)

    def test_every_pose_keeps_native_pixels_without_clipping_or_neighbors(self):
        for row, (source_row, columns) in enumerate(PACK.MAP):
            for column, source_column in enumerate(columns):
                size = PACK.CELL
                frame = self.sheet.crop((column * size, row * size, (column + 1) * size, (row + 1) * size))
                original = PACK.extract(self.source, source_row, source_column)
                bounds = frame.getchannel("A").getbbox()
                self.assertIsNotNone(bounds, (row, column))
                self.assertGreaterEqual(bounds[0], 2, (row, column))
                self.assertGreaterEqual(bounds[1], 2, (row, column))
                self.assertLessEqual(bounds[2], size - 2, (row, column))
                self.assertLessEqual(bounds[3], PACK.ANCHOR[1] + 3, (row, column))
                packed = frame.crop(bounds)
                self.assertEqual(packed.size, original.size, (row, column))
                self.assertEqual(packed.tobytes(), original.tobytes(), (row, column))

    def test_unused_cells_are_fully_transparent(self):
        for row, (_, columns) in enumerate(PACK.MAP):
            tail = self.sheet.crop((len(columns) * PACK.CELL, row * PACK.CELL, self.sheet.width, (row + 1) * PACK.CELL))
            self.assertIsNone(tail.getbbox(), row)

    def test_death_preserves_the_whole_horizontal_body(self):
        corpse = self.sheet.crop((5 * PACK.CELL, 7 * PACK.CELL, 6 * PACK.CELL, 8 * PACK.CELL))
        bounds = corpse.getchannel("A").getbbox()
        self.assertGreater(bounds[2] - bounds[0], 110)
        self.assertLess(bounds[3] - bounds[1], 60)

    def test_lobby_contains_seven_distinct_front_celebration_poses(self):
        frames = [self.sheet.crop((c * PACK.CELL, 17 * PACK.CELL, (c + 1) * PACK.CELL, 18 * PACK.CELL)) for c in range(7)]
        self.assertEqual(len({frame.tobytes() for frame in frames}), 7)
        for frame in frames:
            alpha = np.asarray(frame)[:, :, 3]
            self.assertGreater(np.count_nonzero(alpha > 64), 5000)


if __name__ == "__main__":
    unittest.main()
