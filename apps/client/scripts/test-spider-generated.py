"""Read-only Spider asset contract: python -B apps/client/scripts/test-spider-generated.py.

Checks manifest-selected sources, never API jobs or rig palette/head preservation.
Head bounds and palms are per-frame native coordinates, before the pack offset.
Failures are expected until generated assets and their metadata are integrated.
"""
import hashlib
import importlib.util
from pathlib import Path
import sys
import unittest

from PIL import Image


# Importing the packer must not create another file in this shared checkout.
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/spider/pixellab"
MANIFEST = ART / "manifest.json"
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
CELL = (130, 161)
SIZE = (1170, 2898)
spec = importlib.util.spec_from_file_location(
    "spider_contract_packer", Path(__file__).with_name("pack-spider-pixellab.py"))
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)


def read_image(path):
    with Image.open(path) as image:
        return image.copy()


def digest(image):
    return hashlib.sha256(image.tobytes()).hexdigest()


def cell(image, row, column):
    return image.crop((column * CELL[0], row * CELL[1],
                       (column + 1) * CELL[0], (row + 1) * CELL[1]))


class SpiderGeneratedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source_root, cls.rows = packer.read_manifest(MANIFEST)
        cls.candidate = read_image(ART / "spider-candidate.png")

    def test_manifest_and_atlas_contract(self):
        self.assertEqual(len(self.rows), 18)
        self.assertEqual(tuple(len(self.rows[name]["frames"])
                               for name in packer.ROW_NAMES), COUNTS)
        self.assertEqual(sum(COUNTS), 108)
        self.assertEqual(self.candidate.mode, "RGBA")
        self.assertEqual(self.candidate.size, SIZE)
        occupied = 0
        for row, count in enumerate(COUNTS):
            for column in range(9):
                with self.subTest(row=row, column=column):
                    bounds = cell(self.candidate, row, column).getchannel("A").getbbox()
                    occupied += bounds is not None
                    if column < count:
                        self.assertIsNotNone(bounds, "missing occupied frame")
                    else:
                        self.assertIsNone(bounds, "unused row tail must be transparent")
        self.assertEqual(occupied, 108)

    def test_native_sources_fixed_translation_and_nearest_neighbor_pixels(self):
        for index, name in enumerate(packer.ROW_NAMES):
            row = self.rows[name]
            first, bbox = packer.load_frame(self.source_root / row["frames"][0], name)
            del first
            # One offset from the first pose, reused even when later poses move.
            offset = packer.row_translation(row, bbox)
            self.assertTrue(all(type(value) is int for value in offset), name)
            for column, relative in enumerate(row["frames"]):
                with self.subTest(row=name, frame=column, source=relative):
                    image = read_image(self.source_root / relative)
                    self.assertEqual(image.mode, "RGBA")
                    self.assertIn(image.size, ((64, 64), (88, 88), (96, 96)))
                    alpha = image.getchannel("A")
                    bounds = alpha.getbbox()
                    self.assertIsNotNone(bounds, "source is empty")
                    self.assertEqual(alpha.getextrema()[0], 0, "source needs real transparency")
                    left, top, right, bottom = bounds
                    packed = (2 * left + offset[0], 2 * top + offset[1],
                              2 * right + offset[0], 2 * bottom + offset[1])
                    self.assertGreaterEqual(packed[0], 0, "left clipping")
                    self.assertGreaterEqual(packed[1], 0, "top clipping")
                    self.assertLessEqual(packed[2], CELL[0], "right clipping")
                    self.assertLessEqual(packed[3], CELL[1], "bottom clipping")
                    visible = image.crop(bounds).resize(
                        ((right - left) * 2, (bottom - top) * 2), Image.Resampling.NEAREST)
                    expected = Image.new("RGBA", CELL)
                    expected.paste(visible, packed[:2])
                    self.assertEqual(digest(cell(self.candidate, index, column)),
                                     digest(expected), "source pixels/row translation differ")

    def test_generated_rows_use_api_sources_and_native_head_bounds(self):
        generated_root = (ART / "api-generated").resolve()
        for name in packer.ROW_NAMES[10:18]:
            row = self.rows[name]
            with self.subTest(row=name):
                heads = row.get("head_bounds", [])
                self.assertEqual(len(heads), len(row["frames"]), "head bounds required per pose")
            for column, relative in enumerate(row["frames"]):
                with self.subTest(row=name, frame=column):
                    source = (self.source_root / relative).resolve()
                    self.assertTrue(source.is_relative_to(generated_root),
                                    f"expected api-generated source, got {relative}")
                    image = read_image(source)
                    head = row["head_bounds"][column]
                    self.assertEqual(len(head), 4)
                    self.assertTrue(all(type(value) is int for value in head))
                    left, top, right, bottom = head
                    self.assertTrue(0 <= left < right <= image.width, head)
                    self.assertTrue(0 <= top < bottom <= image.height, head)
                    self.assertIsNotNone(image.crop(head).getchannel("A").getbbox(),
                                         "head bounds contain no visible pixels")

    def test_thirty_carry_frames_are_distinct_with_raised_red_gloves(self):
        total = 0
        for name in packer.ROW_NAMES[11:17]:
            row = self.rows[name]
            hashes = set()
            with self.subTest(row=name):
                self.assertEqual(len(row.get("palms", [])), len(row["frames"]),
                                 "native palm coordinates required per pose")
                self.assertEqual(len(row.get("head_bounds", [])), len(row["frames"]))
            for column, relative in enumerate(row["frames"]):
                image = read_image(self.source_root / relative)
                hashes.add(digest(image))
                total += 1
                with self.subTest(row=name, frame=column):
                    palms = row["palms"][column]
                    self.assertGreaterEqual(len(palms), 1, "at least one visible grip required")
                    head = row["head_bounds"][column]
                    for point in palms:
                        self.assertEqual(len(point), 2)
                        self.assertTrue(all(type(value) is int for value in point), point)
                        x, y = point
                        self.assertTrue(0 <= x < image.width and 0 <= y < image.height, point)
                        red, green, blue, alpha = image.getpixel((x, y))
                        self.assertEqual(alpha, 255, "palm must be opaque")
                        self.assertGreater(red, 60, "palm must be a red glove")
                        self.assertGreater(red, green * 1.25, "palm must be red-dominant")
                        self.assertGreater(red, blue * 1.25, "palm must be red-dominant")
                        self.assertLess(y, head[1] + 6, "grip must be above the face")
            with self.subTest(row=name, check="distinct strip poses"):
                self.assertEqual(len(hashes), len(row["frames"]), "duplicated carry poses")
        self.assertEqual(total, 30)

    def test_free_tier_rows_preserve_baseline_pixels(self):
        baseline = read_image(ART / "before-api-redraw/production.png")
        self.assertEqual(baseline.mode, "RGBA")
        self.assertEqual(baseline.size, SIZE)
        # cast.up is row 10 and intentionally excluded from preservation.
        for row in range(10):
            with self.subTest(row=packer.ROW_NAMES[row]):
                region = (0, row * CELL[1], SIZE[0], (row + 1) * CELL[1])
                self.assertEqual(digest(self.candidate.crop(region)),
                                 digest(baseline.crop(region)), "free-tier baseline changed")

    def test_repacked_candidate_and_production_match(self):
        rebuilt, _ = packer.build_sheet(MANIFEST)
        self.assertEqual(digest(rebuilt), digest(self.candidate), "candidate is stale")
        production = ROOT / "apps/client/public/sprites/spider.png"
        self.assertEqual(production.read_bytes(), (ART / "spider-candidate.png").read_bytes(),
                         "production differs from reviewed candidate")


if __name__ == "__main__":
    unittest.main()
