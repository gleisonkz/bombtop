"""Verify a coherent, unclipped Harry menu summoning sequence."""
import importlib.util
from pathlib import Path
import unittest

from PIL import Image

SPEC = importlib.util.spec_from_file_location("harry_menu", Path(__file__).with_name("pack-harry-lobby.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class HarryMenuTest(unittest.TestCase):
    def test_spell_sequence_starts_and_ends_at_rest(self):
        frames = PACK.build_frames()
        self.assertEqual(len(frames), 48)
        self.assertEqual(frames[0].tobytes(), frames[-1].tobytes())
        self.assertGreater(len({f.tobytes() for f in frames}), 30)

    def test_stag_circles_harry_with_facing_and_depth_following_its_motion(self):
        poses = [PACK.stag_pose(i) for i in range(48)]
        active = [p for p in poses if p is not None]
        self.assertTrue(all(poses[i] is None for i in [0, 10, 13, 40, 47]))
        self.assertLess(min(p["x"] for p in active), PACK.ANCHOR[0] - 60)
        self.assertGreater(max(p["x"] for p in active), PACK.ANCHOR[0] + 60)
        self.assertAlmostEqual(active[0]["x"], active[-1]["x"])
        self.assertTrue(any(p["behind"] for p in active))
        self.assertTrue(any(not p["behind"] for p in active))
        for index, pose in enumerate(active[1:-1], 1):
            dx = active[index + 1]["x"] - active[index - 1]["x"]
            self.assertEqual(pose["flip"], dx < 0)
            self.assertEqual(pose["behind"], pose["y"] < 183.5)
        self.assertLess(active[0]["alpha"], active[8]["alpha"])
        self.assertLess(active[-1]["alpha"], active[-8]["alpha"])

    def test_packing_keeps_every_frame_padded_and_matches_runtime(self):
        sheet = PACK.build_sheet()
        self.assertEqual(sheet.size, (15360, 208))
        self.assertEqual(sheet.tobytes(), Image.open(PACK.OUTPUT).tobytes())
        for frame in PACK.build_frames():
            left, top, right, bottom = frame.getbbox()
            self.assertGreaterEqual(min(left, top, PACK.WIDTH - right, PACK.HEIGHT - bottom), 3)
        self.assertLess(PACK.OUTPUT.stat().st_size, 4 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
