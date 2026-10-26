import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/tiles/sb4-battle"
OUTPUT = ROOT / "apps/client/public/sprites/sb4-battle"


class Sb4TileAssets(unittest.TestCase):
    def test_casino_and_theater_floor_edges_do_not_include_the_next_source_row(self):
        with Image.open(OUTPUT / "tiles-08.png") as image:
            red, green, blue, _ = ImageStat.Stat(image.crop((0, 120, 768, 128))).mean
            self.assertGreater(red, 180, "Casino floor edge must remain cream, not the next teal row")
            self.assertGreater(green, blue)
        with Image.open(OUTPUT / "tiles-10.png") as image:
            red, green, _, _ = ImageStat.Stat(image.crop((0, 120, 768, 128))).mean
            self.assertGreater(green, red, "Theater floor edge must remain green, not the next brown row")

    def test_all_twelve_material_sets_have_valid_distinct_cells(self):
        hashes = set()
        manifest = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))
        for entry in manifest["stages"]:
            with self.subTest(stage=entry["number"]):
                path = OUTPUT / entry["file"]
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), entry["sha256"])
                with Image.open(path) as image:
                    self.assertEqual(image.size, (1920, 128))
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(image.crop((0, 0, 1152, 128)).getchannel("A").getextrema(), (255, 255))
                    frames = [image.crop((i * 128, 0, (i + 1) * 128, 128)) for i in range(15)]
                    self.assertEqual(len({frame.tobytes() for frame in frames}), 15)
                    self.assertEqual(frames[9].crop((0, 0, 128, 32)).tobytes(), frames[6].crop((0, 0, 128, 32)).tobytes())
                    self.assertEqual(frames[10].getchannel("A").getbbox(), (1, 5, 127, 128))
                    self.assertEqual(frames[11].getchannel("A").getbbox(), (3, 12, 125, 128))
                    hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
        self.assertEqual(len(hashes), 12)

    def test_props_have_true_alpha_empty_gutters_and_distinct_static_cells(self):
        with Image.open(OUTPUT / "props.png") as image:
            self.assertEqual(image.size, (1536, 128))
            self.assertEqual(image.mode, "RGBA")
            cells = []
            for index in range(12):
                cell = image.crop((index * 128, 0, (index + 1) * 128, 128))
                alpha = cell.getchannel("A")
                self.assertEqual(alpha.getextrema(), (0, 255))
                left, top, right, bottom = alpha.getbbox()
                self.assertGreaterEqual(left, 8)
                self.assertGreaterEqual(top, 8)
                self.assertLessEqual(right, 120)
                self.assertLessEqual(bottom, 120)
                cells.append(cell.tobytes())
            self.assertEqual(len(set(cells)), 12)


if __name__ == "__main__":
    unittest.main()
