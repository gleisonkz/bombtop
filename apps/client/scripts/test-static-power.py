"""Check the readable negative space and native animation contract of Static's aura."""
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]


class StaticPowerArtTest(unittest.TestCase):
    def setUp(self):
        self.image = Image.open(ROOT / "apps/client/public/sprites/static-power-pixel.png")

    def test_native_grid_palette_and_alpha(self):
        self.assertEqual(self.image.mode, "RGBA")
        self.assertEqual(self.image.size, (512, 128))
        self.assertEqual(set(self.image.getchannel("A").getdata()), {0, 255})
        self.assertLessEqual(len(self.image.getcolors()), 5)

    def test_open_chest_and_restrained_foreground(self):
        for row in range(2):
            for frame in range(8):
                cell = self.image.crop((frame * 64, row * 64, (frame + 1) * 64, (row + 1) * 64))
                with self.subTest(row=row, frame=frame):
                    self.assertIsNone(cell.crop((25, 10, 39, 54)).getbbox())
                    self.assertLessEqual(sum(a > 0 for a in cell.getchannel("A").getdata()), 270 if row == 0 else 100)
                    left, top, right, bottom = cell.getbbox()
                    self.assertGreaterEqual(min(left, top, 64 - right, 64 - bottom), 8)

    def test_eight_distinct_paired_phases(self):
        pairs = []
        for frame in range(8):
            back = self.image.crop((frame * 64, 0, (frame + 1) * 64, 64))
            front = self.image.crop((frame * 64, 64, (frame + 1) * 64, 128))
            pairs.append(back.tobytes() + front.tobytes())
        self.assertEqual(len(set(pairs)), 8)


if __name__ == "__main__":
    unittest.main()
