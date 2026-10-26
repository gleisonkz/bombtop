"""Pixel continuity from the original intact brick into the first burn stages.

Full-atlas/static-tile preservation remains covered by test-tile-burn.py.
"""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "pack_tile_burn", Path(__file__).with_name("pack_tile_burn.py")
)
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class TileContinuityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with Image.open(ROOT / "concept/tiles/intact-block-reference.png") as image:
            cls.original = np.asarray(image.convert("RGBA")).copy()
        cls.frames = PACK.ignition_frames()
        cls.packed = PACK.burning()[:3]

    def test_block_settles_slightly_without_drifting_from_its_floor_anchor(self):
        sizes = ((128, 128), (126, 123), (122, 116))
        for raw, packed, (width, height) in zip(self.frames, self.packed, sizes):
            with self.subTest(size=(width, height)):
                box = ((128 - width) // 2, 128 - height, (128 + width) // 2, 128)
                self.assertEqual(packed.getchannel("A").getbbox(), box)
                self.assertEqual(
                    packed.crop(box).tobytes(),
                    raw.resize((width, height), Image.Resampling.LANCZOS).tobytes(),
                    "Settling must transform the same bricks and fire together, without redrawing them",
                )

    def test_early_stages_keep_the_fully_opaque_intact_base(self):
        for stage, frame in enumerate(self.frames, start=1):
            with self.subTest(stage=stage):
                self.assertEqual(frame.size, (128, 128))
                self.assertEqual(frame.mode, "RGBA")
                self.assertTrue(
                    np.all(np.asarray(frame)[:, :, 3] == 255),
                    "Early burn overlays must retain the opaque original brick base",
                )

    def test_reserved_top_quarter_preserves_exact_original_pixels(self):
        for stage, frame in enumerate(self.frames, start=1):
            with self.subTest(stage=stage):
                self.assertTrue(
                    np.array_equal(np.asarray(frame)[:32], self.original[:32]),
                    "Overlay contract reserves rows 0–31 for the exact intact cap",
                )

    def test_damage_area_grows_progressively_with_bounded_early_changes(self):
        changed_areas = []
        for stage, (frame, limit) in enumerate(
            zip(self.frames, (0.25, 0.50, 0.75)), start=1
        ):
            changed = int(np.count_nonzero(np.any(np.asarray(frame) != self.original, axis=2)))
            changed_areas.append(changed)
            with self.subTest(stage=stage):
                self.assertGreater(changed, 0, "A burn stage must visibly alter the intact tile")
                self.assertLess(
                    changed / (128 * 128), limit,
                    f"Stage {stage}: {changed}/16384 pixels changed; limit is {limit:.0%}",
                )
        self.assertEqual(
            changed_areas, sorted(changed_areas),
            f"Damage area must grow monotonically: {changed_areas}",
        )


if __name__ == "__main__":
    unittest.main()
