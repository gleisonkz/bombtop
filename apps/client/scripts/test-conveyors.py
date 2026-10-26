"""Structural contract for the approved-art conveyor atlas."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

SCRIPT = Path(__file__).with_name("pack-conveyors.py")


class ConveyorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("conveyors", SCRIPT)
        cls.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.pack)
        cls.sheet = cls.pack.build_sheet()

    def frame(self, row, phase):
        return self.sheet.crop((phase * 128, row * 128,
                                (phase + 1) * 128, (row + 1) * 128))

    def test_dimensions_and_opaque_pixels(self):
        self.assertEqual(self.sheet.size, (2048, 512))
        self.assertEqual(self.sheet.getchannel("A").getextrema(), (255, 255))
        self.assertGreater(np.asarray(self.sheet)[:, :, :3].max(axis=2).min(), 10)

    def test_unique_evenly_translated_phases_and_stationary_rails(self):
        first = np.asarray(self.frame(0, 0))
        self.assertEqual(len({self.frame(0, p).tobytes() for p in range(16)}), 16)
        rail = self.pack.RAIL_HEIGHT
        for phase in range(16):
            frame = np.asarray(self.frame(0, phase))
            np.testing.assert_array_equal(frame[:rail], first[:rail])
            np.testing.assert_array_equal(frame[-rail:], first[-rail:])
            np.testing.assert_array_equal(frame[rail:-rail],
                                          np.roll(first[rail:-rail], phase * 8, axis=1))
        np.testing.assert_array_equal(np.roll(first[rail:-rail], 16 * 8, axis=1),
                                      first[rail:-rail])

    def test_direction_rows_are_exact_rotations(self):
        rotations = (Image.Transpose.ROTATE_270, Image.Transpose.ROTATE_180,
                     Image.Transpose.ROTATE_90)
        for phase in range(16):
            for row, rotation in enumerate(rotations, 1):
                self.assertEqual(self.frame(row, phase).tobytes(),
                                 self.frame(0, phase).transpose(rotation).tobytes())

    def test_periodic_rail_edges(self):
        first = np.asarray(self.frame(0, 0)).astype(int)
        rail = self.pack.RAIL_HEIGHT
        for band in (first[:rail], first[-rail:]):
            self.assertLess(np.abs(band[:, 0, :3] - band[:, -1, :3]).mean(), 12)

    def test_rubber_wrap_seam_is_no_sharper_than_normal_texture(self):
        rail = self.pack.RAIL_HEIGHT
        rubber = np.asarray(self.frame(0, 0)).astype(int)[rail:-rail, :, :3]
        differences = np.abs(rubber - np.roll(rubber, 1, axis=1)).mean(axis=(0, 2))
        self.assertLessEqual(differences[0], differences[1:].mean())

    def test_reproducible_and_saved_output_current(self):
        self.assertEqual(self.sheet.tobytes(), self.pack.build_sheet().tobytes())
        with Image.open(self.pack.OUTPUT) as saved:
            self.assertEqual(saved.convert("RGBA").tobytes(), self.sheet.tobytes())


if __name__ == "__main__":
    unittest.main()
